/**
 * The mockup of one theme card in the request tray: a small app screen drawn in the theme of the
 * option. It shows the sidebar in its style and tone, the active nav item, the nav icon tiles, the header,
 * the user avatar where the user menu sits, 2 KPI tiles, 3 bars, and a primary button. The radius, border,
 * shadow, and fonts come from the theme too.
 * tray-bodies.tsx lazy-loads this file: the contracts theme schema holds the look catalog (about 177 KB).
 */

import type { TurnQuestionOption } from "@wandit/contracts";
import {
	type AppThemeFile,
	type AppThemePalette,
	type AppThemeSelection,
	type AppThemeVoice,
	appThemeFileSchema,
} from "@wandit/contracts/v2/app-theme";
import type { CSSProperties } from "react";
import { useEffect } from "react";

import { ensureFontStylesheetsLoaded } from "./world-fonts";

/** Props of the lazy mockup. tray-bodies.tsx passes the raw option field. */
export type ThemeMockupProps = {
	/** The theme.json of the option, checked only for its version and name on the wire. */
	theme: TurnQuestionOption["theme"];
};

// The card is about a fifth of a real screen. At that size a 12 px corner is 2 px, and the radius options look the same.
// Corners and shadows shrink by half: they stay apart and still fit the small boxes.
// Border widths stay real: a thin and a thick edge must still differ.
const MOCKUP_SCALE = 0.5;

/** The base corner of each radius option in px: the --radius values of the template engine.css. */
const RADIUS_PX: Record<AppThemeSelection["radius"], number> = {
	none: 0,
	sm: 6,
	md: 10,
	lg: 12,
	xl: 16,
};

/** The shadow step of each shadow option in px: the --shadow-offset values of engine.css. */
const SHADOW_OFFSET_PX: Record<AppThemeSelection["shadow"], number> = {
	none: 0,
	sm: 2,
	md: 4,
	lg: 6,
};

/**
 * The mini nav icon of each Phosphor weight: a box with a line in px and a fill in % of the glyph color.
 * The lines keep the Phosphor ratio 8 : 12 : 16 : 24, with regular at 1px. duotone fills 20%, as Phosphor does.
 * An SVG stroke draws a line below one device pixel fainter, so each weight shows also on a 1x screen.
 */
const ICON_STYLE_OF: Record<
	AppThemeSelection["icons"],
	{ strokePx: number; fillPercent: number }
> = {
	thin: { strokePx: 0.5, fillPercent: 0 },
	light: { strokePx: 0.75, fillPercent: 0 },
	regular: { strokePx: 1, fillPercent: 0 },
	bold: { strokePx: 1.5, fillPercent: 0 },
	fill: { strokePx: 1, fillPercent: 100 },
	duotone: { strokePx: 1, fillPercent: 20 },
};

/**
 * The first 3 tiles of navIcon "color": the nth-child hues of engine.css. Light tiles are at L 0.62,
 * dark tiles at L 0.56 with 0.9 of the chroma.
 */
const NAV_ICON_COLOR_TILES: Record<
	AppThemeSelection["mode"],
	readonly [string, string, string]
> = {
	light: [
		"oklch(0.62 0.15 250)",
		"oklch(0.62 0.14 50)",
		"oklch(0.62 0.14 150)",
	],
	dark: [
		"oklch(0.56 0.135 250)",
		"oklch(0.56 0.126 50)",
		"oklch(0.56 0.126 150)",
	],
};

/** The letter spacing of each heading tracking, as in engine.css. */
const HEADING_TRACKING: Record<AppThemeVoice["headingTracking"], string> = {
	tight: "-0.03em",
	snug: "-0.02em",
	normal: "0em",
};

/** The heights of the 3 chart bars, in % of the chart card. */
const BAR_HEIGHTS = ["45%", "85%", "60%"] as const;

/** A CSS color-mix of two theme colors. The schema allows only hex and oklch(), so the string is safe in a style. */
function mix(first: string, firstPercent: number, second: string): string {
	return `color-mix(in oklch, ${first} ${firstPercent}%, ${second})`;
}

/** A CSS font stack that starts with one theme family. The schema allows only letters, digits, and spaces. */
function fontStack(family: string): string {
	return `"${family}", ui-sans-serif, system-ui, sans-serif`;
}

