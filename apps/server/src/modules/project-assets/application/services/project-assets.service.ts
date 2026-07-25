/**
 * Assets tab backend: one ownership-checked list of every media file the AI
 * produced for a project, whatever pipeline made it — standalone image
 * generations, image animations, and the images/videos generated inside page
 * builds (which have no DB rows; the bucket is their source of truth).
 */
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ProjectAsset } from "@wandit/contracts";

import {
	contentTypeFor,
	getObjectBytes,
	isR2Configured,
	listObjectsByPrefix,
	publicAssetKeyFromUrl,
	publicAssetUrl,
} from "../../../../infrastructure/storage/r2";
import { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { ProjectAssetsRepository } from "../../infrastructure/persistence/project-assets.repository";

// A video prompt doubles as the animation's display name, cut on a word
// boundary so cards never show mid-word truncation.
const LABEL_MAX_CHARS = 40;

@Injectable()
export class ProjectAssetsService {
	constructor(
		@Inject(ProjectAssetsRepository)
		private readonly projectAssetsRepository: ProjectAssetsRepository,
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
		@Inject(MediaGenerationsRepository)
		private readonly mediaGenerationsRepository: MediaGenerationsRepository,
	) {}

	async listAssets(userId: string, projectId: string): Promise<ProjectAsset[]> {
		await this.assertOwnedProject(userId, projectId);

		const [imageAttempts, videoAttempts] = await Promise.all([
			this.imageGenerationsRepository.listOwnedByProject(userId, projectId),
			this.mediaGenerationsRepository.listOwnedSucceededByProject(
				userId,
				projectId,
			),
		]);

		const assets: ProjectAsset[] = [];

		for (const attempt of imageAttempts) {
			if (attempt.status !== "succeeded" || !attempt.images) {
				continue;
			}

			attempt.images.forEach((image, index) => {
				const key = publicAssetKeyFromUrl(image.url);

				if (!key) {
					return;
				}

				assets.push({
					createdAt: (attempt.completedAt ?? attempt.createdAt).toISOString(),
					id: `${attempt.id}:${index + 1}`,
					key,
					kind: "image",
					mediaType: image.mediaType,
					name:
						attempt.count > 1
							? `${attempt.title} (${index + 1}/${attempt.count})`
							: attempt.title,
					sizeBytes: null,
					source: "image-generation",
					url: image.url,
				});
			});
		}

		// Animation videos live under the same sites/{id}/assets/ prefix the
		// build listing scans — remember their keys so they are never listed
		// twice.
		const animationKeys = new Set<string>();

		for (const row of videoAttempts) {
			if (!row.videoUrl) {
				continue;
			}

			const key = publicAssetKeyFromUrl(row.videoUrl);

			if (!key) {
				continue;
			}

			animationKeys.add(key);
			assets.push({
				createdAt: (row.completedAt ?? row.createdAt).toISOString(),
				id: row.id,
				key,
				kind: "video",
				mediaType: row.videoMediaType ?? "video/mp4",
				name: animationLabel(row.prompt),
				sizeBytes: null,
				source: "image-animation",
				url: row.videoUrl,
			});
		}

		for (const object of await this.listBuildObjects(projectId)) {
			if (animationKeys.has(object.key)) {
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

	async download(
		userId: string,
		projectId: string,
		key: string,
	): Promise<{ bytes: Uint8Array; fileName: string; mediaType: string }> {
		await this.assertOwnedProject(userId, projectId);

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

	private async assertOwnedProject(
		userId: string,
		projectId: string,
	): Promise<void> {
		const owned = await this.projectAssetsRepository.isProjectOwned(
			userId,
			projectId,
		);

		if (!owned) {
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
			return await listObjectsByPrefix(`sites/${projectId}/assets/`);
		} catch {
			return [];
		}
	}
}

function animationLabel(prompt: string): string {
	const trimmed = prompt.trim();

	if (!trimmed) {
		return "Animation";
	}

	if (trimmed.length <= LABEL_MAX_CHARS) {
		return trimmed;
	}

	const cut = trimmed.slice(0, LABEL_MAX_CHARS);
	const lastSpace = cut.lastIndexOf(" ");

	return `${(lastSpace > LABEL_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
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
