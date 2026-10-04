// Creates one test account in the app's Supabase Auth, so the user can try sign-in at once.
// The agent runs it (CLAUDE.md "Sign-in rule"): node --env-file=.env scripts/create-test-user.mjs [email]
// It calls the public sign-up endpoint with the anon key, then prints the email and the password.
// The web template has the same script with the VITE_ names.
import { randomBytes } from "node:crypto";
import { z } from "zod";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
	console.error(
		"Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
			"Run: node --env-file=.env scripts/create-test-user.mjs",
	);
	process.exit(1);
}

// A random suffix, so a second run never collides with an existing account.
const suffix = randomBytes(3).toString("hex");
const email = process.argv[2] ?? `test.${suffix}@wandit.app`;
// 12 URL-safe characters: more than the 8 of the app sign-up form and the 6 of Supabase.
const password = randomBytes(9).toString("base64url");

// Email confirmation is off for the app, so a new account answers with a session.
const sessionSchema = z.object({ access_token: z.string().min(1) });
const errorSchema = z.object({
	error_code: z.string().optional(),
	msg: z.string().optional(),
});

let response;
try {
	response = await fetch(`${url}/auth/v1/signup`, {
		method: "POST",
		headers: { apikey: anonKey, "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
} catch (error) {
	// The sandbox reaches the backend host only while the backend is active.
	console.error(`Cannot reach the app backend: ${error.message}`);
	process.exit(1);
}

// A body that is not JSON (a proxy error page) still gets a clear message below.
const body = await response.json().catch(() => null);
if (!response.ok) {
	const parsed = errorSchema.safeParse(body);
	const reason = parsed.success
		? `${parsed.data.error_code ?? "error"}: ${parsed.data.msg ?? ""}`
		: "no error text";
	console.error(`Sign-up refused (HTTP ${response.status}) ${reason}`);
	process.exit(1);
}
if (!sessionSchema.safeParse(body).success) {
	console.error(
		"The account exists but needs an email confirmation. " +
			"This backend has email confirmation on, so the test account cannot sign in.",
	);
	process.exit(1);
}

console.log(`Test account created.\nEmail: ${email}\nPassword: ${password}`);
