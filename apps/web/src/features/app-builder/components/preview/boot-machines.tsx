/**
 * The server room of the preview boot screen. A rack is the sandbox VM, a disk stack is the database,
 * and a tower is the app server. Cables join them. BootPlan renders it while the sandbox starts or wakes.
 * BootSpark draws the Spark in the core window of the rack. The `wd-*` keyframes of globals.css and the
 * Tailwind spin move the inline SVG.
 */

import { cn } from "@wandit/ui/lib/utils";
import { useId } from "react";

import type { BootStep } from "../../lib/boot-state";

// The room is 320 x 200 units. The core window center (160, 100) is the box center, so the centered Spark sits in it.
const VIEW_BOX = "0 0 320 200";

// Machine paint: night blues a few steps lighter than the ground, so the machines read as solid metal.
const PAINT = {
	top: "#232a5a",
	bottom: "#121739",
	light: "#262d5e",
	mid: "#1a2047",
	sideLeft: "#161b40",
	sideRight: "#121737",
	dark: "#10143a",
	hole: "#080c26",
	rim: "#2c346a",
} as const;

/**
 * When the lights come on, s after the room mounts. In a build, the power comes on as the last cable lands.
 * In a wake, it comes on just after the fade-in.
 */
const POWER_ON_S: Record<BootMachinesProps["scene"], number> = {
	create: 1.45,
	wake: 0.7,
};

/** Color of the database lights for each state. So a still frame also shows the state. */
const DATABASE_GLOW = {
	active: "var(--color-spark)",
	done: "var(--color-cream)",
	// Not --color-destructive: :root resolves that token to the light red. This one resolves in the dark stage, like fill-destructive.
	failed: "var(--destructive)",
} as const;

/**
 * The three 1U servers of the rack, from the bottom up. `y` is the top edge. `buildDelayS` is the click-in delay
 * in a build, s. Each status light blinks at its own pace, s, and starts `statusOffsetS` after the power.
 */
const ONE_U_SERVERS = [
	{ y: 130, buildDelayS: 0.42, statusBlinkS: 3.1, statusOffsetS: 0.7 },
	{ y: 61, buildDelayS: 0.66, statusBlinkS: 2.7, statusOffsetS: 1.1 },
	{ y: 49, buildDelayS: 0.78, statusBlinkS: 2.3, statusOffsetS: 0.3 },
] as const;

/** The two fans of the top unit. They turn slowly, each at its own pace, s, so the room stays calm. */
const FANS = [
	{ cx: 145, turnS: 3.2 },
	{ cx: 175, turnS: 4.4 },
] as const;

/** The level meters beside the core window. Each one rises and falls at its own pace, s. */
const METERS = [
	{ x: 133, loopS: 2.6, offsetS: 0 },
	{ x: 187, loopS: 3.3, offsetS: 0.4 },
] as const;

/**
 * Bright dots that hop from LED to LED. A chaser path has pathLength 8 and spans its LEDs plus one gap.
 * `leds` is the LED count. The loop and the offset after the power are in s.
 */
const RACK_CHASERS = [
	{ d: "M158 53.5H183", leds: 5, loopS: 2.4, offsetS: 0.2 },
	{ d: "M134 157.5H196.4", leds: 6, loopS: 3, offsetS: 0.6 },
] as const;
const TOWER_CHASER = {
	d: "M254 163H278",
	leds: 4,
	loopS: 2,
	offsetS: 1.25,
} as const;

/** The amber lights of the back row. Each twinkles at its own pace, s, and starts `offsetS` after the power. */
const BACK_LIGHTS = [
	{ cx: 9, cy: 90, r: 4.6, twinkleS: 3.4, offsetS: 0.2 },
	{ cx: 38, cy: 66, r: 5.2, twinkleS: 4.7, offsetS: 0.5 },
	{ cx: 69, cy: 82, r: 4.4, twinkleS: 3.8, offsetS: 0.9 },
	{ cx: 251, cy: 76, r: 5.2, twinkleS: 5.6, offsetS: 0.3 },
	{ cx: 282, cy: 62, r: 4.6, twinkleS: 4.3, offsetS: 0.7 },
	{ cx: 313, cy: 98, r: 4.4, twinkleS: 5.2, offsetS: 1.1 },
] as const;

