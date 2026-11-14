/**
 * Reads `wandit.desktop.json`, the one file that the server writes for each build
 * (docs/v2/desktop-apps.md, section 3). main.js calls it at start, and
 * electron-builder.config.cjs calls it on CI. It has no Electron import.
 */

const fs = require("node:fs");

/**
 * @typedef {object} DesktopConfig
 * @property {string} productName The name that the user sees: window title, menu, and dialogs.
 * @property {string} mainBinaryName Lowercase kebab-case ASCII name of the executable and the app bundle.
 * @property {string} version Semver of this build, `1.0.<release number>`.
 * @property {string} identifier App id, `app.wandit.p<project id>`. Also the name of the data folder.
 * @property {string} updaterPublicKey The minisign public key text of the app, in base64.
 * @property {string} updateEndpoint The https URL of the update manifest of this platform.
 */

/** Three numbers, as the server writes them. The updater compares them as numbers. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
// Security: these two values become file and folder names, so they hold no path separator.
const BINARY_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9]+(\.[A-Za-z0-9-]+)+$/;

/**
 * Checks the JSON text of `wandit.desktop.json`. Throws an Error that names the bad key.
 * @param {string} text
 * @returns {DesktopConfig}
 */
function parseDesktopConfig(text) {
	const json = JSON.parse(text);
	const updater = json?.plugins?.updater;
	const endpoints = updater?.endpoints;
	const config = {
		productName: json?.productName,
		mainBinaryName: json?.mainBinaryName,
		version: json?.version,
		identifier: json?.identifier,
		updaterPublicKey: updater?.pubkey,
		updateEndpoint: Array.isArray(endpoints) ? endpoints[0] : undefined,
	};
	for (const [key, value] of Object.entries(config)) {
		if (typeof value !== "string" || value.trim() === "") {
			throw new Error(`wandit.desktop.json: ${key} is not a text.`);
		}
	}
	if (!BINARY_NAME_PATTERN.test(config.mainBinaryName)) {
		throw new Error("wandit.desktop.json: mainBinaryName is not kebab-case.");
	}
	if (!IDENTIFIER_PATTERN.test(config.identifier)) {
		throw new Error("wandit.desktop.json: identifier is not an app id.");
	}
	if (!VERSION_PATTERN.test(config.version)) {
		throw new Error("wandit.desktop.json: version is not N.N.N.");
	}
	// Security: the updater sends no request over plain http.
	if (!config.updateEndpoint.startsWith("https://")) {
		throw new Error("wandit.desktop.json: the update endpoint is not https.");
	}
	return config;
}

/**
 * Reads and checks the file. Throws when the file is missing or a key is bad.
 * @param {string} file Absolute path of `wandit.desktop.json`.
 * @returns {DesktopConfig}
 */
function readDesktopConfig(file) {
	return parseDesktopConfig(fs.readFileSync(file, "utf8"));
}

module.exports = { parseDesktopConfig, readDesktopConfig, VERSION_PATTERN };
