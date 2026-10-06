/**
 * Prompt box of the builder chat, a white card: the request tray slot, the
 * chips of the preview picks and of the files, the textarea, then the add
 * menu (a file or an image), the Plan chip, the credit estimate, dictation,
 * and send. While the tray shows, send becomes the answer pill of the tray.
 * Rendered by chat-pane.tsx. Calls `onSend` with the trimmed draft and the
 * uploaded files; a send that the API refuses puts them back. Uploads go
 * through the projects feature, with the dashboard limits.
 */

import { ArrowUpIcon } from "@phosphor-icons/react/ArrowUp";
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
	type PreviewTarget,
	projectPromptMaxLength,
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
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import { Spark } from "@/components/logo";
import {
	ATTACHMENT_ACCEPT,
	AttachmentUploadError,
	attachmentMaxBytesFor,
	uploadAttachment,
	useVoiceDictation,
} from "@/features/projects";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import { PlanModeToggle } from "../plan-mode-toggle";
import { IconAction } from "../shell/top-bar";
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
	/** Takes the current draft; the composer clears the draft after the call. */
	onSubmit: (text: string) => void;
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
	/** Sends the message. Resolves false when the API admitted no turn: the text and the files then come back. */
	onSend: (input: SendBuilderMessageInput) => Promise<boolean>;
	/** Content at the top of the card, above the textarea: the request tray. */
	topSlot?: ReactNode;
	/** Set while the request tray shows: Enter and the button answer the tray. */
	submitOverride?: ComposerSubmitOverride | null;
	/** Gets every draft change; the tray reads the typed answer from it. */
	onDraftChange?: (text: string) => void;
	/** Textarea hint. chat-pane.tsx picks it from the Plan toggle and the open plan card. */
	placeholder: string;
	/** State of the Plan chip. The chip locks with the textarea while a turn runs, and hides while the tray shows. */
	isPlanMode: boolean;
	onPlanModeChange: (isPlanMode: boolean) => void;
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

// A soft navy chip that turns into a solid night pill (spark in dark mode)
// while its menu is open. A copy of HERO_CHIP_CLASS in
// features/projects/components/prompt-box.tsx, so the two prompt boxes match.
// The open look keys on aria-expanded: a tooltip on the same button overwrites data-state.
const CHIP_CLASS =
	"group/trigger rounded-full border-transparent bg-night/[0.05] font-grotesk font-medium text-night/75 shadow-none transition-colors duration-200 hover:bg-night/[0.09] hover:text-night aria-expanded:bg-night aria-expanded:text-paper dark:border-transparent dark:bg-white/[0.06] dark:text-foreground/75 dark:aria-expanded:bg-spark dark:aria-expanded:text-night dark:hover:bg-white/[0.1] dark:hover:text-foreground";

// The send circle and the answer pill share the ember face, with a soft
// ember (#d16022) glow. Disabled is a flat navy tint, not a faded ember: a
// pale orange reads as "almost ready".
const SEND_CLASS =
	"rounded-full bg-primary text-primary-foreground shadow-[0_1px_0_rgb(11_16_51/0.08),0_4px_12px_-4px_rgb(209_96_34/0.55)] transition-colors duration-150 hover:bg-ember-deep disabled:bg-night/10 disabled:text-night/35 disabled:opacity-100 disabled:shadow-none dark:hover:bg-primary/90 dark:disabled:bg-white/10 dark:disabled:text-foreground/35";

