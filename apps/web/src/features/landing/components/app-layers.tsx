/**
 * The "layers" section (id "layers") of the landing page. pages/landing-page.tsx
 * renders it. It shows an isometric stack of the five parts that Wandit builds.
 * The stack opens when the visitor scrolls (motion useScroll and useSpring).
 * A label with a leader line shows for each slab. The copy comes from landing.layers.
 */

import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import {
	clamp,
	cubicBezier,
	type MotionValue,
	motion,
	useInView,
	useMotionValue,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform,
} from "motion/react";
import { type ReactElement, useId, useRef } from "react";

import { useDictionary } from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";

/** The slabs from top to bottom. `material` picks the slab colors. */
const LAYERS = [
	{ key: "screens", material: "ember" },
	{ key: "signIn", material: "night" },
	{ key: "database", material: "night" },
	{ key: "files", material: "night" },
	{ key: "server", material: "night" },
] as const;

type LayerKey = (typeof LAYERS)[number]["key"];
type Material = (typeof LAYERS)[number]["material"];

// The view is the CSS transform rotateX(55deg) rotateZ(-45deg). We draw its
// 2D projection in SVG, so the edges and the line art stay sharp at any size.
const TILT_RADIANS = (55 * Math.PI) / 180;
const TILT_COS = Math.cos(TILT_RADIANS);
const TILT_SIN = Math.sin(TILT_RADIANS);

// A slab face in local units: a square from -120 to 120 with round corners.
// The face drawings below use the same local units.
const FACE_HALF = 120;
const FACE_CORNER = 28;
const FACE_RECT = {
	x: -FACE_HALF,
	y: -FACE_HALF,
	width: 2 * FACE_HALF,
	height: 2 * FACE_HALF,
	rx: FACE_CORNER,
} as const;
// A gradient line in local face units: from the left corner to the right
// corner on screen.
const FACE_DIAGONAL = {
	gradientUnits: "userSpaceOnUse",
	x1: -FACE_HALF,
	y1: -FACE_HALF,
	x2: FACE_HALF,
	y2: FACE_HALF,
} as const;
// Lays a local drawing flat on the tilted face. Local +x goes up-right on
// the screen, local +y goes down-right.
const FACE_MATRIX = `matrix(${Math.SQRT1_2} ${-Math.SQRT1_2 * TILT_COS} ${Math.SQRT1_2} ${Math.SQRT1_2 * TILT_COS} 0 0)`;
// A slab is 24 local units thick. Seen at the tilt, the edge is shorter.
const SLAB_THICKNESS = 24 * TILT_SIN;
// Screen half width of the face: to the tip of a round corner, and to the
// corner of the same square without rounding (the wall gradients use it).
const FACE_HALF_WIDTH = Math.SQRT2 * (FACE_HALF - FACE_CORNER) + FACE_CORNER;
const SHARP_HALF_WIDTH = Math.SQRT2 * FACE_HALF;
const FACE_HALF_HEIGHT = FACE_HALF_WIDTH * TILT_COS;

// Horizontal places in the view, in view units: the stack axis, and the
// start of the labels in the wide layout.
const STACK_CENTER_X = 175;
const LABEL_START_X = 395;
// Room above the top slab and below the bottom slab for the spring overshoot.
const VIEW_PAD_Y = 22;

type StackLayout = {
	/** Distance between two slab faces when the stack is fully open, in view units. */
	gap: number;
	/** Width of the SVG view box. The wide layout keeps room for the labels. */
	viewWidth: number;
	/** Shows the labels and leader lines inside the stack (md and wider). */
	hasLabels: boolean;
};

// A gap of 140 shows about two thirds of each lower face. The phone layout
// has no labels beside the stack and a smaller gap, so the open stack fits
// on one screen.
const WIDE_LAYOUT: StackLayout = { gap: 140, viewWidth: 780, hasLabels: true };
const PHONE_LAYOUT: StackLayout = {
	gap: 120,
	viewWidth: 2 * STACK_CENTER_X,
	hasLabels: false,
};

function viewHeight(layout: StackLayout) {
	return (
		(LAYERS.length - 1) * layout.gap +
		2 * FACE_HALF_HEIGHT +
		SLAB_THICKNESS +
		2 * VIEW_PAD_Y
	);
}

