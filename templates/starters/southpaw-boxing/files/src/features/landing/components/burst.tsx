// The twelve-ray burst of the poster corners and of the boxer's lead glove.
// hero-poster.tsx and boxer-figure.tsx render it. It takes the text color of its parent.

/** The angle of each ray, in degrees. Twelve rays, one for each 30 degrees. */
const RAY_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

type BurstProps = {
	/** Size, color, and position classes. */
	className?: string;
	/** Inside another SVG: the square that the burst fills, in the units of that SVG. */
	box?: { x: number; y: number; size: number };
};

/** A decorative burst. Hidden from screen readers. */
export function Burst({ className, box }: BurstProps) {
	return (
		<svg
			viewBox="-50 -50 100 100"
			aria-hidden="true"
			focusable="false"
			className={className}
			x={box?.x}
			y={box?.y}
			width={box?.size}
			height={box?.size}
		>
			<g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
				{RAY_ANGLES.map((angle) => (
					<line
						key={angle}
						x1="0"
						y1="-46"
						x2="0"
						y2="-22"
						transform={`rotate(${angle})`}
					/>
				))}
			</g>
			<circle r="6" fill="currentColor" />
		</svg>
	);
}
