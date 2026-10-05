/**
 * The ideas wall of the landing page (section id "examples"). It shows the
 * 12 IDEAS as app icons on a home screen, with a caption bubble between the
 * two halves. The bubble types the sentence of the hovered idea. A click sends
 * the idea to the hero through `onUseIdea`. pages/landing-page.tsx renders it.
 */

import type { TargetPlatform } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	BookOpenCheck,
	ChefHat,
	Dumbbell,
	Footprints,
	HandHeart,
	Languages,
	ListChecks,
	type LucideIcon,
	QrCode,
	ReceiptText,
	Scissors,
	Stethoscope,
	Sun,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useDictionary, useTranslation } from "@/lib/i18n";

import { IDEAS, type IdeaId, SECTION_TITLE_CLASS } from "../lib/constants";
import { KeycapButton } from "./keycap-button";

type IdeasProps = {
	/** Fills the hero prompt box with an idea and scrolls up to it. */
	onUseIdea: (platform: TargetPlatform, text: string) => void;
};

type Idea = (typeof IDEAS)[number];

type AppIconLook = {
	glyph: LucideIcon;
	/** Top-left color of the tile gradient, a CSS color. */
	from: string;
	/** Bottom-right color of the tile gradient, a CSS color. */
	to: string;
	/** Color of the glyph on the tile. */
	ink: string;
	/** Color of the soft drop shadow under the tile, with alpha. */
	glow: string;
};

// Each idea is a different app, so each icon has its own palette.
const APP_ICON_LOOKS = {
	barber: {
		glyph: Scissors,
		from: "#2a2a2a",
		to: "#050505",
		ink: "#e3b55f",
		glow: "rgb(0 0 0 / 0.45)",
	},
	invoices: {
		glyph: ReceiptText,
		from: "#ffffff",
		to: "#e6defe",
		ink: "#6d4aff",
		glow: "rgb(109 74 255 / 0.35)",
	},
	running: {
		glyph: Footprints,
		from: "#e6ff6b",
		to: "#a6dc12",
		ink: "#16181d",
		glow: "rgb(134 180 0 / 0.45)",
	},
	yoga: {
		glyph: Sun,
		from: "#fbf3e8",
		to: "#ead2b2",
		ink: "#c8553d",
		glow: "rgb(200 85 61 / 0.3)",
	},
	clinic: {
		glyph: Stethoscope,
		from: "#3ee0cb",
		to: "#0c8f80",
		ink: "#ffffff",
		glow: "rgb(12 143 128 / 0.45)",
	},
	darija: {
		glyph: Languages,
		from: "#2fd27a",
		to: "#0a7a3f",
		ink: "#ffffff",
		glow: "rgb(10 122 63 / 0.42)",
	},
	checkin: {
		glyph: QrCode,
		from: "#5a2bb8",
		to: "#22094f",
		ink: "#ff9fe2",
		glow: "rgb(60 18 130 / 0.45)",
	},
	gym: {
		glyph: Dumbbell,
		from: "#ff6aa4",
		to: "#d9105f",
		ink: "#ffffff",
		glow: "rgb(217 16 95 / 0.4)",
	},
	tasks: {
		glyph: ListChecks,
		from: "#6fd3ff",
		to: "#1677ff",
		ink: "#ffffff",
		glow: "rgb(22 119 255 / 0.4)",
	},
	recipes: {
		glyph: ChefHat,
		from: "#fff6dc",
		to: "#ffd47a",
		ink: "#c2410c",
		glow: "rgb(214 140 0 / 0.38)",
	},
	volunteers: {
		glyph: HandHeart,
		from: "#ff7a66",
		to: "#e02f24",
		ink: "#ffffff",
		glow: "rgb(224 47 36 / 0.4)",
	},
	homework: {
		glyph: BookOpenCheck,
		from: "#7486ff",
		to: "#3341d8",
		ink: "#ffffff",
		glow: "rgb(51 65 216 / 0.4)",
	},
} as const satisfies Record<IdeaId, AppIconLook>;

// 3.2 s per idea: enough to read a sentence after it types out.
const TOUR_STEP_MS = 3200;
// 16 ms per character: about 1.2 s for the longest sentence (73 characters).
const TYPE_STEP_MS = 16;

/** Where the bubble tail points. `x` is in px from the physical left of the bubble. */
type BubbleTail = { x: number; side: "top" | "bottom" | "none" };

