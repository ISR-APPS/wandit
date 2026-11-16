// The fixed value lists of the tracker: task statuses, priorities, kinds and their icons, project statuses, and project health.
// The sample tables, the badges, the board, and the filters read them. Labels come from messages.ts by code.
// A later database keeps the same lists as check constraints (STARTER.md).

import { BugIcon, SparkleIcon, WrenchIcon } from "@phosphor-icons/react";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";
import type { KitIcon } from "~/shared/ui/icons";

/** One look of the kit Badge. */
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** The task statuses in board order. "done" is the only closed status. */
export const TASK_STATUSES = [
	"backlog",
	"todo",
	"in-progress",
	"in-review",
	"done",
] as const;

/** One task status. */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The badge look of each task status. Work in motion is info, waiting for a reviewer is warning. */
export const TASK_STATUS_BADGE = {
	backlog: "secondary",
	todo: "outline",
	"in-progress": "info",
	"in-review": "warning",
	done: "success",
} satisfies Record<TaskStatus, BadgeVariant>;

/** The dot color of each status in a board column head and a workload bar. */
export const TASK_STATUS_DOT = {
	backlog: "bg-muted-foreground/50",
	todo: "bg-muted-foreground",
	"in-progress": "bg-info",
	"in-review": "bg-warning",
	done: "bg-success",
} satisfies Record<TaskStatus, string>;

/** The task priorities, the most urgent first. Sort keys use this order. */
export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;

/** One task priority. */
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The kinds of task. A bug feeds the "Bugs reported" series of the overview. */
export const TASK_KINDS = ["feature", "bug", "chore"] as const;

/** One kind of task. */
export type TaskKind = (typeof TASK_KINDS)[number];

/** The icon of each kind of task. The board cards and the task dialog show it before the task key. */
export const TASK_KIND_ICON = {
	feature: SparkleIcon,
	bug: BugIcon,
	chore: WrenchIcon,
} satisfies Record<TaskKind, KitIcon>;

/** The story point steps of an estimate. */
export const ESTIMATE_POINTS = [1, 2, 3, 5, 8] as const;

/** The project statuses in the order of the project tabs. */
export const PROJECT_STATUSES = [
	"active",
	"planned",
	"paused",
	"completed",
] as const;

/** One project status. */
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** The health of an active project, set by its lead. Other statuses have no health. */
export const PROJECT_HEALTHS = ["on-track", "at-risk", "off-track"] as const;

/** One project health. */
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];

/** The badge look of each project health. Off track uses the tinted destructive look of the delta pill. */
export const PROJECT_HEALTH_BADGE = {
	"on-track": "success",
	"at-risk": "warning",
	"off-track": "destructive",
} satisfies Record<ProjectHealth, BadgeVariant>;

/** The badge look of a project status when the project has no health. */
export const PROJECT_STATUS_BADGE = {
	active: "info",
	planned: "outline",
	paused: "secondary",
	completed: "success",
} satisfies Record<ProjectStatus, BadgeVariant>;
