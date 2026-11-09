/**
 * Checks the `.app.tar.gz` that the macOS CI uploads and writes it again with
 * the server tar writer (`packTarGzip`). The `desktop-build` task calls it
 * before it signs the archive. The updater unpacks entries with no path
 * guard, so only entries that this file understood reach the signed archive.
 */
import { gunzipSync } from "node:zlib";

import { getErrorMessage } from "@wandit/observability/error";

import {
	DesktopBuildInputError,
	packTarGzip,
	type TarEntry,
} from "./desktop-build-input";

/** Result of `repackMacAppArchive`. `reason` is English for the row and support; it holds no URL. */
export type MacAppArchiveResult =
	| { kind: "ok"; gzipBytes: Buffer }
	| { kind: "invalid"; reason: string };

// 200 MB: the shell app (about 16 MiB) plus the frontend (at most 100 MB,
// MAX_DIST_BYTES of the runtime). It is the gunzip output cap, so a gzip bomb
// stops in zlib. It also keeps the memory of the re-pack low.
const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;
// A Tauri app has about 10 entries; the probe archive of bsdtar has 9.
const MAX_ENTRIES = 1_000;
// CI writes only ASCII names: the binary name and the fixed `icon.icns`. The
// first character refuses ".", "..", and the AppleDouble "._" names.
const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
// A reason shows at most this many characters of an entry path.
const SHOWN_PATH_LENGTH = 200;
const BLOCK_BYTES = 512;
// Magic "ustar\0" and version "00" at offset 257. GNU tar writes "ustar  \0".
const USTAR_MAGIC = Buffer.from("ustar\u000000", "latin1");
// A ustar number: octal digits, then NUL or space bytes. bsdtar writes "000755 \0".
const OCTAL_FIELD_PATTERN = /^[0-7]+[ \0]*$/;

// One broken read rule. `repackMacAppArchive` turns it into an `invalid` result.
class ArchiveRuleError extends Error {}

/**
 * Parses the CI archive with strict ustar rules and answers a new gzip
 * archive with the same paths and server-set headers (owner 0, time 0, fixed
 * modes). Answers `invalid` for any entry outside the rules. Throws only on a
 * fault of the server writer.
 */
export function repackMacAppArchive(input: {
	/** Bytes of the staged `.app.tar.gz` from R2, after the gzip magic check. */
	gzipBytes: Buffer;
	/** `desktop_apps.binary_name`. The root is `<binaryName>.app`; the executable is `Contents/MacOS/<binaryName>`. */
	binaryName: string;
}): MacAppArchiveResult {
	let tar: Buffer;
	try {
		tar = gunzipSync(input.gzipBytes, { maxOutputLength: MAX_UNPACKED_BYTES });
	} catch (error) {
		// zlib throws on bytes that are not gzip and on an output above the cap.
		return {
			kind: "invalid",
			reason: `The archive is not gzip or unpacks to more than 200 MB: ${getErrorMessage(error)}`,
		};
	}
	let entries: TarEntry[];
	try {
		entries = readAppEntries(tar, input.binaryName);
	} catch (error) {
		if (error instanceof ArchiveRuleError) {
			return { kind: "invalid", reason: error.message };
		}
		throw error;
	}
	try {
		return { gzipBytes: packTarGzip(entries), kind: "ok" };
	} catch (error) {
		// The parser read each path from ustar fields, so this is not expected.
		if (error instanceof DesktopBuildInputError) {
			return { kind: "invalid", reason: error.message };
		}
		throw error;
	}
}

