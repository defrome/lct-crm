import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { workflowsApi } from '@/api/endpoints';
import { qk } from '@/app/queryClient';
import type { StageRead, WorkflowGraph, WorkflowRead } from '@/api/types';

export interface StageInfo {
  stage: StageRead;
  workflow: WorkflowRead;
  /** Position in its route, 1-based — «этап 7 из 14». */
  index: number;
  total: number;
}

/**
 * Cards carry only `current_stage_id`, so a list has no way to name the stage a
 * card stands on. Published routes are few (usually just WF-BASE) and change
 * rarely, so every one is loaded once and turned into a lookup that the tables,
 * the dashboard and the reports all share.
 */
export function useStageLookup() {
  const workflows = useQuery({
    queryKey: qk.workflows({ size: 100 }),
    queryFn: () => workflowsApi.list({ size: 100 }),
    staleTime: 10 * 60_000,
  });

  const graphs = useQueries({
    queries: (workflows.data?.items ?? []).map((workflow) => ({
      queryKey: qk.workflowGraph(workflow.id),
      queryFn: () => workflowsApi.graph(workflow.id),
      staleTime: 10 * 60_000,
      // A workflow with no published version has no graph; that is not an error
      // worth surfacing on a list screen.
      retry: false,
    })),
  });

  // `useQueries` returns a new array on every render, so memoising on it would
  // rebuild the map each time and invalidate every consumer downstream. The
  // signature changes only when a graph actually arrives or refetches.
  const signature = graphs.map((graph) => graph.dataUpdatedAt).join(',');
  const results = graphs.map((graph) => graph.data);
  const loading = workflows.isLoading || graphs.some((graph) => graph.isLoading);

  return useMemo(() => {
    const byStageId = new Map<string, StageInfo>();
    const loaded: WorkflowGraph[] = [];

    for (const graph of results) {
      if (!graph) continue;
      loaded.push(graph);
      const stages = [...graph.stages].sort((a, b) => a.order_index - b.order_index);
      stages.forEach((stage, index) => {
        byStageId.set(stage.id, {
          stage,
          workflow: graph.workflow,
          index: index + 1,
          total: stages.length,
        });
      });
    }

    const primary = loaded.find((graph) => graph.workflow.is_default) ?? loaded[0];

    return {
      byStageId,
      graphs: loaded,
      /** The route new cards join — what the dashboard visualises. */
      primary,
      isLoading: loading,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, loading]);
}
