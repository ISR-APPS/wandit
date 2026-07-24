// Derives the live request-tray state from the AI SDK message list — the
// bridge between stream parts and the display types in types.ts. The rule
// (design turn 10, stepper revision): the FIRST unanswered ask_user call of
// the LAST assistant message docks on the composer — a multi-question turn
// steps through them oldest first, one at a time, with "Question 2 of 4"
// progress; everything else in the thread stays prose. Answering goes back
// through ONE callback (answerAskUser in use-ai-chat.ts) with the output
// shape built here, so the tray, the composer free-text path and the escape
// hatch all complete the same tool call the same way.

import type {
	AskUserOption,
	AskUserOutput,
	UploadAttachmentResponse,
} from "@wandit/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ATTACHMENT_MAX_BYTES, uploadAttachment } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import type { ChipOption, MediaItem, RequestTrayState } from "./types";

type AskUserToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-ask_user" }
>;

// Stable empty selection — a fresh [] every render would defeat the state
// memo below (its deps compare by reference).
const NO_PICKS: string[] = [];

/* ---------- attachments ask (contract §10.5) ---------- */

/** One drafted upload inside the media-drop tray body. */
export type AttachDraftItem = {
	id: string; // local uuid
	name: string;
	previewUrl: string | null; // object URL for images
	status: "uploading" | "ready" | "error";
	uploaded?: UploadAttachmentResponse;
};

const NO_ATTACH_ITEMS: AttachDraftItem[] = [];

// Contract §7.2 allowlist split by the ask's accept kinds.
const IMAGE_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
];
const DOCUMENT_MEDIA_TYPES = ["application/pdf", "text/plain"];

function acceptedMediaTypes(
	accept: readonly ("image" | "document")[],
	mediaTypes?: readonly string[],
) {
	if (mediaTypes && mediaTypes.length > 0) {
		return new Set(mediaTypes);
	}

	return new Set([
		...(accept.includes("image") ? IMAGE_MEDIA_TYPES : []),
		...(accept.includes("document") ? DOCUMENT_MEDIA_TYPES : []),
	]);
}

function acceptAttrFor(
	accept: readonly ("image" | "document")[],
	mediaTypes?: readonly string[],
) {
	if (mediaTypes && mediaTypes.length > 0) {
		return mediaTypes.join(",");
	}

	const parts = [
		...(accept.includes("image") ? ["image/*"] : []),
		...(accept.includes("document") ? DOCUMENT_MEDIA_TYPES : []),
	];
	return parts.join(",");
}

function toMediaItem(item: AttachDraftItem): MediaItem {
	return {
		id: item.id,
		name: item.name,
		preview: item.previewUrl
			? `url("${item.previewUrl}") center/cover`
			: "var(--secondary)",
		// The endpoint gives no progress events — indeterminate 50 while in
		// flight reads as "working" without pretending precision.
		uploading: item.status === "uploading" ? { percent: 50 } : undefined,
		error: item.status === "error",
	};
}

/* ---------- answer builders ----------
   One tiny function per way the ask can settle, so every call site sends the
   exact contract shape (askUserOutputSchema) instead of hand-rolled objects. */

export function pickAnswer(option: AskUserOption): AskUserOutput {
	return { selectedId: option.id, label: option.label };
}

export function multiAnswer(selections: AskUserOption[]): AskUserOutput {
	return { selections };
}

export function freeTextAnswer(text: string): AskUserOutput {
	return { text };
}

export function filesAnswer(
	files: NonNullable<AskUserOutput["files"]>,
): AskUserOutput {
	return { files };
}

/** "Decide for me" — the model picks confidently and says what it picked. */
export function delegateAnswer(): AskUserOutput {
	return { delegated: true };
}

/** Tray X — "skip, continue" (the question is logged, never lost). */
export function dismissAnswer(): AskUserOutput {
	return { dismissed: true };
}

/* ---------- derivation helpers (pure) ---------- */

export type AskStepper = {
	/** The ask docked on the composer — the FIRST one still without an output. */
	active: AskUserToolPart | null;
	/** 1-based position shown as "Question 2 of 4": answered asks + 1. */
	current: number;
	/** Every ask_user call in the turn, answered or not. 0 = no asks. */
	total: number;
};

const NO_ASKS: AskStepper = { active: null, current: 0, total: 0 };

/** Pending = the user still owes an answer. input-streaming counts (the tray
    shows its spinner preamble) but stays unanswerable until input-available. */
function isPendingAsk(part: AskUserToolPart): boolean {
	return part.state === "input-streaming" || part.state === "input-available";
}

