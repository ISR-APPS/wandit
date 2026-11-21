// The fixed Supabase answers for a starter that has no backend: one demo user, its profiles row, and its access row.
// shot.mjs answers the browser requests of a screenshot with it.
// preview-worker.mjs answers the requests of a live preview with it. deploy-previews.mjs copies this file next to it.
// It uses only web platform APIs, so it runs in Node and in a Cloudflare Worker.

/** Email of the demo user when the visitor gave none. example.com is a reserved documentation domain. */
export const DEMO_EMAIL = "demo@example.com";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
// One day. auth-js refreshes a token only in its last 90 seconds, so no refresh starts during a visit.
const SESSION_SECONDS = 24 * 60 * 60;

function base64Url(value) {
	return btoa(JSON.stringify(value))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

function demoUser(email) {
	const now = new Date().toISOString();
	return {
		id: DEMO_USER_ID,
		aud: "authenticated",
		role: "authenticated",
		email,
		email_confirmed_at: now,
		app_metadata: { provider: "email", providers: ["email"] },
		user_metadata: {},
		identities: [],
		created_at: now,
		updated_at: now,
	};
}

/**
 * A session that auth-js accepts from storage or from a sign-in answer.
 * The token has the form of a JWT, but no server checks its signature: no real data exists.
 */
export function demoSession(email) {
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
	const accessToken = [
		base64Url({ alg: "HS256", typ: "JWT" }),
		base64Url({
			sub: DEMO_USER_ID,
			aud: "authenticated",
			role: "authenticated",
			email,
			exp: expiresAt,
		}),
		"demo-backend",
	].join(".");
	return {
		access_token: accessToken,
		refresh_token: "demo-backend-refresh",
		token_type: "bearer",
		expires_in: SESSION_SECONDS,
		expires_at: expiresAt,
		user: demoUser(email),
	};
}

/**
 * The answer to one Supabase request: `{ status, body }`. `body` is null for a 204.
 * `accept` is the Accept header. `email` is the email of the sign-in or sign-up body, or DEMO_EMAIL.
 * A path that a starter must not call gets a 404. The caller names it in its log.
 */
export function demoSupabaseAnswer({ method, pathname, accept, email }) {
	if (pathname === "/auth/v1/token" || pathname === "/auth/v1/signup") {
		return { status: 200, body: demoSession(email) };
	}
	if (pathname === "/auth/v1/user") {
		return { status: 200, body: demoUser(email) };
	}
	if (pathname.startsWith("/auth/v1/")) {
		return { status: 200, body: {} };
	}
	const now = new Date().toISOString();
	// One row of each table that the base template reads, with the columns of supabase/migrations/0000_base.sql.
	const demoRows = {
		"/rest/v1/profiles": {
			id: DEMO_USER_ID,
			full_name: "Demo User",
			created_at: now,
			updated_at: now,
		},
		// The demo user is the approved owner, so the access gate of /app opens.
		"/rest/v1/app_access": {
			user_id: DEMO_USER_ID,
			email,
			role: "owner",
			status: "approved",
			requested_at: now,
		},
	};
	const row = demoRows[pathname];
	if (row !== undefined) {
		if (method !== "GET") {
			// A save looks done. The next page load shows the demo row again.
			return { status: 204, body: null };
		}
		// `.single()` asks for one object. All other reads get a list of rows.
		const wantsObject = accept.includes("vnd.pgrst.object");
		return { status: 200, body: wantsObject ? row : [row] };
	}
	return {
		status: 404,
		body: { message: `The demo backend has no answer for ${pathname}` },
	};
}
