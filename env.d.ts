/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly PUBLIC_SUPABASE_URL: string;
	readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

interface CloudflareEnv {
	SUPABASE_URL: string;
	SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
}

declare namespace App {
	interface Locals extends import("@astrojs/cloudflare").Runtime<CloudflareEnv> { }
}
