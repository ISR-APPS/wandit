// One sticker of the stats row: a big number in the display face and a small label in capitals.
// StatsRow renders four. A number with a target counts up on view (hooks/use-count-up.ts);
// the "0" stat has no target and stamps in instead (landing.css .gd-stamp).
import { useCallback, useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useCountUp } from "../hooks/use-count-up";
import type { Stat } from "../lib/content";
import { DISPLAY } from "../lib/styles";

type StatStickerProps = {
	stat: Stat;
	/** The tilt class of the sticker, for example [--gd-r:-2deg]. */
	tiltClass: string;
	/** The color class of the number: coral or teal, alternating along the row. */
	numberClass: string;
};

/** A sticker of at least 172px. On a phone the row is a 2 by 2 grid. */
export function StatSticker({
	stat,
	tiltClass,
	numberClass,
}: StatStickerProps) {
	const { t, locale } = useT();
	const numberRef = useRef<HTMLSpanElement>(null);
	const target = stat.target ?? 0;
	const suffix =
		stat.suffix === "plus"
			? "+"
			: stat.suffix === "minutes"
				? t("stats.waitUnit")
				: "";
	const format = useCallback(
		(value: number) =>
			`${value.toLocaleString(locale, {
				minimumFractionDigits: stat.decimals,
				maximumFractionDigits: stat.decimals,
			})}${suffix}`,
		[locale, stat.decimals, suffix],
	);
	useCountUp(numberRef, target, format);
	return (
		<li
			className={cn(
				"gd-outline gd-shadow-6 gd-tilt gd-lift gd-lift-small relative min-w-[172px] rounded-[calc(var(--radius)*1.375)] bg-card px-7 pt-5 pb-4 text-center max-md:min-w-0 max-md:px-3",
				tiltClass,
			)}
		>
			<span
				ref={stat.target === null ? undefined : numberRef}
				className={cn(
					DISPLAY,
					"block text-[clamp(1.9rem,3.2vw,2.6rem)] tabular-nums leading-none",
					stat.target === null && "gd-stamp",
					numberClass,
				)}
			>
				{format(target)}
			</span>
			<span className="mt-1.5 block text-balance font-extrabold text-[0.88rem] text-foreground/72 uppercase tracking-[0.06em] max-md:text-[0.78rem]">
				{t(stat.labelKey)}
			</span>
		</li>
	);
}
