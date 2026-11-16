// Class names that fit a wide table into a narrow page column, for example a phone.
// The kit DataTable takes no class per column, so a wrapper hides the cells by their position.
// The reps list, the orders list, and the orders card of the rep page use them.
// The tab classes let a status filter wrap on a phone, with 44 px touch targets.

/**
 * On the wrapper of a table: below the 2xl main width (42rem, 672 px) only the first column shows.
 * Search, sort, and paging still work. The first cell then shows the key values itself, with NARROW_ONLY.
 * The sort button of the header also gets a 44 px touch height there.
 */
export const FIRST_COLUMN_WHEN_NARROW =
	"[&_td+td]:hidden [&_th+th]:hidden @2xl/main:[&_td+td]:table-cell @2xl/main:[&_th+th]:table-cell [&_th_button]:min-h-11 @2xl/main:[&_th_button]:min-h-0";

/** On content of the first cell that only the narrow layout shows: the values of the hidden columns. */
export const NARROW_ONLY = "@2xl/main:hidden";

/**
 * On a TabsList of a toolbar: the triggers wrap to a new line, so no tab hides past the card edge.
 * The kit list has a fixed h-9 through a group selector; the same selector sets the height back to auto.
 */
export const WRAPPING_TABS_LIST =
	"flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto";

/** On each TabsTrigger of a WRAPPING_TABS_LIST: a 44 px touch height below the 2xl main width. */
export const TOUCH_TAB_TRIGGER = "min-h-11 @2xl/main:min-h-0";
