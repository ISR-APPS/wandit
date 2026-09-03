// Shared chat media policy: one media item renders as a single capped block,
// two or more render as a fixed-height horizontal filmstrip — never a wall of
// stacked full-width blocks, never a nested vertical scroll. Images open a
// fullscreen lightbox (arrows + download); videos play inline with controls.

import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { ChevronLeft, ChevronRight, Download, ImageOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";

export type ChatMediaGalleryItem = {
	key: string;
	kind: "image" | "video";
	url: string;
	/** Accessible description (alt text / aria-label). */
	label: string;
	/** Dedicated download endpoint; falls back to the media URL. */
	downloadUrl?: string;
};

export type ChatMediaImageStatus = "loading" | "loaded" | "failed";
export type ChatMediaImageVariant = "single" | "filmstrip" | "lightbox";

/** A failed request only replaces the exact URL that emitted the error. */
export function getChatMediaImageStatus(
	imageUrl: string,
	loadedImageUrl: string | null,
	failedImageUrl: string | null,
): ChatMediaImageStatus {
	if (failedImageUrl === imageUrl) return "failed";
	return loadedImageUrl === imageUrl ? "loaded" : "loading";
}

function imageFrameClassName(variant: ChatMediaImageVariant): string {
	if (variant === "single") {
		return "aspect-video min-h-40 max-h-80 w-full";
	}
	if (variant === "filmstrip") {
		return "h-52 min-w-52 w-auto max-w-80 shrink-0";
	}
	return "aspect-video max-h-full min-h-0 min-w-0 w-full max-w-5xl flex-1";
}

export function ChatMediaImageFallback({
	item,
	variant,
}: {
	item: ChatMediaGalleryItem;
	variant: ChatMediaImageVariant;
}) {
	const { t } = useTranslation();
	const errorLabel = t("workspace.chat.media.imageLoadError");

	return (
		<a
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${errorLabel}: ${item.label}`}
			className={cn(
				"pointer-events-auto relative flex flex-col items-center justify-center gap-1.5 overflow-hidden border border-border bg-muted px-4 text-center text-muted-foreground",
				imageFrameClassName(variant),
				variant === "lightbox" ? "rounded-lg shadow-2xl" : "rounded-[14px]",
			)}
		>
			<span className="flex min-w-0 max-w-full items-center gap-2">
				<ImageOff className="size-4 shrink-0" aria-hidden />
				<span className="truncate font-medium text-xs" title={item.label}>
					{item.label}
				</span>
			</span>
			<span className="text-[11px]">{errorLabel}</span>
		</a>
	);
}

export function ChatMediaImageView({
	item,
	variant,
	status,
	onLoad,
	onError,
	onOpen,
}: {
	item: ChatMediaGalleryItem;
	variant: ChatMediaImageVariant;
	status: ChatMediaImageStatus;
	onLoad?: () => void;
	onError?: () => void;
	onOpen?: () => void;
}) {
	if (status === "failed") {
		return <ChatMediaImageFallback item={item} variant={variant} />;
	}

	const content = (
		<>
			{status === "loading" ? (
				<Skeleton className="absolute inset-0 size-full rounded-none" />
			) : null}
			<img
				key={item.url}
				src={item.url}
				alt={item.label}
				loading={variant === "lightbox" ? "eager" : "lazy"}
				decoding="async"
				onLoad={onLoad}
				onError={onError}
				className={cn(
					variant === "filmstrip"
						? "relative block h-full w-auto min-w-52 max-w-80 object-cover"
						: "absolute inset-0 size-full object-contain",
					status === "loading" ? "opacity-0" : "opacity-100",
				)}
			/>
		</>
	);
	const frameClassName = cn(
		"relative overflow-hidden bg-secondary",
		imageFrameClassName(variant),
		variant === "lightbox"
			? "pointer-events-auto rounded-lg shadow-2xl"
			: "rounded-[14px] border border-border",
	);

	if (onOpen) {
		return (
			<button
				type="button"
				onClick={onOpen}
				aria-busy={status === "loading"}
				className={cn("cursor-zoom-in", frameClassName)}
			>
				{content}
			</button>
		);
	}

	return (
		<div aria-busy={status === "loading"} className={frameClassName}>
			{content}
		</div>
	);
}

function ResilientChatMediaImage({
	item,
	variant,
	onOpen,
}: {
	item: ChatMediaGalleryItem;
	variant: ChatMediaImageVariant;
	onOpen?: () => void;
}) {
	const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
	const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
	const status = getChatMediaImageStatus(
		item.url,
		loadedImageUrl,
		failedImageUrl,
	);

	return (
		<ChatMediaImageView
			item={item}
			variant={variant}
			status={status}
			onLoad={() => setLoadedImageUrl(item.url)}
			onError={() => setFailedImageUrl(item.url)}
			onOpen={onOpen}
		/>
	);
}

export function ChatMediaGallery({ items }: { items: ChatMediaGalleryItem[] }) {
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

	if (items.length === 0) return null;

	const single = items.length === 1;

	return (
		<>
			<div
				className={cn(
					single
						? "flex flex-col"
						: "flex gap-2 overflow-x-auto overscroll-x-contain pb-1",
				)}
			>
				{items.map((item, index) =>
					item.kind === "video" ? (
						<video
							key={item.key}
							src={item.url}
							controls
							preload="metadata"
							playsInline
							aria-label={item.label}
							className={cn(
								"rounded-[14px] border border-border bg-secondary",
								single
									? "block max-h-80 w-full object-contain"
									: "h-52 w-auto shrink-0 object-contain",
							)}
						>
							<track kind="captions" />
						</video>
					) : (
						<ResilientChatMediaImage
							key={item.key}
							item={item}
							variant={single ? "single" : "filmstrip"}
							onOpen={() => setLightboxIndex(index)}
						/>
					),
				)}
			</div>

			{lightboxIndex !== null && items[lightboxIndex] ? (
				<ChatMediaLightbox
					items={items}
					index={lightboxIndex}
					onNavigate={setLightboxIndex}
					onClose={() => setLightboxIndex(null)}
				/>
			) : null}
		</>
	);
}

// Exported for cards that open one media item full screen from their own
// chrome (generate_video's stage) — same overlay, focus and download rules.
export function ChatMediaLightbox({
	items,
	index,
	onNavigate,
	onClose,
}: {
	items: ChatMediaGalleryItem[];
	index: number;
	onNavigate: (index: number) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const item = items[index];
	const hasMany = items.length > 1;
	const dialogRef = useRef<HTMLDivElement | null>(null);

	const step = useCallback(
		(delta: number) => {
			onNavigate((index + delta + items.length) % items.length);
		},
		[index, items.length, onNavigate],
	);

	// Modal focus contract: focus moves INTO the dialog on open, back to the
	// opener on close, and Tab cycles inside — without this, keyboard focus
	// stays on the chat behind the overlay.
	useEffect(() => {
		const opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		dialogRef.current?.focus();
		return () => opener?.focus();
	}, []);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
				return;
			}

			if (event.key === "Tab") {
				const dialog = dialogRef.current;
				if (!dialog) return;
				const focusables = Array.from(
					dialog.querySelectorAll<HTMLElement>("a[href], button, video"),
				);
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				if (!first || !last) return;
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
				return;
			}

			if (!hasMany) return;
			if (event.key === "ArrowRight") step(1);
			if (event.key === "ArrowLeft") step(-1);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [hasMany, onClose, step]);

	if (!item) return null;

	return (
		<div
			ref={dialogRef}
			role="dialog"
			aria-modal="true"
			aria-label={item.label}
			tabIndex={-1}
			className="fixed inset-0 z-50 flex flex-col bg-foreground/75 outline-none backdrop-blur-sm"
		>
			<button
				type="button"
				aria-label={t("workspace.chat.media.close")}
				onClick={onClose}
				className="absolute inset-0 cursor-default"
			/>

			<div className="pointer-events-none relative z-10 flex items-center justify-end gap-2 p-3">
				<Button
					asChild
					size="sm"
					variant="secondary"
					className="pointer-events-auto h-8 gap-1.5 px-2.5 text-xs"
				>
					{/* download only forces a save for same-origin URLs; connector
					    media is cross-origin, so open a new tab instead of
					    navigating the workspace away. */}
					<a
						href={item.downloadUrl ?? item.url}
						download
						target="_blank"
						rel="noopener noreferrer"
					>
						<Download className="size-3.5" aria-hidden />
						{t("workspace.chat.media.download")}
					</a>
				</Button>
				<Button
					size="sm"
					variant="secondary"
					aria-label={t("workspace.chat.media.close")}
					onClick={onClose}
					className="pointer-events-auto size-8 p-0"
				>
					<X className="size-4" aria-hidden />
				</Button>
			</div>

			<div className="pointer-events-none relative z-10 flex min-h-0 flex-1 items-center justify-center gap-2 p-4 pt-0">
				{hasMany ? (
					<Button
						size="sm"
						variant="secondary"
						aria-label={t("workspace.chat.media.previous")}
						onClick={() => step(-1)}
						className="pointer-events-auto size-8 shrink-0 p-0"
					>
						<ChevronLeft className="size-4" aria-hidden />
					</Button>
				) : null}

				{item.kind === "video" ? (
					<video
						src={item.url}
						controls
						autoPlay
						playsInline
						aria-label={item.label}
						className="pointer-events-auto max-h-full min-h-0 max-w-full rounded-lg object-contain shadow-2xl"
					>
						<track kind="captions" />
					</video>
				) : (
					<ResilientChatMediaImage item={item} variant="lightbox" />
				)}

				{hasMany ? (
					<Button
						size="sm"
						variant="secondary"
						aria-label={t("workspace.chat.media.next")}
						onClick={() => step(1)}
						className="pointer-events-auto size-8 shrink-0 p-0"
					>
						<ChevronRight className="size-4" aria-hidden />
					</Button>
				) : null}
			</div>

			{hasMany ? (
				<p
					dir="ltr"
					className="pointer-events-none relative z-10 pb-3 text-center font-mono text-[11px] text-background/85"
				>
					{index + 1} / {items.length}
				</p>
			) : null}
		</div>
	);
}
