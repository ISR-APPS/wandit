/**
 * The host lines for the sources of one builder turn: the @-tag of the
 * sources menu and the composer attachments. builder-turn.runtime.ts puts
 * them outside the <user_message> tags of the turn prompt. Pure functions, no I/O.
 */
import {
	attachmentMediaTypeSchema,
	type BuilderTurnAction,
} from "@wandit/contracts";

import { escapeReservedTags } from "./question-answers";

/**
 * The sandbox folder of the composer attachment copies. It is outside the
 * project, so the turn commit never holds them. The agent copies a file into
 * public/ when the app needs it. A turn adds `<first 8 chars of turnId>/`.
 */
export const ATTACHMENT_COPY_ROOT_DIR = "/tmp/wandit/attachments";

/**
 * How the agent can open one attachment. `image` and `pdf` open with Read.
 * `pdf` and `document` also get an extracted text file. `media` (video,
 * audio) stays URL-only, because no agent tool opens it.
 */
export type AttachmentKind = "image" | "pdf" | "document" | "media";

/**
 * The kind of one attachment media type, or null for a type outside
 * `ATTACHMENT_MEDIA_TYPES`. The client sends the media type, so the enum
 * parse is the boundary: an unknown type is never copied or shown.
 */
export function attachmentKindOf(mediaType: string): AttachmentKind | null {
	const parsed = attachmentMediaTypeSchema.safeParse(mediaType);
	if (!parsed.success) {
		return null;
	}
	const type = parsed.data;
	if (type === "application/pdf") {
		return "pdf";
	}
	if (type.startsWith("image/")) {
		return "image";
	}
	if (type.startsWith("video/") || type.startsWith("audio/")) {
		return "media";
	}
	// The rest of the enum: text/plain, text/csv, docx, and xlsx.
	return "document";
}

/** One composer attachment after the copy step of the turn. */
export type AttachmentCopy = {
	/** The R2 URL of the upload, from `spec.attachments`. */
	url: string;
	/** The media type that the client sent; not trusted, see `attachmentKindOf`. */
	mediaType: string;
	/** Absolute sandbox path of the copy. Null for media, an unknown type, or a failed copy. */
	path: string | null;
	/** Absolute sandbox path of the extracted text. Null when there is no text file. */
	textPath: string | null;
};

/** The note after one attachment line: how the agent opens the file. */
function attachmentNoteOf(copy: AttachmentCopy): string {
	const kind = attachmentKindOf(copy.mediaType);
	if (kind === "media") {
		return "You cannot open video or audio files.";
	}
	if (copy.path === null) {
		return "It is not in the sandbox. Use the URL.";
	}
	const readNote =
		kind === "image" || kind === "pdf" ? "Read the file to see it." : "";
	const textNote =
		copy.textPath !== null
			? `Its text is in ${copy.textPath}.`
			: kind === "document"
				? "Its text could not be extracted."
				: "";
	return [readNote, textNote].filter((note) => note !== "").join(" ");
}

/**
 * The "Attached files" block of the turn prompt: one line per composer
 * attachment with its sandbox path, media type, and URL, then the URL of
 * each answer file. Answer files have their own copy in public/uploads/.
 */
export function attachedFilesTextOf(
	copies: readonly AttachmentCopy[],
	answerFileUrls: readonly string[],
): string {
	// The block is outside the user tags. The escape stops a URL that fakes a tag.
	const copyLines = copies.map((copy) => {
		const url = escapeReservedTags(copy.url);
		// Security check: only an enum media type reaches the host text.
		const type =
			attachmentKindOf(copy.mediaType) === null
				? "unknown type"
				: copy.mediaType;
		const head =
			copy.path === null
				? `- ${url} (${type})`
				: `- ${copy.path} (${type}, ${url})`;
		return `${head}: ${attachmentNoteOf(copy)}`;
	});
	const answerLines = answerFileUrls.map(
		(url) => `- ${escapeReservedTags(url)}`,
	);
	// The identity rules make files outside the project confidential; these are the user's own.
	const header =
		copies.length > 0
			? "Attached files. They are the user's own files: you can read and quote them."
			: "Attached files:";
	const footer = copies.some((copy) => copy.path !== null)
		? ["To use a file in the app, copy it into public/ first."]
		: [];
	return [header, ...copyLines, ...answerLines, ...footer].join("\n");
}

/**
 * The host line of one @-tag. The runtime puts it in front of the request
 * text, so the agent runs that action first. The session instructions
 * never change per turn: they are part of the warm session key.
 */
export function turnActionLineOf(action: BuilderTurnAction): string {
	const sourcesRule =
		"Base the work on the results, and name the sources. If you do not have the web_search tool, tell the user that web search is not available.";
	switch (action.kind) {
		case "web_search":
			return `The user picked @Web search. Call web_search for this request before you answer or write code. ${sourcesRule}`;
		case "deep_search":
			return `The user picked @Deep search. Call web_search with depth "deep" for this request before you answer or write code. ${sourcesRule}`;
		case "clone_site":
			// JSON quotes the URL; the escape stops a URL that fakes a tag outside the user tags.
			return `The user picked @Clone website for ${escapeReservedTags(JSON.stringify(action.url))}. Call capture_site with this exact URL before any other work, then follow the CLONE.md rules. The user message, if there is one, adds details. If you do not have the capture_site tool, tell the user that cloning is not available here, and stop.`;
	}
}
