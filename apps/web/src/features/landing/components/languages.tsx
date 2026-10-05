/**
 * The languages section of the landing page (section id "languages"). A
 * radiogroup shows the barber mini app in English, French or Arabic. Each
 * switch replays the layout change as a glide, so Arabic visibly mirrors.
 * pages/landing-page.tsx renders it. It uses DeviceFrame, FitScreen and MiniApp.
 */

import { cn } from "@wandit/ui/lib/utils";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import {
	type Direction,
	getDir,
	type Locale,
	localeMeta,
	locales,
	useDictionary,
} from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";
import { DeviceFrame } from "./device-frame";
import { FitScreen } from "./fit-screen";
import { MINI_APP_SIZE, MiniApp } from "./mini-apps";

/** Time on each language while the section auto-advances. Long enough to read the mirrored screen. */
const AUTO_ADVANCE_MS = 3500;
/** Duration of one element glide from its old place to its new place. */
const GLIDE_MS = 900;
/**
 * The glide starts at the top of the screen and reaches the tab bar this much later.
 * Each glide uses fill "backwards", so a block holds its old place during its delay.
 */
const GLIDE_STAGGER_MS = 220;
/** Ease in and out, so each element leaves and lands softly. */
const GLIDE_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
/** A move shorter than this, in design px, is a rounding difference, not a glide. */
const MIN_MOVE_PX = 0.5;
/** The sun behind the phone crosses over a little slower than the screen, so it trails it. */
const DISC_GLIDE = { type: "spring", bounce: 0.15, duration: 1.2 } as const;
/** The dark thumb of the picker slides to the chosen option. */
const THUMB_GLIDE = { type: "spring", bounce: 0.18, duration: 0.6 } as const;

/** The edge of its parent that a box keeps during a glide. */
type Anchor = "left" | "center" | "right";

/** Left and right edges of the whole mini app screen, in design px. */
const SCREEN_BOX = { left: 0, right: MINI_APP_SIZE.mobile.width };

/** Box of one element of the mini app screen, in design px from the screen's top left corner. */
type ScreenBox = {
	element: Element;
	left: number;
	right: number;
	/** Vertical center. */
	y: number;
};

/**
 * Measures the box of every element of the screen, in document order.
 * Paths and shapes inside an icon move with their <svg>, so they are left out.
 */
function measureScreen(screen: HTMLElement): ScreenBox[] {
	const origin = screen.getBoundingClientRect();
	if (origin.width === 0) return [];
	// FitScreen scales the 360 px design screen. The glide runs in design px.
	const scale = origin.width / MINI_APP_SIZE.mobile.width;
	return Array.from(screen.querySelectorAll("*"))
		.filter(
			(element) =>
				!(element instanceof SVGElement) || element instanceof SVGSVGElement,
		)
		.map((element) => {
			const rect = element.getBoundingClientRect();
			return {
				element,
				left: (rect.left - origin.left) / scale,
				right: (rect.right - origin.left) / scale,
				y: (rect.top + rect.height / 2 - origin.top) / scale,
			};
		});
}

/**
 * FLIP glide: every element of the new screen starts where its twin was on
 * the old screen and glides home. The twins match by document order, because
 * MiniApp renders the same tree in every language. Returns the running glides.
 * `appDir` is the direction of the new language.
 */
