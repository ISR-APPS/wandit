// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { ATTACHMENT_MEDIA_TYPES } from "@wandit/contracts";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PromptBox, type PromptBoxProps } from "./prompt-box";

const { uploadAttachmentMock } = vi.hoisted(() => ({
	uploadAttachmentMock: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
	useSession: () => ({ data: null }),
}));

vi.mock("@/features/connectors", () => ({
	ConnectorsDialog: () => null,
}));

vi.mock("@/lib/i18n", async () => {
	const projects = (
		await import(
			"../../../../../../packages/internationalization/dictionaries/en/projects.json"
		)
	).default;
	const dictionary = { projects };
	const t = (key: string, params?: Record<string, unknown>) => {
		const value = key.split(".").reduce<unknown>((current, segment) => {
			if (current === null || typeof current !== "object") return undefined;
			return (current as Record<string, unknown>)[segment];
		}, dictionary);

		if (typeof value !== "string") return key;
		return value.replace(/\{(\w+)\}/g, (_, name: string) =>
			String(params?.[name] ?? `{${name}}`),
		);
	};

	return {
		useDictionary: () => dictionary,
		useTranslation: () => ({ dir: "ltr", locale: "en", t }),
	};
});

vi.mock("../api/attachments.services", async () => {
	const contracts =
		await vi.importActual<typeof import("@wandit/contracts")>(
			"@wandit/contracts",
		);
	const defaultMaxBytes = 15 * 1024 * 1024;
	return {
		ATTACHMENT_ACCEPT: [
			...contracts.ATTACHMENT_MEDIA_TYPES,
			".csv",
			".docx",
			".xlsx",
		].join(","),
		ATTACHMENT_MAX_BYTES: defaultMaxBytes,
		attachmentMaxBytesFor: (mediaType: string) => {
			if (mediaType.startsWith("video/")) return 50 * 1024 * 1024;
			if (mediaType.startsWith("audio/")) return 25 * 1024 * 1024;
			return defaultMaxBytes;
		},
		AttachmentUploadError: class AttachmentUploadError extends Error {
			readonly reason = "failed";
		},
		uploadAttachment: uploadAttachmentMock,
	};
});

vi.mock("../lib/use-voice-dictation", () => ({
	useVoiceDictation: () => ({
		isRecording: false,
		isTranscribing: false,
		supported: false,
		toggle: vi.fn(),
	}),
}));

class ResizeObserverStub implements ResizeObserver {
	readonly root = null;
	readonly thresholds = [];

	disconnect() {}
	observe() {}
	takeRecords(): ResizeObserverEntry[] {
		return [];
	}
	unobserve() {}
}

type LegacyPromptBoxProps = Partial<PromptBoxProps> & {
	showPriceTag?: boolean;
};

function renderPromptBox(props: LegacyPromptBoxProps = {}) {
	return render(
		createElement(PromptBox, {
			onSubmit: vi.fn(),
			...props,
		}),
	);
}

