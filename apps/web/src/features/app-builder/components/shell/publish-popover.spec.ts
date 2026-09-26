// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
	ListMobileBuildsResponse,
	MobileBuild,
	MobileBuildStatus,
} from "@wandit/contracts";
import { fallbackDictionary } from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";

// The router is a third-party module. The stub lets the mobile body call useNavigate outside a RouterProvider.
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

import { appBuilderKeys } from "../../api/app-builder.queries";
import type { AppProject, ProjectDomain } from "../../api/dto";
import { mobileBuildsKeys } from "../../api/mobile-builds.queries";
import { MOCK_APP_STORES, MOCK_DOMAINS } from "../../lib/mock-panels";
import type { AndroidBuildCardProps } from "./android-build-card";
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

const APK_URL = "https://expo.dev/artifacts/eas/abc123.apk";

/** One Android build of `status`. A finished build has an APK URL, a failed one an error code. */
function build(status: MobileBuildStatus): MobileBuild {
	return {
		id: crypto.randomUUID(),
		projectId: "project-1",
		platform: "android",
		kind: "apk",
		status,
		commitSha: "d".repeat(40),
		artifactUrl: status === "finished" ? APK_URL : null,
		errorCode: status === "failed" ? "plugin_not_allowed" : null,
		createdAt: "2026-09-26T10:00:00.000Z",
		completedAt: null,
	};
}

/** Card props with no build and no-op actions. A case overrides what it checks. */
function androidProps(
	overrides: Partial<AndroidBuildCardProps> = {},
): AndroidBuildCardProps {
	return {
		builds: [],
		isStarting: false,
		isCanceling: false,
		onBuild: () => {},
		onCancel: () => {},
		...overrides,
	};
}

const MOBILE_PROJECT: AppProject = {
	id: "project-1",
	name: "Nadi Fitness",
	slug: "",
	description: "Membership app for a gym.",
	kind: "mobile",
	engine: "v2_app",
	versionNumber: 0,
	unpublishedChanges: 0,
	hasCodeChanges: true,
};

/**
 * A cache with the iOS mock. The infinite stale time and `retryOnMount: false`
 * keep every seeded query from a fetch, a failed one too.
 */
function mobileClient(): QueryClient {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	queryClient.setQueryData(
		appBuilderKeys.appStores(MOBILE_PROJECT.id),
		MOCK_APP_STORES,
	);
	return queryClient;
}

/** Renders the popover of the mobile project with `builds` in the cache and opens it. */
function openMobilePopover(builds: MobileBuild[]) {
	const queryClient = mobileClient();
	queryClient.setQueryData(mobileBuildsKeys.list(MOBILE_PROJECT.id), {
		items: builds,
		nextCursor: null,
	} satisfies ListMobileBuildsResponse);
	renderOpenPopover(queryClient);
}

/** Renders the popover of the mobile project on `queryClient` and opens it. */
function renderOpenPopover(queryClient: QueryClient) {
	renderWithI18n(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(PublishPopover, { project: MOBILE_PROJECT }),
		),
	);
	fireEvent.click(screen.getByRole("button", { name: "Publish" }));
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
	it("shows the download link and the QR code of a finished build", async () => {
		openMobilePopover([build("finished")]);

		const link = await screen.findByRole("link", { name: "Download APK" });
		expect(link.getAttribute("href")).toBe(APK_URL);
		expect(screen.getByTitle("QR code of the APK download link")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Build APK · 50 credits" }),
		).toBeTruthy();
	});

	it("shows Cancel and no build button while a build runs", async () => {
		openMobilePopover([build("building")]);

		expect(await screen.findByRole("button", { name: "Cancel" })).toBeTruthy();
		expect(screen.getByText(/^Building · /)).toBeTruthy();
		expect(
			screen.getByText("The build continues when you close this panel."),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: /^Build APK/ })).toBeNull();
	});

	it("shows the text of the error code and Retry after a failed build", async () => {
		openMobilePopover([build("failed")]);

		expect(
			await screen.findByText(
				"Your app uses a native plugin that builds do not support yet.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Retry · 50 credits" }),
		).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Download APK" })).toBeNull();
	});

	it("shows the generic build error for a failed build without a code", async () => {
		openMobilePopover([{ ...build("failed"), errorCode: null }]);

		expect(
			await screen.findByText("An error occurred during the build. Try again."),
		).toBeTruthy();
	});

	it("shows the API error when the first read of the builds fails", async () => {
		const queryClient = mobileClient();
		await queryClient.prefetchQuery({
			queryKey: mobileBuildsKeys.list(MOBILE_PROJECT.id),
			queryFn: async () => {
				throw new ApiClientError(
					{
						code: "WORKSPACE_PERMISSION_DENIED",
						message: "Forbidden.",
						path: `/api/v2/projects/${MOBILE_PROJECT.id}/mobile-builds`,
						requestId: "req-1",
						statusCode: 403,
						timestamp: "2026-09-26T10:00:00.000Z",
					},
					{ hasServerEnvelopeMessage: true },
				);
			},
		});
		renderOpenPopover(queryClient);

		expect(
			await screen.findByText(
				"Your workspace role does not allow this action.",
			),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: /^Build APK/ })).toBeNull();
	});
});