function glideToNewLayout(
	screen: HTMLElement,
	before: ScreenBox[],
	appDir: Direction,
): Animation[] {
	const after = measureScreen(screen);
	const isSameTree =
		after.length === before.length &&
		after.every(
			(box, index) => box.element.tagName === before[index].element.tagName,
		);
	// A different tree has no twins to glide from: the new screen shows at once.
	if (!isSameTree) return [];

	const indexOf = new Map(after.map((box, index) => [box.element, index]));
	// One entry per element. Document order puts each parent before its children.
	const anchors: Anchor[] = [];
	const moves: { x: number; y: number }[] = [];
	/** Start delay of each element in a gliding block; null when it stays in place. */
	const delays: (number | null)[] = [];
	const glides: Animation[] = [];

	after.forEach((box, index) => {
		const twin = before[index];
		const parent = box.element.parentElement;
		const parentIndex = parent ? indexOf.get(parent) : undefined;
		const parentTwin =
			parentIndex === undefined ? SCREEN_BOX : before[parentIndex];

		// The text changes width with the language. The new box starts flush with
		// the parent edge that the old box was near. Thus it stays inside the parent.
		// `offset` is twice the distance of the old center from the parent center,
		// so 2 is 1 design px. A box within 2 px of the parent width fills it.
		const offset =
			twin.left + twin.right - (parentTwin.left + parentTwin.right);
		const fillsParent =
			twin.right - twin.left >= parentTwin.right - parentTwin.left - 2;
		let anchor: Anchor = "center";
		if (fillsParent) {
			// A box as wide as its parent has no near edge: it follows the parent.
			anchor = parentIndex === undefined ? "center" : anchors[parentIndex];
		} else if (offset < -2) {
			anchor = "left";
		} else if (offset > 2) {
			anchor = "right";
		}
		anchors[index] = anchor;
		let x = (twin.left + twin.right - (box.left + box.right)) / 2;
		if (anchor === "left") x = twin.left - box.left;
		if (anchor === "right") x = twin.right - box.right;
		const move = { x, y: twin.y - box.y };
		moves[index] = move;

		const parentDelay = parentIndex === undefined ? null : delays[parentIndex];
		if (parentIndex !== undefined && parentDelay !== null) {
			// Inside a gliding block: the child glides only by its offset to the
			// parent, on the same clock, so the two moves add up exactly.
			delays[index] = parentDelay;
			const childX = move.x - moves[parentIndex].x;
			const childY = move.y - moves[parentIndex].y;
			if (Math.abs(childX) < MIN_MOVE_PX && Math.abs(childY) < MIN_MOVE_PX) {
				return;
			}
			glides.push(
				box.element.animate(
					[
						{ transform: `translate(${childX}px, ${childY}px)` },
						{ transform: "translate(0px, 0px)" },
					],
					{
						duration: GLIDE_MS,
						delay: parentDelay,
						easing: GLIDE_EASING,
						fill: "backwards",
					},
				),
			);
			return;
		}

		if (Math.abs(move.x) < MIN_MOVE_PX && Math.abs(move.y) < MIN_MOVE_PX) {
			delays[index] = null;
			return;
		}

		// A block that glides on its own. Mirrored blocks cross the middle of the screen.
		// They pass at two depths, like cards on a carousel.
		// Blocks that move to the start side of the new language pass in front.
		const delay = (box.y / MINI_APP_SIZE.mobile.height) * GLIDE_STAGGER_MS;
		delays[index] = delay;
		const isFront = appDir === "rtl" ? move.x < 0 : move.x > 0;
		// 0 for a small shift (English to French), 1 for a move across half the screen.
		const depth = Math.min(
			1,
			Math.abs(move.x) / (MINI_APP_SIZE.mobile.width / 2),
		);
		// Halfway, a front block is 10% larger. A back block is 24% smaller and 80% faded.
		const middleScale = isFront ? 1 + 0.1 * depth : 1 - 0.24 * depth;
		const middleOpacity = isFront ? 1 : 1 - 0.8 * depth;
		const zIndex = isFront ? 2 : 1;
		glides.push(
			box.element.animate(
				[
					{
						transform: `translate(${move.x}px, ${move.y}px) scale(1)`,
						opacity: 1,
						zIndex,
					},
					{
						transform: `translate(${move.x / 2}px, ${move.y / 2}px) scale(${middleScale})`,
						opacity: middleOpacity,
						zIndex,
					},
					{ transform: "translate(0px, 0px) scale(1)", opacity: 1, zIndex },
				],
				{ duration: GLIDE_MS, delay, easing: GLIDE_EASING, fill: "backwards" },
			),
		);
	});

	return glides;
}

