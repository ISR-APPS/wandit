/**
 * Amount picker of the top-up kit, in whole USD. Layout "meter" shows a big field and the Spark Meter slider.
 * Layout "compact" shows presets, a field, and a static bonus track. The wallet card and /pricing use "meter".
 * The top-up dialog uses "compact". The picker parses the text with parseTopupAmountUsd and reads TOPUP_BONUS_TIERS.
 * The min and max texts add the DZD price when useDzdPerUsdRate knows the rate.
 */
import { TOPUP_BONUS_TIERS } from "@wandit/contracts";
import { Slider } from "@wandit/ui/components/slider";
import { cn } from "@wandit/ui/lib/utils";
import {
	type ComponentProps,
	type KeyboardEvent,
	useId,
	useState,
} from "react";

import { Spark } from "@/components/logo";
import { useDzdPerUsdRate } from "@/features/billing/api/billing.queries";
import {
	formatUsd,
	formatUsdAndDzd,
} from "@/features/billing/lib/price-format";
import {
	adjacentMeterStopUsd,
	meterPositionToUsd,
	parseTopupAmountUsd,
	TOPUP_METER_MAX_POSITION,
	type TopupAmountParseResult,
	usdToMeterPosition,
} from "@/features/billing/lib/topup-amount";
import { formatNumber, useDictionary, useTranslation } from "@/lib/i18n";

/** "night" on a dark card (the /pricing meter card). "paper" on a light card and in the dialog. */
export type TopupTone = "night" | "paper";

type TopupAmountPickerProps = {
	/** Whole USD that the parent holds. Null while the typed text is not a valid amount. */
	amountUsd: number | null;
	/** Called on each change: whole USD, or null when the typed text is not valid. */
	onAmountUsdChange: (amountUsd: number | null) => void;
	/** Whole USD. From GET billing/wallet `topup`, or from the contracts constants on a signed-out page. */
	minAmountUsd: number;
	/** Whole USD. Same source as `minAmountUsd`. */
	maxAmountUsd: number;
	/** Whole USD, ascending. One text button for each. */
	presetAmountsUsd: readonly number[];
	tone: TopupTone;
	/** "meter": big field and slider. "compact": presets, a field, and a static bonus track. No slider. */
	layout: "meter" | "compact";
	/** True when no top-up method is on. The picker shows the amount but refuses input. */
	disabled?: boolean;
};

// The 0% band has no tier row. With no tier above 0%, the picker hides the bonus marks and the track.
const BONUS_TIERS = TOPUP_BONUS_TIERS.filter((tier) => tier.bonusPercent > 0);

// Small grotesk capitals over a value. Arabic letters join, so `rtl:` removes the letter spacing.
const LABEL_CLASS =
	"font-grotesk font-semibold text-[11px] uppercase tracking-[0.08em] rtl:tracking-normal";

const TONE_CLASS = {
	night: {
		text: "text-paper",
		muted: "text-paper/60",
		track: "bg-white/15",
		chip: "text-paper/75 ring-white/15 hover:bg-white/10 hover:text-paper",
		chipActive: "bg-spark text-night ring-spark",
		focus: "focus-visible:outline-spark",
	},
	paper: {
		text: "text-night dark:text-foreground",
		muted: "text-night/60 dark:text-foreground/60",
		track: "bg-night/[0.08] dark:bg-white/10",
		chip: "text-night/70 ring-night/10 hover:bg-night/[0.04] hover:text-night dark:text-foreground/70 dark:ring-white/15 dark:hover:bg-white/[0.06] dark:hover:text-foreground",
		chipActive:
			"bg-night text-paper ring-night dark:bg-spark dark:text-night dark:ring-spark",
		focus: "focus-visible:outline-ember",
	},
} as const satisfies Record<TopupTone, Record<string, string>>;

// Restyles the shared Slider through its data-slot parts: a thicker track, an ember fill, a spark keycap thumb.
// The height needs `!`: the track sets its height with a selector of the same weight.
const METER_SLIDER_CLASS =
	"py-2 [&_[data-slot=slider-range]]:bg-gradient-ember [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:cursor-grab [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-spark [&_[data-slot=slider-thumb]]:shadow-[0_2px_0_var(--color-spark-deep)] [&_[data-slot=slider-thumb]]:ring-spark/35 [&_[data-slot=slider-track]]:h-2!";

