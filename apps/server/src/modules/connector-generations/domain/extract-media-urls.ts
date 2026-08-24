// Plain module (no Nest) — imported by the run-connector-generation
// Trigger.dev task. Mirrors the client-side preview extraction in
// apps/web .../mcp-tool-part.tsx: walk an arbitrary MCP tool result and
// collect https URLs whose pathname carries a known media extension.

export type ExtractedMediaUrl = {
	kind: "image" | "video";
	url: string;
};

const HTTPS_URL_PATTERN = /https:\/\/[^\s<>"']+/giu;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|webm)$/i;
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|gif|svg)$/i;
const MAX_MEDIA_URLS = 20;

// Catalog/preview assets that must NEVER pass as a generation result:
// Higgsfield submit receipts embed preset demo clips
// (…/job_set_chain_preset/….mp4) and job payloads carry minified thumbnails
// (…_min.webp) long before the real render lands. Matched on the URL path.
const PREVIEW_ASSET_PATH_PATTERNS = [
	/(^|[/_-])presets?([/_-]|$)/i,
	/_min\.[a-z0-9]+$/i,
	/(^|[/_.-])(thumbs?|thumbnails?|previews?)([/_.-]|$)/i,
];

export function isPreviewAssetPath(pathname: string): boolean {
	return PREVIEW_ASSET_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function extractMediaUrls(output: unknown): ExtractedMediaUrl[] {
	const found: ExtractedMediaUrl[] = [];
	const seenObjects = new WeakSet<object>();
	const seenUrls = new Set<string>();

	function visit(value: unknown) {
		if (found.length >= MAX_MEDIA_URLS) return;

		if (typeof value === "string") {
			for (const match of value.matchAll(HTTPS_URL_PATTERN)) {
				const candidate = match[0].replace(/[),.;!?\]}]+$/u, "");
				let parsed: URL;

				try {
					parsed = new URL(candidate);
				} catch {
					continue;
				}

				if (parsed.protocol !== "https:" || seenUrls.has(parsed.href)) {
					continue;
				}

				if (isPreviewAssetPath(parsed.pathname)) continue;

				const kind = mediaKind(parsed.pathname);
				if (!kind) continue;

				seenUrls.add(parsed.href);
				found.push({ kind, url: parsed.href });
				if (found.length >= MAX_MEDIA_URLS) return;
			}
			return;
		}

		if (value === null || typeof value !== "object") return;
		if (seenObjects.has(value)) return;
		seenObjects.add(value);

		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item);
				if (found.length >= MAX_MEDIA_URLS) return;
			}
			return;
		}

		for (const nestedValue of Object.values(value)) {
			visit(nestedValue);
			if (found.length >= MAX_MEDIA_URLS) return;
		}
	}

	visit(output);
	return found;
}

function mediaKind(pathname: string): ExtractedMediaUrl["kind"] | null {
	if (VIDEO_EXTENSION_PATTERN.test(pathname)) return "video";
	if (IMAGE_EXTENSION_PATTERN.test(pathname)) return "image";
	return null;
}
