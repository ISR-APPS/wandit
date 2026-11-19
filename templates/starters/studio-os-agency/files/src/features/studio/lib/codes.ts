// The code lists of Studio OS: services, billing types, phases, health, statuses, roles, and industries.
// The sample data, the badges, the filters, and the message keys read them.
// A later database keeps the same values as check constraints (see STARTER.md).
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** The variant names of the kit Badge. */
export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

/** The service lines of the studio. The breakdown and the project filter follow this order. */
export const SERVICES = [
	"branding",
	"web",
	"campaign",
	"motion",
	"content",
] as const;

/** One service line. Its label is `codes.services.<service>`. */
export type Service = (typeof SERVICES)[number];

/** How a project bills: a fixed fee in three stages, a monthly retainer, or hours at a rate. */
export const BILLING_TYPES = ["fixed", "retainer", "hourly"] as const;

/** One billing type. Its label is `codes.billing.<type>`. */
export type BillingType = (typeof BILLING_TYPES)[number];

/** The phases of a project, in the order of the work. A retainer stays "ongoing". */
export const PHASES = [
	"discovery",
	"design",
	"production",
	"review",
	"ongoing",
	"delivered",
] as const;

/** One phase. Its label is `codes.phases.<phase>`. */
export type Phase = (typeof PHASES)[number];

/** The phases that a fixed or hourly project walks through before delivery. */
export const TIMELINE_PHASES = [
	"discovery",
	"design",
	"production",
	"review",
] as const satisfies readonly Phase[];

/** One phase of the timeline. */
export type TimelinePhase = (typeof TIMELINE_PHASES)[number];

/** Badge variant per phase. Delivered is the only green one. */
export const PHASE_BADGE = {
	discovery: "secondary",
	design: "info",
	production: "info",
	review: "warning",
	ongoing: "outline",
	delivered: "success",
} satisfies Record<Phase, BadgeVariant>;

/** The budget health of a live project. A delivered project has none. */
export const HEALTH_VALUES = ["on_track", "at_risk", "over_budget"] as const;

/** One health value. Its label is `codes.health.<health>`. */
export type Health = (typeof HEALTH_VALUES)[number];

/** Badge variant per health value. Over budget is the only red one. */
export const HEALTH_BADGE = {
	on_track: "success",
	at_risk: "warning",
	over_budget: "destructive",
} satisfies Record<Health, BadgeVariant>;

/** The steps of a deliverable, in order. */
export const DELIVERABLE_STATUSES = [
	"todo",
	"in_progress",
	"client_review",
	"approved",
] as const;

/** One deliverable status. Its label is `codes.deliverables.<status>`. */
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

/** Badge variant per deliverable status. */
export const DELIVERABLE_BADGE = {
	todo: "secondary",
	in_progress: "info",
	client_review: "warning",
	approved: "success",
} satisfies Record<DeliverableStatus, BadgeVariant>;

/** The statuses of an invoice. Overdue is a sent invoice past its due day. */
export const INVOICE_STATUSES = ["draft", "sent", "overdue", "paid"] as const;

/** One invoice status. Its label is `codes.invoices.<status>`. */
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Badge variant per invoice status. */
export const INVOICE_BADGE = {
	draft: "secondary",
	sent: "info",
	overdue: "destructive",
	paid: "success",
} satisfies Record<InvoiceStatus, BadgeVariant>;

/** The relation with a client, from its live projects: a retainer, project work, or nothing live. */
export const CLIENT_RELATIONS = ["retainer", "project", "dormant"] as const;

/** One client relation. Its label is `codes.relations.<relation>`. */
export type ClientRelation = (typeof CLIENT_RELATIONS)[number];

/** Badge variant per client relation. */
export const RELATION_BADGE = {
	retainer: "default",
	project: "info",
	dormant: "outline",
} satisfies Record<ClientRelation, BadgeVariant>;

/** The roles of the team. Their labels are `codes.roles.<role>`. */
export const ROLES = [
	"creative_director",
	"art_director",
	"senior_designer",
	"designer",
	"motion_designer",
	"developer",
	"copywriter",
	"strategist",
	"producer",
	"account_director",
] as const;

/** One role. */
export type Role = (typeof ROLES)[number];

/** The industries of the clients. Their labels are `codes.industries.<industry>`. */
export const INDUSTRIES = [
	"food",
	"retail",
	"beauty",
	"travel",
	"nonprofit",
	"hospitality",
	"fintech",
	"architecture",
	"music",
	"health",
	"technology",
	"education",
	"culture",
	"energy",
	"events",
	"public",
] as const;

/** One industry. */
export type Industry = (typeof INDUSTRIES)[number];

/** The currency of every amount. A real studio sets its own. */
export const STUDIO_CURRENCY = "EUR";
