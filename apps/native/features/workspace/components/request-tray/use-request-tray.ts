// Derives the live request-tray state from the AI SDK message list — the
// mobile twin of the web use-request-tray.ts. The rule: the FIRST unanswered
// ask_user call of the LAST assistant message docks on the composer; a
// multi-question turn steps through them oldest first. Choice picks and
// attachment uploads are DRAFTS keyed by toolCallId; every answer mode
// confirms through ONE CTA (the composer's send button via submitOverride),
// exactly like the web. Answering goes back through one callback
// (answerAskUser in use-ai-chat.ts) with the contract output shape.

import {
	type AskUserOption,
	type AskUserOutput,
	type AttachmentMediaType,
	type UploadAttachmentResponse,
	type WorldCard,
	worldCardSchema,
} from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	ATTACHMENT_MAX_BYTES,
	AttachmentUploadError,
	uploadAttachment,
} from "@/features/projects";

import {
	type AskUserThreadPart,
	asMessagePart,
	type ChatMessageLike,
	parseAskUserParts,
} from "../../lib/chat-message";
import type { ChipOption, RequestTrayState, TrayMediaItem } from "./tray-types";

const NO_PICKS: string[] = [];

/* ---------- attachments ask (contract §10.5) ---------- */

/** One drafted upload inside the media-drop tray body. */
type AttachDraftItem = {
	id: string;
	/** Local device uri — thumbnail source, never sent to the server. */
	uri: string;
	name: string;
	mediaType: string;
	status: "uploading" | "ready" | "error";
	uploaded?: UploadAttachmentResponse;
};

const NO_ATTACH_ITEMS: AttachDraftItem[] = [];
const DEFAULT_MAX_FILES = 3;

// Contract §7.2 allowlist split by the ask's accept kinds (web parity).
const IMAGE_MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
];
const DOCUMENT_MEDIA_TYPES = ["application/pdf", "text/plain"];

// Fallback for pickers that omit mimeType — keyed by lowercase extension.
const EXTENSION_MEDIA_TYPES: Record<string, string> = {
	avif: "image/avif",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	pdf: "application/pdf",
	png: "image/png",
	txt: "text/plain",
	webp: "image/webp",
};

function acceptedMediaTypes(
	accept: readonly ("image" | "document")[],
	mediaTypes?: readonly string[],
) {
	if (mediaTypes && mediaTypes.length > 0) return new Set(mediaTypes);
	return new Set([
		...(accept.includes("image") ? IMAGE_MEDIA_TYPES : []),
		...(accept.includes("document") ? DOCUMENT_MEDIA_TYPES : []),
	]);
}

type PickedFile = {
	uri: string;
	filename: string | null;
	mimeType: string | null;
	size: number | null;
};

function resolvePickedMediaType(file: PickedFile): string | null {
	const fromMime = file.mimeType?.toLowerCase().split(";")[0]?.trim();
	if (fromMime) return fromMime;
	const name = file.filename ?? file.uri;
	const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
	return EXTENSION_MEDIA_TYPES[extension] ?? null;
}