/** The sidebar colors of a tone, as the data-sidebar-tone blocks of engine.css compute them. */
function sidebarColorsOf(
	palette: AppThemePalette,
	tone: AppThemeSelection["sidebarTone"],
) {
	if (tone === "contrast") {
		const ground = palette.contrast ?? palette.foreground;
		const text = palette.contrastForeground ?? palette.background;
		return {
			ground,
			text,
			hover: mix(ground, 85, text),
			hoverText: text,
			edge: mix(ground, 82, text),
			mark: text,
			markText: ground,
		};
	}
	if (tone === "brand") {
		return {
			ground: palette.primary,
			text: palette.primaryForeground,
			hover: palette.primaryForeground,
			hoverText: palette.primary,
			edge: mix(palette.primary, 80, palette.primaryForeground),
			mark: palette.primaryForeground,
			markText: palette.primary,
		};
	}
	// tint is 6% of the primary over the canvas. canvas is the canvas itself.
	const ground =
		tone === "tint" ? mix(palette.canvas, 94, palette.primary) : palette.canvas;
	return {
		ground,
		text: palette.foreground,
		hover: mix(ground, 90, palette.foreground),
		hoverText: palette.foreground,
		edge: palette.border,
		mark: palette.primary,
		markText: palette.primaryForeground,
	};
}

/** Draws the parsed theme, or a neutral face when the option holds no valid theme. */
export default function ThemeMockup({ theme }: ThemeMockupProps) {
	const parsed = appThemeFileSchema.safeParse(theme);
	const file = parsed.success ? parsed.data : null;
	const sansHref = file?.resolved.fonts.sans.href;
	const displayHref = file?.resolved.fonts.display.href;
	useEffect(() => {
		ensureFontStylesheetsLoaded(
			[sansHref, displayHref].filter((href) => href !== undefined),
		);
	}, [sansHref, displayHref]);

	// A broken option is a server bug. The card still shows its label and stays a valid pick.
	if (file === null) {
		return (
			<span className="grid size-full place-items-center bg-accent text-[24px] text-muted-foreground">
				Aa
			</span>
		);
	}
	return <Mockup file={file} />;
}