/** The three disks of the database, from the bottom up. `top` is the lid center. `buildDelayS` is the drop delay in a build, s. */
const DISKS = [
	{ top: 156, buildDelayS: 0.5 },
	{ top: 138, buildDelayS: 0.62 },
	{ top: 120, buildDelayS: 0.74 },
] as const;
/** In the database fill loop, each ring lights this many s after the ring under it. */
const RING_GAP_S = 0.3;

/**
 * The cables, from the rack plug out. Two go to the database (left), two to the app server (right).
 * `drawDelayS` is the draw-on delay in a build, s. `pulseOffsetS` is the start of the first pulse after the power, s.
 */
const CABLES = [
	{
		d: "M107 60C92 60 94 128 80 128",
		isThick: true,
		goesToDatabase: true,
		drawDelayS: 0.98,
		pulseOffsetS: 0.3,
	},
	{
		d: "M107 69C97 69 96 146 80 146",
		isThick: false,
		goesToDatabase: true,
		drawDelayS: 1.04,
		pulseOffsetS: 1.2,
	},
	{
		d: "M219 62C234 62 226 116 241 116",
		isThick: true,
		goesToDatabase: false,
		drawDelayS: 1.01,
		pulseOffsetS: 0.4,
	},
	{
		d: "M219 71C231 71 229 132 241 132",
		isThick: false,
		goesToDatabase: false,
		drawDelayS: 1.07,
		pulseOffsetS: 1.6,
	},
] as const;

/**
 * The pulse loops of the cables, s, by cable size. Thin cables carry data back to the rack,
 * except while the database starts: then all its data flows into it, and faster.
 */
const PULSE_TIERS = {
	appServer: { thickS: 3.6, thinS: 4.9, isThinBack: true },
	databaseStarting: { thickS: 2.1, thinS: 2.5, isThinBack: false },
	databaseReady: { thickS: 4.2, thinS: 5.4, isThinBack: true },
} as const;

// The two rack plugs of the database cables. They turn red when the database failed.
const DATABASE_PLUGS_PATH = "M107 57.5h5v5h-5zM107 66.5h5v5h-5z";
// The plugs at both ends of the four cables.
const PLUGS_PATH = `${DATABASE_PLUGS_PATH}M75 125.5h5v5h-5zM75 143.5h5v5h-5zM214 59.5h5v5h-5zM214 68.5h5v5h-5zM241 113.5h5v5h-5zM241 129.5h5v5h-5z`;
// The left side of the tower. It faces the rack, so it also carries the rim light.
const TOWER_SIDE_PATH = "M246 98L239 101.5V172.5L246 176Z";
// The four LEDs of the tower, 6 units apart. A zero-length segment with a round cap draws one dot.
const TOWER_LEDS_PATH = "M254 163h0m6 0h0m6 0h0m6 0h0";
// The six drive bay LEDs of the 2U drive tray, one under each bay.
const BAY_LEDS_PATH =
	"M134 157.5h0m10.4 0h0m10.4 0h0m10.4 0h0m10.4 0h0m10.4 0h0";
// The code braces "{ }" on the tower screen. The cursor blinks between them.
const BRACES_PATH =
	"M262 107.5c-2.2 0-2.6 1-2.6 2.6v1.6c0 1.2-.7 1.8-1.9 1.8c1.2 0 1.9.6 1.9 1.8v1.6c0 1.6.4 2.6 2.6 2.6M272 107.5c2.2 0 2.6 1 2.6 2.6v1.6c0 1.2.7 1.8 1.9 1.8c-1.2 0-1.9.6-1.9 1.8v1.6c0 1.6-.4 2.6-2.6 2.6";

// Each ring has its end size. wd-ripple grows it from 15 % and fades it. Without motion, the ring stays hidden.
const RING_CLASSES =
	"animate-ripple fill-none stroke-spark opacity-0 [transform-box:fill-box] [transform-origin:center] motion-reduce:animate-none";
