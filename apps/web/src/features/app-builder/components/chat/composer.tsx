/**
 * Prompt box of the builder chat: the request tray slot on top, the file
 * chips, growing textarea, the add context menu (a file or an image),
 * the credit estimate of the next turn, dictation, and the send button.
 * While the tray shows, the send button becomes the tray's answer button.
 * Rendered by chat-pane.tsx. Calls `onSend` with the trimmed draft and the
 * uploaded files; the pane runs the mutation. Uploads go through the
 * projects feature, with the limits of the dashboard prompt box.
 */

import {
	ATTACHMENT_MEDIA_TYPES,
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
	ArrowUp,
	Check,
	FileText,
	ImageIcon,
	Loader2,
	Mic,
	Paperclip,
	Plus,
	Square,
	X,
} from "lucide-react";
import {
	type ChangeEvent,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	ATTACHMENT_ACCEPT,
	AttachmentUploadError,
	attachmentMaxBytesFor,
	uploadAttachment,
	useVoiceDictation,
} from "@/features/projects";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";

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
	/** True while a turn runs or the chat is not ready yet. Locks the textarea and the send button. */
	isSending: boolean;
	onSend: (input: SendBuilderMessageInput) => void;
	/** Content at the top of the card, above the textarea: the request tray. */
	topSlot?: ReactNode;
	/** Set while the request tray shows: Enter and the button answer the tray. */
	submitOverride?: ComposerSubmitOverride | null;
	/** Gets every draft change; the tray reads the typed answer from it. */
	onDraftChange?: (text: string) => void;
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

/** Round pill of the add context trigger. Ember on hover, a soft halo while open. */
const PILL_CLASS =
	"rounded-full border-border bg-transparent shadow-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/35 hover:bg-primary/10 hover:text-foreground data-[state=open]:border-primary/40 data-[state=open]:text-foreground data-[state=open]:ring-[3px] data-[state=open]:ring-primary/10";

export function Composer({
	turnEstimateCredits,
	isSending,
	onSend,
	topSlot,
	submitOverride,
	onDraftChange,
}: ComposerProps) {
	const { t } = useTranslation();
	const [draft, setDraftState] = useState("");
	const setDraft = (text: string) => {
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
			onSend({ text: trimmed, files: readyParts });
			for (const file of files) {
				if (file.previewUrl !== null) URL.revokeObjectURL(file.previewUrl);
			}
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

	return (
		<div className="group/prompt relative">
			{/* Soft ember ring while the textarea has focus. The card below carries the one rich shadow. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.12)] transition-opacity duration-300 group-focus-within/prompt:opacity-100"
			/>
			<div className="relative flex flex-col overflow-hidden rounded-3xl bg-background shadow-composer dark:border dark:bg-card dark:shadow-[0_18px_40px_-20px_rgb(0_0_0_/_0.6)]">
				{topSlot}
				{/* The padding sits here, not on the card, so the tray reaches the card edges. */}
				<div className="flex flex-col px-4 pt-3.5 pb-3">
					{files.length > 0 ? (
						<div className="mb-2 flex flex-wrap gap-1.5">
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
						placeholder={t("appBuilder.chat.placeholder")}
						disabled={isSending}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={onKeyDown}
						className="max-h-40 min-h-[38px] resize-none border-0 bg-transparent px-0 py-1.5 text-[15px] leading-[1.5] shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent"
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
					<div className="mt-1.5 flex items-center gap-1.5">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="icon-sm"
									aria-label={t("appBuilder.chat.addContext")}
									disabled={files.length >= MAX_FILES}
									className={PILL_CLASS}
								>
									<Plus />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="rounded-2xl p-1.5">
								<DropdownMenuItem
									onSelect={() => fileInputRef.current?.click()}
								>
									<Paperclip />
									{t("appBuilder.chat.attach")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => imageInputRef.current?.click()}
								>
									<ImageIcon />
									{t("appBuilder.chat.attachImage")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						{turnEstimateCredits !== null ? (
							<span className="ms-auto text-muted-foreground text-xs">
								{t("appBuilder.chat.estimate", { count: turnEstimateCredits })}
							</span>
						) : (
							<span className="ms-auto" />
						)}
						{dictation.supported ? (
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t(
									dictation.isRecording
										? "projects.promptBox.micStop"
										: "appBuilder.chat.dictate",
								)}
								aria-pressed={dictation.isRecording}
								// A running recording must stay stoppable when a turn starts.
								disabled={
									dictation.isTranscribing ||
									(isSending && !dictation.isRecording)
								}
								onClick={dictation.toggle}
								className={cn(
									"rounded-full text-muted-foreground hover:text-foreground",
									dictation.isRecording && "text-destructive",
								)}
							>
								{dictation.isTranscribing ? (
									<Loader2 className="animate-spin motion-reduce:animate-none" />
								) : dictation.isRecording ? (
									<Square />
								) : (
									<Mic />
								)}
							</Button>
						) : null}
						{submitOverride ? (
							// The V1 answer pill: same ember gradient as the send circle, with a label.
							<Button
								size="sm"
								disabled={!canSend}
								onClick={send}
								className="h-8 gap-1.5 rounded-full bg-gradient-ember px-3 text-background shadow-[0_2px_8px_-2px_rgb(0_0_0_/_0.3)] transition-opacity hover:opacity-90 disabled:opacity-40"
							>
								<Check className="size-3.5" strokeWidth={2.4} aria-hidden />
								<span className="font-medium text-xs">
									{submitOverride.label}
								</span>
							</Button>
						) : (
							<Button
								size="icon-sm"
								aria-label={t("appBuilder.chat.send")}
								disabled={!canSend}
								onClick={send}
								// The send circle is the one control that carries the ember gradient.
								className="rounded-full bg-gradient-ember text-background shadow-[0_2px_8px_-2px_rgb(0_0_0_/_0.3)] transition-opacity hover:opacity-90 disabled:opacity-40"
							>
								<ArrowUp strokeWidth={2.2} />
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
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
				"inline-flex h-9 max-w-full items-center gap-2 rounded-xl border px-1.5 text-xs",
				isError
					? "border-destructive/40 bg-destructive/10 text-destructive"
					: "bg-muted/60",
			)}
		>
			<span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background text-muted-foreground">
				{file.status === "uploading" ? (
					<Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
				) : file.previewUrl !== null ? (
					<img
						src={file.previewUrl}
						alt=""
						className="size-full object-cover"
					/>
				) : (
					<FileText className="size-3" />
				)}
			</span>
			<span className="min-w-0">
				<span dir="auto" className="block max-w-36 truncate">
					{file.filename}
				</span>
				{file.status === "uploading" ? (
					<span className="block text-[10px] text-muted-foreground">
						{t("projects.promptBox.attachments.uploading")}
					</span>
				) : file.error !== null ? (
					<span className="block max-w-36 truncate text-[10px]">
						{t(UPLOAD_ERROR_KEYS[file.error])}
					</span>
				) : null}
			</span>
			<button
				type="button"
				aria-label={t("projects.promptBox.attachments.remove")}
				onClick={onRemove}
				className="grid size-5 place-items-center rounded-full outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<X className="size-3" />
			</button>
		</span>
	);
}
