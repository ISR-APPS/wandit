// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MediaGenerationAttempt } from "@wandit/contracts";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { ExtendVideoPart } from "./generate-video-part";
import { MessageParts } from "./message-parts";

const state = vi.hoisted(() => ({
	attempt: undefined as MediaGenerationAttempt | undefined,
	progress: undefined as unknown,
	prefillComposer: vi.fn(),
	setTab: vi.fn(),
}));

vi.mock("@/features/credits", () => ({
	creditsKeys: { balance: () => ["credits", "balance"] },
}));

vi.mock("../../../lib/ai-chat-context", () => ({
	useSharedAiChat: () => ({ prefillComposer: state.prefillComposer }),
}));

vi.mock("@/lib/i18n", () => {
	const messages: Record<string, string> = {
		"errors.ai.provider_error":
			"{provider} returned an error. Please try again.",
		"workspace.chat.aiError.attribution.viaGateway":
			"{provider} via Vercel AI Gateway",
		"workspace.chat.aiError.kicker.provider": "Provider issue",
		"workspace.chat.aiError.providerFallback": "The AI provider",
		"workspace.chat.aiError.tryAgainPrefill.hint":
			"This starts a new generation.",
		"workspace.chat.aiError.tryAgainPrefill.video": "Try the video again",
		"workspace.chat.videoAttempt.download": "Download",
		"workspace.chat.videoAttempt.edit.active":
			"Editing the {seconds}-second video…",
		"workspace.chat.videoAttempt.edit.complete": "Edit complete",
		"workspace.chat.videoAttempt.edit.done":
			"Edited the {seconds}-second video",
		"workspace.chat.videoAttempt.edit.failedBody":
			"The edit stopped before the video was ready.",
		"workspace.chat.videoAttempt.edit.failedTitle": "Video edit failed",
		"workspace.chat.videoAttempt.edit.failedToStart":
			"Video edit failed to start",
		"workspace.chat.videoAttempt.edit.prepared": "Edit instructions ready",
		"workspace.chat.videoAttempt.edit.preparing": "Preparing the video edit…",
		"workspace.chat.videoAttempt.edit.publishing":
			"Publishing the edited video…",
		"workspace.chat.videoAttempt.edit.queueing": "Queueing the edit…",
		"workspace.chat.videoAttempt.edit.ready": "Edited video ready.",
		"workspace.chat.videoAttempt.extractingFrame":
			"Preparing piece {current} of {total}…",
		"workspace.chat.videoAttempt.extractingFrameFallback":
			"Preparing the next piece…",
		"workspace.chat.videoAttempt.extend.active":
			"Extending the video to {seconds} seconds…",
		"workspace.chat.videoAttempt.extend.complete": "Extension complete",
		"workspace.chat.videoAttempt.extend.done":
			"Extended the video to {seconds} seconds",
		"workspace.chat.videoAttempt.extend.failedBody":
			"The extension stopped before the longer video was ready.",
		"workspace.chat.videoAttempt.extend.failedTitle": "Video extension failed",
		"workspace.chat.videoAttempt.extend.failedToStart":
			"Video extension failed to start",
		"workspace.chat.videoAttempt.extend.prepared": "Continuation planned",
		"workspace.chat.videoAttempt.extend.preparing":
			"Preparing the continuation…",
		"workspace.chat.videoAttempt.extend.publishing":
			"Publishing the longer video…",
		"workspace.chat.videoAttempt.extend.queueing": "Queueing the extension…",
		"workspace.chat.videoAttempt.extend.ready": "Extended video ready.",
		"workspace.chat.videoAttempt.inQueue": "In queue",
		"workspace.chat.videoAttempt.joining": "Joining the pieces…",
		"workspace.chat.videoAttempt.narration": "Laying the narration…",
		"workspace.chat.videoAttempt.narrationFailed":
			"The video is ready, but narration could not be added. The clip is silent.",
		"workspace.chat.videoAttempt.play": "Play {title}",
		"workspace.chat.videoAttempt.publish": "Publish",
		"workspace.chat.videoAttempt.published": "Published",
		"workspace.chat.videoAttempt.renderingPiece":
			"Rendering piece {current} of {total}…",
		"workspace.chat.videoAttempt.renderingPieceFallback":
			"Rendering the next piece…",
		"workspace.chat.videoAttempt.statusLoadError":
			"Couldn't load the video status — reopen this chat to retry.",
		"workspace.chat.videoAttempt.viewAssets": "View in Assets",
	};
	const t = (key: string, params?: Record<string, unknown>) => {
		const value = messages[key];
		if (typeof value !== "string") return key;
		return value.replace(/\{(\w+)\}/g, (_, name: string) =>
			String(params?.[name] ?? `{${name}}`),
		);
	};

	return {
		useTranslation: () => ({ dir: "ltr", locale: "en", t }),
	};
});

// The app-level i18n facade is mocked above. Mock its workspace-package
// re-export too so Vite never traverses the package peer boundary in jsdom.
vi.mock("@wandit/internationalization/react", () => ({}));

