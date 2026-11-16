/**
 * The main window and its locks (docs/v2/desktop-apps.md, section 3). main.js calls it
 * after the migration runner. It serves the packed frontend from `app://app`, puts the CSP
 * on every answer, and refuses navigation, new windows, downloads, permissions, and each
 * request that leaves the app. It calls app-origin.js for every rule.
 */

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, protocol, session } = require("electron");
const {
	APP_HOST,
	APP_SCHEME,
	APP_START_URL,
	CONTENT_SECURITY_POLICY,
	contentTypeOf,
	isAppUrl,
	isLocalRequestUrl,
	resolveDistFile,
} = require("./app-origin.js");

// Read errors of a URL path that names no file: a missing file, a folder, or a path through a file.
const UNKNOWN_PATH_ERRORS = new Set(["ENOENT", "EISDIR", "ENOTDIR"]);

/**
 * Makes `app://` a standard and secure scheme, so the frontend has a real origin, relative
 * URLs, and the fetch API for its own files. Electron accepts this call only before `ready`.
 */
function registerAppScheme() {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				supportFetchAPI: true,
				stream: true,
				codeCache: true,
			},
		},
	]);
}

// One answer of the app protocol. Security: every answer has the CSP, also an error answer,
// a worker script, and an `.svg` file. `nosniff` keeps the Content-Type that the shell gives.
function appResponse(status, body, contentType) {
	return new Response(body, {
		status,
		headers: {
			"Content-Security-Policy": CONTENT_SECURITY_POLICY,
			"Content-Type": contentType,
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/**
 * Serves the files of the packed `dist` folder at `app://app/`. An unknown path answers
 * `index.html`, so a reload on a router path works.
 * LIMIT: a file loads fully into memory, with no byte ranges. Upgrade: a stream with Range support.
 * @param {string} distDir Absolute path of the packed `dist` folder.
 */
function serveFrontend(distDir) {
	const indexFile = path.join(distDir, "index.html");
	protocol.handle(APP_SCHEME, async (request) => {
		const url = new URL(request.url);
		const file =
			url.hostname === APP_HOST ? resolveDistFile(distDir, url.pathname) : null;
		// Security: the path guard refused the path, or the host is not the app.
		if (file === null) {
			return appResponse(404, "Not found", "text/plain; charset=utf-8");
		}
		if (request.method !== "GET" && request.method !== "HEAD") {
			return appResponse(
				405,
				"Method not allowed",
				"text/plain; charset=utf-8",
			);
		}
		for (const candidate of [file, indexFile]) {
			try {
				const body = await fs.promises.readFile(candidate);
				return appResponse(200, body, contentTypeOf(candidate));
			} catch (error) {
				// A missing file or a folder is an unknown path. Every other error is a real failure.
				if (!UNKNOWN_PATH_ERRORS.has(error.code)) {
					console.error(
						`The file ${candidate} is not readable: ${error.message}`,
					);
					return appResponse(500, "Not readable", "text/plain; charset=utf-8");
				}
			}
		}
		return appResponse(404, "Not found", "text/plain; charset=utf-8");
	});
}

/**
 * The locks of the one browser session of the app. The page has no remote network, no
 * download, and no device or permission. Call it before the window exists.
 */
function lockSession() {
	const appSession = session.defaultSession;
	// Network lock: the CSP does not govern every request, for example a preconnect.
	appSession.webRequest.onBeforeRequest((details, callback) => {
		callback({ cancel: !isLocalRequestUrl(details.url) });
	});
	// The app has no file download. Chromium would write the file with a name that the page chooses.
	appSession.on("will-download", (event) => event.preventDefault());
	appSession.setPermissionRequestHandler((_contents, _permission, callback) =>
		callback(false),
	);
	appSession.setPermissionCheckHandler(() => false);
	appSession.setDevicePermissionHandler(() => false);
}

// The navigation lock of one page: it stays on the app origin, and opens no window.
function lockWebContents(contents) {
	const refuseOtherOrigins = (event) => {
		if (!isAppUrl(event.url)) {
			event.preventDefault();
		}
	};
	contents.on("will-navigate", refuseOtherOrigins);
	contents.on("will-frame-navigate", refuseOtherOrigins);
	contents.on("will-redirect", refuseOtherOrigins);
	// `window.open` and `target="_blank"` never open a window.
	contents.setWindowOpenHandler(() => ({ action: "deny" }));
	contents.on("will-attach-webview", (event) => event.preventDefault());
	// WebRTC sends no UDP outside the proxy, and the proxy of main.js reaches no host.
	contents.setWebRTCIPHandlingPolicy("disable_non_proxied_udp");
}

/** Puts the navigation lock on every page that the app makes. Call it before the window exists. */
function lockEveryWebContents() {
	app.on("web-contents-created", (_event, contents) =>
		lockWebContents(contents),
	);
}

/**
 * Opens the one window of the app on `app://app/`, which answers `index.html`.
 * @param {string} productName The window title. The page cannot change it.
 * @returns {BrowserWindow}
 */
function createMainWindow(productName) {
	const mainWindow = new BrowserWindow({
		title: productName,
		// Logical pixels. The minimum keeps a sidebar and a table usable.
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 560,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			webSecurity: true,
			webviewTag: false,
			// The spell checker of Chromium downloads its word lists from a remote host.
			spellcheck: false,
			// An installed app has no developer tools. A local run of the shell keeps them.
			devTools: !app.isPackaged,
		},
	});
	// The title stays the product name, also when the page sets `document.title`.
	mainWindow.on("page-title-updated", (event) => event.preventDefault());
	mainWindow.loadURL(APP_START_URL).catch((error) => {
		console.error(`The frontend did not load: ${error.message}`);
	});
	return mainWindow;
}

module.exports = {
	createMainWindow,
	lockEveryWebContents,
	lockSession,
	registerAppScheme,
	serveFrontend,
};
