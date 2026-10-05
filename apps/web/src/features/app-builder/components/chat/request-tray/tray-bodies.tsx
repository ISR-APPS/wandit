/**
 * The answer bodies of the request tray: option rows for a single choice or
 * a multi-select, design-world cards, and the image drop zone with
 * thumbnails. Each body renders only the answer control; request-tray.tsx
 * owns the question. lib/use-request-tray.ts controls every body through
 * `TrayBodyCallbacks`.
 */

import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { ImageIcon } from "@phosphor-icons/react/Image";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { XIcon } from "@phosphor-icons/react/X";
import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { IconAction } from "../../shell/top-bar";
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
				<div className="flex flex-col gap-1">
					{body.options.map((option) => (
						<OptionRow
							key={option.id}
							selected={option.id === body.selectedId}
							onClick={() => callbacks.onPick(option.id)}
						>
							{option.label}
						</OptionRow>
					))}
				</div>
			);
		case "multi-select":
			return (
				<div className="flex flex-col gap-1">
					{body.options.map((option) => (
						<OptionRow
							key={option.id}
							isMulti
							selected={body.selectedIds.includes(option.id)}
							onClick={() => callbacks.onToggle(option.id)}
						>
							{option.label}
						</OptionRow>
					))}
				</div>
			);
		case "world-pick":
			return <WorldPickBody body={body} onPick={callbacks.onPick} />;
		case "media-drop":
			return <MediaDropBody body={body} callbacks={callbacks} />;
	}
}

/**
 * One answer option as a 14 px-corner row. A picked row gets the spark tint.
 * A single choice shows an ember check at the end; a multi-select shows a
 * check box at the start, so the user sees that more than one row counts.
 */
