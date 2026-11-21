import { adminUpdateManualRequestBodySchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("offline billing DTO mapping", () => {
	it("keeps approval outside the admin status PATCH", () => {
		expect(
			adminUpdateManualRequestBodySchema.safeParse({ status: "approved" })
				.success,
		).toBe(false);
	});
});
