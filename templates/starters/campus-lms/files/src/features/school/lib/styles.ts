// Class lists that several pages share: the display face of a card title and the phone layout of a table.
// The course pages, the Assignments page, and the Students page use them. They read only theme tokens.

/** The heading face of the theme on a card title. The home sections use the same face, so the titles match on every page. */
export const DISPLAY_CARD_TITLE =
	"font-(--heading-weight) font-display text-lg tracking-(--heading-tracking)";

/**
 * Goes on the parent of a DataTable. Under 42rem of page width only the first column shows.
 * The first cell then shows the key facts of the row itself, with `@2xl/main:hidden` parts.
 */
export const FIRST_COLUMN_ON_PHONE =
	"@max-2xl/main:[&_:is(th,td):not(:first-child)]:hidden";