function Mockup({ file }: { file: AppThemeFile }) {
	const { selection, resolved } = file;
	const palette = resolved[selection.mode];
	const sidebar = sidebarColorsOf(palette, selection.sidebarTone);
	const isHard = selection.shadowStyle === "hard";
	const borderPx = Number(selection.border);
	const radiusPx = RADIUS_PX[selection.radius] * MOCKUP_SCALE;
	// The multiples of --radius in engine.css: 1.333 for a surface, 0.8 for a control.
	const surfaceRadius = radiusPx * 1.333;
	const controlRadius = radiusPx * 0.8;
	const offset = SHADOW_OFFSET_PX[selection.shadow] * MOCKUP_SCALE;
	// The soft shadow layers of engine.css. A dark page needs a higher alpha to show a shadow.
	const [near, far] = selection.mode === "dark" ? [25, 45] : [5, 10];
	const surfaceShadow = isHard
		? `${offset}px ${offset}px 0 0 ${palette.foreground}`
		: `0 ${offset * 0.5}px ${offset}px 0 ${mix(palette.shadowColor, near, "transparent")}, 0 ${offset}px ${offset * 3}px ${-offset * 0.5}px ${mix(palette.shadowColor, far, "transparent")}`;
	const controlShadow = isHard
		? `${offset * 0.75}px ${offset * 0.75}px 0 0 ${palette.foreground}`
		: `0 ${offset * 0.5}px ${offset}px 0 ${mix(palette.shadowColor, near, "transparent")}`;
	// A hard style draws every edge in ink, so the sidebar edge is ink too.
	const surfaceEdge = isHard ? palette.foreground : palette.border;
	const sidebarEdge = isHard ? palette.foreground : sidebar.edge;
	const isOutlined = selection.frame === "outlined";
	const panelFrame: CSSProperties = {
		borderRadius: surfaceRadius,
		border: isOutlined ? `${borderPx}px solid ${surfaceEdge}` : undefined,
		boxShadow: isOutlined ? surfaceShadow : undefined,
	};
	const surface: CSSProperties = {
		background: palette.card,
		color: palette.cardForeground,
		borderRadius: surfaceRadius,
		border: `${borderPx}px solid ${surfaceEdge}`,
		boxShadow: surfaceShadow,
	};
	// inset puts the page panel on the sidebar tone. floating puts both on the canvas. classic is flush.
	const rootGround =
		selection.sidebarStyle === "inset"
			? sidebar.ground
			: selection.sidebarStyle === "floating"
				? palette.canvas
				: palette.background;
	const pageGround =
		selection.sidebarStyle === "floating" ? palette.canvas : palette.background;
	const sidebarStyle: CSSProperties =
		selection.sidebarStyle === "classic"
			? {
					background: sidebar.ground,
					borderInlineEnd: `${borderPx}px solid ${sidebarEdge}`,
				}
			: selection.sidebarStyle === "floating"
				? {
						...panelFrame,
						margin: 4,
						marginInlineEnd: 0,
						background: sidebar.ground,
						border: isOutlined
							? `${borderPx}px solid ${sidebarEdge}`
							: undefined,
					}
				: {};
	const pageStyle: CSSProperties =
		selection.sidebarStyle === "inset"
			? {
					...panelFrame,
					margin: 4,
					marginInlineStart: 0,
					background: pageGround,
				}
			: { background: pageGround };
	// A still image cannot blur, so a faint shade under the see-through bar stands for the blur.
	const headerStyle: CSSProperties =
		selection.header === "bar"
			? { borderBottom: `${borderPx}px solid ${palette.border}` }
			: selection.header === "blur"
				? {
						background: mix(pageGround, 72, "transparent"),
						boxShadow: `0 1px 0 ${mix(palette.foreground, 6, "transparent")}`,
					}
				: {};
	const activeStyle = activeItemStyleOf({
		selection,
		palette,
		sidebar,
		radiusPx,
		borderPx,
		surfaceEdge,
		controlShadow,
	});
	// quiet marks the active row by its full color, so the other rows are muted more.
	const mutedText =
		selection.activeItem === "quiet"
			? mix(sidebar.text, 70, sidebar.ground)
			: mix(sidebar.text, 80, "transparent");
	const activeText = activeStyle.color ?? sidebar.text;
	const iconStyle = ICON_STYLE_OF[selection.icons];
	const avatar = (
		<span
			className="block size-[9px] shrink-0 rounded-full"
			style={{ background: mix(palette.primary, 35, palette.card) }}
		/>
	);
	const userRow = (
		<span className="flex items-center gap-[3px] px-[3px]">
			{avatar}
			<Line width={16} color={mix(sidebar.text, 45, "transparent")} />
		</span>
	);
	const numeralFont = fontStack(
		resolved.voice.numerals === "display"
			? resolved.fonts.display.family
			: resolved.fonts.sans.family,
	);

	return (
		<span
			className="flex size-full overflow-hidden"
			style={{
				background: rootGround,
				color: palette.foreground,
				fontFamily: fontStack(resolved.fonts.sans.family),
			}}
		>
			<span
				className="flex w-[54px] shrink-0 flex-col gap-[3px] px-[4px] py-[6px]"
				style={sidebarStyle}
			>
				<span className="mb-[2px] flex items-center gap-[3px] px-[3px]">
					<span
						className="block size-[9px] shrink-0"
						style={{ background: sidebar.mark, borderRadius: controlRadius }}
					/>
					<Line width={20} color={mix(sidebar.text, 75, "transparent")} />
				</span>
				{selection.userMenu === "sidebar-header" ? userRow : null}
				<NavItem
					style={activeStyle}
					textColor={activeText}
					iconStyle={iconStyle}
					tile={navIconTileOf({
						selection,
						palette,
						sidebar,
						radiusPx,
						row: 0,
						textColor: activeText,
					})}
				/>
				{([1, 2] as const).map((row) => (
					<NavItem
						key={row}
						style={{}}
						textColor={mutedText}
						iconStyle={iconStyle}
						tile={navIconTileOf({
							selection,
							palette,
							sidebar,
							radiusPx,
							row,
							textColor: mutedText,
						})}
					/>
				))}
				<span className="flex-1" />
				{selection.userMenu === "sidebar-footer" ? userRow : null}
			</span>
			<span
				className="flex min-w-0 flex-1 flex-col overflow-hidden"
				style={pageStyle}
			>
				<span
					className="flex h-[15px] shrink-0 items-center justify-between px-[7px]"
					style={headerStyle}
				>
					<Line
						width={28}
						color={mix(palette.mutedForeground, 60, "transparent")}
					/>
					{selection.userMenu === "header" ? avatar : null}
				</span>
				<span className="flex min-h-0 flex-1 flex-col gap-[4px] px-[7px] pt-[4px] pb-[6px]">
					<span
						className="block truncate text-[10px] leading-[1.15]"
						style={{
							fontFamily: fontStack(resolved.fonts.display.family),
							fontWeight: resolved.voice.headingWeight,
							letterSpacing: HEADING_TRACKING[resolved.voice.headingTracking],
						}}
					>
						{file.name}
					</span>
					<span className="flex gap-[4px]">
						{["248", "92%"].map((figure) => (
							<span
								key={figure}
								className="flex h-[25px] flex-1 flex-col justify-center gap-[2px] px-[5px]"
								style={surface}
							>
								<Line width={18} color={palette.mutedForeground} />
								<span
									className="block text-[8.5px] leading-none"
									style={{ fontFamily: numeralFont, fontWeight: 600 }}
								>
									{figure}
								</span>
							</span>
						))}
					</span>
					<span className="flex min-h-0 flex-1 items-end gap-[4px]">
						<span
							className="flex h-full flex-1 items-end gap-[4px] px-[6px] pt-[5px] pb-[4px]"
							style={surface}
						>
							{BAR_HEIGHTS.map((height, index) => (
								<span
									key={height}
									className="block w-[7px]"
									style={{
										height,
										background:
											[palette.chart1, palette.chart2, palette.chart3][index] ??
											palette.primary,
										borderRadius: Math.min(controlRadius, 2),
									}}
								/>
							))}
						</span>
						<span
							className="flex h-[13px] shrink-0 items-center px-[6px]"
							style={{
								background: palette.primary,
								borderRadius: controlRadius,
								// The filled button has an edge only in the hard style, in ink.
								border: isHard
									? `${borderPx}px solid ${palette.foreground}`
									: undefined,
								boxShadow: controlShadow,
							}}
						>
							<Line width={16} color={palette.primaryForeground} />
						</span>
					</span>
				</span>
			</span>
		</span>
	);
}

