import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import {
	DesktopBuildInputError,
	type DesktopTauriConfig,
	writeDesktopBuildInput,
} from "./desktop-build-input";

const CONFIG: DesktopTauriConfig = {
	identifier: "app.wandit.p7b1e2d3c4a5b4c6d8e9f0a1b2c3d4e5f",
	mainBinaryName: "stock-manager",
	productName: "Stock Manager",
	updaterPublicKey: Buffer.from("untrusted comment: key\nRWQ=\n").toString(
		"base64",
	),
	updatesEndpoint:
		"https://updates.wandit.test/desktop/7b1e2d3c-4a5b-4c6d-8e9f-0a1b2c3d4e5f/latest.json",
	version: "1.0.3",
};

// 120 bytes: the name needs the ustar prefix field.
const LONG_DIST_PATH = `assets/${"a".repeat(60)}/${"b".repeat(40)}.js`;

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { force: true, recursive: true });
	}
});

// A shell folder with sources, a binary icon, and the output folders of a
// local build, which the archive must skip.
function shellFolder(): string {
	const dir = mkdtempSync(join(tmpdir(), "desktop-shell-spec-"));
	tempDirs.push(dir);
	mkdirSync(join(dir, "src"));
	mkdirSync(join(dir, "icons"));
	mkdirSync(join(dir, "target", "release"), { recursive: true });
	mkdirSync(join(dir, "gen", "schemas"), { recursive: true });
	writeFileSync(join(dir, "Cargo.toml"), "[package]\n");
	writeFileSync(join(dir, "src", "main.rs"), "fn main() {}\n");
	writeFileSync(join(dir, "icons", "icon.png"), Buffer.from([0x89, 0, 1, 2]));
	writeFileSync(join(dir, "target", "release", "app.exe"), "MZ");
	writeFileSync(join(dir, "gen", "schemas", "x.json"), "{}");
	return dir;
}

type ReadEntry = {
	path: string;
	type: string;
	content: Buffer;
};

// A minimal ustar reader that also checks each header checksum.
function readTarGz(archive: Buffer): ReadEntry[] {
	const tar = gunzipSync(archive);
	const text = (header: Buffer, start: number, length: number): string => {
		const field = header.subarray(start, start + length);
		const end = field.indexOf(0);
		return field.subarray(0, end === -1 ? length : end).toString("utf8");
	};
	const entries: ReadEntry[] = [];
	let offset = 0;
	while (offset + 512 <= tar.length) {
		const header = tar.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) {
			break;
		}
		const withBlankSum = Buffer.from(header);
		withBlankSum.fill(" ", 148, 156);
		expect(Number.parseInt(text(header, 148, 8), 8)).toBe(
			withBlankSum.reduce((sum, byte) => sum + byte, 0),
		);
		expect(text(header, 257, 6)).toBe("ustar");
		const size = Number.parseInt(text(header, 124, 12), 8);
		const prefix = text(header, 345, 155);
		const name = text(header, 0, 100);
		entries.push({
			content: tar.subarray(offset + 512, offset + 512 + size),
			path: prefix === "" ? name : `${prefix}/${name}`,
			type: text(header, 156, 1),
		});
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	return entries;
}

