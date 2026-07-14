/**
 * helpers.ts collects small pure-ish utilities for the workspace feature.
 *
 * In the AI chat flow, this file does not send chat messages or listen to SSE.
 * It supports the workspace shell around the chat: validating the `?tab=` route
 * value, persisting the chat/main panel layout, remembering the Assets view,
 * formatting leads, and building/exporting simple files.
 *
 * Some helpers still serve the mock page-version path (canvas layout,
 * pickPageKey, CSV/download helpers). That is why you will see PageVersion and
 * Lead types here even though the real chat message flow now lives in
 * use-project-chat.tsx and api/chat.*.
 */
// Pure functions for the workspace feature.

import { pageTitleDynamic } from "@/lib/i18n";
import type { Lead, PageVersion, WorkspaceTab } from "../api/dto";
import {
	ASSETS_CANVAS_BOARD,
	ASSETS_CANVAS_LAYOUT_SLOTS,
	ASSETS_VIEW_STORAGE_KEY,
	WORKSPACE_PANELS_STORAGE_ID,
	WORKSPACE_TAB_VALUES,
} from "./constants";

// The Assets tab has two display modes: a normal library grid and a freeform
// canvas board. Components import this type so only those two strings are valid.
export type AssetsView = "library" | "canvas";

// Read the user's last Assets tab mode from localStorage. localStorage is the
// browser's tiny key/value store that survives reloads; try/catch keeps private
// browsing or blocked storage from crashing the workspace.
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

// Persist the Assets tab mode so a reload reopens the same view. Failure is not
// fatal: the React state in the current session still changes.
export function writeAssetsView(view: AssetsView): void {
	try {
		window.localStorage.setItem(ASSETS_VIEW_STORAGE_KEY, view);
	} catch {
		// storage unavailable — view still applies for the session
	}
}

// Pixel rectangle for one generated page/version inside the Assets canvas.
export type AssetsCanvasItemLayout = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// Create a stable canvas rectangle for one page version. Stable matters here:
// the same version should appear in the same place after a reload, not jump
// around every time React renders.
export function createAssetsCanvasLayout(
	version: Pick<PageVersion, "id" | "number" | "pageKey">,
	index: number,
): AssetsCanvasItemLayout {
	// First fill a small set of hand-picked layout slots so the board starts with
	// intentional-looking positions instead of a mechanical grid.
	const slot =
		ASSETS_CANVAS_LAYOUT_SLOTS[index % ASSETS_CANVAS_LAYOUT_SLOTS.length];
	const lane = Math.floor(index / ASSETS_CANVAS_LAYOUT_SLOTS.length);

	if (lane === 0) return { ...slot };

	// Versions beyond the first lane reuse the same slots with deterministic
	// offsets and jitter. The hash makes the spread feel organic without using
	// Math.random(), which would make positions change on every render.
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

// Build the full id -> layout lookup consumed by the Assets canvas. Object maps
// are faster for the UI than searching an array every time it renders an item.
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

// Runtime guard for route search params. TypeScript types do not protect values
// that arrive from the URL, so this checks the string before the route accepts it
// as a WorkspaceTab.
export function isWorkspaceTab(value: unknown): value is WorkspaceTab {
	return (
		typeof value === "string" &&
		(WORKSPACE_TAB_VALUES as readonly string[]).includes(value)
	);
}

// Read the persisted desktop chat/main split widths. The resizable panel
// library stores a plain object keyed by panel id.
/** Chat/main split width, persisted from the resizable panel group. */
export function readWorkspacePanelLayout(): Record<string, number> | undefined {
	try {
		// JSON.parse is intentionally inside try/catch because users or browser
		// extensions can corrupt localStorage values.
		const raw = window.localStorage.getItem(WORKSPACE_PANELS_STORAGE_ID);
		const parsed = raw ? JSON.parse(raw) : undefined;
		return parsed && typeof parsed === "object" ? parsed : undefined;
	} catch {
		return undefined;
	}
}

// Persist the latest desktop split layout after the user drags the divider.
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

// Build a tel: URL so clicking a phone number can open the user's dialer.
export function telHref(phone: string): string {
	return `tel:${phone}`;
}

// Build a WhatsApp deep link. Non-digits are stripped because wa.me expects an
// international phone number without spaces, plus signs, or punctuation.
export function waHref(phone: string): string {
	return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/**
 * DNS-label slug from a project name; diacritics stripped, non-latin scripts
 * (Arabic names) fall back to the provided default.
 */
export function slugify(value: string, fallback: string): string {
	// normalize("NFD") splits letters from accents, then the Unicode mark range
	// removes the accents. Example: "é" becomes "e".
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

// Check whether a slug is valid as a single DNS label, the part before the
// domain. This mirrors the backend/deployment constraint.
/** Valid DNS label — mirrors the deployments slug check constraint. */
export function isValidSlug(slug: string): boolean {
	return (
		slug.length > 0 &&
		slug.length <= 63 &&
		/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
	);
}

// Create a compact label from the prompt that generated a page version.
/** One-line version label derived from the prompt that produced it. */
export function truncatePrompt(prompt: string, max = 56): string {
	const clean = prompt.trim().replace(/\s+/g, " ");
	return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

// Deterministic string hash used for mock/layout variation. Same input always
// gives the same number, unlike Math.random().
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

// Choose which mock page template a new version should render. This is not the
// real worker generation path; it is legacy/demo scaffolding for preview data.
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

/**
 * CSV with UTF-8 BOM so Arabic names survive Excel; stable column order.
 * `headers` is the localized header row (leads.csvHeaders); the status cell is
 * localized from the current dictionary snapshot (leads.status.<enum_value>).
 */
export function buildLeadsCsv(leads: Lead[], headers: string[]): string {
	// CSV cells containing commas, quotes, or newlines must be wrapped in quotes;
	// doubled quotes are the CSV escape sequence for a literal quote.
	const escapeCell = (cell: string) =>
		/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
	const rows = leads.map((lead) =>
		[
			lead.name,
			lead.phone,
			lead.wilaya,
			lead.commune,
			pageTitleDynamic(`leads.status.${lead.status}`),
			lead.source,
			lead.createdAt,
		]
			.map(escapeCell)
			.join(","),
	);
	return `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
}

// Trigger a browser download for generated text. Blob is the browser object for
// in-memory file-like data, and URL.createObjectURL gives it a temporary URL the
// hidden anchor can download.
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

// Open raw generated HTML without navigating away from the workspace.
/**
 * Opens page HTML in a new tab via a blob URL; the delayed revoke lets the
 * tab finish loading without leaking the blob for the whole session.
 */
export function openHtmlInNewTab(html: string): void {
	const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
	window.open(url, "_blank", "noopener");
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