/**
 * The style of the active nav row: the data-active-item blocks of engine.css at the mockup scale.
 * quiet has no fill: the active row shows in full color, and the other rows are muted.
 */
function activeItemStyleOf(input: {
	selection: AppThemeSelection;
	palette: AppThemePalette;
	sidebar: ReturnType<typeof sidebarColorsOf>;
	/** The base corner at the mockup scale, in px. */
	radiusPx: number;
	/** The border width of the theme, in px. */
	borderPx: number;
	/** The edge color of a surface: the border, or ink in the hard style. */
	surfaceEdge: string;
	/** The box-shadow of a control, in the shadow style of the theme. */
	controlShadow: string;
}): CSSProperties {
	const { selection, palette, sidebar, radiusPx } = input;
	switch (selection.activeItem) {
		case "pill":
			return {
				background: sidebar.hover,
				color: sidebar.hoverText,
				borderRadius: 999,
			};
		case "bar":
			return {
				// On a brand ground, half of the swapped chip is a mid tone. The indicator alone marks the row.
				background:
					selection.sidebarTone === "brand"
						? undefined
						: mix(sidebar.hover, 50, sidebar.ground),
				color: sidebar.text,
				borderRadius: radiusPx * 0.4,
				borderInlineStart: `2px solid ${sidebar.mark}`,
			};
		case "block":
			return {
				background: sidebar.mark,
				color: sidebar.markText,
				borderRadius: radiusPx * 0.8,
			};
		case "outline":
			return {
				background: palette.card,
				color: palette.cardForeground,
				borderRadius: radiusPx * 0.8,
				// At least 1px: the edge is the only mark of this style.
				border: `${Math.max(1, input.borderPx)}px solid ${input.surfaceEdge}`,
				boxShadow: input.controlShadow,
			};
		case "quiet":
			return { color: sidebar.text };
	}
}

/** The tile behind the icon of one mockup nav row. */
type NavIconTile = {
	/** The fill of the tile. */
	ground: string;
	/** The stroke color of the icon on the tile. */
	glyph: string;
	/** The tile corner at the mockup scale, in px. */
	radiusPx: number;
	/** The ring color around the active tile of a quiet row, as in engine.css. Undefined draws no ring. */
	ring?: string;
};

/**
 * The icon tile of one nav row: the data-nav-icon blocks of engine.css at the mockup scale.
 * Undefined for "plain", which draws the glyph alone.
 */
