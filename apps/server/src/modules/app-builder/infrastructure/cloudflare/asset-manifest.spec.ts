import { describe, expect, it } from "vitest";

import { assetManifest } from "./asset-manifest";

const PROJECT_A = "2b8e1d7c-4f7a-4a51-9f4e-0f7d6c1b2a3e";
const PROJECT_B = "9c1f0e2d-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
const bytes = (text: string) => new TextEncoder().encode(text);

describe("assetManifest", () => {
	it("gives the same file two hashes under two projects", () => {
		const file = { content: bytes("body { color: red }"), path: "/app.css" };

		const a = assetManifest(PROJECT_A, [file]).manifest["/app.css"];
		const b = assetManifest(PROJECT_B, [file]).manifest["/app.css"];

		expect(a?.hash).toMatch(/^[0-9a-f]{32}$/);
		expect(b?.hash).toMatch(/^[0-9a-f]{32}$/);
		expect(a?.hash).not.toBe(b?.hash);
	});

	it("measures the size in bytes and adds the leading slash", () => {
		// "é" is two bytes in UTF-8, so the size is 7, not 6.
		const content = bytes("héllo!");

		const { byHash, manifest } = assetManifest(PROJECT_A, [
			{ content, path: "index.html" },
		]);

		const entry = manifest["/index.html"];
		expect(entry?.size).toBe(7);
		expect(byHash.get(entry?.hash ?? "")).toEqual({
			content,
			path: "/index.html",
		});
	});

	it("gives the same bytes two hashes under two content types", () => {
		const { manifest } = assetManifest(PROJECT_A, [
			{ content: bytes(""), path: "/app.js" },
			{ content: bytes(""), path: "/app.css" },
		]);

		expect(manifest["/app.js"]?.hash).not.toBe(manifest["/app.css"]?.hash);
	});

	it("keeps both paths of two equal files and one byHash entry", () => {
		const { byHash, manifest } = assetManifest(PROJECT_A, [
			{ content: bytes("same"), path: "/a.txt" },
			{ content: bytes("same"), path: "/b.txt" },
		]);

		expect(manifest["/a.txt"]?.hash).toBe(manifest["/b.txt"]?.hash);
		expect(byHash.size).toBe(1);
	});

	it.each([
		"/../secret.txt",
		"assets/../x.js",
		"/assets\\x.js",
		"",
	])("refuses the path %j", (path) => {
		expect(() =>
			assetManifest(PROJECT_A, [{ content: bytes("x"), path }]),
		).toThrow("is not allowed");
	});

	it("refuses a duplicate path after the slash is added", () => {
		expect(() =>
			assetManifest(PROJECT_A, [
				{ content: bytes("1"), path: "index.html" },
				{ content: bytes("2"), path: "/index.html" },
			]),
		).toThrow("appears twice");
	});

	it("accepts two dots inside a file name", () => {
		expect(
			assetManifest(PROJECT_A, [{ content: bytes("x"), path: "/a..b.js" }])
				.manifest["/a..b.js"],
		).toBeDefined();
	});
});
