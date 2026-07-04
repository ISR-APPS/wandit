// Pure functions for the workspace feature.

import type { Lead, PageVersion, WorkspaceTab } from "../api/dto";
import {
	ASSETS_CANVAS_BOARD,
	ASSETS_CANVAS_LAYOUT_SLOTS,
	ASSETS_VIEW_STORAGE_KEY,
	LEAD_STATUS_META,
	WORKSPACE_PANELS_STORAGE_ID,
	WORKSPACE_TAB_VALUES,
} from "./constants";

export type AssetsView = "library" | "canvas";

/** Library (grid) vs canvas (freeform board) — mirrors chat-open persistence. */
export function readAssetsView(): AssetsView {
	try {
		return window.localStorage.getItem(ASSETS_VIEW_STORAGE_KEY) === "canvas"
			? "canvas"
			: "library";
	} catch {
		return "library";
	}
}

export function writeAssetsView(view: AssetsView): void {
	try {
		window.localStorage.setItem(ASSETS_VIEW_STORAGE_KEY, view);
	} catch {
		// storage unavailable — view still applies for the session
	}
}

export type AssetsCanvasItemLayout = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function createAssetsCanvasLayout(
	version: Pick<PageVersion, "id" | "number" | "pageKey">,
	index: number,
): AssetsCanvasItemLayout {
	const slot =
		ASSETS_CANVAS_LAYOUT_SLOTS[index % ASSETS_CANVAS_LAYOUT_SLOTS.length];
	const lane = Math.floor(index / ASSETS_CANVAS_LAYOUT_SLOTS.length);

	if (lane === 0) return { ...slot };

	const hash = hashString(`${version.id}:${version.number}:${version.pageKey}`);
	const jitterX = (hash % 57) - 28;
	const jitterY = ((hash >> 5) % 49) - 24;
	const laneOffsetX = (lane * 86) % 210;
	const laneOffsetY = lane * 92;

	return {
		...slot,
		x: clamp(
			slot.x + laneOffsetX + jitterX,
			48,
			ASSETS_CANVAS_BOARD.WIDTH - slot.width - 48,
		),
		y: clamp(
			slot.y + laneOffsetY + jitterY,
			42,
			ASSETS_CANVAS_BOARD.HEIGHT - slot.height - 58,
		),
	};
}

export function createAssetsCanvasLayouts(
	versions: Pick<PageVersion, "id" | "number" | "pageKey">[],
): Record<string, AssetsCanvasItemLayout> {
	return Object.fromEntries(
		versions.map((version, index) => [
			version.id,
			createAssetsCanvasLayout(version, index),
		]),
	);
}

export function isWorkspaceTab(value: unknown): value is WorkspaceTab {
	return (
		typeof value === "string" &&
		(WORKSPACE_TAB_VALUES as readonly string[]).includes(value)
	);
}

/** Chat/main split width, persisted from the resizable panel group. */
export function readWorkspacePanelLayout(): Record<string, number> | undefined {
	try {
		const raw = window.localStorage.getItem(WORKSPACE_PANELS_STORAGE_ID);
		const parsed = raw ? JSON.parse(raw) : undefined;
		return parsed && typeof parsed === "object" ? parsed : undefined;
	} catch {
		return undefined;
	}
}

export function writeWorkspacePanelLayout(
	layout: Record<string, number>,
): void {
	try {
		window.localStorage.setItem(
			WORKSPACE_PANELS_STORAGE_ID,
			JSON.stringify(layout),
		);
	} catch {
		// storage unavailable — layout still applies for the session
	}
}

/**
 * Display formatting for canonical E.164 Algerian numbers:
 * "+213550123456" → "+213 550 12 34 56". Non-matching numbers pass through.
 */
export function formatPhone(phone: string): string {
	const match = /^\+213(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(phone);
	if (!match) return phone;
	return `+213 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

export function telHref(phone: string): string {
	return `tel:${phone}`;
}

export function waHref(phone: string): string {
	return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/**
 * DNS-label slug from a project name; diacritics stripped, non-latin scripts
 * (Arabic names) fall back to the provided default.
 */
export function slugify(value: string, fallback: string): string {
	const slug = value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63)
		.replace(/-+$/g, "");
	return slug.length >= 2 ? slug : fallback;
}

/** Valid DNS label — mirrors the deployments slug check constraint. */
export function isValidSlug(slug: string): boolean {
	return (
		slug.length > 0 &&
		slug.length <= 63 &&
		/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
	);
}

/** One-line version label derived from the prompt that produced it. */
export function truncatePrompt(prompt: string, max = 56): string {
	const clean = prompt.trim().replace(/\s+/g, " ");
	return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/** Small deterministic hash — used to vary canned assistant replies. */
export function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

/** Which mock page family a project's next generation renders. */
const PAGE_FAMILIES: Record<
	string,
	{ prefix: string; count: number; lang: "fr" | "ar" | "en" }
> = {
	p_montre: { prefix: "watch", count: 3, lang: "fr" },
	p_miel: { prefix: "honey", count: 2, lang: "ar" },
	p_serum: { prefix: "serum", count: 1, lang: "fr" },
	p_sneakers: { prefix: "sneakers", count: 2, lang: "en" },
	p_ramadan: { prefix: "dates", count: 1, lang: "fr" },
	p_dentaire: { prefix: "dental", count: 1, lang: "fr" },
	p_formation: { prefix: "formation", count: 1, lang: "fr" },
	p_gaming: { prefix: "gaming", count: 1, lang: "en" },
};

export function pickPageKey(projectId: string, versionCount: number): string {
	const family = PAGE_FAMILIES[projectId];
	if (family) {
		if (versionCount < family.count) {
			return `${family.prefix}-${versionCount + 1}`;
		}
		// The generic fallback family is French-only; keep AR/EN threads in
		// their own language by cycling their family instead.
		if (family.lang !== "fr") {
			return `${family.prefix}-${(versionCount % family.count) + 1}`;
		}
	}
	return `generic-${(versionCount % 3) + 1}`;
}

/** CSV with UTF-8 BOM so Arabic names survive Excel; stable column order. */
export function buildLeadsCsv(leads: Lead[]): string {
	const header = [
		"Name",
		"Phone",
		"Wilaya",
		"Commune",
		"Status",
		"Source",
		"Date",
	];
	const escapeCell = (cell: string) =>
		/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
	const rows = leads.map((lead) =>
		[
			lead.name,
			lead.phone,
			lead.wilaya,
			lead.commune,
			LEAD_STATUS_META[lead.status].label,
			lead.source,
			lead.createdAt,
		]
			.map(escapeCell)
			.join(","),
	);
	return `\uFEFF${[header.join(","), ...rows].join("\n")}`;
}

export function downloadTextFile(
	filename: string,
	content: string,
	type = "text/csv;charset=utf-8",
): void {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

/**
 * Opens page HTML in a new tab via a blob URL; the delayed revoke lets the
 * tab finish loading without leaking the blob for the whole session.
 */
export function openHtmlInNewTab(html: string): void {
	const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
	window.open(url, "_blank", "noopener");
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