/** The amount picker. It keeps the typed text. The parent keeps the amount. */
export function TopupAmountPicker({
	amountUsd,
	onAmountUsdChange,
	minAmountUsd,
	maxAmountUsd,
	presetAmountsUsd,
	tone,
	layout,
	disabled = false,
}: TopupAmountPickerProps) {
	const { dir, locale, t } = useTranslation();
	const copy = useDictionary().billing.topup;
	const fieldId = useId();
	const dzdPerUsdRate = useDzdPerUsdRate();
	const limits = { minAmountUsd, maxAmountUsd };
	const minText = formatUsdAndDzd(minAmountUsd, locale, dzdPerUsdRate);
	const maxText = formatUsdAndDzd(maxAmountUsd, locale, dzdPerUsdRate);
	const [text, setText] = useState(amountUsd === null ? "" : String(amountUsd));
	// The last `amountUsd` prop that the field followed.
	const [syncedAmountUsd, setSyncedAmountUsd] = useState(amountUsd);
	const parsed = parseTopupAmountUsd(text, limits);

	// The parent can set the amount (the receipt nudge). The field then shows the new amount.
	// This is the React pattern for a state that follows a prop, with no effect.
	if (amountUsd !== syncedAmountUsd) {
		setSyncedAmountUsd(amountUsd);
		if (
			amountUsd !== null &&
			!(parsed.kind === "valid" && parsed.amountUsd === amountUsd)
		) {
			setText(String(amountUsd));
		}
	}

	const error = amountErrorText(parsed, {
		min: minText,
		max: maxText,
		copy: copy.amountErrors,
		t,
	});
	const hintId = `${fieldId}-hint`;
	const errorId = `${fieldId}-error`;
	const toneClass = TONE_CLASS[tone];
	// The red of the theme is too dark on the night card.
	const errorClass = tone === "night" ? "text-red-300" : "text-destructive";

	const selectAmount = (nextAmountUsd: number) => {
		const clamped = Math.min(
			Math.max(nextAmountUsd, minAmountUsd),
			maxAmountUsd,
		);
		setText(String(clamped));
		onAmountUsdChange(clamped);
	};

	const changeText = (nextText: string) => {
		setText(nextText);
		const result = parseTopupAmountUsd(nextText, limits);
		onAmountUsdChange(result.kind === "valid" ? result.amountUsd : null);
	};

	const fieldMessage = (
		<p
			id={error ? errorId : hintId}
			role={error ? "alert" : undefined}
			className={cn("text-xs", error ? errorClass : toneClass.muted)}
		>
			{error ??
				t("billing.topup.customAmountHint", {
					min: minText,
					max: maxText,
				})}
		</p>
	);

	const presets = (
		<fieldset disabled={disabled} className="flex flex-wrap gap-1.5">
			<legend className="sr-only">{copy.presetsLabel}</legend>
			{presetAmountsUsd.map((presetUsd) => (
				<button
					key={presetUsd}
					type="button"
					aria-pressed={amountUsd === presetUsd}
					onClick={() => selectAmount(presetUsd)}
					className={cn(
						"h-8 rounded-full px-3 font-grotesk font-semibold text-[13px] tabular-nums outline-offset-2 ring-1 transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
						toneClass.focus,
						amountUsd === presetUsd ? toneClass.chipActive : toneClass.chip,
					)}
				>
					<bdi>{formatUsd(presetUsd, locale)}</bdi>
				</button>
			))}
		</fieldset>
	);

	// The compact and the meter layouts share one amount field. Only the class and the width differ.
	const amountInputProps = {
		id: fieldId,
		inputMode: "numeric",
		dir: "ltr",
		autoComplete: "off",
		disabled,
		value: text,
		"aria-invalid": Boolean(error),
		"aria-describedby": error ? errorId : hintId,
		onChange: (event) => changeText(event.target.value),
	} satisfies ComponentProps<"input">;

	if (layout === "compact") {
		return (
			<div className={cn("flex flex-col gap-3", toneClass.text)}>
				<span className={cn(LABEL_CLASS, toneClass.muted)}>
					{copy.amountLabel}
				</span>
				{presets}
				<div className="flex flex-col gap-1.5">
					<label htmlFor={fieldId} className="font-medium text-sm">
						{copy.customAmountLabel}
					</label>
					<div
						dir="ltr"
						className={cn(
							"flex h-10 items-center gap-1 rounded-xl px-3 ring-1 focus-within:ring-2",
							error
								? "ring-destructive/60"
								: "ring-night/15 focus-within:ring-ember dark:ring-white/15",
							disabled && "opacity-60",
						)}
					>
						<span aria-hidden className={toneClass.muted}>
							$
						</span>
						<input
							{...amountInputProps}
							className="min-w-0 flex-1 bg-transparent font-grotesk font-semibold tabular-nums outline-none"
						/>
					</div>
					{fieldMessage}
				</div>
				{BONUS_TIERS.length > 0 ? (
					<BonusTrack
						amountUsd={amountUsd}
						minAmountUsd={minAmountUsd}
						tone={tone}
					/>
				) : null}
			</div>
		);
	}

	const meterValue = usdToMeterPosition(amountUsd ?? minAmountUsd);

	// Arrow keys move 1 USD and Page keys jump to the next stop. Radix would move 1 slider position.
	// Radix skips its own key handler after preventDefault. Home and End stay with Radix.
	const handleMeterKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
		const currentUsd = amountUsd ?? minAmountUsd;
		// In Arabic the track fills from the right, so the left arrow adds and the right arrow takes away.
		const forwardArrow = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
		const backArrow = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
		let nextUsd: number | null = null;
		if (event.key === "ArrowUp" || event.key === forwardArrow) {
			nextUsd = currentUsd + 1;
		} else if (event.key === "ArrowDown" || event.key === backArrow) {
			nextUsd = currentUsd - 1;
		} else if (event.key === "PageUp") {
			nextUsd = adjacentMeterStopUsd(currentUsd, 1);
		} else if (event.key === "PageDown") {
			nextUsd = adjacentMeterStopUsd(currentUsd, -1);
		}
		if (nextUsd === null) {
			return;
		}
		event.preventDefault();
		selectAmount(nextUsd);
	};

	return (
		<div className={cn("flex flex-col", toneClass.text)}>
			<label htmlFor={fieldId} className={cn(LABEL_CLASS, toneClass.muted)}>
				{copy.amountInputLabel}
			</label>
			<div
				dir="ltr"
				className="mt-2 flex items-baseline self-start font-bold font-grotesk text-[3.25rem] leading-none tracking-[-0.045em] sm:text-[3.75rem]"
			>
				<span aria-hidden className="me-1 text-[0.55em] opacity-45">
					$
				</span>
				<input
					{...amountInputProps}
					// The field grows with the digits, so the number reads as one large figure.
					style={{ width: `${Math.max(text.length, 1) + 0.4}ch` }}
					className={cn(
						"min-w-[1.4ch] rounded-lg bg-transparent tabular-nums outline-offset-4 focus-visible:outline-2 disabled:opacity-60",
						toneClass.focus,
						error && errorClass,
					)}
				/>
			</div>
			<div className="mt-2">{fieldMessage}</div>

			<div className="mt-7">
				{BONUS_TIERS.length > 0 ? (
					<div aria-hidden className="relative h-6">
						{BONUS_TIERS.map((tier) => {
							const reached =
								amountUsd !== null && amountUsd >= tier.minAmountUsd;
							return (
								<span
									key={tier.minAmountUsd}
									style={{
										insetInlineStart: `${
											(usdToMeterPosition(tier.minAmountUsd) /
												TOPUP_METER_MAX_POSITION) *
											100
										}%`,
									}}
									className={cn(
										"absolute top-0 inline-flex -translate-x-1/2 items-center gap-1 font-grotesk font-semibold text-[11px] tabular-nums transition-colors motion-reduce:transition-none rtl:translate-x-1/2",
										reached ? "text-ember" : toneClass.muted,
										tone === "night" && reached && "text-spark",
									)}
								>
									<Spark className="size-3" />
									<bdi>
										{t("billing.topup.bonusLabel", {
											percent: formatNumber(tier.bonusPercent, locale),
										})}
									</bdi>
								</span>
							);
						})}
					</div>
				) : null}
				<Slider
					min={0}
					max={TOPUP_METER_MAX_POSITION}
					step={1}
					value={[meterValue]}
					disabled={disabled}
					aria-label={copy.amountInputLabel}
					aria-valuetext={
						amountUsd === null ? undefined : formatUsd(amountUsd, locale)
					}
					onKeyDown={handleMeterKeyDown}
					onValueChange={([position]) => {
						if (position !== undefined) {
							selectAmount(meterPositionToUsd(position));
						}
					}}
					className={cn(
						METER_SLIDER_CLASS,
						tone === "night"
							? "[&_[data-slot=slider-track]]:bg-white/15"
							: "[&_[data-slot=slider-track]]:bg-night/[0.08] dark:[&_[data-slot=slider-track]]:bg-white/10",
					)}
				/>
				<div className="mt-3">{presets}</div>
			</div>
		</div>
	);
}

