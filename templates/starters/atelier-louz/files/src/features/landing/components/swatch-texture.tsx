// One drawn material sample in an arch-topped tile: plaster strokes, a tile grid, wood grain, a weave, brass sheen, or linen.
// MaterialsSection renders one per swatch button. Each texture is flat SVG with token colors.
import { type ReactNode, useId } from "react";
import type { MaterialId } from "../lib/materials";

// Zellige tiles that get another glaze tone: [x, y, color]. The jitter makes the grid read as handmade.
const ZELLIGE_ACCENTS = [
	[31.5, 31.5, "var(--louz-palm-soft)"],
	[61.5, 91.5, "var(--louz-palm)"],
	[1.5, 91.5, "var(--louz-palm-bright)"],
	[91.5, 61.5, "var(--louz-palm-soft)"],
	[61.5, 1.5, "var(--louz-palm-bright)"],
] as const;

/** The texture of `material` in a 120 by 150 arched tile. It is decorative: the button carries the name. */
export function SwatchTexture({ material }: { material: MaterialId }) {
	const id = useId();
	const clipId = `${id}-clip`;
	const patternId = `${id}-pattern`;
	return (
		<svg
			viewBox="0 0 120 150"
			aria-hidden="true"
			focusable="false"
			className="h-auto w-full"
		>
			<defs>
				<clipPath id={clipId}>
					<path d="M0 150 V62 A60 54 0 0 1 120 62 V150 Z" />
				</clipPath>
				{patternDefinition(material, patternId)}
			</defs>
			<g clipPath={`url(#${clipId})`}>{textureOf(material, patternId)}</g>
			<path
				d="M1 150 V62 A59 53 0 0 1 119 62 V150"
				fill="none"
				stroke="var(--foreground)"
				strokeOpacity={0.45}
				strokeWidth={2}
			/>
		</svg>
	);
}

/** The <pattern> or <linearGradient> that a texture fills with, or nothing. */
function patternDefinition(material: MaterialId, patternId: string): ReactNode {
	switch (material) {
		case "zellige":
			return (
				<pattern
					id={patternId}
					width={30}
					height={30}
					patternUnits="userSpaceOnUse"
				>
					<rect width={30} height={30} fill="var(--background)" />
					<rect
						x={1.5}
						y={1.5}
						width={27}
						height={27}
						rx={2}
						fill="var(--louz-palm-soft)"
						opacity={0.85}
					/>
				</pattern>
			);
		case "alfa":
			return (
				<pattern
					id={patternId}
					width={32}
					height={32}
					patternUnits="userSpaceOnUse"
				>
					<rect width={32} height={32} fill="var(--louz-brass)" />
					<rect
						x={0}
						y={1}
						width={15}
						height={14}
						rx={2}
						fill="var(--louz-fibre)"
					/>
					<rect
						x={0}
						y={5.5}
						width={15}
						height={5}
						fill="var(--louz-brass)"
						opacity={0.35}
					/>
					<rect
						x={17}
						y={1}
						width={14}
						height={15}
						rx={2}
						fill="var(--louz-sun-mid)"
					/>
					<rect
						x={22}
						y={1}
						width={4.5}
						height={15}
						fill="var(--louz-brass)"
						opacity={0.35}
					/>
					<rect
						x={17}
						y={17}
						width={15}
						height={14}
						rx={2}
						fill="var(--louz-fibre)"
					/>
					<rect
						x={17}
						y={21.5}
						width={15}
						height={5}
						fill="var(--louz-brass)"
						opacity={0.35}
					/>
					<rect
						x={0}
						y={17}
						width={14}
						height={15}
						rx={2}
						fill="var(--louz-sun-mid)"
					/>
					<rect
						x={5}
						y={17}
						width={4.5}
						height={15}
						fill="var(--louz-brass)"
						opacity={0.35}
					/>
				</pattern>
			);
		case "brass":
			return (
				<linearGradient id={patternId} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="var(--louz-brass-deep)" />
					<stop offset=".28" stopColor="var(--louz-fibre)" />
					<stop offset=".5" stopColor="var(--louz-brass)" />
					<stop offset=".74" stopColor="var(--louz-sun-mid)" />
					<stop offset="1" stopColor="var(--louz-brass-deep)" />
				</linearGradient>
			);
		case "linen":
			return (
				<pattern
					id={patternId}
					width={7}
					height={7}
					patternUnits="userSpaceOnUse"
				>
					<rect width={7} height={7} fill="var(--louz-linen)" />
					<rect
						y={3}
						width={7}
						height={1.6}
						fill="var(--louz-linen-deep)"
						opacity={0.45}
					/>
					<rect
						x={3}
						width={1.6}
						height={7}
						fill="var(--louz-linen-deep)"
						opacity={0.3}
					/>
				</pattern>
			);
		default:
			return null;
	}
}

