/**
 * Appends finished media references to a page-build brief.
 * The generate_page tool and fallback orchestrator call this helper.
 * The Trigger task bundle forbids Nest imports, which generate-page.tool.ts has.
 */
import type { ConversationGeneratedAsset } from "../annotate-generated-assets";

// Media-heavy chats stay bounded so the appendix cannot crowd out the brief.
const MAX_READY_MEDIA_ASSET_LINES = 16;

/** Adds missing hosted assets. Keeps the brief unchanged when it contains every asset. */
export function appendReadyMediaAssets(
	brief: string,
	assets: readonly ConversationGeneratedAsset[],
): string {
	const missing = assets
		.filter((asset) => !brief.includes(asset.url))
		.slice(0, MAX_READY_MEDIA_ASSET_LINES);

	if (missing.length === 0) {
		return brief;
	}

	const lines = missing.map((asset) => `- ${asset.kind}: ${asset.url}`);

	return [
		brief.trimEnd(),
		"",
		"READY MEDIA ASSETS (generated in this conversation — hosted, final, and allowed on the page):",
		...lines,
		"Placing every listed asset is part of the brief: give each one the role it serves best, and never generate a new image for a role a listed asset already covers.",
	].join("\n");
}
