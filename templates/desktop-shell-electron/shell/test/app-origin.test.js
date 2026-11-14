const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const {
	isAppUrl,
	isLocalRequestUrl,
	resolveDistFile,
} = require("../src/app-origin.js");
const { parseDesktopConfig } = require("../src/config.js");
const { parseBatchInput, parseStatementInput } = require("../src/input.js");
const { dataBaseDir } = require("../src/paths.js");

test("the navigation lock allows only the app origin", () => {
	const cases = [
		["app://app/index.html", true],
		["app://app/orders?id=3#top", true],
		["app://app:8080/", false],
		["app://user@app/", false],
		["app://app.example.com/", false],
		["app://evil/index.html", false],
		["apps://app/", false],
		["https://app/", false],
		["http://localhost:5173/", false],
		["file:///C:/Windows/win.ini", false],
		["javascript:alert(1)", false],
		["about:blank", false],
		["data:text/html,<script>1</script>", false],
		["not a url", false],
	];
	for (const [url, allowed] of cases) {
		assert.equal(isAppUrl(url), allowed, url);
	}
});

test("the network lock cancels every request that leaves the app", () => {
	const cases = [
		["app://app/assets/index.js", true],
		["blob:app://app/0b1c", true],
		["data:image/png;base64,AAAA", true],
		["https://example.com/pixel.png", false],
		["http://127.0.0.1:8080/", false],
		["wss://example.com/socket", false],
		["file:///etc/passwd", false],
		["ftp://example.com/a", false],
		["//example.com/a", false],
	];
	for (const [url, isLocal] of cases) {
		assert.equal(isLocalRequestUrl(url), isLocal, url);
	}
});

test("the path guard answers only a file inside the dist folder", () => {
	const dist = "/app/dist";
	assert.equal(
		resolveDistFile(dist, "/assets/a%20b.js"),
		"/app/dist/assets/a b.js",
	);
	assert.equal(resolveDistFile(dist, "/"), "/app/dist/");
	// A path that goes up and comes back stays inside.
	assert.equal(
		resolveDistFile(dist, "/a/../index.html"),
		"/app/dist/index.html",
	);
	const refused = [
		"/../wandit.desktop.json",
		"/%2e%2e/src/main.js",
		"/..%2f..%2fetc/passwd",
		"/assets/../../migrations/0001_init.sql",
		// The sibling folder `dist-other` starts with the same text.
		"/../dist-other/a.js",
		"/a%00.js",
		"/%E0%A4%A",
	];
	for (const urlPath of refused) {
		assert.equal(resolveDistFile(dist, urlPath), null, urlPath);
	}
	// Windows also reads `\` as a separator.
	const windowsDist = "C:\\app\\dist";
	assert.equal(
		resolveDistFile(windowsDist, "/assets/a.js", path.win32),
		"C:\\app\\dist\\assets\\a.js",
	);
	for (const urlPath of [
		"/..%5C..%5CWindows%5Cwin.ini",
		"/%5C..%5Csrc%5Cmain.js",
	]) {
		assert.equal(
			resolveDistFile(windowsDist, urlPath, path.win32),
			null,
			urlPath,
		);
	}
});

test("the command input check refuses each value that is not a param", () => {
	assert.deepEqual(
		parseStatementInput({ sql: "SELECT ?", params: [null, true, 1.5, "a"] }),
		{
			sql: "SELECT ?",
			params: [null, true, 1.5, "a"],
		},
	);
	assert.deepEqual(parseStatementInput({ sql: "SELECT 1" }), {
		sql: "SELECT 1",
		params: [],
	});
	const cases = [
		[null, "invalid_input"],
		["SELECT 1", "invalid_input"],
		[{ sql: 1 }, "invalid_input"],
		[{ sql: "SELECT 1", params: "x" }, "invalid_input"],
		[{ sql: "SELECT ?", params: [[1]] }, "invalid_input"],
		[{ sql: "SELECT ?", params: [{ a: 1 }] }, "invalid_input"],
		[{ sql: "SELECT ?", params: [undefined] }, "invalid_input"],
		[{ sql: "SELECT ?", params: [10n] }, "invalid_input"],
		[{ sql: "SELECT ?", params: [Number.NaN] }, "unsupported_value"],
		[
			{ sql: "SELECT ?", params: [Number.POSITIVE_INFINITY] },
			"unsupported_value",
		],
	];
	for (const [input, code] of cases) {
		assert.throws(() => parseStatementInput(input), { code }, String(input));
	}
	assert.throws(
		() =>
			parseBatchInput({
				statements: [{ sql: "SELECT 1" }, { sql: "SELECT ?", params: [{}] }],
			}),
		{ code: "invalid_input", message: /^Statement 2: / },
	);
	assert.throws(() => parseBatchInput({ statements: "SELECT 1" }), {
		code: "invalid_input",
	});
});

test("the data folder is the folder of the Tauri shell, and the app id cannot leave it", () => {
	const identifier = "app.wandit.p0123abc";
	assert.equal(
		dataBaseDir(
			{
				platform: "win32",
				localAppData: "C:\\Users\\u\\AppData\\Local",
				homeDir: "C:\\Users\\u",
			},
			identifier,
		),
		"C:\\Users\\u\\AppData\\Local\\app.wandit.p0123abc",
	);
	assert.equal(
		dataBaseDir(
			{ platform: "darwin", localAppData: undefined, homeDir: "/Users/u" },
			identifier,
		),
		"/Users/u/Library/Application Support/app.wandit.p0123abc",
	);
	const config = (overrides) =>
		JSON.stringify({
			productName: "Gestion Café",
			mainBinaryName: "gestion-cafe",
			version: "1.0.3",
			identifier,
			plugins: {
				updater: {
					pubkey: "a2V5",
					endpoints: ["https://updates.example/latest.json"],
				},
			},
			...overrides,
		});
	assert.equal(parseDesktopConfig(config({})).identifier, identifier);
	const bad = [
		{ identifier: "../../evil" },
		{ identifier: "app/evil" },
		{ identifier: "app..evil\\x" },
		{ mainBinaryName: "../evil" },
		{ mainBinaryName: "Gestion Café" },
		{ version: "1.0" },
		{
			plugins: {
				updater: {
					pubkey: "a2V5",
					endpoints: ["http://updates.example/latest.json"],
				},
			},
		},
		{ plugins: {} },
	];
	for (const overrides of bad) {
		assert.throws(
			() => parseDesktopConfig(config(overrides)),
			JSON.stringify(overrides),
		);
	}
});
