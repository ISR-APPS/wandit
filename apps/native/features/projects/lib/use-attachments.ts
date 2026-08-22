import {
	ATTACHMENT_MEDIA_TYPES,
	type AttachmentMediaType,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	ATTACHMENT_MAX_BYTES,
	ATTACHMENT_MAX_COUNT,
	AttachmentUploadError,
	type AttachmentUploadErrorReason,
	uploadAttachment,
} from "../api/attachments.requests";

/**
 * use-attachments.ts — composer attachment state for the PromptBox.
 *
 * Uploads start AT PICK TIME (web parity): each picked file becomes a chip in
 * "uploading" state and flips to "ready" (carrying the server response the
 * chat/file parts need) or "error". Submit forwards only "ready" responses,
 * and `consume` removes exactly what a submit sent — files drafted while a
 * send was in flight survive for the next turn.
 *
 * Follows the useVoiceDictation convention: the caller passes translated
 * message strings; this hook never touches i18n itself.
 */

export type ComposerAttachment = {
	id: string;
	/** Local device uri — used for the chip thumbnail, not for the server. */
	uri: string;
	filename: string;
	mediaType: AttachmentMediaType;
	status: "uploading" | "ready" | "error";
	response?: UploadAttachmentResponse;
	/** Why the upload failed — drives the chip's reason line, error only. */
	error?: AttachmentUploadErrorReason;
};

export type AttachmentMessages = {
	cameraPermissionDenied: string;
	limitReached: string;
	tooLarge: string;
	unsupported: string;
	uploadFailed: string;
};

type PickedFile = {
	uri: string;
	filename: string | null;
	mimeType: string | null;
	size: number | null;
};

const ALLOWED_MEDIA_TYPES = new Set<string>(ATTACHMENT_MEDIA_TYPES);

// Fallback for pickers that omit mimeType — keyed by lowercase extension.
const EXTENSION_MEDIA_TYPES: Record<string, AttachmentMediaType> = {
	avif: "image/avif",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	pdf: "application/pdf",
	png: "image/png",
	txt: "text/plain",
	webp: "image/webp",
};

