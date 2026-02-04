import type { APIRoute } from "astro";
import { getSupabaseServer } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";

const json = (body: { error: string; message: string }, status: number) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export const POST: APIRoute = async ({
	request,
	cookies,
	redirect,
	locals,
}) => {
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

	const formData = await request.formData();
	const email = formData.get("email")?.toString();
	const password = formData.get("password")?.toString();
	const provider = formData.get("provider")?.toString();
	const lang = (formData.get("lang")?.toString() || "en") as string;

	if (provider === "github") {
		const callbackUrl = new URL("/api/auth/callback", request.url);
		callbackUrl.searchParams.set("lang", lang);
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: "github" as Provider,
			options: { redirectTo: callbackUrl.toString() },
		});
		if (error) {
			return json(
				{ error: "auth/oauth", message: error.message },
				500,
			);
		}
		if (!data?.url) {
			return json(
				{
					error: "auth/oauth",
					message: "No redirect URL returned by Supabase.",
				},
				500,
			);
		}
		return redirect(data.url);
	}

	if (!email || !password) {
		return new Response("Email and password are required", { status: 400 });
	}

	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return json({ error: "auth/signin", message: error.message }, 500);
	}

	const session = data?.session;
	if (!session?.access_token || !session?.refresh_token) {
		return json(
			{
				error: "auth/session-missing",
				message:
					"No session returned (e.g. email not confirmed). Check Supabase auth settings.",
			},
			500,
		);
	}

	return redirect(`/${lang}/courses`);
};