// A 40 x 18 soft spike that points up. The bottom tail is this path flipped.
const TAIL_PATH =
	"M0 18C9 18 13.5 14 16.5 7C18 3.5 19 1 20 1C21 1 22 3.5 23.5 7C26.5 14 31 18 40 18Z";

/** The home screen of ideas. Section id `examples` is a nav and footer target. */
export function Ideas({ onUseIdea }: IdeasProps) {
	const landing = useDictionary().landing;
	const { t } = useTranslation();
	const reduceMotion = useReducedMotion();
	const idPrefix = useId();

	const sectionRef = useRef<HTMLElement>(null);
	const homeScreenRef = useRef<HTMLDivElement>(null);
	const bubbleRef = useRef<HTMLDivElement>(null);
	// 20 %: on a phone the section is about twice the screen height.
	const isSectionInView = useInView(sectionRef, { amount: 0.2 });
	// 40 %: the jiggle starts when most of the first row shows. A phone can still reach 40 % of the wall.
	const isHomeScreenInView = useInView(homeScreenRef, {
		once: true,
		amount: 0.4,
	});

	const [activeIdea, setActiveIdea] = useState<Idea>(IDEAS[0]);
	const [isTourOver, setIsTourOver] = useState(false);
	const [tail, setTail] = useState<BubbleTail>({ x: 0, side: "none" });

	// A touch screen has no hover. The tour shows each sentence until the
	// visitor points at or focuses an icon.
	useEffect(() => {
		if (!isSectionInView || reduceMotion || isTourOver) return;
		const timer = window.setInterval(() => {
			setActiveIdea(
				(current) => IDEAS[(IDEAS.indexOf(current) + 1) % IDEAS.length],
			);
		}, TOUR_STEP_MS);
		return () => window.clearInterval(timer);
	}, [isSectionInView, reduceMotion, isTourOver]);

	// The grid reflows at each breakpoint, so the tail position is measured.
	useLayoutEffect(() => {
		const homeScreen = homeScreenRef.current;
		const bubble = bubbleRef.current;
		if (!homeScreen || !bubble) return;
		const measure = () => {
			const cell = homeScreen.querySelector(
				`[data-idea-id="${activeIdea.id}"]`,
			);
			if (!cell) return;
			const cellBox = cell.getBoundingClientRect();
			const bubbleBox = bubble.getBoundingClientRect();
			const x = cellBox.left + cellBox.width / 2 - bubbleBox.left;
			// Only a row next to the bubble gets the tail. A tail across a row
			// of icons points at the wrong icon.
			const reach = cellBox.height / 2;
			const gapAbove = bubbleBox.top - cellBox.bottom;
			const gapBelow = cellBox.top - bubbleBox.bottom;
			if (gapAbove >= 0 && gapAbove < reach) setTail({ x, side: "top" });
			else if (gapBelow >= 0 && gapBelow < reach)
				setTail({ x, side: "bottom" });
			else setTail({ x, side: "none" });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(homeScreen);
		return () => observer.disconnect();
	}, [activeIdea]);

	const pointAt = (idea: Idea) => {
		setActiveIdea(idea);
		setIsTourOver(true);
	};
	const activeItem = landing.ideas.items[activeIdea.id];

	/** One half of the wall: 2 rows of 3 on a phone, 1 row of 6 above. */
	const renderIcons = (ideas: readonly Idea[], firstIndex: number) => (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-6 md:gap-x-6">
			{ideas.map((idea, offset) => {
				const item = landing.ideas.items[idea.id];
				const isActive = idea.id === activeIdea.id;
				return (
					<li key={idea.id} data-idea-id={idea.id}>
						<motion.button
							type="button"
							aria-label={t("landing.ideas.use", { name: item.name })}
							aria-describedby={`${idPrefix}-${idea.id}`}
							// A touch fires pointerenter also when it starts a scroll. That must not stop the tour.
							onPointerEnter={(event) => {
								if (event.pointerType !== "touch") pointAt(idea);
							}}
							onFocus={() => pointAt(idea)}
							onClick={() => onUseIdea(idea.platform, item.text)}
							// On the button, not on a span: motion makes a non-focusable
							// element with whileTap focusable, which adds a second Tab stop.
							whileTap={{ scale: 0.94 }}
							className="flex min-h-11 w-full cursor-pointer flex-col items-center rounded-[1.75rem] px-1 pt-2 pb-1 text-center outline-ember focus-visible:outline-2 focus-visible:outline-offset-2"
						>
							{/* The active icon floats up a little, like an icon picked up on a phone. */}
							<motion.span
								className="block w-full max-w-[5.25rem] sm:max-w-[4.75rem] md:max-w-[5.5rem] lg:max-w-[7.5rem]"
								initial={false}
								animate={{
									y: isActive ? -8 : 0,
									scale: isActive ? 1.06 : 1,
								}}
								// A firm spring: the icon settles in about 0.3 s, with a small overshoot.
								transition={{ type: "spring", stiffness: 420, damping: 24 }}
							>
								{/* The jiggle of iOS edit mode, once, when the wall first shows.
								    A 50 ms step per icon makes it run across the wall like a wave. */}
								<motion.span
									className="block"
									animate={
										isHomeScreenInView
											? { rotate: [0, -3.5, 3, -2.5, 2, -1, 0] }
											: undefined
									}
									transition={{
										duration: 0.75,
										delay: 0.15 + (firstIndex + offset) * 0.05,
										ease: "easeInOut",
									}}
								>
									<AppIcon id={idea.id} isLifted={isActive} />
								</motion.span>
							</motion.span>
							{/* Two lines tall for every name, so the platform labels of a row line up. */}
							<span className="mt-3 line-clamp-2 min-h-[2.5em] text-balance font-semibold text-night text-sm leading-tight md:text-base">
								{item.name}
							</span>
							<span className="mt-1 text-night/60 text-xs">
								{landing.ideas.platforms[idea.platform]}
							</span>
						</motion.button>
					</li>
				);
			})}
		</ul>
	);

	return (
		<section
			ref={sectionRef}
			id="examples"
			// The nav link moves the focus here. The section shows no focus ring.
			// The title names the section, so a screen reader reads it on that focus.
			tabIndex={-1}
			aria-labelledby={`${idPrefix}-title`}
			className="scroll-mt-20 py-24 outline-none md:py-36"
		>
			<div className="mx-auto max-w-7xl px-4 md:px-8">
				<div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
					<h2
						id={`${idPrefix}-title`}
						className={cn(SECTION_TITLE_CLASS, "lg:col-span-7")}
					>
						{landing.ideas.title}
					</h2>
					<p className="max-w-xl text-lg text-night/70 leading-relaxed md:text-xl lg:col-span-5 lg:pb-1">
						{landing.ideas.sub}
					</p>
				</div>

				{/* Two halves of icons with the caption between them, like a widget
				    on a home screen. Every icon is then one row from the caption. */}
				<div ref={homeScreenRef} className="mt-14 md:mt-20">
					{renderIcons(IDEAS.slice(0, 6), 0)}

					<div
						ref={bubbleRef}
						className="relative my-10 rounded-[1.75rem] bg-night p-5 text-white md:my-12 md:rounded-[2.25rem] md:p-9 lg:flex lg:items-center lg:gap-10 lg:ps-10"
					>
						{/* Physical coordinates: tail.x comes from getBoundingClientRect.
						    The tail overlaps the bubble by 1 px, so no seam shows between them. */}
						{(["top", "bottom"] as const).map((side) => (
							<div
								key={side}
								aria-hidden="true"
								dir="ltr"
								className={`pointer-events-none absolute inset-x-0 h-[18px] ${side === "top" ? "-top-[17px]" : "-bottom-[17px] -scale-y-100"}`}
							>
								<motion.svg
									viewBox="0 0 40 18"
									className="absolute top-0 h-[18px] w-10 fill-night"
									initial={false}
									animate={{
										x: tail.x - 20,
										opacity: tail.side === side ? 1 : 0,
									}}
									// A soft spring with no overshoot: the tail glides to the next icon.
									transition={{ type: "spring", stiffness: 260, damping: 28 }}
								>
									<path d={TAIL_PATH} />
								</motion.svg>
							</div>
						))}

						{/* All sentences share one grid cell. The bubble takes the height
						    of the longest one, so the icons below never jump. */}
						<div className="grid lg:flex-1">
							{IDEAS.map((idea) => {
								const isActive = idea.id === activeIdea.id;
								const text = landing.ideas.items[idea.id].text;
								return (
									<div
										key={idea.id}
										aria-hidden={!isActive}
										className={`flex items-start gap-4 transition-opacity duration-200 [grid-area:1/1] md:gap-6 lg:self-center ${isActive ? "opacity-100" : "opacity-0"}`}
									>
										<AppIcon
											id={idea.id}
											className="mt-1 w-11 shrink-0 md:w-14"
										/>
										<p
											id={`${idPrefix}-${idea.id}`}
											className="font-bold text-[clamp(1.375rem,2.7vw,2.5rem)] leading-[1.12] tracking-[-0.03em] rtl:leading-[1.55] rtl:tracking-normal"
										>
											<span className="text-white/65">
												{landing.hero.leadStart}{" "}
											</span>
											{/* An inset spark edge, not a text underline: an underline cuts the dots under Arabic letters. */}
											<span className="whitespace-nowrap rounded-[0.35em] bg-white/10 px-[0.28em] shadow-[inset_0_-0.08em_0_var(--color-spark)]">
												{landing.hero.platforms[idea.platform]}
											</span>{" "}
											{isActive && !reduceMotion ? (
												<TypedText key={idea.id} text={text} />
											) : (
												text
											)}
										</p>
									</div>
								);
							})}
						</div>

						<KeycapButton
							type="button"
							aria-label={t("landing.ideas.use", { name: activeItem.name })}
							onPointerEnter={() => setIsTourOver(true)}
							onFocus={() => setIsTourOver(true)}
							onClick={() => onUseIdea(activeIdea.platform, activeItem.text)}
							className="mt-6 lg:mt-0"
						>
							<ArrowUp className="size-5" strokeWidth={2.25} />
							{landing.ideas.useButton}
						</KeycapButton>
					</div>

					{renderIcons(IDEAS.slice(6), 6)}
				</div>
			</div>
		</section>
	);
}

/** A squircle app tile. The width comes from the parent or `className`. */
function AppIcon({
	id,
	isLifted = false,
	className,
}: {
	id: IdeaId;
	/** True when the tile floats above the wall, so its shadow grows. */
	isLifted?: boolean;
	className?: string;
}) {
	const look = APP_ICON_LOOKS[id];
	const Glyph = look.glyph;
	return (
		<span
			aria-hidden="true"
			className={`relative block aspect-square rounded-[28%] ${className ?? "w-full"}`}
			style={{
				backgroundImage: `radial-gradient(120% 90% at 22% 8%, rgb(255 255 255 / 0.32), transparent 52%), linear-gradient(155deg, ${look.from}, ${look.to})`,
				// The hairline ring keeps the light tiles (invoices, yoga, recipes) visible on paper.
				boxShadow: `inset 0 0 0 1px rgb(11 16 51 / 0.06), inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -3px 8px rgb(0 0 0 / 0.1), 0 12px 22px -14px ${look.glow}`,
			}}
		>
			{/* A deeper shadow fades in on lift. Opacity is cheaper to animate than box-shadow. */}
			<span
				className={`absolute inset-0 rounded-[inherit] transition-opacity duration-300 ${isLifted ? "opacity-100" : "opacity-0"}`}
				style={{ boxShadow: `0 26px 36px -16px ${look.glow}` }}
			/>
			<Glyph
				className="absolute inset-0 m-auto size-[46%]"
				color={look.ink}
				strokeWidth={1.75}
			/>
		</span>
	);
}

/** Types `text` one character at a time, with a spark caret while it types. */
function TypedText({ text }: { text: string }) {
	const [length, setLength] = useState(0);

	useEffect(() => {
		if (length >= text.length) return;
		const timer = window.setTimeout(() => setLength(length + 1), TYPE_STEP_MS);
		return () => window.clearTimeout(timer);
	}, [length, text.length]);

	const isTyping = length < text.length;
	return (
		<>
			{text.slice(0, length)}
			{isTyping ? (
				// Zero width, so the caret never pushes a word to the next line.
				<span
					aria-hidden="true"
					className="relative inline-block h-[0.9em] w-0 align-[-0.1em]"
				>
					<span className="absolute inset-y-0 start-0 w-[0.08em] rounded-full bg-spark" />
				</span>
			) : null}
			{/* The rest keeps its space, so the lines do not reflow while typing. */}
			<span className="text-transparent">{text.slice(length)}</span>
		</>
	);
}
