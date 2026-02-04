import {
	createBrowserClient,
	createServerClient,
	parseCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
	SUPABASE_URL?: string;
	SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
};

/** Browser client – use in <script> in .astro pages. Needs PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env (same values as server vars for local dev). */
export function createSupabaseBrowserClient(): SupabaseClient {
	const url =
		import.meta.env.PUBLIC_SUPABASE_URL
	const key =
		import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY 
	if (!url || !key) {
		throw new Error(
			"Supabase client: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY (or PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) in .env.",
		);
	}
	return createBrowserClient(url, key);
}

type AstroCookies = {
	set: (name: string, value: string, options?: { path?: string }) => void;
};

/** Server client – use in API routes and server-rendered pages. Cookies = PKCE verifier + session. */
export function getSupabaseServer(
	locals: unknown,
	request: Request,
	cookies: AstroCookies,
): SupabaseClient {
	const env = (locals as any).runtime?.env ?? {};
	const url = env?.SUPABASE_URL;
	const key = env?.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
	if (!url || !key) {
		throw new Error("Supabase env vars missing.");
	}
	const cookieHeader = request.headers.get("Cookie") ?? "";

	return createServerClient(url, key, {
		cookies: {
			getAll() {
				return parseCookieHeader(cookieHeader).map((c) => ({
					name: c.name,
					value: c.value ?? "",
				}));
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) =>
					cookies.set(name, value, { path: "/" }),
				);
			},
		},
	});
}
