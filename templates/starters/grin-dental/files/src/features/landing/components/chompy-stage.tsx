// The art of the hero: Chompy on a sun blob, with a spinning ring of words, two stickers, and a speech bubble.
// HeroSection renders it. Chompy is a real button: hover or focus makes him grin; a press squashes him,
// throws confetti, and gives the bubble the next phrase. It reads hooks/use-pupil-follow.ts for the eyes.
import { useRef, useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { usePupilFollow } from "../hooks/use-pupil-follow";
import { DISPLAY } from "../lib/styles";
import { ChompyFace } from "./chompy-face";
import { ConfettiBurst } from "./confetti-burst";

/** The phrases of the bubble after each press, in order. The first press shows the first one. */
const PHRASES: readonly TranslationKey[] = [
	"chompy.phrase1",
	"chompy.phrase2",
	"chompy.phrase3",
	"chompy.phrase4",
	"chompy.phrase5",
	"chompy.phrase6",
	"chompy.phrase7",
];

/** The squash of a press: flat and wide, then a spring back with two small bounces. */
const SQUASH_KEYFRAMES: Keyframe[] = [
	{ scale: "1 1" },
	{ scale: "1.15 0.76", offset: 0.12 },
	{ scale: "0.92 1.1", offset: 0.32 },
	{ scale: "1.05 0.95", offset: 0.5 },
	{ scale: "0.98 1.02", offset: 0.7 },
	{ scale: "1 1" },
];

/** A square stage, at most 480px wide. Its stickers and ring reach a little outside it. */
export function ChompyStage() {
	const { t } = useT();
	const svgRef = useRef<SVGSVGElement>(null);
	const bodyRef = useRef<SVGGElement>(null);
	const [isGrinning, setIsGrinning] = useState(false);
	// -1 shows the hello line. Each press moves to the next phrase.
	const [phraseIndex, setPhraseIndex] = useState(-1);
	// The ids of the confetti bursts in flight. A fast double press gives two bursts.
	const [bursts, setBursts] = useState<number[]>([]);
	const nextBurstId = useRef(0);
	usePupilFollow(svgRef);

	const celebrate = () => {
		setPhraseIndex((index) => (index + 1) % PHRASES.length);
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}
		bodyRef.current?.animate(SQUASH_KEYFRAMES, {
			duration: 1100,
			easing: "ease-out",
		});
		const id = nextBurstId.current;
		nextBurstId.current = id + 1;
		setBursts((current) => [...current, id]);
	};

	const phraseKey: TranslationKey =
		phraseIndex < 0 ? "chompy.hello" : (PHRASES[phraseIndex] ?? "chompy.hello");

	return (
		<div className="gd-intro-stage relative mx-auto aspect-square w-[min(480px,100%)] max-lg:w-[min(360px,86%)]">
			<div
				aria-hidden="true"
				className="gd-outline gd-shadow-9 gd-blob-a absolute inset-[6%_4%_10%_2%] rounded-[46%_54%_55%_45%/52%_44%_56%_48%] bg-(--gd-sun)"
			/>
			<div
				aria-hidden="true"
				className="gd-outline-thin gd-blob-b absolute start-[-6%] bottom-[2%] aspect-square w-[34%] rounded-[57%_43%_44%_56%/49%_58%_42%_51%] bg-(--gd-mint)"
			/>
			<div
				aria-hidden="true"
				className="gd-outline-thin gd-bob absolute end-[-2%] top-[8%] aspect-square w-[14%] rounded-full bg-primary"
			/>
			<svg
				viewBox="0 0 300 300"
				aria-hidden="true"
				focusable="false"
				className="gd-spin pointer-events-none absolute inset-[-7%]"
			>
				<defs>
					<path
						id="gd-ring-path"
						d="M150,150 m-138,0 a138,138 0 1,1 276,0 a138,138 0 1,1 -276,0"
						fill="none"
					/>
				</defs>
				<text className="fill-(--gd-teal) font-bold font-display text-[15.5px] tracking-[0.32em]">
					<textPath href="#gd-ring-path">{t("chompy.ring")}</textPath>
				</text>
			</svg>
			<div className="absolute inset-[12%_13%_10%_13%] flex items-center justify-center">
				<div className="gd-wiggle w-full">
					<button
						type="button"
						aria-label={t("chompy.label")}
						onClick={celebrate}
						onPointerEnter={() => setIsGrinning(true)}
						onPointerLeave={() => setIsGrinning(false)}
						onFocus={() => setIsGrinning(true)}
						onBlur={() => setIsGrinning(false)}
						className="gd-float block w-full cursor-pointer touch-manipulation rounded-[40%] focus-visible:outline-offset-8"
					>
						<ChompyFace
							isGrinning={isGrinning}
							svgRef={svgRef}
							bodyRef={bodyRef}
						/>
					</button>
				</div>
			</div>
			{bursts.map((id) => (
				<ConfettiBurst
					key={id}
					onDone={() =>
						setBursts((current) => current.filter((burst) => burst !== id))
					}
				/>
			))}
			<span
				aria-hidden="true"
				className={cn(
					DISPLAY,
					"gd-outline-thin gd-shadow-4 gd-intro-sticker absolute start-[-4%] top-[2%] z-20 -rotate-8 whitespace-nowrap rounded-full bg-primary px-[1em] py-[0.5em] font-bold text-[clamp(0.74rem,1.2vw,0.85rem)] text-primary-foreground [animation-delay:0.9s] max-lg:start-0",
				)}
			>
				{t("chompy.stickerCartoon")}
			</span>
			<span
				aria-hidden="true"
				className={cn(
					DISPLAY,
					"gd-outline-thin gd-shadow-4 gd-intro-sticker absolute end-[-3%] bottom-[5%] z-20 rotate-5 whitespace-nowrap rounded-full bg-(--gd-teal) px-[1em] py-[0.5em] font-bold text-[clamp(0.74rem,1.2vw,0.85rem)] text-background [animation-delay:1.02s] max-lg:end-0",
				)}
			>
				{t("chompy.stickerSaturday")}
			</span>
			{/* The bubble speaks for Chompy. A new key on each press replays its pop. */}
			<p
				key={phraseIndex}
				aria-live="polite"
				className={cn(
					DISPLAY,
					"gd-outline-thin gd-shadow-4 gd-bubble gd-bubble-small absolute end-[2%] top-[-6%] z-20 max-w-[200px] rotate-3 rounded-[calc(var(--radius)*1.125)] bg-card px-[1em] py-[0.55em] text-center font-bold text-[clamp(0.82rem,1.3vw,0.95rem)] leading-snug",
					phraseIndex < 0
						? "gd-intro-sticker [animation-delay:1.14s]"
						: "gd-bubble-pop",
				)}
			>
				{t(phraseKey)}
			</p>
		</div>
	);
}