describe("PublishMobileTargets", () => {
	it("offers Build APK before the first build, Submit for a ready iOS build, and Show QR", () => {
		const onBuild = vi.fn();
		const onSubmit = vi.fn();
		const onShowQr = vi.fn();
		renderWithI18n(
			createElement(PublishMobileTargets, {
				ios: MOCK_APP_STORES.ios,
				onSubmit,
				onSetUp: () => {},
				onShowQr,
				android: androidProps({ onBuild }),
			}),
		);
		expect(
			screen.getByText("Install your app on an Android phone"),
		).toBeTruthy();
		expect(
			screen.getByText("Build 12 ready · TestFlight 9 testers"),
		).toBeTruthy();
		expect(screen.getByText("Backend deploys with every publish")).toBeTruthy();

		fireEvent.click(
			screen.getByRole("button", { name: "Build APK · 50 credits" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "Submit" }));
		fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
		expect(onBuild).toHaveBeenCalledOnce();
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(onShowQr).toHaveBeenCalledOnce();
	});

	it("offers Set up when iOS is not set up", () => {
		const onSetUp = vi.fn();
		renderWithI18n(
			createElement(PublishMobileTargets, {
				ios: { ...MOCK_APP_STORES.ios, status: "notSetUp" },
				onSubmit: () => {},
				onSetUp,
				onShowQr: () => {},
				android: androidProps(),
			}),
		);
		expect(screen.getByText("Not set up")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Set up" }));
		expect(onSetUp).toHaveBeenCalledOnce();
	});

	it("cancels the live build by its id", () => {
		const live = build("queued");
		const onCancel = vi.fn();
		renderWithI18n(
			createElement(PublishMobileTargets, {
				ios: MOCK_APP_STORES.ios,
				onSubmit: () => {},
				onSetUp: () => {},
				onShowQr: () => {},
				android: androidProps({ builds: [live], onCancel }),
			}),
		);
		expect(screen.getByText(/^Waiting to start · /)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledWith(live.id);
	});

	it("lists the older builds with a download link for a finished one", () => {
		renderWithI18n(
			createElement(PublishMobileTargets, {
				ios: MOCK_APP_STORES.ios,
				onSubmit: () => {},
				onSetUp: () => {},
				onShowQr: () => {},
				android: androidProps({
					builds: [build("canceled"), build("finished"), build("failed")],
				}),
			}),
		);
		expect(screen.getByText("Earlier builds")).toBeTruthy();
		expect(screen.getByText(/^Canceled · /)).toBeTruthy();
		expect(screen.getByText(/^Ready · /)).toBeTruthy();
		expect(screen.getByText(/^Failed · /)).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "Download APK" }).getAttribute("href"),
		).toBe(APK_URL);
		// The latest build is canceled, so the card offers a new build and no QR code.
		expect(
			screen.getByRole("button", { name: "Build APK · 50 credits" }),
		).toBeTruthy();
		expect(screen.queryByTitle("QR code of the APK download link")).toBeNull();
	});

	it("shows at most five older builds after a create adds one to the list", () => {
		renderWithI18n(
			createElement(PublishMobileTargets, {
				ios: MOCK_APP_STORES.ios,
				onSubmit: () => {},
				onSetUp: () => {},
				onShowQr: () => {},
				android: androidProps({
					builds: [
						build("queued"),
						...Array.from({ length: 6 }, () => build("failed")),
					],
				}),
			}),
		);
		expect(screen.getAllByText(/^Failed · /)).toHaveLength(5);
	});
});
