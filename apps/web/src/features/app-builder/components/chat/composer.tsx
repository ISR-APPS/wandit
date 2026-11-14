/**
 * Prompt box of the builder chat, a white card: the request tray slot, the
 * chips of the preview picks, the files, and the long pastes, the textarea,
 * then the add menu (a file or an image), the Plan chip, the model menu, the
 * credit estimate, the context ring, dictation, and send. While the tray
 * shows, send becomes the answer pill of the tray.
 * Rendered by chat-pane.tsx. Calls `onSend` with the trimmed draft joined to
 * the pasted texts, and the uploaded files; a send that the API refuses puts
 * them back. Uploads and pastes go through the projects feature.
 */

import { ArrowUpIcon } from "@phosphor-icons/react/ArrowUp";
import { ArticleIcon } from "@phosphor-icons/react/Article";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { FileTextIcon } from "@phosphor-icons/react/FileText";
import { ImageIcon } from "@phosphor-icons/react/Image";
import { MicrophoneIcon } from "@phosphor-icons/react/Microphone";
import { PaperclipIcon } from "@phosphor-icons/react/Paperclip";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { StopIcon } from "@phosphor-icons/react/Stop";
import { XIcon } from "@phosphor-icons/react/X";
import {
	ATTACHMENT_MEDIA_TYPES,
	builderMessageMaxLength,
	type PreviewTarget,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Textarea } from "@wandit/ui/components/textarea";
