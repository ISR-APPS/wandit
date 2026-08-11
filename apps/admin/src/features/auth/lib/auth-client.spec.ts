import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.resetModules();
	vi.unstubAllGlobals();
});

describe("authClient", () => {
	it("sends session and sign-out requests only to the admin auth surface", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				Response.json({ session: null, user: null }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const { authClient } = await import("./auth-client");

		await authClient.getSession();
		await authClient.signOut();

		const requestedPaths = fetchMock.mock.calls.map(
			([input]) =>
				new URL(input instanceof Request ? input.url : String(input)).pathname,
		);
		expect(requestedPaths).toEqual([
			"/api/admin-auth/get-session",
			"/api/admin-auth/sign-out",
		]);
	});
});
