/**
 * The preload script of the main window. Electron runs it in the sandbox before the page.
 * It gives the page the 4 functions of `window.wanditDesktop` and nothing else
 * (docs/v2/desktop-apps.md, section 4). `src/lib/db.ts` of the template calls them, and
 * commands.js of the main process answers them.
 */

const { contextBridge, ipcRenderer } = require("electron");

// A sandboxed preload script cannot load another file, so these names repeat commands.js.
const CHANNELS = {
	dbSelect: "wandit:db-select",
	dbExecute: "wandit:db-execute",
	dbBatch: "wandit:db-batch",
	appInfo: "wandit:app-info",
};

// Sends one command to the main process. A failed command rejects with an Error whose
// message is the JSON text of { code, message }: the page gets only the message of an error.
async function callCommand(channel, args) {
	const answer = await ipcRenderer.invoke(channel, args);
	if (answer.ok) {
		return answer.value;
	}
	throw new Error(JSON.stringify(answer.error));
}

contextBridge.exposeInMainWorld("wanditDesktop", {
	dbSelect: (args) => callCommand(CHANNELS.dbSelect, args),
	dbExecute: (args) => callCommand(CHANNELS.dbExecute, args),
	dbBatch: (args) => callCommand(CHANNELS.dbBatch, args),
	appInfo: () => callCommand(CHANNELS.appInfo, {}),
});
