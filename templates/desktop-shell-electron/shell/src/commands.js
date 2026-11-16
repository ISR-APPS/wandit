/**
 * The 4 commands of the page in the main process (docs/v2/desktop-apps.md, section 4).
 * main.js calls `registerCommands` once. preload.js sends each call. This file checks the
 * sender and the arguments, then gives the command to the queue of db/client.js.
 */

const { ipcMain } = require("electron");
const { isAppUrl } = require("./app-origin.js");
const { toDbError } = require("./db/db-error.js");
const { parseBatchInput, parseStatementInput } = require("./input.js");

/**
 * @param {object} options
 * @param {import("./db/client.js").DatabaseClient} options.client The queue of the database process.
 * @param {() => import("electron").BrowserWindow | null} options.getMainWindow Answers the one window of the app, or null before it exists.
 */
function registerCommands({ client, getMainWindow }) {
	// Security: only the top frame of the main window, on the app origin, may call a command.
	// A frame of another origin, or another window, gets a refusal.
	const isTrustedSender = (event) => {
		const mainWindow = getMainWindow();
		const frame = event.senderFrame;
		return (
			mainWindow !== null &&
			!mainWindow.isDestroyed() &&
			frame !== null &&
			frame === mainWindow.webContents.mainFrame &&
			isAppUrl(frame.url)
		);
	};
	// `toRequest` checks the raw arguments of the page and makes the request of the database process.
	const handle = (channel, toRequest) => {
		ipcMain.handle(channel, async (event, args) => {
			if (!isTrustedSender(event)) {
				throw new Error("This sender may not call the commands of the app.");
			}
			try {
				return { ok: true, value: await client.runCommand(toRequest(args)) };
			} catch (error) {
				const { code, message } = toDbError(error);
				return { ok: false, error: { code, message } };
			}
		});
	};
	handle("wandit:db-select", (args) => ({
		type: "db_select",
		...parseStatementInput(args),
	}));
	handle("wandit:db-execute", (args) => ({
		type: "db_execute",
		...parseStatementInput(args),
	}));
	handle("wandit:db-batch", (args) => ({
		type: "db_batch",
		...parseBatchInput(args),
	}));
	handle("wandit:app-info", () => ({ type: "app_info" }));
}

module.exports = { registerCommands };
