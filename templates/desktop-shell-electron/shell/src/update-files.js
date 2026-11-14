/**
 * The checks of an update before it installs (docs/v2/desktop-apps.md, section 10):
 * the manifest, the version rule, the download, and the `wandit-ed25519-v1` signature.
 * updater.js calls it from the main process. It uses node:https and node:crypto, and it
 * has no Electron import. The server signs with the same message text
 * (updater-signature.ts of the API).
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const { pipeline } = require("node:stream/promises");
const { VERSION_PATTERN } = require("./config.js");

/**
 * @typedef {object} UpdateOffer
 * @property {string} version The version of the update, from the manifest.
 * @property {string} notes The release notes. Empty when the manifest has none.
 * @property {string} url The https URL of the update file: the setup exe, or the disk image.
 * @property {string} signature Base64 of the 64-byte Ed25519 signature of the update file.
 */

/** Line 1 of the signed message. It keeps this signature apart from every other use of the key. */
const SIGNATURE_MESSAGE_PREFIX = "wandit-desktop-update-v1";
/** Bytes of a minisign public key: `Ed`, an 8-byte key id, and the 32-byte Ed25519 key. */
const MINISIGN_KEY_BYTES = 42;
/** The 32-byte key starts after `Ed` and the 8-byte key id. */
const MINISIGN_KEY_OFFSET = 10;
/** The fixed DER bytes in front of a raw Ed25519 public key (RFC 8410). */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
/** Bytes of an Ed25519 signature. */
const SIGNATURE_BYTES = 64;
/** Largest update manifest, in bytes. A real manifest is below 2 KB. */
const MAX_MANIFEST_BYTES = 1_000_000;
/** Largest update file, in bytes: 300 MB, the same cap as the build task of the server. */
const MAX_UPDATE_BYTES = 300 * 1024 * 1024;
/** A request ends after this time with no byte, in milliseconds. */
const REQUEST_IDLE_LIMIT_MS = 30_000;
/** Most redirects of one request. A move of the updates host needs one. */
const MAX_REDIRECTS = 5;

/**
 * The manifest key of the running system. Throws on a system that Wandit does not build for.
 * @param {string} platform `process.platform`.
 * @param {string} arch `process.arch`.
 */
function updatePlatformKey(platform, arch) {
	if (platform === "win32" && arch === "x64") {
		return "windows-x86_64";
	}
	if (platform === "darwin" && arch === "arm64") {
		return "darwin-aarch64";
	}
	throw new Error(`No update exists for ${platform} ${arch}.`);
}

/**
 * Reads the raw Ed25519 key of the app from its minisign public key text.
 * Throws an Error when the text is not such a key.
 * @param {string} pubkey `plugins.updater.pubkey` of wandit.desktop.json: base64 of a comment
 *   line and of a second line with base64("Ed" + key id + key).
 * @returns {crypto.KeyObject}
 */
function parseUpdaterPublicKey(pubkey) {
	const keyLine = Buffer.from(pubkey, "base64").toString("utf8").split("\n")[1];
	const bytes = Buffer.from(keyLine ?? "", "base64");
	const isEd25519Key =
		bytes.length === MINISIGN_KEY_BYTES &&
		bytes.subarray(0, 2).toString("latin1") === "Ed";
	if (!isEd25519Key) {
		throw new Error("The updater public key of this app is not valid.");
	}
	const raw = bytes.subarray(MINISIGN_KEY_OFFSET, MINISIGN_KEY_BYTES);
	return crypto.createPublicKey({
		key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
		format: "der",
		type: "spki",
	});
}

// The message that the server signs for one update file. It holds the version, so an older
// signed file never passes as a newer version. `sha512Hex` is lowercase hex.
function updateSignatureMessage(version, sha512Hex) {
	return Buffer.from(
		`${SIGNATURE_MESSAGE_PREFIX}\n${version}\n${sha512Hex}\n`,
		"utf8",
	);
}

/**
 * Checks the signature of a downloaded update file. Rejects with an Error when the
 * signature does not match the file, the version, and the key of this app.
 * @param {string} file Path of the downloaded file.
 * @param {UpdateOffer} offer The manifest entry that named the file.
 * @param {crypto.KeyObject} publicKey The key of `parseUpdaterPublicKey`.
 */
async function verifyUpdateFile(file, offer, publicKey) {
	const hash = crypto.createHash("sha512");
	await pipeline(fs.createReadStream(file), hash);
	const message = updateSignatureMessage(offer.version, hash.digest("hex"));
	const signature = Buffer.from(offer.signature, "base64");
	const isValid =
		signature.length === SIGNATURE_BYTES &&
		crypto.verify(null, message, publicKey, signature);
	if (!isValid) {
		throw new Error("The signature of the update file is not valid.");
	}
}

/**
 * The version rule of section 10: true only when `candidate` is strictly higher than
 * `installed`. A text that is not `N.N.N` is never newer.
 * @param {string} candidate The version of the manifest.
 * @param {string} installed The version of the running app.
 */
function isNewerVersion(candidate, installed) {
	if (!VERSION_PATTERN.test(candidate) || !VERSION_PATTERN.test(installed)) {
		return false;
	}
	const next = candidate.split(".").map(Number);
	const current = installed.split(".").map(Number);
	for (let part = 0; part < next.length; part++) {
		if (next[part] !== current[part]) {
			return next[part] > current[part];
		}
	}
	return false;
}

/**
 * Reads the entry of the running system from the manifest text. Throws an Error when the
 * manifest is not valid, or when it has no entry for this system.
 * @param {string} text The body of the manifest answer. It is untrusted until the signature check.
 * @param {string} platformKey A value of `updatePlatformKey`.
 * @returns {UpdateOffer}
 */
