import Svg, { Circle, Path, Rect } from "react-native-svg";

// Brand icon set traced from the mobile prototypes
// (design/Wandit-mobile-{dark,light}.html) so the app matches them stroke for
// stroke. Stroke icons default to the prototype's strokeWidth; "spark" and
// "play" are filled shapes.

type IconPath = {
	d: string;
	filled?: boolean;
	strokeWidth?: number;
};

type IconCircle = {
	cx: number;
	cy: number;
	r: number;
};

type IconRect = {
	x: number;
	y: number;
	width: number;
	height: number;
	rx?: number;
};

type IconDef = {
	viewBox: number;
	strokeWidth?: number;
	filled?: boolean;
	paths?: IconPath[];
	circles?: IconCircle[];
	rects?: IconRect[];
};

const ICONS = {
	/** Wandit star/spark (filled). */
	spark: {
		viewBox: 24,
		filled: true,
		paths: [
			{
				d: "M12 2c1.05 4.44 3.94 7.33 10 10-6.06 1.06-8.95 3.95-10 10-1.05-4.44-3.94-7.33-10-10 6.06-1.06 8.95-3.95 10-10Z",
			},
		],
	},
	menu: {
		viewBox: 18,
		strokeWidth: 1.8,
		paths: [{ d: "M3 6h12M3 12h8" }],
	},
	caretDown: {
		viewBox: 16,
		paths: [{ d: "M4 6l4 4 4-4" }],
	},
	chevronRight: {
		viewBox: 24,
		strokeWidth: 2.2,
		paths: [{ d: "M9 6l6 6-6 6" }],
	},
	plus: {
		viewBox: 18,
		paths: [{ d: "M9 3.5v11M3.5 9h11" }],
	},
	camera: {
		viewBox: 20,
		paths: [
			{
				d: "M2.5 6.5A1.5 1.5 0 0 1 4 5h2l1.3-2h5.4L14 5h2a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-8ZM10 13.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
			},
		],
	},
	mic: {
		viewBox: 20,
		paths: [
			{
				d: "M7 5.5a3 3 0 0 1 6 0v4a3 3 0 0 1-6 0v-4ZM4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5",
			},
		],
	},
	arrowUp: {
		viewBox: 18,
		paths: [{ d: "M9 14.5v-11M4.5 8 9 3.5 13.5 8" }],
	},
	arrowRight: {
		viewBox: 16,
		paths: [{ d: "M3 8h9M8.5 4 12.5 8l-4 4" }],
	},
	/** Filled play triangle (preview). */
	play: {
		viewBox: 18,
		filled: true,
		paths: [
			{
				d: "M4 2.8v10.4c0 .8.9 1.3 1.6.9l8-5.2c.6-.4.6-1.4 0-1.8l-8-5.2C4.9 1.5 4 2 4 2.8Z",
			},
		],
	},
	page: {
		viewBox: 20,
		paths: [{ d: "M3 4.5h14v11H3ZM3 7.5h14" }],
	},
	image: {
		viewBox: 20,
		paths: [
			{
				d: "M3 3.5h14v13H3ZM3.5 13 8 8.5l3 3 2.5-2.5 3 3M7.5 6.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4",
			},
		],
	},
	folder: {
		viewBox: 20,
		paths: [
			{
				d: "M2.5 5A1.5 1.5 0 0 1 4 3.5h3.5L9 5.5h7A1.5 1.5 0 0 1 17.5 7v7.5A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5V5Z",
			},
		],
	},
	close: {
		viewBox: 16,
		paths: [{ d: "M4 4l8 8M12 4l-8 8" }],
	},
	bookmark: {
		viewBox: 20,
		paths: [{ d: "M6 3.5h8V17l-4-3-4 3V3.5Z" }],
	},
	undo: {
		viewBox: 20,
		paths: [{ d: "M4 8h7.5a4 4 0 1 1 0 8H7M7 5 4 8l3 3" }],
	},
	search: {
		viewBox: 24,
		strokeWidth: 2,
		circles: [{ cx: 11, cy: 11, r: 7 }],
		paths: [{ d: "M20 20l-3.5-3.5" }],
	},
	/** Horizontal sliders — output/options configuration. */
	sliders: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{ d: "M21 5h-7M10 5H3M21 12h-9M8 12H3M21 19h-5M12 19H3" },
			{ d: "M14 3v4M8 10v4M16 17v4" },
		],
	},
	check: {
		viewBox: 20,
		strokeWidth: 2,
		paths: [{ d: "M4 10.5l4 4 8-8.5" }],
	},
	thumbsUp: {
		viewBox: 20,
		paths: [
			{
				d: "M6 9v8H3.5V9H6Zm0 0 3-5.5a1.6 1.6 0 0 1 2.9 1.1L11.3 8h3.9a1.6 1.6 0 0 1 1.6 1.9l-1.1 5.4A2 2 0 0 1 13.7 17H6",
			},
		],
	},
	copy: {
		viewBox: 20,
		rects: [{ x: 7, y: 7, width: 9.5, height: 9.5, rx: 2 }],
		paths: [
			{
				d: "M13 4.5V4a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 4v6.5A1.5 1.5 0 0 0 5 12h.5",
			},
		],
	},
	/** Project view tile — Page (browser window). */
	browser: {
		viewBox: 24,
		strokeWidth: 1.8,
		rects: [{ x: 3.5, y: 5, width: 17, height: 14.5, rx: 2.5 }],
		paths: [
			{ d: "M3.5 9.5h17" },
			{ d: "M6.4 7.3h0.01" },
			{ d: "M8.8 7.3h0.01" },
		],
	},
	/** Project view tile — Assets (image frame). */
	imageTile: {
		viewBox: 24,
		strokeWidth: 1.8,
		rects: [{ x: 3.5, y: 5, width: 17, height: 14, rx: 2.5 }],
		circles: [{ cx: 8.6, cy: 9.6, r: 1.4 }],
		paths: [{ d: "M20.5 15.5l-4.8-4.8-7.2 7.2" }],
	},
	megaphone: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{ d: "M3 11l17-5.5v13L3 14z" },
			{ d: "M7.5 14.8V17a2.4 2.4 0 0 0 4.7.7" },
		],
	},
	users: {
		viewBox: 24,
		strokeWidth: 1.8,
		circles: [
			{ cx: 9, cy: 8.5, r: 3.2 },
			{ cx: 16.8, cy: 9.5, r: 2.6 },
		],
		paths: [
			{ d: "M3.5 19.5a5.5 5.5 0 0 1 11 0" },
			{ d: "M16.2 15.2a5 5 0 0 1 4.3 4.3" },
		],
	},
	/** Settings row icon (sun/gear). */
	sun: {
		viewBox: 24,
		strokeWidth: 1.7,
		circles: [{ cx: 12, cy: 12, r: 3.1 }],
		paths: [
			{ d: "M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6" },
			{
				d: "M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9",
			},
		],
	},
	pencil: {
		viewBox: 24,
		strokeWidth: 1.7,
		paths: [{ d: "M4 20l1.2-4.2L16.8 4.2a2 2 0 0 1 2.9 2.9L8.2 18.8z" }],
	},
	/** Appearance row icon (half-filled circle). */
	contrast: {
		viewBox: 24,
		strokeWidth: 1.7,
		circles: [{ cx: 12, cy: 12, r: 8.5 }],
		paths: [{ d: "M12 3.5a8.5 8.5 0 0 1 0 17z", filled: true }],
	},
} satisfies Record<string, IconDef>;

