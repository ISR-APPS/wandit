// One hook that owns the whole native publish surface (web parity:
// lib/publish-state.ts + the store's publish actions, collapsed for mobile).
// The page screen calls it once; the sheet renders from it. Server truth:
// publish POSTs resolve SETTLED, a live-slug rename is a republish of the
// pinned live version, rollback re-ships archived bytes under the live slug.

import type { Deployment, DeploymentCurrent } from "@wandit/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
	SLUG_CHECK_DEBOUNCE_MS,
	useDeploymentCurrentQuery,
	useDeploymentsQuery,
	usePublishDeploymentMutation,
	useRollbackDeploymentMutation,
	useSlugAvailabilityQuery,
	useUnpublishDeploymentMutation,
} from "@/features/workspace/api/deployments.queries";
import { usePageVersionsQuery } from "@/features/workspace/api/pages.queries";
import { getApiErrorMessage } from "@/shared/lib/api-client";

/** Valid DNS label — mirrors the deployments slug check constraint. */
export function isValidSlug(slug: string): boolean {
	return (
		slug.length > 0 &&
		slug.length <= 63 &&
		/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
	);
}

export type SlugVerdict =
	| "idle"
	| "invalid"
	| "checking"
	| "taken"
	| "reserved"
	| "available";

/** Publish attempts that once served traffic have archived bytes to restore. */
export const ROLLBACKABLE_STATUSES: readonly Deployment["status"][] = [
	"superseded",
	"unpublished",
];

export type PublishControllerOptions = {
	projectId: string;
	enabled: boolean;
	/** True while the publish sheet is open — gates history + version numbers. */
	sheetOpen: boolean;
	onPublished: (liveUrl: string | null) => void;
	onUnpublished: () => void;
	onRolledBack: (versionNumber: number | null, liveUrl: string | null) => void;
	onError: (message: string) => void;
};

export type PublishController = ReturnType<typeof usePublishController>;

