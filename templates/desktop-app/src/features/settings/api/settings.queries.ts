// Reads one row of app_settings through src/lib/db.ts. The settings page and the home page use it.
// migrations/0001_init.sql creates the table: key TEXT PRIMARY KEY, value TEXT NOT NULL.
import { queryOptions } from "@tanstack/react-query";
import { select } from "~/lib/db";

/** The keys of app_settings that the app uses. A new setting adds its key here. */
export type SettingKey = "business_name";

/** Query key and fetcher of one setting. The value is null before the first save. */
export function settingQueryOptions(key: SettingKey) {
	return queryOptions({
		queryKey: ["app_settings", key],
		queryFn: async (): Promise<string | null> => {
			const [row] = await select<{ value: string }>(
				"SELECT value FROM app_settings WHERE key = ?",
				[key],
			);
			return row?.value ?? null;
		},
	});
}
