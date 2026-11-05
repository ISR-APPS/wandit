import { gunzipSync, gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { repackMacAppArchive } from "./macos-update-archive";

const BINARY = "stock-manager";
const ROOT = `${BINARY}.app`;

/** One raw ustar header as bsdtar writes it, plus the knobs of the refused cases. */
type RawEntry = {
	/** The name field. A folder name ends with "/". */
	name: string;
	/** The prefix field. Default empty. */
	prefix?: string;
	/** The typeflag character. Default "5" for a name that ends with "/", else "0". */
	type?: string;
	/** The file bytes. Default empty. */
	content?: Buffer;
	/** Default 0o755 for a folder, else 0o644. */
	mode?: number;
	/** The 8 bytes at offset 257. Default "ustar\0" and "00". */
	magic?: string;
	/** Added to the correct checksum, to make a broken header. */
	checksumError?: number;
};

function octal(value: number, digits: number): string {
	return value.toString(8).padStart(digits, "0");
}

// The field layout of bsdtar 3.5 (CRIT P4): owner 501 "mac", group 20
// "staff", a real mtime, and "NNNNNN \0" numbers.
function rawHeader(entry: RawEntry): Buffer {
	const header = Buffer.alloc(512);
	const content = entry.content ?? Buffer.alloc(0);
	const isFolder = entry.name.endsWith("/");
	header.write(entry.name, 0, 100, "utf8");
	header.write(`${octal(entry.mode ?? (isFolder ? 0o755 : 0o644), 6)} \0`, 100);
	header.write("000765 \0", 108);
	header.write("000024 \0", 116);
	header.write(`${octal(content.byteLength, 11)} `, 124);
	header.write("15273036160 ", 136);
	header.fill(" ", 148, 156);
	header.write(entry.type ?? (isFolder ? "5" : "0"), 156, "latin1");
	header.write(entry.magic ?? "ustar\u000000", 257, "latin1");
	header.write("mac", 265);
	header.write("staff", 297);
	header.write(entry.prefix ?? "", 345, 155, "utf8");
	const checksum =
		header.reduce((sum, byte) => sum + byte, 0) + (entry.checksumError ?? 0);
	header.write(`${octal(checksum, 6)}\0 `, 148, "latin1");
	return header;
}

function archive(
	entries: RawEntry[],
	afterEnd: Buffer = Buffer.alloc(0),
): Buffer {
	const blocks = entries.flatMap((entry) => {
		const content = entry.content ?? Buffer.alloc(0);
		return [
			rawHeader(entry),
			content,
			Buffer.alloc((512 - (content.byteLength % 512)) % 512),
		];
	});
	// Two zero blocks end the archive.
	return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024), afterEnd]));
}

const ROOT_FOLDER: RawEntry = { name: `${ROOT}/` };
const CONTENTS: RawEntry = { name: `${ROOT}/Contents/` };
const CODE_SIGNATURE: RawEntry = { name: `${ROOT}/Contents/_CodeSignature/` };
const MACOS: RawEntry = { name: `${ROOT}/Contents/MacOS/` };
const RESOURCES: RawEntry = { name: `${ROOT}/Contents/Resources/` };
// The input modes differ from the output modes: the server sets them.
const INFO_PLIST: RawEntry = {
	content: Buffer.from("<plist>Info</plist>"),
	mode: 0o666,
	name: `${ROOT}/Contents/Info.plist`,
};
// The prefix field holds the folders, so the parser must join it with the name.
const ICON: RawEntry = {
	content: Buffer.from("icns bytes"),
	name: "icon.icns",
	prefix: `${ROOT}/Contents/Resources`,
};
const EXECUTABLE: RawEntry = {
	content: Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x0c, 0x00, 0x00, 0x01]),
	mode: 0o711,
	name: `${ROOT}/Contents/MacOS/${BINARY}`,
};
const CODE_RESOURCES: RawEntry = {
	content: Buffer.from("<plist>seal</plist>"),
	name: `${ROOT}/Contents/_CodeSignature/CodeResources`,
};

/** The order of bsdtar `--format ustar` (CRIT P4): the root, the folders, then the files. */
const CI_LAYOUT: RawEntry[] = [
	ROOT_FOLDER,
	CONTENTS,
	CODE_SIGNATURE,
	MACOS,
	RESOURCES,
	INFO_PLIST,
	ICON,
	EXECUTABLE,
	CODE_RESOURCES,
];

