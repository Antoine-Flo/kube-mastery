/// <reference types="astro/client" />

interface CloudflareEnv {
	SUPABASE_URL: string;
	SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
}

declare namespace App {
	interface Locals extends import("@astrojs/cloudflare").Runtime<CloudflareEnv> { }
}
