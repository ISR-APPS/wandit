import type {
	AskUserOutput,
	UploadAttachmentResponse,
} from "@wandit/contracts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import {
	collectAskStepper,
	collectWorldCards,
	useRequestTray,
	withAnswerFiles,
} from "./use-request-tray";

const { uploadAttachmentMock } = vi.hoisted(() => ({
	uploadAttachmentMock: vi.fn(),
}));

vi.mock("@/features/projects", () => ({
	ATTACHMENT_MAX_BYTES: 15 * 1024 * 1024,
	uploadAttachment: uploadAttachmentMock,
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

type TrayProps = Parameters<typeof useRequestTray>[0];
type TrayResult = ReturnType<typeof useRequestTray>;

const mountedRoots = new Set<Root>();

function installMinimalDom() {
	const document = {
		nodeType: 9,
		activeElement: null,
		addEventListener() {},
		removeEventListener() {},
	} as Record<string, unknown>;
	const window = {
		document,
		HTMLIFrameElement: class {},
	};
	document.defaultView = window;
	vi.stubGlobal("document", document);
	vi.stubGlobal("window", window);
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

	return {
		nodeType: 1,
		tagName: "DIV",
		nodeName: "DIV",
		ownerDocument: document,
		firstChild: null,
		textContent: "",
		addEventListener() {},
		removeEventListener() {},
		appendChild() {},
		removeChild() {},
		insertBefore() {},
	};
}

async function renderTrayHook(initialProps: TrayProps) {
	let props = initialProps;
	let current: TrayResult | undefined;
	const container = installMinimalDom();

	function Harness() {
		current = useRequestTray(props);
		return null;
	}

	const root = createRoot(container as unknown as Element);
	mountedRoots.add(root);
	await act(async () => {
		root.render(createElement(Harness));
	});

	return {
		get result() {
			if (!current) throw new Error("Hook did not render");
			return current;
		},
		async rerender(nextProps: TrayProps) {
			props = nextProps;
			await act(async () => {
				root.render(createElement(Harness));
			});
		},
	};
}

function askPart(
	toolCallId: string,
	input: Record<string, unknown>,
	state: "input-available" | "output-available" = "input-available",
) {
	return {
		type: "tool-ask_user",
		toolCallId,
		state,
		input,
		...(state === "output-available" ? { output: { dismissed: true } } : {}),
	};
}

function assistantMessages(
	parts: unknown[],
	id = "assistant-1",
): WanditUIMessage[] {
	return [
		{
			id,
			role: "assistant",
			parts: parts as WanditUIMessage["parts"],
		},
	];
}

function worldCard(id: string, name = id) {
	return {
		id,
		name,
		tagline: `${name} tagline`,
		preview: {
			ground: "#F2EDE2",
			ink: "#202723",
			accent: "#C35A37",
			fontFamily: "Cormorant Garamond",
			sampleWord: name,
		},
	};
}

function menuPart(cards: unknown[], toolCallId = "menu-1") {
	return {
		type: "tool-get_direction_candidates",
		toolCallId,
		state: "output-available",
		input: { business: "boutique", pageKind: "website" },
		output: { candidates: "## DESIGN WORLDS (menu text)", cards },
	};
}

function composerUpload(
	url = "https://cdn.example.com/composer.png",
	filename = "composer.png",
): UploadAttachmentResponse {
	return {
		url,
		key: `uploads/${filename}`,
		mediaType: "image/png",
		filename,
		size: 42,
	};
}

beforeEach(() => {
	uploadAttachmentMock.mockReset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of mountedRoots) root.unmount();
	});
	mountedRoots.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("withAnswerFiles", () => {
	it("returns the original output when there are no composer attachments", () => {
		const output: AskUserOutput = { text: "Use the warm direction" };

		const result = withAnswerFiles(output, []);

		expect(result).toBe(output);
		expect(result).not.toHaveProperty("files");
	});

	it("maps uploads and deduplicates their URLs against existing answer files", () => {
		const existingFile = {
			url: "https://cdn.example.com/existing.png",
			mediaType: "image/png",
			filename: "existing.png",
		};
		const output: AskUserOutput = {
			text: "Use these",
			files: [existingFile],
		};

		expect(
			withAnswerFiles(output, [
				composerUpload(existingFile.url, "duplicate.png"),
				composerUpload("https://cdn.example.com/new.png", "new.png"),
				composerUpload("https://cdn.example.com/new.png", "duplicate-new.png"),
			]),
		).toEqual({
			text: "Use these",
			files: [
				existingFile,
				{
					url: "https://cdn.example.com/new.png",
					mediaType: "image/png",
					filename: "new.png",
				},
			],
		});
		expect(output.files).toEqual([existingFile]);
	});
});

describe("useRequestTray", () => {
	it("confirms free text with composer attachments", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const upload = composerUpload();
		const tray = await renderTrayHook({
			messages: assistantMessages([
				askPart("ask-text", {
					question: "What should I build?",
					options: [],
				}),
			]),
			composerText: "Build a product page",
			onAnswer,
		});

		await act(async () => {
			tray.result.confirmDraft([upload]);
		});

		expect(onAnswer).toHaveBeenCalledWith("ask-text", {
			text: "Build a product page",
			files: [
				{
					url: upload.url,
					mediaType: upload.mediaType,
					filename: upload.filename,
				},
			],
		});
	});

	it("confirms a single choice with composer attachments", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const upload = composerUpload();
		const tray = await renderTrayHook({
			messages: assistantMessages([
				askPart("ask-choice", {
					question: "Which direction?",
					kind: "single-choice",
					options: [{ id: "warm", label: "Warm" }],
				}),
			]),
			composerText: "",
			onAnswer,
		});

		await act(async () => {
			tray.result.onPick({ id: "warm", label: "Warm" });
		});
		await act(async () => {
			tray.result.confirmDraft([upload]);
		});

		expect(onAnswer).toHaveBeenCalledWith("ask-choice", {
			selectedId: "warm",
			label: "Warm",
			files: [
				{
					url: upload.url,
					mediaType: upload.mediaType,
					filename: upload.filename,
				},
			],
		});
	});

	it("deduplicates composer files against an attachment ask draft", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const trayUpload = composerUpload(
			"https://cdn.example.com/shared.png",
			"tray.png",
		);
		uploadAttachmentMock.mockResolvedValue(trayUpload);
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared-preview");
		vi.spyOn(URL, "revokeObjectURL");
		const tray = await renderTrayHook({
			messages: assistantMessages([
				askPart("ask-attachments", {
					question: "Attach a reference",
					kind: "attachments",
					accept: ["image"],
					options: [],
				}),
			]),
			composerText: "",
			onAnswer,
		});

		await act(async () => {
			tray.result.onBrowseFiles([
				new File(["png"], "tray.png", { type: "image/png" }),
			] as unknown as FileList);
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(tray.result.canConfirm).toBe(true);

		const composerOnly = composerUpload(
			"https://cdn.example.com/composer-only.png",
			"composer-only.png",
		);
		await act(async () => {
			tray.result.confirmDraft([
				composerUpload(trayUpload.url, "duplicate.png"),
				composerOnly,
			]);
		});

		expect(onAnswer).toHaveBeenCalledWith("ask-attachments", {
			files: [
				{
					url: trayUpload.url,
					mediaType: trayUpload.mediaType,
					filename: trayUpload.filename,
				},
				{
					url: composerOnly.url,
					mediaType: composerOnly.mediaType,
					filename: composerOnly.filename,
				},
			],
		});
	});

	it("keeps direct free-text answers fileless when the composer has no attachments", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const tray = await renderTrayHook({
			messages: assistantMessages([
				askPart("ask-direct-text", {
					question: "What should I build?",
					options: [],
				}),
			]),
			composerText: "",
			onAnswer,
		});

		await act(async () => {
			tray.result.answerFreeText("Build a product page", []);
		});

		const output = onAnswer.mock.calls[0]?.[1];
		expect(output).toEqual({ text: "Build a product page" });
		expect(output).not.toHaveProperty("files");
	});

	it("keys a question round by assistant message and last step-start", () => {
		const ask = askPart("ask-1", {
			question: "What should the tone be?",
			options: [],
		});
		const first = collectAskStepper(
			assistantMessages([{ type: "step-start" }, ask]),
		);
		const nextStep = collectAskStepper(
			assistantMessages([
				{ type: "step-start" },
				ask,
				{ type: "step-start" },
				askPart("ask-2", { question: "And the audience?", options: [] }),
			]),
		);
		const nextMessage = collectAskStepper(
			assistantMessages([{ type: "step-start" }, ask], "assistant-2"),
		);

		expect(first.roundKey).toBe("assistant-1:0");
		expect(nextStep.roundKey).toBe("assistant-1:2");
		expect(nextMessage.roundKey).toBe("assistant-2:0");
	});

	it("dismisses the whole round locally, clears drafts, and shows a new round", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:tray-preview");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		uploadAttachmentMock.mockResolvedValue({
			url: "https://cdn.example.com/draft.png",
			key: "uploads/draft.png",
			mediaType: "image/png",
			filename: "draft.png",
			size: 3,
		});

		const attachmentAsk = askPart("round-n-tool-id", {
			question: "Attach a reference",
			options: [],
			kind: "attachments",
			accept: ["image"],
			maxFiles: 2,
		});
		const siblingAsk = askPart("ask-2", {
			question: "Pick audiences",
			options: [
				{ id: "founders", label: "Founders" },
				{ id: "teams", label: "Teams" },
			],
			kind: "multi-select",
		});
		const firstRoundParts = [{ type: "step-start" }, attachmentAsk, siblingAsk];
		const props = {
			messages: assistantMessages(firstRoundParts),
			composerText: "",
			onAnswer,
		};
		const tray = await renderTrayHook(props);

		await act(async () => {
			tray.result.onPick({ id: "single-draft", label: "Single draft" });
			tray.result.onToggleMulti("multi-draft");
			tray.result.onBrowseFiles([
				new File(["png"], "draft.png", { type: "image/png" }),
			] as unknown as FileList);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(tray.result.multiSelectedIds).toEqual(["multi-draft"]);
		expect(tray.result.readyFileCount).toBe(1);
		expect(tray.result.state?.body.kind).toBe("media-drop");
		if (tray.result.state?.body.kind !== "media-drop") {
			throw new Error("Expected attachment tray");
		}
		expect(tray.result.state.body.items).toHaveLength(1);

		await act(async () => {
			tray.result.dismiss();
		});

		expect(tray.result.active).toBe(false);
		expect(tray.result.answerable).toBe(false);
		expect(tray.result.state).toBeNull();
		expect(onAnswer).not.toHaveBeenCalled();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:tray-preview");

		await tray.rerender({
			...props,
			messages: assistantMessages([
				{ type: "step-start" },
				{
					...attachmentAsk,
					state: "output-available",
					output: { text: "later" },
				},
				siblingAsk,
			]),
		});

		// Advancing to a pending sibling does not reopen a dismissed round.
		expect(tray.result.active).toBe(false);
		expect(tray.result.answerable).toBe(false);
		expect(tray.result.state).toBeNull();

		await tray.rerender({
			...props,
			messages: assistantMessages([
				...firstRoundParts,
				{ type: "step-start" },
				askPart("round-n-plus-1-tool-id", {
					question: "Pick a new direction",
					options: [{ id: "new", label: "New" }],
					kind: "single-choice",
				}),
			]),
		});

		expect(tray.result.active).toBe(true);
		expect(tray.result.answerable).toBe(true);
		expect(tray.result.state?.body.kind).toBe("single-choice");
		expect(tray.result.selectedCount).toBe(0);
		expect(tray.result.multiSelectedIds).toEqual([]);
		expect(tray.result.readyFileCount).toBe(0);
		expect(onAnswer).not.toHaveBeenCalled();

		await act(async () => {
			tray.result.onPick({ id: "new", label: "New" });
		});
		expect(tray.result.canConfirm).toBe(true);

		await act(async () => {
			tray.result.confirmDraft();
		});
		expect(onAnswer).toHaveBeenCalledOnce();
		expect(onAnswer).toHaveBeenCalledWith("round-n-plus-1-tool-id", {
			selectedId: "new",
			label: "New",
		});
	});

	it("collects world cards across menus, latest menu winning per id", () => {
		const early = worldCard("creme", "Crème ancienne");
		const late = worldCard("creme", "Crème");
		const other = worldCard("calque", "Calque");
		const cards = collectWorldCards([
			...assistantMessages([menuPart([early])], "assistant-1"),
			...assistantMessages([menuPart([late, other], "menu-2")], "assistant-2"),
		]);

		expect(cards.size).toBe(2);
		expect(cards.get("creme")?.name).toBe("Crème");
		expect(cards.get("calque")?.name).toBe("Calque");
	});

	it("renders a taste ask as world cards and answers with the picked option", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const tray = await renderTrayHook({
			messages: assistantMessages([
				{ type: "step-start" },
				menuPart([worldCard("creme", "Crème"), worldCard("ombre", "Ombre")]),
				askPart("ask-taste", {
					question: "Which feel fits your brand?",
					kind: "single-choice",
					options: [
						{ id: "creme", label: "Morning-light softness", worldId: "creme" },
						{ id: "ombre", label: "Deep evening calm", worldId: "ombre" },
						{ id: "perdu", label: "A lost world", worldId: "no-such-world" },
					],
				}),
			]),
			composerText: "",
			onAnswer,
		});

		const body = tray.result.state?.body;
		expect(body?.kind).toBe("world-pick");
		if (body?.kind !== "world-pick") throw new Error("Expected world cards");
		expect(body.options).toHaveLength(3);
		expect(body.options[0]?.card?.name).toBe("Crème");
		expect(body.options[0]?.card?.preview.fontFamily).toBe(
			"Cormorant Garamond",
		);
		// An unresolvable worldId keeps its seat as a neutral card.
		expect(body.options[2]?.card).toBeUndefined();

		await act(async () => {
			tray.result.onPick({ id: "creme", label: "Morning-light softness" });
		});
		expect(tray.result.answerMode).toBe("single");
		expect(tray.result.canConfirm).toBe(true);

		await act(async () => {
			tray.result.confirmDraft();
		});
		expect(onAnswer).toHaveBeenCalledWith("ask-taste", {
			selectedId: "creme",
			label: "Morning-light softness",
		});
	});

	it("falls back to plain chips when no menu cards resolve", async () => {
		const tray = await renderTrayHook({
			messages: assistantMessages([
				{ type: "step-start" },
				askPart("ask-taste", {
					question: "Which feel fits your brand?",
					kind: "single-choice",
					options: [
						{ id: "a", label: "Soft", worldId: "creme" },
						{ id: "b", label: "Dark", worldId: "ombre" },
					],
				}),
			]),
			composerText: "",
			onAnswer: vi.fn(),
		});

		expect(tray.result.state?.body.kind).toBe("single-choice");
	});

	it("keeps delegation as a real tool answer", async () => {
		const onAnswer =
			vi.fn<(toolCallId: string, output: AskUserOutput) => void>();
		const tray = await renderTrayHook({
			messages: assistantMessages([
				{ type: "step-start" },
				askPart("ask-delegate", {
					question: "Which direction?",
					options: [],
				}),
			]),
			composerText: "",
			onAnswer,
		});

		await act(async () => {
			tray.result.delegate();
		});

		expect(onAnswer).toHaveBeenCalledOnce();
		expect(onAnswer).toHaveBeenCalledWith("ask-delegate", {
			delegated: true,
		});
	});
});
