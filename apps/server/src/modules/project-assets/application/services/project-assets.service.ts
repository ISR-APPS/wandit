/**
 * Assets tab backend: one ownership-checked list of every media file the AI
 * produced for a project, whatever pipeline made it — standalone image
 * generations and the images/videos generated inside page builds (which
 * have no DB rows; the bucket is their source of truth).
 */
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	ProjectAsset,
	WorkspaceAsset,
	WorkspaceAssetsResponse,
} from "@wandit/contracts";

import {
	contentTypeFor,
	getObjectBytes,
	isR2Configured,
	listObjectsByPrefix,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	VARIANT_FILENAME_PATTERN,
} from "../../../../infrastructure/storage/r2";
import { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { ProjectAssetsRepository } from "../../infrastructure/persistence/project-assets.repository";

// Dashboard aggregate bounds. The page shows the newest slice of the whole
// workspace; a project's complete history stays on its own Assets tab.
const WORKSPACE_ASSETS_MAX = 1_000;
const WORKSPACE_DB_ROWS_MAX = 500;
// Page-build files have no DB rows — each project costs one R2 prefix
// listing, so the fan-out is capped and lightly parallel. Each listing asks
// for one object beyond its own cap so a cut is observable and can flip the
// aggregate's `truncated` flag.
const WORKSPACE_BUILD_PROJECTS_MAX = 50;
const BUILD_LIST_CONCURRENCY = 4;
const BUILD_OBJECTS_MAX = 500;

@Injectable()
export class ProjectAssetsService {
	constructor(
		@Inject(ProjectAssetsRepository)
		private readonly projectAssetsRepository: ProjectAssetsRepository,
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
	) {}

	async listAssets(
		scope: ProjectScope,
		projectId: string,
	): Promise<ProjectAsset[]> {
		await this.assertAccessibleProject(scope, projectId);

		const imageAttempts = await this.imageGenerationsRepository.listForProject(
			scope,
			projectId,
		);

		const assets: ProjectAsset[] = [];

		for (const attempt of imageAttempts) {
			if (attempt.status !== "succeeded" || !attempt.images) {
				continue;
			}

			attempt.images.forEach((image, index) => {
				const key = publicAssetKeyFromUrl(image.url);
				const generationIndex = image.index ?? index + 1;

				if (!key) {
					return;
				}

				assets.push({
					createdAt: (attempt.completedAt ?? attempt.createdAt).toISOString(),
					id: `${attempt.id}:${generationIndex}`,
					key,
					kind: "image",
					mediaType: image.mediaType,
					name:
						attempt.count > 1
							? `${attempt.title} (${generationIndex}/${attempt.count})`
							: attempt.title,
					sizeBytes: null,
					source: "image-generation",
					url: image.url,
				});
			});
		}

		for (const object of await this.listBuildObjects(projectId)) {
			if (isVideoAttemptIntermediate(object.key)) {
				continue;
			}

			const mediaType = contentTypeFor(object.key);
			const kind = mediaType.startsWith("image/")
				? ("image" as const)
				: mediaType.startsWith("video/")
					? ("video" as const)
					: null;

			if (!kind) {
				continue;
			}

			assets.push({
				createdAt: object.lastModified?.toISOString() ?? null,
				id: object.key,
				key: object.key,
				kind,
				mediaType,
				name: object.key.split("/").pop() ?? object.key,
				sizeBytes: object.sizeBytes,
				source: "page-build",
				url: publicAssetUrl(object.key),
			});
		}

		return assets.sort(byNewestFirst);
	}

	/**
	 * Dashboard Assets page: the newest media across every project the scope
	 * can see, each entry carrying its project for labels and download links.
	 * Same composition as the per-project list — ownership-joined DB reads
	 * plus a bounded, best-effort R2 fan-out for page-build files.
	 */
	async listWorkspaceAssets(
		scope: ProjectScope,
	): Promise<WorkspaceAssetsResponse> {
		const [accessibleProjects, imageAttempts] = await Promise.all([
			this.projectAssetsRepository.listAccessibleProjects(scope),
			this.imageGenerationsRepository.listSucceededForScope(
				scope,
				WORKSPACE_DB_ROWS_MAX,
			),
		]);

		const assets: WorkspaceAsset[] = [];

		for (const attempt of imageAttempts) {
			if (!attempt.images) {
				continue;
			}

			attempt.images.forEach((image, index) => {
				const key = publicAssetKeyFromUrl(image.url);
				const generationIndex = image.index ?? index + 1;

				if (!key) {
					return;
				}

				assets.push({
					createdAt: (attempt.completedAt ?? attempt.createdAt).toISOString(),
					id: `${attempt.id}:${generationIndex}`,
					key,
					kind: "image",
					mediaType: image.mediaType,
					name:
						attempt.count > 1
							? `${attempt.title} (${generationIndex}/${attempt.count})`
							: attempt.title,
					projectId: attempt.projectId,
					projectName: attempt.projectName,
					sizeBytes: null,
					source: "image-generation",
					url: image.url,
				});
			});
		}

		const buildProjects = accessibleProjects.slice(
			0,
			WORKSPACE_BUILD_PROJECTS_MAX,
		);
		const buildLists = await mapWithConcurrency(
			buildProjects,
			BUILD_LIST_CONCURRENCY,
			async (project) => ({
				...(await this.listBuildObjectsProbed(project.id)),
				project,
			}),
		);
		const buildListingCut = buildLists.some((list) => list.cut);

		for (const { objects, project } of buildLists) {
			for (const object of objects) {
				if (isVideoAttemptIntermediate(object.key)) {
					continue;
				}

				const mediaType = contentTypeFor(object.key);
				const kind = mediaType.startsWith("image/")
					? ("image" as const)
					: mediaType.startsWith("video/")
						? ("video" as const)
						: null;

				if (!kind) {
					continue;
				}

				assets.push({
					createdAt: object.lastModified?.toISOString() ?? null,
					id: object.key,
					key: object.key,
					kind,
					mediaType,
					name: object.key.split("/").pop() ?? object.key,
					projectId: project.id,
					projectName: project.name,
					sizeBytes: object.sizeBytes,
					source: "page-build",
					url: publicAssetUrl(object.key),
				});
			}
		}

		assets.sort(byNewestFirst);

		// Honest cut signal: true when the final slice or any of the upstream
		// bounds could have dropped files — including a per-project R2 prefix
		// listing that hit its object cap.
		const truncated =
			assets.length > WORKSPACE_ASSETS_MAX ||
			imageAttempts.length >= WORKSPACE_DB_ROWS_MAX ||
			accessibleProjects.length > WORKSPACE_BUILD_PROJECTS_MAX ||
			buildListingCut;

		return {
			assets:
				assets.length > WORKSPACE_ASSETS_MAX
					? assets.slice(0, WORKSPACE_ASSETS_MAX)
					: assets,
			truncated,
		};
	}

	async download(
		scope: ProjectScope,
		projectId: string,
		key: string,
	): Promise<{ bytes: Uint8Array; fileName: string; mediaType: string }> {
		await this.assertAccessibleProject(scope, projectId);

		// Only this project's asset prefixes are downloadable; anything else is
		// a plain 404 so the route never leaks which keys exist.
		const allowed =
			key.startsWith(`sites/${projectId}/assets/`) ||
			key.startsWith(`images/${projectId}/`);
		const fileName = key.split("/").pop();

		if (!allowed || !fileName) {
			throw new NotFoundException();
		}

		const bytes = await getObjectBytes(key);

		if (!bytes) {
			throw new NotFoundException();
		}

		return { bytes, fileName, mediaType: contentTypeFor(key) };
	}

	private async assertAccessibleProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const accessible = await this.projectAssetsRepository.isProjectAccessible(
			scope,
			projectId,
		);

		if (!accessible) {
			throw new NotFoundException();
		}
	}

	// Build assets are best-effort: an unconfigured or hiccuping bucket must
	// degrade to "no build files" instead of failing the whole tab.
	private async listBuildObjects(projectId: string) {
		if (!isR2Configured()) {
			return [];
		}

		try {
			return withoutVariants(
				await listObjectsByPrefix(`sites/${projectId}/assets/`),
			);
		} catch {
			return [];
		}
	}

	// Workspace variant: ask for one object beyond the cap so a cut listing is
	// observable — the aggregate's `truncated` flag must not claim completeness
	// while a project's prefix was silently clipped.
	private async listBuildObjectsProbed(projectId: string): Promise<{
		cut: boolean;
		objects: Awaited<ReturnType<typeof listObjectsByPrefix>>;
	}> {
		if (!isR2Configured()) {
			return { cut: false, objects: [] };
		}

		try {
			const objects = withoutVariants(
				await listObjectsByPrefix(
					`sites/${projectId}/assets/`,
					BUILD_OBJECTS_MAX + 1,
				),
			);

			if (objects.length > BUILD_OBJECTS_MAX) {
				return { cut: true, objects: objects.slice(0, BUILD_OBJECTS_MAX) };
			}

			return { cut: false, objects };
		} catch {
			return { cut: false, objects: [] };
		}
	}
}