/** Ordered stepper over the last assistant message's ask_user calls. The
    model may ask several questions in one turn; they dock ONE at a time,
    OLDEST first, so the thread reads top-to-bottom. Answering the active ask
    advances to the next pending sibling; once every call has an output,
    sendAutomaticallyWhen posts them all back in one request. */
export function collectAskStepper(messages: WanditUIMessage[]): AskStepper {
	const last = messages[messages.length - 1];
	if (last?.role !== "assistant") return NO_ASKS;

	// Tray answers CONTINUE the same assistant message (the server upserts by
	// message id), so earlier rounds' answered asks are still among the parts.
	// Only the parts after the LAST step-start belong to the current round —
	// the same scoping as lastAssistantMessageIsCompleteWithToolCalls —
	// otherwise "Question X of Y" inflates on every follow-up round.
	const lastStepStart = last.parts.reduce(
		(lastIndex, part, index) =>
			part.type === "step-start" ? index : lastIndex,
		-1,
	);
	const asks = last.parts
		.slice(lastStepStart + 1)
		.filter((part): part is AskUserToolPart => part.type === "tool-ask_user");
	if (asks.length === 0) return NO_ASKS;

	const answered = asks.filter((ask) => !isPendingAsk(ask)).length;
	return {
		active: asks.find(isPendingAsk) ?? null,
		// Clamped for the instant every ask is settled, before auto-resubmit.
		current: Math.min(answered + 1, asks.length),
		total: asks.length,
	};
}

/** One-line summary of an answer for the settled ask shown in the thread. */
export function askAnswerValue(output: AskUserOutput): string {
	return (
		output.text ??
		output.label ??
		output.selections?.map((s) => s.label).join(" · ") ??
		""
	);
}

/* ---------- the hook ---------- */

