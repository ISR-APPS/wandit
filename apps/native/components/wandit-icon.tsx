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
	minus: {
		viewBox: 18,
		paths: [{ d: "M3.5 9h11" }],
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
	/** Paperclip — files attached/sent (ask_user attachments receipt). */
	paperclip: {
		viewBox: 20,
		paths: [
			{
				d: "M13.9 5.1 7.7 11.3a1.7 1.7 0 0 0 2.4 2.4l6.2-6.2a3.4 3.4 0 0 0-4.8-4.8L5.3 8.9a5.1 5.1 0 0 0 7.2 7.2l4.6-4.6",
			},
		],
	},
	/** Power plug — Connect apps (MCP connectors). */
	plug: {
		viewBox: 20,
		paths: [
			{
				d: "M7 2.5v4M13 2.5v4M5 6.5h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5v-3ZM10 14.5v3",
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
	/** Failure/status glyph for danger headers. */
	alertTriangle: {
		viewBox: 24,
		strokeWidth: 2,
		paths: [
			{
				d: "M12 4.2 2.9 19.2a1.2 1.2 0 0 0 1 1.8h16.2a1.2 1.2 0 0 0 1-1.8L12 4.2Z",
			},
			{ d: "M12 10v4.2" },
			{ d: "M12 17.6h.01" },
		],
	},
	download: {
		viewBox: 24,
		strokeWidth: 2,
		paths: [
			{ d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" },
			{ d: "m7 10 5 5 5-5" },
			{ d: "M12 15V3" },
		],
	},
	film: {
		viewBox: 24,
		strokeWidth: 1.8,
		rects: [{ x: 3.5, y: 4, width: 17, height: 16, rx: 2.5 }],
		paths: [{ d: "M8 4v16M16 4v16M3.5 9h4.5M3.5 15h4.5M16 9h4.5M16 15h4.5" }],
	},
	/** Attachment chip glyph for CSV/XLSX documents. */
	spreadsheet: {
		viewBox: 20,
		strokeWidth: 1.6,
		rects: [{ x: 3, y: 3.5, width: 14, height: 13, rx: 2 }],
		paths: [{ d: "M3 8h14M8.5 8v8.5M3 12.5h14" }],
	},
	/** Filled stop square for neutral/stopped status headers. */
	squareStop: {
		viewBox: 20,
		filled: true,
		rects: [{ x: 5, y: 5, width: 10, height: 10, rx: 2 }],
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
	/** Comment bubble — page comment mode (prototype §5a). */
	bubble: {
		viewBox: 24,
		strokeWidth: 1.9,
		paths: [
			{
				d: "M20.5 12.2a8 8 0 0 1-11.6 7.1L4 20.5l1.3-4.6A8 8 0 1 1 20.5 12.2z",
			},
		],
	},
	/** Crosshair — element-target chips (chat Cibler mode). */
	crosshair: {
		viewBox: 20,
		strokeWidth: 1.6,
		circles: [{ cx: 10, cy: 10, r: 6.5 }],
		paths: [{ d: "M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2" }],
	},
	/** Section visibility toggles (page editor Sections tab). */
	eye: {
		viewBox: 24,
		strokeWidth: 1.8,
		circles: [{ cx: 12, cy: 12, r: 3 }],
		paths: [
			{
				d: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z",
			},
		],
	},
	eyeOff: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{
				d: "M4.5 5.5C3 7 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.5 4.4-1.2M9.9 6C10.6 5.7 11.3 5.5 12 5.5c6 0 9.5 6.5 9.5 6.5s-.8 1.5-2.3 3",
			},
			{ d: "M9.9 9.9a3 3 0 0 0 4.2 4.2" },
			{ d: "M4 4l16 16" },
		],
	},
	/** Publish address card (publish sheet). */
	globe: {
		viewBox: 24,
		strokeWidth: 1.7,
		circles: [{ cx: 12, cy: 12, r: 8.5 }],
		paths: [
			{ d: "M3.5 12h17" },
			{
				d: "M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5s1.3-6.2 3.8-8.5z",
			},
		],
	},
	/** Appearance row icon (half-filled circle). */
	contrast: {
		viewBox: 24,
		strokeWidth: 1.7,
		circles: [{ cx: 12, cy: 12, r: 8.5 }],
		paths: [{ d: "M12 3.5a8.5 8.5 0 0 1 0 17z", filled: true }],
	},
	/** Hub pill chevron (rotates 180° when the selector opens). */
	chevronUp: {
		viewBox: 24,
		strokeWidth: 2.2,
		paths: [{ d: "m18 15-6-6-6 6" }],
	},
	/** Lead card action — tap-to-call handset. */
	phone: {
		viewBox: 24,
		strokeWidth: 1.7,
		paths: [
			{
				d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
			},
		],
	},
	/** List refresh (circular arrow). */
	refresh: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [{ d: "M21 12a9 9 0 1 1-2.64-6.36" }, { d: "M21 3v6h-6" }],
	},
	/** Marketing type — HTML section wireframe. */
	layout: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{ d: "M3 3.5h18v7H3z" },
			{ d: "M3 14h9.5v6.5H3z" },
			{ d: "M16.5 14H21v6.5h-4.5z" },
		],
	},
	/** Marketing type — video script clapperboard. */
	clap: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{
				d: "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1-.3 2.1.3 2.4 1.3Z",
			},
			{ d: "m6.2 5.3 3.1 3.9" },
			{ d: "m12.4 3.4 3.1 4" },
			{ d: "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" },
		],
	},
	/** Marketing type — strategy route between two waypoints. */
	route: {
		viewBox: 24,
		strokeWidth: 1.8,
		circles: [
			{ cx: 6, cy: 19, r: 2.6 },
			{ cx: 18, cy: 5, r: 2.6 },
		],
		paths: [{ d: "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" }],
	},
	/** Marketing type — creative brief document with text lines. */
	docText: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{ d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" },
			{ d: "M14 2v4a2 2 0 0 0 2 2h4" },
			{ d: "M16 13H8M16 17H8M10 9H8" },
		],
	},
	/** Empty search result (magnifier with an X in the lens). */
	searchX: {
		viewBox: 24,
		strokeWidth: 1.7,
		circles: [{ cx: 11, cy: 11, r: 7 }],
		paths: [
			{ d: "M20 20l-3.5-3.5" },
			{ d: "m8.8 8.8 4.4 4.4" },
			{ d: "m13.2 8.8-4.4 4.4" },
		],
	},
	maximize: {
		viewBox: 24,
		strokeWidth: 2,
		paths: [{ d: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" }],
	},
	/** Chain link — the tray's link ask field. */
	link: {
		viewBox: 20,
		strokeWidth: 1.7,
		paths: [
			{ d: "M8.5 6.2 10 4.7a3.2 3.2 0 0 1 4.5 4.5l-1.5 1.5" },
			{ d: "M11.5 13.8 10 15.3a3.2 3.2 0 0 1-4.5-4.5L7 9.3" },
			{ d: "m7.8 12.2 4.4-4.4" },
		],
	},
	/** Calendar — the tray's date & time ask. */
	calendar: {
		viewBox: 20,
		strokeWidth: 1.6,
		rects: [{ x: 3, y: 4.5, width: 14, height: 12.5, rx: 2 }],
		paths: [{ d: "M3 8.5h14M7 2.5v4M13 2.5v4" }],
	},
	/** Circular alert — the tray's invalid-link state. */
	alertCircle: {
		viewBox: 20,
		strokeWidth: 1.8,
		circles: [{ cx: 10, cy: 10, r: 7.5 }],
		paths: [{ d: "M10 6.5v4" }, { d: "M10 13.6h.01" }],
	},
	/** Trash can — the drawer's delete-project action. */
	trash: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{
				d: "M4.5 7h15M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7m2 0-.7 12.1a1.5 1.5 0 0 1-1.5 1.4H9.2a1.5 1.5 0 0 1-1.5-1.4L7 7",
			},
		],
	},
	/** Arrow leaving a door — the drawer's sign-out action. */
	signOut: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{ d: "M15 4.5h2.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H15" },
			{ d: "M11 8.5 7.5 12l3.5 3.5M7.5 12H15" },
		],
	},
	/** Arrow out of a box — the drawer's open-live-page action. */
	externalLink: {
		viewBox: 24,
		strokeWidth: 1.8,
		paths: [
			{ d: "M13.5 4.5h6v6" },
			{ d: "M19.5 4.5 11 13" },
			{
				d: "M18 15v3.5A1.5 1.5 0 0 1 16.5 20h-10A1.5 1.5 0 0 1 5 18.5v-10A1.5 1.5 0 0 1 6.5 7H10",
			},
		],
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
					fill={icon.filled ? color : "none"}
					stroke={icon.filled ? undefined : color}
					strokeWidth={icon.filled ? undefined : baseStrokeWidth}
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