vi.mock("../../../api/media-generations.queries", () => ({
	mediaGenerationKeys: {
		attempt: (attemptId: string) => ["media-generations", "attempt", attemptId],
	},
	useMediaGenerationAttemptQuery: () => ({
		data: state.attempt,
		error: null,
	}),
}));

vi.mock("../../../lib/store", () => ({
	useWorkspace: () => ({ setTab: state.setTab }),
}));

vi.mock("../../../lib/use-live-run", () => ({
	useLiveRun: () => ({
		failed: false,
		metadata:
			state.progress === undefined ? undefined : { progress: state.progress },
		settled: false,
		status: undefined,
	}),
}));

vi.mock("motion/react", async () => {
	const { createElement } = await import("react");
	return {
		motion: {
			span: ({
				animate: _animate,
				transition: _transition,
				...props
			}: Record<string, unknown>) => createElement("span", props),
		},
	};
});

vi.mock("./chat-media", () => ({
	ChatMediaLightbox: () => null,
}));

type ExtendVideoToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-extend_video" }
>;

type EditVideoToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-edit_video" }
>;

function extensionAttempt(
	overrides: Partial<MediaGenerationAttempt> = {},
): MediaGenerationAttempt {
	return {
		aspect: "16:9",
		completedAt: null,
		createdAt: "2026-08-21T12:00:00.000Z",
		durationSeconds: 25,
		error: null,
		id: "11111111-1111-4111-8111-111111111111",
		kind: "video-extension",
		motion: null,
		prompt: "Continue the orbit into a close-up.",
		sourceImageUrl: null,
		sourceMediaType: null,
		status: "queued",
		title: "Extended orbit",
		videoMediaType: null,
		videoUrl: null,
		voiceover: null,
		...overrides,
	};
}

function extensionPart(): ExtendVideoToolPart {
	return {
		input: {
			acceptSilent: false,
			continuationBrief: "Continue the orbit into a close-up.",
			legCount: 2,
			legDurationSeconds: 10,
			sourceAttemptId: "22222222-2222-4222-8222-222222222222",
			title: "Extended orbit",
		},
		output: {
			attemptId: "11111111-1111-4111-8111-111111111111",
			message: "Extension queued.",
			status: "queued",
		},
		state: "output-available",
		toolCallId: "extend-video-1",
		type: "tool-extend_video",
	};
}

function editPart(): EditVideoToolPart {
	return {
		input: {
			instruction: "Keep the framing and make the bottle blue.",
			sourceAttemptId: "22222222-2222-4222-8222-222222222222",
			title: "Blue bottle edit",
		},
		output: {
			attemptId: "11111111-1111-4111-8111-111111111111",
			message: "Edit queued.",
			status: "queued",
		},
		state: "output-available",
		toolCallId: "edit-video-1",
		type: "tool-edit_video",
	};
}

function renderExtension() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(ExtendVideoPart, { part: extensionPart() }),
		),
	);
}

function renderVideoMessage(part: EditVideoToolPart | ExtendVideoToolPart) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(MessageParts, {
				isLastAssistantMessage: true,
				isStreaming: false,
				message: {
					id: "video-message-1",
					parts: [part],
					role: "assistant",
				} as WanditUIMessage,
				onToolApprovalResponse: () => {},
			}),
		),
	);
}

beforeEach(() => {
	state.attempt = undefined;
	state.progress = undefined;
	state.prefillComposer.mockReset();
	state.setTab.mockReset();
});

afterEach(() => cleanup());

describe("video attempt message registration", () => {
	it.each([
		{
			activeCopy: "Editing the 25-second video…",
			kind: "video-edit" as const,
			part: editPart,
			title: "Blue bottle edit",
		},
		{
			activeCopy: "Extending the video to 25 seconds…",
			kind: "video-extension" as const,
			part: extensionPart,
			title: "Extended orbit",
		},
	])("renders an output-available $kind message as a card", (testCase) => {
		state.attempt = extensionAttempt({
			kind: testCase.kind,
			title: testCase.title,
		});

		const { container } = renderVideoMessage(testCase.part());

		expect(screen.getByText(testCase.activeCopy).textContent).toBe(
			testCase.activeCopy,
		);
		expect(container.querySelector(".aspect-video")).not.toBeNull();
		expect(screen.getByText("Wandit").textContent).toBe("Wandit");
	});
});

