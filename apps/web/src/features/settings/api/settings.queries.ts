import { useQuery } from "@tanstack/react-query";

import { getPublicSettings } from "./settings.services";

export const publicSettingsKeys = {
	all: ["public-settings"] as const,
	detail: () => [...publicSettingsKeys.all, "detail"] as const,
};

export function usePublicSettingsQuery() {
	return useQuery({
		queryKey: publicSettingsKeys.detail(),
		queryFn: getPublicSettings,
	});
}
