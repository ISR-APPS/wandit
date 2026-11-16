// A brass pendant lamp with a lit bulb, for the drawn scenes: a cord, a half-dome shade, and a glow.
// ArcadeScene, RoomVignette, and ProjectScene place it inside their SVG.
import { useId } from "react";

/**
 * An SVG group. `x` is the cord line in the parent viewBox units. The cord hangs from y 0
 * and is `cord` units long. `shade` is the radius of the dome.
 */
export function HangingLamp({
	x,
	cord,
	shade,
}: {
	x: number;
	cord: number;
	shade: number;
}) {
	const haloId = `${useId()}-halo`;
	const base = cord + shade * 0.85;
	const band = shade * 0.3;
	const bulb = base + band + shade * 0.3;
	return (
		<g transform={`translate(${x},0)`}>
			<defs>
				<radialGradient id={haloId}>
					<stop offset="0" stopColor="var(--louz-glow)" stopOpacity={0.75} />
					<stop offset="1" stopColor="var(--louz-glow)" stopOpacity={0} />
				</radialGradient>
			</defs>
			<circle cx={0} cy={bulb} r={shade * 2.4} fill={`url(#${haloId})`} />
			<line
				x1={0}
				y1={0}
				x2={0}
				y2={base - shade}
				stroke="var(--foreground)"
				strokeOpacity={0.4}
				strokeWidth={3}
			/>
			<path
				d={`M${-shade} ${base} A${shade} ${shade} 0 0 1 ${shade} ${base} L${shade} ${base + band} H${-shade} Z`}
				fill="var(--louz-brass)"
			/>
			<circle cx={0} cy={bulb} r={shade * 0.28} fill="var(--louz-glow)" />
		</g>
	);
}
