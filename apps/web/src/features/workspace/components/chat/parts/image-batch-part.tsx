// Compact, message-level presentation for two or more generate_image calls.
// Each queued attempt keeps its own durable poller, while the results share a
// single grid, announcement, Assets note, and navigable lightbox.

import type {
	ImageGenerationAspect,
	ImageGenerationAttempt,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, Images, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { imageGenerationDownloadUrl } from "../../../api/image-generations.services";
import { useSharedAiChat } from "../../../lib/ai-chat-context";
import {
	durableAiErrorPresentation,
	findToolAiError,
	toolOutputAiError,
} from "../../../lib/ai-error-copy";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { type ChatMediaGalleryItem, ChatMediaLightbox } from "./chat-media";
import {
	imageGenerationAspectClass,
	usePolledImageGenerationAttempt,
} from "./generate-image-part";

export type GenerateImageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_image" }
>;

type Translate = ReturnType<typeof useTranslation>["t"];

type ImmediateFailure = {
	message: string;
	retryWithPrompt: boolean;
};

type PreparedBatchAttempt = {
	aspect: ImageGenerationAspect | undefined;
	attemptId: string | undefined;
	count: number;
	immediateFailure: ImmediateFailure | undefined;
	key: string;
	prompt: string | undefined;
	title: string;
};

export type ImageBatchResolvedAttempt = PreparedBatchAttempt & {
	attempt?: ImageGenerationAttempt;
	isFetching?: boolean;
	statusLoadError?: boolean;
	retryStatus?: () => void;
};

type BatchAttemptFailure = {
	disabled: boolean;
	message: string;
	onRetry?: () => void;
};

type ImageBatchTile = {
	aspect: ImageGenerationAspect | undefined;
	caption: string;
	failure?: BatchAttemptFailure;
	image?: ChatMediaGalleryItem;
	key: string;
	state: "error" | "pending" | "ready";
};

export function ImageBatchPart({
	parts,
	messageParts,
}: {
	parts: GenerateImageToolPart[];
	messageParts?: WanditUIMessage["parts"];
}) {
	const { t } = useTranslation();
	const { prefillComposer } = useSharedAiChat();
	const attempts = parts.map((part) =>
		prepareBatchAttempt(part, messageParts, t),
	);

	if (attempts.length === 0) return null;

	return (
		<ResolveBatchAttempts
			attempts={attempts}
			index={0}
			resolved={[]}
			onPrefill={prefillComposer}
		/>
	);
}

function ResolveBatchAttempts({
	attempts,
	index,
	resolved,
	onPrefill,
}: {
	attempts: PreparedBatchAttempt[];
	index: number;
	resolved: ImageBatchResolvedAttempt[];
	onPrefill: (prompt: string) => void;
}) {
	const current = attempts[index];
	if (!current) {
		return <ImageBatchAttemptView attempts={resolved} onPrefill={onPrefill} />;
	}

	if (current.attemptId) {
		return (
			<PolledBatchAttempt
				attempts={attempts}
				attemptId={current.attemptId}
				current={current}
				index={index}
				resolved={resolved}
				onPrefill={onPrefill}
			/>
		);
	}

	return (
		<ResolveBatchAttempts
			attempts={attempts}
			index={index + 1}
			resolved={[...resolved, current]}
			onPrefill={onPrefill}
		/>
	);
}

function PolledBatchAttempt({
	attempts,
	attemptId,
	current,
	index,
	resolved,
	onPrefill,
}: {
	attempts: PreparedBatchAttempt[];
	attemptId: string;
	current: PreparedBatchAttempt;
	index: number;
	resolved: ImageBatchResolvedAttempt[];
	onPrefill: (prompt: string) => void;
}) {
	const query = usePolledImageGenerationAttempt(attemptId);

	return (
		<ResolveBatchAttempts
			attempts={attempts}
			index={index + 1}
			resolved={[
				...resolved,
				{
					...current,
					attempt: query.data,
					isFetching: query.isFetching,
					statusLoadError: Boolean(query.error),
					retryStatus: () => void query.refetch(),
				},
			]}
			onPrefill={onPrefill}
		/>
	);
}

/** Presentation split from polling so every transition can be covered without
 * replacing TanStack Query internals in component tests. */
export function ImageBatchAttemptView({
	attempts,
	onPrefill,
}: {
	attempts: ImageBatchResolvedAttempt[];
	onPrefill?: (prompt: string) => void;
}) {
	const { t } = useTranslation();
	const [lightboxImageKey, setLightboxImageKey] = useState<string | null>(null);
	const tiles = attempts.flatMap((attempt) =>
		buildAttemptTiles(attempt, t, onPrefill),
	);

	if (tiles.length === 0) return null;

	const lightboxItems = tiles.flatMap((tile) =>
		tile.image ? [tile.image] : [],
	);
	const lightboxIndex = lightboxImageKey
		? lightboxItems.findIndex((item) => item.key === lightboxImageKey)
		: -1;
	const ready = lightboxItems.length;
	const total = tiles.length;
	const pending = attempts.some((attempt) => !attemptIsSettled(attempt));
	const statusText = pending
		? t("workspace.chat.imageBatch.generating", { count: total })
		: ready === total
			? t("workspace.chat.imageBatch.ready", { count: total })
			: t("workspace.chat.imageBatch.readyCount", { ready, total });

	return (
		<>
			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{statusText}
			</span>
			<div
				aria-busy={pending}
				className="overflow-hidden rounded-[14px] border border-border bg-background p-3"
			>
				<div className="mb-2.5 flex min-w-0 items-center gap-2">
					<span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-secondary text-muted-foreground">
						{pending ? (
							<SpinnerArc className="size-3.5" />
						) : (
							<Images className="size-3.5" aria-hidden />
						)}
					</span>
					<p
						dir="auto"
						className="min-w-0 truncate font-medium text-[13.5px] text-foreground"
					>
						{statusText}
					</p>
				</div>

				<div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
					{tiles.map((tile) => (
						<ImageBatchTileView
							key={tile.key}
							tile={tile}
							onOpen={setLightboxImageKey}
						/>
					))}
				</div>

				<p className="mt-2 font-mono text-[10px] text-muted-foreground">
					{t("workspace.chat.generateImage.inAssetsTab")}
				</p>
			</div>

			{lightboxIndex >= 0 ? (
				<ChatMediaLightbox
					items={lightboxItems}
					index={lightboxIndex}
					onNavigate={(index) =>
						setLightboxImageKey(lightboxItems[index]?.key ?? null)
					}
					onClose={() => setLightboxImageKey(null)}
				/>
			) : null}
		</>
	);
}

function ImageBatchTileView({
	tile,
	onOpen,
}: {
	tile: ImageBatchTile;
	onOpen: (key: string) => void;
}) {
	const { t } = useTranslation();
	const frameClassName = cn(
		"relative mx-auto max-h-40 w-full overflow-hidden rounded-lg border border-border bg-secondary",
		imageGenerationAspectClass(tile.aspect),
		aspectMaxWidthClass(tile.aspect),
	);

	if (tile.image) {
		return (
			<button
				type="button"
				data-image-batch-tile="ready"
				aria-label={tile.image.label}
				onClick={() => onOpen(tile.image?.key ?? "")}
				className={cn("block cursor-zoom-in", frameClassName)}
			>
				<img
					src={tile.image.url}
					alt={tile.image.label}
					loading="lazy"
					decoding="async"
					className="absolute inset-0 block size-full object-cover"
				/>
				<TileCaption title={tile.caption} dark />
			</button>
		);
	}

	if (tile.state === "error") {
		return (
			<div
				data-image-batch-tile="error"
				className={cn(
					"flex flex-col justify-between border-destructive/25 bg-destructive/[0.035] p-2.5",
					frameClassName,
				)}
			>
				<p
					dir="auto"
					title={tile.caption}
					className="truncate font-medium text-[11px] text-foreground"
				>
					{tile.caption}
				</p>
				<div className="min-h-0 py-1 text-destructive">
					<AlertTriangle className="mb-1 size-3.5" aria-hidden />
					<p
						dir="auto"
						className="line-clamp-2 text-[10.5px] text-muted-foreground leading-tight"
					>
						{tile.failure?.message}
					</p>
				</div>
				{tile.failure?.onRetry ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-6 self-start px-1.5 text-[10.5px] text-muted-foreground"
						disabled={tile.failure.disabled}
						onClick={tile.failure.onRetry}
					>
						{tile.failure.disabled ? (
							<SpinnerArc className="size-3" />
						) : (
							<RefreshCw className="size-3" aria-hidden />
						)}
						{t("workspace.chat.generateImage.retry")}
					</Button>
				) : null}
			</div>
		);
	}

	return (
		<div data-image-batch-tile="pending" aria-hidden className={frameClassName}>
			<Skeleton className="absolute inset-0 size-full rounded-none" />
			<TileCaption title={tile.caption} />
		</div>
	);
}

