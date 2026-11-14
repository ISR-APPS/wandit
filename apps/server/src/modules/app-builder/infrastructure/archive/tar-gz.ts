/**
 * Reads the entries of a `.tar.gz` in memory, with no disk access.
 * `template-init.ts` reads the template archives with it. `CodeStorageGitStore`
 * reads the `git archive` answer of code.storage with it.
 */
import { posix } from "node:path";
import { gunzipSync } from "node:zlib";

/** Size of one tar header and of one content block. */
const TAR_BLOCK_BYTES = 512;

/** One entry of a ustar archive, read from its 512-byte header. */
type TarEntry = {
	/** Path in the archive with no leading "./", for example "src/app.tsx". */
	path: string;
	/** Octal mode text of the header, for example "000644". */
	mode: string;
	/**
	 * Type flag: "0" or "" is a regular file, "2" a symlink, "5" a folder.
	 * "x" is a pax header for the next entry, "g" a global pax header.
	 */
	type: string;
	/** Bytes after the header. Only a regular file holds project bytes. */
	content: Uint8Array;
	/** Target of a symlink. A regular file has an empty value. */
	linkTarget: string;
};

/**
 * The entries of a `.tar.gz` in archive order. `maxTarBytes` caps the
 * unpacked size: over it, the first iteration throws the zlib RangeError
 * `ERR_BUFFER_TOO_LARGE`. Without it, the zlib default cap applies. A header
 * with a bad size, or with content past the end of the tar, throws an Error.
 */
export function* tarEntries(
	archive: Uint8Array,
	maxTarBytes?: number,
): Generator<TarEntry> {
	const tar = gunzipSync(archive, { maxOutputLength: maxTarBytes });
	let offset = 0;
	// A zero block ends the archive. An archive cut inside a header ends the
	// loop too. A cut inside the content throws below.
	while (offset + TAR_BLOCK_BYTES <= tar.length) {
		const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES);
		if (header.every((byte) => byte === 0)) {
			break;
		}
		// Header fields of the ustar format: offsets and lengths in bytes.
		const size = Number.parseInt(tarText(header, 124, 12) || "0", 8);
		const contentStart = offset + TAR_BLOCK_BYTES;
		// The archive is untrusted. A negative size never moves the offset. A
		// size past the end gives this entry the bytes of later entries.
		if (
			!Number.isSafeInteger(size) ||
			size < 0 ||
			contentStart + size > tar.length
		) {
			throw new Error(`Tar header at byte ${offset} has a bad size`);
		}
		yield {
			content: tar.subarray(contentStart, contentStart + size),
			linkTarget: tarText(header, 157, 100),
			mode: tarText(header, 100, 8),
			path: posix.join(tarPath(header, 345, 155), tarPath(header, 0, 100)),
			type: tarText(header, 156, 1),
		};
		offset = contentStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
	}
}

/** True for a regular file. A folder or a pax header holds no project file. */
export function isRegularFile(entry: TarEntry): boolean {
	return entry.type === "0" || entry.type === "";
}

/** One NUL-padded text field of a tar header, trimmed. */
function tarText(header: Uint8Array, start: number, length: number): string {
	return tarPath(header, start, length).trim();
}

/**
 * One NUL-padded path field of a tar header, cut at the first NUL only.
 * No trim: "src/a.ts" and "src/a.ts " are two different committed files.
 */
function tarPath(header: Uint8Array, start: number, length: number): string {
	const field = header.subarray(start, start + length);
	const end = field.indexOf(0);
	return Buffer.from(end === -1 ? field : field.subarray(0, end)).toString(
		"utf8",
	);
}
