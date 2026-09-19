"""Run-time workflow: starting a card, moving it, history, versioning safety."""

from __future__ import annotations

import datetime as dt

import pytest

from app.core.access import AccessScope
from app.core.errors import (
    AccessDeniedError,
    ValidationError,
    WorkflowInvalidTransitionError,
)
from app.models.enums import AuditAction, CounterpartyGroup
from app.schemas.interaction import InteractionCreate
from app.schemas.university import AssignmentCreate, UniversityCreate
from app.services.assignments import AssignmentService
from app.services.audit import search_audit_log
from app.services.catalogs import UniversityService
from app.services.interactions import InteractionService
from app.services.route import RouteService
from app.services.workflow import WorkflowService
from app.services.workflow_presets import ensure_base_workflow
from tests.conftest import auth


async def _card(session, scope, name: str = "МГТУ"):
    university = await UniversityService(session, scope).create(UniversityCreate(name=name))
    interaction = await InteractionService(session, scope).create(
        InteractionCreate(university_id=university.id)
    )
    return university, interaction


async def _stages(session, scope, workflow):
    service = WorkflowService(session, scope)
    version = (await service.list_versions(workflow.id))[0]
    stages = await service.list_stages(version.id)
    return version, {stage.code: stage for stage in stages}


async def test_new_card_joins_the_default_workflow(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    assert interaction.current_stage_id == stages["WF-01"].id
    assert interaction.workflow_version_id is not None

    history = await RouteService(session, scope).history_for(interaction.id)
    assert len(history) == 1
    assert history[0].from_stage_id is None
    assert history[0].to_stage_id == stages["WF-01"].id


async def test_card_created_before_any_workflow_can_be_started_later(session, scope):
    _, interaction = await _card(session, scope)
    assert interaction.current_stage_id is None, "маршрута ещё нет — карточка просто заводится"

    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)

    started = await RouteService(session, scope).start(interaction.id)
    assert started.current_stage_id == stages["WF-01"].id


async def test_starting_an_already_running_card_is_refused(session, scope):
    await ensure_base_workflow(session, scope)
    _, interaction = await _card(session, scope)
    with pytest.raises(ValidationError):
        await RouteService(session, scope).start(interaction.id)


async def test_transition_moves_the_card_and_records_the_comment(session, scope):
    """FR-03: переход + комментарий, оба попадают в историю."""
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    service = RouteService(session, scope)
    moved = await service.transition(
        interaction.id, to_stage_id=stages["WF-02"].id, comment="Дозвонились до проректора"
    )
    assert moved.current_stage_id == stages["WF-02"].id

    history = await service.history_for(interaction.id)
    assert len(history) == 2
    assert history[-1].from_stage_id == stages["WF-01"].id
    assert history[-1].to_stage_id == stages["WF-02"].id
    assert history[-1].comment == "Дозвонились до проректора"


