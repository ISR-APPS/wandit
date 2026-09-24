/**
 * Builds the body of `POST /api/v2/projects` from the dashboard prompt box.
 * `useCreateAppProjectWithPrompt` calls it. No React and no network here.
 */

import type {
	AppLanguage,
	ComposerMetadata,
	CreateAppProjectRequest,
	TargetPlatform,
	UploadAttachmentResponse,
} from "@wandit/contracts";

/** Inputs of one create: the prompt box output plus the two dashboard picks. */
export type CreateAppProjectInput = {
	prompt: string;
	/** Mode, output, and options the prompt box reports with the prompt. */
	composer: ComposerMetadata | undefined;
	/** Files the prompt box uploaded to R2 before the submit. */
	attachments: UploadAttachmentResponse[] | undefined;
	/** UI locale of the user. The generated app ships in that language (D7). */
	locale: AppLanguage;
	/** The app type chip pick: `web` today, `mobile` after WANDIT-192. */
	targetPlatform: TargetPlatform;
};

/**
 * Maps the uploaded assets to `FileRef`s and sends the UI locale as the one
 * app language. An empty attachment list is left out, like the V1 create.
 */
export function toCreateAppProjectBody(
	input: CreateAppProjectInput,
): CreateAppProjectRequest {
	return {
		prompt: input.prompt,
		composer: input.composer,
		attachments: input.attachments?.length
			? input.attachments.map((attachment) => ({
					url: attachment.url,
					mediaType: attachment.mediaType,
					filename: attachment.filename,
				}))
			: undefined,
		targetPlatform: input.targetPlatform,
		languages: [input.locale],
	};
}
