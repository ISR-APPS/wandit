// All user-facing copy for the workspace feature (centralized so a locale
// swap is cheap) + tab/status/timing config.

/**
 * WORKSPACE CONSTANTS — the feature's central "settings file".
 *
 * What this file is: a grab-bag of plain values (no logic, no React) that the
 * rest of the workspace feature imports: tab definitions, localStorage keys,
 * page sizes, canvas geometry, and lead-status styling. Keeping them in one file means a designer or
 * translator can retune the workspace without hunting through components.
 *
 * Where it sits in the AI-chat flow: two constants matter for chat UI
 * persistence — CHAT_OPEN_STORAGE_KEY (is the chat pane open or closed?) and
 * WORKSPACE_PANELS_STORAGE_ID (how wide is the chat/main split?). Both are
 * localStorage keys. "localStorage" is the browser's tiny built-in key/value
 * store that survives page reloads, so when you come back to a project the
 * workspace looks exactly how you left it. store.tsx reads/writes the first
 * key; helpers.ts + pages/workspace-page.tsx read/write the second. Nothing
 * here talks to the server — the actual chat traffic lives in
 * use-project-chat.tsx and api/chat.*.
 */

// LucideIcon is just the TypeScript type for one icon component from the
// lucide-react icon library (each icon is a small React component that
// renders an SVG).
import type { LucideIcon } from "lucide-react";
import { File, Image, Settings2, Users, Volume2 } from "lucide-react";

import type { LeadStatus, WorkspaceTab } from "../api/dto";

export const WORKSPACE_TAB_VALUES = [
	"page",
	"assets",
	"marketing",
	"leads",
	"settings",
] as const;

export type WorkspaceTabDef = {
	value: WorkspaceTab;
	icon: LucideIcon;
};

// Tab value + icon; the label is localized (workspace.tabs.<value>).
export const WORKSPACE_TABS: WorkspaceTabDef[] = [
	{ value: "page", icon: File },
	{ value: "assets", icon: Image },
	{ value: "marketing", icon: Volume2 },
	{ value: "leads", icon: Users },
	{ value: "settings", icon: Settings2 },
];

/** Downloaded marketing-plan filename — config, not display copy. */
export function marketingPlanFileName(projectId: string): string {
	return `marketing-plan-${projectId}.md`;
}

/** Published sites live on {slug}.wandit.app — mirrors projects' copy. */
export const PUBLISHED_DOMAIN = ".wandit.app";

export const LEADS_PAGE_SIZE = 12;
export const CHAT_OPEN_STORAGE_KEY = "wandit-workspace-chat-open";
/** react-resizable-panels autoSaveId — persists chat/main split width. */
export const WORKSPACE_PANELS_STORAGE_ID = "wandit-workspace-panels";
/** Assets tab view mode (grid vs freeform board), mirrors chat-open persistence. */
export const ASSETS_VIEW_STORAGE_KEY = "wandit-workspace-assets-view";

export const ASSETS_CANVAS_BOARD = {
	WIDTH: 1200,
	HEIGHT: 820,
	PAN_OVERLAP: 80,
} as const;

export const ASSETS_CANVAS_ZOOM = {
	MIN: 28,
	MAX: 140,
	STEP: 8,
	DEFAULT: 68,
} as const;

export const ASSETS_CANVAS_LAYOUT_SLOTS = [
	{ x: 80, y: 104, width: 184, height: 184 },
	{ x: 452, y: 56, width: 196, height: 245 },
	{ x: 250, y: 352, width: 184, height: 184 },
	{ x: 704, y: 150, width: 150, height: 266 },
	{ x: 772, y: 452, width: 300, height: 169 },
	{ x: 118, y: 594, width: 260, height: 195 },
] as const;

/** Debounce before the slug-availability endpoint is asked about a draft. */
export const SLUG_CHECK_DEBOUNCE_MS = 500;

/** Badge variant + select dot per lead status, in pipeline order. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
	"to_confirm",
	"confirmed",
	"shipped",
	"delivered",
	"returned",
	"cancelled",
];

// Badge variant + select dot per lead status; the label is localized
// (leads.status.<enum_value>).
export const LEAD_STATUS_META: Record<
	LeadStatus,
	{
		badgeVariant:
			| "default"
			| "secondary"
			| "destructive"
			| "outline"
			| "warning"
			| "info"
			| "success";
		dotClass: string;
	}
> = {
	to_confirm: {
		badgeVariant: "warning",
		dotClass: "bg-amber-500",
	},
	confirmed: {
		badgeVariant: "info",
		dotClass: "bg-blue-500",
	},
	shipped: {
		badgeVariant: "secondary",
		dotClass: "bg-violet-500",
	},
	delivered: {
		badgeVariant: "success",
		dotClass: "bg-emerald-500",
	},
	returned: {
		badgeVariant: "outline",
		dotClass: "bg-slate-400",
	},
	cancelled: {
		badgeVariant: "destructive",
		dotClass: "bg-red-500",
	},
};