async def test_disallowed_transition_names_the_allowed_targets(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    with pytest.raises(WorkflowInvalidTransitionError) as excinfo:
        await RouteService(session, scope).transition(
            interaction.id, to_stage_id=stages["WF-09"].id, comment="перепрыгнем"
        )
    allowed = excinfo.value.details["allowed_stage_ids"]
    assert str(stages["WF-02"].id) in allowed
    assert str(stages["WF-09"].id) not in allowed


async def test_comment_is_required_when_the_transition_demands_it(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    with pytest.raises(ValidationError):
        await RouteService(session, scope).transition(
            interaction.id, to_stage_id=stages["WF-02"].id, comment="   "
        )


async def test_optional_step_can_be_skipped(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    service = RouteService(session, scope)
    for code in ("WF-02", "WF-03", "WF-04"):
        await service.transition(interaction.id, to_stage_id=stages[code].id, comment="дальше")

    moved = await service.transition(
        interaction.id, to_stage_id=stages["WF-06"].id, comment="правки не нужны"
    )
    assert moved.current_stage_id == stages["WF-06"].id


async def test_card_can_be_returned_to_the_previous_stage(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    service = RouteService(session, scope)
    await service.transition(interaction.id, to_stage_id=stages["WF-02"].id, comment="вперёд")
    back = await service.transition(
        interaction.id, to_stage_id=stages["WF-01"].id, comment="контакт оказался неверным"
    )
    assert back.current_stage_id == stages["WF-01"].id


async def test_published_new_version_does_not_reroute_a_running_card(session, scope):
    """A6: карточка помнит версию, по которой стартовала."""
    workflow = await ensure_base_workflow(session, scope)
    old_version, old_stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)
    assert interaction.workflow_version_id == old_version.id

    # Новая версия: копируем, выкидываем «Организацию встречи» и публикуем.
    service = WorkflowService(session, scope)
    draft = await service.create_draft(workflow.id, clone_from_id=old_version.id)
    cloned = {stage.code: stage for stage in await service.list_stages(draft.id)}
    await service.delete_stage(cloned["WF-03"].id, target_stage_id=cloned["WF-04"].id, confirm=True)
    await service.publish(draft.id)

    route = RouteService(session, scope)
    refreshed = await route.interactions.get_or_fail(interaction.id)
    assert refreshed.workflow_version_id == old_version.id, "карточка осталась на своей версии"

    # И маршрут старой версии продолжает работать целиком.
    await route.transition(interaction.id, to_stage_id=old_stages["WF-02"].id, comment="вперёд")
    moved = await route.transition(
        interaction.id, to_stage_id=old_stages["WF-03"].id, comment="встреча назначена"
    )
    assert moved.current_stage_id == old_stages["WF-03"].id

    # А новая карточка уже идёт по новой версии.
    _, fresh = await _card(session, scope, name="СПбПУ")
    assert fresh.workflow_version_id == draft.id


async def test_migration_preview_requires_confirmation_and_records_audit(session, scope):
    """A9/A12: active cards move only after a reviewed, explicit confirmation."""
    workflow = await ensure_base_workflow(session, scope)
    old_version, old_stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    service = WorkflowService(session, scope)
    draft = await service.create_draft(workflow.id, clone_from_id=old_version.id)
    preview = await service.migration_preview(draft.id)
    assert preview["affected_count"] == 1
    assert preview["affected_cards"][0]["interaction_id"] == interaction.id
    assert preview["affected_cards"][0]["from_stage_id"] == old_stages["WF-01"].id
    assert preview["affected_cards"][0]["to_stage_id"] is not None

    with pytest.raises(ValidationError):
        await service.publish(draft.id, confirm_migration=False)

    migrated = await service.publish(draft.id, confirm_migration=True)
    refreshed = await RouteService(session, scope).interactions.get_or_fail(interaction.id)
    assert refreshed.workflow_version_id == migrated.id
    assert refreshed.current_stage_id == preview["affected_cards"][0]["to_stage_id"]

    entries, total = await search_audit_log(
        session, entity_type="workflow_migration", action=AuditAction.UPDATE
    )
    assert total == 1
    assert entries[0].changes["affected_count"] == 1


async def test_stage_delete_transfers_cards_to_selected_target(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    version, _ = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope, "Удаление этапа")

    # A draft may contain cards after an admin explicitly starts them on it.
    service = WorkflowService(session, scope)
    draft = await service.create_draft(workflow.id, clone_from_id=version.id)
    draft_stages = {stage.code: stage for stage in await service.list_stages(draft.id)}
    interaction.workflow_version_id = draft.id
    interaction.current_stage_id = draft_stages["WF-01"].id
    await session.commit()

    preview = await service.stage_delete_preview(draft_stages["WF-01"].id)
    assert preview["affected_count"] == 1
    assert preview["interaction_ids"] == [interaction.id]
    assert preview["suggested_target_stage_id"] == draft_stages["WF-02"].id

    with pytest.raises(ValidationError):
        await service.delete_stage(
            draft_stages["WF-01"].id, target_stage_id=draft_stages["WF-02"].id
        )

    with pytest.raises(ValidationError):
        await service.delete_stage(draft_stages["WF-01"].id, confirm=True)

    await service.delete_stage(
        draft_stages["WF-01"].id,
        target_stage_id=draft_stages["WF-02"].id,
        confirm=True,
    )
    refreshed = await InteractionService(session, scope).get(interaction.id)
    assert refreshed.current_stage_id == draft_stages["WF-02"].id
    entries, total = await search_audit_log(
        session, entity_type="workflow_stage_bulk_transfer", action=AuditAction.UPDATE
    )
    assert total == 1
    assert entries[0].changes["from_stage_id"] == str(draft_stages["WF-01"].id)
    assert entries[0].changes["to_stage_id"] == str(draft_stages["WF-02"].id)
    assert entries[0].changes["affected_count"] == 1


async def test_cards_use_the_workflow_assigned_to_their_counterparty_group(session, scope):
    b2b_workflow = await ensure_base_workflow(session, scope)
    b2b_version, b2b_stages = await _stages(session, scope, b2b_workflow)

    service = WorkflowService(session, scope)
    b2c_workflow = await service.create(
        name="Маршрут B2C", counterparty_group=CounterpartyGroup.B2C, is_default=True
    )
    b2c_draft = await service.create_draft(b2c_workflow.id)
    b2c_stage = await service.add_stage(b2c_draft.id, name="Новая заявка B2C", is_initial=True)
    await service.publish(b2c_draft.id)

    _, b2b_card = await _card(session, scope, "Вуз B2B")
    b2c_university = await UniversityService(session, scope).create(
        UniversityCreate(name="Вуз B2C")
    )
    b2c_card = await InteractionService(session, scope).create(
        InteractionCreate(
            university_id=b2c_university.id,
            counterparty_group=CounterpartyGroup.B2C,
        )
    )

    assert b2b_card.workflow_version_id == b2b_version.id
    assert b2b_card.current_stage_id == b2b_stages["WF-01"].id
    assert b2c_card.workflow_version_id == b2c_draft.id
    assert b2c_card.current_stage_id == b2c_stage.id

    wrong_group_university = await UniversityService(session, scope).create(
        UniversityCreate(name="Вуз с ошибочным маршрутом")
    )
    with pytest.raises(ValidationError):
        await InteractionService(session, scope).create(
            InteractionCreate(
                university_id=wrong_group_university.id,
                counterparty_group=CounterpartyGroup.B2B,
                workflow_id=b2c_workflow.id,
            )
        )


async def test_renaming_a_stage_does_not_disturb_a_card_standing_on_it(session, scope):
    """A4: переименование не ломает карточки, уже стоящие на этапе."""
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    await WorkflowService(session, scope).rename_stage(
        stages["WF-01"].id, {"name": "Поиск контактного лица"}
    )

    route = RouteService(session, scope)
    refreshed = await route.interactions.get_or_fail(interaction.id)
    assert refreshed.current_stage_id == stages["WF-01"].id

    moved = await route.transition(
        interaction.id, to_stage_id=stages["WF-02"].id, comment="переход после переименования"
    )
    assert moved.current_stage_id == stages["WF-02"].id


async def test_only_admin_can_confirm_rename_of_published_stage(
    session, client, admin_user, manager_user, scope
):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    stage = stages["WF-01"]

    denied = await client.patch(
        f"/api/v1/workflow-stages/{stage.id}",
        json={"name": "Новое название", "confirm": True},
        headers=auth(manager_user),
    )
    assert denied.status_code == 403

    unconfirmed = await client.patch(
        f"/api/v1/workflow-stages/{stage.id}",
        json={"name": "Новое название"},
        headers=auth(admin_user),
    )
    assert unconfirmed.status_code == 422
    assert unconfirmed.json()["error"]["details"]["current_name"] == stage.name

    renamed = await client.patch(
        f"/api/v1/workflow-stages/{stage.id}",
        json={"name": "Новое название", "confirm": True},
        headers=auth(admin_user),
    )
    assert renamed.status_code == 200
    entries, total = await search_audit_log(
        session, entity_type="workflow_stage_rename", action=AuditAction.UPDATE
    )
    assert total == 1
    assert entries[0].changes["old"]["name"] == stage.name
    assert entries[0].changes["new"]["name"] == "Новое название"


async def test_stage_delete_preview_api_requires_explicit_confirmation(
    session, client, manager_user, scope
):
    workflow = await ensure_base_workflow(session, scope)
    version, _ = await _stages(session, scope, workflow)
    service = WorkflowService(session, scope)
    draft = await service.create_draft(workflow.id, clone_from_id=version.id)
    draft_stages = {stage.code: stage for stage in await service.list_stages(draft.id)}

    preview = await client.get(
        f"/api/v1/workflow-stages/{draft_stages['WF-01'].id}/delete-preview",
        headers=auth(manager_user),
    )
    assert preview.status_code == 200
    assert preview.json()["suggested_target_stage_id"] == str(draft_stages["WF-02"].id)

    fetched = await client.get(
        f"/api/v1/workflow-stages/{draft_stages['WF-01'].id}",
        headers=auth(manager_user),
    )
    assert fetched.status_code == 200
    assert fetched.json()["id"] == str(draft_stages["WF-01"].id)

    refused = await client.request(
        "DELETE",
        f"/api/v1/workflow-stages/{draft_stages['WF-01'].id}",
        json={"target_stage_id": str(draft_stages["WF-02"].id)},
        headers=auth(manager_user),
    )
    assert refused.status_code == 422


async def test_transition_is_audited(session, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    await RouteService(session, scope).transition(
        interaction.id, to_stage_id=stages["WF-02"].id, comment="в аудит"
    )

    entries, total = await search_audit_log(
        session, entity_type="interaction_stage_history", action=AuditAction.CREATE
    )
    assert total == 2  # постановка на маршрут + переход
    assert entries[0].changes["comment"]["new"] == "в аудит"

    updates, _ = await search_audit_log(
        session,
        entity_type="interactions",
        entity_id=interaction.id,
        action=AuditAction.UPDATE,
    )
    assert any("current_stage_id" in entry.changes for entry in updates)


async def test_route_view_bundles_everything_for_the_ui(session, scope):
    """A7 для конкретной карточки."""
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    view = await RouteService(session, scope).route_view(interaction.id)
    assert len(view["stages"]) == 14
    assert len(view["transitions"]) == 27
    assert len(view["history"]) == 1
    available = {item.to_stage_id for item in view["available_transitions"]}
    assert available == {stages["WF-02"].id}


async def test_user_cannot_move_a_foreign_card(session, kam_user):
    system = AccessScope.system()
    workflow = await ensure_base_workflow(session, system)
    _, stages = await _stages(session, system, workflow)

    mine = await UniversityService(session, system).create(UniversityCreate(name="Мой вуз"))
    await AssignmentService(session, system).create(
        mine.id,
        AssignmentCreate(user_id=kam_user.id, assigned_from=dt.date.today() - dt.timedelta(days=1)),
    )
    _, foreign_card = await _card(session, system, name="Чужой вуз")

    scoped = RouteService(session, AccessScope(user_id=kam_user.id, is_privileged=False))
    with pytest.raises(AccessDeniedError):
        await scoped.transition(foreign_card.id, to_stage_id=stages["WF-02"].id, comment="не моё")


async def test_transition_api_roundtrip(session, client, manager_user, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    _, interaction = await _card(session, scope)

    response = await client.post(
        f"/api/v1/interactions/{interaction.id}/transitions",
        json={"to_stage_id": str(stages["WF-02"].id), "comment": "через API"},
        headers=auth(manager_user),
    )
    assert response.status_code == 200
    assert response.json()["current_stage_id"] == str(stages["WF-02"].id)

    route = await client.get(
        f"/api/v1/interactions/{interaction.id}/route", headers=auth(manager_user)
    )
    body = route.json()
    assert body["current_stage_id"] == str(stages["WF-02"].id)
    assert len(body["history"]) == 2
    assert body["history"][-1]["comment"] == "через API"
    assert len(body["stages"]) == 14

    bad = await client.post(
        f"/api/v1/interactions/{interaction.id}/transitions",
        json={"to_stage_id": str(stages["WF-10"].id), "comment": "прыжок"},
        headers=auth(manager_user),
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "WORKFLOW_INVALID_TRANSITION"


async def test_user_can_transition_their_own_card_via_api(session, client, kam_user, scope):
    """Regression: the endpoint used to hard-gate on role and refuse every
    `user`, even for a card in a university they are actually assigned to
    (FR-03 explicitly gives status transitions and commenting to the base
    user, not just manager/admin)."""
    system = AccessScope.system()
    workflow = await ensure_base_workflow(session, system)
    _, stages = await _stages(session, system, workflow)

    mine = await UniversityService(session, system).create(UniversityCreate(name="Мой вуз"))
    await AssignmentService(session, system).create(
        mine.id,
        AssignmentCreate(user_id=kam_user.id, assigned_from=dt.date.today() - dt.timedelta(days=1)),
    )
    interaction = await InteractionService(session, system).create(
        InteractionCreate(university_id=mine.id)
    )

    response = await client.post(
        f"/api/v1/interactions/{interaction.id}/transitions",
        json={"to_stage_id": str(stages["WF-02"].id), "comment": "КАМ двигает свою карточку"},
        headers=auth(kam_user),
    )
    assert response.status_code == 200
    assert response.json()["current_stage_id"] == str(stages["WF-02"].id)


async def test_user_cannot_transition_a_foreign_card_via_api(session, client, kam_user, scope):
    """The role gate is gone, but the row-level scope check must still hold."""
    system = AccessScope.system()
    workflow = await ensure_base_workflow(session, system)
    _, stages = await _stages(session, system, workflow)
    _, foreign_card = await _card(session, system, name="Чужой вуз")

    response = await client.post(
        f"/api/v1/interactions/{foreign_card.id}/transitions",
        json={"to_stage_id": str(stages["WF-02"].id), "comment": "не моё"},
        headers=auth(kam_user),
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACCESS_DENIED"


async def test_user_can_start_route_on_their_own_card(session, client, kam_user):
    system = AccessScope.system()
    workflow = await ensure_base_workflow(session, system)
    university = await UniversityService(session, system).create(UniversityCreate(name="Мой вуз"))
    await AssignmentService(session, system).create(
        university.id,
        AssignmentCreate(user_id=kam_user.id, assigned_from=dt.date.today() - dt.timedelta(days=1)),
    )
    # Bypass the auto-start on create so `route/start` has something to do.
    interaction = await InteractionService(session, system).create(
        InteractionCreate(university_id=university.id)
    )
    interaction.workflow_version_id = None
    interaction.current_stage_id = None
    await session.commit()

    response = await client.post(
        f"/api/v1/interactions/{interaction.id}/route/start",
        json={"workflow_id": str(workflow.id)},
        headers=auth(kam_user),
    )
    assert response.status_code == 200
    assert response.json()["current_stage_id"] is not None


async def test_graph_api_reports_cards_per_stage(session, client, manager_user, scope):
    workflow = await ensure_base_workflow(session, scope)
    _, stages = await _stages(session, scope, workflow)
    await _card(session, scope, name="Первый вуз")
    await _card(session, scope, name="Второй вуз")

    response = await client.get(
        f"/api/v1/workflows/{workflow.id}/graph", headers=auth(manager_user)
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["stages"]) == 14
    assert len(body["transitions"]) == 27
    counts = {item["stage_id"]: item["cards"] for item in body["cards_per_stage"]}
    assert counts == {str(stages["WF-01"].id): 2}