const EXTRA_BYTES = Buffer.from("extra");

// The fields of the re-packed headers that the updater reads, with numbers parsed.
function readRepacked(gzipBytes: Buffer) {
	const tar = gunzipSync(gzipBytes);
	const entries: {
		path: string;
		type: string;
		mode: number;
		owner: string;
		mtime: number;
		content: Buffer;
	}[] = [];
	let offset = 0;
	while (tar.subarray(offset, offset + 512).some((byte) => byte !== 0)) {
		const header = tar.subarray(offset, offset + 512);
		const field = (start: number, length: number) =>
			header
				.subarray(start, start + length)
				.toString("latin1")
				.replace(/\0[\s\S]*$/, "");
		const prefix = field(345, 155);
		const size = Number.parseInt(field(124, 12), 8);
		entries.push({
			content: tar.subarray(offset + 512, offset + 512 + size),
			mode: Number.parseInt(field(100, 8), 8),
			mtime: Number.parseInt(field(136, 12), 8),
			owner: `${Number.parseInt(field(108, 8), 8)}:${Number.parseInt(field(116, 8), 8)}:${field(265, 32)}:${field(297, 32)}`,
			path: prefix === "" ? field(0, 100) : `${prefix}/${field(0, 100)}`,
			type: field(156, 1),
		});
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	return entries;
}

describe("repackMacAppArchive", () => {
	// The signed archive must hold the same app with server-set headers: the
	// updater applies the mode, so the binary needs 0755 to start.
	it("re-packs the CI layout with the same paths and bytes, fixed modes, and owner 0", () => {
		const result = repackMacAppArchive({
			binaryName: BINARY,
			gzipBytes: archive(CI_LAYOUT),
		});

		if (result.kind !== "ok") {
			throw new Error(`The CI layout was refused: ${result.reason}`);
		}
		const entries = readRepacked(result.gzipBytes);
		expect(entries.map(({ mode, path, type }) => [path, type, mode])).toEqual([
			[`${ROOT}/`, "5", 0o755],
			[`${ROOT}/Contents/`, "5", 0o755],
			[`${ROOT}/Contents/_CodeSignature/`, "5", 0o755],
			[`${ROOT}/Contents/MacOS/`, "5", 0o755],
			[`${ROOT}/Contents/Resources/`, "5", 0o755],
			[`${ROOT}/Contents/Info.plist`, "0", 0o644],
			[`${ROOT}/Contents/Resources/icon.icns`, "0", 0o644],
			[`${ROOT}/Contents/MacOS/${BINARY}`, "0", 0o755],
			[`${ROOT}/Contents/_CodeSignature/CodeResources`, "0", 0o644],
		]);
		expect(
			new Set(entries.map(({ mtime, owner }) => `${owner} ${mtime}`)),
		).toEqual(new Set(["0:0:: 0"]));
		expect(entries.slice(5).map(({ content }) => content)).toEqual(
			[INFO_PLIST, ICON, EXECUTABLE, CODE_RESOURCES].map(
				({ content }) => content,
			),
		);
	});

	// Each archive is the valid CI layout with one break. The updater unpacks
	// with no path guard, so each break must stop the build for its own rule.
	it.each<{
		name: string;
		entries: RawEntry[];
		afterEnd?: Buffer;
		reason: string;
	}>([
		{
			entries: [
				...CI_LAYOUT,
				{ content: EXTRA_BYTES, name: `${ROOT}/Contents/../../evil` },
			],
			name: "a .. segment",
			reason: 'has the name part "..", which breaks the name rule',
		},
		{
			entries: [
				...CI_LAYOUT,
				{ content: EXTRA_BYTES, name: `/${ROOT}/Contents/evil` },
			],
			name: "an absolute path",
			reason: `"/${ROOT}/Contents/evil" has the name part "", which breaks the name rule`,
		},
		{
			entries: [
				...CI_LAYOUT,
				{ name: `${ROOT}/Contents/Resources/link`, type: "2" },
			],
			name: "a symlink",
			reason: 'has type "2". Only files ("0") and folders ("5") are allowed',
		},
		{
			entries: [
				...CI_LAYOUT,
				{ name: `${ROOT}/Contents/Resources/link`, type: "1" },
			],
			name: "a hard link",
			reason: 'has type "1". Only files ("0") and folders ("5") are allowed',
		},
		{
			entries: [
				...CI_LAYOUT.slice(0, 6),
				{
					content: Buffer.from(`30 path=${ROOT}/Contents/evil\n`),
					name: "PaxHeader/icon.icns",
					type: "x",
				},
				...CI_LAYOUT.slice(6),
			],
			name: "a pax x header",
			reason: '"PaxHeader/icon.icns" has type "x"',
		},
		{
			entries: [
				...CI_LAYOUT.slice(0, 6),
				{
					content: Buffer.from(`${ROOT}/Contents/${"a".repeat(120)}`),
					name: "././@LongLink",
					type: "L",
				},
				...CI_LAYOUT.slice(6),
			],
			name: "a GNU L header",
			reason: '"././@LongLink" has type "L"',
		},
		{
			entries: [
				...CI_LAYOUT.slice(0, 5),
				{ ...INFO_PLIST, magic: "ustar  \0" },
				...CI_LAYOUT.slice(6),
			],
			name: "a GNU magic",
			reason: `"${ROOT}/Contents/Info.plist" is not a plain ustar header`,
		},
		{
			entries: [
				...CI_LAYOUT,
				{
					content: EXTRA_BYTES,
					name: `${ROOT}/Contents/Resources/café.icns`,
				},
			],
			name: "a non-ASCII byte in a name",
			reason: `"${ROOT}/Contents/Resources/caf??.icns" has a non-ASCII name`,
		},
		{
			entries: [
				...CI_LAYOUT,
				{
					content: EXTRA_BYTES,
					name: `${ROOT}/Contents/Resources/Stock Manager.icns`,
				},
			],
			name: "a segment with a space",
			reason:
				'has the name part "Stock Manager.icns", which breaks the name rule',
		},
		{
			entries: [{ name: "other.app/" }, ...CI_LAYOUT.slice(1)],
			name: "a root other than <binary>.app",
			reason: `The first entry "other.app/" is not the folder "${ROOT}/"`,
		},
		{
			entries: [...CI_LAYOUT, { name: `${ROOT}/Extra/` }],
			name: "an entry outside Contents/",
			reason: `"${ROOT}/Extra/" is outside "${ROOT}/Contents/"`,
		},
		{
			entries: [
				ROOT_FOLDER,
				CONTENTS,
				CODE_SIGNATURE,
				MACOS,
				INFO_PLIST,
				ICON,
				RESOURCES,
				EXECUTABLE,
				CODE_RESOURCES,
			],
			name: "an entry before its parent folder",
			reason: `"${ROOT}/Contents/Resources/icon.icns" comes before its parent folder`,
		},
		{
			entries: [
				...CI_LAYOUT.slice(0, 5),
				{ ...INFO_PLIST, checksumError: 1 },
				...CI_LAYOUT.slice(6),
			],
			name: "a bad checksum",
			reason: `"${ROOT}/Contents/Info.plist" has a wrong header checksum`,
		},
		{
			entries: CI_LAYOUT.filter((entry) => entry !== EXECUTABLE),
			name: "a missing Contents/MacOS/<binary>",
			reason: `The archive has no file "${ROOT}/Contents/MacOS/${BINARY}"`,
		},
		{
			entries: [
				...CI_LAYOUT,
				{ content: EXTRA_BYTES, name: `${ROOT}/Contents/MacOS/helper` },
			],
			name: "a second entry in Contents/MacOS/",
			reason: `"${ROOT}/Contents/MacOS/helper" is in Contents/MacOS/, which holds only the app binary`,
		},
		{
			entries: [
				...CI_LAYOUT,
				{ content: EXTRA_BYTES, name: `${ROOT}/Contents/info.plist` },
			],
			name: "a duplicate path that differs only in case",
			reason: `The archive holds "${ROOT}/Contents/info.plist" twice (case ignored)`,
		},
		{
			afterEnd: Buffer.from([0, 0, 1]),
			entries: CI_LAYOUT,
			name: "non-zero data after the end block",
			reason: "The archive holds data after the end block",
		},
	])("refuses $name", ({ afterEnd, entries, reason }) => {
		const result = repackMacAppArchive({
			binaryName: BINARY,
			gzipBytes: archive(entries, afterEnd),
		});

		expect(result).toEqual({
			kind: "invalid",
			reason: expect.stringContaining(reason),
		});
	});
});
