/**
 * React Query options and the hook for the public product switches.
 * Many features call usePublicSettingsQuery. It calls GET /api/v1/settings/public.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { getPublicSettings } from "./settings.services";

export const publicSettingsKeys = {
	all: ["public-settings"] as const,
	detail: () => [...publicSettingsKeys.all, "detail"] as const,
};

/** The public switches. The V2 route `beforeLoad` reads them with `ensureQueryData` to close V2 on production. */
export const publicSettingsQuery = queryOptions({
	queryKey: publicSettingsKeys.detail(),
	queryFn: getPublicSettings,
});

export function usePublicSettingsQuery() {
	return useQuery(publicSettingsQuery);
}
