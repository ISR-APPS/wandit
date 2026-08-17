import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"leads.sheetSync.connect": "Connect Google Sheets",
				"leads.sheetSync.comingSoon": "Google Sheets sync — coming soon",
				"leads.sheetSync.syncNow": "Sync now",
			})[key] ?? key,
	}),
}));

// The flag is mocked, not read from the real constants: the day it is flipped
// on, these cases must keep describing the placeholder shape instead of
// failing for a reason that has nothing to do with this component.
vi.mock("../../lib/constants", () => ({ SHEET_SYNC_ENABLED: false }));

// The live flow's collaborators are stubbed so the spec never needs a
// QueryClient — and so the query spy proves the placeholder stays offline.
const useSheetSyncQuery = vi.fn();

vi.mock("../../api/lead-sheet-sync.queries", () => ({
	useSheetSyncQuery: (projectId: string) => useSheetSyncQuery(projectId),
}));
vi.mock("../../api/lead-sheet-sync.mutations", () => ({
	useSyncSheetNow: () => ({ isPending: false, error: null, mutate: vi.fn() }),
}));
vi.mock("../../lib/store", () => ({
	useWorkspace: () => ({ projectId: "project-1" }),
}));
vi.mock("@/features/auth", () => ({
	authClient: { linkSocial: vi.fn() },
}));

import { SheetSyncButton } from "./sheet-sync-button";

const renderButton = (Component: () => ReactNode) =>
	renderToStaticMarkup(
		createElement(TooltipProvider, null, createElement(Component)),
	);

describe("SheetSyncButton", () => {
	it("shows the connect label on a disabled control while the flag is off", () => {
		const html = renderButton(SheetSyncButton);

		expect(html).toContain("Connect Google Sheets");
		expect(html).toMatch(/<button[^>]*disabled=""/);
	});

	it("does not reach the sheet-sync endpoint while the flag is off", () => {
		renderButton(SheetSyncButton);

		expect(useSheetSyncQuery).not.toHaveBeenCalled();
	});

	// Runs last: it swaps the flag module, so the placeholder cases above must
	// already have used the off build.
	it("mounts the live control and asks for the project's sync state while the flag is on", async () => {
		vi.resetModules();
		vi.doMock("../../lib/constants", () => ({ SHEET_SYNC_ENABLED: true }));
		useSheetSyncQuery.mockClear();
		useSheetSyncQuery.mockReturnValue({ isPending: true, data: undefined });

		const live = await import("./sheet-sync-button");
		const html = renderButton(live.SheetSyncButton);

		expect(useSheetSyncQuery).toHaveBeenCalledWith("project-1");
		expect(html).toContain("Sync now");
	});
});
