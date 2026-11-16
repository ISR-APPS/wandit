/**
 * The queue in front of the database process (docs/v2/desktop-apps.md, section 4).
 * main.js sends every database job through one `DatabaseClient`. The client starts
 * worker.js, sends one request at a time, and stops a command of the page after 10 s.
 * It has no Electron import: the caller gives it the function that starts the process.
 */

const { DbError } = require("./db-error.js");

/**
 * The process that runs worker.js. main.js wraps an Electron utility process. The tests
 * wrap a forked Node process.
 * @typedef {object} WorkerHandle
 * @property {(request: { id: number, type: string }) => void} send Sends one request to worker.js.
 * @property {() => void} kill Ends the process at once, also inside a long SQLite call.
 * @property {(listener: (reply: { id: number, ok: boolean }) => void) => void} onMessage
 * @property {(listener: () => void) => void} onExit
 */

/**
 * Time limit of one command of the page, a whole `db_batch` included, in milliseconds.
 * A query of a desktop app on its local file takes far less than 1 s, so 10 s leaves a
 * large margin for a slow PC.
 */
const COMMAND_TIME_LIMIT_MS = 10_000;

class DatabaseClient {
	/**
	 * @param {object} options
	 * @param {() => WorkerHandle} options.spawnWorker Starts a new process that runs worker.js.
	 * @param {import("./app-database.js").OpenOptions} options.openOptions Sent to each new process, before any other request.
	 * @param {number} [options.commandTimeLimitMs] The tests pass a short limit.
	 */
	constructor({
		spawnWorker,
		openOptions,
		commandTimeLimitMs = COMMAND_TIME_LIMIT_MS,
	}) {
		this.spawnWorker = spawnWorker;
		this.openOptions = openOptions;
		this.commandTimeLimitMs = commandTimeLimitMs;
		/** @type {WorkerHandle | null} */
		this.worker = null;
		// The request that the process runs now, with the functions that settle its promise.
		this.pending = null;
		// The answer of the last `open` request: the state of the database after the runner.
		this.openAnswer = null;
		this.queue = [];
		this.isRunning = false;
		this.nextId = 1;
	}

	/**
	 * Starts the database process and waits for the migration runner. main.js calls it before
	 * the window exists, so the page never queries a file that is not migrated.
	 * @returns {Promise<{ status: "ready" } | { status: "failed", reason: string }>}
	 */
	start() {
		return this.enqueue({ request: null, isShellJob: true });
	}

	/**
	 * Runs one command of the page, after each command that came before it. Rejects with a
	 * DbError. After the time limit, the client ends the database process, and the command
	 * rejects with `sql_error`.
	 * @param {import("./app-database.js").DatabaseRequest} request
	 */
	runCommand(request) {
		return this.enqueue({ request, isShellJob: false });
	}

	/**
	 * Runs one job of the menu or the updater. It has no time limit. It runs before the
	 * commands of the page that wait, so a page that sends many slow queries cannot hold back
	 * a backup or an update. Rejects with an Error whose message is a text for the user.
	 * @param {import("./app-database.js").DatabaseRequest} request
	 */
	runShellJob(request) {
		return this.enqueue({ request, isShellJob: true });
	}

	/** Ends the database process. main.js calls it when the app quits. */
	stop() {
		this.worker?.kill();
		this.worker = null;
	}

	enqueue(job) {
		return new Promise((resolve, reject) => {
			const entry = { ...job, resolve, reject };
			const firstCommand = this.queue.findIndex((queued) => !queued.isShellJob);
			if (job.isShellJob && firstCommand !== -1) {
				this.queue.splice(firstCommand, 0, entry);
			} else {
				this.queue.push(entry);
			}
			this.runNext();
		});
	}

	// Runs the jobs of the queue one at a time, in order.
	async runNext() {
		if (this.isRunning) {
			return;
		}
		const job = this.queue.shift();
		if (job === undefined) {
			return;
		}
		this.isRunning = true;
		let settle;
		try {
			const value = await this.runJob(job);
			settle = () => job.resolve(value);
		} catch (error) {
			settle = () => job.reject(error);
		}
		// The queue is free before the caller continues, so its next job starts at once.
		this.isRunning = false;
		settle();
		this.runNext();
	}

	async runJob({ request, isShellJob }) {
		// A new process opens the database again before the job. SQLite then drops the
		// transaction that a stopped process left open.
		if (this.worker === null) {
			this.worker = this.startWorker();
			this.openAnswer = await this.send(
				{ type: "open", options: this.openOptions },
				null,
			);
		}
		if (request === null) {
			return this.openAnswer;
		}
		return this.send(request, isShellJob ? null : this.commandTimeLimitMs);
	}

	startWorker() {
		const worker = this.spawnWorker();
		worker.onMessage((reply) => {
			const { pending } = this;
			if (
				worker !== this.worker ||
				pending === null ||
				reply.id !== pending.id
			) {
				return;
			}
			this.clearPending();
			if (reply.ok) {
				pending.resolve(reply.value);
			} else if (reply.error.code === null) {
				pending.reject(new Error(reply.error.message));
			} else {
				pending.reject(new DbError(reply.error.code, reply.error.message));
			}
		});
		worker.onExit(() => {
			// The exit of a process that the client stopped itself is not a failure.
			if (worker !== this.worker) {
				return;
			}
			this.worker = null;
			const { pending } = this;
			this.clearPending();
			pending?.reject(
				new DbError(
					"sql_error",
					"The database call stopped: the database process ended.",
				),
			);
		});
		return worker;
	}

	clearPending() {
		clearTimeout(this.pending?.timer);
		this.pending = null;
	}

	// Sends one request and waits for its answer. `timeLimitMs` is null for a job with no limit.
	send(request, timeLimitMs) {
		return new Promise((resolve, reject) => {
			const id = this.nextId++;
			let timer;
			if (timeLimitMs !== null) {
				// The time limit of section 4. A process end stops SQLite also inside one long
				// function call, and SQLite rolls back the open transaction at the next open.
				timer = setTimeout(() => {
					this.clearPending();
					this.stop();
					reject(
						new DbError(
							"sql_error",
							`interrupted: the call ran longer than ${timeLimitMs / 1000} s, so the shell stopped it. Make the query faster, for example with an index or a LIMIT.`,
						),
					);
				}, timeLimitMs);
			}
			this.pending = { id, resolve, reject, timer };
			this.worker.send({ ...request, id });
		});
	}
}

module.exports = { DatabaseClient };
