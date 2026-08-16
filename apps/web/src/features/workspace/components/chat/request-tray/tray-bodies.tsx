// The twelve swappable answer bodies of the request tray (design 10b–10m).
// Each body renders ONLY the answer control — the question, header and escape
// hatch belong to the shell (request-tray.tsx). Single-choice and multi-select
// are LIVE: when the shell passes the ask_user callbacks (onPick / onToggle
// from use-request-tray.ts) they become controlled drafts. Confirmation lives
// in PromptBox's send-button position; without callbacks the bodies fall back
// to local state so design review still feels alive. Every other body stays
// display-only — those kinds activate in later slices. Chip/segment/card
// styling follows the design verbatim: parchment surfaces on the sand tray,
// ember for the one selected thing.

import { cn } from "@wandit/ui/lib/utils";
import {
	AlertCircle,
	CalendarDays,
	Camera,
	Check,
	ChevronLeft,
	ChevronRight,
	Clapperboard,
	FileText,
	ImageIcon,
	Info,
	Link2,
	Minus,
	Plus,
	X,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { SpinnerArc } from "./tray-signals";
import type { ChipOption, MediaItem, TrayBody, WorldCardOption } from "./types";
import { ensureWorldFontsLoaded } from "./world-fonts";

/** Callbacks the live plumbing threads in (use-request-tray.ts). All
    optional: absent = display-only preview behavior. */
export type TrayBodyCallbacks = {
	/** Single-choice: one tap updates the draft selected by the composer CTA. */
	onPick?: (option: ChipOption) => void;
	/** Multi-select: controlled selection confirmed by the composer CTA. */
	multiSelectedIds?: string[];
	onToggleMulti?: (id: string) => void;
	/** Attachments ask: files picked/dropped into the media-drop body — the
	    hook loops uploadAttachment() per file (endpoint takes one file). */
	onBrowseFiles?: (files: FileList) => void;
	/** Attachments ask: remove one drafted upload by its local id. */
	onRemoveAttachment?: (id: string) => void;
};

export function TrayBodySlot({
	body,
	callbacks,
}: {
	body: TrayBody;
	callbacks?: TrayBodyCallbacks;
}) {
	switch (body.kind) {
		case "free-text":
			return null; // 10b — the composer input is the answer, no body at all
		case "single-choice":
			return (
				<ChoiceChipsBody
					options={body.options}
					initial={body.selectedId}
					onPick={callbacks?.onPick}
				/>
			);
		case "multi-select":
			return (
				<MultiSelectBody
					options={body.options}
					initial={body.selectedIds}
					selectedIds={callbacks?.multiSelectedIds}
					onToggle={callbacks?.onToggleMulti}
				/>
			);
		case "segmented":
			return <SegmentedBody options={body.options} initial={body.selectedId} />;
		case "world-pick":
			return <WorldPickBody body={body} onPick={callbacks?.onPick} />;
		case "visual-pick":
			return <VisualPickBody body={body} />;
		case "media-drop":
			return <MediaDropBody body={body} callbacks={callbacks} />;
		case "file-drop":
			return <FileDropBody body={body} />;
		case "link":
			return <LinkBody body={body} />;
		case "amount":
			return <AmountBody body={body} />;
		case "datetime":
			return <DatetimeBody body={body} />;
		case "confirm":
			return <ConfirmBody body={body} />;
		case "connect":
			return <ConnectBody body={body} />;
	}
}

/* ---------- chips (10c single / 10d multi) ---------- */

function ChoiceChip({
	selected,
	withCheck = false,
	onClick,
	children,
}: {
	selected: boolean;
	withCheck?: boolean;
	onClick: () => void;
	children: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			className={cn(
				"flex items-center rounded-full border py-2 text-[13.5px] tracking-[-0.025em] transition-colors",
				selected
					? // The extra 0.5px outer shadow fakes the design's 1.5px ember
						// border without shifting layout against unselected siblings.
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

function ChoiceChipsBody({
	options,
	initial,
	onPick,
}: {
	options: { id: string; label: string }[];
	initial?: string;
	onPick?: (option: ChipOption) => void;
}) {
	// Local state only serves the display-only preview; live single-choice
	// drafts are controlled by the hook so the selected chip and composer CTA
	// stay in sync until confirmation.
	const [localId, setLocalId] = useState(initial);
	const selectedId = onPick ? initial : localId;
	return (
		<div className="flex flex-wrap gap-[7px]">
			{options.map((option) => (
				<ChoiceChip
					key={option.id}
					selected={option.id === selectedId}
					onClick={() => (onPick ? onPick(option) : setLocalId(option.id))}
				>
					{option.label}
				</ChoiceChip>
			))}
		</div>
	);
}

function MultiSelectBody({
	options,
	initial,
	selectedIds,
	onToggle,
}: {
	options: { id: string; label: string }[];
	initial?: string[];
	selectedIds?: string[];
	onToggle?: (id: string) => void;
}) {
	// Controlled when the live plumbing passes onToggle; local otherwise.
	const [localIds, setLocalIds] = useState<string[]>(initial ?? []);
	const picked = onToggle ? (selectedIds ?? []) : localIds;
	const toggle = (id: string) =>
		onToggle
			? onToggle(id)
			: setLocalIds((current) =>
					current.includes(id)
						? current.filter((item) => item !== id)
						: [...current, id],
				);
	return (
		<div className="flex flex-wrap gap-[7px]">
			{options.map((option) => (
				<ChoiceChip
					key={option.id}
					withCheck
					selected={picked.includes(option.id)}
					onClick={() => toggle(option.id)}
				>
					{option.label}
				</ChoiceChip>
			))}
		</div>
	);
}

/* ---------- segmented (10e) ---------- */

function SegmentedBody({
	options,
	initial,
}: {
	options: { id: string; label: string }[];
	initial?: string;
}) {
	const [selectedId, setSelectedId] = useState(initial);
	return (
		<div className="inline-flex gap-[3px] rounded-full border border-border bg-background p-[3px]">
			{options.map((option) => {
				const selected = option.id === selectedId;
				return (
					<button
						key={option.id}
						type="button"
						aria-pressed={selected}
						onClick={() => setSelectedId(option.id)}
						className={cn(
							"rounded-full px-[15px] py-1.5 text-[13px] tracking-[-0.025em] transition-colors",
							selected
								? "bg-primary font-medium text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

/* ---------- world pick (taste cards) ----------
   The design-world taste question. Each card is a SPECIMEN, not a screenshot:
   the world's sampleWord typed in its real display face on its real ground,
   three color dots, then the world's name and the Brain's one-line caption.
   Data comes from the sampled menu's server-authored cards — an option whose
   world didn't resolve renders a neutral card so the row never breaks. */

const WORLD_CARD_SCROLL_STEP = 176;
const WORLD_CARD_SCROLL_EPSILON = 2;

function WorldPickBody({
	body,
	onPick,
}: {
	body: Extract<TrayBody, { kind: "world-pick" }>;
	onPick?: (option: ChipOption) => void;
}) {
	const { dir, t } = useTranslation();
	// Local state only serves the display-only preview, same as the chips.
	const [localId, setLocalId] = useState(body.selectedId);
	const selectedId = onPick ? body.selectedId : localId;
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrollState, setScrollState] = useState({
		canScrollBack: false,
		canScrollForward: false,
		isRtl: false,
	});

	const fonts = body.options.flatMap((option) =>
		option.card ? [option.card.preview.fontFamily] : [],
	);
	const fontsKey = fonts.join(",");
	// One css2 request for the row's faces — never the whole library.
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
		const directionFrame =
			getComputedStyle(container).direction === dir
				? undefined
				: requestAnimationFrame(updateScrollState);
		container.addEventListener("scroll", updateScrollState, { passive: true });
		const observer = new ResizeObserver(updateScrollState);
		observer.observe(container);
		for (let index = 0; index < body.options.length; index++) {
			const card = container.children.item(index);
			if (card) observer.observe(card);
		}

		return () => {
			if (directionFrame !== undefined) cancelAnimationFrame(directionFrame);
			container.removeEventListener("scroll", updateScrollState);
			observer.disconnect();
		};
	}, [body.options.length, dir]);

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
						selected={option.id === selectedId}
						onClick={() =>
							onPick
								? onPick({ id: option.id, label: option.label })
								: setLocalId(option.id)
						}
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
						aria-label={t("workspace.chat.tray.scrollBack")}
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
						aria-label={t("workspace.chat.tray.scrollForward")}
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
				"w-[168px] shrink-0 overflow-hidden rounded-[14px] border bg-background text-start transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5",
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
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-dot swatch, order is the identity
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

/* ---------- visual pick (10f, 7a generating) ---------- */

function VisualPickBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "visual-pick" }>;
}) {
	const [selectedId, setSelectedId] = useState(body.selectedId);
	return (
		<div>
			<div className="flex gap-2">
				{body.options.map((option) =>
					option.pending ? (
						// Card still streaming in — shimmer swatch + skeleton caption.
						<div
							key={option.id}
							className="flex-1 overflow-hidden rounded-xl border border-border bg-background"
						>
							<div className="h-12 animate-shimmer bg-[length:180%_100%] bg-[linear-gradient(90deg,var(--border)_25%,var(--secondary)_50%,var(--border)_75%)]" />
							<div className="px-[9px] py-2">
								<div className="h-2 w-3/5 rounded-full bg-border" />
							</div>
						</div>
					) : (
						<button
							key={option.id}
							type="button"
							aria-pressed={option.id === selectedId}
							onClick={() => setSelectedId(option.id)}
							className={cn(
								"flex-1 overflow-hidden rounded-xl border bg-background text-start transition-[border-color,box-shadow]",
								option.id === selectedId
									? "border-primary shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.12)]"
									: "border-border hover:shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.08)]",
							)}
						>
							<span
								aria-hidden
								className="block h-12"
								style={{ background: option.preview }}
							/>
							<span className="flex items-center justify-between px-[9px] py-1.5 text-xs">
								<span
									className={
										option.id === selectedId
											? "text-foreground"
											: "text-muted-foreground"
									}
								>
									{option.label}
								</span>
								{option.id === selectedId ? (
									<Check className="size-3 text-ember-text" strokeWidth={3} />
								) : null}
							</span>
						</button>
					),
				)}
			</div>
			{body.hoverHint ? (
				<p className="mt-2 text-muted-foreground text-xs">{body.hoverHint}</p>
			) : null}
		</div>
	);
}

/* ---------- media drop (10g empty, 9b filled) ---------- */

function MediaDropBody({
	body,
	callbacks,
}: {
	body: Extract<TrayBody, { kind: "media-drop" }>;
	callbacks?: TrayBodyCallbacks;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const live = Boolean(callbacks?.onBrowseFiles);
	const openPicker = () => inputRef.current?.click();
	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer.files.length > 0) {
			callbacks?.onBrowseFiles?.(event.dataTransfer.files);
		}
	};
	const handleDragOver = (event: React.DragEvent) => event.preventDefault();
	const fileInput = live ? (
		<input
			ref={inputRef}
			type="file"
			multiple
			accept={body.accept}
			className="hidden"
			onChange={(event) => {
				if (event.target.files?.length) {
					callbacks?.onBrowseFiles?.(event.target.files);
				}
				// Reset so re-picking the same file fires onChange again.
				event.target.value = "";
			}}
		/>
	) : null;

	if (body.items?.length) {
		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is a pointer-only enhancement; the keyboard path is the "add more" button + file input
			<div
				className="flex items-start gap-2 overflow-x-auto"
				onDrop={live ? handleDrop : undefined}
				onDragOver={live ? handleDragOver : undefined}
			>
				{fileInput}
				{body.items.map((item) => (
					<MediaThumb
						key={item.id}
						item={item}
						onRemove={
							callbacks?.onRemoveAttachment
								? () => callbacks.onRemoveAttachment?.(item.id)
								: undefined
						}
					/>
				))}
				<button
					type="button"
					aria-label="Add more media"
					onClick={live ? openPicker : undefined}
					className="grid size-16 shrink-0 place-items-center rounded-[11px] border-[1.5px] border-stone border-dashed text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
				>
					<Plus className="size-4" />
				</button>
			</div>
		);
	}

	return (
		<div>
			{fileInput}
			{/* The whole pane is a drop target in the real flow — this zone is the
			    visible affordance. */}
			<button
				type="button"
				onClick={live ? openPicker : undefined}
				onDrop={live ? handleDrop : undefined}
				onDragOver={live ? handleDragOver : undefined}
				className="w-full cursor-pointer rounded-[14px] border-[1.5px] border-primary/45 border-dashed bg-primary/4 px-3.5 pt-[15px] pb-[13px] text-center transition-colors hover:bg-primary/8"
			>
				<span className="mb-2 flex items-center justify-center gap-2">
					<span className="grid size-9 place-items-center rounded-[10px] border border-border bg-background text-muted-foreground">
						<ImageIcon className="size-4" />
					</span>
					<span className="grid size-9 place-items-center rounded-[10px] border border-border bg-background text-muted-foreground">
						<Clapperboard className="size-4" />
					</span>
				</span>
				<span className="block font-medium text-[13.5px] text-foreground">
					{body.title}
				</span>
				{body.browseLabel || body.formatsHint ? (
					<span className="mt-0.5 block text-muted-foreground text-xs">
						{body.browseLabel ? (
							<span className="text-ember-text underline underline-offset-2">
								{body.browseLabel}
							</span>
						) : null}
						{body.browseLabel && body.formatsHint ? " · " : null}
						{body.formatsHint}
					</span>
				) : null}
			</button>
			{body.tip ? (
				<p className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
					<Info className="size-3 shrink-0" />
					{body.tip}
				</p>
			) : null}
		</div>
	);
}

function MediaThumb({
	item,
	onRemove,
}: {
	item: MediaItem;
	onRemove?: () => void;
}) {
	return (
		<div className="w-[86px] shrink-0">
			{item.uploading ? (
				<div className="relative h-16 overflow-hidden rounded-[11px] border border-border">
					<div className="absolute inset-0 animate-shimmer bg-[length:180%_100%] bg-[linear-gradient(90deg,var(--border)_25%,var(--secondary)_50%,var(--border)_75%)]" />
					<span className="absolute inset-0 grid place-items-center">
						<SpinnerArc />
					</span>
					<span className="absolute inset-x-1.5 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-black/10">
						<span
							className="block h-full rounded-full bg-primary"
							style={{ width: `${item.uploading.percent}%` }}
						/>
					</span>
				</div>
			) : (
				<div
					className={cn(
						"relative h-16 overflow-hidden rounded-[11px] border",
						item.error
							? "border-destructive/60 bg-destructive/10"
							: "border-border",
					)}
					style={item.error ? undefined : { background: item.preview }}
				>
					{item.error ? (
						<span className="absolute inset-0 grid place-items-center text-destructive">
							<AlertCircle className="size-4" />
						</span>
					) : null}
					{onRemove ? (
						<button
							type="button"
							aria-label={`Remove ${item.name}`}
							onClick={onRemove}
							className="absolute end-1 top-1 grid size-[18px] place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
						>
							<X className="size-2.5" strokeWidth={2.5} />
						</button>
					) : null}
				</div>
			)}
			<p
				dir="auto"
				className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground"
			>
				{item.name}
			</p>
		</div>
	);
}

/* ---------- file / document (10h, 10p) ---------- */

function FileDropBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "file-drop" }>;
}) {
	const Icon = body.icon === "image" ? ImageIcon : FileText;
	return (
		<div className="flex cursor-pointer items-center gap-[11px] rounded-[13px] border-[1.5px] border-stone border-dashed px-[13px] py-[11px] transition-colors hover:border-primary/60">
			<span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border border-border bg-background text-muted-foreground">
				<Icon className="size-4" />
			</span>
			<span className="min-w-0">
				<span className="block text-[13.5px] text-foreground">
					{body.prompt}
					{body.browse ? (
						<>
							{" or "}
							<span className="text-ember-text underline underline-offset-2">
								browse
							</span>
						</>
					) : null}
				</span>
				{body.formatsHint ? (
					<span className="mt-0.5 block text-muted-foreground text-xs">
						{body.formatsHint}
					</span>
				) : null}
			</span>
		</div>
	);
}

/* ---------- link (10i, invalid = 10n state 5) ---------- */

function LinkBody({ body }: { body: Extract<TrayBody, { kind: "link" }> }) {
	return (
		<div>
			<div
				className={cn(
					"flex items-center gap-[9px] rounded-xl border bg-background px-3 py-[9px]",
					body.error ? "border-destructive/40" : "border-border",
				)}
			>
				<Link2 className="size-3.5 shrink-0 text-muted-foreground" />
				<span
					className={cn(
						"min-w-0 flex-1 truncate font-mono text-[13.5px]",
						body.error ? "text-destructive" : "text-foreground",
					)}
				>
					{body.value}
				</span>
				{body.error ? (
					<AlertCircle className="size-3.5 shrink-0 text-destructive" />
				) : (
					<button
						type="button"
						className="h-6 shrink-0 rounded-full bg-secondary px-2.5 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
					>
						Paste
					</button>
				)}
			</div>
			{body.verified ? (
				<div className="mt-2 flex items-center gap-2 rounded-[10px] border border-success/25 bg-success/9 px-[11px] py-[7px]">
					<span className="grid size-4 shrink-0 place-items-center rounded-full bg-success/16">
						<Check className="size-2.5 text-success" strokeWidth={2.5} />
					</span>
					<span className="min-w-0 truncate text-[12.5px] text-success-text">
						{body.verified}
					</span>
				</div>
			) : null}
			{body.error ? (
				<p className="mt-1.5 text-destructive text-xs">{body.error}</p>
			) : null}
		</div>
	);
}

/* ---------- amount (10j) ---------- */

function AmountBody({ body }: { body: Extract<TrayBody, { kind: "amount" }> }) {
	return (
		<div>
			<div className="flex flex-wrap items-center gap-2.5">
				<div className="flex items-center overflow-hidden rounded-xl border-[1.5px] border-primary bg-background shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.10)]">
					<button
						type="button"
						aria-label="Decrease"
						className="grid h-[38px] w-8 place-items-center text-muted-foreground transition-colors hover:text-foreground"
					>
						<Minus className="size-3.5" />
					</button>
					<span className="min-w-16 text-center font-medium font-mono text-[15px] text-foreground tabular-nums">
						{body.value}
					</span>
					<button
						type="button"
						aria-label="Increase"
						className="grid h-[38px] w-8 place-items-center text-muted-foreground transition-colors hover:text-foreground"
					>
						<Plus className="size-3.5" />
					</button>
				</div>
				<span className="font-mono text-muted-foreground text-xs">
					{body.unit}
				</span>
				<div className="ms-auto flex gap-1.5">
					{body.quickValues.map((value) => (
						<button
							key={value}
							type="button"
							className="rounded-full border border-border bg-background px-3 py-[7px] text-[12.5px] text-foreground tabular-nums transition-colors hover:bg-accent"
						>
							{value}
						</button>
					))}
				</div>
			</div>
			{body.hint ? (
				<p className="mt-2 text-muted-foreground text-xs">{body.hint}</p>
			) : null}
		</div>
	);
}

/* ---------- date & time (10k) ---------- */

function DatetimeBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "datetime" }>;
}) {
	const [selectedId, setSelectedId] = useState(body.selectedId);
	return (
		<div>
			<div className="flex flex-wrap items-center gap-[7px]">
				{body.presets.map((preset) => (
					<ChoiceChip
						key={preset.id}
						selected={preset.id === selectedId}
						onClick={() => setSelectedId(preset.id)}
					>
						{preset.label}
					</ChoiceChip>
				))}
				{body.pickLabel ? (
					<button
						type="button"
						className="flex items-center gap-1.5 rounded-full border border-border bg-background px-[15px] py-2 text-[13.5px] text-muted-foreground tracking-[-0.025em] transition-colors hover:bg-accent hover:text-foreground"
					>
						<CalendarDays className="size-3.5 shrink-0" />
						{body.pickLabel}
					</button>
				) : null}
			</div>
			{body.hint ? (
				<p className="mt-2 text-muted-foreground text-xs">{body.hint}</p>
			) : null}
		</div>
	);
}

/* ---------- confirmation (10l) ---------- */

function ConfirmBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "confirm" }>;
}) {
	return (
		<div className="flex gap-2">
			<button
				type="button"
				className="flex-1 rounded-full bg-primary py-[9px] font-medium text-[13.5px] text-primary-foreground shadow-[0_2px_8px_-2px_rgb(0_0_0/0.3)] transition-opacity hover:opacity-90"
			>
				{body.confirmLabel}
			</button>
			<button
				type="button"
				className="flex-1 rounded-full border border-border bg-background py-[9px] text-[13.5px] text-foreground transition-colors hover:bg-accent"
			>
				{body.cancelLabel}
			</button>
		</div>
	);
}

/* ---------- connect (10m) ---------- */

function ConnectBody({
	body,
}: {
	body: Extract<TrayBody, { kind: "connect" }>;
}) {
	return (
		<button
			type="button"
			className="flex w-full items-center justify-center gap-[9px] rounded-full bg-foreground py-2.5 font-medium text-[13.5px] text-background transition-opacity hover:opacity-90"
		>
			<Camera className="size-4" />
			{body.buttonLabel}
		</button>
	);
}