function OptionRow({
	selected,
	isMulti = false,
	onClick,
	children,
}: {
	selected: boolean;
	/** True for a multi-select question. */
	isMulti?: boolean;
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
				"flex min-h-9 w-full items-center gap-2.5 rounded-[14px] border px-3 py-1.5 text-start font-grotesk font-medium text-[13.5px] leading-snug outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/30",
				selected
					? "border-spark/60 bg-spark/[0.14] text-night focus:bg-spark/20 dark:border-spark/50 dark:text-foreground"
					: "border-night/[0.07] bg-white text-night/80 hover:border-night/[0.12] hover:text-night dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-foreground/80 dark:hover:border-white/[0.14] dark:hover:text-foreground",
			)}
		>
			{isMulti ? (
				<span
					aria-hidden
					className={cn(
						"grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-150",
						selected
							? "border-primary bg-primary text-primary-foreground"
							: "border-night/25 dark:border-white/25",
					)}
				>
					{selected ? <CheckIcon weight="bold" className="size-3" /> : null}
				</span>
			) : null}
			<span className="min-w-0 flex-1">{children}</span>
			{!isMulti && selected ? (
				<CheckIcon
					weight="bold"
					aria-hidden
					className="size-4 shrink-0 text-primary"
				/>
			) : null}
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

	const BackChevron = scrollState.isRtl ? CaretRightIcon : CaretLeftIcon;
	const ForwardChevron = scrollState.isRtl ? CaretLeftIcon : CaretRightIcon;

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
						className="pointer-events-none absolute inset-y-0 -start-4 w-6 bg-gradient-to-r from-secondary to-transparent rtl:bg-gradient-to-l"
					/>
					<IconAction label={t("appBuilder.chat.tray.scrollBack")}>
						<button
							type="button"
							onClick={() => scrollByCard("back")}
							className="absolute -start-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-night/[0.08] bg-white text-night/60 shadow-menu transition-colors hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/30 dark:border-white/[0.1] dark:bg-popover dark:text-foreground/60 dark:hover:text-foreground"
						>
							<BackChevron weight="bold" aria-hidden className="size-3.5" />
						</button>
					</IconAction>
				</>
			) : null}
			{scrollState.canScrollForward ? (
				<>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 -end-4 w-6 bg-gradient-to-l from-secondary to-transparent rtl:bg-gradient-to-r"
					/>
					<IconAction label={t("appBuilder.chat.tray.scrollForward")}>
						<button
							type="button"
							onClick={() => scrollByCard("forward")}
							className="absolute -end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-night/[0.08] bg-white text-night/60 shadow-menu transition-colors hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/30 dark:border-white/[0.1] dark:bg-popover dark:text-foreground/60 dark:hover:text-foreground"
						>
							<ForwardChevron weight="bold" aria-hidden className="size-3.5" />
						</button>
					</IconAction>
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
				"w-[168px] shrink-0 overflow-hidden rounded-[14px] border bg-white text-start outline-none transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ember/30 motion-reduce:hover:translate-y-0 dark:bg-white/[0.04]",
				selected
					? "border-primary shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.14)]"
					: "border-night/[0.08] hover:shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.08)] dark:border-white/[0.08]",
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
			<span className="block border-night/[0.07] border-t px-3.5 py-2 dark:border-white/[0.07]">
				<span className="flex items-center justify-between gap-1.5">
					<span
						dir="auto"
						className="min-w-0 truncate font-grotesk font-semibold text-[13px] text-night dark:text-foreground"
					>
						{option.card?.name ?? option.label}
					</span>
					{selected ? (
						<CheckIcon
							weight="bold"
							aria-hidden
							className="size-3.5 shrink-0 text-primary"
						/>
					) : null}
				</span>
				{option.card ? (
					<span
						dir="auto"
						className="mt-0.5 line-clamp-2 block font-sans text-[11.5px] text-night/55 leading-[1.35] dark:text-foreground/55"
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
					<IconAction label={t("appBuilder.chat.tray.addMore")}>
						<button
							type="button"
							onClick={openPicker}
							className="grid size-16 shrink-0 place-items-center rounded-[14px] border-[1.5px] border-night/20 border-dashed text-night/50 transition-colors hover:border-primary/60 hover:text-night dark:border-white/20 dark:text-foreground/50 dark:hover:text-foreground"
						>
							<PlusIcon weight="bold" className="size-4" aria-hidden />
						</button>
					</IconAction>
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
				className="w-full cursor-pointer rounded-[16px] border-[1.5px] border-primary/40 border-dashed bg-white px-3.5 pt-4 pb-3.5 text-center outline-none transition-colors duration-150 hover:bg-spark/[0.08] focus-visible:ring-2 focus-visible:ring-ember/30 dark:bg-white/[0.03] dark:hover:bg-spark/[0.08]"
			>
				<span className="mb-2 flex items-center justify-center">
					<span className="grid size-10 place-items-center rounded-full bg-spark/[0.2] text-spark-deep dark:bg-spark/[0.16] dark:text-spark">
						<ImageIcon weight="duotone" className="size-5" aria-hidden />
					</span>
				</span>
				<span className="block font-grotesk font-semibold text-[14px] text-night dark:text-foreground">
					{t("appBuilder.chat.tray.dropTitle")}
				</span>
				<span className="mt-0.5 block font-sans text-[12px] text-night/55 dark:text-foreground/55">
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
					"relative h-16 overflow-hidden rounded-[14px] border",
					item.hasError
						? "border-destructive/60 bg-destructive/10"
						: "border-night/[0.08] dark:border-white/[0.08]",
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
						<WarningCircleIcon weight="fill" className="size-5" aria-hidden />
					</span>
				) : null}
				<IconAction label={removeLabel}>
					<button
						type="button"
						onClick={onRemove}
						className="absolute end-1 top-1 grid size-[18px] place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
					>
						<XIcon weight="bold" className="size-2.5" aria-hidden />
					</button>
				</IconAction>
			</div>
			<p
				dir="auto"
				className="mt-1 truncate font-mono text-[10.5px] text-night/50 dark:text-foreground/50"
			>
				{item.name}
			</p>
		</div>
	);
}
