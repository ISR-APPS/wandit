/**
 * Builds the body of `POST /api/v2/projects` from the dashboard prompt box.
 * `useCreateAppProjectWithPrompt` calls it. No React and no network here.
 */

import type {
	AppLanguage,
	BuilderTurnMode,
	ComposerMetadata,
	CreateAppProjectRequest,
	TargetPlatform,
	UploadAttachmentResponse,
} from "@wandit/contracts";

/** Inputs of one create: the prompt box output plus the three dashboard picks. */
export type CreateAppProjectInput = {
	prompt: string;
	/** Mode, output, and options the prompt box reports with the prompt. */
	composer: ComposerMetadata | undefined;
	/** Files the prompt box uploaded to R2 before the submit. */
	attachments: UploadAttachmentResponse[] | undefined;
	/** UI locale of the user. The agent gets it as a hint for the app language only. */
	locale: AppLanguage;
	/** The app type chip pick: `web` or `mobile`. The server picks the template from it. */
	targetPlatform: TargetPlatform;
	/** The Plan chip: `plan` makes the first turn interview the user and plan; `build` builds at once. */
	mode: BuilderTurnMode;
};

/**
 * Maps the uploaded assets to `FileRef`s and sends the UI locale as the app
 * language hint. An empty attachment list is left out, like the V1 create.
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
		mode: input.mode,
	};
}
