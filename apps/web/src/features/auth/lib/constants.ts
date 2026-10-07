/**
 * Shared class strings of the sign-in dialog. The email section and the dev
 * sign-in form of the auth modal use them, so each field and each secondary
 * button in the dialog looks the same.
 */

/**
 * A text field of the dialog: a soft navy tint with no border at rest, so it
 * does not look like a button. On focus it takes the sheet color, and the
 * Input keeps its own ember border and ring. The text color comes from the sheet.
 */
export const AUTH_FIELD_CLASS =
	"h-11 rounded-xl border-transparent bg-popover-foreground/[0.05] px-4 shadow-none placeholder:text-popover-foreground/60 focus-visible:bg-popover dark:bg-popover-foreground/[0.06] dark:focus-visible:bg-popover";

/**
 * A secondary action of the dialog: a white key with a thin navy bottom edge,
 * like the cards of the dashboard. The Google keycap stays the main action.
 */
export const AUTH_SECONDARY_BUTTON_CLASS =
	"h-11 w-full rounded-xl border-popover-foreground/[0.12] bg-popover font-grotesk font-semibold shadow-[0_2px_0_rgb(11_16_51/0.06)] hover:bg-popover-foreground/[0.03] hover:text-popover-foreground dark:border-popover-foreground/[0.12] dark:bg-popover dark:shadow-none dark:hover:bg-popover-foreground/[0.06]";