// A burst ring leaves fast and then slows. The idle ripple slows more, so it fades early and the core rests.
const RING_BURST_EASE = "cubic-bezier(0.2, 0.6, 0.3, 1)";
const RING_IDLE_EASE = "cubic-bezier(0.15, 0.7, 0.3, 1)";

/** Props of the server room. BootPlan passes them. */
export type BootMachinesProps = {
	/** `create` builds the room part by part, then turns the power on. `wake` shows the parts at once and powers on sooner. */
	scene: "create" | "wake";
	/** State of the database row of the step list. Null when the list has no database row. It lights the disks and their cables. */
	database: BootStep["state"] | null;
};

/**
 * The room in the off pose, and the moves that start it. Each loop waits for the power-on time.
 * So a fresh mount always plays the start, and the room needs no timer and no state.
 * The database lights follow the database row at once.
 */
export function BootMachines({ scene, database }: BootMachinesProps) {
	const id = useId();
	const metalId = `${id}-metal`;
	const diskId = `${id}-disk`;
	const rimId = `${id}-rim`;
	const glowId = `${id}-glow`;
	const databaseGlowId = `${id}-database-glow`;
	const shadeId = `${id}-shade`;
	const backId = `${id}-back`;
	const isBuild = scene === "create";
	const powerOnS = POWER_ON_S[scene];
	// Without a live row the database waits: the disks stay dim and dark.
	const isDatabaseIdle = database === null || database === "pending";
	const isDatabaseStarting = database === "active";
	// Only a database that starts or runs has lit rings.
	const hasDatabaseData = database === "active" || database === "done";
	// The lamp also blinks while hidden, so a late "starting" row joins the blink at once.
	const isLampBlinking = database !== "done" && database !== "failed";
	const databaseGlow =
		database === "done" || database === "failed"
			? DATABASE_GLOW[database]
			: DATABASE_GLOW.active;

	/** Puts one part into place at `delayS` in a build. Disks drop onto the stack, other parts click in. A woken room shows them at once. */
	function entrance(delayS: number, move: "click" | "drop" = "click") {
		return isBuild
			? {
					className: cn(
						"[transform-box:fill-box] motion-reduce:animate-none",
						move === "drop"
							? "animate-drop-in [transform-origin:bottom]"
							: "animate-assemble [transform-origin:center]",
					),
					style: { animationDelay: `${delayS}s` },
				}
			: {};
	}

	/** The CSS delay `offsetS` after the power comes on. */
	function afterPower(offsetS: number) {
		return `${(powerOnS + offsetS).toFixed(2)}s`;
	}

	/** The style of a loop of `loopS` that starts `offsetS` after the power. */
	function loop(loopS: number, offsetS: number) {
		return {
			animationDuration: `${loopS}s`,
			animationDelay: afterPower(offsetS),
		};
	}

	/** One bright dot that hops from LED to LED. The gap 8.1 is longer than the path, so it hides the dot at the end. */
	function chaser(spec: {
		d: string;
		leds: number;
		loopS: number;
		offsetS: number;
	}) {
		return (
			<path
				key={spec.d}
				d={spec.d}
				pathLength={8}
				strokeWidth="3"
				strokeLinecap="round"
				strokeDasharray="0 8.1"
				className="animate-dash-flow stroke-cream motion-reduce:animate-none"
				style={{
					...loop(spec.loopS, spec.offsetS),
					animationTimingFunction: `steps(${spec.leds})`,
				}}
			/>
		);
	}

	return (
		<svg
			viewBox={VIEW_BOX}
			aria-hidden="true"
			className="block size-full overflow-visible"
		>
			<defs>
				<linearGradient id={metalId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={PAINT.light} />
					<stop offset="1" stopColor={PAINT.bottom} />
				</linearGradient>
				{/* Light on the middle of a round side: the database disks. */}
				<linearGradient id={diskId} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor={PAINT.sideLeft} />
					<stop offset="0.38" stopColor={PAINT.rim} />
					<stop offset="1" stopColor={PAINT.dark} />
				</linearGradient>
				{/* Rim light: the side that faces the rack catches its amber light. */}
				<linearGradient id={rimId} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="var(--color-spark)" stopOpacity={0} />
					<stop offset="1" stopColor="var(--color-spark)" stopOpacity={0.5} />
				</linearGradient>
				<radialGradient id={glowId}>
					<stop offset="0" stopColor="var(--color-spark)" stopOpacity={0.55} />
					<stop offset="1" stopColor="var(--color-spark)" stopOpacity={0} />
				</radialGradient>
				<radialGradient id={databaseGlowId}>
					<stop offset="0" stopColor={databaseGlow} stopOpacity={0.7} />
					<stop offset="1" stopColor={databaseGlow} stopOpacity={0} />
				</radialGradient>
				<radialGradient id={shadeId}>
					<stop offset="0" stopColor={PAINT.hole} stopOpacity={0.85} />
					<stop offset="1" stopColor={PAINT.hole} stopOpacity={0} />
				</radialGradient>
				{/* One fade for the whole back row, in user units. Its center is on the floor line under the rack. */}
				<radialGradient
					id={backId}
					gradientUnits="userSpaceOnUse"
					cx="160"
					cy="160"
					r="230"
					gradientTransform="translate(0 48) scale(1 0.7)"
				>
					<stop offset="0.25" stopColor={PAINT.mid} stopOpacity={0.95} />
					<stop offset="1" stopColor={PAINT.sideLeft} stopOpacity={0} />
				</radialGradient>
			</defs>

			<g {...entrance(0)}>
				{/* The back row: dim racks out of focus. Each rack is one wide stroke, and the dash gaps are its unit seams. */}
				<path
					d="M7 70V172M38 50V172M69 60V172M97 72V172M223 72V172M251 60V172M282 50V172M313 70V172"
					fill="none"
					stroke={`url(#${backId})`}
					strokeWidth="26"
					strokeDasharray="14.4 1.6"
				/>
				{/* The floor: the back line, the seams toward the viewer, and the front line. */}
				<path
					d="M16 172H304M126 172L108 200M92 172L55 200M58 172L3 200M194 172L212 200M228 172L265 200M262 172L317 200M14 186H306"
					strokeWidth="0.8"
					className="stroke-white/7"
				/>
			</g>
			{/* One amber wave runs out over the floor when the power comes on. */}
			<ellipse
				cx="160"
				cy="178"
				rx="150"
				ry="14"
				strokeWidth="1.6"
				className={RING_CLASSES}
				style={{
					animationDuration: "1.8s",
					animationDelay: afterPower(0.1),
					animationIterationCount: 1,
					animationTimingFunction: RING_BURST_EASE,
				}}
			/>

			{/* The database: three disks drop onto the stack. The top disk carries the lamp housing. */}
			<g
				className={cn(
					"transition-opacity duration-500",
					isDatabaseIdle && "opacity-60",
				)}
			>
				{DISKS.map((disk, index) => (
					<g key={disk.top} {...entrance(disk.buildDelayS, "drop")}>
						{index === 0 ? (
							<ellipse
								cx="52"
								cy="178"
								rx="34"
								ry="5"
								fill={`url(#${shadeId})`}
							/>
						) : null}
						<path
							d={`M29 ${disk.top}V${disk.top + 15}A23 6 0 0 0 75 ${disk.top + 15}V${disk.top}A23 6 0 0 1 29 ${disk.top}Z`}
							fill={`url(#${diskId})`}
						/>
						<ellipse
							cx="52"
							cy={disk.top}
							rx="23"
							ry="6"
							fill={PAINT.rim}
							strokeWidth="0.8"
							className={cn(index === DISKS.length - 1 && "stroke-white/12")}
						/>
						<path
							d={ringPath(disk.top)}
							fill="none"
							stroke={PAINT.hole}
							strokeWidth="2.8"
						/>
						{index === DISKS.length - 1 ? (
							<path
								d="M45.5 120h13v-4h-13zM47 116a5 5 0 0 1 10 0z"
								fill={PAINT.dark}
								stroke={PAINT.rim}
								strokeWidth="0.8"
							/>
						) : null}
					</g>
				))}
			</g>

			{/* The app server inside the sandbox: a tower with a code screen and vent slats. */}
			<g {...entrance(0.66)}>
				<ellipse cx="267" cy="178" rx="32" ry="5" fill={`url(#${shadeId})`} />
				<path d={TOWER_SIDE_PATH} fill={PAINT.sideLeft} />
				<rect
					x="246"
					y="96"
					width="42"
					height="80"
					rx="3"
					fill={`url(#${metalId})`}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				<rect
					x="252"
					y="103"
					width="30"
					height="21"
					rx="2"
					fill={PAINT.hole}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				<path
					d="M267 133V149"
					stroke={PAINT.dark}
					strokeWidth="28"
					strokeDasharray="3 3.5"
				/>
				<path
					d={TOWER_LEDS_PATH}
					stroke={PAINT.hole}
					strokeWidth="3"
					strokeLinecap="round"
				/>
				<circle
					cx="279"
					cy="163"
					r="2.6"
					fill={PAINT.hole}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
			</g>

			{/* The rack cabinet: the sandbox VM. */}
			<g {...entrance(0.05)}>
				<ellipse cx="161" cy="177" rx="62" ry="5" fill={`url(#${shadeId})`} />
				<path d="M208 19L215 23V172L208 175Z" fill={PAINT.sideRight} />
				<rect
					x="112"
					y="18"
					width="96"
					height="157"
					rx="3"
					fill={`url(#${metalId})`}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				<rect
					x="109"
					y="12"
					width="102"
					height="8"
					rx="2.5"
					fill={PAINT.top}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				<rect
					x="119"
					y="24"
					width="82"
					height="142"
					rx="1.5"
					fill={PAINT.hole}
				/>
				<path d="M123 26V164M197 26V164" stroke={PAINT.mid} strokeWidth="4" />
			</g>

			{/* The units click into the rack from the bottom up. First the 2U drive tray: six bays cut by dash gaps. */}
			<g {...entrance(0.3)}>
				<rect
					x="125"
					y="142"
					width="70"
					height="20"
					rx="2"
					fill={`url(#${metalId})`}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				<path
					d="M129.5 152H190.5"
					stroke={PAINT.dark}
					strokeWidth="16"
					strokeDasharray="8.8 1.6"
				/>
				<path
					d={BAY_LEDS_PATH}
					stroke={PAINT.hole}
					strokeWidth="3"
					strokeLinecap="round"
				/>
			</g>
			{/* The core module lands around the Spark. Its round window is the home of the Spark. */}
			<g {...entrance(0.54)}>
				<rect
					x="125"
					y="74"
					width="70"
					height="52"
					rx="2.5"
					fill={`url(#${metalId})`}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				<path
					d={METERS.map((meter) => `M${meter.x} 84V116`).join("")}
					stroke={PAINT.hole}
					strokeWidth="4.6"
				/>
				<circle
					cx="160"
					cy="100"
					r="20"
					fill={PAINT.hole}
					stroke={PAINT.rim}
					strokeWidth="4"
				/>
			</g>
			{ONE_U_SERVERS.map((server) => (
				<g key={server.y} {...entrance(server.buildDelayS)}>
					<rect
						x="125"
						y={server.y}
						width="70"
						height="9"
						rx="1.5"
						fill={`url(#${metalId})`}
						stroke={PAINT.rim}
						strokeWidth="0.8"
					/>
					{/* A drive slot, five LED holes, and the hole of the status light. */}
					<path
						d={`M131 ${server.y + 4.5}H149${ledRowPath(server.y + 4.5)}m10 0h0`}
						stroke={PAINT.hole}
						strokeWidth="3"
						strokeLinecap="round"
					/>
				</g>
			))}
			{/* The fan unit on top. Each fan is a thick dashed ring: the dashes are its blades. */}
			<g {...entrance(0.9)}>
				<rect
					x="125"
					y="28"
					width="70"
					height="18"
					rx="2"
					fill={`url(#${metalId})`}
					stroke={PAINT.rim}
					strokeWidth="0.8"
				/>
				{FANS.map((fan) => (
					<g key={fan.cx}>
						<circle
							cx={fan.cx}
							cy="37"
							r="7"
							fill={PAINT.hole}
							stroke={PAINT.rim}
							strokeWidth="0.8"
						/>
						<circle
							cx={fan.cx}
							cy="37"
							r="3.5"
							fill="none"
							stroke={PAINT.rim}
							strokeWidth="5"
							strokeDasharray="3.3 2.2"
							className="animate-spin [transform-box:fill-box] [transform-origin:center] motion-reduce:animate-none"
							style={loop(fan.turnS, 0)}
						/>
					</g>
				))}
			</g>

			{/* The cables draw on after the parts land. A database without a live row dims its cables. */}
			{/* Each draw takes 0.4 s, so the last cable (1.07 s) lands when POWER_ON_S.create turns the power on. */}
			<path {...entrance(0.95)} d={PLUGS_PATH} fill={PAINT.rim} />
			{CABLES.map((cable) => (
				<path
					key={cable.d}
					d={cable.d}
					pathLength={1}
					fill="none"
					stroke={PAINT.rim}
					strokeOpacity={cable.goesToDatabase && isDatabaseIdle ? 0.5 : 1}
					strokeWidth={cable.isThick ? 2.6 : 1.8}
					strokeLinecap="round"
					strokeDasharray="1 1"
					className={cn(
						"transition-[stroke-opacity] duration-500",
						isBuild && "animate-draw motion-reduce:animate-none",
					)}
					style={
						isBuild
							? {
									animationDuration: "0.4s",
									animationDelay: `${cable.drawDelayS}s`,
								}
							: undefined
					}
				/>
			))}
			{/* A soft glass sheen across the rack front. */}
			<path
				{...entrance(1)}
				d="M150 18H174L138 175H114Z"
				fill="white"
				fillOpacity={0.035}
			/>

			{/* The rack lights: the sandbox power. They flicker on together, then each loop starts at its own offset. */}
			{/* The rack lights come on first, then the app server (+0.55 s), then the database (+0.7 s). */}
			<g
				className="animate-power-on motion-reduce:animate-none"
				style={{ animationDelay: afterPower(0) }}
			>
				<ellipse
					cx="160"
					cy="177"
					rx="88"
					ry="10"
					fill={`url(#${glowId})`}
					fillOpacity={0.8}
					className="animate-pulse-soft motion-reduce:animate-none"
					style={loop(7.4, 0)}
				/>
				{BACK_LIGHTS.map((light) => (
					<circle
						key={light.cx}
						cx={light.cx}
						cy={light.cy}
						r={light.r}
						fill={`url(#${glowId})`}
						className="animate-pulse-soft motion-reduce:animate-none"
						style={loop(light.twinkleS, light.offsetS)}
					/>
				))}
				{/* Rim light on the sides that face the rack. The database rim dims with the database. */}
				<path
					d="M62 125.4A23 6 0 0 0 75 120V171A23 6 0 0 1 62 176.4Z"
					fill={`url(#${rimId})`}
					className={cn(
						"transition-opacity duration-500",
						isDatabaseIdle && "opacity-50",
					)}
				/>
				<path d={TOWER_SIDE_PATH} fill={`url(#${rimId})`} />
				<path
					d="M128 16H192"
					strokeWidth="1.4"
					strokeLinecap="round"
					className="animate-pulse-soft stroke-spark motion-reduce:animate-none"
					style={loop(6.2, 0)}
				/>
				{/* The core glow stays soft and the window stays dark. So the halo and the Spark of BootSpark keep their contrast. */}
				<circle
					cx="160"
					cy="100"
					r="38"
					fill={`url(#${glowId})`}
					fillOpacity={0.4}
				/>
				<circle
					cx="160"
					cy="100"
					r="17"
					strokeOpacity={0.75}
					strokeWidth="1.4"
					className="animate-pulse-soft fill-none stroke-spark motion-reduce:animate-none"
					style={loop(4, 0)}
				/>
				{/* Twelve dashes: the ring is 2π × 20 = 125.66 units around, and one dash with its gap is 10.47 units. */}
				<circle
					cx="160"
					cy="100"
					r="20"
					strokeOpacity={0.6}
					strokeWidth="1.1"
					strokeDasharray="5 5.472"
					className="animate-spin fill-none stroke-spark [transform-box:fill-box] [transform-origin:center] motion-reduce:animate-none"
					style={loop(16, 0)}
				/>
				{/* The meters have pathLength 8: four segments of 1.6 with gaps of 0.4. Each step turns one segment off. */}
				{METERS.map((meter) => (
					<path
						key={meter.x}
						d={`M${meter.x} 84V116`}
						pathLength={8}
						strokeWidth="4.6"
						strokeDasharray="1.6 0.4 1.6 0.4 1.6 0.4 1.6 0.4 8"
						className="animate-dash-flow stroke-spark motion-reduce:animate-none"
						style={{
							...loop(meter.loopS, meter.offsetS),
							animationTimingFunction: "steps(4)",
							animationDirection: "alternate",
						}}
					/>
				))}
				{/* The dim drive LEDs of the 1U servers and the drive tray. Two of the rows also have a hopping dot. */}
				<path
					d={`${ONE_U_SERVERS.map((server) => ledRowPath(server.y + 4.5)).join("")}${BAY_LEDS_PATH}`}
					strokeOpacity={0.35}
					strokeWidth="3"
					strokeLinecap="round"
					className="stroke-spark"
				/>
				{RACK_CHASERS.map((spec) => chaser(spec))}
				{ONE_U_SERVERS.map((server) => (
					<circle
						key={server.y}
						cx="188"
						cy={server.y + 4.5}
						r="1.5"
						className="animate-pulse-soft fill-spark motion-reduce:animate-none"
						style={loop(server.statusBlinkS, server.statusOffsetS)}
					/>
				))}
			</g>

			{/* The core rings: one strong ring when the power comes on, then one soft ripple every 6 s. */}
			<circle
				cx="160"
				cy="100"
				r="64"
				strokeWidth="2"
				className={RING_CLASSES}
				style={{
					animationDuration: "1.4s",
					animationDelay: afterPower(0.05),
					animationIterationCount: 1,
					animationTimingFunction: RING_BURST_EASE,
				}}
			/>
			<circle
				cx="160"
				cy="100"
				r="54"
				strokeOpacity={0.55}
				strokeWidth="2.4"
				className={RING_CLASSES}
				style={{
					...loop(6, 2.4),
					animationTimingFunction: RING_IDLE_EASE,
				}}
			/>

			{/* Light pulses on the cables. Each pulse is one dash of 8 on a pathLength of 100. The gap of 120 keeps a second dash off. */}
			{/* A database cable has one pulse for each tier, and only the tier of the state shows. */}
			{/* The hidden pulses keep their loop. So a state change fades between pulses and never moves one. */}
			{CABLES.flatMap((cable) =>
				(cable.goesToDatabase
					? [
							{
								name: "starting",
								tier: PULSE_TIERS.databaseStarting,
								isShown: isDatabaseStarting,
							},
							{
								name: "ready",
								tier: PULSE_TIERS.databaseReady,
								isShown: database === "done",
							},
						]
					: [{ name: "app", tier: PULSE_TIERS.appServer, isShown: true }]
				).map(({ name, tier, isShown }) => (
					<g
						key={`${cable.d}-${name}`}
						className={cn(
							"transition-opacity duration-500",
							!isShown && "opacity-0",
						)}
					>
						<path
							d={cable.d}
							pathLength={100}
							fill="none"
							strokeWidth={cable.isThick ? 1.8 : 1.2}
							strokeLinecap="round"
							strokeDasharray="8 120"
							className={cn(
								"animate-cable-pulse motion-reduce:hidden",
								cable.isThick ? "stroke-spark" : "stroke-cream",
							)}
							style={{
								...loop(
									cable.isThick ? tier.thickS : tier.thinS,
									cable.pulseOffsetS,
								),
								animationDirection:
									!cable.isThick && tier.isThinBack ? "reverse" : "normal",
							}}
						/>
					</g>
				)),
			)}

			{/* The app server lights. The app server runs inside the sandbox, so it follows the sandbox power, not the database. */}
			<g
				className="animate-power-on motion-reduce:animate-none"
				style={{ animationDelay: afterPower(0.55) }}
			>
				<ellipse
					cx="267"
					cy="179"
					rx="34"
					ry="5.5"
					fill={`url(#${glowId})`}
					fillOpacity={0.8}
				/>
				<path
					d={BRACES_PATH}
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="fill-none stroke-spark"
				/>
				<rect
					x="265.5"
					y="109.5"
					width="3"
					height="8"
					rx="1"
					className="animate-caret fill-cream motion-reduce:animate-none"
					style={loop(1.6, 0.55)}
				/>
				<path
					d={TOWER_LEDS_PATH}
					strokeOpacity={0.35}
					strokeWidth="3"
					strokeLinecap="round"
					className="stroke-spark"
				/>
				{chaser(TOWER_CHASER)}
				<circle
					cx="279"
					cy="163"
					r="2.6"
					strokeWidth="1"
					className="fill-none stroke-spark"
				/>
			</g>

			{/* The database lights: amber while it starts, cream when it runs, red when it failed. A waiting database has none. */}
			<g
				className={cn(
					"transition-opacity duration-500",
					isDatabaseIdle && "opacity-0",
				)}
			>
				<g
					className="animate-power-on motion-reduce:animate-none"
					style={{ animationDelay: afterPower(0.7) }}
				>
					<ellipse
						cx="52"
						cy="179"
						rx="40"
						ry="6.5"
						fill={`url(#${databaseGlowId})`}
						className={cn(
							"transition-opacity duration-500",
							database === "done" && "opacity-60",
						)}
					/>
					{/* While the database starts, the rings light one by one from the bottom, hold, and fade together. */}
					{/* They loop in every state but done, so a late database row joins the loop at once. */}
					<g
						fill="none"
						stroke={databaseGlow}
						strokeWidth="2"
						className={cn(
							"transition-opacity duration-500",
							!hasDatabaseData && "opacity-0",
						)}
					>
						<g
							className={cn(
								database !== "done" &&
									"animate-tank-fill motion-reduce:animate-none",
							)}
							style={{ animationDelay: afterPower(0.9) }}
						>
							{DISKS.map((disk, index) => (
								<path
									key={disk.top}
									d={ringPath(disk.top)}
									className={cn(
										database !== "done" &&
											"animate-tank-fill motion-reduce:animate-none",
										// Without motion, a starting database shows half full: the top ring stays dim.
										isDatabaseStarting &&
											index === DISKS.length - 1 &&
											"motion-reduce:opacity-20",
									)}
									style={{
										animationDelay: afterPower(0.9 + index * RING_GAP_S),
									}}
								/>
							))}
						</g>
					</g>
					<path
						d={DATABASE_PLUGS_PATH}
						className={cn(
							"fill-destructive transition-opacity duration-500",
							database !== "failed" && "opacity-0",
						)}
					/>
					{/* The lamp blinks while the database starts. It is steady when it runs or failed. */}
					<g
						className={cn(
							isLampBlinking && "animate-pulse-soft motion-reduce:animate-none",
						)}
						style={isLampBlinking ? loop(1.1, 1.6) : undefined}
					>
						<circle cx="52" cy="113" r="18" fill={`url(#${databaseGlowId})`} />
						<path d="M47 116a5 5 0 0 1 10 0z" fill={databaseGlow} />
					</g>
				</g>
			</g>
		</svg>
	);
}

/** The front band of one disk, 9 units under its lid. The lit ring of the database uses the same band. */
function ringPath(top: number): string {
	return `M29 ${top + 9}A23 6 0 0 0 75 ${top + 9}`;
}

/** Five LED dots, 5 units apart, from x 158 on the line `y`. A zero-length segment with a round cap draws one dot. */
function ledRowPath(y: number): string {
	return `M158 ${y}h0m5 0h0m5 0h0m5 0h0m5 0h0`;
}
