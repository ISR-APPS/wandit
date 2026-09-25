// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary } from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
	AppProject,
	AppStoresSummary,
	ProjectDomain,
} from "../../api/dto";
import { MOCK_APP_STORES, MOCK_DOMAINS } from "../../lib/mock-panels";
import {
	PublishMobileTargets,
	PublishPopover,
	PublishWebTargets,
} from "./publish-popover";

function renderWithI18n(children: ReactNode) {
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children,
	};
	return render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("PublishWebTargets", () => {
	it("shows Live and Update when the Wandit domain is live", () => {
		const onUpdate = vi.fn();
		renderWithI18n(
			createElement(PublishWebTargets, {
				domains: MOCK_DOMAINS,
				onUpdate,
				onConnectDomain: () => {},
			}),
		);
		expect(screen.getByText("Live")).toBeTruthy();
		expect(screen.getByText("nadi.wandit.app")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Update" }));
		expect(onUpdate).toHaveBeenCalledOnce();
	});

	it("shows Not published yet and Publish without a Wandit domain", () => {
		renderWithI18n(
			createElement(PublishWebTargets, {
				domains: [],
				onUpdate: () => {},
				onConnectDomain: () => {},
			}),
		);
		expect(screen.getByText("Not published yet")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
		expect(screen.queryByText("Live")).toBeNull();
	});

	it("shows the host and Publish while the Wandit domain verifies", () => {
		const verifying: ProjectDomain[] = [
			{
				host: "nadi.wandit.app",
				kind: "wandit",
				status: "verifying",
				cnameTarget: null,
			},
		];
		renderWithI18n(
			createElement(PublishWebTargets, {
				domains: verifying,
				onUpdate: () => {},
				onConnectDomain: () => {},
			}),
		);
		expect(screen.getByText("nadi.wandit.app")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
		expect(screen.queryByText("Live")).toBeNull();
	});

	it("calls onConnectDomain from the Connect one link", () => {
		const onConnectDomain = vi.fn();
		renderWithI18n(
			createElement(PublishWebTargets, {
				domains: MOCK_DOMAINS,
				onUpdate: () => {},
				onConnectDomain,
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Connect one" }));
		expect(onConnectDomain).toHaveBeenCalledOnce();
	});
});

describe("PublishPopover", () => {
	it("shows the coming soon line for a mobile project", async () => {
		const project: AppProject = {
			id: "project-1",
			name: "Nadi Fitness",
			slug: "",
			description: "Membership app for a gym.",
			kind: "mobile",
			engine: "v2_app",
			versionNumber: 0,
			unpublishedChanges: 0,
		};
		renderWithI18n(createElement(PublishPopover, { project }));

		fireEvent.click(screen.getByRole("button", { name: "Publish" }));

		expect(
			await screen.findByText(
				"Publishing a mobile app is coming soon. Test your app in the preview for now.",
			),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
	});
});

describe("PublishMobileTargets", () => {
	it("offers Submit for a ready iOS build and Set up for Android", () => {
		const onSubmit = vi.fn();
		const onSetUp = vi.fn();
		const onShowQr = vi.fn();
		renderWithI18n(
			createElement(PublishMobileTargets, {
				stores: MOCK_APP_STORES,
				onSubmit,
				onSetUp,
				onShowQr,
			}),
		);
		expect(
			screen.getByText("Build 12 ready · TestFlight 9 testers"),
		).toBeTruthy();
		expect(screen.getByText("Not set up")).toBeTruthy();
		expect(screen.getByText("Backend deploys with every publish")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Submit" }));
		fireEvent.click(screen.getByRole("button", { name: "Set up" }));
		fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(onSetUp).toHaveBeenCalledOnce();
		expect(onShowQr).toHaveBeenCalledOnce();
	});

	it("offers Submit on both rows when Android is ready too", () => {
		const stores: AppStoresSummary = {
			...MOCK_APP_STORES,
			android: { status: "readyToSubmit" },
		};
		renderWithI18n(
			createElement(PublishMobileTargets, {
				stores,
				onSubmit: () => {},
				onSetUp: () => {},
				onShowQr: () => {},
			}),
		);
		expect(screen.getAllByRole("button", { name: "Submit" })).toHaveLength(2);
		expect(screen.getByText("Ready to submit")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
	});
});
