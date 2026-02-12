/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
  readonly PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
}

interface CloudflareEnv {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
  /** Required for account deletion (auth.admin.deleteUser). Server-only, never expose. */
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type AstroCloudflareRuntime =
  import('@astrojs/cloudflare').Runtime<CloudflareEnv>

declare namespace App {
  interface Locals extends AstroCloudflareRuntime {}
}
