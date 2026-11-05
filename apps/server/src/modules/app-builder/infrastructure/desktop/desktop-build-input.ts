/**
 * Writes `desktop-input.tar.gz`, the build input of the desktop CI
 * (docs/v2/desktop-apps.md sections 3 and 9). The `desktop-build` task calls
 * `writeDesktopBuildInput` after the gate passes. It reads the trusted shell
 * folder of the worker and gzips a small ustar archive with node:zlib.
 * `macos-update-archive.ts` uses the same writer, `packTarGzip`.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { desktopProductNameSchema } from "@wandit/contracts";
import { z } from "zod";

/** One file of the input, with its path inside `dist/` or `migrations/`. */
export type DesktopBuildInputFile = {
	/** Relative path with `/` separators, for example `assets/index.js`. Untrusted: the sandbox made it. */
	path: string;
	content: Uint8Array;
};

/** The values of `src-tauri/tauri.desktop.json` (section 3). */
export type DesktopTauriConfig = {
	/** `desktop_builds.product_name`: the window title and the install folder. */
	productName: string;
	/** `desktop_apps.binary_name`: the exe name. */
	mainBinaryName: string;
	/** `1.0.<release number>`. The updater compares it with the manifest version. */
	version: string;
	/** `app.wandit.p<project id hex>`, from `desktopIdentifier`. */
	identifier: string;
	/** `desktop_apps.updater_public_key`: base64 of the minisign public key text. */
	updaterPublicKey: string;
	/** https URL of the manifest of the build platform on the updates host: `latest.json` or `latest-macos.json`. */
	updatesEndpoint: string;
};

/**
 * A dist or migration path that the archive refuses: absolute, `..`, not
 * printable ASCII, a name that Windows cannot store, too long for ustar, or
 * a path that is in the input two times (case ignored). The task maps it to
 * `output_invalid`. `repackMacAppArchive` maps it to an invalid archive.
 */
export class DesktopBuildInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DesktopBuildInputError";
	}
}

// Security: the API wrote these values after its own checks. The parse here
// keeps any other value out of the file that the CI build merges.
const tauriDesktopConfigSchema = z.object({
	identifier: z.string().regex(/^app\.wandit\.p[0-9a-f]{32}$/),
	mainBinaryName: z
		.string()
		.max(40)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	productName: desktopProductNameSchema,
	updaterPublicKey: z.base64(),
	updatesEndpoint: z.url({ protocol: /^https$/ }),
	version: z.string().regex(/^1\.0\.[1-9]\d{0,4}$/),
});

// tauri-build writes these folders in a local build of the shell. They are
// not shell sources, so CI never gets them.
const SKIPPED_SHELL_FOLDERS = new Set(["target", "gen"]);

/** Size of one tar header and of one content block. */
const TAR_BLOCK_BYTES = 512;
// The two ustar path fields: the file name and the folder prefix, in bytes.
const USTAR_NAME_BYTES = 100;
const USTAR_PREFIX_BYTES = 155;

/**
 * Answers the gzip bytes of the build input: `src-tauri/` from `shellDir`
 * (without `target/` and `gen/`), `src-tauri/tauri.desktop.json`, `dist/`,
 * and `migrations/`. The order and the headers are fixed, so the same
 * input gives the same bytes. Throws `DesktopBuildInputError` for a bad path.
 */
export async function writeDesktopBuildInput(input: {
	/** Absolute path of the trusted `src-tauri` folder in the worker image. */
	shellDir: string;
	config: DesktopTauriConfig;
	/** The checked frontend files. */
	dist: DesktopBuildInputFile[];
	/** The checked migration files, by file name. */
	migrations: DesktopBuildInputFile[];
}): Promise<Buffer> {
	const shellFiles = await readShellFiles(input.shellDir, "");
	const entries: TarEntry[] = [
		...shellFiles.map((file) => fileEntry("src-tauri", file)),
		{
			content: new TextEncoder().encode(tauriDesktopConfigJson(input.config)),
			path: "src-tauri/tauri.desktop.json",
			type: "file",
		},
		...input.dist.map((file) => fileEntry("dist", file)),
		// build.rs reads `../migrations` and fails on a missing folder, so the
		// folder exists also when it holds no file.
		{ content: new Uint8Array(), path: "migrations/", type: "folder" },
		...input.migrations.map((file) => fileEntry("migrations", file)),
	];
	// Windows folders ignore case: `A.js` and `a.js` are one file there, and
	// the second one replaces the first.
	const seen = new Set<string>();
	for (const entry of entries) {
		const pathKey = entry.path.toLowerCase();
		if (seen.has(pathKey)) {
			throw new DesktopBuildInputError(
				`The build input holds ${entry.path} twice`,
			);
		}
		seen.add(pathKey);
	}
	entries.sort((a, b) => (a.path < b.path ? -1 : 1));
	return packTarGzip(entries);
}

/**
 * Gzip bytes of a ustar archive of `entries`, in the given order. Throws
 * DesktopBuildInputError for a path too long for ustar.
 */
export function packTarGzip(entries: TarEntry[]): Buffer {
	const blocks: Uint8Array[] = [];
	for (const entry of entries) {
		blocks.push(tarHeader(entry));
		if (entry.content.byteLength > 0) {
			blocks.push(entry.content);
			const padding =
				(TAR_BLOCK_BYTES - (entry.content.byteLength % TAR_BLOCK_BYTES)) %
				TAR_BLOCK_BYTES;
			blocks.push(new Uint8Array(padding));
		}
	}
	// Two zero blocks end a tar archive.
	blocks.push(new Uint8Array(TAR_BLOCK_BYTES * 2));
	return gzipSync(Buffer.concat(blocks));
}

