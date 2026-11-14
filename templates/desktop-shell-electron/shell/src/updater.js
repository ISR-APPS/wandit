/**
 * The update flow of the Electron engine (docs/v2/desktop-apps.md, section 10).
 * main.js calls `checkForUpdates` at start and from Help > Check for updates.
 * It runs in the main process and is the only network user of the app. It calls
 * update-files.js for the checks and update-install.js for the install.
 */

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const { showDialog } = require("./dialogs.js");
const {
	checkUpdateFileUrl,
	downloadFile,
	fetchManifest,
	isNewerVersion,
	parseUpdateManifest,
	parseUpdaterPublicKey,
	updatePlatformKey,
	verifyUpdateFile,
} = require("./update-files.js");
const { replaceMacBundle, startWindowsSetup } = require("./update-install.js");

/**
 * @typedef {object} UpdaterOptions
 * @property {import("./config.js").DesktopConfig} config The values of wandit.desktop.json.
 * @property {import("./db/client.js").DatabaseClient} client The queue of the database process, for the backup.
 * @property {string} updatesDir `<base>/updates`: the folder of the downloaded update file.
 */

/**
 * End of the "Update failed" text when the install fails on macOS. macOS runs an app from
 * Downloads or from the disk image at a random read-only path (App Translocation).
 */
const INSTALL_FAILED_HINT =
	process.platform === "darwin"
		? "\n\nOpen the app from the Applications folder, then try again."
		: "";
/** Most characters of the release notes in the dialog. The notes are not signed. */
const MAX_NOTES_CHARS = 2000;

/** True while an update check or install runs. It stops a second dialog and a second install. */
let isUpdateFlowRunning = false;

/**
 * The update flow. A check error and "no update" show a dialog only when `fromMenu` is true:
 * the check at start must not interrupt the user, for example when the PC is offline.
 * An error after "Install" always shows a dialog.
 * @param {UpdaterOptions} options
 * @param {boolean} fromMenu True for Help > Check for updates.
 */
async function checkForUpdates(options, fromMenu) {
	if (isUpdateFlowRunning) {
		if (fromMenu) {
			await showDialog({
				type: "info",
				title: "Check for updates",
				text: "An update check is already running.",
			});
		}
		return;
	}
	isUpdateFlowRunning = true;
	try {
		await runUpdateFlow(options, fromMenu);
	} catch (error) {
		if (fromMenu) {
			await showDialog({
				type: "error",
				title: "Update failed",
				text: error.message,
			});
		} else {
			console.error(`Update check at start: ${error.message}`);
		}
	} finally {
		isUpdateFlowRunning = false;
	}
}

async function runUpdateFlow(options, fromMenu) {
	const { config, client } = options;
	let offer;
	let manifestUrl;
	try {
		const manifest = await fetchManifest(config.updateEndpoint);
		manifestUrl = manifest.finalUrl;
		offer = parseUpdateManifest(
			manifest.text,
			updatePlatformKey(process.platform, process.arch),
		);
	} catch (error) {
		throw new Error(`The update check failed: ${error.message}`, {
			cause: error,
		});
	}
	// Security: only a newer version installs. A rollback is a new release of the older code
	// with a higher version. The signature holds the version, so a changed manifest cannot
	// give a higher version to an older signed file.
	if (!isNewerVersion(offer.version, config.version)) {
		if (fromMenu) {
			await showDialog({
				type: "info",
				title: "Check for updates",
				text: `Version ${config.version} is the newest version.`,
			});
		}
		return;
	}
	const notes =
		offer.notes.trim().slice(0, MAX_NOTES_CHARS) || "No release notes.";
	const choiceIndex = await showDialog({
		type: "info",
		title: "Update available",
		text: `Version ${offer.version} is available. You have version ${config.version}.\n\n${notes}`,
		buttons: ["Install", "Later"],
	});
	if (choiceIndex !== 0) {
		return;
	}
	try {
		// A failed backup stops the update: an update never runs without a copy of the data.
		await client.runShellJob({ type: "backup_before_update" });
		try {
			await installUpdate(options, offer, manifestUrl);
		} catch (error) {
			throw new Error(
				`The update did not install: ${error.message}${INSTALL_FAILED_HINT}`,
				{ cause: error },
			);
		}
	} catch (error) {
		// The user chose "Install", so the error shows a dialog, also after the check at start.
		await showDialog({
			type: "error",
			title: "Update failed",
			text: error.message,
		});
	}
}

// Downloads the update file, checks its signature, and installs it. On success the app
// ends, so this function answers only with an error.
async function installUpdate(
	{ config, client, updatesDir },
	offer,
	manifestUrl,
) {
	checkUpdateFileUrl(offer.url, manifestUrl);
	const publicKey = parseUpdaterPublicKey(config.updaterPublicKey);
	// A file of an earlier try must not stay: the folder holds one update at most.
	fs.rmSync(updatesDir, { recursive: true, force: true });
	fs.mkdirSync(updatesDir, { recursive: true });
	const isWindows = process.platform === "win32";
	const file = path.join(
		updatesDir,
		`${config.mainBinaryName}-${offer.version}${isWindows ? "-setup.exe" : ".dmg"}`,
	);
	await downloadFile(offer.url, file);
	// Security: no byte of the file runs or mounts before this check.
	await verifyUpdateFile(file, offer, publicKey);
	if (isWindows) {
		await startWindowsSetup(file);
	} else {
		// `<name>.app/Contents/MacOS/<name>` is the executable, so 3 levels up is the bundle.
		const bundle = path.resolve(process.execPath, "..", "..", "..");
		await replaceMacBundle(file, bundle, config.mainBinaryName, updatesDir);
	}
	client.stop();
	if (!isWindows) {
		app.relaunch();
	}
	app.exit(0);
}

module.exports = { checkForUpdates };