describe("writeDesktopBuildInput", () => {
	it("writes the shell without target/ and gen/, the config, dist/, and migrations/ in a fixed order", async () => {
		const input = {
			config: CONFIG,
			engine: "tauri" as const,
			dist: [
				{
					content: new TextEncoder().encode("<html></html>"),
					path: "index.html",
				},
				{ content: new TextEncoder().encode("x()"), path: LONG_DIST_PATH },
			],
			migrations: [
				{
					content: new TextEncoder().encode("CREATE TABLE t (id INTEGER);"),
					path: "0001_init.sql",
				},
			],
			shellDir: shellFolder(),
		};

		const archive = await writeDesktopBuildInput(input);
		const entries = readTarGz(archive);

		expect(entries.map((entry) => entry.path)).toEqual([
			`dist/${LONG_DIST_PATH}`,
			"dist/index.html",
			"migrations/",
			"migrations/0001_init.sql",
			"src-tauri/Cargo.toml",
			"src-tauri/icons/icon.png",
			"src-tauri/src/main.rs",
			"src-tauri/tauri.desktop.json",
		]);
		expect(entries.find((entry) => entry.path === "migrations/")?.type).toBe(
			"5",
		);
		expect(
			entries
				.find((entry) => entry.path === "src-tauri/icons/icon.png")
				?.content.equals(Buffer.from([0x89, 0, 1, 2])),
		).toBe(true);
		const config = entries.find(
			(entry) => entry.path === "src-tauri/tauri.desktop.json",
		);
		expect(JSON.parse(config?.content.toString("utf8") ?? "")).toEqual({
			identifier: CONFIG.identifier,
			mainBinaryName: CONFIG.mainBinaryName,
			plugins: {
				updater: {
					endpoints: [CONFIG.updatesEndpoint],
					pubkey: CONFIG.updaterPublicKey,
				},
			},
			productName: CONFIG.productName,
			version: CONFIG.version,
		});
	});

	// build-electron.yml expects `shell/` and reads `shell/wandit.desktop.json`.
	// A local `npm ci` or build leaves node_modules/ and release/ in the folder.
	it("writes an Electron input under shell/ without node_modules/ and release/, with the same config JSON", async () => {
		const shellDir = mkdtempSync(join(tmpdir(), "desktop-shell-spec-"));
		tempDirs.push(shellDir);
		mkdirSync(join(shellDir, "src"));
		mkdirSync(join(shellDir, "node_modules", "electron"), { recursive: true });
		mkdirSync(join(shellDir, "release"));
		writeFileSync(join(shellDir, "package.json"), "{}\n");
		writeFileSync(join(shellDir, "src", "main.cjs"), "'use strict';\n");
		writeFileSync(join(shellDir, "node_modules", "electron", "index.js"), "");
		writeFileSync(join(shellDir, "release", "app-1.0.1.dmg"), "koly");
		const dist = [
			{
				content: new TextEncoder().encode("<html></html>"),
				path: "index.html",
			},
		];

		const entries = readTarGz(
			await writeDesktopBuildInput({
				config: CONFIG,
				dist,
				engine: "electron",
				migrations: [],
				shellDir,
			}),
		);
		const tauriEntries = readTarGz(
			await writeDesktopBuildInput({
				config: CONFIG,
				dist,
				engine: "tauri",
				migrations: [],
				shellDir: shellFolder(),
			}),
		);

		expect(entries.map((entry) => entry.path)).toEqual([
			"dist/index.html",
			"migrations/",
			"shell/package.json",
			"shell/src/main.cjs",
			"shell/wandit.desktop.json",
		]);
		expect(
			entries
				.find((entry) => entry.path === "shell/wandit.desktop.json")
				?.content.toString("utf8"),
		).toBe(
			tauriEntries
				.find((entry) => entry.path === "src-tauri/tauri.desktop.json")
				?.content.toString("utf8"),
		);
	});

	it.each([
		["an absolute path", ["/etc/passwd"]],
		["a parent segment", ["assets/../../escape.js"]],
		["a backslash", ["assets\\index.js"]],
		["a NUL character", ["index\u0000.html"]],
		["an empty segment", ["assets//index.js"]],
		["a name above 100 bytes", [`assets/${"c".repeat(101)}.js`]],
		["a character outside ASCII", ["assets/café.png"]],
		["a character that Windows refuses", ["assets/a:b.png"]],
		["a Windows device name", ["assets/con.js"]],
		["a dot at the end of a name", ["assets/index.js."]],
		["two paths that differ only in case", ["Index.html", "index.html"]],
	])("refuses dist paths with %s", async (_label, paths) => {
		await expect(
			writeDesktopBuildInput({
				config: CONFIG,
				dist: paths.map((path) => ({ content: new Uint8Array([1]), path })),
				engine: "tauri",
				migrations: [],
				shellDir: shellFolder(),
			}),
		).rejects.toBeInstanceOf(DesktopBuildInputError);
	});
});
