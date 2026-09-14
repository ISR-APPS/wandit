// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary } from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppVersion } from "../../api/dto";
import { MOCK_APP_VERSIONS } from "../../lib/mock-projects";
import { VersionsList } from "./versions-popover";

function renderList(versions: AppVersion[]) {
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(VersionsList, { versions }),
	};
	return render(createElement(I18nProvider, providerProps));
}

/** The `<li>` that holds the version label, for example "v3". */
function rowOf(label: string): HTMLElement {
	const row = screen.getByText(label).closest("li");
	if (!row) throw new Error(`No row for ${label}`);
	return row;
}

afterEach(cleanup);

describe("VersionsList", () => {
	it("marks the live version Live and the newest version Current", () => {
		renderList(MOCK_APP_VERSIONS);
		expect(rowOf("v3").textContent).toContain("Live");
		expect(rowOf("v3").textContent).not.toContain("Restore");
		expect(rowOf("v4").textContent).toContain("Current");
		expect(rowOf("v4").textContent).not.toContain("Restore");
		// v2 and v1 are neither live nor current.
		expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
	});

	it("shows Live and Current on the same row when the newest version is live", () => {
		const versions = MOCK_APP_VERSIONS.map((version) => ({
			...version,
			isLive: version.number === 4,
		}));
		renderList(versions);
		expect(rowOf("v4").textContent).toContain("Live");
		expect(rowOf("v4").textContent).toContain("Current");
		expect(rowOf("v3").textContent).toContain("Restore");
	});
});
