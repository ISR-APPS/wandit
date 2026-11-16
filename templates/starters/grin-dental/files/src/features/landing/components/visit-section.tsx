// The first visit: a teal scene between two scallops, with four step stickers on a dotted path.
// LandingPage renders it after the services. From 1024px the path draws itself while the section scrolls by,
// and a small tooth walks on it (hooks/use-visit-path.ts). Under 1024px the steps stack along a dashed line.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useVisitPath } from "../hooks/use-visit-path";
import { VISIT_STEPS } from "../lib/content";
import { SECTION_LEDE, SECTION_TITLE, TAG, WRAP } from "../lib/styles";
import { DoodleStar } from "./doodle-star";
import { ScallopEdge } from "./scallop-edge";
import { StepCard } from "./step-card";

/** The path through the four stops, in the 1200 x 760 space of the stage. */
const VISIT_PATH =
	"M70,110 C300,20 640,240 950,150 C1180,80 1180,340 950,400 C760,447 420,330 300,460 C210,575 420,660 640,630 C830,605 980,540 1100,640 C1130,666 1145,685 1150,700";

/** The place and tilt of each step card on the stage from 1024px, and the fill and tilt of its icon tile. */
const STEP_LAYOUT = [
	{
		placeClass:
			"[--gd-r:-2deg] lg:absolute lg:start-[2%] lg:top-[1%] lg:w-[31%]",
		iconClass: "rotate-8 bg-(--gd-sun)",
	},
	{
		placeClass:
			"[--gd-r:1.6deg] lg:absolute lg:start-[64%] lg:top-[9%] lg:w-[31%]",
		iconClass: "-rotate-7 bg-(--gd-mint)",
	},
	{
		placeClass:
			"[--gd-r:1.4deg] lg:absolute lg:start-[9%] lg:top-[50%] lg:w-[31%]",
		iconClass: "rotate-6 bg-(--gd-peach)",
	},
	{
		placeClass:
			"[--gd-r:-1.8deg] lg:absolute lg:start-[60%] lg:top-[63%] lg:w-[31%]",
		iconClass: "-rotate-8 bg-primary",
	},
] as const;