async function openSettings(name: string): Promise<HTMLElement> {
	fireEvent.click(screen.getByRole("button", { name }));
	return screen.findByRole("dialog");
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	uploadAttachmentMock.mockReset();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("PromptBox generation settings", () => {
	it("renders image output options without quality tiers or a credit badge", async () => {
		renderPromptBox({
			initialComposer: { mode: "image", output: "image-creator" },
			showPriceTag: true,
		});

		const settings = within(await openSettings("Generation settings: Auto"));
		fireEvent.click(settings.getByRole("button", { name: "Next" }));

		expect(settings.getByText("Size")).toBeTruthy();
		expect(settings.getByText("Images")).toBeTruthy();
		expect(settings.getByRole("button", { name: "1:1" })).toBeTruthy();
		expect(settings.getByRole("button", { name: "4 img" })).toBeTruthy();
		expect(settings.queryByRole("button", { name: /Standard/i })).toBeNull();
		expect(settings.queryByRole("button", { name: /^Max$/i })).toBeNull();
		expect(settings.queryByText(/^10$/)).toBeNull();
	});

	it("submits composer metadata without a quality key", async () => {
		const onSubmit = vi.fn().mockResolvedValue(true);
		const legacyComposer = {
			mode: "image" as const,
			options: { count: "2", size: "16-9" },
			output: "image-creator" as const,
			quality: "max",
		};
		renderPromptBox({
			initialComposer: legacyComposer,
			initialValue: "Create a product image",
			onSubmit,
		});

		fireEvent.click(screen.getByRole("button", { name: "Generate" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		const composer = onSubmit.mock.calls[0]?.[1];
		expect(composer).toEqual({
			mode: "image",
			options: { count: "2", size: "16-9" },
			output: "image-creator",
			skills: undefined,
		});
		expect(composer).not.toHaveProperty("quality");
	});
});

describe("PromptBox attachments", () => {
	function genericFileInput(container: HTMLElement): HTMLInputElement {
		const input = container.querySelector<HTMLInputElement>(
			'input[type="file"][multiple]',
		);
		if (!input) throw new Error("Expected the generic attachment input");
		return input;
	}

	function fileWithSize(name: string, mediaType: string, size: number): File {
		const file = new File(["fixture"], name, { type: mediaType });
		Object.defineProperty(file, "size", { value: size });
		return file;
	}

	beforeEach(() => {
		uploadAttachmentMock.mockImplementation(async (file: File) => ({
			url: `https://assets.example.com/${encodeURIComponent(file.name)}`,
			key: `uploads/${file.name}`,
			mediaType: file.type,
			filename: file.name,
			size: file.size,
		}));
	});

	it("uses the contract accept list and uploads MP4 and MP3 picks", async () => {
		const { container } = renderPromptBox({ attachmentsEnabled: true });
		const input = genericFileInput(container);
		const accepted = input.accept.split(",");

		expect(ATTACHMENT_MEDIA_TYPES).toContain("video/mp4");
		expect(ATTACHMENT_MEDIA_TYPES).toContain("audio/mpeg");
		expect(accepted).toEqual(
			expect.arrayContaining([...ATTACHMENT_MEDIA_TYPES]),
		);

		const video = new File(["video"], "reference.mp4", {
			type: "video/mp4",
		});
		const audio = new File(["audio"], "soundtrack.mp3", {
			type: "audio/mpeg",
		});
		fireEvent.change(input, { target: { files: [video, audio] } });

		await waitFor(() => expect(uploadAttachmentMock).toHaveBeenCalledTimes(2));
		expect(uploadAttachmentMock.mock.calls.map(([file]) => file)).toEqual([
			video,
			audio,
		]);
	});

	it("keeps the generic attachment cap at six files", async () => {
		const { container } = renderPromptBox({ attachmentsEnabled: true });
		const input = genericFileInput(container);
		const files = Array.from(
			{ length: 7 },
			(_, index) =>
				new File(["video"], `reference-${index}.mp4`, {
					type: "video/mp4",
				}),
		);

		fireEvent.change(input, { target: { files } });

		await waitFor(() => expect(uploadAttachmentMock).toHaveBeenCalledTimes(6));
	});

	it("uses the category size cap before starting uploads", async () => {
		const { container } = renderPromptBox({ attachmentsEnabled: true });
		const input = genericFileInput(container);
		const acceptedVideo = fileWithSize(
			"long-reference.mp4",
			"video/mp4",
			50 * 1024 * 1024,
		);
		const rejectedVideo = fileWithSize(
			"oversize-reference.mp4",
			"video/mp4",
			50 * 1024 * 1024 + 1,
		);
		const rejectedAudio = fileWithSize(
			"oversize.mp3",
			"audio/mpeg",
			26 * 1024 * 1024,
		);
		const rejectedDocument = fileWithSize(
			"oversize.pdf",
			"application/pdf",
			16 * 1024 * 1024,
		);

		fireEvent.change(input, {
			target: {
				files: [acceptedVideo, rejectedVideo, rejectedAudio, rejectedDocument],
			},
		});

		await waitFor(() => expect(uploadAttachmentMock).toHaveBeenCalledOnce());
		expect(uploadAttachmentMock).toHaveBeenCalledWith(acceptedVideo);
		expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
	});
});
