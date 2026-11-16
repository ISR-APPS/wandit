// PL·05, the method as one dimension chain: five spans measured in weeks, and the total of the first four below.
// LandingPage renders it after the missions. It reads METHOD_PHASES of lib/content.ts.
// From 860px the chain spans the width and the phases hang under it in five columns.
// On a phone the chain hides and the phases form a vertical rail, each with its duration.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { METHOD_PHASES } from "../lib/content";
import { BODY, LABEL, SECTION } from "../lib/styles";
import { ARROW_MARKER } from "./arrow-marker-defs";
import { SectionHead } from "./section-head";

// Each span of the chain is 240 viewBox units wide, from x = 0 to x = 1200.
// The ticks then fall near the starts of the five phase columns under the chain.
const SPAN_UNITS = 240;
// The plot window class of each span, in drawing order.
const SPAN_STEPS = [
	"plot-seq-1",
	"plot-seq-2",
	"plot-seq-3",
	"plot-seq-4",
	"plot-seq-5",
] as const;

/** The chain is decoration for screen readers: the phase list under it says the same. */
export function MethodSection() {
	const { t } = useT();
	const ticks = Array.from(
		{ length: METHOD_PHASES.length + 1 },
		(_, index) => index * SPAN_UNITS,
	);
	// The total runs over the four phases before the site, from the first tick to the fifth.
	const totalEnd = 4 * SPAN_UNITS;
	return (
		<section
			id="method"
			aria-labelledby="method-title"
			className={`${SECTION} ns-paper-2 border-foreground/15 border-y`}
		>
			<div className="ns-wrap">
				<SectionHead
					folio="method.folio"
					title="method.title"
					titleId="method-title"
				/>
				<div data-reveal className="ns-figure hidden min-[53.75rem]:block">
					<svg
						aria-hidden="true"
						focusable="false"
						viewBox="0 0 1200 130"
						className="ns-drawing"
					>
						<g className="plot-step plot-ticks">
							{ticks.map((x) => {
								const isTotalEdge = x === 0 || x === totalEnd;
								return (
									<line
										key={x}
										className="ns-ink-1 plot"
										pathLength={1}
										x1={x}
										y1="38"
										x2={x}
										y2={isTotalEdge ? 124 : 82}
									/>
								);
							})}
						</g>
						{METHOD_PHASES.map((phase, index) => {
							const x1 = index * SPAN_UNITS;
							return (
								<g
									key={phase.span}
									className={`plot-step ${SPAN_STEPS[index]}`}
								>
									<line
										className="ns-ink-1 plot"
										pathLength={1}
										x1={x1}
										y1="60"
										x2={x1 + SPAN_UNITS}
										y2="60"
										markerStart={ARROW_MARKER}
										markerEnd={ARROW_MARKER}
									/>
									<text
										x={x1 + SPAN_UNITS / 2}
										y="28"
										className="ns-t12 uppercase"
										textAnchor="middle"
									>
										{t(phase.span)}
									</text>
								</g>
							);
						})}
						<g className="plot-step plot-labels">
							<line
								className="ns-ink-1 fade"
								x1={0}
								y1="116"
								x2={totalEnd}
								y2="116"
								markerStart={ARROW_MARKER}
								markerEnd={ARROW_MARKER}
							/>
							<text
								x={totalEnd / 2}
								y="106"
								className="ns-t12 uppercase"
								textAnchor="middle"
							>
								{t("method.total")}
							</text>
						</g>
					</svg>
				</div>
				<ol className="grid grid-cols-1 border-foreground border-s-[1.5px] ps-6 min-[53.75rem]:mt-6 min-[53.75rem]:grid-cols-5 min-[53.75rem]:gap-5 min-[53.75rem]:border-s-0 min-[53.75rem]:ps-0">
					{METHOD_PHASES.map((phase) => (
						<li
							key={phase.tag}
							data-reveal
							className={cn(
								"ns-rise relative py-4 min-[53.75rem]:py-0",
								// On a phone a short ink tick joins each phase to the rail.
								"before:absolute before:-start-[calc(1.5rem+5px)] before:top-[1.6rem] before:h-[1.5px] before:w-[9px] before:bg-foreground min-[53.75rem]:before:hidden",
							)}
						>
							<span
								className={`${LABEL} font-normal text-[0.625rem] text-foreground/60`}
							>
								{t(phase.tag)}
							</span>
							<h3 className="ns-title mt-1.5 mb-1.5 font-bold text-[1.05rem] tracking-[-0.01em]">
								{t(phase.name)}
							</h3>
							<p className={`${BODY} text-[0.9rem] leading-[1.6]`}>
								{t(phase.body)}
							</p>
							<span
								className={`${LABEL} mt-2.5 inline-block border border-foreground/35 px-2 py-0.5 font-normal text-[0.625rem] min-[53.75rem]:hidden`}
							>
								{t(phase.duration)}
							</span>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