// Security: reads the headers in order and keeps only plain files and
// folders under `<binaryName>.app/Contents/`. Each entry gets the fields that
// the writer needs (path, type, bytes). No other header field goes on.
function readAppEntries(tar: Buffer, binaryName: string): TarEntry[] {
	const root = `${binaryName}.app`;
	const executablePath = `${root}/Contents/MacOS/${binaryName}`;
	const entries: TarEntry[] = [];
	// Folder paths without the end "/", for the parent rule.
	const folders = new Set<string>();
	// APFS ignores case by default, so two names that differ only in case are one file.
	const seenPaths = new Set<string>();
	let offset = 0;
	// The loop ends at the first zero block. Every other exit throws.
	while (true) {
		if (offset + BLOCK_BYTES > tar.byteLength) {
			throw new ArchiveRuleError("The archive ends without an end block");
		}
		const header = tar.subarray(offset, offset + BLOCK_BYTES);
		if (isAllZero(header)) {
			// bsdtar pads the end with zero blocks only.
			if (!isAllZero(tar.subarray(offset + BLOCK_BYTES))) {
				throw new ArchiveRuleError(
					"The archive holds data after the end block",
				);
			}
			break;
		}
		if (entries.length >= MAX_ENTRIES) {
			throw new ArchiveRuleError(
				`The archive holds more than ${MAX_ENTRIES} entries`,
			);
		}
		// Field offsets and lengths of the ustar format, in bytes.
		const nameBytes = textField(header, 0, 100);
		const prefixBytes = textField(header, 345, 155);
		const pathBytes =
			prefixBytes.byteLength === 0
				? nameBytes
				: Buffer.concat([prefixBytes, Buffer.from("/"), nameBytes]);
		const shown = shownText(pathBytes.toString("latin1"));
		if (!header.subarray(257, 265).equals(USTAR_MAGIC)) {
			throw new ArchiveRuleError(
				`The entry "${shown}" is not a plain ustar header`,
			);
		}
		if (readOctal(header, 148, 8, shown, "checksum") !== checksumOf(header)) {
			throw new ArchiveRuleError(
				`The entry "${shown}" has a wrong header checksum`,
			);
		}
		// "0" or NUL is a regular file, "5" a folder. This refuses links, devices,
		// pax headers ("x", "g"), and GNU long names ("L", "K").
		const typeflag = header[156] ?? 0;
		const isFolder = typeflag === 0x35;
		if (!isFolder && typeflag !== 0x30 && typeflag !== 0) {
			throw new ArchiveRuleError(
				`The entry "${shown}" has type "${shownText(String.fromCharCode(typeflag))}". Only files ("0") and folders ("5") are allowed`,
			);
		}
		readOctal(header, 100, 8, shown, "mode");
		const size = readOctal(header, 124, 12, shown, "size");
		if (pathBytes.some((byte) => byte >= 0x80)) {
			throw new ArchiveRuleError(`The entry "${shown}" has a non-ASCII name`);
		}
		const path = entryPath(pathBytes.toString("latin1"), isFolder, shown);
		if (entries.length === 0) {
			if (!isFolder || path !== root) {
				throw new ArchiveRuleError(
					`The first entry "${shown}" is not the folder "${root}/"`,
				);
			}
		} else if (
			path !== `${root}/Contents` &&
			!path.startsWith(`${root}/Contents/`)
		) {
			throw new ArchiveRuleError(
				`The entry "${shown}" is outside "${root}/Contents/"`,
			);
		}
		if (seenPaths.has(path.toLowerCase())) {
			throw new ArchiveRuleError(
				`The archive holds "${shown}" twice (case ignored)`,
			);
		}
		seenPaths.add(path.toLowerCase());
		// bsdtar writes each folder before its content. A missing parent also
		// shows a folder that tar dropped with exit 0 (name too long for ustar).
		if (
			entries.length > 0 &&
			!folders.has(path.slice(0, path.lastIndexOf("/")))
		) {
			throw new ArchiveRuleError(
				`The entry "${shown}" comes before its parent folder`,
			);
		}
		if (path.startsWith(`${root}/Contents/MacOS/`) && path !== executablePath) {
			throw new ArchiveRuleError(
				`The entry "${shown}" is in Contents/MacOS/, which holds only the app binary`,
			);
		}
		if (isFolder && size !== 0) {
			throw new ArchiveRuleError(`The folder "${shown}" has a size`);
		}
		const dataStart = offset + BLOCK_BYTES;
		// The gunzip cap bounds the sum of all sizes: each entry fits in `tar`.
		if (dataStart + size > tar.byteLength) {
			throw new ArchiveRuleError(`The entry "${shown}" is cut off`);
		}
		if (isFolder) {
			folders.add(path);
			entries.push({
				content: new Uint8Array(),
				path: `${path}/`,
				type: "folder",
			});
		} else {
			entries.push({
				content: tar.subarray(dataStart, dataStart + size),
				path,
				type: path === executablePath ? "executable" : "file",
			});
		}
		offset = dataStart + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES;
	}
	const filePaths = new Set(
		entries.filter((entry) => entry.type !== "folder").map(({ path }) => path),
	);
	for (const required of [
		`${root}/Contents/Info.plist`,
		executablePath,
		`${root}/Contents/_CodeSignature/CodeResources`,
	]) {
		if (!filePaths.has(required)) {
			throw new ArchiveRuleError(`The archive has no file "${required}"`);
		}
	}
	return entries;
}

