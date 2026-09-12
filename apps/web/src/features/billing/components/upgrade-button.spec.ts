import { describe, expect, it } from "vitest";

import { UPGRADE_CARD_TITLE_KEYS } from "../lib/upgrade-copy";

describe("upgrade card titles", () => {
	it("uses Pro for personal workspaces and Business for team workspaces", () => {
		expect(UPGRADE_CARD_TITLE_KEYS).toEqual({
			business: "workspace.upgradeCard.titleBusiness",
			pro: "workspace.upgradeCard.titlePro",
		});
	});
});
