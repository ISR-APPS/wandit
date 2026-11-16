// Layout classes that more than one feature needs.
// Cards with a control in their header read the two header classes. Small links and buttons read TOUCH_AREA.

/**
 * Classes for a CardHeader that holds a CardAction. Under the 2xl container width (a phone), the header has one column,
 * so the title keeps the full width. The "!" wins over the two-column rule of the kit CardHeader.
 */
export const STACKING_HEADER = "@max-2xl/main:grid-cols-1!";

/** Classes for the CardAction of a STACKING_HEADER. Under the 2xl container width, the control sits under the description. */
export const STACKING_ACTION =
	"@max-2xl/main:col-start-1 @max-2xl/main:row-span-1 @max-2xl/main:row-start-3 @max-2xl/main:mt-2 @max-2xl/main:justify-self-start";

/**
 * Classes for a text link or a small button. An invisible layer makes its touch area 44 px high or more on a phone:
 * 12 px above and under the element. The layout does not change.
 */
export const TOUCH_AREA =
	"relative after:absolute after:-inset-x-1 after:-inset-y-3";

/** Classes for a TabsTrigger of the 36 px tab strip: 4 px more touch area above and under it, 44 px in total. */
export const TAB_TOUCH_AREA =
	"before:absolute before:inset-x-0 before:-inset-y-1";