/**
 * Drop the srcset renditions written beside each build image. They are
 * machine-facing copies of an asset the user already sees — as cards they
 * would triple the tab and eat the listing cap.
 */
/**
 * The retired first-party video pipeline left frames/, segments/, and audio/
 * working files beside its deliverables under sites/{id}/assets/{attempt}/.
 * The DB rows that identified those attempts are gone; the key layout still
 * marks the working files, and they must never surface as user assets.
 */
function isVideoAttemptIntermediate(key: string): boolean {
	return (
		/^sites\/[^/]+\/assets\/[^/]+\//.test(key) &&
		/\/(?:frames|segments|audio)\//.test(key)
	);
}

function withoutVariants<T extends { key: string }>(objects: T[]): T[] {
	return objects.filter((object) => !VARIANT_FILENAME_PATTERN.test(object.key));
}

/** Order-preserving concurrent map with a small worker pool. */
async function mapWithConcurrency<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				results[index] = await fn(items[index] as T);
			}
		},
	);
	await Promise.all(workers);

	return results;
}

function byNewestFirst(a: ProjectAsset, b: ProjectAsset): number {
	if (a.createdAt === b.createdAt) {
		return 0;
	}

	if (a.createdAt === null) {
		return 1;
	}

	if (b.createdAt === null) {
		return -1;
	}

	return a.createdAt < b.createdAt ? 1 : -1;
}
