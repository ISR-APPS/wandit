import { patchProductSettingsBodySchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { mapProductSettingsDto } from "./settings.dto";

const SETTINGS_PAYLOAD = {
	id: 1,
	signupGrantEnabled: false,
	signupGrantCredits: 20,
	paidSubscriptionsEnabled: false,
	manualPaymentsEnabled: false,
	manualGraceDays: 3,
	topupsEnabled: false,
	organizationsEnabled: false,
	emailAuthEnabled: false,
	version: 7,
	updatedByUserId: "admin_01JX9KRM8T",
	updatedAt: "2026-08-02T14:23:51.000Z",
};

describe("mapProductSettingsDto", () => {
	it("maps the contract payload to the admin settings model", () => {
		expect(mapProductSettingsDto(SETTINGS_PAYLOAD)).toEqual({
			id: 1,
			signupGrantEnabled: false,
			signupGrantCredits: 20,
			paidSubscriptionsEnabled: false,
			manualPaymentsEnabled: false,
			manualGraceDays: 3,
			topupsEnabled: false,
			organizationsEnabled: false,
			emailAuthEnabled: false,
			version: 7,
			updatedBy: "admin_01JX9KRM8T",
			updatedAt: "2026-08-02T14:23:51.000Z",
		});
	});

	it("rejects a malformed settings payload", () => {
		expect(() =>
			mapProductSettingsDto({
				...SETTINGS_PAYLOAD,
				signupGrantCredits: 0,
			}),
		).toThrow();

		expect(() =>
			mapProductSettingsDto({
				...SETTINGS_PAYLOAD,
				manualGraceDays: 31,
			}),
		).toThrow();
	});
});

describe("manualGraceDays PATCH validation", () => {
	it.each([0, 30])("accepts the boundary value %i", (manualGraceDays) => {
		expect(
			patchProductSettingsBodySchema.safeParse({
				manualGraceDays,
				version: 7,
			}).success,
		).toBe(true);
	});

	it.each([31, -1])("rejects the out-of-range value %i", (manualGraceDays) => {
		expect(
			patchProductSettingsBodySchema.safeParse({
				manualGraceDays,
				version: 7,
			}).success,
		).toBe(false);
	});

	it("rejects a non-integer value", () => {
		expect(
			patchProductSettingsBodySchema.safeParse({
				manualGraceDays: 1.5,
				version: 7,
			}).success,
		).toBe(false);
	});
});
