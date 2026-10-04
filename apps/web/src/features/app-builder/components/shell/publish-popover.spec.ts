// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
	AppBuild,
	AppDeployment,
	AppPublishStatus,
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

import type { AppProject } from "../../api/dto";
import { mobileBuildsKeys } from "../../api/mobile-builds.queries";
import { appPublishKeys } from "../../api/publish.queries";
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
	kind: "mobile",
	languages: ["en"],
	templateVersion: "1.0.0",
	engine: "v2_app",
	versionNumber: 0,
	unpublishedChanges: 0,
	hasCodeChanges: true,
};

const WEB_PROJECT: AppProject = {
	...MOBILE_PROJECT,
	id: "project-2",
	name: "Booking App",
	kind: "web",
	versionNumber: 5,
	unpublishedChanges: 2,
};

/**
 * An empty cache. The infinite stale time and `retryOnMount: false` keep
 * every seeded query from a fetch, a failed one too.
 */
function mobileClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
}

const LIVE_URL = "https://booking-app.wandit.app";

/** One publish attempt of `status`. A failed one has an error code. */
function appBuild(status: AppBuild["status"]): AppBuild {
	return {
		id: crypto.randomUUID(),
		projectId: WEB_PROJECT.id,
		status,
		commitSha: "e".repeat(40),
		sourceBuildId: null,
		errorCode: status === "failed" ? "build_failed" : null,
		createdAt: "2026-10-01T10:00:00.000Z",
		completedAt: null,
	};
}

/** One app deployment of `status` on the commit `sha`. */
function deployment(
	status: AppDeployment["status"],
	sha: string,
): AppDeployment {
	return {
		id: crypto.randomUUID(),
		status,
		slug: "booking-app",
		commitSha: sha,
		buildId: crypto.randomUUID(),
		createdAt: "2026-09-30T10:00:00.000Z",
	};
}

/** The status of an app that is live on `LIVE_URL`, with `overrides` on top. */
function liveStatus(
	overrides: Partial<AppPublishStatus> = {},
): AppPublishStatus {
	return {
		live: {
			deploymentId: crypto.randomUUID(),
			url: LIVE_URL,
			slug: "booking-app",
			commitSha: "e".repeat(40),
			publishedAt: "2026-10-01T10:00:00.000Z",
		},
		latestBuild: appBuild("published"),
		history: [],
		...overrides,
	};
}

/** Web target props with the status of a live app and no-op actions. A case overrides what it checks. */
function webProps(
	overrides: Partial<ComponentProps<typeof PublishWebTargets>> = {},
): ComponentProps<typeof PublishWebTargets> {
	return {
		status: liveStatus(),
		isSending: false,
		onPublish: () => {},
		onRollback: () => {},
		onUnpublish: () => {},
		onConnectDomain: () => {},
		...overrides,
	};
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

/** Renders the popover of `project` on `queryClient` and opens it. */
function renderOpenPopover(
	queryClient: QueryClient,
	project: AppProject = MOBILE_PROJECT,
) {
	renderWithI18n(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(PublishPopover, { project }),
		),
	);
	fireEvent.click(screen.getByRole("button", { name: "Publish" }));
}

afterEach(cleanup);

