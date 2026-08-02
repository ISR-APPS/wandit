import { describe, expect, it } from "vitest";

import { mapProductSettingsDto } from "./settings.dto";

const SETTINGS_PAYLOAD = {
	id: 1,
	earlyAccessRequired: true,
	signupGrantEnabled: false,
	signupGrantCredits: 20,
	paidSubscriptionsEnabled: false,
	topupsEnabled: false,
	version: 7,
	updatedByUserId: "admin_01JX9KRM8T",
	updatedAt: "2026-08-02T14:23:51.000Z",
};

describe("mapProductSettingsDto", () => {
	it("maps the contract payload to the admin settings model", () => {
		expect(mapProductSettingsDto(SETTINGS_PAYLOAD)).toEqual({
			id: 1,
			earlyAccessRequired: true,
			signupGrantEnabled: false,
			signupGrantCredits: 20,
			paidSubscriptionsEnabled: false,
			topupsEnabled: false,
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
	});
});
