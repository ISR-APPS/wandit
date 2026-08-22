import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { useCallback } from "react";

import { formatShortRelativeTime } from "@/features/projects/lib/helpers";

/**
 * "il y a 8 min" / "8 min ago" labels for the hub fixtures, built from the
 * short relative-time units the drawer already uses. Under a minute reads as
 * the design's "à l'instant" instead of a bare "maintenant".
 */
export function useHubTimeAgo() {
	const { t } = useTranslation();
	const labels = useDictionary().native.relativeTime;

	return useCallback(
		(minutesAgo: number) => {
			if (minutesAgo < 1) {
				return t("native.workspace.hub.justNow");
			}
			const time = formatShortRelativeTime(
				Date.now() - minutesAgo * 60_000,
				labels,
			);
			return t("native.workspace.hub.timeAgo", { time });
		},
		[t, labels],
	);
}
