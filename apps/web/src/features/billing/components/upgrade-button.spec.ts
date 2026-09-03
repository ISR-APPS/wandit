import { describe, expect, it } from "vitest";

import { UPGRADE_CARD_TITLE_KEYS } from "../lib/upgrade-copy";

describe("upgrade card titles", () => {
	it("keeps the Starter plan name in the personal-workspace title", () => {
		expect(UPGRADE_CARD_TITLE_KEYS).toEqual({
			business: "workspace.upgradeCard.titleBusiness",
			pro: "workspace.upgradeCard.titlePro",
			starter: "workspace.upgradeCard.titleStarter",
		});
	});
});