export function useAttachments(messages: AttachmentMessages) {
	const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
	// One transient feedback line for pick-time rejections (limit/size/type).
	const [notice, setNotice] = useState<string | null>(null);
	const idCounterRef = useRef(0);
	// Live count for the pickers — the closure's `attachments.length` is stale
	// by the time an awaited picker resolves.
	const attachmentsRef = useRef(attachments);
	useEffect(() => {
		attachmentsRef.current = attachments;
	}, [attachments]);

	const clearNotice = useCallback(() => setNotice(null), []);

	// Upload one entry and flip its chip to ready/error. Failures land on the
	// chip itself (reason line + retry) — the composer notice stays for
	// pick-time rejections only.
	const runUpload = useCallback(
		(
			entry: Pick<ComposerAttachment, "id" | "uri" | "filename" | "mediaType">,
		) => {
			void uploadAttachment({
				name: entry.filename,
				type: entry.mediaType,
				uri: entry.uri,
			})
				.then((response) => {
					setAttachments((current) =>
						current.map((attachment) =>
							attachment.id === entry.id
								? { ...attachment, response, status: "ready" as const }
								: attachment,
						),
					);
				})
				.catch((error: unknown) => {
					const reason: AttachmentUploadErrorReason =
						error instanceof AttachmentUploadError ? error.reason : "failed";
					setAttachments((current) =>
						current.map((attachment) =>
							attachment.id === entry.id
								? { ...attachment, error: reason, status: "error" as const }
								: attachment,
						),
					);
				});
		},
		[],
	);

	/** Re-run a failed upload with the retained local uri/name/type. */
	const retryAttachment = useCallback(
		(id: string) => {
			const target = attachmentsRef.current.find(
				(attachment) => attachment.id === id,
			);
			if (target?.status !== "error") return;
			setNotice(null);
			setAttachments((current) =>
				current.map((attachment) =>
					attachment.id === id
						? { ...attachment, error: undefined, status: "uploading" as const }
						: attachment,
				),
			);
			runUpload(target);
		},
		[runUpload],
	);

	const startUploads = useCallback(
		(picked: PickedFile[]) => {
			const currentCount = attachmentsRef.current.length;
			let accepted = 0;
			let rejection: string | null = null;

			const entries: ComposerAttachment[] = [];
			for (const file of picked) {
				if (currentCount + accepted >= ATTACHMENT_MAX_COUNT) {
					rejection = messages.limitReached;
					break;
				}

				const mediaType = resolveMediaType(file);
				if (!mediaType) {
					rejection = messages.unsupported;
					continue;
				}
				if (file.size !== null && file.size > ATTACHMENT_MAX_BYTES) {
					rejection = messages.tooLarge;
					continue;
				}

				idCounterRef.current += 1;
				entries.push({
					id: `attachment-${Date.now()}-${idCounterRef.current}`,
					uri: file.uri,
					filename: file.filename ?? defaultFilename(mediaType),
					mediaType,
					status: "uploading",
				});
				accepted += 1;
			}

			setNotice(rejection);
			if (entries.length === 0) return;

			// Re-clamped inside the updater so the max-count contract holds even
			// if another insert landed between the count read and this set.
			setAttachments((current) => {
				const room = Math.max(0, ATTACHMENT_MAX_COUNT - current.length);
				return room > 0 ? [...current, ...entries.slice(0, room)] : current;
			});

			for (const entry of entries) {
				runUpload(entry);
			}
		},
		[messages, runUpload],
	);

	const takePhoto = useCallback(async () => {
		setNotice(null);
		try {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission.granted) {
				setNotice(messages.cameraPermissionDenied);
				return;
			}

			// quality < 1 forces a JPEG re-encode, which is what keeps HEIC
			// captures inside the server's magic-byte allowlist.
			const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
			if (result.canceled) return;

			startUploads(
				result.assets.map((asset) => ({
					uri: asset.uri,
					filename: asset.fileName ?? null,
					mimeType: asset.mimeType ?? null,
					size: asset.fileSize ?? null,
				})),
			);
		} catch {
			// Camera unavailable / presentation failure — surface it instead of
			// leaving an unhandled rejection.
			setNotice(messages.uploadFailed);
		}
	}, [messages.cameraPermissionDenied, messages.uploadFailed, startUploads]);

	const pickFromLibrary = useCallback(async () => {
		setNotice(null);
		const remaining = ATTACHMENT_MAX_COUNT - attachmentsRef.current.length;
		if (remaining <= 0) {
			setNotice(messages.limitReached);
			return;
		}

		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				allowsMultipleSelection: true,
				mediaTypes: ["images"],
				// Compatible = PHPicker transcodes HEIC → JPEG, which multi-selection
				// needs and the server's magic-byte allowlist requires. No `quality`
				// here: on Android it re-encodes WebP/GIF while keeping the original
				// MIME/filename, which the server's sniffing then rejects.
				preferredAssetRepresentationMode:
					ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
				selectionLimit: remaining,
			});
			if (result.canceled) return;

			startUploads(
				result.assets.map((asset) => ({
					uri: asset.uri,
					filename: asset.fileName ?? null,
					mimeType: asset.mimeType ?? null,
					size: asset.fileSize ?? null,
				})),
			);
		} catch {
			setNotice(messages.uploadFailed);
		}
	}, [messages.limitReached, messages.uploadFailed, startUploads]);

	const browseFiles = useCallback(async () => {
		setNotice(null);
		try {
			const result = await DocumentPicker.getDocumentAsync({
				copyToCacheDirectory: true,
				multiple: true,
				type: [...ATTACHMENT_MEDIA_TYPES],
			});
			if (result.canceled) return;

			startUploads(
				result.assets.map((asset) => ({
					uri: asset.uri,
					filename: asset.name ?? null,
					mimeType: asset.mimeType ?? null,
					size: asset.size ?? null,
				})),
			);
		} catch {
			setNotice(messages.uploadFailed);
		}
	}, [messages.uploadFailed, startUploads]);

	const removeAttachment = useCallback((id: string) => {
		setNotice(null);
		setAttachments((current) =>
			current.filter((attachment) => attachment.id !== id),
		);
	}, []);

	/** Remove exactly the entries a submit sent (matched by uploaded url). */
	const consume = useCallback((files: UploadAttachmentResponse[]) => {
		if (files.length === 0) return;
		const sentUrls = new Set(files.map((file) => file.url));
		setNotice(null);
		setAttachments((current) =>
			current.filter(
				(attachment) =>
					!(attachment.response && sentUrls.has(attachment.response.url)),
			),
		);
	}, []);

	const reset = useCallback(() => {
		setNotice(null);
		setAttachments([]);
	}, []);

	const readyFiles = useMemo(
		() =>
			attachments.flatMap((attachment) =>
				attachment.status === "ready" && attachment.response
					? [attachment.response]
					: [],
			),
		[attachments],
	);

	return {
		attachments,
		browseFiles,
		clearNotice,
		consume,
		hasReadyFiles: readyFiles.length > 0,
		isUploading: attachments.some(
			(attachment) => attachment.status === "uploading",
		),
		notice,
		pickFromLibrary,
		readyFiles,
		removeAttachment,
		reset,
		retryAttachment,
		takePhoto,
	};
}

function resolveMediaType(file: PickedFile): AttachmentMediaType | null {
	const fromMime = file.mimeType?.toLowerCase().split(";")[0]?.trim();
	if (fromMime && ALLOWED_MEDIA_TYPES.has(fromMime)) {
		return fromMime as AttachmentMediaType;
	}

	const name = file.filename ?? file.uri;
	const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
	return EXTENSION_MEDIA_TYPES[extension] ?? null;
}

function defaultFilename(mediaType: AttachmentMediaType) {
	const extension =
		Object.entries(EXTENSION_MEDIA_TYPES).find(
			([, value]) => value === mediaType,
		)?.[0] ?? "bin";
	return `attachment-${Date.now()}.${extension}`;
}