/** Center of a slab face in the closed stack, in view units from the top. */
function closedSlabY(index: number, height: number) {
	const middle = (height - SLAB_THICKNESS) / 2;
	return middle + (index - (LAYERS.length - 1) / 2) * SLAB_THICKNESS;
}

// Scroll progress (0 to 1) of the opening. Gap k (under slab k) starts to
// open at GAP_OPEN_START + k * GAP_OPEN_STAGGER and takes GAP_OPEN_SPAN.
// The last gap is open at STACK_OPEN_PROGRESS, so the open stack holds for the rest.
const GAP_OPEN_START = 0.06;
const GAP_OPEN_STAGGER = 0.14;
const GAP_OPEN_SPAN = 0.26;
// The last gap is gap LAYERS.length - 2, because no gap is under the bottom slab.
const STACK_OPEN_PROGRESS =
	GAP_OPEN_START + (LAYERS.length - 2) * GAP_OPEN_STAGGER + GAP_OPEN_SPAN;
// A label shows when the gap above its slab is about 60% open.
const LABEL_DELAY = 0.16;
const FIRST_LABEL_START = 0.1;
const LABEL_REVEAL_SPAN = 0.1;
// A lift with a small overshoot, so each slab settles like a real object.
const liftEase = cubicBezier(0.3, 1.25, 0.5, 1);
// Smooths the scroll value, so the slabs keep a little weight and lag.
const SCROLL_SPRING = { stiffness: 110, damping: 24, mass: 0.6 };

function gapOpenness(gapIndex: number, progress: number) {
	const start = GAP_OPEN_START + gapIndex * GAP_OPEN_STAGGER;
	return liftEase(clamp(0, 1, (progress - start) / GAP_OPEN_SPAN));
}

/** Vertical shift of a slab from its place in the closed stack, in view units. */
function slabShift(index: number, progress: number, gap: number) {
	let shiftAbove = 0;
	let shiftTotal = 0;
	for (let gapIndex = 0; gapIndex < LAYERS.length - 1; gapIndex++) {
		const opened = (gap - SLAB_THICKNESS) * gapOpenness(gapIndex, progress);
		shiftTotal += opened;
		if (gapIndex < index) shiftAbove += opened;
	}
	// The stack opens from its middle, so it stays centered in the view.
	return shiftAbove - shiftTotal / 2;
}

/** 0 to 1: how far the label of a slab has appeared. */
function labelReveal(index: number, progress: number) {
	const start =
		index === 0
			? FIRST_LABEL_START
			: GAP_OPEN_START + (index - 1) * GAP_OPEN_STAGGER + LABEL_DELAY;
	return clamp(0, 1, (progress - start) / LABEL_REVEAL_SPAN);
}

// When the stack is open, one tap on the screens slab travels down the
// leader dots, through every layer. The pulse takes PULSE_STEP_SECONDS per
// slab. Each loop that uses pulseLoop repeats every PULSE_CYCLE_SECONDS, so
// the tap and the pulse stay in step.
const PULSE_STEP_SECONDS = 0.5;
const PULSE_CYCLE_SECONDS = 4.2;
// The tap ripple shows first, the pulse leaves the top dot after it.
const PULSE_START_SECONDS = 0.45;
// Leader dot, just outside the right corner of the face, from the slab
// center. Outside the face, the amber dot always sits on the navy ground.
const ANCHOR_X = FACE_HALF_WIDTH + 12;

/** Shared timing of the loops that start at `delay` seconds in the cycle. */
function pulseLoop(delay: number, duration: number) {
	return {
		delay,
		duration,
		repeat: Number.POSITIVE_INFINITY,
		repeatDelay: PULSE_CYCLE_SECONDS - duration,
	};
}

