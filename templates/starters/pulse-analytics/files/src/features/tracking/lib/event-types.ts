// The events that the product sends, and the product area of each one.
// The sample tables count them, the Events page lists them, and the feature panels group them by area.
// Each key is also a message key: `eventTypes.<key>` is the sentence, `areas.<area>` is the area name.

/** Every product area, in display order. `account` holds sign-in and billing events and is not a feature. */
export const PRODUCT_AREAS = [
	"tasks",
	"projects",
	"comments",
	"search",
	"reports",
	"files",
	"automations",
	"integrations",
	"account",
] as const;

/** One product area. Its label is the message key `areas.<area>`. */
export type ProductArea = (typeof PRODUCT_AREAS)[number];

/** The areas that are product features. The adoption panels rank only these. */
export const FEATURE_AREAS = PRODUCT_AREAS.filter((area) => area !== "account");

/** One tracked event: the name that the product sends, and its area. */
export type EventType = {
	/** The event name in the tracking code, in snake case. */
	key: string;
	area: ProductArea;
	/**
	 * How often an active person does it, against the other events. 0 for an event that the sample tables
	 * write by rule (a sign-up, a session start, a plan upgrade) and not by chance.
	 */
	weight: number;
};

/** Every tracked event. The order is the order of the sample counters, so add a new event at the end. */
export const EVENT_TYPES = [
	{ key: "session_started", area: "account", weight: 0 },
	{ key: "signed_up", area: "account", weight: 0 },
	{ key: "project_viewed", area: "projects", weight: 20 },
	{ key: "project_created", area: "projects", weight: 1.6 },
	{ key: "task_created", area: "tasks", weight: 17 },
	{ key: "task_completed", area: "tasks", weight: 22 },
	{ key: "comment_added", area: "comments", weight: 12 },
	{ key: "search_performed", area: "search", weight: 9 },
	{ key: "report_viewed", area: "reports", weight: 6 },
	{ key: "report_exported", area: "reports", weight: 1.4 },
	{ key: "file_uploaded", area: "files", weight: 4.5 },
	{ key: "automation_run", area: "automations", weight: 2.2 },
	{ key: "automation_created", area: "automations", weight: 0.45 },
	{ key: "invite_sent", area: "account", weight: 0.3 },
	{ key: "integration_connected", area: "integrations", weight: 0.12 },
	{ key: "plan_upgraded", area: "account", weight: 0 },
] as const satisfies readonly EventType[];

/** The name of one tracked event, for example "task_completed". */
export type EventKey = (typeof EVENT_TYPES)[number]["key"];

/** The place of an event in EVENT_TYPES. The sample counters use it as their index. */
export function eventIndexOf(key: EventKey): number {
	return EVENT_TYPES.findIndex((type) => type.key === key);
}

/** The steps of the activation funnel, in order. A new person does each one at most one time. */
export const FUNNEL_STEPS = [
	"signed_up",
	"project_created",
	"task_completed",
	"invite_sent",
	"integration_connected",
] as const satisfies readonly EventKey[];

/** The event of one funnel step. Its label is the message key `reports.funnel.steps.<key>`. */
export type FunnelStepKey = (typeof FUNNEL_STEPS)[number];

/** A person is "activated" at this step of FUNNEL_STEPS: the first completed task. */
export const ACTIVATION_STEP = 2;