function TileCaption({
	title,
	dark = false,
}: {
	title: string;
	dark?: boolean;
}) {
	return (
		<span
			dir="auto"
			title={title}
			className={cn(
				"absolute inset-x-0 bottom-0 truncate bg-gradient-to-t px-2 pt-4 pb-1.5 text-start font-medium text-[10.5px]",
				dark
					? "from-black/80 to-transparent text-white"
					: "from-background/90 to-transparent text-foreground",
			)}
		>
			{title}
		</span>
	);
}

function prepareBatchAttempt(
	part: GenerateImageToolPart,
	messageParts: WanditUIMessage["parts"] | undefined,
	t: Translate,
): PreparedBatchAttempt {
	const input = part.input;
	const title =
		typeof input?.title === "string" && input.title.trim()
			? input.title
			: t("workspace.chat.generateImage.generatingTitle");
	const prompt = typeof input?.prompt === "string" ? input.prompt : undefined;
	const prepared: PreparedBatchAttempt = {
		aspect: readAspect(input?.aspect),
		attemptId: undefined,
		count: readCount(input?.count),
		immediateFailure: undefined,
		key: part.toolCallId,
		prompt,
		title,
	};

	if (part.state === "output-error") {
		const normalized = findToolAiError(messageParts, part.toolCallId);
		if (normalized) {
			const copy = durableAiErrorPresentation(normalized, t);
			return {
				...prepared,
				immediateFailure: {
					message: copy.body,
					retryWithPrompt: copy.showRetry,
				},
			};
		}

		return {
			...prepared,
			immediateFailure: {
				message: t("workspace.chat.generateImage.failedToStart"),
				retryWithPrompt: false,
			},
		};
	}

	if (part.state !== "output-available") return prepared;

	const normalized = toolOutputAiError(part.output);
	if (normalized) {
		const copy = durableAiErrorPresentation(normalized, t);
		return {
			...prepared,
			immediateFailure: {
				message: copy.body,
				retryWithPrompt: copy.showRetry,
			},
		};
	}

	if (part.output.status === "queued" && part.output.attemptId) {
		return { ...prepared, attemptId: part.output.attemptId };
	}

	return {
		...prepared,
		immediateFailure: {
			message: part.output.message,
			retryWithPrompt: false,
		},
	};
}

