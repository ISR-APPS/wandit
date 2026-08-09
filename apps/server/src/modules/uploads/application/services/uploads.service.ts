/**
 * User-asset attachment uploads (V2 spec §11): one file per request lands in
 * R2 under the user's prefix and comes back as the public URL the chat and
 * the builder reference. Server-proxied on purpose — the browser never talks
 * to R2 directly, so every stored object went through this allowlist.
 */
import {
	Injectable,
	ServiceUnavailableException,
	UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
	ATTACHMENT_MEDIA_TYPES,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import {
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
	userUploadKey,
} from "../../../../infrastructure/storage/r2";

type AttachmentMediaType = (typeof ATTACHMENT_MEDIA_TYPES)[number];

// Canonical extension per allowed type, plus the spellings accepted as-is.
// sanitizeFilename appends the canonical one when the name has none of them.
const EXTENSIONS: Record<
	AttachmentMediaType,
	{ accepted: string[]; canonical: string }
> = {
	"application/pdf": { accepted: ["pdf"], canonical: "pdf" },
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
		accepted: ["xlsx"],
		canonical: "xlsx",
	},
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
		accepted: ["docx"],
		canonical: "docx",
	},
	"image/avif": { accepted: ["avif"], canonical: "avif" },
	"image/gif": { accepted: ["gif"], canonical: "gif" },
	"image/jpeg": { accepted: ["jpeg", "jpg"], canonical: "jpg" },
	"image/png": { accepted: ["png"], canonical: "png" },
	"image/webp": { accepted: ["webp"], canonical: "webp" },
	"text/csv": { accepted: ["csv"], canonical: "csv" },
	"text/plain": { accepted: ["log", "md", "text", "txt"], canonical: "txt" },
};

// First-bytes signatures for the binary types (contract §7.2). text/plain and
// text/csv have no signature — the declared type is trusted for them.
const MAGIC_BYTES: Partial<
	Record<AttachmentMediaType, (bytes: Buffer) => boolean>
> = {
	"application/pdf": (bytes) => ascii(bytes, 0, 4) === "%PDF",
	// docx and xlsx are OOXML: ZIP containers, so both carry the PK signature.
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
		bytes,
	) => startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]),
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
		bytes,
	) => startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]),
	"image/avif": (bytes) =>
		ascii(bytes, 4, 8) === "ftyp" &&
		["avif", "avis"].includes(ascii(bytes, 8, 12)),
	"image/gif": (bytes) => ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6)),
	"image/jpeg": (bytes) => startsWithBytes(bytes, [0xff, 0xd8, 0xff]),
	"image/png": (bytes) =>
		startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	"image/webp": (bytes) =>
		ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP",
};

function ascii(bytes: Buffer, start: number, end: number): string {
	return bytes.subarray(start, end).toString("latin1");
}

function startsWithBytes(bytes: Buffer, signature: number[]): boolean {
	return signature.every((byte, index) => bytes[index] === byte);
}

@Injectable()
export class UploadsService {
	async uploadAttachment(
		userId: string,
		file: { buffer: Buffer; filename: string; mimetype: string },
	): Promise<UploadAttachmentResponse> {
		// Same posture as the page pipeline: the server boots without R2, so
		// storage-backed endpoints answer honestly instead of crashing.
		if (!isR2Configured() || !env.R2_PUBLIC_BASE_URL) {
			throw new ServiceUnavailableException({
				code: "STORAGE_UNAVAILABLE",
				message: "File storage is not configured",
			});
		}

		const mediaType = this.resolveMediaType(file.mimetype, file.filename);

		if (!mediaType) {
			throw new UnsupportedMediaTypeException({
				code: "UNSUPPORTED_ATTACHMENT_TYPE",
				message:
					"Only images (JPEG, PNG, WebP, GIF, AVIF), PDF, Word, Excel, CSV " +
					"and plain text files are accepted",
			});
		}

		// Declared type alone is client-controlled — the first bytes must agree
		// before the object becomes a publicly served URL.
		const matchesSignature = MAGIC_BYTES[mediaType];

		if (matchesSignature && !matchesSignature(file.buffer)) {
			throw new UnsupportedMediaTypeException({
				code: "UNSUPPORTED_ATTACHMENT_TYPE",
				message: "The file's content does not match its declared type",
			});
		}

		const filename = sanitizeFilename(file.filename, mediaType);
		const key = userUploadKey(userId, crypto.randomUUID(), filename);

		await putSiteFile(key, file.buffer, mediaType);

		return {
			filename,
			key,
			mediaType,
			size: file.buffer.length,
			url: publicAssetUrl(key),
		};
	}

	// "image/png; charset=binary" → "image/png"; null when not allowlisted.
	private resolveMediaType(
		mimetype: string,
		filename: string,
	): AttachmentMediaType | null {
		const normalized = (mimetype.split(";")[0] ?? "").trim().toLowerCase();
		const declared =
			ATTACHMENT_MEDIA_TYPES.find((type) => type === normalized) ?? null;

		if (declared) {
			return declared;
		}

		return AMBIGUOUS_DECLARED_TYPES.has(normalized)
			? mediaTypeFromFilename(filename)
			: null;
	}
}

// Browsers report CSV and Office documents inconsistently — an empty type,
// application/octet-stream, or the legacy Excel type depending on the OS and
// whether Office is installed. Only those three declarations fall back to the
// filename extension, and only for these three types; everything else is 415.
const AMBIGUOUS_DECLARED_TYPES = new Set([
	"",
	"application/octet-stream",
	"application/vnd.ms-excel",
]);

const EXTENSION_MEDIA_TYPES: Record<string, AttachmentMediaType> = {
	csv: "text/csv",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function mediaTypeFromFilename(filename: string): AttachmentMediaType | null {
	const dotIndex = filename.lastIndexOf(".");
	const extension =
		dotIndex > 0 ? filename.slice(dotIndex + 1).toLowerCase() : "";

	return EXTENSION_MEDIA_TYPES[extension] ?? null;
}

// Contract §7.2: keep [a-zA-Z0-9._-], collapse the rest to "-", max 80 chars,
// ensure an extension matching the media type. Exported for tests.
export function sanitizeFilename(
	raw: string,
	mediaType: AttachmentMediaType,
): string {
	const { accepted, canonical } = EXTENSIONS[mediaType];
	let name = raw
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/^[-.]+/, "")
		.replace(/-+$/, "");

	// A name that sanitized away entirely still needs a stable stem.
	if (!name || /^\.+$/.test(name)) {
		name = "file";
	}

	const dotIndex = name.lastIndexOf(".");
	const currentExtension =
		dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
	const extension = accepted.includes(currentExtension)
		? currentExtension
		: canonical;
	const stem = dotIndex > 0 ? name.slice(0, dotIndex) : name;

	// Truncate the stem, never the extension, to stay within 80 chars total.
	const maxStem = 80 - extension.length - 1;

	return `${stem.slice(0, maxStem) || "file"}.${extension}`;
}