export type WanditIconName = keyof typeof ICONS;

export type WanditIconProps = {
	name: WanditIconName;
	/** Rendered width/height in px. */
	size?: number;
	color: string;
	strokeWidth?: number;
};

export function WanditIcon({
	name,
	size = 17,
	color,
	strokeWidth,
}: WanditIconProps) {
	const icon: IconDef = ICONS[name];
	const baseStrokeWidth = strokeWidth ?? icon.strokeWidth ?? 1.5;

	return (
		<Svg
			width={size}
			height={size}
			viewBox={`0 0 ${icon.viewBox} ${icon.viewBox}`}
		>
			{icon.rects?.map((rect) => (
				<Rect
					key={`${rect.x}-${rect.y}`}
					x={rect.x}
					y={rect.y}
					width={rect.width}
					height={rect.height}
					rx={rect.rx}
					fill="none"
					stroke={color}
					strokeWidth={baseStrokeWidth}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			))}
			{icon.circles?.map((circle) => (
				<Circle
					key={`${circle.cx}-${circle.cy}`}
					cx={circle.cx}
					cy={circle.cy}
					r={circle.r}
					fill="none"
					stroke={color}
					strokeWidth={baseStrokeWidth}
					strokeLinecap="round"
				/>
			))}
			{icon.paths?.map((path) => {
				const filled = path.filled ?? icon.filled ?? false;
				return (
					<Path
						key={path.d}
						d={path.d}
						fill={filled ? color : "none"}
						stroke={filled ? undefined : color}
						strokeWidth={
							filled ? undefined : (path.strokeWidth ?? baseStrokeWidth)
						}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				);
			})}
		</Svg>
	);
}
