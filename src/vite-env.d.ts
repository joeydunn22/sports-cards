interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly BASE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Set by vite.config.ts at build time. */
declare const __BUILD__: { id: string; time: string }
