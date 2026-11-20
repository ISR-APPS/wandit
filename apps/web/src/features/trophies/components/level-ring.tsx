/**
 * The trophy level as a ring. A spark arc shows the progress to the next level.
 * The level number is in the center. The trophies page header and the summary card render it.
 * The track and the number use the text color of the caller. Thus the ring works on a night card and on a white card.
 */
import { formatNumber } from "@wandit/internationalization";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";

const SIZE_CLASS = {
	sm: "size-14 text-xl",
	lg: "size-28 text-[2.75rem] sm:size-32",
} as const;

/** Decorative (aria-hidden). The caller shows the level name and the points as text. */
export function LevelRing({
	levelIndex,
	progressRatio,
	size = "sm",
	className,
}: {
	/** Position of the level in TROPHY_LEVELS, from 1 to 7. */
	levelIndex: number;
	/** Progress from the start of this level to the next one, from 0 to 1. */
	progressRatio: number;
	size?: keyof typeof SIZE_CLASS;
	className?: string;
}) {
	const { locale } = useTranslation();
	const clampedRatio = Math.min(1, Math.max(0, progressRatio));

	return (
		<span
			aria-hidden
			className={cn(
				"relative grid shrink-0 place-items-center",
				SIZE_CLASS[size],
				className,
			)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 64 64"
				className="absolute inset-0 size-full rtl:-scale-x-100"
			>
				<circle
					cx="32"
					cy="32"
					r="28"
					fill="none"
					stroke="currentColor"
					strokeWidth="5"
					className="opacity-[0.12]"
				/>
				{/* pathLength 1 makes the dash offset a ratio. The rotation moves the start to the top. */}
				<circle
					cx="32"
					cy="32"
					r="28"
					fill="none"
					strokeWidth="5"
					strokeLinecap="round"
					pathLength={1}
					strokeDasharray="1 1"
					strokeDashoffset={1 - clampedRatio}
					transform="rotate(-90 32 32)"
					className={cn(
						"stroke-spark transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none",
						// A ring at 0 % would show the round cap as a dot.
						clampedRatio === 0 && "opacity-0",
					)}
				/>
			</svg>
			<span className="font-extrabold font-grotesk tabular-nums leading-none tracking-[-0.04em]">
				{formatNumber(levelIndex, locale)}
			</span>
		</span>
	);
}