export function useRequestTray({
	messages,
	composerText,
	onAnswer,
}: {
	messages: WanditUIMessage[];
	composerText: string;
	/** answerAskUser from use-ai-chat — completes the tool call. */
	onAnswer: (toolCallId: string, output: AskUserOutput) => void;
}) {
	const { t } = useTranslation();
	const stepper = useMemo(() => collectAskStepper(messages), [messages]);
	const active = stepper.active;
	const toolCallId = active?.toolCallId;

	// AnimatePresence keeps the EXITING tray mounted (~340ms) with callbacks
	// frozen from the render where the previous ask was still pending. The ref
	// always names the LIVE active call, so a stale closure invoked from that
	// tray no-ops instead of overwriting an answer that already settled.
	const activeToolCallIdRef = useRef(toolCallId);
	useEffect(() => {
		activeToolCallIdRef.current = toolCallId;
	}, [toolCallId]);

	// Choice drafts live above the bodies so the PromptBox CTA can validate and
	// confirm them. Keying by toolCallId prevents a queued ask from inheriting
	// the previous question's selection.
	const [singlePick, setSinglePick] = useState<{
		toolCallId: string;
		id: string;
	} | null>(null);
	const selectedId =
		singlePick && singlePick.toolCallId === toolCallId
			? singlePick.id
			: undefined;

	const [multiPicks, setMultiPicks] = useState<{
		toolCallId: string;
		ids: string[];
	} | null>(null);
	const selectedIds =
		multiPicks && multiPicks.toolCallId === toolCallId
			? multiPicks.ids
			: NO_PICKS;

	// Attachments ask draft: uploads keyed by toolCallId, same pattern as the
	// choice drafts above. Object URLs are revoked on remove/answer/unmount.
	const [attachDrafts, setAttachDrafts] = useState<{
		toolCallId: string;
		items: AttachDraftItem[];
	} | null>(null);
	const attachItems =
		attachDrafts && attachDrafts.toolCallId === toolCallId
			? attachDrafts.items
			: NO_ATTACH_ITEMS;

	const attachDraftsRef = useRef(attachDrafts);
	useEffect(() => {
		attachDraftsRef.current = attachDrafts;
	}, [attachDrafts]);
	useEffect(
		() => () => {
			for (const item of attachDraftsRef.current?.items ?? []) {
				if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
			}
		},
		[],
	);
	const clearAttachDrafts = useCallback(() => {
		for (const item of attachDraftsRef.current?.items ?? []) {
			if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
		}
		setAttachDrafts(null);
	}, []);

	const state = useMemo<RequestTrayState | null>(() => {
		if (!active) return null;
		const streaming = active.state === "input-streaming";
		const question = active.input?.question ?? undefined;
		const helper = active.input?.helper ?? undefined;
		const options = (active.input?.options ?? []).flatMap<ChipOption>(
			(option) =>
				option?.id && option.label
					? [{ id: option.id, label: option.label }]
					: [],
		);

		// Explicit kind wins; old asks (no kind) derive it from the options:
		// none → free-text, some → single-choice.
		const kind =
			active.input?.kind ??
			(options.length === 0 ? "free-text" : "single-choice");

		// While the input is still streaming the options are half-parsed — show
		// the question growing with a spinner and no chips until input-available.
		const body: RequestTrayState["body"] = streaming
			? { kind: "free-text" }
			: kind === "attachments"
				? {
						kind: "media-drop",
						title: t("workspace.chat.tray.dropHint"),
						browseLabel: t("workspace.chat.tray.browse"),
						accept: acceptAttrFor(
							active.input?.accept ?? ["image"],
							active.input?.mediaTypes,
						),
						items: attachItems.map(toMediaItem),
					}
				: kind === "multi-select"
					? { kind: "multi-select", options, selectedIds }
					: kind === "single-choice"
						? { kind: "single-choice", options, selectedId }
						: { kind: "free-text" };

		return {
			badge: streaming
				? "spinner"
				: kind === "attachments"
					? "media"
					: "question",
			label: streaming
				? t("workspace.chat.tray.preparing")
				: kind === "attachments"
					? t("workspace.chat.tray.needsFiles")
					: t("workspace.chat.tray.needsDetail"),
			question,
			helper,
			escape: {
				label: t("workspace.chat.tray.decideForMe"),
				icon: "shuffle",
			},
			body,
			// Progress only when the turn actually has several questions — a
			// single ask keeps today's exact tray (no "Question 1 of 1" noise).
			step:
				stepper.total > 1
					? { current: stepper.current, total: stepper.total }
					: undefined,
			// Typed text beats the chips / drop zone (design 10n state 2) — only
			// meaningful when there IS a body to dim.
			typingOverride:
				composerText.trim().length > 0 &&
				(options.length > 0 || (!streaming && kind === "attachments")),
		};
	}, [active, stepper, composerText, selectedId, selectedIds, attachItems, t]);

	const answer = useCallback(
		(output: AskUserOutput) => {
			// Only a fully-arrived ask may be answered: writing an output onto a
			// part whose input is still streaming would race the incoming chunks.
			if (!toolCallId || active?.state !== "input-available") return;
			// A closure captured before a stepper advance targets the PREVIOUS
			// ask — addToolOutput would silently replace its answer.
			if (toolCallId !== activeToolCallIdRef.current) return;
			onAnswer(toolCallId, output);
			setSinglePick(null);
			setMultiPicks(null);
			clearAttachDrafts();
		},
		[toolCallId, active, onAnswer, clearAttachDrafts],
	);

	const onPick = useCallback(
		(option: ChipOption) => {
			if (!toolCallId) return;
			setSinglePick({ toolCallId, id: option.id });
		},
		[toolCallId],
	);

	const onToggleMulti = useCallback(
		(id: string) => {
			if (!toolCallId) return;
			setMultiPicks((current) => {
				const ids =
					current && current.toolCallId === toolCallId ? current.ids : [];
				return {
					toolCallId,
					ids: ids.includes(id)
						? ids.filter((item) => item !== id)
						: [...ids, id],
				};
			});
		},
		[toolCallId],
	);

	const runDraftUpload = useCallback(
		async (ownerToolCallId: string, id: string, file: File) => {
			const patch = (changes: Partial<AttachDraftItem>) =>
				setAttachDrafts((current) =>
					current && current.toolCallId === ownerToolCallId
						? {
								...current,
								items: current.items.map((item) =>
									item.id === id ? { ...item, ...changes } : item,
								),
							}
						: current,
				);
			try {
				const uploaded = await uploadAttachment(file);
				patch({ status: "ready", uploaded });
			} catch {
				patch({ status: "error" });
			}
		},
		[],
	);

	const onBrowseFiles = useCallback(
		(files: FileList) => {
			// Narrow on state FIRST — a streaming input is DeepPartial and its
			// accept entries could be undefined.
			if (!toolCallId || active?.state !== "input-available") return;
			const input = active.input;
			if (input?.kind !== "attachments") return;
			const maxFiles = input.maxFiles ?? 3;
			const allowed = acceptedMediaTypes(
				input.accept ?? ["image"],
				input.mediaTypes,
			);
			const existing =
				attachDraftsRef.current &&
				attachDraftsRef.current.toolCallId === toolCallId
					? attachDraftsRef.current.items
					: [];
			const room = maxFiles - existing.length;
			if (room <= 0) return;

			const next: AttachDraftItem[] = [];
			const uploads: Array<{ id: string; file: File }> = [];
			for (const file of Array.from(files).slice(0, room)) {
				const invalid =
					!allowed.has(file.type) || file.size > ATTACHMENT_MAX_BYTES;
				const item: AttachDraftItem = {
					id: crypto.randomUUID(),
					name: file.name,
					previewUrl: file.type.startsWith("image/")
						? URL.createObjectURL(file)
						: null,
					status: invalid ? "error" : "uploading",
				};
				next.push(item);
				if (!invalid) uploads.push({ id: item.id, file });
			}
			setAttachDrafts({ toolCallId, items: [...existing, ...next] });
			for (const upload of uploads) {
				void runDraftUpload(toolCallId, upload.id, upload.file);
			}
		},
		[toolCallId, active, runDraftUpload],
	);

	const onRemoveAttachment = useCallback((id: string) => {
		const found = attachDraftsRef.current?.items.find((item) => item.id === id);
		if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
		setAttachDrafts((current) =>
			current
				? {
						...current,
						items: current.items.filter((item) => item.id !== id),
					}
				: current,
		);
	}, []);

	const onConfirmAttachments = useCallback(() => {
		const files = attachItems.flatMap((item) =>
			item.status === "ready" && item.uploaded
				? [
						{
							url: item.uploaded.url,
							mediaType: item.uploaded.mediaType,
							filename: item.uploaded.filename,
						},
					]
				: [],
		);
		if (files.length > 0) answer(filesAnswer(files));
	}, [attachItems, answer]);

	const onConfirmMulti = useCallback(() => {
		const options = active?.input?.options ?? [];
		const selections = options.flatMap<AskUserOption>((option) =>
			option?.id && option.label && selectedIds.includes(option.id)
				? [{ id: option.id, label: option.label }]
				: [],
		);
		if (selections.length > 0) answer(multiAnswer(selections));
	}, [active, selectedIds, answer]);

	const onConfirmSingle = useCallback(() => {
		const option = (active?.input?.options ?? []).find(
			(candidate) => candidate?.id === selectedId,
		);
		if (option?.id && option.label) {
			answer(pickAnswer({ id: option.id, label: option.label }));
		}
	}, [active, selectedId, answer]);

	const answerFreeText = useCallback(
		(text: string) => answer(freeTextAnswer(text)),
		[answer],
	);
	const delegate = useCallback(() => answer(delegateAnswer()), [answer]);
	const dismiss = useCallback(() => answer(dismissAnswer()), [answer]);

	// Typed text wins over any chip/upload draft. That preserves the existing
	// free-form override while every answer mode now confirms through one CTA.
	const trimmedComposerText = composerText.trim();
	const answerMode = trimmedComposerText
		? "text"
		: state?.body.kind === "single-choice"
			? "single"
			: state?.body.kind === "multi-select"
				? "multi"
				: state?.body.kind === "media-drop"
					? "attachments"
					: "text";
	const readyFileCount = attachItems.filter(
		(item) => item.status === "ready",
	).length;
	const hasUploadingFile = attachItems.some(
		(item) => item.status === "uploading",
	);
	const canConfirm =
		active?.state === "input-available" &&
		(answerMode === "text"
			? trimmedComposerText.length > 0
			: answerMode === "single"
				? Boolean(selectedId)
				: answerMode === "multi"
					? selectedIds.length > 0
					: readyFileCount > 0 && !hasUploadingFile);
	const confirmDraft = useCallback(() => {
		if (!canConfirm) return false;
		if (trimmedComposerText) {
			answerFreeText(trimmedComposerText);
		} else if (answerMode === "single") {
			onConfirmSingle();
		} else if (answerMode === "multi") {
			onConfirmMulti();
		} else {
			onConfirmAttachments();
		}
	}, [
		canConfirm,
		trimmedComposerText,
		answerFreeText,
		answerMode,
		onConfirmSingle,
		onConfirmMulti,
		onConfirmAttachments,
	]);

	return {
		/** True while an ask is docked — including its streaming preamble. */
		active: Boolean(active),
		/** Only input-available asks may be answered; a streaming input hasn't
		    fully arrived yet and the composer is disabled anyway. */
		answerable: active?.state === "input-available",
		toolCallId,
		state,
		// Body interactivity, threaded through RequestTray → TrayBodySlot.
		onPick,
		multiSelectedIds: selectedIds,
		onToggleMulti,
		onBrowseFiles,
		onRemoveAttachment,
		answerMode,
		canConfirm,
		selectedCount:
			answerMode === "single" ? (selectedId ? 1 : 0) : selectedIds.length,
		/** Attachments ask only — how many uploads are confirmable right now. */
		readyFileCount,
		confirmDraft,
		// Whole-ask actions.
		answerFreeText,
		delegate,
		dismiss,
	};
}
