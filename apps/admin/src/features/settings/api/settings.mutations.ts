import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BackfillSignupGrantsBody } from "@wandit/contracts";

import type { UpdateProductSettingsInput } from "./settings.dto";
import { settingsKeys } from "./settings.queries";
import {
	backfillSignupGrants,
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
		onSuccess: ({ signupGrantSkippedCount: _skipped, ...settings }) => {
			queryClient.setQueryData(
				settingsKeys.detail(),
				(current: typeof settings | undefined) =>
					current && current.version > settings.version ? current : settings,
			);
		},
	});
}

export function useBackfillSignupGrantsMutation() {
	return useMutation({
		mutationKey: [...settingsKeys.all, "signup-grant-backfill"],
		mutationFn: (input: BackfillSignupGrantsBody) =>
			backfillSignupGrants(input),
	});
}

export function useReplayBillingWebhookMutation() {
	return useMutation({
		mutationKey: [...settingsKeys.all, "webhook-replay"],
		mutationFn: (eventId: string) => replayBillingWebhook(eventId),
	});
}
