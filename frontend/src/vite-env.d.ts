/// <reference types="vite/client" />

declare module '*.ttf?url' {
  const url: string;
  export default url;
}

interface Window {
  __CRM_CONFIG__?: { keycloakRealm?: string };
}