export function usePublishController(options: PublishControllerOptions) {
	const {
		projectId,
		enabled,
		sheetOpen,
		onError,
		onPublished,
		onRolledBack,
		onUnpublished,
	} = options;

	const currentQuery = useDeploymentCurrentQuery(projectId, enabled);
	const deployment: DeploymentCurrent | null = currentQuery.data ?? null;

	const historyQuery = useDeploymentsQuery(projectId, enabled && sheetOpen);
	const versionsQuery = usePageVersionsQuery(projectId, enabled && sheetOpen);

	const publishMutation = usePublishDeploymentMutation(projectId);
	const unpublishMutation = useUnpublishDeploymentMutation(projectId);
	const rollbackMutation = useRollbackDeploymentMutation(projectId);

	// --- slug editing ------------------------------------------------------

	// A slug picked before the first publish. The server keeps the live slug
	// once published, so this only matters while the project is a draft.
	const [draftSlug, setDraftSlug] = useState<string | null>(null);
	const [slugEditing, setSlugEditing] = useState(false);
	const [slugInput, setSlugInput] = useState("");
	const [slugDirty, setSlugDirty] = useState(false);

	// Let typing settle before asking the server about a candidate.
	const [settledSlug, setSettledSlug] = useState("");
	useEffect(() => {
		const id = setTimeout(
			() => setSettledSlug(slugInput),
			SLUG_CHECK_DEBOUNCE_MS,
		);
		return () => clearTimeout(id);
	}, [slugInput]);

	// null = never published AND no local choice → the server generates one.
	const savedSlug = deployment?.slug ?? draftSlug;
	const slugUnchanged = slugInput === (savedSlug ?? "");

	const availabilityQuery = useSlugAvailabilityQuery(
		projectId,
		settledSlug,
		slugEditing && slugDirty && !slugUnchanged && isValidSlug(settledSlug),
	);

	const slugVerdict: SlugVerdict = !slugDirty
		? "idle"
		: slugUnchanged
			? "idle"
			: !isValidSlug(slugInput)
				? "invalid"
				: availabilityQuery.isFetching ||
						slugInput !== settledSlug ||
						!availabilityQuery.data
					? "checking"
					: availabilityQuery.data.available
						? "available"
						: availabilityQuery.data.reason === "reserved"
							? "reserved"
							: "taken";

	const beginSlugEdit = useCallback(() => {
		setSlugInput(savedSlug ?? "");
		setSlugDirty(false);
		setSlugEditing(true);
	}, [savedSlug]);

	const cancelSlugEdit = useCallback(() => {
		setSlugEditing(false);
		setSlugDirty(false);
	}, []);

	const changeSlug = useCallback((value: string) => {
		setSlugInput(value.toLowerCase());
		setSlugDirty(true);
	}, []);

	const errorToast = useCallback(
		(error: unknown) => onError(getApiErrorMessage(error)),
		[onError],
	);

	/** Save the edited slug. Draft project → remember the choice locally and
	 * send it with the first publish. Live project → republish the PINNED live
	 * version under the new slug (a rename must not ship a newer draft). */
	const commitSlug = useCallback(() => {
		if (slugUnchanged) {
			cancelSlugEdit();
			return;
		}
		if (slugVerdict !== "available") return;

		if (deployment?.uiState === "published") {
			publishMutation.mutate(
				{
					slug: slugInput,
					...(deployment.publishedVersionId
						? { versionId: deployment.publishedVersionId }
						: {}),
				},
				{
					onSuccess: ({ current }) => {
						cancelSlugEdit();
						onPublished(current.liveUrl);
					},
					onError: errorToast,
				},
			);
			return;
		}

		setDraftSlug(slugInput);
		cancelSlugEdit();
	}, [
		cancelSlugEdit,
		deployment?.publishedVersionId,
		deployment?.uiState,
		errorToast,
		onPublished,
		publishMutation,
		slugInput,
		slugUnchanged,
		slugVerdict,
	]);

	// --- lifecycle actions -------------------------------------------------

	const busy =
		publishMutation.isPending ||
		unpublishMutation.isPending ||
		rollbackMutation.isPending;

	const uiState = deployment?.uiState ?? null;
	const published = uiState === "published";
	const failed = uiState === "failed";
	const publishing =
		uiState === "publishing" ||
		publishMutation.isPending ||
		rollbackMutation.isPending;

	// pendingVersionId is the server's draft pointer — what publish would ship.
	const canPublish =
		deployment != null &&
		deployment.pendingVersionId != null &&
		uiState !== "publishing" &&
		!busy;

	const publish = useCallback(() => {
		if (!canPublish || !deployment) return;
		publishMutation.mutate(
			{
				// Explicit about the immutable version being deployed (web parity).
				...(deployment.pendingVersionId
					? { versionId: deployment.pendingVersionId }
					: {}),
				...(draftSlug ? { slug: draftSlug } : {}),
			},
			{
				onSuccess: ({ current }) => {
					setDraftSlug(null);
					onPublished(current.liveUrl);
				},
				onError: errorToast,
			},
		);
	}, [canPublish, deployment, draftSlug, errorToast, onPublished, publishMutation]);

	const unpublish = useCallback(() => {
		if (busy) return;
		unpublishMutation.mutate(undefined, {
			onSuccess: onUnpublished,
			onError: errorToast,
		});
	}, [busy, errorToast, onUnpublished, unpublishMutation]);

	const rollback = useCallback(
		(deploymentId: string, versionNumber: number | null) => {
			if (busy) return;
			rollbackMutation.mutate(
				{ deploymentId },
				{
					onSuccess: ({ current }) =>
						onRolledBack(versionNumber, current.liveUrl),
					onError: errorToast,
				},
			);
		},
		[busy, errorToast, onRolledBack, rollbackMutation],
	);

	// --- version numbers + history ----------------------------------------

	const versionNumberById = useMemo(
		() =>
			new Map(
				(versionsQuery.data ?? []).map((version) => [
					version.id,
					version.number,
				]),
			),
		[versionsQuery.data],
	);

	const liveVersionNumber = deployment?.publishedVersionId
		? (versionNumberById.get(deployment.publishedVersionId) ?? null)
		: null;
	const pendingVersionNumber = deployment?.pendingVersionId
		? (versionNumberById.get(deployment.pendingVersionId) ?? null)
		: null;

	// A newer draft head exists behind the live site.
	const updateAvailable =
		published &&
		deployment?.pendingVersionId != null &&
		deployment.pendingVersionId !== deployment.publishedVersionId;

	const history = historyQuery.data ?? [];

	return {
		deployment,
		loading: currentQuery.isPending,
		published,
		publishing,
		failed,
		busy,
		canPublish,
		updateAvailable,
		liveVersionNumber,
		pendingVersionNumber,
		versionNumberById,
		history,
		// Slug editor
		draftSlug,
		savedSlug,
		slugEditing,
		slugInput,
		slugVerdict,
		beginSlugEdit,
		cancelSlugEdit,
		changeSlug,
		commitSlug,
		// Lifecycle
		publish,
		unpublish,
		rollback,
	};
}
