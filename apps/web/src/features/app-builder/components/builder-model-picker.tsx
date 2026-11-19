/**
 * The model menu of a V2 prompt box: a chip with the effort tier, and a
 * popover card with a tier slider (Standard, High, Max, Nuclear), a Fast
 * toggle, and a reset. The thumb glides while the user drags it and snaps to
 * the nearest tier on release. The tier hint sits in an info tooltip.
 * The builder composer and the dashboard prompt box
 * (features/projects, through the barrel) render it. useBuilderModelPick owns
 * the state. helpers.ts holds the tiers and pairs a model with its Fast row.
 */

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { GaugeIcon } from "@phosphor-icons/react/Gauge";
import { InfoIcon } from "@phosphor-icons/react/Info";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Slider } from "@wandit/ui/components/slider";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	type AnimationPlaybackControls,
	animate as animateValue,
	motion,
	useReducedMotion,
} from "motion/react";
import { type KeyboardEvent, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import {
	BUILDER_TIERS,
	type BuilderTier,
	type BuilderTierId,
	builderTierOf,
	fastModelOf,
	visibleBuilderTiers,
} from "../lib/helpers";
import type { BuilderModelPick } from "../lib/use-builder-model-pick";
import { NuclearLaunchDialog } from "./nuclear-launch-dialog";

/** Props of the model menu. The caller wraps it in a TooltipProvider. */
export type BuilderModelPickerProps = {
	/** The menu state from useBuilderModelPick. Nothing renders while `pick.models` is undefined, or when no tier model is listed. */
	pick: BuilderModelPick;
	/** True while the prompt box cannot send, for example during a send. */
	disabled?: boolean;
	/** `md` is 36 px high, for the dashboard hero box. `sm` is 32 px, for the builder composer. */
	size?: "sm" | "md";
};

/**
 * A soft navy chip that turns into a solid night pill (spark in dark mode)
 * while its menu is open. chat/composer.tsx uses it for its menu chips too.
 * A copy of HERO_CHIP_CLASS in features/projects/components/prompt-box.tsx,
 * so the two prompt boxes match. The open look keys on aria-expanded: a
 * tooltip on the same button overwrites data-state.
 */
export const PROMPT_CHIP_CLASS =
	"group/trigger rounded-full border-transparent bg-night/[0.05] font-grotesk font-medium text-night/75 shadow-none transition-colors duration-200 hover:bg-night/[0.09] hover:text-night aria-expanded:bg-night aria-expanded:text-paper dark:border-transparent dark:bg-white/[0.06] dark:text-foreground/75 dark:aria-expanded:bg-spark dark:aria-expanded:text-night dark:hover:bg-white/[0.1] dark:hover:text-foreground";

/** Colors of one tier. The color heats up from Standard to Nuclear. */
type TierStyle = {
	/** Text color of the tier name, the chip gauge, and the active stop label. */
	text: string;
	/** Background of the blurred glow under the slider fill. */
	glow: string;
};

const TIER_STYLE: Record<BuilderTierId, TierStyle> = {
	standard: { text: "text-sky-600 dark:text-sky-400", glow: "bg-sky-400" },
	high: { text: "text-violet-600 dark:text-violet-400", glow: "bg-violet-500" },
	max: {
		text: "text-fuchsia-600 dark:text-fuchsia-400",
		glow: "bg-fuchsia-500",
	},
	nuclear: {
		text: "text-orange-600 dark:text-orange-400",
		glow: "bg-orange-500",
	},
};

// One gradient over the full track: the empty-track cover shows more of it, and hotter colors, at each tier.
const TRACK_GRADIENT_CLASS =
	"bg-[linear-gradient(90deg,var(--color-cyan-400),var(--color-blue-500)_18%,var(--color-violet-500)_36%,var(--color-fuchsia-500)_54%,var(--color-pink-500)_66%,var(--color-orange-500)_78%,var(--color-red-500)_87%,var(--color-amber-300)_95%,var(--color-yellow-50))]";

// The thumb class `size-5` is 20 px. The fill and the stop labels use this width to find the thumb center.
const THUMB_SIZE_PX = 20;

// Slider steps between two tiers while the user drags, so the thumb glides. A release snaps to the nearest tier.
const DRAG_STEPS_PER_TIER = 100;

// The snap after a release or a stop click. A stiff spring with high damping lands without a bounce.
const SNAP_SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;

// The kit slider draws a thin track and a small thumb. This card hides the track and draws its own layer behind it.
const SLIDER_CLASS =
	"h-5 [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_1px_6px_rgb(0_0_0/0.35)] [&_[data-slot=slider-track]]:bg-transparent";

// The keys that move the slider by one tier. Radix would move it by one drag step.
const TIER_KEY_DELTA: Partial<Record<string, number>> = {
	ArrowLeft: -1,
	ArrowDown: -1,
	PageDown: -1,
	ArrowRight: 1,
	ArrowUp: 1,
	PageUp: 1,
};

// Sparkles per tier step: the first tier shows 3, the last tier the most.
const SPARKLES_PER_TIER = 3;

// Fixed pseudo-random spots, so the sparkles do not jump on each render. 37 and 53 spread them without a visible pattern.
const SPARKLES = Array.from(
	{ length: SPARKLES_PER_TIER * BUILDER_TIERS.length },
	(_, index) => ({
		id: `sparkle-${index}`,
		/** Position along the filled part, 0 to 1. */
		along: ((index * 37) % 100) / 100,
		/** Top offset in the track, 20% to 80%. */
		topPercent: 20 + ((index * 53) % 60),
		/** Start delay in seconds, so the sparkles do not blink together. */
		delaySec: (index * 0.23) % 1,
	}),
);

/**
 * CSS offset of the thumb center at `fraction` (0 to 1) of the track. Radix
 * keeps the thumb inside the track, so the center runs from half a thumb to
 * the end minus half a thumb.
 */
function thumbCenterAt(fraction: number): string {
	return `calc(${fraction} * (100% - ${THUMB_SIZE_PX}px) + ${THUMB_SIZE_PX / 2}px)`;
}

/**
 * A chip that opens the tier card. The slider picks the tier model, and the
 * lightning toggle picks its Fast row when the server lists one. A pick
 * applies from the next send.
 */
export function BuilderModelPicker({
	pick,
	disabled = false,
	size = "sm",
}: BuilderModelPickerProps) {
	const { t } = useTranslation();
	const cardRef = useRef<HTMLDivElement>(null);
	const isReducedMotion = useReducedMotion() === true;
	// Thumb position in tier units (1.5 is halfway from High to Max) while it glides or snaps. Null rests on the picked tier.
	const [glideValue, setGlideValue] = useState<number | null>(null);
	const snapRef = useRef<AnimationPlaybackControls | null>(null);
	// Model id of a Nuclear pick that waits for the dialog answer. Null when no dialog is open.
	const [pendingNuclearModelId, setPendingNuclearModelId] = useState<
		string | null
	>(null);
	const models = pick.models;
	if (models === undefined) return null;
	const tiers = visibleBuilderTiers(models);
	const tier =
		pick.modelId === undefined
			? undefined
			: builderTierOf(models, pick.modelId);
	if (tier === undefined) return null;
	const baseTier = tiers[0] ?? tier;
	const tierIndex = tiers.indexOf(tier);
	// One listed tier still needs a track of length 1: Radix divides by max - min.
	const lastIndex = Math.max(tiers.length - 1, 1);
	const nuclearIndex = tiers.findIndex((stop) => stop.id === "nuclear");
	const nuclearModelId = tiers[nuclearIndex]?.modelId ?? tier.modelId;
	// While the dialog is open, the thumb rests on Nuclear, the stop the user picked.
	const restingIndex =
		pendingNuclearModelId === null ? tierIndex : nuclearIndex;
	const position = glideValue ?? restingIndex;
	const fraction = position / lastIndex;
	// The header, the colors, and the sparkles follow the nearest tier while the thumb moves.
	const shownTier = tiers[Math.round(position)] ?? tier;
	const shownIndex = tiers.indexOf(shownTier);
	const isNuclearShown = shownTier.id === "nuclear";
	const fastModel = fastModelOf(models, tier.modelId);
	const isFast = fastModel !== undefined && pick.modelId === fastModel.modelId;
	const isNuclear = tier.id === "nuclear";
	const tierStyle = TIER_STYLE[shownTier.id];
	const tierName = (id: BuilderTierId) =>
		t(`appBuilder.chat.model.tiers.${id}.name`);
	const tierHint = t(`appBuilder.chat.model.tiers.${shownTier.id}.hint`);
	// Product rule: users never see a model name. The label says the tier and, for a screen reader, Fast mode.
	const chipLabel = t(
		isFast ? "appBuilder.chat.model.chipFast" : "appBuilder.chat.model.chip",
		{ tier: tierName(tier.id) },
	);
	const resetLabel = t("appBuilder.chat.model.reset", {
		tier: tierName(baseTier.id),
	});
	const fillWidth = `(${fraction} * (100% - ${THUMB_SIZE_PX}px) + ${THUMB_SIZE_PX}px)`;
	// Sparkles drift faster at each tier: 2.6 s on Standard, 1.1 s on Nuclear.
	const sparkleDurationSec = 2.6 - 0.5 * shownIndex;

	// Glides the thumb from `from` to the tier `toIndex`. Reduced motion jumps at once.
	const snapTo = (from: number, toIndex: number) => {
		snapRef.current?.stop();
		if (isReducedMotion || from === toIndex) {
			setGlideValue(null);
			return;
		}
		snapRef.current = animateValue(from, toIndex, {
			...SNAP_SPRING,
			onUpdate: setGlideValue,
			onComplete: () => setGlideValue(null),
		});
	};

	const pickTier = (next: BuilderTier) => {
		if (next === tier) return;
		// Product rule: Fast mode stays on across a tier switch when the new tier has a Fast row.
		const nextFastModel = isFast
			? fastModelOf(models, next.modelId)
			: undefined;
		const nextModelId = nextFastModel?.modelId ?? next.modelId;
		// Product rule: Nuclear uses limits the fastest, so a switch to it waits for the dialog answer.
		if (next.id === "nuclear") {
			setPendingNuclearModelId(nextModelId);
			return;
		}
		pick.setModelId(nextModelId);
	};

	const confirmNuclear = () => {
		if (pendingNuclearModelId !== null) pick.setModelId(pendingNuclearModelId);
		setPendingNuclearModelId(null);
	};

	// The thumb glides back from Nuclear to the tier the user keeps.
	const cancelNuclear = () => {
		setPendingNuclearModelId(null);
		snapTo(nuclearIndex, tierIndex);
	};

	// Picks the tier `index` and glides the thumb there from `from`, in tier units.
	const moveToTier = (index: number, from: number) => {
		const next = tiers[index];
		if (next === undefined) return;
		pickTier(next);
		snapTo(from, index);
	};

	const moveByKey = (event: KeyboardEvent<HTMLSpanElement>) => {
		const delta = TIER_KEY_DELTA[event.key];
		if (delta === undefined) return;
		// preventDefault skips the Radix key handler, which moves one drag step, not one tier.
		event.preventDefault();
		const index = Math.min(Math.max(tierIndex + delta, 0), tiers.length - 1);
		moveToTier(index, position);
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					aria-label={chipLabel}
					className={cn(
						PROMPT_CHIP_CLASS,
						"min-w-0 shrink gap-1.5",
						// The kit `sm` size pads a button with an svg child through `has-[>svg]`, so the padding uses the same variant.
						size === "md"
							? "h-9 text-[13.5px] has-[>svg]:ps-3 has-[>svg]:pe-3"
							: "h-8 text-[13px] has-[>svg]:ps-2.5 has-[>svg]:pe-2.5",
					)}
				>
					<GaugeIcon
						weight="bold"
						className={cn("size-4 shrink-0", tierStyle.text)}
						aria-hidden
					/>
					<span className="min-w-0 truncate">{tierName(tier.id)}</span>
					{isFast ? (
						<LightningIcon
							weight="fill"
							className="size-3.5 shrink-0 text-amber-500"
							aria-hidden
						/>
					) : null}
					<CaretDownIcon
						weight="bold"
						className="size-3 shrink-0 transition-transform duration-200 group-aria-expanded/trigger:rotate-180 motion-reduce:transition-none"
						aria-hidden
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				ref={cardRef}
				align="start"
				collisionPadding={12}
				className="w-72"
				onOpenAutoFocus={(event) => {
					// The slider takes the focus, so the arrow keys move it at once and no header tooltip opens.
					event.preventDefault();
					cardRef.current
						?.querySelector<HTMLElement>('[role="slider"]')
						?.focus();
				}}
			>
				<div className="flex items-start gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							{/* aria-disabled, not disabled: a disabled button gets no hover, so its tooltip cannot say why. */}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={t("appBuilder.chat.model.fast")}
								aria-pressed={isFast}
								aria-disabled={fastModel === undefined}
								onClick={() => {
									if (fastModel === undefined) return;
									pick.setModelId(isFast ? tier.modelId : fastModel.modelId);
								}}
								className={cn(
									"shrink-0 rounded-full aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
									isFast
										? "bg-amber-400/15 text-amber-600 hover:bg-amber-400/25 dark:text-amber-400"
										: "text-muted-foreground",
								)}
							>
								<LightningIcon
									weight={isFast ? "fill" : "bold"}
									className="size-4"
									aria-hidden
								/>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" className="max-w-56 text-center">
							{fastModel === undefined ? (
								t("appBuilder.chat.model.fastUnavailable", {
									tier: tierName(tier.id),
								})
							) : (
								<>
									<span className="block font-semibold">
										{t("appBuilder.chat.model.fast")}
									</span>
									<span className="block opacity-80">
										{t("appBuilder.chat.model.fastWarning")}
									</span>
								</>
							)}
						</TooltipContent>
					</Tooltip>
					<div className="min-w-0 flex-1 text-center">
						<div className="flex items-center justify-center gap-1">
							<p
								className={cn(
									"font-grotesk font-semibold text-base leading-tight transition-colors duration-300",
									tierStyle.text,
									isNuclearShown &&
										"[text-shadow:0_0_14px_rgb(249_115_22/0.6)]",
								)}
							>
								{tierName(shownTier.id)}
							</p>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label={tierHint}
										className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
									>
										<InfoIcon weight="bold" className="size-3.5" aria-hidden />
									</button>
								</TooltipTrigger>
								<TooltipContent side="top" className="max-w-56 text-center">
									{tierHint}
								</TooltipContent>
							</Tooltip>
						</div>
						{/* Product rule: users never see a model name. Only a local dev build shows it, for testing. */}
						{import.meta.env.DEV ? (
							<p className="truncate text-muted-foreground text-xs">
								{getModelLabel(shownTier.modelId)}
							</p>
						) : null}
					</div>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={resetLabel}
								disabled={tier === baseTier && !isFast}
								onClick={() => {
									pick.setModelId(baseTier.modelId);
									snapTo(position, 0);
								}}
								className="shrink-0 rounded-full text-muted-foreground"
							>
								<ArrowCounterClockwiseIcon
									weight="bold"
									className="size-4"
									aria-hidden
								/>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top">{resetLabel}</TooltipContent>
					</Tooltip>
				</div>

				{/* Radix reads the app DirectionProvider, which is rtl in Arabic. The Slider and this block both pin ltr, so they agree. */}
				<div dir="ltr" className="relative mt-4">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-[3px] h-3.5"
					>
						{/* No CSS transition: the glide and the snap move the glow every frame. */}
						<div
							className={cn(
								"absolute inset-0 origin-left rounded-full blur-md",
								tierStyle.glow,
							)}
							style={{
								opacity: 0.15 + 0.45 * fraction,
								transform: `scaleX(${0.15 + 0.85 * fraction})`,
							}}
						/>
						<div
							className={cn(
								"absolute inset-0 overflow-hidden rounded-full",
								TRACK_GRADIENT_CLASS,
							)}
						>
							{isReducedMotion
								? null
								: SPARKLES.slice(0, (shownIndex + 1) * SPARKLES_PER_TIER).map(
										(sparkle) => (
											<motion.span
												key={sparkle.id}
												className="absolute size-[3px] rounded-full bg-white"
												style={{
													insetInlineStart: `calc(${sparkle.along} * ${fillWidth})`,
													top: `${sparkle.topPercent}%`,
												}}
												animate={{
													opacity: [0, 1, 0],
													y: [2, -2],
													scale: [0.5, 1, 0.5],
												}}
												transition={{
													duration: sparkleDurationSec,
													delay: sparkle.delaySec,
													repeat: Number.POSITIVE_INFINITY,
													ease: "easeInOut",
												}}
											/>
										),
									)}
							{isNuclearShown && !isReducedMotion ? (
								<motion.span
									className="absolute inset-y-0 start-0 w-1/3 bg-linear-to-r from-transparent via-white/60 to-transparent"
									initial={{ x: "-100%" }}
									animate={{ x: "300%" }}
									transition={{
										duration: 1.6,
										repeat: Number.POSITIVE_INFINITY,
										ease: "linear",
									}}
								/>
							) : null}
							{/* The empty part of the track. Its start edge sits under the thumb center, so the gradient shows up to the thumb. */}
							<div
								className="absolute inset-0 bg-muted"
								style={{ transform: `translateX(${thumbCenterAt(fraction)})` }}
							/>
						</div>
						{/* Compares the position, not glideValue: a drag that ends where it began sends no commit, so glideValue stays set. */}
						{isNuclear && position === tierIndex && !isReducedMotion ? (
							<motion.span
								className="absolute end-0 top-1/2 size-5 -translate-y-1/2 rounded-full bg-orange-500/70 blur-sm"
								animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0.25, 0.8] }}
								transition={{
									duration: 1.4,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								}}
							/>
						) : null}
					</div>
					{/* The slider counts drag steps, so a drag glides. Only a release picks a tier. */}
					<Slider
						dir="ltr"
						min={0}
						max={lastIndex * DRAG_STEPS_PER_TIER}
						step={1}
						value={[Math.round(position * DRAG_STEPS_PER_TIER)]}
						disabled={tiers.length < 2}
						onValueChange={([step]) => {
							if (step === undefined) return;
							snapRef.current?.stop();
							setGlideValue(step / DRAG_STEPS_PER_TIER);
						}}
						onValueCommit={([step]) => {
							if (step === undefined) return;
							const from = step / DRAG_STEPS_PER_TIER;
							moveToTier(Math.round(from), from);
						}}
						onKeyDown={moveByKey}
						aria-label={chipLabel}
						aria-valuetext={tierName(shownTier.id)}
						className={SLIDER_CLASS}
					/>
					<div className="relative mt-2 h-4">
						{tiers.map((stop, index) => (
							// The slider owns the keyboard, so the stop labels stay out of the tab order.
							<button
								key={stop.id}
								type="button"
								tabIndex={-1}
								onClick={() => moveToTier(index, position)}
								className={cn(
									"absolute top-0 -translate-x-1/2 whitespace-nowrap font-grotesk text-[11px] leading-4 transition-colors",
									stop === shownTier
										? cn("font-semibold", TIER_STYLE[stop.id].text)
										: "text-muted-foreground hover:text-foreground",
								)}
								style={{ insetInlineStart: thumbCenterAt(index / lastIndex) }}
							>
								{tierName(stop.id)}
							</button>
						))}
					</div>
				</div>

				{/* Inside the card, so the popover counts the dialog as its own layer and stays open. */}
				<NuclearLaunchDialog
					open={pendingNuclearModelId !== null}
					// The pending id is the Nuclear model or its Fast row, so any other id means Fast.
					isFast={
						pendingNuclearModelId !== null &&
						pendingNuclearModelId !== nuclearModelId
					}
					onConfirm={confirmNuclear}
					onCancel={cancelNuclear}
				/>
			</PopoverContent>
		</Popover>
	);
}