function parseUpdateManifest(text, platformKey) {
	let manifest;
	try {
		manifest = JSON.parse(text);
	} catch (error) {
		throw new Error("The update manifest is not JSON.", { cause: error });
	}
	const version = manifest?.version;
	if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
		throw new Error("The update manifest has no valid version.");
	}
	const entry = manifest.platforms?.[platformKey];
	if (typeof entry?.url !== "string" || typeof entry?.signature !== "string") {
		throw new Error("The update manifest has no file for this system.");
	}
	const notes = typeof manifest.notes === "string" ? manifest.notes : "";
	return { version, notes, url: entry.url, signature: entry.signature };
}

/**
 * Security: the update file must come over https from the host that answered the manifest.
 * Throws an Error for every other URL.
 * @param {string} fileUrl The `url` of the manifest entry.
 * @param {string} manifestUrl The URL that answered the manifest, after its redirects.
 */
function checkUpdateFileUrl(fileUrl, manifestUrl) {
	let url;
	try {
		url = new URL(fileUrl);
	} catch (error) {
		throw new Error("The URL of the update file is not valid.", {
			cause: error,
		});
	}
	if (url.protocol !== "https:" || url.host !== new URL(manifestUrl).host) {
		throw new Error(
			"The update file is not on the host of the update manifest.",
		);
	}
}

/**
 * Sends one GET request and follows its redirects. Answers the response stream and the URL
 * that answered. Rejects for a status that is not 200.
 * @param {string} url
 * @param {(url: URL, onResponse: (response: import("node:http").IncomingMessage) => void) => import("node:http").ClientRequest} get
 *   Sends the request. The app passes `https.get`. A test passes `http.get` for a local server.
 * @param {string} requiredProtocol `https:` in the app. Security: no hop of a redirect leaves it.
 * @returns {Promise<{ response: import("node:http").IncomingMessage, finalUrl: string }>}
 */
function openGet(url, get, requiredProtocol, redirectsLeft = MAX_REDIRECTS) {
	return new Promise((resolve, reject) => {
		const target = new URL(url);
		if (target.protocol !== requiredProtocol) {
			reject(
				new Error(`The request to ${target.host} is not ${requiredProtocol}`),
			);
			return;
		}
		const request = get(target, (response) => {
			const { statusCode = 0, headers } = response;
			const isRedirect = statusCode >= 300 && statusCode < 400;
			if (isRedirect && headers.location && redirectsLeft > 0) {
				response.resume();
				let next;
				try {
					next = new URL(headers.location, target).href;
				} catch (error) {
					// A throw in this callback is outside the promise. It must reject, or the caller waits forever.
					reject(
						new Error(`${target.host} sent a redirect that is not valid.`, {
							cause: error,
						}),
					);
					return;
				}
				resolve(openGet(next, get, requiredProtocol, redirectsLeft - 1));
				return;
			}
			if (statusCode !== 200) {
				response.resume();
				reject(new Error(`${target.host} answered status ${statusCode}.`));
				return;
			}
			resolve({ response, finalUrl: target.href });
		});
		request.setTimeout(REQUEST_IDLE_LIMIT_MS, () => {
			request.destroy(new Error(`${target.host} did not answer in time.`));
		});
		request.on("error", reject);
	});
}

// Stops a download at `maxBytes`, so a bad host cannot fill the memory or the disk.
async function* limitBytes(response, maxBytes) {
	let total = 0;
	for await (const chunk of response) {
		total += chunk.length;
		if (total > maxBytes) {
			throw new Error(`The download is larger than ${maxBytes} bytes.`);
		}
		yield chunk;
	}
}

/**
 * Downloads the update manifest. Answers its text and the URL that answered it.
 * @param {string} endpoint The https URL from wandit.desktop.json.
 * @returns {Promise<{ text: string, finalUrl: string }>}
 */
async function fetchManifest(endpoint) {
	const { response, finalUrl } = await openGet(endpoint, https.get, "https:");
	const chunks = [];
	for await (const chunk of limitBytes(response, MAX_MANIFEST_BYTES)) {
		chunks.push(chunk);
	}
	return { text: Buffer.concat(chunks).toString("utf8"), finalUrl };
}

/**
 * Downloads a file to `destination`. Rejects when the file is larger than `maxBytes`, and
 * then no partial file stays.
 * @param {string} url
 * @param {string} destination Path of a new file.
 * @param {object} [options] The app passes none. A test passes a local http server.
 * @param {number} [options.maxBytes]
 * @param {Parameters<typeof openGet>[1]} [options.get]
 * @param {string} [options.requiredProtocol]
 */
async function downloadFile(
	url,
	destination,
	{
		maxBytes = MAX_UPDATE_BYTES,
		get = https.get,
		requiredProtocol = "https:",
	} = {},
) {
	const { response } = await openGet(url, get, requiredProtocol);
	const output = fs.createWriteStream(destination);
	try {
		await pipeline(limitBytes(response, maxBytes), output);
	} catch (error) {
		// The stream can still open the file after the failure. The delete waits for its end.
		if (!output.closed) {
			await new Promise((resolve) => output.once("close", resolve));
		}
		fs.rmSync(destination, { force: true });
		throw error;
	}
}

module.exports = {
	checkUpdateFileUrl,
	downloadFile,
	fetchManifest,
	isNewerVersion,
	parseUpdateManifest,
	parseUpdaterPublicKey,
	updatePlatformKey,
	verifyUpdateFile,
};
