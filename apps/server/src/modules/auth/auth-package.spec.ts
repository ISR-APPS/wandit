import { createUserCreatedHook } from "@wandit/auth/user-created-hook";
import type { GenericEndpointContext, User } from "better-auth";
import { describe, expect, it, vi } from "vitest";

describe("@wandit/auth user-created hook", () => {
	it("forwards the Better Auth context and signup body", async () => {
		const onUserCreated = vi.fn(
			(_user: User, _ctx: GenericEndpointContext | null) => undefined,
		);
		const user = { id: "user_1" } as User;
		const ctx = {
			body: { affiliateToken: "signed-affiliate-token" },
		} as GenericEndpointContext;
		const hook = createUserCreatedHook(onUserCreated);

		await hook(user, ctx);

		expect(onUserCreated).toHaveBeenCalledOnce();
		expect(onUserCreated).toHaveBeenCalledWith(user, ctx);
		expect(onUserCreated.mock.calls[0]?.[1]?.body).toEqual({
			affiliateToken: "signed-affiliate-token",
		});
	});
});
