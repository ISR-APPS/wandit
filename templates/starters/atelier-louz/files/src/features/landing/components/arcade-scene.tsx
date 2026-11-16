// The drawn hero scene: a sunlit arcade with an arched window, a palm shadow, a lamp, a pot, and a terracotta floor.
// HeroSection renders it. It is flat layers of CSS and SVG; landing.css gives the gradients and the sway.
import { useT } from "~/shared/i18n";
import { HangingLamp } from "./hanging-lamp";
import { PalmTuft } from "./palm-tuft";

// Leaf angles of the palm shadow on the wall, in degrees.
const SHADOW_LEAVES = [8, 38, 66, 96, -22];
// Leaves of the potted palm: [angle in degrees, length in viewBox units].
const POT_LEAVES = [
	[-24, 46],
	[-62, 44],
	[-95, 42],
	[-128, 44],
	[-158, 46],
] as const;

/** The arcade scene, an arch-topped panel with a 4:5 ratio on desktop and 5:6 on a phone. */
export function ArcadeScene() {
	const { t } = useT();
	return (
		<div
			role="img"
			aria-label={t("hero.sceneLabel")}
			className="louz-arcade louz-enter-scene relative aspect-[5/6] overflow-hidden lg:aspect-[4/5]"
		>
			<div className="louz-arcade-window absolute start-[19%] top-[11%] h-[64%] w-[62%]">
				<svg
					viewBox="0 0 320 340"
					preserveAspectRatio="xMidYMax slice"
					aria-hidden="true"
					focusable="false"
					className="absolute inset-0 size-full"
				>
					<circle cx={112} cy={96} r={30} fill="var(--louz-glow)" />
					<circle
						cx={112}
						cy={96}
						r={46}
						fill="var(--louz-glow)"
						opacity={0.25}
					/>
					<path
						d="M0 268 Q 90 252 180 262 T 320 258 V340 H0 Z"
						fill="var(--louz-clay)"
						opacity={0.55}
					/>
					<path
						d="M0 300 Q 120 288 220 298 T 320 294 V340 H0 Z"
						fill="var(--louz-clay-deep)"
						opacity={0.35}
					/>
					{/* xMidYMax slice shows about x 28 to 291 of the viewBox. The palm fan stays inside x 116 to 276. */}
					<PalmTuft x={196} y={340} leaf={42} />
				</svg>
			</div>
			<div
				aria-hidden="true"
				className="louz-arcade-pool absolute start-[24%] bottom-[2%] h-[20%] w-1/2"
			/>
			<div
				aria-hidden="true"
				className="louz-arcade-floor absolute inset-x-0 bottom-0 h-[23%]"
			/>
			<div
				aria-hidden="true"
				className="louz-arcade-rug absolute start-[30%] bottom-[3.5%] h-[7%] w-[40%] opacity-90"
			/>
			<svg
				viewBox="0 0 300 300"
				aria-hidden="true"
				focusable="false"
				className="louz-sway absolute start-[-8%] top-[-7%] w-[92%]"
			>
				<g transform="translate(40,60)" fill="var(--foreground)" opacity={0.13}>
					{SHADOW_LEAVES.map((angle) => (
						<ellipse
							key={angle}
							cx={76}
							cy={0}
							rx={82}
							ry={11}
							transform={`rotate(${angle})`}
						/>
					))}
				</g>
			</svg>
			<svg
				viewBox="0 0 200 190"
				aria-hidden="true"
				focusable="false"
				className="absolute start-[4%] bottom-0 w-[34%]"
			>
				<g transform="translate(100,118)" fill="var(--louz-palm)">
					{POT_LEAVES.map(([angle, length]) => (
						<ellipse
							key={angle}
							cx={length * 0.92}
							cy={0}
							rx={length}
							ry={8}
							transform={`rotate(${angle})`}
						/>
					))}
				</g>
				<path d="M62 118 H138 L128 188 H72 Z" fill="var(--louz-clay-deep)" />
				<path
					d="M62 118 H138 L135 136 H65 Z"
					fill="var(--foreground)"
					opacity={0.18}
				/>
			</svg>
			<svg
				viewBox="0 0 80 190"
				aria-hidden="true"
				focusable="false"
				className="absolute end-[12%] top-0 w-[13%]"
			>
				<HangingLamp x={40} cord={92} shade={28} />
			</svg>
		</div>
	);
}