import { cn } from "@wandit/ui/lib/utils";
import type { FileUIPart } from "ai";
import {
	type ChangeEvent,
	type ClipboardEvent,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { Spark } from "@/components/logo";
import {
	ATTACHMENT_ACCEPT,
	AttachmentUploadError,
	attachmentMaxBytesFor,
	describePastedText,
	joinPastedText,
	type PastedText,
	readLongPaste,
	uploadAttachment,
	useVoiceDictation,
} from "@/features/projects";
import { formatNumber, type TranslationKey, useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import type { ContextUsage } from "../../lib/turn-parts";
import type { BuilderModelPick } from "../../lib/use-builder-model-pick";
import { BuilderModelPicker, PROMPT_CHIP_CLASS } from "../builder-model-picker";
import { PlanModeToggle } from "../plan-mode-toggle";
import { IconAction } from "../shell/top-bar";
import { ContextRing } from "./context-ring";
import { TargetChip } from "./target-chip";

/**
 * The answer button that replaces the send circle while the request tray
 * shows. lib/use-request-tray.ts builds it.
 */
export type ComposerSubmitOverride = {
	/** Pill text, for example "Choose this option". */
	label: string;
	/** True while the answer is incomplete; the empty draft does not decide it. */
	disabled: boolean;
	/**
	 * Takes the current draft joined to the pasted texts. The composer clears
	 * both, and puts them back when this resolves false (the API refused the answer).
	 */
	onSubmit: (text: string) => Promise<boolean>;
};

export type ComposerProps = {
	/** Credits the next turn holds, whole credits, from the estimate route or the running turn. Null hides the text. */
	turnEstimateCredits: number | null;
	/** Elements picked in the preview for the next turn, in pick order. Each shows as a chip the user can remove. */
	targets: PreviewTarget[];
	/** Removes the target at this index of `targets`. */
	onRemoveTarget: (index: number) => void;
	/** True while a turn runs or the chat is not ready yet. Locks the textarea and the send button. */
	isSending: boolean;
	/** Sends the message. Resolves false when the API admitted no turn: the text, the files, and the pasted texts then come back. */
	onSend: (input: SendBuilderMessageInput) => Promise<boolean>;
	/** Content at the top of the card, above the textarea: the request tray. */
	topSlot?: ReactNode;
	/** Set while the request tray shows: Enter and the button answer the tray. */
	submitOverride?: ComposerSubmitOverride | null;
	/** Gets the trimmed draft joined to the pasted texts on each change; the tray reads the typed answer from it. */
	onDraftChange?: (text: string) => void;
	/** Textarea hint. chat-pane.tsx picks it from the Plan toggle and the open plan card. */
	placeholder: string;
	/** State of the Plan chip. The chip locks with the textarea while a turn runs, and hides while the tray shows. */
	isPlanMode: boolean;
	onPlanModeChange: (isPlanMode: boolean) => void;
	/** The model menu state of the project, from useBuilderModelPick on the page. The menu locks and hides like the Plan chip. */
	modelPick: BuilderModelPick;
	/** How full the model context is, from contextUsageOf through the chat pane. Null renders no ring: no turn wrote a count yet. The ring hides while the tray shows. */
	contextUsage: ContextUsage | null;
	/** Creates an empty conversation and opens it, from the page. The context ring offers it near the limit. */
	onCreateChat?: () => void;
};

/** The turn route takes at most 6 attachments per message (createTurnRequestSchema). */
const MAX_FILES = 6;

/** The image types of the upload allow-list, for the "Add an image" picker. */
const IMAGE_ACCEPT = ATTACHMENT_MEDIA_TYPES.filter((type) =>
	type.startsWith("image/"),
).join(",");

/** One file chip above the textarea. */
type ComposerFile = {
	/** Local id of the chip; the upload has no id before it answers. */
	id: string;
	/** Name of the file on the user's disk. */
	filename: string;
	/** Object URL of an image for the chip thumbnail; null for other files. */
	previewUrl: string | null;
	/** `uploading` until the upload answers. An `error` chip stays, so the user sees why, and is not sent. */
	status: "uploading" | "ready" | "error";
	/** The uploaded file as the turn sends it; null until `status` is `ready`. */
	part: FileUIPart | null;
	/** Why the upload failed; picks the chip text. Null unless `status` is `error`. */
	error: AttachmentUploadError["reason"] | null;
};

/** Chip text of each upload failure, shared with the dashboard prompt box. */
const UPLOAD_ERROR_KEYS: Record<
	AttachmentUploadError["reason"],
	TranslationKey
> = {
	unsupported: "projects.promptBox.attachments.unsupported",
	"too-large": "projects.promptBox.attachments.tooLarge",
	failed: "projects.promptBox.attachments.failed",
};

// The send circle and the answer pill share the ember face (shadow-ember).
// A press moves it down 1 px. Disabled is a flat navy tint, not a faded
// ember: a pale orange reads as "almost ready".
const SEND_CLASS =
	"rounded-full bg-primary text-primary-foreground shadow-ember transition-[background-color,box-shadow,translate] duration-150 hover:bg-ember-deep active:translate-y-px disabled:bg-night/10 disabled:text-night/35 disabled:opacity-100 disabled:shadow-none dark:hover:bg-primary/90 dark:disabled:bg-white/10 dark:disabled:text-foreground/35";

/**
 * The chat prompt box. Enter sends the trimmed draft joined to the pasted
 * texts, and the uploaded files. Shift+Enter adds a line. With `submitOverride` set, Enter and the pill
 * answer the tray.
 */
export function Composer({
	turnEstimateCredits,
	targets,
	onRemoveTarget,
	isSending,
	onSend,
	topSlot,
	submitOverride,
	onDraftChange,
	placeholder,
	isPlanMode,
	onPlanModeChange,
	modelPick,
	contextUsage,
	onCreateChat,
}: ComposerProps) {
	const { t, locale } = useTranslation();
	const [draft, setDraftState] = useState("");
	// The answer of a send comes after its render, so the restore reads the
	// draft and the pasted texts here. Dictation can write into the draft while the send waits.
	const draftRef = useRef("");
	const [pastedTexts, setPastedTextsState] = useState<PastedText[]>([]);
	const pastedTextsRef = useRef<PastedText[]>([]);
	const setDraft = (text: string) => {
		draftRef.current = text;
		setDraftState(text);
		onDraftChange?.(joinPastedText(text, pastedTextsRef.current));
	};
	const setPastedTexts = (next: PastedText[]) => {
		pastedTextsRef.current = next;
		setPastedTextsState(next);
		onDraftChange?.(joinPastedText(draftRef.current, next));
	};
	const [files, setFiles] = useState<ComposerFile[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	// The unmount cleanup reads the chips of the last render.
	const filesRef = useRef(files);
	useEffect(() => {
		filesRef.current = files;
	}, [files]);
	// The thumbnail URLs live until their chip goes; an unmount frees the rest.
	useEffect(
		() => () => {
			for (const file of filesRef.current) {
				if (file.previewUrl !== null) URL.revokeObjectURL(file.previewUrl);
			}
		},
		[],
	);

	const dictation = useVoiceDictation(
		// The hook calls the callback of the latest render, so `draft` is current.
		(text) => setDraft(draft ? `${draft.trimEnd()} ${text}` : text),
		{
			permissionDenied: t("projects.promptBox.micPermissionDenied"),
			transcribeError: t("projects.promptBox.micError"),
		},
	);

	const trimmed = draft.trim();
	const message = joinPastedText(draft, pastedTexts);
	const readyParts = files.flatMap((file) =>
		file.part === null ? [] : [file.part],
	);
	const isUploading = files.some((file) => file.status === "uploading");
	// The tray decides when its answer is complete: a picked chip answers with
	// an empty draft. A message waits for its uploads.
	const canSend = submitOverride
		? !submitOverride.disabled && !isSending
		: (message.length > 0 || readyParts.length > 0) &&
			!isUploading &&
			!isSending;
	// The tray answer pill needs the room of the ring, like the room of the Plan chip.
	const showsContextRing = contextUsage !== null && !submitOverride;
	const tooLongText = t("projects.promptBox.attachments.textTooLong", {
		max: formatNumber(builderMessageMaxLength, locale),
	});

	function updateFile(id: string, patch: Partial<ComposerFile>) {
		setFiles((current) =>
			current.map((file) => (file.id === id ? { ...file, ...patch } : file)),
		);
	}

	async function upload(id: string, file: File) {
		try {
			const uploaded = await uploadAttachment(file);
			updateFile(id, {
				status: "ready",
				part: {
					type: "file",
					url: uploaded.url,
					mediaType: uploaded.mediaType,
					filename: uploaded.filename,
				},
			});
		} catch (error) {
			// The chip shows the reason; the user removes it or picks the file again.
			updateFile(id, {
				status: "error",
				error: error instanceof AttachmentUploadError ? error.reason : "failed",
			});
		}
	}

	function addFiles(event: ChangeEvent<HTMLInputElement>) {
		const picked = Array.from(event.target.files ?? []).slice(
			0,
			Math.max(0, MAX_FILES - files.length),
		);
		// The same file can be picked again after its chip was removed.
		event.target.value = "";
		const added = picked.map((file) => {
			// Same per-type size limits as the server; a large file never uploads.
			const isTooLarge = file.size > attachmentMaxBytesFor(file.type);
			const chip: ComposerFile = {
				id: crypto.randomUUID(),
				filename: file.name,
				previewUrl: file.type.startsWith("image/")
					? URL.createObjectURL(file)
					: null,
				status: isTooLarge ? "error" : "uploading",
				part: null,
				error: isTooLarge ? "too-large" : null,
			};
			return { chip, file };
		});
		setFiles((current) => [...current, ...added.map((entry) => entry.chip)]);
		for (const { chip, file } of added) {
			if (chip.status === "uploading") void upload(chip.id, file);
		}
	}

	function removeFile(id: string) {
		const removed = files.find((file) => file.id === id);
		if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
		setFiles((current) => current.filter((file) => file.id !== id));
	}

	function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
		const text = readLongPaste(event);
		if (text === null) return;
		event.preventDefault();
		const next = [...pastedTextsRef.current, { id: crypto.randomUUID(), text }];
		// The turn route refuses a message over the limit, so the paste stops here.
		if (
			joinPastedText(draftRef.current, next).length > builderMessageMaxLength
		) {
			toast.error(tooLongText);
			return;
		}
		setPastedTexts(next);
	}

	function send() {
		if (!canSend) return;
		// The textarea can grow after the chips came, so the send checks the whole message again.
		if (message.length > builderMessageMaxLength) {
			toast.error(tooLongText);
			return;
		}
		const sentPastedTexts = pastedTexts;
		// The API refused the send. The typed text and the pasted texts come
		// back in front of the ones added while it waited.
		const restoreText = () => {
			setPastedTexts([...sentPastedTexts, ...pastedTextsRef.current]);
			setDraft(
				draftRef.current === "" ? trimmed : `${trimmed}\n${draftRef.current}`,
			);
		};
		if (submitOverride) {
			// The tray answer takes text only; the files wait for the next message.
			void submitOverride.onSubmit(message).then((isAccepted) => {
				if (!isAccepted) restoreText();
			});
		} else {
			const sentFiles = files;
			void onSend({ text: message, files: readyParts }).then((isAccepted) => {
				if (isAccepted) {
					revokePreviews(sentFiles);
					return;
				}
				// The files come back in front of the files added while it waited.
				const restoredFiles = [...sentFiles, ...filesRef.current];
				revokePreviews(restoredFiles.slice(MAX_FILES));
				setFiles(restoredFiles.slice(0, MAX_FILES));
				restoreText();
			});
			setFiles([]);
		}
		setPastedTexts([]);
		setDraft("");
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends. Shift+Enter, and Enter that ends an IME composition, insert a newline.
		if (
			event.key !== "Enter" ||
			event.shiftKey ||
			event.nativeEvent.isComposing
		) {
			return;
		}
		event.preventDefault();
		send();
	}

	const dictationLabel = t(
		dictation.isRecording
			? "projects.promptBox.micStop"
			: "appBuilder.chat.dictate",
	);

	return (
		// Three navy shadows lift the card: a contact line, a near shade, and a drop.
		// The drop ends inside the 16 px under the card, where the chat column clips.
		// The ember ring shows while any control of the card has focus.
		<div className="flex flex-col overflow-hidden rounded-[24px] border border-night/[0.08] bg-white shadow-[0_1px_1px_rgb(11_16_51/0.04),0_3px_8px_-3px_rgb(11_16_51/0.08),0_12px_24px_-16px_rgb(11_16_51/0.4)] transition-[box-shadow,border-color] duration-200 focus-within:border-ember/40 focus-within:ring-[3px] focus-within:ring-ember/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none dark:focus-within:border-spark/40 dark:focus-within:ring-spark/15">
			{topSlot}
			{/* The padding sits here, not on the card, so the tray reaches the card edges. */}
			<div className="flex flex-col px-3.5 pt-3.5 pb-3">
				{targets.length > 0 ? (
					<div className="mx-1 mb-1.5 flex flex-wrap gap-1.5">
						{targets.map((target, index) => (
							<TargetChip
								// One element can show twice with another text (a list item), so the key holds both.
								key={`${target.src}|${target.label}`}
								target={target}
								onRemove={() => onRemoveTarget(index)}
							/>
						))}
					</div>
				) : null}
				{files.length > 0 || pastedTexts.length > 0 ? (
					<div className="mx-1 mb-1.5 flex flex-wrap gap-1.5">
						{files.map((file) => (
							<FileChip
								key={file.id}
								file={file}
								onRemove={() => removeFile(file.id)}
							/>
						))}
						{pastedTexts.map((pasted) => (
							<PastedTextChip
								key={pasted.id}
								text={pasted.text}
								onRemove={() =>
									setPastedTexts(
										pastedTextsRef.current.filter(
											(entry) => entry.id !== pasted.id,
										),
									)
								}
							/>
						))}
					</div>
				) : null}
				{/* The kit textarea grows with its content (field-sizing), so no resize code here. */}
				<Textarea
					rows={1}
					// The turn route refuses a longer message or typed answer.
					maxLength={builderMessageMaxLength}
					dir="auto"
					value={draft}
					placeholder={placeholder}
					disabled={isSending}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					onPaste={onPaste}
					className="max-h-40 min-h-[52px] resize-none border-0 bg-transparent px-1 py-1.5 font-sans text-[15px] text-night leading-[1.5] caret-ember shadow-none placeholder:text-night/40 focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent dark:text-foreground dark:caret-spark dark:placeholder:text-foreground/40"
				/>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept={ATTACHMENT_ACCEPT}
					onChange={addFiles}
					className="hidden"
				/>
				<input
					ref={imageInputRef}
					type="file"
					multiple
					accept={IMAGE_ACCEPT}
					onChange={addFiles}
					className="hidden"
				/>
				{/* The row is a size container: the estimate reads the row width below. */}
				<div className="@container mt-1 flex items-center gap-1.5">
					<DropdownMenu>
						<IconAction label={t("appBuilder.chat.addContext")}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="icon-sm"
									disabled={files.length >= MAX_FILES}
									className={cn(
										PROMPT_CHIP_CLASS,
										"text-night dark:text-foreground",
									)}
								>
									<PlusIcon weight="bold" className="size-4" aria-hidden />
								</Button>
							</DropdownMenuTrigger>
						</IconAction>
						<DropdownMenuContent align="start" sideOffset={8} className="w-60">
							<DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
								<PaperclipIcon weight="duotone" aria-hidden />
								{t("appBuilder.chat.attach")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
								<ImageIcon weight="duotone" aria-hidden />
								{t("appBuilder.chat.attachImage")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* The tray answer pill needs this room. The answers keep the mode and the model; the skip X shows the chips again. */}
					{submitOverride ? null : (
						<>
							<PlanModeToggle
								isPlanMode={isPlanMode}
								onPlanModeChange={onPlanModeChange}
								disabled={isSending}
								// A row under 380 px shows only the icon, so the ring, dictation, and
								// send fit in the default 400 px column. The tooltip and the screen
								// reader still give the name.
								labelClassName="@max-[380px]:sr-only"
							/>
							<BuilderModelPicker pick={modelPick} disabled={isSending} />
						</>
					)}
					{/* The auto margin pushes the estimate, the ring, dictation, and send to the end of the row. */}
					<span className="ms-auto">
						{turnEstimateCredits !== null ? (
							<span
								className={cn(
									"items-center gap-1 whitespace-nowrap font-grotesk text-[12px] text-night/50 tabular-nums dark:text-foreground/50",
									// A row under 420 px cannot hold the estimate and the ring, so the ring shows alone.
									// A 420 px row is a chat column of about 498 px. The default 400 px column shows no estimate with the ring.
									// LIMIT: the row fits from a chat column of about 345 px (380 px with the Fast toggle). Upgrade: a larger CHAT_PANEL_MIN_WIDTH.
									showsContextRing ? "@min-[420px]:flex hidden" : "flex",
								)}
							>
								<Spark className="size-3 text-spark" />
								{t("appBuilder.chat.estimate", { count: turnEstimateCredits })}
							</span>
						) : null}
					</span>
					{showsContextRing ? (
						<ContextRing usage={contextUsage} onCreateChat={onCreateChat} />
					) : null}
					{dictation.supported ? (
						<IconAction label={dictationLabel}>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-pressed={dictation.isRecording}
								// A running recording must stay stoppable when a turn starts.
								disabled={
									dictation.isTranscribing ||
									(isSending && !dictation.isRecording)
								}
								onClick={dictation.toggle}
								className={cn(
									"rounded-full text-night/55 hover:bg-night/[0.06] hover:text-night dark:text-foreground/55 dark:hover:bg-white/[0.08] dark:hover:text-foreground",
									dictation.isRecording &&
										"text-destructive hover:text-destructive dark:text-destructive dark:hover:text-destructive",
								)}
							>
								{dictation.isTranscribing ? (
									<CircleNotchIcon
										weight="bold"
										className="size-[18px] animate-spin motion-reduce:animate-none"
										aria-hidden
									/>
								) : dictation.isRecording ? (
									<StopIcon weight="fill" className="size-4" aria-hidden />
								) : (
									<MicrophoneIcon
										weight="bold"
										className="size-[18px]"
										aria-hidden
									/>
								)}
							</Button>
						</IconAction>
					) : null}
					{submitOverride ? (
						<Button
							disabled={!canSend}
							onClick={send}
							className={cn(
								SEND_CLASS,
								"h-9 min-w-0 shrink gap-1.5 px-3.5 font-grotesk font-semibold text-[13px] has-[>svg]:px-3.5",
							)}
						>
							<CheckIcon weight="bold" className="size-3.5" aria-hidden />
							<span className="truncate">{submitOverride.label}</span>
						</Button>
					) : (
						<IconAction label={t("appBuilder.chat.send")}>
							<Button
								size="icon"
								disabled={!canSend}
								onClick={send}
								className={SEND_CLASS}
							>
								<ArrowUpIcon
									weight="bold"
									className="size-[18px]"
									aria-hidden
								/>
							</Button>
						</IconAction>
					)}
				</div>
			</div>
		</div>
	);
}

/** Frees the thumbnail URLs of chips that leave the composer for good. */
function revokePreviews(chips: readonly ComposerFile[]) {
	for (const chip of chips) {
		if (chip.previewUrl !== null) URL.revokeObjectURL(chip.previewUrl);
	}
}

/** One file of the next message: a thumbnail or a file icon, the name, the upload state, and a remove button. */
function FileChip({
	file,
	onRemove,
}: {
	file: ComposerFile;
	/** Drops the chip; the file is then not sent. */
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	const isError = file.status === "error";
	return (
		<span
			className={cn(
				"inline-flex h-9 max-w-full items-center gap-2 rounded-[12px] ps-1.5 pe-1 font-grotesk text-[12px]",
				isError
					? "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.14]"
					: "bg-night/[0.05] text-night dark:bg-white/[0.06] dark:text-foreground",
			)}
		>
			<span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-white text-night/50 dark:bg-white/[0.08] dark:text-foreground/50">
				{file.status === "uploading" ? (
					<CircleNotchIcon
						weight="bold"
						className="size-3 animate-spin motion-reduce:animate-none"
						aria-hidden
					/>
				) : file.previewUrl !== null ? (
					<img
						src={file.previewUrl}
						alt=""
						className="size-full object-cover"
					/>
				) : (
					<FileTextIcon weight="duotone" className="size-3.5" aria-hidden />
				)}
			</span>
			<span className="min-w-0">
				<span dir="auto" className="block max-w-36 truncate font-medium">
					{file.filename}
				</span>
				{file.status === "uploading" ? (
					<span className="block text-[10px] text-night/50 dark:text-foreground/50">
						{t("projects.promptBox.attachments.uploading")}
					</span>
				) : file.error !== null ? (
					<span className="block max-w-36 truncate text-[10px]">
						{t(UPLOAD_ERROR_KEYS[file.error])}
					</span>
				) : null}
			</span>
			<IconAction label={t("projects.promptBox.attachments.remove")}>
				<button
					type="button"
					onClick={onRemove}
					className="grid size-5 shrink-0 place-items-center rounded-full text-night/50 outline-none transition-colors hover:bg-night/[0.08] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/40 dark:text-foreground/50 dark:hover:bg-white/[0.1] dark:hover:text-foreground"
				>
					<XIcon weight="bold" className="size-3" aria-hidden />
				</button>
			</IconAction>
		</span>
	);
}

/** One long paste of the next message: an icon, the start of the text, its size, and a remove button. */
function PastedTextChip({
	text,
	onRemove,
}: {
	/** The full pasted text; the chip shows only its start. */
	text: string;
	/** Drops the chip; the text is then not sent. */
	onRemove: () => void;
}) {
	const { t, locale } = useTranslation();
	const { preview, size } = describePastedText(text, locale);
	return (
		<span className="inline-flex h-9 max-w-full items-center gap-2 rounded-[12px] bg-night/[0.05] ps-1.5 pe-1 font-grotesk text-[12px] text-night dark:bg-white/[0.06] dark:text-foreground">
			<span className="grid size-6 shrink-0 place-items-center rounded-[8px] bg-white text-night/50 dark:bg-white/[0.08] dark:text-foreground/50">
				<ArticleIcon weight="duotone" className="size-3.5" aria-hidden />
			</span>
			<span className="min-w-0">
				<span dir="auto" className="block max-w-36 truncate font-medium">
					{preview}
				</span>
				<span className="block text-[10px] text-night/50 dark:text-foreground/50">
					{t("projects.promptBox.attachments.pastedText", { size })}
				</span>
			</span>
			<IconAction label={t("projects.promptBox.attachments.remove")}>
				<button
					type="button"
					onClick={onRemove}
					className="grid size-5 shrink-0 place-items-center rounded-full text-night/50 outline-none transition-colors hover:bg-night/[0.08] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/40 dark:text-foreground/50 dark:hover:bg-white/[0.1] dark:hover:text-foreground"
				>
					<XIcon weight="bold" className="size-3" aria-hidden />
				</button>
			</IconAction>
		</span>
	);
}
