/**
 * The native message dialogs of the shell (docs/v2/desktop-apps.md, section 3).
 * menu.js, updater.js, and main.js call it. Every dialog is a call of the main process:
 * the page never opens one and never gives a file path.
 */

const { BrowserWindow, dialog } = require("electron");

// The open window of the app, so a dialog shows over it. Undefined when no window is open.
function parentWindow() {
	return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
}

/**
 * Shows a dialog with the given buttons and answers the index of the button that the user chose.
 * @param {object} options
 * @param {"info" | "warning" | "error"} options.type
 * @param {string} options.title The short headline of the dialog.
 * @param {string} options.text The full text below the headline.
 * @param {string[]} [options.buttons] The first button is the default. The last button is the cancel choice.
 * @returns {Promise<number>}
 */
async function showDialog({ type, title, text, buttons = ["OK"] }) {
	const options = {
		type,
		title,
		message: title,
		detail: text,
		buttons,
		defaultId: 0,
		cancelId: buttons.length - 1,
		noLink: true,
	};
	const parent = parentWindow();
	const { response } = parent
		? await dialog.showMessageBox(parent, options)
		: await dialog.showMessageBox(options);
	return response;
}

module.exports = { parentWindow, showDialog };
