// Lazily resolve the newest BUILDER-ORIGIN version's theme — the "Reset to
// original" source (web theme-panel parity). Two cached requests, mounted
// only while the theme sheet is open: the version list, then that version's
// immutable HTML, parsed for its :root tokens + builder font links.

import type { PageTokenName } from "@wandit/contracts";
import {
	extractGoogleFontStylesheetHrefs,
	parsePageTokens,
} from "@wandit/preview-editor";
import { useMemo } from "react";

import {
	usePageVersionsQuery,
	useVersionHtmlQuery,
} from "@/features/workspace/api/pages.queries";

export type OriginalTheme = {
	tokens: Partial<Record<PageTokenName, string>>;
	fontStylesheetHrefs: string[];
};

export function useOriginalTheme(
	projectId: string,
	enabled: boolean,
): OriginalTheme | null {
	const versionsQuery = usePageVersionsQuery(projectId, enabled);
	const builderVersionId = useMemo(
		() =>
			versionsQuery.data?.find((version) => version.isBuilderOrigin)?.id,
		[versionsQuery.data],
	);
	const htmlQuery = useVersionHtmlQuery(enabled ? builderVersionId : undefined);

	return useMemo(() => {
		const html = htmlQuery.data?.html;
		if (!html) return null;
		return {
			tokens: parsePageTokens(html),
			fontStylesheetHrefs: extractGoogleFontStylesheetHrefs(html),
		};
	}, [htmlQuery.data?.html]);
}
