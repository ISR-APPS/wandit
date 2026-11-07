/**
 * Mutations of the desktop builds (docs/v2/desktop-apps.md): start a
 * build, cancel one, and release one. Start and cancel put the build the API
 * answers into the overview key, so the poll of desktop.queries.ts starts or
 * stops at once. Called by the desktop body of components/shell/publish-popover.tsx.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	CreateDesktopBuildBody,
	DesktopBuild,
	DesktopOverviewResponse,
} from "@wandit/contracts";
import { toast } from "sonner";

import { creditsKeys } from "@/features/credits";
import { isInsufficientCreditsApiError } from "@/features/projects";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { desktopKeys } from "./desktop.queries";
import {
	cancelDesktopBuild,
	createDesktopBuild,
	releaseDesktopBuild,
} from "./desktop.services";

/**
 * The overview with `build` in it: a known build changes in place, a new
 * build goes first. No overview in the cache stays no overview.
 */
function withBuild(
	overview: DesktopOverviewResponse | undefined,
	build: DesktopBuild,
): DesktopOverviewResponse | undefined {
	if (overview === undefined) return undefined;
	const isKnown = overview.builds.some((item) => item.id === build.id);
	return {
		...overview,
		builds: isKnown
			? overview.builds.map((item) => (item.id === build.id ? build : item))
			: [build, ...overview.builds],
	};
}

/**
 * Starts a desktop build, or a rebuild of an older build with
 * `rebuildOfBuildId`. `mutate` takes the body: pass a new
 * `crypto.randomUUID()` as `requestKey` per click. A second click while a
 * build is live gets 409 DESKTOP_BUILD_ACTIVE.
 */
export function useCreateDesktopBuild(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...desktopKeys.overview(projectId), "create"],
		mutationFn: (body: CreateDesktopBuildBody) =>
			createDesktopBuild(projectId, body),
		onSuccess: (build) => {
			queryClient.setQueryData<DesktopOverviewResponse>(
				desktopKeys.overview(projectId),
				(overview) => withBuild(overview, build),
			);
			// The first build writes the desktop identity of the project. The refetch shows it.
			void queryClient.invalidateQueries({
				queryKey: desktopKeys.overview(projectId),
			});
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
			// errors.json translates DESKTOP_BUILD_*, DESKTOP_PLATFORM_UNAVAILABLE, PROJECT_SUSPENDED, and V2_ENV_MISSING.
			toast.error(getApiErrorMessage(error));
			// A 409 DESKTOP_BUILD_ACTIVE means another tab started a build. The refetch shows it.
			void queryClient.invalidateQueries({
				queryKey: desktopKeys.overview(projectId),
			});
		},
		onSettled: () => {
			// A new build holds credits, and a 402 means the cached balance is stale.
			void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
		},
	});
}

/**
 * Cancels a live build. `mutate` takes the build id. The API releases the
 * held credits, so the balance refreshes too. A build in `signing` stays
 * live, and a toast tells the user why.
 */
export function useCancelDesktopBuild(projectId: string) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	return useMutation({
		mutationKey: [...desktopKeys.overview(projectId), "cancel"],
		mutationFn: (buildId: string) => cancelDesktopBuild(projectId, buildId),
		onSuccess: (build) => {
			// The API does not stop a build that signs (security audit A1). It answers the build as it is.
			if (build.status === "signing") {
				toast.info(t("appBuilder.desktopBuilds.cancelSigning"));
			}
			queryClient.setQueryData<DesktopOverviewResponse>(
				desktopKeys.overview(projectId),
				(overview) => withBuild(overview, build),
			);
			void queryClient.invalidateQueries({ queryKey: creditsKeys.scope() });
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}

/**
 * Makes one ready build the version of the installed apps and of the
 * download link. `mutate` takes the build id. A release costs no credits,
 * so the balance stays as it is.
 */
export function useReleaseDesktopBuild(projectId: string) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	return useMutation({
		mutationKey: [...desktopKeys.overview(projectId), "release"],
		mutationFn: (buildId: string) => releaseDesktopBuild(projectId, buildId),
		onSuccess: (build) => {
			toast.success(
				t("appBuilder.desktopBuilds.released", { version: build.version }),
			);
		},
		onError: (error) => {
			// errors.json translates DESKTOP_BUILD_NOT_READY, DESKTOP_BUILD_OLDER_THAN_CURRENT, and PROJECT_SUSPENDED.
			toast.error(getApiErrorMessage(error));
		},
		onSettled: () => {
			// A release changes `isCurrent` of two builds and the download link of the app.
			// A refused release can mean a stale list, so the refetch runs then too.
			void queryClient.invalidateQueries({
				queryKey: desktopKeys.overview(projectId),
			});
		},
	});
}
