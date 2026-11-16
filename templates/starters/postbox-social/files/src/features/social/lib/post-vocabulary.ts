// The words of a post: its statuses with their Badge variant, the content pillars, and the team.
// sample-data.ts writes these values into each post. The list, the detail page, and the schedule read them.
// The label of a status is `posts.statuses.<status>`. The label of a pillar is `pillars.<pillar>`.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every status, in the order of the work. The tabs of the post list follow this order. */
export const POST_STATUSES = [
	"published",
	"scheduled",
	"draft",
	"failed",
] as const;

/** One status. A failed post is a post that the network refused at publish time. */
export type PostStatus = (typeof POST_STATUSES)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per status. Failed is the only red one, published the only green one. */
export const POST_STATUS_BADGE = {
	published: "success",
	scheduled: "info",
	draft: "secondary",
	failed: "destructive",
} satisfies Record<PostStatus, BadgeVariant>;

/** The content pillars of the editorial plan: the topics that every post belongs to. */
export const PILLARS = [
	"interviews",
	"cityGuide",
	"reviews",
	"events",
	"studio",
] as const;

/** One content pillar. */
export type Pillar = (typeof PILLARS)[number];

// Why the network refused a post. The label is `posts.failures.<reason>`, or `posts.failures.unknown` with no reason.
const FAILURE_REASONS = ["expiredLogin", "mediaRejected"] as const;

/** One reason of a failed post. */
export type FailureReason = (typeof FAILURE_REASONS)[number];

/** The social team of the magazine. Fictional people: each post names one author and one approver. */
export const TEAM = [
	"Inès Duarte",
	"Malik Osei",
	"Clara Weiss",
	"Tomás Reyes",
] as const;
