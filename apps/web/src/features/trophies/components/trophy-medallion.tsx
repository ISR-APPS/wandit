/**
 * One trophy as a keycap tile. A locked trophy is a flat key pressed into the page, with a thin progress ring.
 * An unlocked trophy rises on an edge in its rarity color. The trophies page, the summary card,
 * the unlock toasts, and the /pricing teaser render it. It is pure: no query, so it works signed out.
 */
import { QuestionIcon } from "@phosphor-icons/react/Question";
import { TROPHIES, type TrophyId, type TrophyRarity } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";
import type { TrophyState } from "../lib/helpers";
import { TROPHY_ICONS } from "../lib/trophy-icons";

/** `sm` in lists and toasts, `md` in the "Next up" cards, `lg` in the trophy grid. */
type MedallionSize = "sm" | "md" | "lg";

// The edge height is the rise of the key. The radius follows the size, so a small key is not a circle.
const SIZE_CLASS = {
	sm: "size-12 rounded-[14px] [--medallion-depth:3px]",
	md: "size-16 rounded-2xl [--medallion-depth:4px]",
	lg: "size-20 rounded-[22px] [--medallion-depth:5px]",
} as const satisfies Record<MedallionSize, string>;

const ICON_SIZE_CLASS = {
	sm: "size-6",
	md: "size-8",
	lg: "size-10",
} as const satisfies Record<MedallionSize, string>;

// The face, the edge, and the icon color of an unlocked key. Legendary also gets the shimmer overlay.
const RARITY_CLASS = {
	common:
		"bg-white text-night [--medallion-edge:rgb(11_16_51/0.12)] ring-1 ring-night/[0.06]",
	rare: "bg-white text-ember [--medallion-edge:var(--color-ember)] ring-1 ring-ember/15",
	epic: "bg-spark/[0.14] text-spark-deep [--medallion-edge:var(--color-spark-deep)] ring-1 ring-spark/30",
	legendary:
		"bg-gradient-ember text-white [--medallion-edge:var(--color-ember-deep)]",
} as const satisfies Record<TrophyRarity, string>;

// The dark theme classes stay apart, so a light-only page can leave them out.
const RARITY_DARK_CLASS = {
	common: "dark:bg-card dark:text-foreground dark:ring-white/10",
	rare: "dark:bg-card",
	epic: "dark:text-spark",
	legendary: "",
} as const satisfies Record<TrophyRarity, string>;

const CORNER_SPARK_CLASS = {
	common: "text-spark",
	rare: "text-ember",
	epic: "text-spark-deep",
	legendary: "text-white",
} as const satisfies Record<TrophyRarity, string>;

const HIDDEN_DARK_CLASS =
	"dark:border-white/20 dark:bg-white/[0.04] dark:text-foreground/40";

const LOCKED_DARK_CLASS =
	"dark:bg-white/[0.04] dark:text-foreground/40 dark:ring-white/10";

/** The trophy tile. It is decorative (aria-hidden), so the caller renders the trophy name as text. */
export function TrophyMedallion({
	trophyId,
	state,
	progressRatio,
	size = "md",
	lightOnly = false,
	className,
}: {
	trophyId: TrophyId;
	state: TrophyState;
	/** Progress from 0 to 1. Only a locked tile shows it, as the ring around the icon. */
	progressRatio: number;
	size?: MedallionSize;
	/** True on a light-only page, such as /pricing. The tile then ignores a stored dark theme. */
	lightOnly?: boolean;
	className?: string;
}) {
	// trophyId is a TrophyId, so the find always matches. The fallback only satisfies the type.
	const rarity =
		TROPHIES.find((trophy) => trophy.id === trophyId)?.rarity ?? "common";
	const Icon = TROPHY_ICONS[trophyId];

	if (state === "hidden") {
		return (
			<span
				aria-hidden
				className={cn(
					"relative grid shrink-0 place-items-center border border-night/15 border-dashed bg-night/[0.03] text-night/35",
					!lightOnly && HIDDEN_DARK_CLASS,
					SIZE_CLASS[size],
					className,
				)}
			>
				<QuestionIcon weight="bold" className={ICON_SIZE_CLASS[size]} />
			</span>
		);
	}

	if (state === "locked") {
		return (
			<span
				aria-hidden
				className={cn(
					"relative grid shrink-0 place-items-center bg-night/[0.03] text-night/35 shadow-[inset_0_1px_2px_rgb(11_16_51/0.08)] ring-1 ring-night/[0.05]",
					!lightOnly && LOCKED_DARK_CLASS,
					SIZE_CLASS[size],
					className,
				)}
			>
				<ProgressRing ratio={progressRatio} />
				{/* The icon is smaller than on an unlocked key, so it sits inside the ring. */}
				<Icon weight="regular" className="size-[42%]" />
			</span>
		);
	}

	return (
		<span
			aria-hidden
			className={cn(
				"relative grid shrink-0 place-items-center",
				// The key rises on its edge and clicks into place one time when it mounts.
				"shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_var(--medallion-depth)_0_var(--medallion-edge)]",
				"animate-assemble motion-reduce:animate-none",
				SIZE_CLASS[size],
				RARITY_CLASS[rarity],
				!lightOnly && RARITY_DARK_CLASS[rarity],
				className,
			)}
		>
			{rarity === "legendary" ? (
				<span className="pointer-events-none absolute inset-0 animate-shimmer rounded-[inherit] bg-[length:250%_100%] bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.5)_50%,transparent_70%)] motion-reduce:hidden" />
			) : null}
			<Icon
				weight="duotone"
				className={cn("relative", ICON_SIZE_CLASS[size])}
			/>
			<Spark
				className={cn(
					"absolute end-[9%] top-[9%] size-[20%]",
					CORNER_SPARK_CLASS[rarity],
					// Only the epic spark changes color in the dark theme.
					!lightOnly && rarity === "epic" && "dark:text-spark",
				)}
			/>
		</span>
	);
}

/** The thin ring of a locked key: a faint track and a spark arc from the top. The arc turns clockwise, or counterclockwise in RTL. */
function ProgressRing({ ratio }: { ratio: number }) {
	const clampedRatio = Math.min(1, Math.max(0, ratio));
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 40 40"
			className="absolute inset-[8%] size-[84%] rtl:-scale-x-100"
		>
			<circle
				cx="20"
				cy="20"
				r="17"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				className="opacity-30"
			/>
			{clampedRatio > 0 ? (
				// pathLength 1 makes the dash offset a ratio. The rotation moves the start to the top.
				<circle
					cx="20"
					cy="20"
					r="17"
					fill="none"
					strokeWidth="2"
					strokeLinecap="round"
					pathLength={1}
					strokeDasharray="1 1"
					strokeDashoffset={1 - clampedRatio}
					transform="rotate(-90 20 20)"
					className="stroke-spark"
				/>
			) : null}
		</svg>
	);
}
