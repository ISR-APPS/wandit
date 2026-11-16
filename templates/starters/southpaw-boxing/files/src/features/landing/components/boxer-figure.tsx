// The poster illustration: a cut-paper boxer in southpaw stance who throws a jab.
// hero-poster.tsx renders it. It reads the halftone pattern of grit-defs.tsx and the theme colors.
import { BoxerBody } from "./boxer-body";
import { Burst } from "./burst";

/** The boxer illustration. `label` is its text for screen readers. */
export function BoxerFigure({ label }: { label: string }) {
	return (
		<svg
			viewBox="0 0 520 540"
			role="img"
			aria-label={label}
			className="h-auto w-full"
		>
			<ellipse
				cx="264"
				cy="522"
				rx="195"
				ry="11"
				className="fill-foreground/8"
			/>
			<Burst className="sp-gold opacity-60" box={{ x: 30, y: 88, size: 150 }} />
			<g transform="rotate(-2 260 280)">
				<BoxerBody className="sp-fig-mass" />
				<BoxerBody className="opacity-50" fill="url(#sp-dots-figure)" />
				<BoxerBody className="sp-fig-rim" />
				{/* headgear */}
				<path
					d="M279 100 A 30 30 0 0 1 337 100"
					fill="none"
					strokeWidth="11"
					strokeLinecap="round"
					className="stroke-primary"
				/>
				<circle cx="326" cy="110" r="9" className="fill-primary" />
				{/* waistband and trunk stripe */}
				<polygon
					points="250,284 340,296 337,318 247,306"
					className="fill-primary"
				/>
				<polygon
					points="286,306 296,307 288,368 278,367"
					className="fill-foreground/55"
				/>
				{/* cuffs */}
				<rect
					x="128"
					y="146"
					width="14"
					height="38"
					className="fill-foreground/85"
				/>
				<polygon
					points="318,168 344,162 348,178 322,184"
					className="fill-foreground/85"
				/>
				{/* gloves */}
				<g className="fill-primary">
					<circle cx="104" cy="164" r="29" />
					<circle cx="86" cy="170" r="16" />
					<circle cx="116" cy="186" r="11" />
					<circle cx="326" cy="146" r="25" />
					<circle cx="344" cy="163" r="10" />
				</g>
				<path
					d="M88 148 A 24 24 0 0 1 118 142"
					fill="none"
					strokeWidth="3"
					strokeLinecap="round"
					className="stroke-foreground/50"
				/>
				{/* speed lines */}
				<g strokeWidth="5" strokeLinecap="round" className="stroke-primary/50">
					<line x1="18" y1="128" x2="52" y2="136" />
					<line x1="10" y1="164" x2="40" y2="164" />
					<line x1="18" y1="200" x2="52" y2="192" />
				</g>
			</g>
		</svg>
	);
}
