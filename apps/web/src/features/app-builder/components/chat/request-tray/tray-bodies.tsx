/**
 * The answer bodies of the request tray, copied from the V1 tray with its
 * look: choice chips, multi-select chips, design-world cards, and the image
 * drop zone with thumbnails. Each body renders only the answer control; the
 * shell (request-tray.tsx) owns the question. All bodies are controlled by
 * lib/use-request-tray.ts through `TrayBodyCallbacks`.
 */

import { cn } from "@wandit/ui/lib/utils";
import {
	AlertCircle,
	Check,
	ChevronLeft,
	ChevronRight,
	ImageIcon,
	Plus,
	X,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { SpinnerArc } from "./tray-signals";
import type { MediaItem, TrayBody, WorldCardOption } from "./types";
import { ensureWorldFontsLoaded } from "./world-fonts";

/** The answer wiring of the bodies, from lib/use-request-tray.ts. */
export type TrayBodyCallbacks = {
	/** Single choice and world card: one tap sets the picked option. */
	onPick: (optionId: string) => void;
	/** Multi-select: one tap adds or removes the option. */
	onToggle: (optionId: string) => void;
	/** Image question: the files the user picked or dropped. */
	onAddFiles: (files: readonly File[]) => void;
	/** Image question: removes one pick by its local id. */
	onRemoveFile: (id: string) => void;
};

/** The answer body for the kind of question; free text has none, the composer holds it. */
export function TrayBodySlot({
	body,
	callbacks,
}: {
	body: TrayBody;
	callbacks: TrayBodyCallbacks;
}) {
	switch (body.kind) {
		case "free-text":
			return null;
		case "single-choice":
			return (
				<div className="flex flex-wrap gap-[7px]">
					{body.options.map((option) => (
						<ChoiceChip
							key={option.id}
							selected={option.id === body.selectedId}
							onClick={() => callbacks.onPick(option.id)}
						>
							{option.label}
						</ChoiceChip>
					))}
				</div>
			);
		case "multi-select":
			return (
				<div className="flex flex-wrap gap-[7px]">
					{body.options.map((option) => (
						<ChoiceChip
							key={option.id}
							withCheck
							selected={body.selectedIds.includes(option.id)}
							onClick={() => callbacks.onToggle(option.id)}
						>
							{option.label}
						</ChoiceChip>
					))}
				</div>
			);
		case "world-pick":
			return <WorldPickBody body={body} onPick={callbacks.onPick} />;
		case "media-drop":
			return <MediaDropBody body={body} callbacks={callbacks} />;
	}
}

function ChoiceChip({
	selected,
	withCheck = false,
	onClick,
	children,
}: {
	selected: boolean;
	/** Multi-select chips show a check when selected. */
	withCheck?: boolean;
	onClick: () => void;
	children: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			dir="auto"
			className={cn(
				"flex items-center rounded-full border py-2 text-[13.5px] tracking-[-0.025em] transition-colors",
				selected
					? // The 0.5px outer shadow draws a thicker ember border without a layout shift.
						"border-primary bg-primary/8 font-medium text-foreground shadow-[0_0_0_0.5px_var(--primary)]"
					: "border-border bg-background text-foreground hover:bg-accent",
				withCheck && selected ? "gap-1.5 px-[13px]" : "px-[15px]",
			)}
		>
			{withCheck && selected ? (
				<Check
					className="size-[11px] shrink-0 text-ember-text"
					strokeWidth={3}
				/>
			) : null}
			{children}
		</button>
	);
}

/** One scroll step of the card row: one card (168px) plus the gap (8px). */
const WORLD_CARD_SCROLL_STEP = 176;
/** Scroll offsets under 2px count as the edge; browsers round sub-pixel scrolls. */
const WORLD_CARD_SCROLL_EPSILON = 2;

/**
 * The design-world question. Each card is a specimen: the world's sample
 * word in its display font on its ground color, three color dots, the
 * world name, and the agent's label. An option without a card shows a
 * neutral card.
 */
function WorldPickBody({
	body,
	onPick,
}: {
	body: Extract<TrayBody, { kind: "world-pick" }>;
	onPick: (optionId: string) => void;
}) {
	const { dir, t } = useTranslation();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrollState, setScrollState] = useState({
		canScrollBack: false,
		canScrollForward: false,
		isRtl: false,
	});

	const fontsKey = body.options
		.flatMap((option) => (option.card ? [option.card.preview.fontFamily] : []))
		.join(",");
	// One css2 request for the fonts of this row, never the whole library.
	useEffect(() => {
		ensureWorldFontsLoaded(fontsKey.split(",").filter(Boolean));
	}, [fontsKey]);

	useEffect(() => {
		const container = scrollRef.current;
		if (!container) return;

		const updateScrollState = () => {
			const maxScroll = Math.max(
				0,
				container.scrollWidth - container.clientWidth,
			);
			// RTL rows scroll with negative offsets, so the size of the offset counts.
			const scrollOffset = Math.abs(container.scrollLeft);
			const isOverflowing = maxScroll > WORLD_CARD_SCROLL_EPSILON;
			const nextState = {
				canScrollBack:
					isOverflowing && scrollOffset > WORLD_CARD_SCROLL_EPSILON,
				canScrollForward:
					isOverflowing && scrollOffset < maxScroll - WORLD_CARD_SCROLL_EPSILON,
				isRtl: getComputedStyle(container).direction === "rtl",
			};
			setScrollState((current) =>
				current.canScrollBack === nextState.canScrollBack &&
				current.canScrollForward === nextState.canScrollForward &&
				current.isRtl === nextState.isRtl
					? current
					: nextState,
			);
		};

		updateScrollState();
		// A direction change applies after the next frame; read the state again then.
		const directionFrame =
			getComputedStyle(container).direction === dir
				? undefined
				: requestAnimationFrame(updateScrollState);
		container.addEventListener("scroll", updateScrollState, { passive: true });
		const observer = new ResizeObserver(updateScrollState);
		observer.observe(container);
		return () => {
			if (directionFrame !== undefined) cancelAnimationFrame(directionFrame);
			container.removeEventListener("scroll", updateScrollState);
			observer.disconnect();
		};
	}, [dir]);

	const scrollByCard = (direction: "back" | "forward") => {
		const container = scrollRef.current;
		if (!container) return;
		const forwardSign =
			getComputedStyle(container).direction === "rtl" ? -1 : 1;
		container.scrollBy({
			left:
				(direction === "forward" ? forwardSign : -forwardSign) *
				WORLD_CARD_SCROLL_STEP,
			behavior: "smooth",
		});
	};

	const BackChevron = scrollState.isRtl ? ChevronRight : ChevronLeft;
	const ForwardChevron = scrollState.isRtl ? ChevronLeft : ChevronRight;

	return (
		<div className="relative">
			<div
				ref={scrollRef}
				className="-mx-[15px] flex gap-2 overflow-x-auto overscroll-x-contain px-[15px] pb-1 [scrollbar-width:none]"
			>
				{body.options.map((option) => (
					<WorldCardButton
						key={option.id}
						option={option}
						selected={option.id === body.selectedId}
						onClick={() => onPick(option.id)}
					/>
				))}
			</div>
			{scrollState.canScrollBack ? (
				<>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 -start-[15px] w-6 bg-gradient-to-r from-secondary to-transparent rtl:bg-gradient-to-l"
					/>
					<button
						type="button"
						aria-label={t("appBuilder.chat.tray.scrollBack")}
						onClick={() => scrollByCard("back")}
						className="absolute -start-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<BackChevron aria-hidden className="size-3.5" />
					</button>
				</>
			) : null}
			{scrollState.canScrollForward ? (
				<>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 -end-[15px] w-6 bg-gradient-to-l from-secondary to-transparent rtl:bg-gradient-to-r"
					/>
					<button
						type="button"
						aria-label={t("appBuilder.chat.tray.scrollForward")}
						onClick={() => scrollByCard("forward")}
						className="absolute -end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<ForwardChevron aria-hidden className="size-3.5" />
					</button>
				</>
			) : null}
		</div>
	);
}