function toMediaItem(item: AttachDraftItem): TrayMediaItem {
	return {
		id: item.id,
		name: item.name,
		previewUri: item.mediaType.startsWith("image/") ? item.uri : null,
		// The endpoint gives no progress events — indeterminate 50 while in
		// flight reads as "working" without pretending precision (web parity).
		uploading: item.status === "uploading" ? { percent: 50 } : undefined,
		error: item.status === "error" || undefined,
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

export function delegateAnswer(): AskUserOutput {
	return { delegated: true };
}

export function dismissAnswer(): AskUserOutput {
	return { dismissed: true };
}

function isPendingAsk(part: AskUserThreadPart) {
	return part.state === "input-streaming" || part.state === "input-available";
}

export type AskStepper = {
	/** Stable identity for this assistant step's question round. */
	roundKey: string | null;
	active: AskUserThreadPart | null;
	asks: AskUserThreadPart[];
	messageIndex: number;
	current: number;
	total: number;
};

const NO_ASKS: AskStepper = {
	roundKey: null,
	active: null,
	asks: [],
	messageIndex: -1,
	current: 0,
	total: 0,
};

/** Current-round rule: only asks after the final step-start in the final
 * assistant turn participate, and the oldest pending ask docks first. */
export function collectAskStepper(messages: ChatMessageLike[]): AskStepper {
	const messageIndex = messages.length - 1;
	const last = messages[messageIndex];
	if (last?.role !== "assistant") return NO_ASKS;

	let lastStepStart = -1;
	for (const [index, value] of last.parts.entries()) {
		if (asMessagePart(value)?.type === "step-start") lastStepStart = index;
	}

	const asks = parseAskUserParts(last.parts).filter(
		(part) => part.index > lastStepStart,
	);
	if (asks.length === 0) return NO_ASKS;

	const answered = asks.filter((part) => !isPendingAsk(part)).length;
	return {
		roundKey: `${last.id}:${lastStepStart}`,
		active: asks.find(isPendingAsk) ?? null,
		asks,
		messageIndex,
		current: Math.min(answered + 1, asks.length),
		total: asks.length,
	};
}

export function findActiveAsk(
	messages: ChatMessageLike[],
): { part: AskUserThreadPart; messageIndex: number } | null {
	const stepper = collectAskStepper(messages);
	return stepper.active
		? { part: stepper.active, messageIndex: stepper.messageIndex }
		: null;
}

/** Card faces from every settled get_direction_candidates call, latest menu
    winning on id collisions. The taste question's options reference these by
    worldId — the specimen cards render from this server-authored data, never
    from model-written text. */
export function collectWorldCards(
	messages: ChatMessageLike[],
): Map<string, WorldCard> {
	const cards = new Map<string, WorldCard>();
	for (const message of messages) {
		for (const value of message.parts) {
			const part = asMessagePart(value);
			if (
				part?.type !== "tool-get_direction_candidates" ||
				part.state !== "output-available"
			) {
				continue;
			}
			const output = part.output;
			if (!output || typeof output !== "object") continue;
			const rawCards = (output as Record<string, unknown>).cards;
			if (!Array.isArray(rawCards)) continue;
			for (const rawCard of rawCards) {
				const parsed = worldCardSchema.safeParse(rawCard);
				if (parsed.success) cards.set(parsed.data.id, parsed.data);
			}
		}
	}
	return cards;
}

export function askAnswerValue(output: AskUserOutput): string {
	return (
		output.text ??
		output.label ??
		output.selections?.map((selection) => selection.label).join(" · ") ??
		""
	);
}

export function useRequestTray({
	messages,
	composerText,
	enabled = true,
	onAnswer,
}: {
	messages: ChatMessageLike[];
	composerText: string;
	enabled?: boolean;
	onAnswer: (toolCallId: string, output: AskUserOutput) => void;
}) {
	const { t } = useTranslation();
	const stepper = useMemo(
		() => (enabled ? collectAskStepper(messages) : NO_ASKS),
		[enabled, messages],
	);
	const worldCards = useMemo(
		() =>
			enabled ? collectWorldCards(messages) : new Map<string, WorldCard>(),
		[enabled, messages],
	);
	// Dismiss is LOCAL and round-wide (web parity): the X hides the whole
	// question round without writing any tool output — the server repairs the
	// dangling calls on the next send. A NEW round (new roundKey) re-arms the
	// tray. Writing {dismissed:true} here would settle one ask and immediately
	// dock the next: four X-taps on a four-question turn, each recorded as
	// "Skipped".
	const [dismissedRoundKey, setDismissedRoundKey] = useState<string | null>(
		null,
	);
	const roundDismissed =
		stepper.roundKey !== null && stepper.roundKey === dismissedRoundKey;
	const active = roundDismissed ? null : stepper.active;
	const toolCallId = active?.toolCallId;
	const currentStep = stepper.current;
	const totalSteps = stepper.total;
	// The exiting tray stays mounted (~260ms) with callbacks frozen from the
	// render where the previous ask was still pending. The ref always names
	// the LIVE active call, so a stale closure no-ops instead of overwriting
	// an answer that already settled.
	const activeToolCallIdRef = useRef(toolCallId);
	useEffect(() => {
		activeToolCallIdRef.current = toolCallId;
	}, [toolCallId]);

	// Choice drafts live above the bodies so the composer CTA can validate and
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
	// choice drafts above.
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
	const attachIdRef = useRef(0);

	// One transient feedback line (camera permission, upload failure).
	const [notice, setNotice] = useState<string | null>(null);

	const askKind = useMemo(() => {
		if (!active) return "free-text";
		const options = active.input?.options ?? [];
		return (
			active.input?.kind ??
			(options.length === 0 ? "free-text" : "single-choice")
		);
	}, [active]);

	const allowedTypes = useMemo(
		() =>
			acceptedMediaTypes(
				active?.input?.accept ?? ["image"],
				active?.input?.mediaTypes,
			),
		[active],
	);
	const maxFiles = active?.input?.maxFiles ?? DEFAULT_MAX_FILES;

	const state = useMemo<RequestTrayState | null>(() => {
		if (!active) return null;
		const streaming = active.state === "input-streaming";
		const options: AskUserOption[] = active.input?.options ?? [];

		const allowsImages = [...allowedTypes].some((type) =>
			type.startsWith("image/"),
		);
		const allowsDocuments = [...allowedTypes].some(
			(type) => !type.startsWith("image/"),
		);

		// Taste cards: a single-choice ask whose options reference sampled
		// design worlds renders as specimen cards. Requires at least one
		// resolvable card — a transcript without menu cards (old chats, lost
		// menus) falls back to the plain chips.
		const worldOptions =
			askKind === "single-choice" &&
			options.some((option) => option.worldId && worldCards.has(option.worldId))
				? options.map((option) => ({
						id: option.id,
						label: option.label,
						card: option.worldId ? worldCards.get(option.worldId) : undefined,
					}))
				: null;

		// While the input is still streaming the options are half-parsed — show
		// the question growing with a spinner and no chips until input-available.
		const body: RequestTrayState["body"] = streaming
			? { kind: "free-text" }
			: askKind === "attachments"
				? {
						kind: "media-drop",
						items: attachItems.map(toMediaItem),
						sources: {
							camera: allowsImages,
							library: allowsImages,
							files: allowsDocuments,
						},
						canAddMore: attachItems.length < maxFiles,
					}
				: askKind === "multi-select"
					? { kind: "multi-select", options, selectedIds }
					: worldOptions
						? { kind: "world-pick", options: worldOptions, selectedId }
						: askKind === "single-choice"
							? { kind: "single-choice", options, selectedId }
							: { kind: "free-text" };

		return {
			badge: streaming
				? "spinner"
				: askKind === "attachments"
					? "media"
					: "question",
			label: streaming
				? t("native.workspace.chat.tray.preparing")
				: askKind === "attachments"
					? t("native.workspace.chat.tray.needsFiles")
					: t("native.workspace.chat.tray.needsDetail"),
			question: active.input?.question || undefined,
			helper: active.input?.helper,
			escape: { label: t("native.workspace.chat.tray.decideForMe") },
			body,
			step:
				totalSteps > 1
					? { current: currentStep, total: totalSteps }
					: undefined,
			// Typed text beats the chips / media drafts — only meaningful when
			// there IS a body to dim.
			typingOverride:
				composerText.trim().length > 0 &&
				((active.input?.options ?? []).length > 0 ||
					(!streaming && askKind === "attachments")),
		};
	}, [
		active,
		allowedTypes,
		askKind,
		attachItems,
		composerText,
		currentStep,
		maxFiles,
		selectedId,
		selectedIds,
		t,
		totalSteps,
		worldCards,
	]);

	const answer = useCallback(
		(output: AskUserOutput) => {
			// Only a fully-arrived ask may be answered; a stale closure captured
			// before a stepper advance must not overwrite the previous answer.
			if (!toolCallId || active?.state !== "input-available") return;
			if (toolCallId !== activeToolCallIdRef.current) return;
			onAnswer(toolCallId, output);
			setSinglePick(null);
			setMultiPicks(null);
			setAttachDrafts(null);
			setNotice(null);
		},
		[active, onAnswer, toolCallId],
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
				const ids = current?.toolCallId === toolCallId ? current.ids : [];
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

	/* ---------- attachment drafts ---------- */

	const runDraftUpload = useCallback(
		async (ownerToolCallId: string, item: AttachDraftItem) => {
			const patch = (changes: Partial<AttachDraftItem>) =>
				setAttachDrafts((current) =>
					current && current.toolCallId === ownerToolCallId
						? {
								...current,
								items: current.items.map((entry) =>
									entry.id === item.id ? { ...entry, ...changes } : entry,
								),
							}
						: current,
				);
			try {
				const uploaded = await uploadAttachment({
					name: item.name,
					type: item.mediaType as AttachmentMediaType,
					uri: item.uri,
				});
				patch({ status: "ready", uploaded });
			} catch (error: unknown) {
				patch({ status: "error" });
				setNotice(
					error instanceof AttachmentUploadError && error.reason === "too-large"
						? t("native.attach.tooLarge")
						: error instanceof AttachmentUploadError &&
								error.reason === "unsupported"
							? t("native.attach.unsupported")
							: t("native.attach.uploadFailed"),
				);
			}
		},
		[t],
	);

	const startDraftUploads = useCallback(
		(picked: PickedFile[]) => {
			// Narrow on state FIRST — a streaming input is DeepPartial.
			if (!toolCallId || active?.state !== "input-available") return;
			if (askKind !== "attachments") return;

			const existing =
				attachDraftsRef.current &&
				attachDraftsRef.current.toolCallId === toolCallId
					? attachDraftsRef.current.items
					: [];
			const room = maxFiles - existing.length;
			if (room <= 0) return;

			const next: AttachDraftItem[] = [];
			const uploads: AttachDraftItem[] = [];
			// The notice names the actual reason — a valid-type file over the
			// size cap must not be reported as an unsupported type.
			let rejection: string | null = null;
			for (const file of picked.slice(0, room)) {
				const mediaType = resolvePickedMediaType(file) ?? "";
				const unsupported = !allowedTypes.has(mediaType);
				const tooLarge = file.size !== null && file.size > ATTACHMENT_MAX_BYTES;
				const invalid = unsupported || tooLarge;
				if (invalid) {
					rejection = unsupported
						? t("native.attach.unsupported")
						: t("native.attach.tooLarge");
				}
				attachIdRef.current += 1;
				const item: AttachDraftItem = {
					id: `ask-attachment-${attachIdRef.current}`,
					uri: file.uri,
					name: file.filename ?? mediaType.split("/").at(-1) ?? "file",
					mediaType,
					status: invalid ? "error" : "uploading",
				};
				next.push(item);
				if (!invalid) uploads.push(item);
			}
			if (next.length === 0) return;

			setNotice(rejection);
			setAttachDrafts({ toolCallId, items: [...existing, ...next] });
			for (const item of uploads) {
				void runDraftUpload(toolCallId, item);
			}
		},
		[active, allowedTypes, askKind, maxFiles, runDraftUpload, t, toolCallId],
	);

	const onAttachCamera = useCallback(async () => {
		try {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission.granted) {
				setNotice(t("native.attach.cameraPermissionDenied"));
				return;
			}
			// quality < 1 forces a JPEG re-encode, which keeps HEIC captures
			// inside the server's magic-byte allowlist.
			const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
			if (result.canceled) return;
			startDraftUploads(
				result.assets.map((asset) => ({
					uri: asset.uri,
					filename: asset.fileName ?? null,
					mimeType: asset.mimeType ?? null,
					size: asset.fileSize ?? null,
				})),
			);
		} catch {
			setNotice(t("native.attach.uploadFailed"));
		}
	}, [startDraftUploads, t]);

	const onAttachLibrary = useCallback(async () => {
		try {
			const remaining = maxFiles - attachItems.length;
			if (remaining <= 0) return;
			const result = await ImagePicker.launchImageLibraryAsync({
				allowsMultipleSelection: true,
				mediaTypes: ["images"],
				// Compatible = PHPicker transcodes HEIC → JPEG, which the server's
				// magic-byte allowlist requires.
				preferredAssetRepresentationMode:
					ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
				selectionLimit: remaining,
			});
			if (result.canceled) return;
			startDraftUploads(
				result.assets.map((asset) => ({
					uri: asset.uri,
					filename: asset.fileName ?? null,
					mimeType: asset.mimeType ?? null,
					size: asset.fileSize ?? null,
				})),
			);
		} catch {
			setNotice(t("native.attach.uploadFailed"));
		}
	}, [attachItems.length, maxFiles, startDraftUploads, t]);

	const onAttachBrowse = useCallback(async () => {
		try {
			const result = await DocumentPicker.getDocumentAsync({
				copyToCacheDirectory: true,
				multiple: true,
				type: [...allowedTypes],
			});
			if (result.canceled) return;
			startDraftUploads(
				result.assets.map((asset) => ({
					uri: asset.uri,
					filename: asset.name ?? null,
					mimeType: asset.mimeType ?? null,
					size: asset.size ?? null,
				})),
			);
		} catch {
			setNotice(t("native.attach.uploadFailed"));
		}
	}, [allowedTypes, startDraftUploads, t]);

	const onRemoveAttachment = useCallback((id: string) => {
		setNotice(null);
		setAttachDrafts((current) =>
			current
				? {
						...current,
						items: current.items.filter((item) => item.id !== id),
					}
				: current,
		);
	}, []);

	/* ---------- the one confirm CTA ---------- */

	const onConfirmSingle = useCallback(() => {
		const option = (active?.input?.options ?? []).find(
			(candidate) => candidate.id === selectedId,
		);
		if (option) answer(pickAnswer(option));
	}, [active, answer, selectedId]);

	const onConfirmMulti = useCallback(() => {
		const options = active?.input?.options ?? [];
		const selections = options.filter((option) =>
			selectedIds.includes(option.id),
		);
		if (selections.length > 0) answer(multiAnswer(selections));
	}, [active, answer, selectedIds]);

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

	const answerFreeText = useCallback(
		(text: string) => answer(freeTextAnswer(text)),
		[answer],
	);
	const delegate = useCallback(() => answer(delegateAnswer()), [answer]);
	const dismiss = useCallback(() => {
		if (!active || !stepper.roundKey) return;
		setDismissedRoundKey(stepper.roundKey);
		setSinglePick(null);
		setMultiPicks(null);
		setAttachDrafts(null);
		setNotice(null);
	}, [active, stepper.roundKey]);

	// Typed text wins over any chip/upload draft — every answer mode confirms
	// through one CTA (the composer's send button).
	const trimmedComposerText = composerText.trim();
	const answerMode = trimmedComposerText
		? "text"
		: state?.body.kind === "single-choice" || state?.body.kind === "world-pick"
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
		answerFreeText,
		answerMode,
		canConfirm,
		onConfirmAttachments,
		onConfirmMulti,
		onConfirmSingle,
		trimmedComposerText,
	]);

	return {
		active: Boolean(active),
		answerable: active?.state === "input-available",
		toolCallId,
		state,
		notice,
		// Body interactivity, threaded through RequestTray → TrayBodySlot.
		onPick,
		multiSelectedIds: selectedIds,
		onToggleMulti,
		onAttachCamera,
		onAttachLibrary,
		onAttachBrowse,
		onRemoveAttachment,
		// The one confirm CTA (composer submitOverride).
		answerMode,
		canConfirm,
		selectedCount:
			answerMode === "single" ? (selectedId ? 1 : 0) : selectedIds.length,
		readyFileCount,
		confirmDraft,
		// Whole-ask actions.
		answerFreeText,
		delegate,
		dismiss,
	};
}