/** The JSON text of `src-tauri/tauri.desktop.json`, with only the section 3 keys. */
function tauriDesktopConfigJson(config: DesktopTauriConfig): string {
	const checked = tauriDesktopConfigSchema.parse(config);
	return `${JSON.stringify(
		{
			identifier: checked.identifier,
			mainBinaryName: checked.mainBinaryName,
			plugins: {
				updater: {
					endpoints: [checked.updatesEndpoint],
					pubkey: checked.updaterPublicKey,
				},
			},
			productName: checked.productName,
			version: checked.version,
		},
		null,
		2,
	)}\n`;
}

/** One entry of a ustar archive that `packTarGzip` writes. */
export type TarEntry = {
	/** Full path in the archive. A folder path ends with `/`. */
	path: string;
	/** `executable`: a regular file with mode 0755, for the macOS app binary. */
	type: "file" | "executable" | "folder";
	/** The file bytes. Empty for a folder. */
	content: Uint8Array;
};

function fileEntry(folder: string, file: DesktopBuildInputFile): TarEntry {
	assertSafeRelativePath(file.path);
	return {
		content: file.content,
		path: `${folder}/${file.path}`,
		type: "file",
	};
}

// Windows tar.exe reads a ustar name in the ANSI code page, so a byte
// outside printable ASCII gives another name. NUL is a control character.
// Windows cannot store `<>:"|?*` in a name. Windows tar reads `\` as a
// folder separator.
const WINDOWS_UNSAFE_CHARACTER = /[^\x20-\x7e]|[<>:"|?*\\]/;
// A device name (`con`, `con.js`) opens the device on Windows. Windows
// removes a dot or a space at the end of a name, so the name changes.
const WINDOWS_UNSAFE_SEGMENT =
	/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)|[. ]$/i;

// Security: CI extracts the archive on Windows. Only plain relative paths
// pass, so no entry can land outside its folder, and each name arrives
// as it is.
function assertSafeRelativePath(path: string): void {
	if (
		WINDOWS_UNSAFE_CHARACTER.test(path) ||
		path
			.split("/")
			.some(
				(segment) =>
					segment === "" ||
					segment === "." ||
					segment === ".." ||
					WINDOWS_UNSAFE_SEGMENT.test(segment),
			)
	) {
		throw new DesktopBuildInputError(
			`The build input refuses the path ${JSON.stringify(path.slice(0, 200))}`,
		);
	}
}

// The regular files of the trusted shell folder, with paths relative to it.
async function readShellFiles(
	dir: string,
	relativeDir: string,
): Promise<DesktopBuildInputFile[]> {
	const files: DesktopBuildInputFile[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const relativePath =
			relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`;
		if (entry.isDirectory()) {
			if (relativeDir === "" && SKIPPED_SHELL_FOLDERS.has(entry.name)) {
				continue;
			}
			files.push(
				...(await readShellFiles(join(dir, entry.name), relativePath)),
			);
		} else if (entry.isFile()) {
			files.push({
				content: await readFile(join(dir, entry.name)),
				path: relativePath,
			});
		} else {
			// A symlink in the trusted folder is a deploy error. CI must not get it.
			throw new Error(
				`The desktop shell holds ${relativePath}, which is not a file or a folder`,
			);
		}
	}
	return files;
}

// One 512-byte ustar header. Mode 0644 for a file and 0755 for an executable
// or a folder, owner 0, and time 0, so the bytes never depend on the worker.
// The unpack of the macOS updater applies the mode.
function tarHeader(entry: TarEntry): Uint8Array {
	const header = Buffer.alloc(TAR_BLOCK_BYTES);
	const { name, prefix } = splitUstarPath(entry.path);
	// Field offsets and lengths of the ustar format, in bytes.
	header.write(name, 0, USTAR_NAME_BYTES, "utf8");
	writeOctal(header, 100, 8, entry.type === "file" ? 0o644 : 0o755);
	writeOctal(header, 108, 8, 0);
	writeOctal(header, 116, 8, 0);
	writeOctal(header, 124, 12, entry.content.byteLength);
	writeOctal(header, 136, 12, 0);
	// The checksum counts its own field as 8 spaces.
	header.fill(" ", 148, 156);
	header.write(entry.type === "folder" ? "5" : "0", 156, 1, "ascii");
	header.write("ustar\u000000", 257, 8, "ascii");
	header.write(prefix, 345, USTAR_PREFIX_BYTES, "utf8");
	const checksum = header.reduce((sum, byte) => sum + byte, 0);
	header.write(
		`${checksum.toString(8).padStart(6, "0")}\u0000 `,
		148,
		8,
		"ascii",
	);
	return header;
}

// A NUL-ended octal number that fills `length` bytes.
function writeOctal(
	header: Buffer,
	offset: number,
	length: number,
	value: number,
): void {
	header.write(
		`${value.toString(8).padStart(length - 1, "0")}\u0000`,
		offset,
		length,
		"ascii",
	);
}

// A path above 100 bytes goes into the prefix field (folders) and the name
// field (the rest), split at a `/`.
function splitUstarPath(path: string): { name: string; prefix: string } {
	if (Buffer.byteLength(path) <= USTAR_NAME_BYTES) {
		return { name: path, prefix: "" };
	}
	for (
		let slash = path.indexOf("/");
		slash !== -1;
		slash = path.indexOf("/", slash + 1)
	) {
		const prefix = path.slice(0, slash);
		const name = path.slice(slash + 1);
		if (
			Buffer.byteLength(prefix) <= USTAR_PREFIX_BYTES &&
			Buffer.byteLength(name) <= USTAR_NAME_BYTES &&
			name !== ""
		) {
			return { name, prefix };
		}
	}
	throw new DesktopBuildInputError(
		`The path ${JSON.stringify(path.slice(0, 200))} is too long for the build input`,
	);
}
