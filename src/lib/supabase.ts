import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
	SUPABASE_URL?: string;
	SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
};

export function getSupabase(env: SupabaseEnv): SupabaseClient {
	if (!env?.SUPABASE_URL || !env?.SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
		throw new Error("Supabase env vars missing.");
	}
	return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_DEFAULT_KEY, {
		auth: { flowType: "pkce" },
	});
}

/** Use in API routes: getSupabaseFromLocals(locals) for runtime env from Cloudflare. */
export function getSupabaseFromLocals(locals: unknown): SupabaseClient {
	return getSupabase((locals as any).runtime?.env ?? {});
}
