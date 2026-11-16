/**
 * Entry file of the desktop shell (docs/v2/desktop-apps.md, sections 3, 5, 9, and 10).
 * Electron runs it in the main process. It reads wandit.desktop.json, locks the network,
 * and migrates the database in the database process before the window exists. Then it opens
 * the locked window, sets the native menu, answers the 4 commands, and checks for updates.
 * With `--wandit-self-test`, it only tests the packed migrations for the CI, then exits.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, utilityProcess } = require("electron");
const { registerCommands } = require("./commands.js");
const { readDesktopConfig } = require("./config.js");
const { selfTest } = require("./db/app-database.js");
const { DatabaseClient } = require("./db/client.js");
const { showDialog } = require("./dialogs.js");
const { installMenu } = require("./menu.js");
const { dataBaseDir, dataPaths } = require("./paths.js");
const { checkForUpdates } = require("./updater.js");
const {
	createMainWindow,
	lockEveryWebContents,
	lockSession,
	registerAppScheme,
	serveFrontend,
} = require("./window.js");

/** The argument that starts the self-test (section 9). The CI runs the built app with it. */
const SELF_TEST_FLAG = "--wandit-self-test";

// A packed app holds `dist/` and `migrations/` inside the app archive, next to `src/`.
// A local run of the shell folder reads them next to the shell folder, as the build input has them.
const appRoot = app.getAppPath();
const contentRoot = app.isPackaged ? appRoot : path.dirname(appRoot);
const migrationsDir = path.join(contentRoot, "migrations");

// Network lock (section 3): the page has no remote network. These switches close the
// channels that the CSP does not control. Chromium reads them only before `ready`.
// Every host name fails, so DNS prefetch and WebRTC send no DNS query.
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");
// No service listens on loopback port 1, so no request of Chromium reaches a host.
app.commandLine.appendSwitch("proxy-server", "http://127.0.0.1:1");
app.commandLine.appendSwitch(
	"force-webrtc-ip-handling-policy",
	"disable_non_proxied_udp",
);

// The CI self-test (section 9). It opens no window and uses no network. It never touches
// the app data folder: it works in a new temp folder and deletes it at the end.
// Prints one result line and ends the app with the code 0 or 1.
async function runSelfTest() {
	let line;
	let exitCode = 1;
	try {
		// A new folder on each run, so the test never runs on old data.
		const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "wandit-self-test-"));
		try {
			const count = await selfTest(dataPaths(baseDir), migrationsDir);
			line = `wandit-self-test: ok, ${count} migrations`;
			exitCode = 0;
		} finally {
			try {
				fs.rmSync(baseDir, { recursive: true, force: true });
			} catch (error) {
				// A folder that stays does not change the result. CI runners are new for each job.
				console.error(
					`wandit-self-test: the temp folder ${baseDir} stays: ${error.message}`,
				);
			}
		}
	} catch (error) {
		// Security: one line only. So no line of the user SQL starts with "::" and becomes
		// a command of the GitHub runner.
		line = `wandit-self-test: failed: ${error.message.replace(/[\r\n]/g, " ")}`;
	}
	try {
		// A synchronous write: the line is out before the app ends, also on a Windows pipe.
		fs.writeSync(process.stdout.fd, `${line}\n`);
	} catch (error) {
		console.error(
			`wandit-self-test: the result line was not written: ${error.message}`,
		);
		exitCode = 1;
	}
	app.exit(exitCode);
}

// Starts worker.js as a utility process of Electron and wraps it for db/client.js.
function spawnDatabaseWorker() {
	const child = utilityProcess.fork(
		path.join(__dirname, "db", "worker.js"),
		[],
		{
			serviceName: "Wandit Database",
		},
	);
	return {
		send: (request) => child.postMessage(request),
		kill: () => child.kill(),
		onMessage: (listener) => child.on("message", listener),
		onExit: (listener) => child.on("exit", listener),
	};
}

function startApp() {
	const config = readDesktopConfig(path.join(appRoot, "wandit.desktop.json"));
	const paths = dataPaths(
		dataBaseDir(
			{
				platform: process.platform,
				localAppData: process.env.LOCALAPPDATA,
				homeDir: os.homedir(),
			},
			config.identifier,
		),
	);
	// The macOS app menu and the dialogs show this name. The file names stay ASCII.
	app.setName(config.productName);
	// Chromium keeps its own files apart from the database and the backups.
	app.setPath("userData", paths.chromiumDir);

	// A second start of the app only focuses the first window. This makes sure that two
	// processes never migrate one file.
	if (!app.requestSingleInstanceLock()) {
		app.quit();
		return;
	}
	/** @type {import("electron").BrowserWindow | null} */
	let mainWindow = null;
	app.on("second-instance", () => {
		if (mainWindow === null || mainWindow.isDestroyed()) {
			return;
		}
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.show();
		mainWindow.focus();
	});
	// When the last window closes, the app quits, on both systems.
	app.on("window-all-closed", () => app.quit());

	registerAppScheme();
	lockEveryWebContents();

	const client = new DatabaseClient({
		spawnWorker: spawnDatabaseWorker,
		openOptions: { paths, migrationsDir, appVersion: config.version },
	});
	app.on("will-quit", () => client.stop());
	const updaterOptions = { config, client, updatesDir: paths.updatesDir };

	app
		.whenReady()
		.then(async () => {
			// The runner ends before the window exists, so the page never queries a file that
			// is not migrated.
			let opened;
			try {
				opened = await client.start();
			} catch (error) {
				opened = { status: "failed", reason: error.message };
			}
			lockSession();
			serveFrontend(path.join(contentRoot, "dist"));
			registerCommands({ client, getMainWindow: () => mainWindow });
			installMenu({
				client,
				productName: config.productName,
				version: config.version,
				checkForUpdates: () => checkForUpdates(updaterOptions, true),
			});
			mainWindow = createMainWindow(config.productName);
			if (opened.status === "failed") {
				// Not awaited: the update check below must start while the dialog is open.
				showDialog({
					type: "error",
					title: "The data did not open",
					text: `The app could not open or update its data. The step that failed changed no data.\n\n${opened.reason}`,
				});
			}
			try {
				// The update file of an earlier install is of no use after the start.
				fs.rmSync(paths.updatesDir, { recursive: true, force: true });
			} catch (error) {
				// On Windows, the setup exe can still run for a moment. The next start deletes it.
				console.error(`Update cleanup: ${error.message}`);
			}
			// The check runs also after a failed start, so a fixed build or a rollback reaches the user.
			checkForUpdates(updaterOptions, false);
		})
		.catch((error) => {
			// The start failed before the window opened. The user must see a reason, not an app with no window.
			console.error(`The app did not start: ${error.message}`);
			showDialog({
				type: "error",
				title: "The app did not open",
				text: error.message,
			}).finally(() => app.exit(1));
		});
}

if (process.argv.includes(SELF_TEST_FLAG)) {
	runSelfTest();
} else {
	startApp();
}