/**
 * Static bonus track of the compact layout: one band per tier, and the band of the amount is filled.
 * The bands below it keep a light fill, so the track reads as progress.
 */
function BonusTrack({
	amountUsd,
	minAmountUsd,
	tone,
}: {
	/** Whole USD, or null while the typed text is not valid. No band is filled then. */
	amountUsd: number | null;
	/** Start of the 0% band. */
	minAmountUsd: number;
	tone: TopupTone;
}) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.topup.bonusTrack;
	const bands = [{ minAmountUsd, bonusPercent: 0 }, ...BONUS_TIERS];
	// The band of the amount is the last band that the amount reaches. The bands are in ascending order.
	const activeIndex =
		amountUsd === null
			? -1
			: bands.findLastIndex((band) => amountUsd >= band.minAmountUsd);
	const toneClass = TONE_CLASS[tone];

	return (
		<div aria-hidden className="grid gap-1.5">
			<span className={cn(LABEL_CLASS, toneClass.muted)}>{copy.label}</span>
			<div className="flex gap-1">
				{bands.map((band, index) => (
					<div key={band.minAmountUsd} className="min-w-0 flex-1">
						<div
							className={cn(
								"h-1.5 rounded-full transition-colors motion-reduce:transition-none",
								index === activeIndex
									? "bg-gradient-ember"
									: index < activeIndex
										? "bg-ember/30"
										: toneClass.track,
							)}
						/>
						<p
							className={cn(
								"mt-1.5 truncate font-grotesk font-semibold text-[11px] tabular-nums",
								index === activeIndex ? "text-ember" : toneClass.muted,
							)}
						>
							{band.bonusPercent === 0 ? (
								copy.base
							) : (
								<bdi>
									{t("billing.topup.bonusLabel", {
										percent: formatNumber(band.bonusPercent, locale),
									})}
								</bdi>
							)}
						</p>
						<p
							className={cn("text-[11px] tabular-nums", toneClass.muted)}
							dir="ltr"
						>
							{formatUsd(band.minAmountUsd, locale)}+
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

/** Error text under the amount field. Null for a valid amount. */
function amountErrorText(
	result: TopupAmountParseResult,
	input: {
		/** The minimum, formatted in USD for the locale. */
		min: string;
		/** The maximum, formatted in USD for the locale. */
		max: string;
		copy: {
			empty: string;
			notWholeNumber: string;
		};
		t: ReturnType<typeof useTranslation>["t"];
	},
): string | null {
	switch (result.kind) {
		case "valid":
			return null;
		case "empty":
			return input.copy.empty;
		case "notWholeNumber":
			return input.copy.notWholeNumber;
		case "belowMinimum":
			return input.t("billing.topup.amountErrors.belowMinimum", {
				min: input.min,
			});
		case "aboveMaximum":
			return input.t("billing.topup.amountErrors.aboveMaximum", {
				max: input.max,
			});
	}
}