/** Shows the same app in three languages. Arabic mirrors the layout. */
export function Languages() {
	const landing = useDictionary().landing;
	const titleId = useId();
	const sectionRef = useRef<HTMLElement>(null);
	const screenRef = useRef<HTMLDivElement>(null);
	/** Screen measured just before a switch. The layout effect glides from it. */
	const beforeRef = useRef<ScreenBox[] | null>(null);
	const glidesRef = useRef<Animation[]>([]);
	const [appLanguage, setAppLanguage] = useState<Locale>("en");
	const [isAutoPlaying, setIsAutoPlaying] = useState(true);
	// The tour runs while about a third of the section shows.
	const isInView = useInView(sectionRef, { amount: 0.35 });
	const reduceMotion = useReducedMotion();
	// The tour stops for good after the first focus or pick. It never runs with reduced motion.
	const isTouring = isAutoPlaying && isInView && !reduceMotion;
	const isAppRtl = getDir(appLanguage) === "rtl";

	function showLanguage(next: Locale) {
		if (next === appLanguage) return;
		// Measure the old screen now: after the render, its layout is gone.
		if (!reduceMotion && screenRef.current) {
			beforeRef.current = measureScreen(screenRef.current);
		}
		setAppLanguage(next);
	}

	function showNextLanguage() {
		const index = locales.indexOf(appLanguage);
		showLanguage(locales[(index + 1) % locales.length]);
	}

	useLayoutEffect(() => {
		const before = beforeRef.current;
		const screen = screenRef.current;
		beforeRef.current = null;
		if (!before || !screen) return;
		// A new switch during a glide starts from where the elements are now.
		for (const glide of glidesRef.current) glide.cancel();
		glidesRef.current = glideToNewLayout(screen, before, getDir(appLanguage));
	}, [appLanguage]);

	return (
		<section
			ref={sectionRef}
			id="languages"
			aria-labelledby={titleId}
			className="scroll-mt-20 overflow-x-clip py-24 md:py-36"
		>
			<div className="mx-auto grid max-w-7xl items-center gap-16 px-4 md:px-8 lg:grid-cols-12 lg:gap-8">
				<div className="lg:col-span-6">
					<h2 id={titleId} className={SECTION_TITLE_CLASS}>
						{landing.languages.title}
					</h2>
					<p className="mt-6 max-w-xl text-lg text-night/70 leading-relaxed md:text-xl">
						{landing.languages.body}
					</p>

					{/* Native radios: the browser moves the choice with the arrow keys. */}
					<div
						role="radiogroup"
						aria-label={landing.languages.pickerLabel}
						// Focus stops the tour, so the checked radio does not change under the keyboard.
						onFocus={() => setIsAutoPlaying(false)}
						className="mt-10 grid w-full grid-cols-3 rounded-full bg-night/[0.06] p-1.5 sm:inline-grid sm:w-auto md:mt-12"
					>
						{locales.map((locale) => {
							const isChecked = locale === appLanguage;
							return (
								<label
									key={locale}
									// The label picks the font of its language. No dir here: the
									// arrow keys must follow the direction of the page.
									lang={locale}
									className={cn(
										"relative flex h-12 cursor-pointer items-center justify-center rounded-full px-4 font-semibold text-base outline-ember transition-colors duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 md:h-14 md:px-7 md:text-lg",
										isChecked ? "text-paper" : "text-night/65 hover:text-night",
									)}
								>
									<input
										type="radio"
										name={`${titleId}-language`}
										value={locale}
										checked={isChecked}
										onChange={() => showLanguage(locale)}
										// A click or an arrow key also fires on the current option. Both stop the tour.
										onClick={() => setIsAutoPlaying(false)}
										// Invisible but as large as the segment, so a touch screen reader
										// finds the radio where the visitor sees it.
										className="absolute inset-0 z-10 cursor-pointer rounded-full opacity-0"
									/>
									{isChecked ? (
										<motion.span
											layoutId={`${titleId}-thumb`}
											transition={THUMB_GLIDE}
											className="absolute inset-0 overflow-hidden rounded-full bg-night shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--color-night)_60%,transparent)]"
										>
											{isTouring ? (
												// The bar fills while this language shows, in its reading direction.
												// When it is full, the next language shows.
												<motion.span
													initial={{ scaleX: 0 }}
													animate={{ scaleX: 1 }}
													transition={{
														duration: AUTO_ADVANCE_MS / 1000,
														ease: "linear",
													}}
													onAnimationComplete={showNextLanguage}
													className={cn(
														"absolute inset-x-5 bottom-[7px] h-0.5 rounded-full bg-spark",
														isAppRtl ? "origin-right" : "origin-left",
													)}
												/>
											) : null}
										</motion.span>
									) : null}
									<span className="relative">
										{localeMeta[locale].nativeLabel}
									</span>
								</label>
							);
						})}
					</div>
				</div>

				<div aria-hidden="true" className="flex justify-center lg:col-span-6">
					<div className="relative w-[16rem] sm:w-[17.5rem] lg:w-[18rem] xl:w-[21rem]">
						{/*
						 * A sun and its outline, a mirror pair. The sun sits on the reading
						 * start side of the app; the two swap sides when the app mirrors.
						 */}
						<motion.div
							initial={false}
							animate={{ x: isAppRtl ? "-20%" : "20%" }}
							transition={DISC_GLIDE}
							className="absolute -inset-x-[10%] top-[12%] aspect-square rounded-full border-[1.5px] border-night/12"
						/>
						<motion.div
							initial={false}
							animate={{ x: isAppRtl ? "20%" : "-20%" }}
							transition={DISC_GLIDE}
							className="absolute -inset-x-[10%] top-[12%] aspect-square rounded-full bg-spark"
						/>
						<DeviceFrame platform="mobile" className="w-full">
							<FitScreen
								width={MINI_APP_SIZE.mobile.width}
								height={MINI_APP_SIZE.mobile.height}
							>
								<div ref={screenRef}>
									<MiniApp id="barber" language={appLanguage} />
								</div>
							</FitScreen>
						</DeviceFrame>
					</div>
				</div>
			</div>
		</section>
	);
}
