import type { AuthUser } from "@wandit/auth";
import { describe, expect, it } from "vitest";

import { AuthMeController } from "./me.controller";

describe("AuthMeController", () => {
	it("returns support for a stored support role", () => {
		const controller = new AuthMeController();
		const user = {
			id: "user-1",
			name: "Support Teammate",
			email: "support@example.com",
			emailVerified: true,
			image: null,
			role: "user,support",
			createdAt: new Date("2026-08-01T00:00:00.000Z"),
			updatedAt: new Date("2026-08-02T00:00:00.000Z"),
		} as AuthUser;

		expect(controller.me(user)).toMatchObject({
			id: "user-1",
			role: "support",
		});
	});
});
