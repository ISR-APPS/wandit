const assert = require("node:assert/strict");
const { fork } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");
const { DatabaseClient } = require("../src/db/client.js");
const { appOptions } = require("../testing/support.js");

const NOTES =
	"CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);";
const ENDLESS =
	"WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT count(*) FROM c";

// Runs worker.js in a forked Node process. The app uses an Electron utility process.
function spawnWorker() {
	const child = fork(path.join(__dirname, "../src/db/worker.js"));
	return {
		send: (request) => child.send(request),
		kill: () => child.kill("SIGKILL"),
		onMessage: (listener) => child.on("message", listener),
		onExit: (listener) => child.on("exit", listener),
	};
}

function startClient(context, commandTimeLimitMs) {
	const openOptions = appOptions(context, { "0001_init.sql": NOTES });
	const client = new DatabaseClient({
		spawnWorker,
		openOptions,
		commandTimeLimitMs,
	});
	context.after(() => client.stop());
	return client;
}

// A query that never ends must not hold the database: the commands after it, the backups,
// and the update wait for it.
test("the time limit stops a query that never ends, and the next command works", async (context) => {
	const client = startClient(context, 300);
	assert.deepEqual(await client.start(), { status: "ready" });
	await client.runCommand({
		type: "db_execute",
		sql: "INSERT INTO notes (body) VALUES ('kept')",
		params: [],
	});

	const stopped = client.runCommand({
		type: "db_select",
		sql: ENDLESS,
		params: [],
	});
	await assert.rejects(stopped, {
		code: "sql_error",
		message:
			"interrupted: the call ran longer than 0.3 s, so the shell stopped it. Make the query faster, for example with an index or a LIMIT.",
	});

	// A stopped batch keeps no row and no open transaction.
	const batch = client.runCommand({
		type: "db_batch",
		statements: [
			{ sql: "INSERT INTO notes (body) VALUES ('lost')", params: [] },
			{ sql: ENDLESS, params: [] },
		],
	});
	await assert.rejects(batch, { code: "sql_error" });

	const rows = await client.runCommand({
		type: "db_select",
		sql: "SELECT body FROM notes",
		params: [],
	});
	assert.deepEqual(rows.rows, [["kept"]]);
	const write = await client.runCommand({
		type: "db_execute",
		sql: "INSERT INTO notes (body) VALUES ('after')",
		params: [],
	});
	assert.equal(write.changes, 1);
});

test("the commands run in call order, and a shell job runs before the commands that wait", async (context) => {
	const client = startClient(context, 10_000);
	await client.start();
	const order = [];
	const insert = (body) =>
		client
			.runCommand({
				type: "db_execute",
				sql: "INSERT INTO notes (body) VALUES (?)",
				params: [body],
			})
			.then(() => order.push(body));
	const jobs = [
		insert("first"),
		insert("second"),
		insert("third"),
		client.runShellJob({ type: "backup_now" }).then(() => order.push("backup")),
	];
	await Promise.all(jobs);
	// "first" runs when the backup arrives. The backup then passes the 2 commands that wait.
	assert.deepEqual(order, ["first", "backup", "second", "third"]);
	const rows = await client.runCommand({
		type: "db_select",
		sql: "SELECT body FROM notes ORDER BY id",
		params: [],
	});
	assert.deepEqual(rows.rows, [["first"], ["second"], ["third"]]);
});