/** The drawn layers of one texture, inside the arch clip. */
function textureOf(material: MaterialId, patternId: string): ReactNode {
	switch (material) {
		case "tadelakt":
			return (
				<>
					<rect width={120} height={150} fill="var(--louz-wall-deep)" />
					<path
						d="M-20 42 Q60 12 140 52"
						stroke="var(--louz-brass)"
						strokeWidth={16}
						fill="none"
						opacity={0.28}
					/>
					<path
						d="M-20 92 Q60 62 140 102"
						stroke="var(--louz-brass)"
						strokeWidth={16}
						fill="none"
						opacity={0.22}
					/>
					<path
						d="M-20 138 Q60 112 140 144"
						stroke="var(--louz-brass)"
						strokeWidth={14}
						fill="none"
						opacity={0.25}
					/>
					<ellipse
						cx={40}
						cy={56}
						rx={42}
						ry={26}
						fill="var(--primary-foreground)"
						opacity={0.18}
					/>
				</>
			);
		case "zellige":
			return (
				<>
					<rect width={120} height={150} fill={`url(#${patternId})`} />
					{ZELLIGE_ACCENTS.map(([x, y, color]) => (
						<rect
							key={`${x}-${y}`}
							x={x}
							y={y}
							width={27}
							height={27}
							rx={2}
							fill={color}
						/>
					))}
					<ellipse
						cx={45}
						cy={40}
						rx={8}
						ry={4}
						fill="var(--primary-foreground)"
						opacity={0.32}
					/>
					<ellipse
						cx={75}
						cy={100}
						rx={8}
						ry={4}
						fill="var(--primary-foreground)"
						opacity={0.28}
					/>
					<ellipse
						cx={15}
						cy={70}
						rx={7}
						ry={3.5}
						fill="var(--primary-foreground)"
						opacity={0.26}
					/>
				</>
			);
		case "walnut":
			return (
				<>
					<rect width={120} height={150} fill="var(--louz-walnut)" />
					<g stroke="var(--louz-walnut-deep)" strokeWidth={2.2} fill="none">
						<path d="M60 150 C 40 118 40 74 60 46 C 80 74 80 118 60 150" />
						<path d="M60 150 C 30 112 30 60 60 24 C 90 60 90 112 60 150" />
						<path d="M60 150 C 20 106 20 44 60 4 C 100 44 100 106 60 150" />
						<path d="M14 0 C 20 50 8 100 16 150" />
						<path d="M104 0 C 110 52 98 102 108 150" />
					</g>
					<ellipse
						cx={60}
						cy={82}
						rx={6}
						ry={11}
						fill="none"
						stroke="var(--louz-walnut-deep)"
						strokeWidth={2.2}
					/>
					<ellipse
						cx={60}
						cy={82}
						rx={2.5}
						ry={5.5}
						fill="var(--louz-walnut-deep)"
					/>
				</>
			);
		case "alfa":
			return <rect width={120} height={150} fill={`url(#${patternId})`} />;
		case "brass":
			return (
				<>
					<rect width={120} height={150} fill={`url(#${patternId})`} />
					<rect
						x={30}
						width={3}
						height={150}
						fill="var(--primary-foreground)"
						opacity={0.3}
					/>
					<rect
						x={76}
						width={2}
						height={150}
						fill="var(--primary-foreground)"
						opacity={0.22}
					/>
					<rect
						x={96}
						width={4}
						height={150}
						fill="var(--louz-walnut)"
						opacity={0.18}
					/>
				</>
			);
		case "linen":
			return (
				<>
					<rect width={120} height={150} fill={`url(#${patternId})`} />
					<rect
						x={18}
						y={50}
						width={22}
						height={2.4}
						rx={1.2}
						fill="var(--louz-linen-deep)"
					/>
					<rect
						x={70}
						y={104}
						width={26}
						height={2.4}
						rx={1.2}
						fill="var(--louz-linen-deep)"
					/>
					<rect
						x={52}
						y={76}
						width={16}
						height={2.4}
						rx={1.2}
						fill="var(--louz-linen-deep)"
					/>
					<path
						d="M0 30 H120 M0 92 H120"
						stroke="var(--louz-linen-deep)"
						strokeWidth={3}
						opacity={0.3}
					/>
				</>
			);
	}
}
