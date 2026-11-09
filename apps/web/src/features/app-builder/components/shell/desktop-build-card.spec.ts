// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { DesktopBuild } from "@wandit/contracts";
import { fallbackDictionary } from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DesktopBuildCard,
	type DesktopBuildCardProps,
	isOlderThanCurrentBuild,
} from "./desktop-build-card";

const PROJECT_ID = crypto.randomUUID();
const EARLIER = "2026-10-01T10:00:00.000Z";
const LATER = "2026-10-02T10:00:00.000Z";

/** One ready build that is not current. A case overrides what it checks. */
function readyBuild(overrides: Partial<DesktopBuild>): DesktopBuild {
	return {
		id: crypto.randomUUID(),
		projectId: PROJECT_ID,
		status: "ready",
		platform: "windows",
		version: "1.0.1",
		commitSha: "c".repeat(40),
		notes: null,
		installerUrl: "https://cdn.example.com/desktop/app-1.0.1-setup.exe",
		installerBytes: 4_000_000,
		errorCode: null,
		findings: [],
		isCurrent: false,
		createdAt: EARLIER,
		completedAt: EARLIER,
		releasedAt: null,
		...overrides,
	};
}

describe("isOlderThanCurrentBuild", () => {
	const earlier = readyBuild({ createdAt: EARLIER });
	const later = readyBuild({ createdAt: LATER });

	it.each([
		{
			name: "a first release, with no current build",
			build: earlier,
			builds: [later, earlier],
			expected: false,
		},
		{
			name: "a build newer than the current one",
			build: later,
			builds: [later, { ...earlier, isCurrent: true }],
			expected: false,
		},
		{
			name: "a build older than the current one",
			build: earlier,
			builds: [{ ...later, isCurrent: true }, earlier],
			expected: true,
		},
		{
			// Each platform has its own current build, so a newer macOS release must not block a Windows build.
			name: "a build older than the current build of the other platform",
			build: earlier,
			builds: [
				{ ...later, platform: "macos" as const, isCurrent: true },
				earlier,
			],
			expected: false,
		},
	])("answers $expected for $name", ({ build, builds, expected }) => {
		expect(isOlderThanCurrentBuild(build, builds)).toBe(expected);
	});
});

describe("DesktopBuildCard", () => {
	afterEach(cleanup);

	// Installed apps accept only a newer version, so an older build must ship as a new build.
	it("rebuilds an older build after the Rebuild confirm and never releases it", () => {
		const onRelease = vi.fn<(buildId: string) => void>();
		const onBuild = vi.fn<DesktopBuildCardProps["onBuild"]>();
		const current = readyBuild({
			version: "1.0.2",
			isCurrent: true,
			createdAt: LATER,
		});
		const older = readyBuild({ version: "1.0.1", createdAt: EARLIER });
		const props: DesktopBuildCardProps = {
			app: {
				identifier: "app.wandit.p1",
				productName: "Ledgerly",
				releases: {
					windows: {
						updatesUrl: "https://cdn.example.com/desktop/p1/latest.json",
						downloadUrl:
							"https://cdn.example.com/desktop/p1/ledgerly-setup.exe",
						currentBuildId: current.id,
					},
					macos: {
						updatesUrl: "https://cdn.example.com/desktop/p1/latest-macos.json",
						downloadUrl: null,
						currentBuildId: null,
					},
				},
			},
			builds: [current, older],
			projectName: "Ledgerly",
			suspension: null,
			buildablePlatforms: ["windows"],
			isStarting: false,
			isCanceling: false,
			isReleasing: false,
			onBuild,
			onCancel: () => {},
			onRelease,
		};
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(
				TooltipProvider,
				null,
				createElement(DesktopBuildCard, props),
			),
		};
		render(createElement(I18nProvider, providerProps));

		expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Rebuild" }));
		expect(onBuild).not.toHaveBeenCalled();
		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).getByText(/costs 25 credits/)).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "Rebuild" }));
		expect(onBuild).toHaveBeenCalledExactlyOnceWith({
			platform: "windows",
			rebuildOfBuildId: older.id,
		});
		expect(onRelease).not.toHaveBeenCalled();
	});
});
