// The calendar content: its formats, its statuses, and the rule that gives the status of one item.
// The sample tables store a planned stage. The calendar and the campaign page read the status through contentStatusOf.
import type { BadgeVariant } from "./campaign-status";
import type { Channel } from "./channels";

/** Every content format. Each one runs on one channel (CONTENT_FORMAT_CHANNEL). */
export const CONTENT_FORMATS = [
	"social_post",
	"search_ad",
	"email",
	"video",
	"creator_post",
] as const;

/** One format. Its label is the message key `contentFormats.<format>`. */
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

/** The channel of each format. The calendar chip takes the color of this channel. */
export const CONTENT_FORMAT_CHANNEL = {
	social_post: "paid_social",
	search_ad: "search",
	email: "email",
	video: "video",
	creator_post: "partners",
} satisfies Record<ContentFormat, Channel>;

/** The stages of an item before it goes out, in the order of the work. */
export const CONTENT_STAGES = ["drafting", "in_review", "scheduled"] as const;

/** One stage before publication. */
export type ContentStage = (typeof CONTENT_STAGES)[number];

/** Every status of an item, in the order of the work. The label is the message key `contentStatus.<status>`. */
export const CONTENT_STATUSES = [...CONTENT_STAGES, "published"] as const;

/** One status of a calendar item. */
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Badge variant per status. Published is green, in review amber. */
export const CONTENT_STATUS_BADGE = {
	drafting: "outline",
	in_review: "warning",
	scheduled: "info",
	published: "success",
} satisfies Record<ContentStatus, BadgeVariant>;

/**
 * The status of an item at `now` (milliseconds since 1970).
 * An item goes out at its time, so an item at or before now is published. Else it keeps its stage.
 */
export function contentStatusOf(
	scheduledAt: string,
	stage: ContentStage,
	now: number,
): ContentStatus {
	return Date.parse(scheduledAt) <= now ? "published" : stage;
}
