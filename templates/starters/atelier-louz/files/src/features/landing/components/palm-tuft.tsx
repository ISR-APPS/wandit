// A flat palm silhouette for the drawn scenes: one curved stem and a fan of leaves.
// ArcadeScene, RoomVignette, and ProjectScene place it inside their SVG.

// Leaves from right to left: [angle in degrees, length as a share of `leaf`].
// The fan opens upward. The side leaves are longer than the top leaves, as on a real fan palm.
const LEAVES = [
	[-14, 1],
	[-46, 0.96],
	[-80, 0.88],
	[-112, 0.88],
	[-144, 0.96],
	[-172, 1],
] as const;

/**
 * An SVG group in palm green. `x` and `y` are the foot of the stem in the parent viewBox units.
 * `leaf` is the length of one leaf; the stem is about twice as tall.
 */
export function PalmTuft({
	x,
	y,
	leaf,
}: {
	x: number;
	y: number;
	leaf: number;
}) {
	const stem = leaf * 2.1;
	const leafWidth = leaf * 0.15;
	return (
		<g transform={`translate(${x},${y - stem})`}>
			<path
				d={`M0 ${stem} Q ${leaf * 0.15} ${stem * 0.4} ${leaf * 0.04} 0`}
				fill="none"
				stroke="var(--louz-palm)"
				strokeWidth={leaf * 0.16}
				strokeLinecap="round"
			/>
			<g fill="var(--louz-palm)">
				{LEAVES.map(([angle, share]) => (
					<ellipse
						key={angle}
						cx={leaf * share * 0.96}
						cy={0}
						rx={leaf * share}
						ry={leafWidth}
						transform={`rotate(${angle})`}
					/>
				))}
			</g>
		</g>
	);
}
