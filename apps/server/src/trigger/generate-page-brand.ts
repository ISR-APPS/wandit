const PROJECT_BRAND_ASSET_START = "----- PROJECT BRAND ASSET -----";
const PROJECT_BRAND_ASSET_END = "----- END PROJECT BRAND ASSET -----";

/** Append persisted project-brand context without changing logo-free briefs. */
export function appendProjectBrandAsset(
	brief: string,
	logoUrl: string | null,
): string {
	if (logoUrl === null) {
		return brief;
	}

	return [
		brief,
		"",
		PROJECT_BRAND_ASSET_START,
		`Official project logo URL: ${logoUrl}`,
		'Use this exact URL for the data-brand="nav" mark and any data-brand="footer" mark.',
		"ALWAYS keep the brand name as aria-label on each marked wrapper and " +
			"as alt on the logo image so text restore stays possible.",
		PROJECT_BRAND_ASSET_END,
	].join("\n");
}
