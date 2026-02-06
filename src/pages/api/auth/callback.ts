import type { APIRoute } from "astro";
import { getSupabaseServer } from "../../../lib/supabase";

const json = (body: { error: string; message: string }, status: number) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export const GET: APIRoute = async ({ url, request, cookies, redirect, locals }) => {
	const authCode = url.searchParams.get("code");
	const lang = url.searchParams.get("lang") || "en";
	const rawRedirect = url.searchParams.get("redirect") ?? "";
	const redirectTo =
		rawRedirect.startsWith("/") && !rawRedirect.includes("//")
			? rawRedirect
			: "";

	if (!authCode) {
		return json(
			{ error: "auth/callback", message: "No code provided in OAuth callback." },
			400,
		);
	}

	let supabase;
	try {
		supabase = getSupabaseServer(locals, request, cookies);
	} catch (e) {
		return json(
			{
				error: "auth/config",
				message: e instanceof Error ? e.message : "Missing Supabase env.",
			},
			500,
		);
	}

	const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

	if (error) {
		return json(
			{ error: "auth/callback", message: error.message },
			500,
		);
	}

	const session = data?.session;
	if (!session?.access_token || !session?.refresh_token) {
		return json(
			{
				error: "auth/session-missing",
				message:
					"No session after code exchange. Check Supabase OAuth and PKCE settings.",
			},
			500,
		);
	}

	return redirect(redirectTo || `/${lang}/courses`);
};
