// The drawn living room of the material library: a wall, a niche with a vase, a sunlit arched window, a sofa, and a rug.
// MaterialsSection renders it. The layers with `louz-room-layer` read the --louz-room-* colors of the chosen material.
import { useId } from "react";
import { useT } from "~/shared/i18n";
import { HangingLamp } from "./hanging-lamp";
import { PalmTuft } from "./palm-tuft";

// The x positions of the floor board joints, in viewBox units.
const FLOOR_JOINTS = [140, 260, 380, 500, 620];

/** The living room in an arched frame, 720 by 620 viewBox units. Its colors follow the page root. */
export function RoomVignette() {
	const { t } = useT();
	const id = useId();
	const sunId = `${id}-sun`;
	const archId = `${id}-arch`;
	return (
		<svg
			viewBox="0 0 720 620"
			role="img"
			aria-label={t("materials.roomLabel")}
			className="h-auto w-full"
		>
			<defs>
				<linearGradient id={sunId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="var(--louz-glow)" />
					<stop offset=".55" stopColor="var(--louz-sun-mid)" />
					<stop offset="1" stopColor="var(--louz-sun-low)" />
				</linearGradient>
				<clipPath id={archId}>
					<path d="M30 620 L30 310 A330 272 0 0 1 690 310 L690 620 Z" />
				</clipPath>
			</defs>
			<g clipPath={`url(#${archId})`}>
				<rect
					className="louz-room-layer"
					x={20}
					y={0}
					width={680}
					height={620}
					fill="var(--louz-room-wall)"
				/>
				{/* The niche with its vase, on the left wall. */}
				<path
					d="M97 330 L97 250 A44 40 0 0 1 185 250 L185 330 Z"
					fill="var(--foreground)"
					opacity={0.1}
				/>
				<path
					className="louz-tint-fill"
					d="M141 328 C124 312 127 291 136 284 L135 272 L147 272 L146 284 C155 291 158 312 141 328 Z"
				/>
				{/* The arched window with the sun inside it. */}
				<path
					d="M440 472 L440 296 A105 90 0 0 1 650 296 L650 472 Z"
					fill={`url(#${sunId})`}
				/>
				<circle cx={500} cy={330} r={22} fill="var(--louz-glow)" />
				<circle
					cx={500}
					cy={330}
					r={36}
					fill="var(--louz-glow)"
					opacity={0.3}
				/>
				<PalmTuft x={576} y={470} leaf={36} />
				<path
					d="M440 472 L440 296 A105 90 0 0 1 650 296 L650 472"
					fill="none"
					stroke="var(--foreground)"
					strokeOpacity={0.22}
					strokeWidth={10}
				/>
				{/* The floor, its joints, and the light that falls from the window. */}
				<rect
					className="louz-room-layer"
					x={20}
					y={472}
					width={680}
					height={150}
					fill="var(--louz-room-floor)"
				/>
				<g stroke="var(--foreground)" strokeOpacity={0.14} strokeWidth={2}>
					{FLOOR_JOINTS.map((x) => (
						<line key={x} x1={x} y1={472} x2={x} y2={622} />
					))}
				</g>
				<line
					x1={20}
					y1={473}
					x2={700}
					y2={473}
					stroke="var(--foreground)"
					strokeOpacity={0.25}
					strokeWidth={3}
				/>
				<polygon
					points="446,474 646,474 700,606 392,606"
					fill="var(--louz-glow)"
					opacity={0.4}
				/>
				{/* The rug with two pale stripes. */}
				<path
					className="louz-room-layer"
					d="M60 596 L96 528 H448 L484 596 Z"
					fill="var(--louz-room-rug)"
				/>
				<path
					d="M67 583 L479 583"
					stroke="var(--background)"
					strokeWidth={6}
					opacity={0.5}
				/>
				<path
					d="M84 551 L462 551"
					stroke="var(--background)"
					strokeWidth={5}
					opacity={0.45}
				/>
				<ellipse
					cx={270}
					cy={524}
					rx={200}
					ry={10}
					fill="var(--foreground)"
					opacity={0.13}
				/>
				{/* The sofa: an arched back, a seat, three cushions. */}
				<rect
					className="louz-room-layer"
					x={110}
					y={352}
					width={320}
					height={90}
					rx={36}
					fill="var(--louz-room-sofa)"
				/>
				<rect
					className="louz-room-layer"
					x={102}
					y={420}
					width={336}
					height={66}
					rx={24}
					fill="var(--louz-room-sofa)"
				/>
				<rect
					x={102}
					y={420}
					width={336}
					height={66}
					rx={24}
					fill="var(--background)"
					opacity={0.09}
				/>
				<rect
					className="louz-room-layer"
					x={140}
					y={376}
					width={80}
					height={58}
					rx={15}
					fill="var(--louz-room-cushion)"
				/>
				<rect
					className="louz-tint-fill"
					x={234}
					y={376}
					width={80}
					height={58}
					rx={15}
				/>
				<circle
					cx={366}
					cy={404}
					r={29}
					fill="var(--background)"
					opacity={0.92}
				/>
				<rect
					x={122}
					y={486}
					width={14}
					height={20}
					rx={5}
					fill="var(--louz-walnut-deep)"
				/>
				<rect
					x={404}
					y={486}
					width={14}
					height={20}
					rx={5}
					fill="var(--louz-walnut-deep)"
				/>
				<HangingLamp x={270} cord={118} shade={32} />
			</g>
			<path
				d="M30 618 L30 310 A330 272 0 0 1 690 310 L690 618"
				fill="none"
				stroke="var(--foreground)"
				strokeOpacity={0.5}
				strokeWidth={3}
			/>
		</svg>
	);
}
