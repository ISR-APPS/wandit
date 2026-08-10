import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"leads.codPilotSync.sync": "Sync COD Pilot",
				"leads.codPilotSync.comingSoon": "COD Pilot sync — coming soon",
			})[key] ?? key,
	}),
}));

import { CodPilotSyncButton } from "./cod-pilot-sync-button";

describe("CodPilotSyncButton", () => {
	it("shows the COD Pilot label on a disabled control", () => {
		const html = renderToStaticMarkup(
			createElement(TooltipProvider, null, createElement(CodPilotSyncButton)),
		);

		expect(html).toContain("Sync COD Pilot");
		expect(html).toMatch(/<button[^>]*disabled=""/);
	});
});
