// Saves one row of app_settings through src/lib/db.ts. The settings page calls it; a success refetches the setting.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { execute } from "~/lib/db";
import { type SettingKey, settingQueryOptions } from "./settings.queries";

/** Inserts the setting, or updates the value of its key. Rejects with the DbError of the database. */
export function useSaveSettingMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ key, value }: { key: SettingKey; value: string }) => {
			await execute(
				"INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
				[key, value],
			);
			return key;
		},
		onSuccess: (key) =>
			queryClient.invalidateQueries({
				queryKey: settingQueryOptions(key).queryKey,
			}),
	});
}
