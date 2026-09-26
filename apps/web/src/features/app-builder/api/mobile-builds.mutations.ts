/**
 * Mutations of the Android APK builds (WANDIT-194): start a build and cancel
 * one. Each puts the build the API answers into the list key, so the poll of
 * mobile-builds.queries.ts starts or stops at once. Called by the mobile body
 * of components/shell/publish-popover.tsx. The last parameter of each hook is
 * the service, so a spec injects a fake.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ListMobileBuildsResponse, MobileBuild } from "@wandit/contracts";
import { toast } from "sonner";

import { creditsKeys } from "@/features/credits";
import { isInsufficientCreditsApiError } from "@/features/projects";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { mobileBuildsKeys } from "./mobile-builds.queries";
import { cancelMobileBuild, createMobileBuild } from "./mobile-builds.services";

/**
 * The list with `build` in it: a known build changes in place, a new build
 * goes first. No list in the cache stays no list.
 */
function withBuild(
	list: ListMobileBuildsResponse | undefined,
	build: MobileBuild,
): ListMobileBuildsResponse | undefined {
	if (list === undefined) return undefined;
	const isKnown = list.items.some((item) => item.id === build.id);
	return {
		...list,
		items: isKnown
			? list.items.map((item) => (item.id === build.id ? build : item))
			: [build, ...list.items],
	};
}

/**
 * Starts an Android APK build. `mutate` takes the request key: pass a new
 * `crypto.randomUUID()` per click. A second click while a build is live gets
 * 409 MOBILE_BUILD_ACTIVE.
 */
export function useCreateMobileBuild(
	projectId: string,
	create: typeof createMobileBuild = createMobileBuild,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...mobileBuildsKeys.list(projectId), "create"],
		mutationFn: (requestKey: string) =>
			create(projectId, { platform: "android", requestKey }),
		onSuccess: (build) => {
			queryClient.setQueryData<ListMobileBuildsResponse>(
				mobileBuildsKeys.list(projectId),
				(list) => withBuild(list, build),
			);
		},
		onError: (error) => {
			// The API client already sent the 402 and the 403 member limit to
			// BillingModalProvider, so a toast would show the refusal twice.
			if (
				isInsufficientCreditsApiError(error) ||
				(isApiClientError(error) &&
					error.code === "MEMBER_CREDIT_LIMIT_REACHED")
			) {
				return;
			}
			// errors.json translates every code of this route, V2_ENV_MISSING included.
			toast.error(getApiErrorMessage(error));
			// A 409 MOBILE_BUILD_ACTIVE means another tab started a build. The refetch shows it.
			void queryClient.invalidateQueries({
				queryKey: mobileBuildsKeys.list(projectId),
			});
		},
		onSettled: () => {
			// A new build holds credits, and a 402 means the cached balance is stale.
			void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
		},
	});
}

/**
 * Cancels a live build. `mutate` takes the build id. The API refunds the
 * held credits, so the balance refreshes too.
 */
export function useCancelMobileBuild(
	projectId: string,
	cancel: typeof cancelMobileBuild = cancelMobileBuild,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...mobileBuildsKeys.list(projectId), "cancel"],
		mutationFn: (buildId: string) => cancel(projectId, buildId),
		onSuccess: (build) => {
			queryClient.setQueryData<ListMobileBuildsResponse>(
				mobileBuildsKeys.list(projectId),
				(list) => withBuild(list, build),
			);
			void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}
