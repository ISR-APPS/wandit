import {
	getObjectContentType,
	imageGenerationKey,
	publicAssetUrl,
} from "../../../../infrastructure/storage/r2";
import type {
	GeneratedImageResult,
	ImageGenerationAttemptState,
} from "./image-generation-runner";

export function createStoredImagesRecovery() {
	return async (
		attempt: Pick<ImageGenerationAttemptState, "count" | "id" | "projectId">,
	): Promise<GeneratedImageResult[] | null> => {
		const images: GeneratedImageResult[] = [];

		for (let index = 1; index <= attempt.count; index += 1) {
			let found: GeneratedImageResult | null = null;

			for (const candidate of [
				{ extension: "png", mediaType: "image/png" },
				{ extension: "jpg", mediaType: "image/jpeg" },
				{ extension: "webp", mediaType: "image/webp" },
			] as const) {
				const key = imageGenerationKey(
					attempt.projectId,
					attempt.id,
					index,
					candidate.extension,
				);
				const storedMediaType = await getObjectContentType(key);

				if (!storedMediaType) {
					continue;
				}

				found = {
					index,
					mediaType: storedMediaType.startsWith("image/")
						? storedMediaType
						: candidate.mediaType,
					url: publicAssetUrl(key),
				};
				break;
			}

			if (found) {
				images.push(found);
			}
		}

		return images.length > 0 ? images : null;
	};
}
