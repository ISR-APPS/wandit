/**
 * Mutations of the web app publish (WANDIT-178): publish, roll back, and
 * unpublish. Each writes its answer into the status key, so the poll of
 * publish.queries.ts starts or stops at once. Called by the web body of
 * components/shell/publish-popover.tsx. The last parameter of each hook is
 * the service, so a spec injects a fake.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppBuild, AppPublishStatus } from "@wandit/contracts";
import { toast } from "sonner";

import { isInsufficientCreditsApiError } from "@/features/projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import { appPublishKeys } from "./publish.queries";
import { publishApp, rollbackApp, unpublishApp } from "./publish.services";

/** The status with `build` as the newest attempt. No status in the cache stays no status. */
function withLatestBuild(
	status: AppPublishStatus | undefined,
	build: AppBuild,
): AppPublishStatus | undefined {
	return status === undefined ? undefined : { ...status, latestBuild: build };
}

/** The shared reaction to a publish or a rollback: the cache on success, a toast on error. */
function useQueueBuild<TInput>(
	projectId: string,
	action: "publish" | "rollback",
	queue: (input: TInput) => Promise<AppBuild>,
) {
	const queryClient = useQueryClient();
	const key = appPublishKeys.status(projectId);
	return useMutation({
		mutationKey: [...key, action],
		mutationFn: queue,
		onSuccess: (build) => {
			queryClient.setQueryData<AppPublishStatus>(key, (status) =>
				withLatestBuild(status, build),
			);
		},
		onError: (error) => {
			// The API client already sent the 402 to BillingModalProvider, so a
			// toast would show the refusal twice.
			if (isInsufficientCreditsApiError(error)) {
				return;
			}
			// errors.json translates every code of these routes.
			toast.error(getApiErrorMessage(error));
			// A 409 PUBLISH_ACTIVE means another tab started a publish. The refetch shows it.
			void queryClient.invalidateQueries({ queryKey: key });
		},
	});
}

/** Publishes the saved head. `mutate` takes the request key: pass a new `crypto.randomUUID()` per click. */
export function usePublishApp(
	projectId: string,
	publish: typeof publishApp = publishApp,
) {
	return useQueueBuild(projectId, "publish", (requestKey: string) =>
		publish(projectId, requestKey),
	);
}

/** Puts an earlier deployment live again. `mutate` takes its id; the hook adds a new request key. */
export function useRollbackApp(
	projectId: string,
	rollback: typeof rollbackApp = rollbackApp,
) {
	return useQueueBuild(projectId, "rollback", (deploymentId: string) =>
		rollback(projectId, { deploymentId, requestKey: crypto.randomUUID() }),
	);
}

/** Takes the app down. The answer is the new status. */
export function useUnpublishApp(
	projectId: string,
	unpublish: typeof unpublishApp = unpublishApp,
) {
	const queryClient = useQueryClient();
	const key = appPublishKeys.status(projectId);
	return useMutation({
		mutationKey: [...key, "unpublish"],
		mutationFn: () => unpublish(projectId),
		onSuccess: (status) => {
			queryClient.setQueryData(key, status);
			// Nothing is live now, so every version counts as unpublished.
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.project(projectId),
			});
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
			void queryClient.invalidateQueries({ queryKey: key });
		},
	});
}
