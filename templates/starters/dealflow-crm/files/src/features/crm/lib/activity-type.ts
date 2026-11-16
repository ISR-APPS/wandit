// The kinds of a logged activity and the icon of each kind.
// The sample tables, the activity log, the timeline of a deal, and the breakdown read this file.
import {
	EnvelopeSimpleIcon,
	NotePencilIcon,
	PhoneIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";

/** Every kind of activity. Its label is the message key `activityTypes.<type>`. */
export const ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const;

/** One kind of activity. */
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** The icon of each kind. It takes the icon weight of the theme. */
export const ACTIVITY_TYPE_ICON = {
	call: PhoneIcon,
	email: EnvelopeSimpleIcon,
	meeting: UsersThreeIcon,
	note: NotePencilIcon,
} satisfies Record<ActivityType, KitIcon>;