function buildAttemptTiles(
	item: ImageBatchResolvedAttempt,
	t: Translate,
	onPrefill: ((prompt: string) => void) | undefined,
): ImageBatchTile[] {
	const attempt = item.attempt;
	const count = readCount(attempt?.count ?? item.count);
	const title = attempt?.title ?? item.title;
	const aspect = attempt?.aspect ?? item.aspect;
	const images = attempt?.images ?? [];
	const indexed = images.some((image) => image.index !== undefined);
	const missingSlots = Array.from(
		{ length: count },
		(_, index) => index + 1,
	).filter((slot) => !imageForSlot(images, indexed, slot));
	const failure = failureForAttempt(item, t, onPrefill);
	const firstFailedSlot = missingSlots[0];
	const settled = attemptIsSettled(item);

	return Array.from({ length: count }, (_, index) => {
		const slot = index + 1;
		const image = imageForSlot(images, indexed, slot);
		if (image && attempt) {
			const generationIndex = image.index ?? slot;
			return {
				aspect,
				caption: title,
				image: {
					downloadUrl: imageGenerationDownloadUrl(attempt.id, generationIndex),
					key: `${item.key}:${generationIndex}:${image.url}`,
					kind: "image",
					label: `${title} ${generationIndex}`,
					url: image.url,
				},
				key: `${item.key}:${slot}`,
				state: "ready" as const,
			};
		}

		if (settled) {
			return {
				aspect,
				caption: title,
				failure:
					slot === firstFailedSlot
						? failure
						: failure
							? { ...failure, onRetry: undefined }
							: undefined,
				key: `${item.key}:${slot}`,
				state: "error" as const,
			};
		}

		return {
			aspect,
			caption: title,
			key: `${item.key}:${slot}`,
			state: "pending" as const,
		};
	});
}

