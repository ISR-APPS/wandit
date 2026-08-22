// Presentation metadata + tiny pure helpers for the contract lead model.
// Colors are hex twins of the design's oklch values — RN's parser (and
// react-native-svg) can't read oklch().

import {
	type Lead,
	type LeadSource,
	type LeadStatus,
	publicLeadExtraEntries,
} from "@wandit/contracts";
import type { TranslationKey } from "@wandit/internationalization";

export type LeadStatusStyle = {
	labelKey: TranslationKey;
	dot: string;
	text: string;
	/** Readable twin of `text` on dark surfaces (the design is light-only). */
	textDark: string;
	bg: string;
	border: string;
};

/** Order also drives every status list in the UI. */
export const LEAD_STATUS_ORDER: readonly LeadStatus[] = [
	"to_confirm",
	"confirmed",
	"shipped",
	"delivered",
	"returned",
	"cancelled",
];

export const LEAD_STATUS: Record<LeadStatus, LeadStatusStyle> = {
	to_confirm: {
		labelKey: "native.workspace.leadsView.status.toConfirm",
		dot: "#f59e0b",
		text: "#b45309",
		textDark: "#fbbf24",
		bg: "rgba(245,158,11,0.12)",
		border: "rgba(245,158,11,0.32)",
	},
	confirmed: {
		labelKey: "native.workspace.leadsView.status.confirmed",
		dot: "#3b82f6",
		text: "#1d4ed8",
		textDark: "#93b8fd",
		bg: "rgba(59,130,246,0.10)",
		border: "rgba(59,130,246,0.30)",
	},
	shipped: {
		labelKey: "native.workspace.leadsView.status.shipped",
		dot: "#8b5cf6",
		text: "#6d28d9",
		textDark: "#c4b5fd",
		bg: "rgba(139,92,246,0.10)",
		border: "rgba(139,92,246,0.30)",
	},
	delivered: {
		labelKey: "native.workspace.leadsView.status.delivered",
		dot: "#10b981",
		text: "#047857",
		textDark: "#6ee7b7",
		bg: "rgba(16,185,129,0.10)",
		border: "rgba(16,185,129,0.30)",
	},
	returned: {
		labelKey: "native.workspace.leadsView.status.returned",
		dot: "#a8a29e",
		text: "#57534e",
		textDark: "#d6d3d1",
		bg: "rgba(168,162,158,0.14)",
		border: "rgba(168,162,158,0.38)",
	},
	cancelled: {
		labelKey: "native.workspace.leadsView.status.cancelled",
		dot: "#ef4444",
		text: "#b91c1c",
		textDark: "#fca5a5",
		bg: "rgba(239,68,68,0.09)",
		border: "rgba(239,68,68,0.30)",
	},
};

export type LeadSourceStyle = {
	labelKey: TranslationKey;
	/** null = use the theme foreground (TikTok's ink dot in the design). */
	dot: string | null;
};

export const LEAD_SOURCE: Record<LeadSource, LeadSourceStyle> = {
	facebook: {
		labelKey: "native.workspace.leadsView.sources.facebook",
		dot: "#1877F2",
	},
	tiktok: { labelKey: "native.workspace.leadsView.sources.tiktok", dot: null },
	direct: {
		labelKey: "native.workspace.leadsView.sources.direct",
		dot: "#d4d3d0",
	},
};

export type LeadDateFilter = "all" | "today" | "last7" | "last30";

// Algeria is UTC+1 year-round (no DST since 1981), so the Algiers calendar
// day is plain offset arithmetic — no Intl.DateTimeFormat needed on Hermes.
const ALGIERS_OFFSET_MS = 60 * 60 * 1000;

/** Today's date in the Africa/Algiers calendar, as YYYY-MM-DD. */
export function algiersToday(now = new Date()): string {
	return new Date(now.getTime() + ALGIERS_OFFSET_MS).toISOString().slice(0, 10);
}

function subtractCalendarDays(date: string, days: number): string {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day - days))
		.toISOString()
		.slice(0, 10);
}

/**
 * Resolve the date presets to inclusive Algiers calendar days — the same
 * semantics as the web tab's getLeadDateRange ("last 7" = today − 6 … today).
 */
export function leadDateRange(filter: LeadDateFilter): {
	createdFrom?: string;
	createdTo?: string;
} {
	if (filter === "all") return {};
	const today = algiersToday();
	if (filter === "today") return { createdFrom: today, createdTo: today };
	return {
		createdFrom: subtractCalendarDays(today, filter === "last7" ? 6 : 29),
		createdTo: today,
	};
}

/** Whole minutes since an ISO timestamp — feeds the hub relative-time label. */
export function minutesSince(isoDateTime: string): number {
	return Math.max(
		0,
		Math.floor((Date.now() - Date.parse(isoDateTime)) / 60_000),
	);
}

/** Readable spacing for canonical Algerian E.164 numbers; others pass through. */
export function formatLeadPhone(phone: string): string {
	const match = /^\+213(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(phone);
	if (!match) return phone;
	return `+213 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

/** One "Pointure 40 · Quantité 2" line from the order extras, or null. */
export function leadExtrasLine(lead: Lead): string | null {
	const entries = publicLeadExtraEntries(lead.extras);
	if (entries.length === 0) return null;
	return entries
		.map(([key, value]) => (value === null ? key : `${key} ${String(value)}`))
		.join(" · ");
}