describe("PublishWebTargets", () => {
	it("shows Live, the host, Update, the live link, and Unpublish for a live app", () => {
		const onPublish = vi.fn();
		const onUnpublish = vi.fn();
		renderWithI18n(
			createElement(PublishWebTargets, webProps({ onPublish, onUnpublish })),
		);
		expect(screen.getByText("Live")).toBeTruthy();
		expect(screen.getByText("booking-app.wandit.app")).toBeTruthy();
		expect(
			screen
				.getByRole("link", { name: "Open the live app" })
				.getAttribute("href"),
		).toBe(LIVE_URL);

		fireEvent.click(screen.getByRole("button", { name: "Update" }));
		fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
		expect(onPublish).toHaveBeenCalledOnce();
		expect(onUnpublish).toHaveBeenCalledOnce();
	});

	it("shows Not published yet and Publish before the first publish", () => {
		renderWithI18n(
			createElement(
				PublishWebTargets,
				webProps({
					status: { live: null, latestBuild: null, history: [] },
				}),
			),
		);
		expect(screen.getByText("Not published yet")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
		expect(screen.queryByText("Live")).toBeNull();
		expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
	});

	it("shows the running step and disables every action while a publish runs", () => {
		renderWithI18n(
			createElement(
				PublishWebTargets,
				webProps({
					status: liveStatus({
						latestBuild: appBuild("building"),
						history: [deployment("superseded", "c".repeat(40))],
					}),
				}),
			),
		);
		expect(screen.getByText("Building your app")).toBeTruthy();
		expect(
			screen.getByText("The publish continues when you close this panel."),
		).toBeTruthy();
		expect(screen.queryByText("Live")).toBeNull();
		for (const name of ["Update", "Unpublish", "Roll back"]) {
			expect(
				screen.getByRole("button", { name }).hasAttribute("disabled"),
			).toBe(true);
		}
	});

	it("shows the text of the error code of a failed or blocked publish", () => {
		renderWithI18n(
			createElement(
				PublishWebTargets,
				webProps({
					status: { live: null, latestBuild: appBuild("failed"), history: [] },
				}),
			),
		);
		expect(
			screen.getByText(
				"The build of your app failed. Ask Wandit in the chat to fix it, then publish again.",
			),
		).toBeTruthy();
		cleanup();

		renderWithI18n(
			createElement(
				PublishWebTargets,
				webProps({
					status: {
						live: null,
						latestBuild: { ...appBuild("blocked"), errorCode: "gate_blocked" },
						history: [],
					},
				}),
			),
		);
		expect(
			screen.getByText(
				"The safety check stopped this publish. Ask Wandit in the chat to fix the problems.",
			),
		).toBeTruthy();
	});

	it("lists only the versions that were live once and rolls one back by its id", () => {
		const replaced = deployment("superseded", "c".repeat(40));
		const onRollback = vi.fn();
		renderWithI18n(
			createElement(
				PublishWebTargets,
				webProps({
					onRollback,
					status: liveStatus({
						history: [
							deployment("active", "e".repeat(40)),
							deployment("failed", "f".repeat(40)),
							replaced,
							deployment("unpublished", "d".repeat(40)),
						],
					}),
				}),
			),
		);
		expect(screen.getByText("Earlier versions")).toBeTruthy();
		expect(screen.getByText("ccccccc")).toBeTruthy();
		expect(screen.getByText("ddddddd")).toBeTruthy();
		expect(screen.queryByText("fffffff")).toBeNull();
		expect(screen.queryByText("eeeeeee")).toBeNull();

		fireEvent.click(screen.getAllByRole("button", { name: "Roll back" })[0]);
		expect(onRollback).toHaveBeenCalledWith(replaced.id);
	});

	it("calls onConnectDomain from the Connect one link", () => {
		const onConnectDomain = vi.fn();
		renderWithI18n(
			createElement(PublishWebTargets, webProps({ onConnectDomain })),
		);
		fireEvent.click(screen.getByRole("button", { name: "Connect one" }));
		expect(onConnectDomain).toHaveBeenCalledOnce();
	});
});

describe("PublishPopover", () => {
	it("reads the publish status of a web project and its version counts", async () => {
		const queryClient = mobileClient();
		queryClient.setQueryData(
			appPublishKeys.status(WEB_PROJECT.id),
			liveStatus(),
		);
		renderOpenPopover(queryClient, WEB_PROJECT);

		expect(await screen.findByText("booking-app.wandit.app")).toBeTruthy();
		expect(screen.getByText("v5 · 2 changes")).toBeTruthy();
	});

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
	it("offers Build APK before the first build and Show QR, with no iOS row", () => {
		const onBuild = vi.fn();
		const onToggleQr = vi.fn();
		renderWithI18n(
			createElement(PublishMobileTargets, {
				isQrOpen: false,
				onToggleQr,
				qrPanel: null,
				android: androidProps({ onBuild }),
			}),
		);
		expect(
			screen.getByText("Install your app on an Android phone"),
		).toBeTruthy();
		expect(screen.getByText("Backend deploys with every publish")).toBeTruthy();
		// WANDIT-194 follow-up: the mock iOS row with TestFlight testers is gone.
		expect(screen.queryByText(/App Store|TestFlight/)).toBeNull();

		fireEvent.click(
			screen.getByRole("button", { name: "Build APK · 50 credits" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
		expect(onBuild).toHaveBeenCalledOnce();
		expect(onToggleQr).toHaveBeenCalledOnce();
	});

	it("cancels the live build by its id", () => {
		const live = build("queued");
		const onCancel = vi.fn();
		renderWithI18n(
			createElement(PublishMobileTargets, {
				isQrOpen: false,
				onToggleQr: () => {},
				qrPanel: null,
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
				isQrOpen: false,
				onToggleQr: () => {},
				qrPanel: null,
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
				isQrOpen: false,
				onToggleQr: () => {},
				qrPanel: null,
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