function failureForAttempt(
	item: ImageBatchResolvedAttempt,
	t: Translate,
	onPrefill: ((prompt: string) => void) | undefined,
): BatchAttemptFailure {
	if (item.statusLoadError) {
		return {
			disabled: Boolean(item.isFetching),
			message: t("workspace.chat.generateImage.statusLoadError"),
			onRetry: item.retryStatus,
		};
	}

	if (item.immediateFailure) {
		return {
			disabled: false,
			message: item.immediateFailure.message,
			onRetry:
				item.immediateFailure.retryWithPrompt && item.prompt && onPrefill
					? () => onPrefill(item.prompt as string)
					: undefined,
		};
	}

	if (item.attempt?.failure) {
		const copy = durableAiErrorPresentation(item.attempt.failure, t);
		return {
			disabled: false,
			message: copy.body,
			onRetry:
				copy.showRetry && onPrefill
					? () => onPrefill(item.attempt?.prompt ?? item.prompt ?? "")
					: undefined,
		};
	}

	return {
		disabled: false,
		message:
			item.attempt?.error ?? t("workspace.chat.generateImage.failedBody"),
	};
}

function attemptIsSettled(item: ImageBatchResolvedAttempt): boolean {
	if (item.immediateFailure || item.statusLoadError) return true;
	return (
		item.attempt?.status === "succeeded" || item.attempt?.status === "failed"
	);
}

function imageForSlot(
	images: NonNullable<ImageGenerationAttempt["images"]>,
	indexed: boolean,
	slot: number,
) {
	return indexed
		? images.find((image) => image.index === slot)
		: images[slot - 1];
}

function readCount(value: unknown): number {
	return typeof value === "number" && Number.isInteger(value)
		? Math.min(6, Math.max(1, value))
		: 1;
}

function readAspect(value: unknown): ImageGenerationAspect | undefined {
	switch (value) {
		case "1:1":
		case "2:3":
		case "3:2":
		case "4:3":
		case "4:5":
		case "9:16":
		case "16:9":
			return value;
		default:
			return undefined;
	}
}

function aspectMaxWidthClass(aspect: ImageGenerationAspect | undefined) {
	switch (aspect) {
		case "1:1":
			return "max-w-40";
		case "2:3":
			return "max-w-[6.667rem]";
		case "4:5":
			return "max-w-32";
		case "9:16":
			return "max-w-[5.625rem]";
		case "3:2":
			return "max-w-60";
		case "4:3":
			return "max-w-[13.333rem]";
		default:
			return "max-w-[17.778rem]";
	}
}
