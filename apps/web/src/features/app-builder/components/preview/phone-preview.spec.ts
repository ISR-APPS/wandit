// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppProject } from "../../api/dto";
import type { PhoneDevice } from "../../lib/constants";
import { PhonePreview, type PhonePreviewProps } from "./phone-preview";

const project: AppProject = {
	id: "nadi-fitness-mobile",
	name: "Nadi Fitness",
	slug: "nadi",
	description: "Membership app for a gym in Oran.",
	kind: "mobile",
	versionNumber: 4,
	unpublishedChanges: 3,
};

function renderPreview(device: PhoneDevice) {
	const props: PhonePreviewProps = { project, device, reloadKey: 0 };
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(PhonePreview, props),
	};
	render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("PhonePreview", () => {
	it("labels the iPhone and puts the app iframe inside the frame", () => {
		renderPreview("ios");
		expect(screen.getByText("iPhone 15 · iOS 17")).toBeTruthy();
		expect(screen.queryByText("Pixel 8 · Android 14")).toBeNull();
		expect(screen.getByTitle("Preview of Nadi Fitness")).toBeTruthy();
	});

	it("labels the Pixel on the android device", () => {
		renderPreview("android");
		expect(screen.getByText("Pixel 8 · Android 14")).toBeTruthy();
		expect(screen.queryByText("iPhone 15 · iOS 17")).toBeNull();
	});
});
