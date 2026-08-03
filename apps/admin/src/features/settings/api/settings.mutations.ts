import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdateProductSettingsInput } from "./settings.dto";
import { settingsKeys } from "./settings.queries";
import {
	replayBillingWebhook,
	updateProductSettings,
} from "./settings.services";

export function useUpdateProductSettingsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: [...settingsKeys.all, "update"],
		mutationFn: (input: UpdateProductSettingsInput) =>
			updateProductSettings(input),
		onMutate: async () => {
			// Prevent an older GET that was already in flight from overwriting the
			// version returned by this optimistic-concurrency PATCH.
			await queryClient.cancelQueries({ queryKey: settingsKeys.detail() });
		},
		onSuccess: (settings) => {
			queryClient.setQueryData(
				settingsKeys.detail(),
				(current: typeof settings | undefined) =>
					current && current.version > settings.version ? current : settings,
			);
		},
	});
}

export function useReplayBillingWebhookMutation() {
	return useMutation({
		mutationKey: [...settingsKeys.all, "webhook-replay"],
		mutationFn: (eventId: string) => replayBillingWebhook(eventId),
	});
}
