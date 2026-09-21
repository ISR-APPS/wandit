// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { PhoneDevice } from "../../lib/constants";
import { PhoneFrame, type PhoneFrameProps } from "./phone-frame";

afterEach(() => cleanup());

function renderFrame(device: PhoneDevice) {
	const props: PhoneFrameProps = {
		device,
		children: createElement("span", null, "app screen"),
	};
	return render(createElement(PhoneFrame, props));
}

describe("PhoneFrame", () => {
	it("draws the iOS status bar with the Apple clock", () => {
		renderFrame("ios");

		expect(screen.getByText("9:41")).toBeTruthy();
		expect(screen.queryByText("18:42")).toBeNull();
	});

	it("draws the Android status bar with the Google clock", () => {
		renderFrame("android");

		expect(screen.getByText("18:42")).toBeTruthy();
		expect(screen.queryByText("9:41")).toBeNull();
	});

	it("renders the children inside the frame", () => {
		const { container } = renderFrame("ios");

		const child = screen.getByText("app screen");
		expect(container.firstElementChild?.contains(child)).toBe(true);
	});
});
