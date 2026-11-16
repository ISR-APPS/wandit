/**
 * The origin of the packed frontend, `app://app`, and the rules of its answers
 * (docs/v2/desktop-apps.md, section 3). window.js uses it for the protocol handler and the
 * navigation lock. commands.js uses it for the sender check of each command.
 * It has no Electron import.
 */

const path = require("node:path");

/** Scheme of the frontend. main.js registers it as a standard and secure scheme. */
const APP_SCHEME = "app";
const APP_HOST = "app";
/**
 * The URL that the main window opens. It is the root path, so the router of the frontend
 * matches its home route. The protocol handler answers `index.html` for it.
 */
const APP_START_URL = `${APP_SCHEME}://${APP_HOST}/`;

/**
 * The CSP of every answer of the app protocol. It allows only files of the app origin.
 * So no inline script, no remote script, and no remote connection runs.
 */
const CONTENT_SECURITY_POLICY =
	"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
	"img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; " +
	"object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'";

// The file types that a Vite build writes. Every other file is a download type, which never runs.
const CONTENT_TYPES = new Map([
	[".html", "text/html; charset=utf-8"],
	[".js", "text/javascript; charset=utf-8"],
	[".mjs", "text/javascript; charset=utf-8"],
	[".css", "text/css; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".map", "application/json; charset=utf-8"],
	[".webmanifest", "application/manifest+json; charset=utf-8"],
	[".txt", "text/plain; charset=utf-8"],
	[".xml", "application/xml; charset=utf-8"],
	[".svg", "image/svg+xml"],
	[".png", "image/png"],
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".gif", "image/gif"],
	[".webp", "image/webp"],
	[".avif", "image/avif"],
	[".ico", "image/x-icon"],
	[".woff", "font/woff"],
	[".woff2", "font/woff2"],
	[".ttf", "font/ttf"],
	[".otf", "font/otf"],
	[".wasm", "application/wasm"],
	[".mp3", "audio/mpeg"],
	[".wav", "audio/wav"],
	[".ogg", "audio/ogg"],
	[".mp4", "video/mp4"],
	[".webm", "video/webm"],
	[".pdf", "application/pdf"],
]);

/**
 * The navigation lock and the sender check: true only for a URL of the app origin.
 * @param {string} urlText A URL from Chromium, which writes the scheme and the host in lowercase.
 */
function isAppUrl(urlText) {
	let url;
	try {
		url = new URL(urlText);
	} catch {
		// A text that is not a URL is not the app origin.
		return false;
	}
	return (
		url.protocol === `${APP_SCHEME}:` &&
		url.hostname === APP_HOST &&
		url.port === "" &&
		url.username === "" &&
		url.password === ""
	);
}

/** Schemes that never leave the machine. `devtools` serves the developer tools of a local run. */
const LOCAL_SCHEMES = new Set([
	`${APP_SCHEME}:`,
	"devtools:",
	"data:",
	"blob:",
]);

/**
 * The network lock of the window: true only for a request that stays inside the app.
 * Every other scheme, for example https, wss, or file, is canceled.
 * @param {string} urlText The URL of a request of the window.
 */
function isLocalRequestUrl(urlText) {
	try {
		return LOCAL_SCHEMES.has(new URL(urlText).protocol);
	} catch {
		// A text that is not a URL names no local file.
		return false;
	}
}

/**
 * The path guard of the protocol handler. Answers the absolute path of the file that a URL
 * path names, or null when the path leaves the packed `dist` folder or is not valid.
 * @param {string} distDir Absolute path of the packed `dist` folder.
 * @param {string} urlPath The `pathname` of the request URL, still percent-encoded.
 * @param {typeof path.posix} pathApi The path rules of the system. A test passes `path.win32`.
 * @returns {string | null}
 */
function resolveDistFile(distDir, urlPath, pathApi = path) {
	let decoded;
	try {
		decoded = decodeURIComponent(urlPath);
	} catch {
		// A bad percent escape names no file.
		return null;
	}
	if (decoded.includes("\0")) {
		return null;
	}
	// `join` resolves each `..` part, so the prefix test below sees the real target.
	const file = pathApi.join(distDir, decoded);
	const isInside =
		file === distDir || file.startsWith(`${distDir}${pathApi.sep}`);
	return isInside ? file : null;
}

/**
 * The Content-Type of a packed file, from its extension.
 * @param {string} file
 */
function contentTypeOf(file) {
	return (
		CONTENT_TYPES.get(path.extname(file).toLowerCase()) ??
		"application/octet-stream"
	);
}

module.exports = {
	APP_HOST,
	APP_SCHEME,
	APP_START_URL,
	CONTENT_SECURITY_POLICY,
	contentTypeOf,
	isAppUrl,
	isLocalRequestUrl,
	resolveDistFile,
};
