// The rising smoke line of the menu: one thin ember path in a sticky rail, with a glowing base and a tip.
// MenuSection renders it beside the slates. use-smoke-scrub.ts draws the path and moves the tip with the scroll.
// With no script the path is fully drawn. The CSS mask makes its top thin out and dissolve.

// The plume: a slow S-curve from the base (60, 1000) to the top (63, 0) of a 120 x 1000 box.
const SMOKE_PATH =
	"M60 1000 C 60 940 44 906 47 860 C 50 812 80 786 76 738 C 72 690 40 664 44 616 C 48 566 82 542 76 494 C 70 446 38 420 44 372 C 50 324 84 300 77 252 C 70 206 42 182 49 136 C 55 96 74 74 68 34 C 65 18 62 10 63 0";

/** The rail. It is decoration only, so screen readers skip it. The world allows one smoke path per page. */
export function SmokeRail() {
	return (
		<div className="br-smoke" aria-hidden="true">
			<div className="br-smoke__in">
				<svg
					viewBox="0 0 120 1000"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
					focusable="false"
					className="br-smoke__svg"
				>
					<defs>
						<filter
							id="br-ember-blur"
							x="-120%"
							y="-120%"
							width="340%"
							height="340%"
						>
							<feGaussianBlur stdDeviation="7" />
						</filter>
					</defs>
					<path
						data-smoke-path
						d={SMOKE_PATH}
						fill="none"
						strokeWidth="1.5"
						strokeLinecap="round"
						className="br-smoke__path"
					/>
					{/* The tip starts at the top end, under the mask. The scrub moves it to the drawn end. */}
					<circle
						data-smoke-tip
						cx="63"
						cy="0"
						r="15"
						opacity="0.28"
						filter="url(#br-ember-blur)"
						className="br-smoke__glow"
					/>
					<circle
						data-smoke-tip
						cx="63"
						cy="0"
						r="3.4"
						className="br-smoke__tip"
					/>
				</svg>
				<span aria-hidden="true" className="br-smoke__base" />
			</div>
		</div>
	);
}
