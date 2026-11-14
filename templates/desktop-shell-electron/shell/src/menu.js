/**
 * The native menu and the File menu actions (docs/v2/desktop-apps.md, sections 3 and 5).
 * main.js calls `installMenu` once. The main process owns the menu, so the page cannot
 * change it. Each action sends a job to the queue of db/client.js and shows the result.
 */

const { app, dialog, Menu } = require("electron");
const { parentWindow, showDialog } = require("./dialogs.js");

/** @typedef {import("./db/client.js").DatabaseClient} DatabaseClient */

const DATABASE_FILTERS = [{ name: "Database", extensions: ["db"] }];

// Shows a Save or Open dialog over the window of the app, when one is open.
function showFileDialog(show, options) {
	const parent = parentWindow();
	return parent ? show(parent, options) : show(options);
}

// File > Back up now: writes `backups/manual-<UTC time>.db`.
async function backUpNow(client) {
	try {
		const file = await client.runShellJob({ type: "backup_now" });
		await showDialog({
			type: "info",
			title: "Back up now",
			text: `The backup is saved:\n${file}`,
		});
	} catch (error) {
		await showDialog({
			type: "error",
			title: "Backup failed",
			text: error.message,
		});
	}
}

// File > Export data...: a Save dialog, then a full copy of the database to that path.
async function exportData(client, productName) {
	const choice = await showFileDialog(dialog.showSaveDialog, {
		title: "Export data",
		defaultPath: `${productName} data.db`,
		filters: DATABASE_FILTERS,
	});
	if (choice.canceled || !choice.filePath) {
		return;
	}
	try {
		const file = await client.runShellJob({
			type: "export_data",
			file: choice.filePath,
		});
		await showDialog({
			type: "info",
			title: "Export data",
			text: `The data is saved:\n${file}`,
		});
	} catch (error) {
		await showDialog({
			type: "error",
			title: "Export failed",
			text: error.message,
		});
	}
}

// File > Import data... (section 5): an Open dialog, the checks of the file, a confirm dialog,
// a backup, the swap of the file, and a reload of the window.
async function importData(client) {
	const choice = await showFileDialog(dialog.showOpenDialog, {
		title: "Import data",
		filters: DATABASE_FILTERS,
		properties: ["openFile"],
	});
	const [file] = choice.filePaths;
	if (choice.canceled || file === undefined) {
		return;
	}
	let staged;
	try {
		staged = await client.runShellJob({ type: "import_stage", file });
	} catch (error) {
		await showDialog({
			type: "error",
			title: "Import refused",
			text: `This file cannot be imported. Your data is unchanged.\n\n${error.message}`,
		});
		return;
	}
	const choiceIndex = await showDialog({
		type: "warning",
		title: "Import data",
		text: "The import replaces all data of this app with the data of the file. The app writes a backup of the current data first.",
		buttons: ["Import", "Cancel"],
	});
	if (choiceIndex !== 0) {
		// The user canceled, so a failed cleanup shows no dialog. The copy only takes disk space.
		client
			.runShellJob({ type: "import_discard", staged })
			.catch((error) => console.error(`Import cleanup: ${error.message}`));
		return;
	}
	let failure = null;
	try {
		await client.runShellJob({ type: "import_replace", staged });
	} catch (error) {
		failure = error;
	}
	// The frontend reads the new data, or shows the `migration_failed` screen.
	parentWindow()?.webContents.reload();
	if (failure === null) {
		await showDialog({
			type: "info",
			title: "Import data",
			text: "The import is complete.",
		});
	} else {
		await showDialog({
			type: "error",
			title: "Import failed",
			text: failure.message,
		});
	}
}

/**
 * Builds the menu of section 3 and sets it on the app.
 * Windows: File (Back up now, Export data..., Import data..., Quit) and Help (Check for
 * updates, About). macOS: the app menu, File, Edit, Window, and Help.
 * @param {object} options
 * @param {DatabaseClient} options.client The queue of the database process.
 * @param {string} options.productName The name of the macOS app menu and of the About dialog.
 * @param {string} options.version Semver of the installed app, for the About dialog.
 * @param {() => void} options.checkForUpdates Starts the update check of Help > Check for updates.
 */
function installMenu({ client, productName, version, checkForUpdates }) {
	const about = {
		label: process.platform === "darwin" ? `About ${productName}` : "About",
		click: () =>
			showDialog({
				type: "info",
				title: "About",
				text: `${productName}\nVersion ${version}`,
			}),
	};
	const fileItems = [
		{ label: "Back up now", click: () => backUpNow(client) },
		{ label: "Export data...", click: () => exportData(client, productName) },
		{ label: "Import data...", click: () => importData(client) },
	];
	const checkUpdates = { label: "Check for updates", click: checkForUpdates };
	const template =
		process.platform === "darwin"
			? [
					{
						label: productName,
						submenu: [
							about,
							{ type: "separator" },
							{ role: "hide" },
							{ role: "hideOthers" },
							{ role: "unhide" },
							{ type: "separator" },
							// The role gives Cmd+Q.
							{ role: "quit" },
						],
					},
					{ label: "File", submenu: fileItems },
					// Edit gives Cmd+C, Cmd+V, and the other edit keys to the page.
					{
						label: "Edit",
						submenu: [
							{ role: "undo" },
							{ role: "redo" },
							{ type: "separator" },
							{ role: "cut" },
							{ role: "copy" },
							{ role: "paste" },
							{ role: "selectAll" },
						],
					},
					{
						label: "Window",
						submenu: [
							{ role: "minimize" },
							{ role: "zoom" },
							{ type: "separator" },
							{ role: "close" },
						],
					},
					{ label: "Help", submenu: [checkUpdates] },
				]
			: [
					{
						label: "File",
						submenu: [
							...fileItems,
							{ type: "separator" },
							{ label: "Quit", click: () => app.quit() },
						],
					},
					{ label: "Help", submenu: [checkUpdates, about] },
				];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { installMenu };
