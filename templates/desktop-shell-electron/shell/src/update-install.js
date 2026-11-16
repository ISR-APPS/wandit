/**
 * The install step of an update (docs/v2/desktop-apps.md, section 10). updater.js calls it
 * after the signature check of the update file. On Windows it starts the NSIS setup exe.
 * On macOS it calls hdiutil, codesign, and ditto, then swaps the app bundles.
 * It has no Electron import.
 */

const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const runTool = promisify(execFile);

/**
 * Windows: starts the NSIS setup exe. `/S` installs with no window, and `--force-run` starts
 * the new version at the end. The setup closes this app when it still runs.
 * Rejects when the setup does not start.
 * @param {string} setupFile Path of the setup exe, after the signature check.
 */
async function startWindowsSetup(setupFile) {
	const setup = spawn(setupFile, ["/S", "--force-run"], {
		detached: true,
		stdio: "ignore",
	});
	await new Promise((resolve, reject) => {
		setup.once("spawn", resolve);
		setup.once("error", reject);
	});
	setup.unref();
}

// Runs a system tool of macOS. Rejects with the error text of the tool.
async function runMacTool(tool, args) {
	try {
		await runTool(tool, args);
	} catch (error) {
		const reason = String(error.stderr || error.message).trim();
		throw new Error(`${path.basename(tool)} failed: ${reason}`, {
			cause: error,
		});
	}
}

/**
 * macOS: puts the app of the disk image in place of the app bundle that runs.
 * The old bundle stays until the new one is in place, so a failed step keeps an app that works.
 * Rejects with the reason, for example when the app runs from a read-only place.
 * @param {string} diskImage Path of the `.dmg` file, after the signature check.
 * @param {string} bundle Path of the `.app` folder of the running app.
 * @param {string} mainBinaryName The disk image must hold `<mainBinaryName>.app`.
 * @param {string} updatesDir The folder of the temp mount point.
 */
async function replaceMacBundle(diskImage, bundle, mainBinaryName, updatesDir) {
	const parent = path.dirname(bundle);
	const isReadOnly =
		!bundle.endsWith(".app") ||
		bundle.includes("/AppTranslocation/") ||
		!isWritable(parent);
	if (isReadOnly) {
		throw new Error("The app runs from a place that it cannot write.");
	}
	const bundleName = `${mainBinaryName}.app`;
	// Hidden names next to the app, so each rename stays on one disk.
	const incoming = path.join(parent, `.${bundleName}.update`);
	const outgoing = path.join(parent, `.${bundleName}.old`);
	let isSwapped = false;
	const mountPoint = fs.mkdtempSync(path.join(updatesDir, "mount-"));
	await runMacTool("/usr/bin/hdiutil", [
		"attach",
		"-nobrowse",
		"-readonly",
		"-noautoopen",
		"-mountpoint",
		mountPoint,
		diskImage,
	]);
	try {
		const source = path.join(mountPoint, bundleName);
		if (!fs.existsSync(source)) {
			throw new Error(`The disk image holds no ${bundleName}.`);
		}
		// The seal of the new app must be whole before it replaces the app that works.
		await runMacTool("/usr/bin/codesign", [
			"--verify",
			"--deep",
			"--strict",
			source,
		]);
		fs.rmSync(incoming, { recursive: true, force: true });
		fs.rmSync(outgoing, { recursive: true, force: true });
		// `ditto` keeps the signature data of the bundle, which a plain copy can lose.
		await runMacTool("/usr/bin/ditto", [source, incoming]);
		fs.renameSync(bundle, outgoing);
		try {
			fs.renameSync(incoming, bundle);
		} catch (error) {
			// The old app goes back to its place. When this also fails, it stays at `outgoing`.
			fs.renameSync(outgoing, bundle);
			throw error;
		}
		isSwapped = true;
	} finally {
		// `incoming` is gone after a good swap, and a partial copy after a failed step.
		// `outgoing` is the old app: the shell deletes it only when the new app is in place.
		// A leftover only takes disk space, so a failed delete is a log line.
		for (const leftover of isSwapped ? [incoming, outgoing] : [incoming]) {
			try {
				fs.rmSync(leftover, { recursive: true, force: true });
			} catch (error) {
				console.error(`Update cleanup: ${error.message}`);
			}
		}
		try {
			await runMacTool("/usr/bin/hdiutil", ["detach", mountPoint, "-force"]);
			// The folder is empty after the detach. `rmdir` never deletes a folder with files.
			fs.rmdirSync(mountPoint);
		} catch (error) {
			console.error(`Update cleanup: ${error.message}`);
		}
	}
}

function isWritable(folder) {
	try {
		fs.accessSync(folder, fs.constants.W_OK);
		return true;
	} catch {
		// The folder is read-only for this user, for example the disk image of the app.
		return false;
	}
}

module.exports = { replaceMacBundle, startWindowsSetup };
