import type { PageOverview, PageVersionSummary } from "@wandit/contracts";

export type PreviewVersion = Pick<PageVersionSummary, "id" | "number">;

export type GenerationPhase = "idle" | "thinking" | "streaming" | "building";

export type PublishPageBody = {
	slug?: string;
	versionId: string;
};

export type PublishedSlugRenameBody = {
	slug: string;
	versionId?: string;
};

/**
 * `null` is an intentional "follow latest" selection. A manual historical
 * version is immutable, so it remains selected while the server active
 * version advances. Selecting the active version collapses back to follow
 * mode instead of pinning that version forever.
 */
export function resolvePreviewVersion(
	manualVersion: PreviewVersion | null,
	serverActiveVersion: PageVersionSummary | null | undefined,
	availableVersions?: readonly PreviewVersion[],
): PreviewVersion | null {
	if (!manualVersion || manualVersion.id === serverActiveVersion?.id) {
		return serverActiveVersion ?? null;
	}
	if (
		availableVersions &&
		!availableVersions.some((version) => version.id === manualVersion.id)
	) {
		return serverActiveVersion ?? null;
	}

	return manualVersion;
}

/** A selected version is read-only unless it is the server's active version. */
export function isHistoricalPreview(
	previewVersion: PreviewVersion | null | undefined,
	serverActiveVersion: PageVersionSummary | null | undefined,
): boolean {
	return Boolean(
		previewVersion && previewVersion.id !== serverActiveVersion?.id,
	);
}

/** Publishing is explicit about the immutable version being deployed. */
export function buildPublishPageBody(
	version: PreviewVersion,
	slug?: string | null,
): PublishPageBody {
	return {
		...(slug ? { slug } : {}),
		versionId: version.id,
	};
}

/** Renaming a live slug must not change which immutable version is live. */
export function buildPublishedSlugRenameBody(
	slug: string,
	publishedVersionId: string | null | undefined,
): PublishedSlugRenameBody {
	return {
		slug,
		...(publishedVersionId ? { versionId: publishedVersionId } : {}),
	};
}

export function deriveGenerationState(overview: PageOverview | undefined): {
	generationPhase: GenerationPhase;
	isGenerating: boolean;
	pendingVersionNumber: number;
} {
	const status = overview?.latestAttempt?.status;
	const isGenerating = status === "queued" || status === "generating";

	return {
		generationPhase:
			status === "queued"
				? "thinking"
				: status === "generating"
					? "building"
					: "idle",
		isGenerating,
		pendingVersionNumber: (overview?.activeVersion?.number ?? 0) + 1,
	};
}
