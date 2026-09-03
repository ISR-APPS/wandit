/**
 * helpers.ts collects small pure-ish utilities for the workspace feature.
 *
 * In the AI chat flow, this file does not send chat messages or listen to SSE.
 * It supports the workspace shell around the chat: validating the `?tab=` route
 * value, persisting the chat/main panel layout, remembering the Assets view,
 * formatting leads, and building/exporting simple files.
 *
 * PageVersion types appear here for the canvas layout and download helpers;
 * the real chat message flow lives in use-project-chat.tsx and api/chat.*.
 */
// Pure functions for the workspace feature.

import type { WorkspaceTab } from "../api/dto";
import { WORKSPACE_PANELS_STORAGE_ID, WORKSPACE_TAB_VALUES } from "./constants";

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

/** Title of the order-details popover in the leads table. */
export const ORDER_DETAILS_LABEL = "Order details";

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
