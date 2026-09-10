/**
 * Builds the first user message for a page build.
 * The site builder supplies results from the model-safe storage guard.
 * This file creates AI SDK message parts in the brief order.
 * It does not call storage or a provider.
 */
import type { ModelMessage, UserContent } from "ai";

import type { ModelSafePhoto } from "../../../../infrastructure/storage/model-safe-photo";

/**
 * Keeps each photo URL marker beside its optional model file part.
 * The caller loads the photos first; this function only arranges parts.
 */
export function composeBuildStartMessages(params: {
	brief: string;
	title: string;
	userPhotos: ModelSafePhoto[];
}): ModelMessage[] {
	const content: Exclude<UserContent, string> = [
		{
			text:
				`Build the landing page now.\n\nTITLE: ${params.title}\n\n` +
				`BRIEF:\n${params.brief}`,
			type: "text",
		},
	];

	for (const [index, photo] of params.userPhotos.entries()) {
		const marker = `[User photo ${index + 1} — URL: ${photo.url}]`;

		// The URL marker lets the builder place a photo that the model cannot view.
		if (photo.kind === "unusable") {
			content.push({
				text:
					`${marker} — this photo could not be loaded for viewing ` +
					`(${photo.reason}); place it by URL only`,
				type: "text",
			});
			continue;
		}

		content.push({
			text: marker,
			type: "text",
		});
		// Safe stored photos stay as URLs. Optimized photos use their checked replacement bytes.
		content.push(
			photo.kind === "url"
				? {
						data: photo.url,
						// The AI SDK accepts the generic "image" media type for a URL whose MIME type is unknown.
						mediaType: "image",
						type: "file",
					}
				: {
						data: photo.bytes,
						mediaType: photo.mediaType,
						type: "file",
					},
		);
	}

	// An unusable marker must not tell the model that its photo is attached.
	const photoSummary = params.userPhotos.some(
		(photo) => photo.kind === "unusable",
	)
		? "These are the user's real photos from the brief, attached so you can SEE them, except the ones marked as not loadable. "
		: "These are the user's real photos from the brief, attached so you can SEE them. ";
	content.push({
		text:
			photoSummary +
			"Judge each one's quality before you write HTML, per your PHOTO QUALITY GATE law. To enhance, restage, or refit one to a slot's shape, pass its exact URL from its marker as generate_image sourceImageUrls.",
		type: "text",
	});

	return [{ content, role: "user" }];
}
