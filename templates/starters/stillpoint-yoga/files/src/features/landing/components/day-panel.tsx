// One practice as a panel of its hour: a sun arc (or a moon), the time line, the name, the text, and the level.
// PracticesSection renders four of them. landing.css paints each hour from the tokens: dawn, midday, golden, night.
// On hover the sky glows and the sun moves as its hour does.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** The four hours of the day grid. landing.css reads the value as data-hour. */
export type DayHour = "dawn" | "midday" | "golden" | "night";

type DayPanelProps = {
	hour: DayHour;
	/** Key of "06:30 · dawn · 60 min". */
	whenKey: TranslationKey;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
	/** Key of the level line under the hairline. */
	levelKey: TranslationKey;
	/** Key of the alt text of the sun or moon drawing. */
	artKey: TranslationKey;
};

/** The x and y of the sun on its arc, in the 120 x 62 drawing, for each day hour. Night has a moon. */
const SUN_POSITION: Record<Exclude<DayHour, "night">, [number, number]> = {
	dawn: [23, 38],
	midday: [60, 7],
	golden: [97, 38],
};

/** A panel 520px tall on a wide screen. The night panel inverts to bone text on ink. */
export function DayPanel({
	hour,
	whenKey,
	titleKey,
	bodyKey,
	levelKey,
	artKey,
}: DayPanelProps) {
	const { t } = useT();
	const isNight = hour === "night";
	return (
		<article
			data-hour={hour}
			data-reveal
			className="sp-panel flex flex-col px-[30px] py-[34px] min-[1081px]:min-h-[520px] min-[621px]:min-h-[440px]"
		>
			<svg
				viewBox="0 0 120 62"
				fill="none"
				role="img"
				aria-label={t(artKey)}
				className={cn(
					"sp-arc sp-draw mb-auto w-[120px]",
					isNight ? "text-(--sp-moon-sage)" : "text-(--sp-ink-64)",
				)}
			>
				{isNight ? (
					<path
						pathLength={1}
						d="M53 10 a 17 17 0 1 0 20 26 a 14 14 0 1 1 -20 -26"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				) : (
					<>
						<path
							pathLength={1}
							d="M10 56 A 50 50 0 0 1 110 56"
							stroke="currentColor"
							strokeWidth="1.4"
							strokeLinecap="round"
							opacity=".5"
						/>
						<circle
							cx={SUN_POSITION[hour][0]}
							cy={SUN_POSITION[hour][1]}
							r="6.5"
							fill="currentColor"
						/>
					</>
				)}
			</svg>
			<p
				className={cn(
					"mt-10 mb-2.5 font-bold font-sans text-[0.72rem] uppercase tracking-[0.24em]",
					isNight ? "text-(--sp-on-night-soft)" : "text-(--sp-ink-64)",
				)}
			>
				{t(whenKey)}
			</p>
			<h3
				className={cn(
					"mb-3.5 font-display font-normal text-[clamp(1.7rem,2.4vw,2.2rem)] leading-[1.06]",
					isNight && "text-(--sp-bone)",
				)}
			>
				{t(titleKey)}
			</h3>
			<p
				className={cn(
					"max-w-[34ch] text-[0.97rem] leading-[1.65]",
					isNight ? "text-(--sp-on-night)" : "text-(--sp-ink-78)",
				)}
			>
				{t(bodyKey)}
			</p>
			<p
				className={cn(
					"mt-[18px] border-t pt-4 font-bold font-sans text-[0.72rem] uppercase tracking-[0.16em]",
					isNight
						? "border-(--sp-on-night-soft)/40 text-(--sp-on-night-soft)"
						: "border-(--sp-line) text-(--sp-ink-64)",
				)}
			>
				{t(levelKey)}
			</p>
		</article>
	);
}
