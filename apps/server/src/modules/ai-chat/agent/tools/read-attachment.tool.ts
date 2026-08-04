/**
 * read_attachment — reads the text content of a document the user attached.
 *
 * The URL allowlist is derived from the validated transcript (same posture as
 * generate_image's source images): the model can only ask for a document that
 * is genuinely in this conversation, never for a URL it invented.
 */
import {
	type ReadAttachmentInput,
	type ReadAttachmentOutput,
	readAttachmentInputSchema,
	readAttachmentOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import {
	getObjectBytes,
	publicAssetKeyFromUrl,
} from "../../../../infrastructure/storage/r2";
import { extractAttachmentText } from "../attachment-text";

export type AvailableDocument = {
	filename?: string;
	mediaType: string;
	url: string;
};

export type ReadAttachmentToolDeps = {
	availableDocuments: readonly AvailableDocument[];
};

export function createReadAttachmentTool(
	deps: ReadAttachmentToolDeps,
): Tool<ReadAttachmentInput, ReadAttachmentOutput> {
	return tool({
		description:
			"Read the text content of a document the user attached (PDF, Word, " +
			"Excel, CSV, plain text). Pass the exact URL from that attachment's " +
			"marker in the conversation. Use it whenever the document's contents " +
			"matter for the task — prices, specifications, a client list, brand " +
			"guidelines — instead of guessing what it contains.",
		inputSchema: readAttachmentInputSchema,
		outputSchema: readAttachmentOutputSchema,
		execute: async (input): Promise<ReadAttachmentOutput> => {
			const attached = deps.availableDocuments.find(
				(document) => document.url === input.url,
			);

			if (!attached) {
				return {
					message: "This URL is not an attachment in this conversation.",
					status: "unavailable",
				};
			}

			const key = publicAssetKeyFromUrl(attached.url);
			const bytes = key ? await getObjectBytes(key) : null;

			if (!bytes) {
				return {
					message:
						"This attachment could not be loaded from storage. Tell the " +
						"user honestly and ask them to send the document again.",
					status: "unavailable",
				};
			}

			const extracted = await extractAttachmentText(bytes, attached.mediaType);

			if ("error" in extracted) {
				return { message: extracted.error, status: "unavailable" };
			}

			return {
				...(attached.filename ? { filename: attached.filename } : {}),
				mediaType: attached.mediaType,
				status: "ok",
				text: extracted.text,
				truncated: extracted.truncated,
			};
		},
	});
}

export type ReadAttachmentTool = ReturnType<typeof createReadAttachmentTool>;

export const readAttachmentToolSchemaOnly: Tool<
	ReadAttachmentInput,
	ReadAttachmentOutput
> = tool({
	inputSchema: readAttachmentInputSchema,
	outputSchema: readAttachmentOutputSchema,
});