function navIconTileOf(input: {
	selection: AppThemeSelection;
	/** The page colors of the theme. An outline row is a card, so its soft and solid tiles take the page primary. */
	palette: AppThemePalette;
	sidebar: ReturnType<typeof sidebarColorsOf>;
	/** The base corner at the mockup scale, in px. */
	radiusPx: number;
	/** The row of the mockup nav. Row 0 is the active row. */
	row: 0 | 1 | 2;
	/** The text color of the row. A soft tile mixes it, as currentColor does in engine.css. */
	textColor: string;
}): NavIconTile | undefined {
	const { selection, palette, sidebar, row, textColor } = input;
	// The tile is a third of a real tile. A third of the base corner keeps the ratio: 6px on 24px is 2px on 8px.
	const radiusPx = input.radiusPx / 3;
	if (selection.navIcon === "plain") {
		return undefined;
	}
	// A quiet row has no mark. Where the active tile looks like the others, a ring marks it.
	const ring =
		row === 0 &&
		selection.activeItem === "quiet" &&
		(selection.navIcon === "color" ||
			(selection.navIcon === "soft" &&
				(selection.sidebarTone === "brand" ||
					selection.sidebarTone === "contrast")))
			? sidebar.text
			: undefined;
	if (selection.navIcon === "color") {
		return {
			ground: NAV_ICON_COLOR_TILES[selection.mode][row],
			glyph: "oklch(1 0 0)",
			radiusPx,
			ring,
		};
	}
	if (row !== 0) {
		return {
			ground: mix(textColor, 12, "transparent"),
			glyph: textColor,
			radiusPx,
		};
	}
	if (selection.navIcon === "solid") {
		if (selection.activeItem === "outline") {
			return {
				ground: palette.primary,
				glyph: palette.primaryForeground,
				radiusPx,
			};
		}
		// These rows are filled with the sidebar primary, so the tile swaps the pair to show on the row.
		const isPrimaryRow =
			selection.activeItem === "block" ||
			(selection.activeItem === "pill" && selection.sidebarTone === "brand");
		return isPrimaryRow
			? { ground: sidebar.markText, glyph: sidebar.mark, radiusPx }
			: { ground: sidebar.mark, glyph: sidebar.markText, radiusPx };
	}
	// An outline row is a card. 20% of the sidebar primary looks like the inactive tiles there.
	if (selection.activeItem === "outline") {
		return {
			ground: mix(palette.primary, 45, "transparent"),
			glyph: textColor,
			radiusPx,
		};
	}
	// On these grounds the sidebar primary is the text color or the row color, so a primary tint melts in.
	const isPrimaryGround =
		selection.sidebarTone === "brand" ||
		selection.sidebarTone === "contrast" ||
		selection.activeItem === "block";
	return {
		ground: isPrimaryGround
			? mix(textColor, 22, "transparent")
			: mix(sidebar.mark, 20, "transparent"),
		glyph: textColor,
		radiusPx,
		ring,
	};
}

/** One nav row of the mockup sidebar: an icon box drawn in the icon weight, on its tile, and a text line. */
function NavItem({
	style,
	textColor,
	iconStyle,
	tile,
}: {
	/** The active row style from activeItemStyleOf, or {} for an inactive row. */
	style: CSSProperties;
	/** The color of the icon and the line. */
	textColor: string;
	/** The line and the fill of the icon weight of the theme, from ICON_STYLE_OF. */
	iconStyle: (typeof ICON_STYLE_OF)[AppThemeSelection["icons"]];
	/** The tile behind the icon, from navIconTileOf. Undefined draws the icon alone. */
	tile: NavIconTile | undefined;
}) {
	const glyph = tile?.glyph ?? textColor;
	return (
		<span
			className="flex h-[11px] shrink-0 items-center gap-[3px] px-[3px]"
			style={style}
		>
			<span
				className="grid shrink-0 place-items-center"
				style={
					tile === undefined
						? undefined
						: {
								background: tile.ground,
								padding: 1.5,
								borderRadius: tile.radiusPx,
								boxShadow:
									tile.ring === undefined
										? undefined
										: `0 0 0 1px ${tile.ring}`,
							}
				}
			>
				<svg className="block size-[5px]" viewBox="0 0 5 5" aria-hidden="true">
					{/* A stroke centers on the rect edge, so the rect insets by half the line. The box stays 5px with a 1.5px corner. */}
					<rect
						x={iconStyle.strokePx / 2}
						y={iconStyle.strokePx / 2}
						width={5 - iconStyle.strokePx}
						height={5 - iconStyle.strokePx}
						rx={1.5 - iconStyle.strokePx / 2}
						strokeWidth={iconStyle.strokePx}
						style={{
							stroke: glyph,
							fill:
								iconStyle.fillPercent === 0
									? "none"
									: mix(glyph, iconStyle.fillPercent, "transparent"),
						}}
					/>
				</svg>
			</span>
			<Line width={20} color={textColor} />
		</span>
	);
}

/** A rounded text stand-in: the mockup shows lines, not words, so it needs no translation. */
function Line({ width, color }: { width: number; color: string }) {
	return (
		<span
			className="block h-[2.5px] shrink-0 rounded-full"
			style={{ width, background: color }}
		/>
	);
}