function WorldCardButton({
	option,
	selected,
	onClick,
}: {
	option: WorldCardOption;
	selected: boolean;
	onClick: () => void;
}) {
	const preview = option.card?.preview;
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			className={cn(
				"w-[168px] shrink-0 overflow-hidden rounded-[14px] border bg-background text-start transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
				selected
					? "border-primary shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.14)]"
					: "border-border hover:shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.08)]",
			)}
		>
			<span
				aria-hidden
				className="flex h-[104px] flex-col justify-between px-3.5 pt-3 pb-3"
				style={{ background: preview ? preview.ground : "var(--accent)" }}
			>
				<span
					dir="auto"
					className="block overflow-hidden text-[24px] leading-[1.05]"
					style={
						preview
							? {
									color: preview.ink,
									fontFamily: `"${preview.fontFamily}", sans-serif`,
								}
							: { color: "var(--muted-foreground)" }
					}
				>
					{preview ? preview.sampleWord : "Aa"}
				</span>
				{preview ? (
					<span className="flex gap-1.5">
						{[preview.accent, preview.ink, preview.ground].map((dot, index) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed 3-dot swatch; the order is the identity
								key={index}
								className="size-3 rounded-full border border-black/10"
								style={{ background: dot }}
							/>
						))}
					</span>
				) : null}
			</span>
			<span className="block border-border border-t px-3.5 py-2">
				<span className="flex items-center justify-between gap-1.5">
					<span
						dir="auto"
						className="min-w-0 truncate font-medium text-[13px] text-foreground"
					>
						{option.card?.name ?? option.label}
					</span>
					{selected ? (
						<Check
							className="size-[11px] shrink-0 text-ember-text"
							strokeWidth={3}
						/>
					) : null}
				</span>
				{option.card ? (
					<span
						dir="auto"
						className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground leading-[1.35]"
					>
						{option.label}
					</span>
				) : null}
			</span>
		</button>
	);
}

