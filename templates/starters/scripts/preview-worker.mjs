// Entry of a starter template preview Worker on <id>-template.wandit.app.
// deploy-previews.mjs copies it and demo-backend.mjs next to the built server entry (dist/server/index.js).
// A preview has no backend, so the Supabase calls of the app get the demo-backend.mjs answers.
// Every other request goes to the built TanStack Start Worker.
import { DEMO_EMAIL, demoSupabaseAnswer } from "./demo-backend.mjs";
import app from "./index.js";

// Search engines must not list 50 demo apps as real sites.
const NO_INDEX = "noindex, nofollow";

// The email that the visitor typed on the sign-in or sign-up form, or the demo email.
async function emailOf(request) {
	try {
		const body = await request.json();
		return typeof body.email === "string" && body.email.includes("@")
			? body.email
			: DEMO_EMAIL;
	} catch (error) {
		// A POST with no JSON body has no email. The session then names the demo email.
		console.warn("Preview auth body is not JSON", String(error));
		return DEMO_EMAIL;
	}
}

async function answerSupabase(request, pathname) {
	const { status, body } = demoSupabaseAnswer({
		method: request.method,
		pathname,
		accept: request.headers.get("accept") ?? "",
		// Only sign-in, sign-up, and refresh send a JSON body. A sign-out POST has none.
		email:
			pathname === "/auth/v1/token" || pathname === "/auth/v1/signup"
				? await emailOf(request)
				: DEMO_EMAIL,
	});
	if (status === 404) {
		console.warn(`The preview app called ${request.method} ${pathname}`);
	}
	return new Response(body === null ? null : JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "x-robots-tag": NO_INDEX },
	});
}

export default {
	async fetch(request, env, context) {
		const { pathname } = new URL(request.url);
		if (pathname.startsWith("/auth/v1/") || pathname.startsWith("/rest/v1/")) {
			return answerSupabase(request, pathname);
		}
		const response = await app.fetch(request, env, context);
		// A copy, because the headers of a fetched response are read-only.
		const indexed = new Response(response.body, response);
		indexed.headers.set("x-robots-tag", NO_INDEX);
		return indexed;
	},
};