/**
 * The chat prompt box. Enter sends the trimmed draft and the uploaded files,
 * Shift+Enter adds a line. With `submitOverride` set, Enter and the pill
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
}: ComposerProps) {
	const { t } = useTranslation();
	const [draft, setDraftState] = useState("");
	// The answer of a send comes after its render, so the restore reads the
	// draft here. Dictation can write into it while the send waits.
	const draftRef = useRef("");
	const setDraft = (text: string) => {
		draftRef.current = text;
		setDraftState(text);
		onDraftChange?.(text);
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
	const readyParts = files.flatMap((file) =>
		file.part === null ? [] : [file.part],
	);
	const isUploading = files.some((file) => file.status === "uploading");
	// The tray decides when its answer is complete: a picked chip answers with
	// an empty draft. A message waits for its uploads.
	const canSend = submitOverride
		? !submitOverride.disabled && !isSending
		: (trimmed.length > 0 || readyParts.length > 0) &&
			!isUploading &&
			!isSending;

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

	function send() {
		if (!canSend) return;
		if (submitOverride) {
			// The tray answer takes text only; the files wait for the next message.
			submitOverride.onSubmit(trimmed);
		} else {
			const sentFiles = files;
			void onSend({ text: trimmed, files: readyParts }).then((isAccepted) => {
				if (isAccepted) {
					revokePreviews(sentFiles);
					return;
				}
				// The API refused the send. The message comes back in front of the
				// text and the files added while it waited.
				const restoredFiles = [...sentFiles, ...filesRef.current];
				revokePreviews(restoredFiles.slice(MAX_FILES));
				setFiles(restoredFiles.slice(0, MAX_FILES));
				setDraft(
					draftRef.current === "" ? trimmed : `${trimmed}\n${draftRef.current}`,
				);
			});
			setFiles([]);
		}
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
		// The ember ring shows while any control of the card has focus.
		<div className="flex flex-col overflow-hidden rounded-[22px] border border-night/[0.08] bg-white shadow-[0_1px_0_rgb(11_16_51/0.04),0_12px_32px_-20px_rgb(11_16_51/0.35)] transition-[box-shadow,border-color] duration-200 focus-within:border-ember/40 focus-within:ring-[3px] focus-within:ring-ember/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none dark:focus-within:border-spark/40 dark:focus-within:ring-spark/15">
			{topSlot}
			{/* The padding sits here, not on the card, so the tray reaches the card edges. */}
			<div className="flex flex-col px-3 pt-3 pb-2.5">
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
				{files.length > 0 ? (
					<div className="mx-1 mb-1.5 flex flex-wrap gap-1.5">
						{files.map((file) => (
							<FileChip
								key={file.id}
								file={file}
								onRemove={() => removeFile(file.id)}
							/>
						))}
					</div>
				) : null}
				{/* The kit textarea grows with its content (field-sizing), so no resize code here. */}
				<Textarea
					rows={1}
					// The turn route refuses a longer message or typed answer.
					maxLength={projectPromptMaxLength}
					dir="auto"
					value={draft}
					placeholder={placeholder}
					disabled={isSending}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					className="max-h-40 min-h-[44px] resize-none border-0 bg-transparent px-1 py-1.5 font-sans text-[15px] text-night leading-[1.5] caret-ember shadow-none placeholder:text-night/40 focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent dark:text-foreground dark:caret-spark dark:placeholder:text-foreground/40"
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
				<div className="mt-1 flex items-center gap-1.5">
					<DropdownMenu>
						<IconAction label={t("appBuilder.chat.addContext")}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="icon-sm"
									disabled={files.length >= MAX_FILES}
									className={cn(CHIP_CLASS, "text-night dark:text-foreground")}
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
					{/* The tray answer pill needs this room. The answers keep the mode; the skip X shows the chip again. */}
					{submitOverride ? null : (
						<PlanModeToggle
							isPlanMode={isPlanMode}
							onPlanModeChange={onPlanModeChange}
							disabled={isSending}
						/>
					)}
					{turnEstimateCredits !== null ? (
						<span className="ms-auto flex items-center gap-1 whitespace-nowrap font-grotesk text-[12px] text-night/50 tabular-nums dark:text-foreground/50">
							<Spark className="size-3 text-spark" />
							{t("appBuilder.chat.estimate", { count: turnEstimateCredits })}
						</span>
					) : (
						<span className="ms-auto" />
					)}
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