/** The teal band with its head, the stage, and the scallops. The stats row overlaps its bottom edge. */
export function VisitSection() {
	const { t } = useT();
	const stageRef = useRef<HTMLDivElement>(null);
	const pathRef = useRef<SVGPathElement>(null);
	const walkerRef = useRef<SVGGElement>(null);
	useVisitPath(stageRef, pathRef, walkerRef);
	return (
		<>
			<ScallopEdge fillClass="fill-(--gd-teal)" />
			<section
				id="visit"
				aria-labelledby="visit-title"
				className="gd-on-dark relative scroll-mt-24 bg-(--gd-teal) pt-[clamp(2.5rem,5vw,4.5rem)] pb-30 text-background max-lg:pb-26"
			>
				<div className={WRAP}>
					<div
						data-pop="self"
						className="mx-auto mb-[clamp(3rem,5vw,4.2rem)] max-w-[880px] text-center"
					>
						<p
							className={cn(
								TAG,
								"mb-4 -rotate-[2.5deg] bg-(--gd-sun) text-foreground",
							)}
						>
							{t("visit.tag")}
						</p>
						<h2
							id="visit-title"
							className={cn(
								SECTION_TITLE,
								"mb-3 text-[clamp(2.4rem,5.2vw,4.4rem)] leading-[1] tracking-[-0.02em]",
							)}
						>
							{t("visit.title")}
						</h2>
						<p
							className={cn(
								SECTION_LEDE,
								"mx-auto max-w-[600px] text-background/85",
							)}
						>
							{t("visit.lede")}
						</p>
					</div>
					<div
						ref={stageRef}
						className="gd-visit-stage relative mx-auto max-w-[560px] lg:aspect-[1200/760] lg:max-w-[1200px]"
					>
						<svg
							viewBox="0 0 1200 760"
							preserveAspectRatio="none"
							aria-hidden="true"
							focusable="false"
							className="absolute inset-0 size-full max-lg:hidden"
						>
							<defs>
								<mask id="gd-visit-mask" maskUnits="userSpaceOnUse">
									<path
										d={VISIT_PATH}
										pathLength={1}
										fill="none"
										strokeWidth="34"
										strokeLinecap="round"
										className="gd-visit-reveal stroke-background"
									/>
								</mask>
							</defs>
							<path
								ref={pathRef}
								d={VISIT_PATH}
								fill="none"
								strokeWidth="7"
								strokeLinecap="round"
								strokeDasharray="0.5 22"
								mask="url(#gd-visit-mask)"
								className="stroke-background"
							/>
							{/* The walker tooth starts at the first stop. use-visit-path moves it along the path. */}
							<g ref={walkerRef} transform="translate(70 110)">
								<path
									d="M0,-22 C-15,-22 -26,-13 -26,1 C-26,12 -21,19 -16,30 C-14,37 -5,38 -3,31 C-2,28 -1,26 0,26 C1,26 2,28 3,31 C5,38 14,37 16,30 C21,19 26,12 26,1 C26,-13 15,-22 0,-22 Z"
									strokeWidth="3.5"
									className="fill-card stroke-foreground"
								/>
								<circle cx="-8" cy="-2" r="2.6" className="fill-foreground" />
								<circle cx="8" cy="-2" r="2.6" className="fill-foreground" />
								<path
									d="M-8,8 q8,7 16,0"
									fill="none"
									strokeWidth="3"
									strokeLinecap="round"
									className="stroke-foreground"
								/>
							</g>
						</svg>
						{/* On a phone the end padding keeps the 7px card shadows inside the page gutter. */}
						<ol
							aria-label={t("visit.stepsLabel")}
							className="grid gap-10 border-background/50 border-s-[3px] border-dashed ps-7 max-sm:pe-1.5 lg:contents"
						>
							{VISIT_STEPS.map((step, index) => (
								<StepCard
									key={step.titleKey}
									step={step}
									number={index + 1}
									placeClass={STEP_LAYOUT[index]?.placeClass ?? ""}
									iconClass={STEP_LAYOUT[index]?.iconClass ?? ""}
								/>
							))}
						</ol>
						<DoodleStar className="absolute start-[45%] top-[5%] w-10 -rotate-12 fill-(--gd-sun) max-lg:hidden" />
						<DoodleStar className="absolute start-[3%] top-[34%] w-8.5 rotate-14 fill-primary max-lg:hidden" />
						<DoodleStar className="absolute start-[44%] top-[84%] w-11 rotate-10 fill-background max-lg:hidden" />
						<svg
							viewBox="0 0 60 40"
							aria-hidden="true"
							focusable="false"
							className="pointer-events-none absolute start-[46%] top-[42%] w-14.5 max-lg:hidden"
						>
							<circle
								cx="14"
								cy="26"
								r="9"
								fill="none"
								strokeWidth="3"
								className="stroke-background opacity-85"
							/>
							<circle
								cx="36"
								cy="14"
								r="6"
								fill="none"
								strokeWidth="3"
								className="stroke-background opacity-65"
							/>
							<circle
								cx="50"
								cy="28"
								r="4"
								fill="none"
								strokeWidth="2.6"
								className="stroke-background opacity-50"
							/>
						</svg>
						<svg
							viewBox="0 0 80 90"
							aria-hidden="true"
							focusable="false"
							className="pointer-events-none absolute end-[1.5%] bottom-[2%] w-18.5 rotate-6 max-lg:hidden"
						>
							<path
								d="M18 6v78"
								strokeWidth="5"
								strokeLinecap="round"
								className="stroke-background"
							/>
							<path
								d="M22 10h44l-10 12 10 12H22Z"
								strokeWidth="3"
								strokeLinejoin="round"
								className="fill-(--gd-sun) stroke-foreground"
							/>
							<path
								d="M32 22h18"
								strokeWidth="3"
								strokeLinecap="round"
								className="stroke-foreground"
							/>
						</svg>
					</div>
				</div>
			</section>
			<ScallopEdge fillClass="fill-(--gd-teal)" flip />
		</>
	);
}
