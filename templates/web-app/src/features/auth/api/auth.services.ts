// Session check for routes behind login. A route `beforeLoad` calls requireSession().
// Supabase keeps the session in the browser, so those routes set `ssr: false`.
import type { Session } from "@supabase/supabase-js";
import { redirect } from "@tanstack/react-router";
import { getSupabase } from "~/shared/lib/supabase";

/** Returns the signed-in session. Throws a redirect to /login when nobody is signed in. */
export async function requireSession(): Promise<Session> {
	const { data, error } = await getSupabase().auth.getSession();
	if (error) {
		// A failed token refresh ends the old session. The visitor signs in again.
		console.error("Session check failed", error.message);
	}
	if (!data.session) {
		throw redirect({ to: "/login" });
	}
	return data.session;
}
