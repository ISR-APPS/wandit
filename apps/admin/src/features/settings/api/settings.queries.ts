import { useQuery } from "@tanstack/react-query";

import { getProductSettings } from "./settings.services";

export const settingsKeys = {
	all: ["admin-settings"] as const,
	detail: () => [...settingsKeys.all, "detail"] as const,
};

export function useProductSettingsQuery() {
	return useQuery({
		queryKey: settingsKeys.detail(),
		queryFn: getProductSettings,
	});
}