/** The exploded stack of app layers, opened by scroll. */
export function AppLayers() {
	const layers = useDictionary().landing.layers;
	const isPhone = useIsMobile();
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const gradientPrefix = useId();
	const trackRef = useRef<HTMLDivElement>(null);
	const stackRef = useRef<HTMLUListElement>(null);

	// md and wider: the stack is sticky and the tall track drives it. On a
	// phone the stack scrolls with the page and opens while it passes.
	const { scrollYProgress } = useScroll(
		isPhone
			? { target: stackRef, offset: ["center 0.95", "center 0.35"] }
			: { target: trackRef, offset: ["start start", "end end"] },
	);
	const springProgress = useSpring(scrollYProgress, SCROLL_SPRING);
	const openProgress = useMotionValue(1);
	// Reduced motion shows the open stack and no scroll motion.
	const progress = reduceMotion ? openProgress : springProgress;
	// The small loops on the faces run only while the stack is on screen.
	const isStackInView = useInView(stackRef, { margin: "10% 0px" });
	const isLive = isStackInView && !reduceMotion;

	const layout = isPhone ? PHONE_LAYOUT : WIDE_LAYOUT;
	const height = viewHeight(layout);
	const aspectRatio = layout.viewWidth / height;

	return (
		<section
			id="layers"
			aria-labelledby={titleId}
			className="mx-2 rounded-[2rem] bg-night text-white md:mx-3 md:rounded-[2.75rem]"
		>
			{/* The tall track gives the scroll room to open the stack. Reduced
			    motion shows the open stack, so it needs no extra scroll. */}
			<div
				ref={trackRef}
				className={reduceMotion ? undefined : "md:h-[250svh]"}
			>
				<div className="mx-auto max-w-7xl px-4 py-24 md:sticky md:top-0 md:flex md:h-svh md:flex-col md:px-8 md:pt-24 md:pb-6 lg:grid lg:grid-cols-12 lg:gap-x-8">
					<header className="lg:col-span-5 lg:pt-4">
						<h2 id={titleId} className={SECTION_TITLE_CLASS}>
							{layers.title}
						</h2>
						<p className="mt-6 max-w-xl text-cream text-lg leading-relaxed md:text-xl">
							{layers.sub}
						</p>
					</header>

					<div className="mt-14 md:mt-8 md:flex md:min-h-0 md:flex-1 md:items-center lg:col-span-7 lg:mt-0 md:[container-type:size]">
						<StackGradients prefix={gradientPrefix} />
						<ul
							ref={stackRef}
							// On a phone the labels are in the list below the stack.
							aria-hidden={isPhone || undefined}
							className="relative mx-auto w-[min(100%,18rem)]"
							style={{
								aspectRatio,
								width: isPhone
									? undefined
									: `min(100cqw, calc(100cqh * ${aspectRatio}))`,
							}}
						>
							{LAYERS.map((layer, index) => (
								<Slab
									key={layer.key}
									index={index}
									layerKey={layer.key}
									material={layer.material}
									title={layers.items[layer.key].title}
									body={layers.items[layer.key].body}
									progress={progress}
									layout={layout}
									height={height}
									gradientPrefix={gradientPrefix}
									isLive={isLive}
								/>
							))}
						</ul>
					</div>

					<ul className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 md:hidden">
						{LAYERS.map((layer) => (
							<li key={layer.key} className="flex items-start gap-4">
								<SlabGlyph material={layer.material} />
								<div>
									<h3 className="font-semibold text-xl tracking-[-0.02em] rtl:tracking-normal">
										{layers.items[layer.key].title}
									</h3>
									<p className="mt-1 text-base text-cream/80 leading-relaxed">
										{layers.items[layer.key].body}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}

type SlabProps = {
	/** Place in the stack, 0 is the top slab. */
	index: number;
	layerKey: LayerKey;
	material: Material;
	title: string;
	body: string;
	/** Opening of the stack, 0 closed to 1 open. Spring-smoothed scroll progress. */
	progress: MotionValue<number>;
	layout: StackLayout;
	/** Height of the SVG view box, in view units. */
	height: number;
	/** Id prefix of the shared gradients in StackGradients. */
	gradientPrefix: string;
	/** Runs the small loop of the face drawing. */
	isLive: boolean;
};

/**
 * One slab with its label. Each slab is its own layer that moves as a whole,
 * so the browser only moves bitmaps while the visitor scrolls.
 */
function Slab({
	index,
	layerKey,
	material,
	title,
	body,
	progress,
	layout,
	height,
	gradientPrefix,
	isLive,
}: SlabProps) {
	const baseY = closedSlabY(index, height);
	const y = useTransform(
		progress,
		(value) => `${(slabShift(index, value, layout.gap) / height) * 100}%`,
	);
	const reveal = useTransform(progress, (value) => labelReveal(index, value));
	// The leader line draws first (it is full at 60% of the reveal), then the
	// label fades in at its end.
	const lineLength = useTransform(reveal, (value) => Math.min(1, value * 1.6));
	const labelOpacity = useTransform(reveal, [0.35, 1], [0, 1]);
	// The rail runs up from this dot to the dot of the slab above, so its
	// length is the open gap above this slab. The top slab has no rail.
	const railTop = useTransform(progress, (value) =>
		index === 0
			? 0
			: -SLAB_THICKNESS -
				(layout.gap - SLAB_THICKNESS) * gapOpenness(index - 1, value),
	);
	// The pulse shows only after the last gap is open. It fades in over 0.08 of the scroll.
	const pulseOpacity = useTransform(
		progress,
		[STACK_OPEN_PROGRESS, STACK_OPEN_PROGRESS + 0.08],
		[0, 1],
	);
	const url = (name: string) => `url(#${gradientPrefix}-${name})`;
	const Drawing = DRAWINGS[layerKey];

	return (
		<motion.li
			className="pointer-events-none absolute inset-0 will-change-transform"
			// The top slab paints last, so it covers the slabs below it.
			style={{ y, zIndex: LAYERS.length - index }}
		>
			<svg
				aria-hidden="true"
				viewBox={`0 0 ${layout.viewWidth} ${height}`}
				className="absolute inset-0 size-full overflow-visible rtl:-scale-x-100"
			>
				<g transform={`translate(${STACK_CENTER_X} ${baseY})`}>
					{/* Soft shadow on the slab below. */}
					<g transform={`translate(0 ${SLAB_THICKNESS + 10}) ${FACE_MATRIX}`}>
						<rect {...FACE_RECT} transform="scale(1.06)" fill={url("shadow")} />
					</g>
					{/* The two visible walls: the bottom face and the band that joins it to the top. */}
					<g transform={`translate(0 ${SLAB_THICKNESS}) ${FACE_MATRIX}`}>
						<rect {...FACE_RECT} fill={url(`wall-local-${material}`)} />
					</g>
					<rect
						x={-FACE_HALF_WIDTH}
						y={0}
						width={2 * FACE_HALF_WIDTH}
						height={SLAB_THICKNESS}
						fill={url(`wall-screen-${material}`)}
					/>
					<g transform={FACE_MATRIX}>
						<rect
							{...FACE_RECT}
							fill={url(`face-${material}`)}
							stroke={url(`rim-${material}`)}
							strokeWidth={1.25}
							vectorEffect="non-scaling-stroke"
						/>
						<g
							fill="none"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="[&_*]:[vector-effect:non-scaling-stroke]"
						>
							<Drawing isLive={isLive} faceFill={url(`face-${material}`)} />
						</g>
					</g>
					{layout.hasLabels ? (
						<>
							{/* The leader line stops 16 view units before the label text. */}
							<motion.line
								x1={FACE_HALF_WIDTH}
								y1={0}
								x2={LABEL_START_X - STACK_CENTER_X - 16}
								y2={0}
								className="stroke-cream/45"
								strokeWidth={1}
								style={{ pathLength: lineLength }}
							/>
							<motion.g style={{ opacity: reveal }}>
								{index > 0 ? (
									<motion.line
										x1={ANCHOR_X}
										y1={railTop}
										x2={ANCHOR_X}
										y2={0}
										className="stroke-spark/35"
										strokeWidth={1}
										strokeDasharray="2 5"
									/>
								) : null}
								<circle cx={ANCHOR_X} cy={0} r={8} className="fill-spark/20" />
								<circle cx={ANCHOR_X} cy={0} r={3.5} className="fill-spark" />
							</motion.g>
							{isLive ? (
								<motion.g style={{ opacity: pulseOpacity }}>
									{index > 0 ? (
										<motion.circle
											cx={ANCHOR_X}
											r={3.5}
											className="fill-spark"
											initial={{ cy: -layout.gap, opacity: 0 }}
											animate={{ cy: [-layout.gap, 0], opacity: [0, 1, 1] }}
											transition={{
												...pulseLoop(
													PULSE_START_SECONDS +
														(index - 1) * PULSE_STEP_SECONDS,
													PULSE_STEP_SECONDS,
												),
												ease: "easeIn",
											}}
										/>
									) : null}
									{/* The dot flashes when the pulse reaches this layer. */}
									<motion.circle
										cx={ANCHOR_X}
										cy={0}
										className="stroke-spark"
										strokeWidth={1.5}
										fill="none"
										initial={{ r: 4, opacity: 0 }}
										animate={{ r: [4, 18], opacity: [0.9, 0] }}
										transition={{
											...pulseLoop(
												PULSE_START_SECONDS + index * PULSE_STEP_SECONDS,
												0.7,
											),
											ease: "easeOut",
										}}
									/>
								</motion.g>
							) : null}
						</>
					) : null}
				</g>
			</svg>

			{layout.hasLabels ? (
				// The title line sits on the leader line: -mt-4 is half its line height.
				// The layer ignores the pointer, the label takes it back for text selection.
				<motion.div
					className="pointer-events-auto absolute -mt-4 hidden pe-2 md:block"
					style={{
						opacity: labelOpacity,
						top: `${(baseY / height) * 100}%`,
						insetInlineStart: `${(LABEL_START_X / layout.viewWidth) * 100}%`,
						width: `${((layout.viewWidth - LABEL_START_X) / layout.viewWidth) * 100}%`,
					}}
				>
					<h3 className="font-semibold text-2xl leading-8 tracking-[-0.025em] rtl:tracking-normal">
						{title}
					</h3>
					<p className="mt-1 max-w-[20rem] text-pretty text-[0.9375rem] text-cream/80 leading-6">
						{body}
					</p>
				</motion.div>
			) : null}
		</motion.li>
	);
}

// Colors of the two slab materials. Light comes from the top left: the face
// is lit, the left wall is in half shade, the right wall is in shadow. The
// navy tints mix in oklch, so they keep the blue hue of night.
const MATERIAL_COLORS: Record<
	Material,
	{
		faceLit: string;
		faceShade: string;
		wallLeft: string;
		wallRight: string;
		rim: string;
	}
> = {
	ember: {
		faceLit: "color-mix(in oklab, var(--color-ember) 72%, white)",
		faceShade: "var(--color-ember)",
		wallLeft: "var(--color-ember-deep)",
		wallRight: "color-mix(in oklab, var(--color-ember-deep) 62%, black)",
		rim: "white",
	},
	night: {
		faceLit: "color-mix(in oklch, var(--color-night) 78%, white)",
		faceShade: "color-mix(in oklch, var(--color-night) 89%, white)",
		wallLeft: "color-mix(in oklch, var(--color-night) 93%, white)",
		wallRight: "color-mix(in oklch, var(--color-night) 70%, black)",
		rim: "var(--color-cream)",
	},
};

/**
 * Gradients that all slab SVGs share by id. The SVG has no size, but it is
 * not display:none, because some browsers then drop its gradients.
 */
function StackGradients({ prefix }: { prefix: string }) {
	return (
		<svg aria-hidden="true" className="absolute size-0">
			<defs>
				<radialGradient id={`${prefix}-shadow`}>
					<stop offset="0" stopColor="black" stopOpacity={0.5} />
					<stop offset="0.7" stopColor="black" stopOpacity={0.28} />
					<stop offset="1" stopColor="black" stopOpacity={0} />
				</radialGradient>
				{Object.entries(MATERIAL_COLORS).map(([material, colors]) => {
					const wallStops = (
						<>
							<stop offset="0" style={{ stopColor: colors.wallLeft }} />
							<stop offset="0.46" style={{ stopColor: colors.wallLeft }} />
							<stop offset="0.54" style={{ stopColor: colors.wallRight }} />
							<stop offset="1" style={{ stopColor: colors.wallRight }} />
						</>
					);
					return (
						<g key={material}>
							<linearGradient
								id={`${prefix}-face-${material}`}
								{...FACE_DIAGONAL}
							>
								<stop offset="0" style={{ stopColor: colors.faceLit }} />
								<stop offset="1" style={{ stopColor: colors.faceShade }} />
							</linearGradient>
							<linearGradient
								id={`${prefix}-rim-${material}`}
								{...FACE_DIAGONAL}
							>
								<stop
									offset="0"
									style={{ stopColor: colors.rim, stopOpacity: 0.85 }}
								/>
								<stop
									offset="0.5"
									style={{ stopColor: colors.rim, stopOpacity: 0.35 }}
								/>
								<stop
									offset="1"
									style={{ stopColor: colors.rim, stopOpacity: 0.08 }}
								/>
							</linearGradient>
							{/* The walls split at the front corner, the middle of FACE_DIAGONAL. */}
							<linearGradient
								id={`${prefix}-wall-local-${material}`}
								{...FACE_DIAGONAL}
							>
								{wallStops}
							</linearGradient>
							<linearGradient
								id={`${prefix}-wall-screen-${material}`}
								gradientUnits="userSpaceOnUse"
								x1={-SHARP_HALF_WIDTH}
								y1={0}
								x2={SHARP_HALF_WIDTH}
								y2={0}
							>
								{wallStops}
							</linearGradient>
						</g>
					);
				})}
			</defs>
		</svg>
	);
}

/** Small closed slab in front of each label of the phone list. */
function SlabGlyph({ material }: { material: Material }) {
	const colors = MATERIAL_COLORS[material];
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 44 34"
			className="mt-1 h-[1.75rem] w-9 shrink-0 overflow-visible"
		>
			<path d="M2 12 L22 23 V31 L2 20 Z" style={{ fill: colors.wallLeft }} />
			<path d="M42 12 L22 23 V31 L42 20 Z" style={{ fill: colors.wallRight }} />
			<path
				d="M22 1 L42 12 L22 23 L2 12 Z"
				style={{ fill: colors.faceLit }}
				// A navy face on the navy ground needs an amber rim, or it is not visible.
				className={material === "night" ? "stroke-spark" : undefined}
				strokeWidth={1.25}
				strokeLinejoin="round"
			/>
		</svg>
	);
}

type DrawingProps = {
	/** Runs the small loop of the drawing. */
	isLive: boolean;
	/** Fill of the face, for shapes that must hide the lines under them. */
	faceFill: string;
};

// The face drawings use local face units (-120 to 120). Local "up" points to
// the back left of the slab. The back corner of a lower slab can hide under
// the slab above it, so the drawings keep their key parts near the front.

/** A bar with round ends: the corner radius is half the height. Values are local face units. */
function Pill(pill: {
	x: number;
	y: number;
	width: number;
	height: number;
	className: string;
}) {
	return <rect {...pill} rx={pill.height / 2} />;
}

/**
 * A phone and a browser window: the screens of the app. Accents are night,
 * because amber is too weak on the orange face.
 */
function ScreensDrawing({ isLive }: DrawingProps) {
	return (
		<g>
			<rect
				x={-98}
				y={-94}
				width={78}
				height={186}
				rx={15}
				className="fill-ember-deep/45 stroke-white"
			/>
			<Pill x={-68} y={-86} width={18} height={5} className="fill-white" />
			<Pill x={-88} y={-71} width={30} height={6} className="fill-white/85" />
			<circle cx={-35} cy={-68} r={5} className="stroke-white/70" />
			<rect
				x={-88}
				y={-54}
				width={58}
				height={42}
				rx={8}
				className="fill-white/15 stroke-white/60"
			/>
			{[0, 20, 40].map((rowY) => (
				<g key={rowY}>
					<circle cx={-82} cy={rowY} r={5} className="stroke-white/70" />
					<path
						d={`M -71 ${rowY - 2.5} H -38 M -71 ${rowY + 3} H -52`}
						className="stroke-white/50"
					/>
				</g>
			))}
			<Pill x={-88} y={60} width={58} height={16} className="fill-night" />
			{/* A tap on the button. It starts each loop of the request pulse. */}
			<motion.circle
				cx={-59}
				cy={68}
				className="stroke-white"
				initial={false}
				animate={
					isLive ? { r: [6, 24], opacity: [0.9, 0] } : { r: 6, opacity: 0 }
				}
				transition={
					isLive ? { ...pulseLoop(0, 0.8), ease: "easeOut" } : { duration: 0 }
				}
			/>

			<rect
				x={-6}
				y={-94}
				width={104}
				height={120}
				rx={10}
				className="fill-ember-deep/45 stroke-white"
			/>
			<path d="M -6 -78 H 98" className="stroke-white/60" />
			{[3, 10, 17].map((dotX) => (
				<circle key={dotX} cx={dotX} cy={-86} r={2} className="fill-white/70" />
			))}
			<Pill x={6} y={-67} width={62} height={7} className="fill-white/90" />
			<Pill x={6} y={-55} width={40} height={7} className="fill-white/45" />
			<Pill x={6} y={-41} width={30} height={11} className="fill-night" />
			{[6, 37, 68].map((cardX) => (
				<rect
					key={cardX}
					x={cardX}
					y={-20}
					width={24}
					height={36}
					rx={5}
					className="stroke-white/50"
				/>
			))}

			<Pill x={-6} y={44} width={34} height={18} className="fill-night" />
			<circle cx={19} cy={53} r={6} className="fill-white" />
			<path d="M 42 53 H 98" className="stroke-white/35" />
			<path d="M 42 53 H 72" className="stroke-night" />
			<circle cx={72} cy={53} r={5} className="fill-white" />
			<Pill x={-6} y={74} width={40} height={16} className="stroke-white/60" />
			<Pill
				x={40}
				y={74}
				width={52}
				height={16}
				className="fill-white/15 stroke-white/60"
			/>
		</g>
	);
}

/** A profile, a code typed in four boxes, and a lock. */
function SignInDrawing({ isLive }: DrawingProps) {
	const boxXs = [-104, -66, -28, 10];
	return (
		<g>
			<circle
				cx={-60}
				cy={-52}
				r={32}
				className="fill-white/5 stroke-cream/70"
			/>
			<circle cx={-60} cy={-61} r={10} className="stroke-cream/80" />
			<path
				d="M -79 -30 C -75 -45 -45 -45 -41 -30"
				className="stroke-cream/80"
			/>

			{boxXs.map((boxX, boxIndex) => (
				<rect
					key={boxX}
					x={boxX}
					y={4}
					width={32}
					height={40}
					rx={8}
					className={boxIndex === 3 ? "stroke-spark" : "stroke-cream/60"}
				/>
			))}
			{/* The code types itself, one digit after the other. */}
			{boxXs.slice(0, 3).map((boxX, boxIndex) => (
				<motion.circle
					key={boxX}
					cx={boxX + 16}
					cy={24}
					r={4}
					className="fill-white"
					initial={false}
					animate={isLive ? { opacity: [0, 1, 1, 0] } : { opacity: 1 }}
					transition={
						isLive
							? {
									duration: 3.6,
									times: [0, 0.06, 0.86, 1],
									delay: boxIndex * 0.45,
									repeat: Number.POSITIVE_INFINITY,
								}
							: { duration: 0 }
					}
				/>
			))}
			<path d="M 26 15 V 33" className="stroke-spark" />

			<rect
				x={56}
				y={12}
				width={38}
				height={30}
				rx={7}
				className="fill-spark/10 stroke-spark"
			/>
			<path d="M 64 12 V 4 A 11 11 0 0 1 86 4 V 12" className="stroke-spark" />
			<circle cx={75} cy={26} r={3} className="fill-spark" />

			<Pill
				x={-104}
				y={62}
				width={146}
				height={24}
				className="fill-white/10 stroke-cream/50"
			/>
			<Pill x={-64} y={71} width={66} height={6} className="fill-white/60" />
		</g>
	);
}

/** A table with a header and a new row. */
function DatabaseDrawing({ isLive }: DrawingProps) {
	const rowCenters = [-29, 5, 39, 74];
	return (
		<g>
			<rect
				x={-106}
				y={-76}
				width={184}
				height={168}
				rx={12}
				className="fill-white/[0.03] stroke-cream/60"
			/>
			<path
				d="M -106 -46 V -64 A 12 12 0 0 1 -94 -76 H 66 A 12 12 0 0 1 78 -64 V -46 Z"
				className="fill-spark/15"
			/>
			<path d="M -106 -46 H 78" className="stroke-cream/60" />
			<path
				d="M -52 -76 V 92 M 12 -76 V 92 M -106 -12 H 78 M -106 22 H 78 M -106 56 H 78"
				className="stroke-cream/30"
			/>
			<Pill x={-96} y={-64} width={30} height={6} className="fill-spark" />
			<Pill x={-42} y={-64} width={26} height={6} className="fill-spark/70" />
			<Pill x={22} y={-64} width={32} height={6} className="fill-spark/70" />

			{/* The new row glows while it syncs. */}
			<motion.rect
				x={-106}
				y={-12}
				width={184}
				height={34}
				className="fill-spark/15 stroke-spark"
				initial={false}
				animate={isLive ? { opacity: [0.35, 1, 0.35] } : { opacity: 1 }}
				transition={
					isLive
						? {
								duration: 2.4,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
							}
						: { duration: 0 }
				}
			/>
			{rowCenters.map((rowY, rowIndex) => {
				const isNewRow = rowIndex === 1;
				const barClass = isNewRow ? "fill-white" : "fill-cream/40";
				return (
					<g key={rowY}>
						<Pill
							x={-96}
							y={rowY - 3}
							width={34 - rowIndex * 4}
							height={6}
							className={barClass}
						/>
						<Pill
							x={-42}
							y={rowY - 3}
							width={22 + rowIndex * 3}
							height={6}
							className={barClass}
						/>
						<Pill
							x={22}
							y={rowY - 3}
							width={40 - rowIndex * 5}
							height={6}
							className={barClass}
						/>
					</g>
				);
			})}
		</g>
	);
}

/** A document, a photo and a PDF on top of each other. */
function FilesDrawing({ faceFill }: DrawingProps) {
	return (
		<g>
			<g transform="rotate(-10 -10 -30)">
				<rect
					x={-62}
					y={-88}
					width={88}
					height={110}
					rx={8}
					fill={faceFill}
					className="stroke-cream/55"
				/>
				<path
					d="M -50 -70 H 6 M -50 -58 H 14 M -50 -46 H -4"
					className="stroke-cream/45"
				/>
			</g>
			<rect
				x={36}
				y={-4}
				width={62}
				height={82}
				rx={8}
				fill={faceFill}
				className="stroke-cream/60"
			/>
			<path
				d="M 46 14 H 86 M 46 26 H 80 M 46 38 H 70"
				className="stroke-cream/45"
			/>
			<Pill x={46} y={54} width={26} height={12} className="fill-spark/80" />
			<g transform="rotate(7 -40 40)">
				<rect
					x={-98}
					y={-6}
					width={116}
					height={88}
					rx={8}
					fill={faceFill}
					className="stroke-white/85"
				/>
				<path
					d="M -88 72 L -60 38 L -42 56 L -28 44 L 8 74"
					className="stroke-spark"
				/>
				<circle cx={-6} cy={16} r={8} className="stroke-spark" />
			</g>
		</g>
	);
}

// Outline of a cog with 10 teeth, centered on 0 0: each tooth is a
// trapezoid from radius 31 to radius 40.
const COG_PATH = `${Array.from({ length: 10 }, (_, toothIndex) => {
	const center = (toothIndex * Math.PI) / 5;
	return [
		[center - 0.2, 31],
		[center - 0.12, 40],
		[center + 0.12, 40],
		[center + 0.2, 31],
	]
		.map(
			([angle, radius], pointIndex) =>
				`${toothIndex === 0 && pointIndex === 0 ? "M" : "L"} ${(radius * Math.cos(angle)).toFixed(2)} ${(radius * Math.sin(angle)).toFixed(2)}`,
		)
		.join(" ");
}).join(" ")} Z`;

/** Lines of code, a cog, a clock and an email: jobs that run on their own. */
function ServerDrawing({ isLive }: DrawingProps) {
	return (
		<g>
			<path
				d="M -102 -92 H -72 M -88 -78 H -40 M -88 -64 H -56 M -102 -50 H -84"
				className="stroke-spark"
			/>
			<path
				d="M -64 -92 H -22 M -32 -78 H 4 M -48 -64 H -10"
				className="stroke-cream/50"
			/>

			{/* The cog turns while the stack is on screen. */}
			<g transform="translate(-44 34)">
				<motion.g
					initial={false}
					animate={isLive ? { rotate: 360 } : { rotate: 0 }}
					transition={
						isLive
							? {
									duration: 12,
									repeat: Number.POSITIVE_INFINITY,
									ease: "linear",
								}
							: { duration: 0 }
					}
				>
					<path d={COG_PATH} className="fill-spark/10 stroke-spark" />
					<circle r={12} className="stroke-spark" />
				</motion.g>
			</g>

			<circle cx={46} cy={16} r={17} className="stroke-cream/70" />
			<path d="M 46 16 V 5 M 46 16 H 55" className="stroke-white" />
			<rect
				x={26}
				y={52}
				width={44}
				height={30}
				rx={6}
				className="stroke-cream/70"
			/>
			<path d="M 26 57 L 48 71 L 70 57" className="stroke-cream/70" />
		</g>
	);
}

const DRAWINGS: Record<LayerKey, (props: DrawingProps) => ReactElement> = {
	screens: ScreensDrawing,
	signIn: SignInDrawing,
	database: DatabaseDrawing,
	files: FilesDrawing,
	server: ServerDrawing,
};
