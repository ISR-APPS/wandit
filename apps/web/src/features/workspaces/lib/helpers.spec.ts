import { describe, expect, it } from "vitest";

import { isOpenInvitation } from "./helpers";

describe("isOpenInvitation", () => {
	const now = new Date("2026-11-04T12:00:00.000Z");

	it.each([
		{
			label: "a pending invitation that expires later",
			status: "pending" as const,
			expiresAt: "2026-11-05T12:00:00.000Z",
			isOpen: true,
		},
		{
			label: "a pending invitation past its expiry",
			status: "pending" as const,
			expiresAt: "2026-11-04T11:59:59.000Z",
			isOpen: false,
		},
		{
			label: "a canceled invitation that expires later",
			status: "canceled" as const,
			expiresAt: "2026-11-05T12:00:00.000Z",
			isOpen: false,
		},
	])("answers $isOpen for $label", ({ status, expiresAt, isOpen }) => {
		expect(
			isOpenInvitation({ status, expiresAt: new Date(expiresAt) }, now),
		).toBe(isOpen);
	});
});
