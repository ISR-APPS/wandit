// Renders a persisted AI SDK v7 `type: "file"` part (contract §10.4): user
// attachments (initial message or mid-conversation) whose `url` is a public
// R2 asset. Images show as a small rounded thumbnail, video/audio use inline
// controls, and other files use a quiet filename chip. Display-only — the
// canonical file lives in R2.

import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	FileSpreadsheet,
	FileText,
	ImageOff,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";

const SPREADSHEET_MEDIA_TYPES = new Set([
	"text/csv",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

type FilePartData = {
	type: "file";
	mediaType: string;
	filename?: string;
	url: string;
};

export type ChatFileMediaKind = "video" | "audio";

export type ResilientChatImageState = "loading" | "loaded" | "failed";

/** Image state is URL-scoped so a replacement URL retries automatically. */
export function getResilientChatImageState(
	url: string,
	loadedImageUrl: string | null,
	failedImageUrl: string | null,
): ResilientChatImageState {
	if (url === failedImageUrl) return "failed";
	if (url === loadedImageUrl) return "loaded";
	return "loading";
}

function filePartLabel(part: FilePartData): string {
	return part.filename ?? part.url.split("/").at(-1) ?? "file";
}

function FileChip({
	part,
	Icon,
	ariaLabel,
}: {
	part: FilePartData;
	Icon: LucideIcon;
	ariaLabel?: string;
}) {
	return (
		<a
			href={part.url}
			target="_blank"
			rel="noreferrer"
			aria-label={ariaLabel}
			className="inline-flex h-8 max-w-64 items-center gap-2 rounded-full border border-border bg-muted/60 px-3 text-muted-foreground text-xs transition-colors hover:text-foreground"
		>
			<Icon className="size-3.5 shrink-0" />
			<span dir="auto" className="min-w-0 truncate">
				{filePartLabel(part)}
			</span>
		</a>
	);
}

export function ResilientChatFileMediaView({
	part,
	kind,
	failed,
	onError,
}: {
	part: FilePartData;
	kind: ChatFileMediaKind;
	failed: boolean;
	onError?: () => void;
}) {
	if (failed) {
		return <FileChip part={part} Icon={FileText} />;
	}

	const label = filePartLabel(part);
	if (kind === "video") {
		return (
			<video
				key={part.url}
				src={part.url}
				controls
				preload="metadata"
				playsInline
				aria-label={label}
				onError={onError}
				className="block max-h-80 w-full max-w-xl rounded-xl border border-border bg-muted object-contain"
			>
				<track kind="captions" />
			</video>
		);
	}

	return (
		<audio
			key={part.url}
			src={part.url}
			controls
			preload="metadata"
			aria-label={label}
			onError={onError}
			className="block w-full max-w-xl"
		>
			<track kind="captions" />
		</audio>
	);
}

function ResilientChatFileMedia({
	part,
	kind,
}: {
	part: FilePartData;
	kind: ChatFileMediaKind;
}) {
	const [failedMediaUrl, setFailedMediaUrl] = useState<string | null>(null);

	return (
		<ResilientChatFileMediaView
			part={part}
			kind={kind}
			failed={failedMediaUrl === part.url}
			onError={() => setFailedMediaUrl(part.url)}
		/>
	);
}

export function ResilientChatImageView({
	part,
	variant = "single",
	state,
	onLoad,
	onError,
}: {
	part: FilePartData;
	variant?: "single" | "grid";
	state: ResilientChatImageState;
	onLoad?: () => void;
	onError?: () => void;
}) {
	const { t } = useTranslation();

	if (state === "failed") {
		return (
			<FileChip
				part={part}
				Icon={ImageOff}
				ariaLabel={`${t("workspace.chat.media.imageLoadError")}: ${filePartLabel(part)}`}
			/>
		);
	}

	return (
		<a
			href={part.url}
			target="_blank"
			rel="noreferrer"
			className={
				variant === "grid"
					? "relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted"
					: "relative block aspect-[6/5] w-48 max-w-full overflow-hidden rounded-xl border border-border bg-muted"
			}
		>
			{state === "loading" ? (
				<Skeleton className="absolute inset-0 size-full rounded-none" />
			) : null}
			<img
				key={part.url}
				src={part.url}
				alt={part.filename ?? ""}
				loading="lazy"
				onLoad={onLoad}
				onError={onError}
				className={`absolute inset-0 size-full object-cover ${
					state === "loaded" ? "opacity-100" : "opacity-0"
				}`}
			/>
		</a>
	);
}

export function ResilientChatImage({
	part,
	variant = "single",
}: {
	part: FilePartData;
	variant?: "single" | "grid";
}) {
	const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
	const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
	const state = getResilientChatImageState(
		part.url,
		loadedImageUrl,
		failedImageUrl,
	);

	return (
		<ResilientChatImageView
			part={part}
			variant={variant}
			state={state}
			onLoad={() => setLoadedImageUrl(part.url)}
			onError={() => setFailedImageUrl(part.url)}
		/>
	);
}

export function ImageFileThumbnail({
	part,
	variant = "single",
}: {
	part: FilePartData;
	variant?: "single" | "grid";
}) {
	return <ResilientChatImage part={part} variant={variant} />;
}

export function ImageFileGrid({ parts }: { parts: FilePartData[] }) {
	if (parts.length === 1) {
		return (
			<div className="flex justify-end">
				<ImageFileThumbnail part={parts[0]} />
			</div>
		);
	}
	const urlOccurrences = new Map<string, number>();

	return (
		<div className="flex justify-end">
			<div className="grid w-full max-w-[86%] grid-cols-2 gap-1.5">
				{parts.map((part) => {
					const occurrence = urlOccurrences.get(part.url) ?? 0;
					urlOccurrences.set(part.url, occurrence + 1);
					return (
						<ImageFileThumbnail
							key={`${part.url}:${occurrence}`}
							part={part}
							variant="grid"
						/>
					);
				})}
			</div>
		</div>
	);
}

export function FilePart({ part }: { part: FilePartData }) {
	if (part.mediaType.startsWith("image/")) {
		return <ImageFileGrid parts={[part]} />;
	}
	if (
		part.mediaType.startsWith("video/") ||
		part.mediaType.startsWith("audio/")
	) {
		return (
			<div className="flex w-full justify-end">
				<ResilientChatFileMedia
					part={part}
					kind={part.mediaType.startsWith("video/") ? "video" : "audio"}
				/>
			</div>
		);
	}

	const Icon = SPREADSHEET_MEDIA_TYPES.has(part.mediaType)
		? FileSpreadsheet
		: FileText;

	return (
		<div className="flex justify-end">
			<FileChip part={part} Icon={Icon} />
		</div>
	);
}