// The path of one entry without the end "/" of a folder. Each name part must
// match SEGMENT_PATTERN, which also refuses an empty part, a leading "/", a
// "\", and a space.
function entryPath(text: string, isFolder: boolean, shown: string): string {
	if (isFolder !== text.endsWith("/")) {
		throw new ArchiveRuleError(
			isFolder
				? `The folder "${shown}" does not end with "/"`
				: `The file "${shown}" ends with "/"`,
		);
	}
	const path = isFolder ? text.slice(0, -1) : text;
	// The ustar fields hold at most 155 bytes per name part, below the 255 of APFS.
	for (const segment of path.split("/")) {
		if (!SEGMENT_PATTERN.test(segment)) {
			throw new ArchiveRuleError(
				`The entry "${shown}" has the name part "${shownText(segment)}", which breaks the name rule`,
			);
		}
	}
	return path;
}

// The bytes of a NUL-ended text field. A full field has no NUL.
function textField(header: Buffer, offset: number, length: number): Buffer {
	const field = header.subarray(offset, offset + length);
	const end = field.indexOf(0);
	return end === -1 ? field : field.subarray(0, end);
}

// One ustar number field. Refuses the base-256 form (high bit set), which
// GNU tar writes for large values, and any text that is not octal.
function readOctal(
	header: Buffer,
	offset: number,
	length: number,
	shown: string,
	/** The field name for the reason, for example `size`. */
	field: string,
): number {
	const bytes = header.subarray(offset, offset + length);
	if (((bytes[0] ?? 0) & 0x80) !== 0) {
		throw new ArchiveRuleError(`The entry "${shown}" has a base-256 ${field}`);
	}
	const text = bytes.toString("latin1");
	if (!OCTAL_FIELD_PATTERN.test(text)) {
		throw new ArchiveRuleError(
			`The entry "${shown}" has a ${field} that is not octal`,
		);
	}
	return Number.parseInt(text, 8);
}

// The ustar checksum: the sum of all 512 header bytes, with the checksum
// field (offset 148, 8 bytes) read as 8 spaces (0x20).
function checksumOf(header: Buffer): number {
	return header.reduce(
		(sum, byte, index) => sum + (index >= 148 && index < 156 ? 0x20 : byte),
		0,
	);
}

function isAllZero(bytes: Buffer): boolean {
	return bytes.every((byte) => byte === 0);
}

// A text for a reason: at most SHOWN_PATH_LENGTH characters, and each
// character outside printable ASCII as "?". The row then holds no control byte.
function shownText(text: string): string {
	return text.slice(0, SHOWN_PATH_LENGTH).replace(/[^\x20-\x7e]/g, "?");
}
