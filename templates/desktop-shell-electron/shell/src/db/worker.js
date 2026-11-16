/**
 * Entry file of the database process. client.js starts it: as an Electron utility process in
 * the app, and as a forked Node process in the tests. It answers one request at a time with
 * the `AppDatabase` of app-database.js. SQLite runs here, so a slow query never freezes the
 * window, the menu, or the updater, and the shell can stop a query that never ends.
 */

const { AppDatabase } = require("./app-database.js");
const { DbError } = require("./db-error.js");

/** @type {AppDatabase | null} */
let database = null;

// Runs one request of client.js. The answer keeps the `id` of the request.
// `code` is the DbError code of a failed command of the page, or null for another failure.
async function answer(request) {
	try {
		if (request.type === "open") {
			database = new AppDatabase(request.options);
			return { id: request.id, ok: true, value: await database.open() };
		}
		if (database === null) {
			throw new Error("The database process got a request before `open`.");
		}
		return { id: request.id, ok: true, value: await database.handle(request) };
	} catch (error) {
		const code = error instanceof DbError ? error.code : null;
		return {
			id: request.id,
			ok: false,
			error: { code, message: error.message },
		};
	}
}

// Electron gives a utility process the `parentPort`. A forked Node process has `process.send`.
const { parentPort } = process;
if (parentPort) {
	parentPort.on("message", (event) => {
		answer(event.data).then((reply) => parentPort.postMessage(reply));
	});
} else {
	process.on("message", (request) => {
		answer(request).then((reply) => process.send?.(reply));
	});
}