describe("ExtendVideoPart", () => {
	it("prefills the original continuation brief after a durable retryable failure", () => {
		state.attempt = extensionAttempt({
			failure: {
				kind: "provider_error",
				source: "gateway",
				providerLabel: "Kling",
				retryable: true,
				terminal: true,
				refunded: null,
				moderationStage: null,
				providerMessage: null,
				requestId: null,
			},
			prompt: "PROVIDER-REWRITTEN PROMPT",
			status: "failed",
		});

		renderExtension();
		fireEvent.click(
			screen.getByRole("button", { name: "Try the video again" }),
		);

		expect(state.prefillComposer).toHaveBeenCalledWith(
			"Continue the orbit into a close-up.",
		);
	});

	it("shows the queued extension state", () => {
		state.attempt = extensionAttempt();

		renderExtension();

		expect(screen.getByText("Continuation planned").textContent).toBe(
			"Continuation planned",
		);
		expect(screen.getByText("In queue").textContent).toBe("In queue");
		expect(
			screen.getByText("Extending the video to 25 seconds…").textContent,
		).toBe("Extending the video to 25 seconds…");
	});

	it("shows joining copy and the server-authored percent", () => {
		state.progress = {
			durationSeconds: 25,
			headline: "Joining the source and continuation pieces…",
			percent: 82,
			// Stage must remain enough to show live progress before polling returns
			// the attempt or when an older producer omits a matching phase.
			phase: "starting",
			stage: "joining",
		};

		renderExtension();

		expect(screen.getByText("Joining the pieces…").textContent).toBe(
			"Joining the pieces…",
		);
		expect(screen.getByText("82%").textContent).toBe("82%");
	});

	it("localizes the piece indexes from a rendering-leg headline", () => {
		state.attempt = extensionAttempt({ status: "generating" });
		state.progress = {
			durationSeconds: 25,
			headline: "Rendering continuation piece 2 of 3…",
			percent: 48,
			phase: "rendering",
			stage: "rendering-leg",
		};

		renderExtension();

		expect(screen.getByText("Rendering piece 2 of 3…").textContent).toBe(
			"Rendering piece 2 of 3…",
		);
		expect(
			screen.queryByText("Rendering continuation piece 2 of 3…"),
		).toBeNull();
		expect(screen.getByText("48%").textContent).toBe("48%");
	});

	it("shows localized narration copy", () => {
		state.attempt = extensionAttempt({ status: "generating" });
		state.progress = {
			durationSeconds: 25,
			headline: "Laying the narration over the full video…",
			percent: 88,
			phase: "rendering",
			stage: "soundtrack",
		};

		renderExtension();

		expect(screen.getByText("Laying the narration…").textContent).toBe(
			"Laying the narration…",
		);
		expect(screen.getByText("88%").textContent).toBe("88%");
	});

	it("lets the publishing stage drive visual and live status copy", () => {
		state.attempt = extensionAttempt({ status: "generating" });
		state.progress = {
			durationSeconds: 25,
			headline: "Publishing the longer video…",
			percent: 95,
			// Exercise field-level tolerance: stage remains authoritative even if a
			// stale producer sends the prior phase.
			phase: "rendering",
			stage: "publishing",
		};

		renderExtension();

		expect(screen.getAllByText("Publishing the longer video…")).toHaveLength(2);
		expect(screen.queryByText("Extending the video to 25 seconds…")).toBeNull();
	});

	it("falls back to generic extension copy for an unknown stage", () => {
		state.attempt = extensionAttempt({ status: "generating" });
		state.progress = {
			durationSeconds: 25,
			headline: "A future workflow step…",
			percent: 67,
			phase: "rendering",
			stage: "future-stage",
		};

		renderExtension();

		expect(
			screen.getByText("Extending the video to 25 seconds…").textContent,
		).toBe("Extending the video to 25 seconds…");
		expect(screen.getByText("67%").textContent).toBe("67%");
		expect(screen.queryByText("A future workflow step…")).toBeNull();
	});

	it("formats a 25-second extension result as 0:25", () => {
		state.attempt = extensionAttempt({
			completedAt: "2026-08-21T12:01:15.000Z",
			status: "succeeded",
			videoMediaType: "video/mp4",
			videoUrl: "https://assets.example.com/extended.mp4",
		});

		renderExtension();

		expect(screen.getByText("0:25").textContent).toBe("0:25");
	});

	it("shows an honest notice when narration delivery failed", () => {
		state.attempt = extensionAttempt({
			completedAt: "2026-08-21T12:01:15.000Z",
			status: "succeeded",
			videoMediaType: "video/mp4",
			videoUrl: "https://assets.example.com/extended.mp4",
			voiceover: {
				deliveryStatus: "failed",
				language: "en",
				script: "Keep moving forward.",
			},
		});

		renderExtension();

		expect(
			screen.getByText(
				"The video is ready, but narration could not be added. The clip is silent.",
			).textContent,
		).toBe(
			"The video is ready, but narration could not be added. The clip is silent.",
		);
	});

	it.each([
		{
			label: "delivered",
			voiceover: {
				deliveryStatus: "delivered" as const,
				language: "en" as const,
				script: "Keep moving forward.",
			},
		},
		{
			label: "an older payload without delivery status",
			voiceover: {
				language: "en" as const,
				script: "Keep moving forward.",
			},
		},
		{ label: "absent", voiceover: null },
	])("does not show the narration warning when status is $label", (testCase) => {
		state.attempt = extensionAttempt({
			completedAt: "2026-08-21T12:01:15.000Z",
			status: "succeeded",
			videoMediaType: "video/mp4",
			videoUrl: "https://assets.example.com/extended.mp4",
			voiceover: testCase.voiceover,
		});

		renderExtension();

		expect(
			screen.queryByText(
				"The video is ready, but narration could not be added. The clip is silent.",
			),
		).toBeNull();
	});
});
