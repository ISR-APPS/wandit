/**
 * The folders of the app on the user machine (docs/v2/desktop-apps.md, section 5).
 * main.js calls it at start and for the self-test. The Tauri shell uses the same folders,
 * so both engines read one database file.
 */

const path = require("node:path");

/**
 * @typedef {object} DataPaths
 * @property {string} dataDir `<base>/data`. The import also stages its file here, so the swap is a rename on one disk.
 * @property {string} dbFile `<base>/data/app.db`.
 * @property {string} backupsDir `<base>/backups`.
 * @property {string} updatesDir `<base>/updates`. Holds a downloaded update file until it installs.
 * @property {string} chromiumDir `<base>/electron`. Chromium keeps its own files here, apart from the data.
 */

/**
 * The base folder of the app data: `%LOCALAPPDATA%\<identifier>` on Windows and
 * `~/Library/Application Support/<identifier>` on macOS.
 * @param {object} system
 * @param {string} system.platform `process.platform`.
 * @param {string | undefined} system.localAppData The `LOCALAPPDATA` variable of Windows.
 * @param {string} system.homeDir The home folder of the user.
 * @param {string} identifier The app id from wandit.desktop.json. config.js checked its characters.
 */
function dataBaseDir({ platform, localAppData, homeDir }, identifier) {
	if (platform === "win32") {
		// Windows sets LOCALAPPDATA for each user session. The default path is the fallback.
		const local = localAppData || path.win32.join(homeDir, "AppData", "Local");
		return path.win32.join(local, identifier);
	}
	return path.posix.join(homeDir, "Library", "Application Support", identifier);
}

/**
 * The files of the app under `baseDir`. main.js passes the app data folder.
 * The self-test passes a new temp folder.
 * @param {string} baseDir
 * @returns {DataPaths}
 */
function dataPaths(baseDir) {
	const dataDir = path.join(baseDir, "data");
	return {
		dataDir,
		dbFile: path.join(dataDir, "app.db"),
		backupsDir: path.join(baseDir, "backups"),
		updatesDir: path.join(baseDir, "updates"),
		chromiumDir: path.join(baseDir, "electron"),
	};
}

module.exports = { dataBaseDir, dataPaths };
