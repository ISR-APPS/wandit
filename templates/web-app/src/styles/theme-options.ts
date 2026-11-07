/**
 * The option lists of the theme file: one list for each enum of src/styles/theme.json.
 * theme.ts builds its zod schema from these lists. The host keeps an equal copy, APP_THEME_OPTIONS
 * in packages/contracts, and a host spec fails when the two differ. This file has no import.
 */

/** Every value that an enum field of theme.json can hold. "hue" is the named primary colors. */
export const APP_THEME_OPTIONS = {
	/** Who wrote the file last. "template" is the default file of this template. */
	origin: ["template", "host", "user"],
	/** Where the palette comes from: a look of the host catalog, a design world, or three brand seeds. */
	sourceKind: ["look", "world", "seeds"],
	mode: ["light", "dark"],
	/** The 17 Tailwind v4 hues. A selection primary is one of them, "look", or a "#rrggbb" brand color. */
	hue: [
		"red",
		"orange",
		"amber",
		"yellow",
		"lime",
		"green",
		"emerald",
		"teal",
		"cyan",
		"sky",
		"blue",
		"indigo",
		"violet",
		"purple",
		"fuchsia",
		"pink",
		"rose",
	],
	/** The size of the text and the spacing of the whole app. "md" is the designed size. */
	scale: ["xs", "sm", "md", "lg", "xl"],
	/** The corner radius of cards, controls, and panels. */
	radius: ["none", "sm", "md", "lg", "xl"],
	/** Border width in px, as text: data-border="1.5" selects the engine.css block. */
	border: ["0.5", "1", "1.5", "2", "3"],
	/** The depth of the card and panel shadows. */
	shadow: ["none", "sm", "md", "lg"],
	/** "soft" is a blurred shadow. "hard" is a 0-blur offset copy of the edge, the press look. */
	shadowStyle: ["soft", "hard"],
	/** "centered" holds the page content at 72rem. */
	content: ["full", "centered"],
	/** The kit Sidebar variant: inset, sidebar ("classic"), or floating. */
	sidebarStyle: ["inset", "classic", "floating"],
	/** What the sidebar toggle does on desktop: icons only, icons with labels under them, or hide. */
	sidebarCollapse: ["icons", "rail", "offcanvas"],
	/** The desktop sidebar state at page load. */
	sidebarStart: ["open", "collapsed"],
	/** The sidebar ground: the canvas, a tint of the page, the `contrast` slab, or the primary. */
	sidebarTone: ["canvas", "tint", "contrast", "brand"],
	/** How the selected nav item and the selected tab show. */
	activeItem: ["pill", "bar", "block", "outline", "quiet"],
	/** The top bar of /app: a solid bar with an edge, a blurred see-through bar, or no ground. */
	header: ["bar", "blur", "plain"],
	/** Where the user avatar menu sits: in the sidebar footer, under the brand row, or at the end of the top bar. */
	userMenu: ["sidebar-footer", "sidebar-header", "header"],
	/** The edge and the shadow of the inset page panel and of the floating sidebar. */
	frame: ["outlined", "flat"],
	/**
	 * The Phosphor weight of every icon. __root.tsx gives it to the IconContext of @phosphor-icons/react.
	 * fill draws solid shapes. duotone adds a 20% fill under the regular line.
	 */
	icons: ["thin", "light", "regular", "bold", "fill", "duotone"],
	/**
	 * The frame of the main nav icons. plain shows the glyph alone. soft adds a faint tile.
	 * solid also makes the active tile solid. color gives each item its own hue tile, as in iOS Settings.
	 * The glyph stays the same icon.
	 */
	navIcon: ["plain", "soft", "solid", "color"],
	/** The CSS font weight of headings. */
	headingWeight: [500, 600, 700, 800],
	/** Letter spacing of headings: tight -0.03em, snug -0.02em, normal 0. */
	headingTracking: ["tight", "snug", "normal"],
	/** The face of KPI figures: the display face or the body face. */
	numerals: ["display", "sans"],
} as const;
