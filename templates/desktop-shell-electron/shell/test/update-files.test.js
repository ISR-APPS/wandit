const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const {
	checkUpdateFileUrl,
	downloadFile,
	isNewerVersion,
	parseUpdateManifest,
	parseUpdaterPublicKey,
	verifyUpdateFile,
} = require("../src/update-files.js");
const { testDir } = require("../testing/support.js");

// The minisign public key text that the server stores for an app: base64 of a comment line
// and of base64("Ed" + 8-byte key id + raw key).
function minisignPublicKey(publicKey) {
	const raw = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
	const keyLine = Buffer.concat([Buffer.from("Ed"), Buffer.alloc(8, 7), raw]);
	const text = `untrusted comment: minisign public key: 0707070707070707\n${keyLine.toString("base64")}\n`;
	return Buffer.from(text).toString("base64");
}

// The signature that the server writes into the manifest for `file` and `version`.
// The message is a literal text, so a change of the message of the shell fails the test.
function sign(privateKey, file, version) {
	const hash = crypto
		.createHash("sha512")
		.update(fs.readFileSync(file))
		.digest("hex");
	const message = Buffer.from(
		`wandit-desktop-update-v1\n${version}\n${hash}\n`,
		"utf8",
	);
	return crypto.sign(null, message, privateKey).toString("base64");
}

test("the signature check accepts only the signed file, at the signed version, for the key of the app", async (context) => {
	const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
	const appKey = parseUpdaterPublicKey(minisignPublicKey(publicKey));
	const file = path.join(testDir(context), "setup.exe");
	fs.writeFileSync(file, "the update file");
	const signature = sign(privateKey, file, "1.0.7");
	const offer = { version: "1.0.7", notes: "", url: "", signature };

	await verifyUpdateFile(file, offer, appKey);

	const notValid = {
		message: "The signature of the update file is not valid.",
	};
	// A manifest that gives a higher version with the signature of an older build.
	await assert.rejects(
		verifyUpdateFile(file, { ...offer, version: "1.0.8" }, appKey),
		notValid,
	);
	const otherKey = crypto.generateKeyPairSync("ed25519").publicKey;
	await assert.rejects(
		verifyUpdateFile(
			file,
			offer,
			parseUpdaterPublicKey(minisignPublicKey(otherKey)),
		),
		notValid,
	);
	await assert.rejects(
		verifyUpdateFile(file, { ...offer, signature: "" }, appKey),
		notValid,
	);
	fs.appendFileSync(file, "!");
	await assert.rejects(verifyUpdateFile(file, offer, appKey), notValid);
});

test("the public key parser refuses a text that is not a minisign Ed25519 key", () => {
	const line = (bytes) =>
		Buffer.from(`untrusted comment: x\n${bytes.toString("base64")}\n`).toString(
			"base64",
		);
	const cases = [
		"",
		"not base64 of a key",
		// One line only.
		Buffer.from(Buffer.alloc(42).toString("base64")).toString("base64"),
		// A wrong algorithm mark.
		line(Buffer.concat([Buffer.from("ED"), Buffer.alloc(40)])),
		// A short key.
		line(Buffer.concat([Buffer.from("Ed"), Buffer.alloc(39)])),
	];
	for (const pubkey of cases) {
		assert.throws(() => parseUpdaterPublicKey(pubkey), pubkey);
	}
});

test("only a strictly higher version is newer", () => {
	const cases = [
		["1.0.8", "1.0.7", true],
		["1.0.10", "1.0.9", true],
		["1.1.0", "1.0.99", true],
		["2.0.0", "1.9.9", true],
		["1.0.7", "1.0.7", false],
		["1.0.6", "1.0.7", false],
		["0.9.9", "1.0.0", false],
		["1.0.8-beta", "1.0.7", false],
		["1.0", "1.0.7", false],
		["v1.0.8", "1.0.7", false],
	];
	for (const [candidate, installed, expected] of cases) {
		assert.equal(isNewerVersion(candidate, installed), expected, candidate);
	}
});

test("the manifest parser answers the entry of this system, or refuses the manifest", () => {
	const entry = { url: "https://updates.example/app.exe", signature: "c2ln" };
	const manifest = {
		version: "1.0.8",
		notes: "Fixes.",
		pub_date: "2026-11-04T15:30:12Z",
		platforms: { "windows-x86_64": entry, "windows-x86_64-nsis": entry },
	};
	assert.deepEqual(
		parseUpdateManifest(JSON.stringify(manifest), "windows-x86_64"),
		{ version: "1.0.8", notes: "Fixes.", ...entry },
	);
	const bad = [
		"<html>",
		"null",
		JSON.stringify({ ...manifest, version: 8 }),
		JSON.stringify({
			...manifest,
			platforms: { "windows-x86_64": { url: 1, signature: "c2ln" } },
		}),
	];
	for (const text of bad) {
		assert.throws(() => parseUpdateManifest(text, "windows-x86_64"), text);
	}
	// A Windows manifest holds no file for a Mac.
	assert.throws(
		() => parseUpdateManifest(JSON.stringify(manifest), "darwin-aarch64"),
		{
			message: "The update manifest has no file for this system.",
		},
	);
});

test("the update file must be on the https host of the manifest", () => {
	const manifestUrl = "https://updates.example/desktop/p1/latest.json";
	checkUpdateFileUrl(
		"https://updates.example/desktop/p1/builds/b/app.exe",
		manifestUrl,
	);
	const refused = [
		"http://updates.example/app.exe",
		"https://updates.example.evil.test/app.exe",
		"https://evil.test/updates.example/app.exe",
		"https://updates.example:8443/app.exe",
		"file:///C:/Windows/app.exe",
		"app.exe",
	];
	for (const url of refused) {
		assert.throws(() => checkUpdateFileUrl(url, manifestUrl), url);
	}
});

test("a download stops at the size cap and keeps no partial file", async (context) => {
	const server = http.createServer((request, response) => {
		if (request.url === "/moved") {
			response.writeHead(302, { location: "/file" }).end();
			return;
		}
		if (request.url === "/bad-redirect") {
			response.writeHead(302, { location: "http://[" }).end();
			return;
		}
		response.end(Buffer.alloc(5000, "x"));
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	context.after(() => server.close());
	const url = `http://127.0.0.1:${server.address().port}/moved`;
	const local = { get: http.get, requiredProtocol: "http:" };
	const file = path.join(testDir(context), "update.bin");

	await downloadFile(url, file, { ...local, maxBytes: 5000 });
	assert.equal(fs.statSync(file).size, 5000);

	fs.rmSync(file);
	await assert.rejects(downloadFile(url, file, { ...local, maxBytes: 4999 }), {
		message: "The download is larger than 4999 bytes.",
	});
	assert.equal(fs.existsSync(file), false);
	// A Location value that is not a URL fails the download. It does not stop the main process.
	await assert.rejects(
		downloadFile(url.replace("/moved", "/bad-redirect"), file, local),
		/sent a redirect that is not valid\.$/,
	);
	// The app passes no options, so a plain http URL never starts a request.
	await assert.rejects(downloadFile(url, file), /is not https:/);
});