/** The image question: a drop zone first, then thumbnails and an add tile. */
function MediaDropBody({
	body,
	callbacks,
}: {
	body: Extract<TrayBody, { kind: "media-drop" }>;
	callbacks: TrayBodyCallbacks;
}) {
	const { t } = useTranslation();
	const inputRef = useRef<HTMLInputElement>(null);
	const openPicker = () => inputRef.current?.click();
	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer.files.length > 0) {
			callbacks.onAddFiles(Array.from(event.dataTransfer.files));
		}
	};
	const handleDragOver = (event: React.DragEvent) => event.preventDefault();
	const fileInput = (
		<input
			ref={inputRef}
			type="file"
			multiple
			accept={body.accept}
			className="hidden"
			onChange={(event) => {
				if (event.target.files?.length) {
					callbacks.onAddFiles(Array.from(event.target.files));
				}
				// A reset lets the user pick the same file again.
				event.target.value = "";
			}}
		/>
	);

	if (body.items.length > 0) {
		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: drop is a pointer extra; the keyboard path is the add button and the file input
			<div
				className="flex items-start gap-2 overflow-x-auto"
				onDrop={handleDrop}
				onDragOver={handleDragOver}
			>
				{fileInput}
				{body.items.map((item) => (
					<MediaThumb
						key={item.id}
						item={item}
						removeLabel={t("appBuilder.chat.tray.removeFile", {
							name: item.name,
						})}
						errorLabel={t("appBuilder.chat.tray.fileFailed")}
						onRemove={() => callbacks.onRemoveFile(item.id)}
					/>
				))}
				{body.canAddMore ? (
					<button
						type="button"
						aria-label={t("appBuilder.chat.tray.addMore")}
						onClick={openPicker}
						className="grid size-16 shrink-0 place-items-center rounded-[11px] border-[1.5px] border-stone border-dashed text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
					>
						<Plus className="size-4" />
					</button>
				) : null}
			</div>
		);
	}

	return (
		<div>
			{fileInput}
			<button
				type="button"
				onClick={openPicker}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				className="w-full cursor-pointer rounded-[14px] border-[1.5px] border-primary/45 border-dashed bg-primary/4 px-3.5 pt-[15px] pb-[13px] text-center transition-colors hover:bg-primary/8"
			>
				<span className="mb-2 flex items-center justify-center">
					<span className="grid size-9 place-items-center rounded-[10px] border border-border bg-background text-muted-foreground">
						<ImageIcon className="size-4" />
					</span>
				</span>
				<span className="block font-medium text-[13.5px] text-foreground">
					{t("appBuilder.chat.tray.dropTitle")}
				</span>
				<span className="mt-0.5 block text-muted-foreground text-xs">
					<span className="text-ember-text underline underline-offset-2">
						{t("appBuilder.chat.tray.browse")}
					</span>
					{" · "}
					{t("appBuilder.chat.tray.imagesHint")}
				</span>
			</button>
		</div>
	);
}

function MediaThumb({
	item,
	removeLabel,
	errorLabel,
	onRemove,
}: {
	item: MediaItem;
	/** Accessible name of the remove button, for example "Remove logo.png". */
	removeLabel: string;
	/** Why the image failed: the one sentence for a refused type or size and a failed upload. */
	errorLabel: string;
	onRemove: () => void;
}) {
	return (
		<div className="w-[86px] shrink-0">
			<div
				className={cn(
					"relative h-16 overflow-hidden rounded-[11px] border",
					item.hasError
						? "border-destructive/60 bg-destructive/10"
						: "border-border",
				)}
				style={item.hasError ? undefined : { background: item.preview }}
			>
				{item.isUploading ? (
					<span className="absolute inset-0 grid place-items-center bg-background/60">
						<SpinnerArc />
					</span>
				) : null}
				{item.hasError ? (
					<span
						role="img"
						aria-label={errorLabel}
						title={errorLabel}
						className="absolute inset-0 grid place-items-center text-destructive"
					>
						<AlertCircle className="size-4" />
					</span>
				) : null}
				<button
					type="button"
					aria-label={removeLabel}
					onClick={onRemove}
					className="absolute end-1 top-1 grid size-[18px] place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
				>
					<X className="size-2.5" strokeWidth={2.5} />
				</button>
			</div>
			<p
				dir="auto"
				className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground"
			>
				{item.name}
			</p>
		</div>
	);
}
