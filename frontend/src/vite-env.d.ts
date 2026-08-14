/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" (padrão) usa MockChatApi; "false" usa RealChatApi. Ver src/App.tsx. */
  readonly VITE_USE_MOCK_API?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
