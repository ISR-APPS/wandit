// The drawn scene of one delivered project, in a large arched frame: an enfilade, a patio, or a café counter.
// ProjectsSection renders each one twice: in the pinned column on desktop, and above its text on a phone.
import { type ReactNode, useId } from "react";
import { HangingLamp } from "./hanging-lamp";
import { PalmTuft } from "./palm-tuft";

/** The three projects of the page, in scroll order. */
type ProjectSceneId = "enfilade" | "patio" | "counter";

// The zellige band of the patio: 19 tiles on two rows. Every fifth tile takes another glaze.
const PATIO_TILE_COLUMNS = Array.from({ length: 19 }, (_, column) => column);
const PATIO_TILE_TONES = [
	"var(--louz-palm-soft)",
	"var(--louz-palm)",
	"var(--louz-palm-bright)",
	"var(--louz-palm-soft)",
	"var(--louz-palm)",
];
// Brick rows of the café floor: [x, y] of each lighter brick.
const COUNTER_BRICKS = [
	[60, 536],
	[180, 536],
	[300, 536],
	[420, 536],
	[540, 536],
	[0, 568],
	[120, 568],
	[240, 568],
	[360, 568],
	[480, 568],
] as const;

/** One project scene, 640 by 600 viewBox units. `label` is the room description for a screen reader. */
export function ProjectScene({
	scene,
	label,
}: {
	scene: ProjectSceneId;
	label: string;
}) {
	const id = useId();
	const archId = `${id}-arch`;
	const glowId = `${id}-glow`;
	const haloId = `${id}-halo`;
	return (
		<svg
			viewBox="0 0 640 600"
			role="img"
			aria-label={label}
			className="h-auto max-h-full w-full"
		>
			<defs>
				<clipPath id={archId}>
					<path d="M30 600 V286 A290 244 0 0 1 610 286 V600 Z" />
				</clipPath>
				<linearGradient id={glowId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="var(--louz-glow)" />
					<stop offset=".6" stopColor="var(--louz-sun-mid)" />
					<stop offset="1" stopColor="var(--louz-sun-low)" />
				</linearGradient>
				<radialGradient id={haloId}>
					<stop offset="0" stopColor="var(--louz-glow)" stopOpacity={0.8} />
					<stop offset="1" stopColor="var(--louz-glow)" stopOpacity={0} />
				</radialGradient>
			</defs>
			<g clipPath={`url(#${archId})`}>{layersOf(scene, glowId, haloId)}</g>
			<path
				d="M30 598 V286 A290 244 0 0 1 610 286 V598"
				fill="none"
				stroke="var(--foreground)"
				strokeOpacity={0.5}
				strokeWidth={3}
			/>
		</svg>
	);
}

/** The drawn layers of one scene, inside the arch clip. `glowId` is the window light, `haloId` the lamp halo. */
function layersOf(
	scene: ProjectSceneId,
	glowId: string,
	haloId: string,
): ReactNode {
	switch (scene) {
		case "enfilade":
			return (
				<>
					<rect width={640} height={600} fill="var(--louz-wall)" />
					<path
						d="M170 566 V306 A150 132 0 0 1 470 306 V566 Z"
						fill="var(--louz-wall-deep)"
					/>
					<path
						d="M214 566 V336 A106 94 0 0 1 426 336 V566 Z"
						fill="color-mix(in oklab, var(--louz-wall-deep) 70%, var(--louz-brass))"
					/>
					<path
						d="M254 566 V362 A66 60 0 0 1 386 362 V566 Z"
						fill={`url(#${glowId})`}
					/>
					<rect
						x={30}
						y={530}
						width={580}
						height={70}
						fill="var(--louz-walnut)"
					/>
					<g stroke="var(--foreground)" strokeOpacity={0.25} strokeWidth={2}>
						<line x1={120} y1={530} x2={104} y2={600} />
						<line x1={240} y1={530} x2={232} y2={600} />
						<line x1={400} y1={530} x2={408} y2={600} />
						<line x1={520} y1={530} x2={536} y2={600} />
					</g>
					<line
						x1={30}
						y1={531}
						x2={610}
						y2={531}
						stroke="var(--foreground)"
						strokeOpacity={0.3}
						strokeWidth={3}
					/>
					<polygon
						points="258,532 382,532 448,600 192,600"
						fill="var(--louz-sun-mid)"
						opacity={0.55}
					/>
					{/* Two brass wall lights on each side of the first arch. */}
					<g transform="translate(96,320)">
						<circle cx={0} cy={40} r={62} fill={`url(#${haloId})`} />
						<path
							d="M-24 22 A24 24 0 0 1 24 22 L24 30 H-24 Z"
							fill="var(--louz-brass)"
						/>
						<circle cx={0} cy={40} r={7} fill="var(--louz-glow)" />
					</g>
					<g transform="translate(544,320)">
						<circle cx={0} cy={40} r={62} fill={`url(#${haloId})`} />
						<path
							d="M-24 22 A24 24 0 0 1 24 22 L24 30 H-24 Z"
							fill="var(--louz-brass)"
						/>
						<circle cx={0} cy={40} r={7} fill="var(--louz-glow)" />
					</g>
				</>
			);
		case "patio":
			return (
				<>
					<rect width={640} height={600} fill="var(--louz-wall)" />
					<path
						d="M150 430 V306 A70 62 0 0 1 290 306 V430 Z"
						fill={`url(#${glowId})`}
					/>
					<path
						d="M350 430 V306 A70 62 0 0 1 490 306 V430 Z"
						fill={`url(#${glowId})`}
					/>
					<PalmTuft x={232} y={430} leaf={32} />
					{/* A lantern over the patio. Its light falls on the zellige. */}
					<HangingLamp x={320} cord={150} shade={24} />
					<circle cx={420} cy={340} r={16} fill="var(--louz-glow)" />
					<circle
						cx={420}
						cy={340}
						r={26}
						fill="var(--louz-glow)"
						opacity={0.35}
					/>
					<path
						d="M150 430 V306 A70 62 0 0 1 290 306 V430"
						fill="none"
						stroke="var(--foreground)"
						strokeOpacity={0.22}
						strokeWidth={7}
					/>
					<path
						d="M350 430 V306 A70 62 0 0 1 490 306 V430"
						fill="none"
						stroke="var(--foreground)"
						strokeOpacity={0.22}
						strokeWidth={7}
					/>
					<rect
						x={30}
						y={430}
						width={580}
						height={10}
						fill="var(--louz-brass)"
					/>
					<rect
						x={30}
						y={440}
						width={580}
						height={64}
						fill="var(--background)"
					/>
					{[444, 474].map((y, row) =>
						PATIO_TILE_COLUMNS.map((column) => (
							<rect
								key={`${y}-${column}`}
								x={34 + column * 30}
								y={y}
								width={26}
								height={26}
								rx={2}
								fill={
									PATIO_TILE_TONES[(column + row * 2) % PATIO_TILE_TONES.length]
								}
							/>
						)),
					)}
					<rect x={30} y={504} width={580} height={96} fill="var(--primary)" />
					<g stroke="var(--foreground)" strokeOpacity={0.16} strokeWidth={2}>
						{[130, 230, 330, 430, 530].map((x) => (
							<line key={x} x1={x} y1={504} x2={x} y2={600} />
						))}
					</g>
					{/* The round basin of the patio, with a glint of water. */}
					<path
						d="M244 600 A76 64 0 0 1 396 600 Z"
						fill="var(--louz-palm-soft)"
					/>
					<ellipse
						cx={320}
						cy={576}
						rx={42}
						ry={8}
						fill="var(--background)"
						opacity={0.3}
					/>
				</>
			);
		case "counter":
			return (
				<>
					<rect width={640} height={600} fill="var(--louz-wall-deep)" />
					<HangingLamp x={200} cord={242} shade={28} />
					<HangingLamp x={320} cord={206} shade={28} />
					<HangingLamp x={440} cord={242} shade={28} />
					{/* The menu board: an arch with three chalk lines. */}
					<g transform="translate(88,300)">
						<path
							d="M0 96 V26 A34 26 0 0 1 68 26 V96 Z"
							fill="var(--louz-walnut-deep)"
							opacity={0.85}
						/>
						<line
							x1={12}
							y1={44}
							x2={56}
							y2={44}
							stroke="var(--background)"
							strokeOpacity={0.7}
							strokeWidth={3}
						/>
						<line
							x1={12}
							y1={58}
							x2={48}
							y2={58}
							stroke="var(--background)"
							strokeOpacity={0.55}
							strokeWidth={3}
						/>
						<line
							x1={12}
							y1={72}
							x2={52}
							y2={72}
							stroke="var(--background)"
							strokeOpacity={0.55}
							strokeWidth={3}
						/>
					</g>
					<rect
						x={140}
						y={372}
						width={360}
						height={24}
						rx={9}
						fill="var(--louz-walnut)"
					/>
					<rect
						x={152}
						y={396}
						width={336}
						height={140}
						fill="var(--louz-clay-deep)"
					/>
					{[180, 292, 404].map((x) => (
						<path
							key={x}
							d={`M${x} 536 V478 A28 26 0 0 1 ${x + 56} 478 V536 Z`}
							fill="var(--louz-clay-deeper)"
						/>
					))}
					{/* A cup and a small vase on the counter. */}
					<g transform="translate(238,352)">
						<path d="M0 20 A10 10 0 0 0 20 20 Z" fill="var(--background)" />
						<rect
							x={2}
							y={14}
							width={16}
							height={4}
							rx={2}
							fill="var(--louz-brass)"
						/>
					</g>
					<path
						d="M392 372 C384 364 386 354 390 351 L389 346 L395 346 L394 351 C398 354 400 364 392 372 Z"
						fill="var(--louz-palm)"
					/>
					<rect
						x={30}
						y={536}
						width={580}
						height={64}
						fill="var(--louz-clay)"
					/>
					<g fill="var(--louz-sun-low)" opacity={0.55}>
						{COUNTER_BRICKS.map(([x, y]) => (
							<rect key={`${x}-${y}`} x={x} y={y} width={60} height={32} />
						))}
					</g>
					{/* A stool in woven alfa. */}
					<g transform="translate(556,430)">
						<ellipse cx={0} cy={0} rx={30} ry={9} fill="var(--louz-fibre)" />
						<rect
							x={-4}
							y={6}
							width={8}
							height={70}
							fill="var(--louz-walnut-deep)"
						/>
						<path
							d="M-22 76 H22"
							stroke="var(--louz-walnut-deep)"
							strokeWidth={6}
							strokeLinecap="round"
						/>
					</g>
				</>
			);
	}
}
