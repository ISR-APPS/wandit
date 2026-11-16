// Takes screenshots of a starter project that materialize.mjs made.
// Run: node templates/starters/scripts/shot.mjs <workDir> <outDir>
//      [--paths /,/@1800,/app] [--mobile] [--full] [--widths 1024,1280] [--publish <id>]
// An author runs it to look at the pages and to publish the catalog images.
// It starts the Vite dev server of <workDir>, drives Chromium through the Playwright
// of apps/server, and with --publish converts with the sharp of apps/server. No backend exists, so it answers
// the Supabase calls of the pages behind sign-in with fixed JSON.
import { execFileSync, spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";
import {
	assertStarterId,
	PNPM_COMMAND,
	REPO_ROOT,
	runScript,
} from "./starter-source.mjs";

const USAGE =
	"usage: node templates/starters/scripts/shot.mjs <workDir> <outDir> [--paths /,/@1800,/app] [--mobile] [--full] [--widths 1024,1280] [--publish <id>]";

/** A host that no project has. Each request to it gets an answer from `answerSupabase`. */
const SUPABASE_URL = "https://starter-shot.supabase.co";
/** supabase-js builds its localStorage key from the first label of the host. */
const SESSION_STORAGE_KEY = "sb-starter-shot-auth-token";
/** Loads packages from apps/server: Playwright for the browser, sharp for the WebP files. */
const serverRequire = createRequire(
	join(REPO_ROOT, "apps", "server", "package.json"),
);

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
/** The catalog image size of the web app. It has the 16:10 ratio of the desktop viewport. */
const PUBLISH_SIZE = { width: 1280, height: 800 };
/** The catalog type allows cover.webp and shot-1.webp to shot-3.webp. */
const MAX_PUBLISH_PATHS = 4;

const NOW_ISO = new Date().toISOString();
/** A fictional account. example.com is a reserved documentation domain. */
const DEMO_USER = {
	id: "00000000-0000-4000-8000-000000000001",
	aud: "authenticated",
	role: "authenticated",
	email: "demo@example.com",
	email_confirmed_at: NOW_ISO,
	app_metadata: { provider: "email", providers: ["email"] },
	user_metadata: {},
	identities: [],
	created_at: NOW_ISO,
	updated_at: NOW_ISO,
};
/** One row of public.profiles, with the columns of supabase/migrations/0000_base.sql. */
const DEMO_PROFILE = {
	id: DEMO_USER.id,
	full_name: "Demo User",
	created_at: NOW_ISO,
	updated_at: NOW_ISO,
};

/** A session that auth-js accepts from storage: it reads `access_token`, `refresh_token`, and `expires_at`. */
function demoSession() {
	// One day. auth-js refreshes a token only in its last 90 seconds, so no refresh call starts.
	const expiresIn = 24 * 60 * 60;
	const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
	const encode = (value) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	// The token has the form of a JWT. No server checks its signature here.
	const accessToken = [
		encode({ alg: "HS256", typ: "JWT" }),
		encode({
			sub: DEMO_USER.id,
			aud: DEMO_USER.aud,
			role: DEMO_USER.role,
			email: DEMO_USER.email,
			exp: expiresAt,
		}),
		"starter-shot",
	].join(".");
	return {
		access_token: accessToken,
		refresh_token: "starter-shot-refresh",
		token_type: "bearer",
		expires_in: expiresIn,
		expires_at: expiresAt,
		user: DEMO_USER,
	};
}

/** The fixed answer to one request to the dummy Supabase host: `{ status, body }`. */
function answerSupabase(request, session) {
	const { pathname } = new URL(request.url());
	if (pathname === "/auth/v1/user") {
		return { status: 200, body: DEMO_USER };
	}
	if (pathname === "/auth/v1/token") {
		return { status: 200, body: session };
	}
	if (pathname.startsWith("/auth/v1/")) {
		return { status: 200, body: {} };
	}
	if (pathname === "/rest/v1/profiles" && request.method() === "GET") {
		// `.single()` asks for one object. All other reads get a list of rows.
		const wantsObject = (request.headers().accept ?? "").includes(
			"vnd.pgrst.object",
		);
		return { status: 200, body: wantsObject ? DEMO_PROFILE : [DEMO_PROFILE] };
	}
	// A starter makes no other Supabase call. The author sees the line and removes the call.
	console.warn(
		`warning: no fixed answer for ${request.method()} ${pathname}. A starter must not call Supabase there.`,
	);
	return {
		status: 404,
		body: { message: `starter-shot has no answer for ${pathname}` },
	};
}

/**
 * Reads one item of --paths: a URL path, then an optional "@<pixels>".
 * "/@1800" is the home page with 1800 px scrolled away: the view of one section of a long page.
 * Returns `{ path, top }`, or null for a bad item.
 */
function parseTarget(text) {
	const match = /^(\/[^@]*)(?:@(\d+))?$/.exec(text);
	if (match === null) {
		return null;
	}
	return { path: match[1], top: Number(match[2] ?? 0) };
}

/** Reads the command line. Throws on a bad argument: node:util names an unknown option, the rest gets the usage text. */
function parseArgs(argv) {
	const { values, positionals } = parseNodeArgs({
		args: argv,
		allowPositionals: true,
		options: {
			paths: { type: "string", default: "/" },
			mobile: { type: "boolean", default: false },
			full: { type: "boolean", default: false },
			widths: { type: "string", default: "" },
			publish: { type: "string" },
		},
	});
	const targets = values.paths.split(",").map(parseTarget);
	const widths =
		values.widths === "" ? [] : values.widths.split(",").map(Number);
	if (
		positionals.length !== 2 ||
		targets.includes(null) ||
		// 320 px is the smallest phone in use. 3840 px is a 4K screen.
		widths.some(
			(width) => !Number.isInteger(width) || width < 320 || width > 3840,
		)
	) {
		throw new Error(USAGE);
	}
	return {
		targets,
		widths,
		mobile: values.mobile,
		full: values.full,
		publishId: values.publish ?? null,
		workDir: resolve(positionals[0]),
		outDir: resolve(positionals[1]),
	};
}

/** A TCP port that is free now. Vite gets it with --strictPort, so a lost race fails fast. */
function findFreePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, () => {
			const { port } = server.address();
			server.close(() => resolvePort(port));
		});
	});
}

/**
 * Starts the dev server of `workDir` and waits until it answers.
 * Returns `{ origin, stop }`. `stop` ends the server and each child of it.
 */
async function startDevServer(workDir) {
	const port = await findFreePort();
	const origin = `http://localhost:${port}`;
	const [command, ...prefix] = PNPM_COMMAND;
	const child = spawn(
		command,
		[...prefix, "exec", "vite", "dev", "--port", String(port), "--strictPort"],
		// A new process group: npx, pnpm, vite, and workerd then stop with one signal.
		{ cwd: workDir, detached: true, stdio: ["ignore", "pipe", "pipe"] },
	);
	let log = "";
	child.stdout.on("data", (chunk) => {
		log += chunk;
	});
	child.stderr.on("data", (chunk) => {
		log += chunk;
	});
	let spawnError = null;
	const exited = new Promise((resolveExit) => {
		child.on("exit", resolveExit);
		// npx is missing or cannot start. No "exit" event comes after this one.
		child.on("error", (error) => {
			spawnError = error;
			resolveExit();
		});
	});

	const signalGroup = (signal) => {
		if (child.pid === undefined) {
			// The spawn failed, so no process group exists.
			return;
		}
		try {
			// A negative pid sends the signal to the whole process group.
			process.kill(-child.pid, signal);
		} catch (error) {
			// ESRCH: the group is gone. EPERM: macOS answers it when each process of the group ended.
			if (error.code !== "ESRCH" && error.code !== "EPERM") {
				throw error;
			}
		}
	};
	const stop = async () => {
		signalGroup("SIGTERM");
		// 5 seconds for a clean stop. Then the kill signal, which no process can ignore.
		const timer = setTimeout(() => signalGroup("SIGKILL"), 5000);
		await exited;
		clearTimeout(timer);
		// npx ends first. This signal ends a child that is slower than npx.
		signalGroup("SIGKILL");
		// EPERM hides a real refusal, so the port must be silent now.
		const answers = await fetch(origin, { signal: AbortSignal.timeout(2000) })
			.then(() => true)
			.catch(() => false);
		if (answers) {
			throw new Error(
				`The dev server still answers on ${origin}. Stop process group ${child.pid} by hand.`,
			);
		}
	};

	// The group is detached, so Ctrl-C in the terminal does not reach it. This handler stops it.
	for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
		process.once(signal, () => {
			stop()
				// stop() rejects when the server still answers. The author must see that message.
				.catch((error) => console.error(`error: ${error.message}`))
				.finally(() => process.exit(1));
		});
	}

	// 120 seconds: the first start also compiles the dependencies.
	const deadline = Date.now() + 120_000;
	for (;;) {
		if (
			spawnError !== null ||
			child.exitCode !== null ||
			child.signalCode !== null
		) {
			// npx can end before a child of the group. stop() also ends that child.
			await stop();
			throw new Error(
				`The dev server stopped at start:\n${spawnError?.message ?? log}`,
			);
		}
		try {
			await fetch(origin, { signal: AbortSignal.timeout(5000) });
			return { origin, stop };
		} catch (error) {
			// Not ready yet: the connection is refused, or the first answer is slow.
			if (Date.now() > deadline) {
				await stop();
				throw new Error(
					`The dev server did not answer in 120 seconds (${error.message}):\n${log}`,
				);
			}
			await new Promise((resolveWait) => setTimeout(resolveWait, 300));
		}
	}
}

/** Starts the Chromium of the Playwright in apps/server. Installs that browser when it is missing. */
async function launchBrowser() {
	const { chromium } = serverRequire("playwright");
	// This script owns the signals. Playwright must not end the process before stop() ends.
	const launchOptions = {
		handleSIGINT: false,
		handleSIGTERM: false,
		handleSIGHUP: false,
	};
	try {
		return await chromium.launch(launchOptions);
	} catch (error) {
		if (!String(error.message).includes("Executable doesn't exist")) {
			throw error;
		}
		const cli = join(
			dirname(serverRequire.resolve("playwright/package.json")),
			"cli.js",
		);
		execFileSync(process.execPath, [cli, "install", "chromium"], {
			stdio: "inherit",
		});
		return chromium.launch(launchOptions);
	}
}

/** The file name part of a target: "/" gives "home", "/app/orders" gives "app-orders", "/@1800" gives "home-at-1800". */
function nameOfTarget({ path, top }) {
	const name = path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-");
	return `${name === "" ? "home" : name}${top > 0 ? `-at-${top}` : ""}`;
}

/**
 * Opens `path` in a new page of `viewport` size and gets it ready for a shot.
 * It waits for the load and the fonts, then scrolls down and back one time.
 */
async function openPage(browser, origin, path, viewport, session) {
	const context = await browser.newContext({ viewport });
	// auth-js reads the session from localStorage at its first call, so it must exist before page load.
	await context.addInitScript(
		([key, value]) => window.localStorage.setItem(key, value),
		[SESSION_STORAGE_KEY, JSON.stringify(session)],
	);
	await context.route(`${SUPABASE_URL}/**`, (route) => {
		const { status, body } = answerSupabase(route.request(), session);
		return route.fulfill({
			status,
			contentType: "application/json",
			// The page origin is localhost, so the browser needs the CORS header.
			headers: { "access-control-allow-origin": "*" },
			body: JSON.stringify(body),
		});
	});
	const page = await context.newPage();
	page.on("pageerror", (error) => {
		console.warn(`warning: page error on ${path}: ${error.message}`);
	});
	await page.goto(`${origin}${path}`, { waitUntil: "load" });
	// The pages behind sign-in render in the browser only, after their module and data requests.
	await page.waitForLoadState("networkidle");
	const finalPath = new URL(page.url()).pathname;
	if (path.startsWith("/app") && !finalPath.startsWith("/app")) {
		throw new Error(
			`${path} went to ${finalPath}. The fixed session did not sign the page in.`,
		);
	}
	await page.evaluate(async () => {
		await document.fonts.ready;
		// One pass down the page starts the lazy images and the reveal animations.
		const step = window.innerHeight;
		for (let top = 0; top < document.body.scrollHeight; top += step) {
			window.scrollTo(0, top);
			await new Promise((resolveWait) => setTimeout(resolveWait, 150));
		}
		window.scrollTo(0, 0);
	});
	await page.waitForLoadState("networkidle");
	// 500 ms lets the last reveal transition and the scroll to the top end.
	await page.waitForTimeout(500);
	const overflowPx = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	// LIMIT: a parent with "overflow: hidden" hides a child that is too wide. Upgrade: measure each section.
	if (overflowPx > 0) {
		console.warn(
			`warning: ${path} is ${overflowPx} px wider than the ${viewport.width} px viewport. The page scrolls sideways.`,
		);
	}
	return { context, page };
}

/**
 * Shoots one target. Returns the path of its desktop file, which --publish uses.
 * A target with `top` above 0 gives only the desktop view at that scroll position.
 */
async function shootTarget(browser, origin, target, options, session) {
	const { path, top } = target;
	const name = nameOfTarget(target);
	const desktop = await openPage(
		browser,
		origin,
		path,
		DESKTOP_VIEWPORT,
		session,
	);
	if (top > 0) {
		const sectionFile = join(options.outDir, `${name}.png`);
		// "instant": a page with smooth scroll must not be in motion at the shot.
		await desktop.page.evaluate(
			(scrollTop) => window.scrollTo({ top: scrollTop, behavior: "instant" }),
			top,
		);
		// 600 ms lets a sticky header and a reveal transition end.
		await desktop.page.waitForTimeout(600);
		await desktop.page.screenshot({ path: sectionFile });
		console.log(`wrote ${sectionFile}`);
		await desktop.context.close();
		return sectionFile;
	}
	const topFile = join(options.outDir, `${name}-top.png`);
	await desktop.page.screenshot({ path: topFile });
	console.log(`wrote ${topFile}`);
	if (options.full) {
		const fullFile = join(options.outDir, `${name}-full.png`);
		await desktop.page.screenshot({ path: fullFile, fullPage: true });
		console.log(`wrote ${fullFile}`);
	}
	await desktop.context.close();
	if (options.mobile) {
		const mobile = await openPage(
			browser,
			origin,
			path,
			MOBILE_VIEWPORT,
			session,
		);
		const mobileFile = join(options.outDir, `${name}-mobile.png`);
		await mobile.page.screenshot({ path: mobileFile });
		console.log(`wrote ${mobileFile}`);
		if (options.full) {
			const mobileFullFile = join(options.outDir, `${name}-mobile-full.png`);
			await mobile.page.screenshot({ path: mobileFullFile, fullPage: true });
			console.log(`wrote ${mobileFullFile}`);
		}
		await mobile.context.close();
	}
	for (const width of options.widths) {
		const sized = await openPage(
			browser,
			origin,
			path,
			{ width, height: DESKTOP_VIEWPORT.height },
			session,
		);
		const widthFile = join(options.outDir, `${name}-w${width}.png`);
		await sized.page.screenshot({ path: widthFile });
		console.log(`wrote ${widthFile}`);
		await sized.context.close();
	}
	return topFile;
}

/** Writes cover.webp and shot-N.webp of one starter into the public folder of the web app. */
async function publishImages(id, topFiles) {
	const sharp = serverRequire("sharp");
	const publicDir = join(
		REPO_ROOT,
		"apps",
		"web",
		"public",
		"starter-templates",
		id,
	);
	// An old shot-3.webp must not stay when the new set has two shots.
	rmSync(publicDir, { recursive: true, force: true });
	mkdirSync(publicDir, { recursive: true });
	for (const [index, topFile] of topFiles.entries()) {
		const outFile = join(
			publicDir,
			index === 0 ? "cover.webp" : `shot-${index}.webp`,
		);
		// Quality 80 keeps the text of the cards sharp at about 40 KB for each image.
		await sharp(topFile)
			.resize(PUBLISH_SIZE.width, PUBLISH_SIZE.height)
			.webp({ quality: 80 })
			.toFile(outFile);
		console.log(`wrote ${outFile}`);
	}
	console.log(`shots: ${topFiles.length - 1}`);
}

/** Gives the browser bundle a Supabase URL, so `getSupabase()` does not throw. Keeps a real .env. */
function writeDummyEnv(workDir) {
	const envFile = join(workDir, ".env");
	if (
		existsSync(envFile) &&
		!readFileSync(envFile, "utf8").includes(SUPABASE_URL)
	) {
		throw new Error(
			`${envFile} exists and is not from this script. Move it away first.`,
		);
	}
	writeFileSync(
		envFile,
		`VITE_SUPABASE_URL=${SUPABASE_URL}\nVITE_SUPABASE_ANON_KEY=starter-shot-anon-key\n`,
	);
}

await runScript(async () => {
	const options = parseArgs(process.argv.slice(2));
	if (options.publishId !== null) {
		assertStarterId(options.publishId);
		if (options.targets.length > MAX_PUBLISH_PATHS) {
			throw new Error(
				`--publish takes at most ${MAX_PUBLISH_PATHS} paths: the cover and 3 shots.`,
			);
		}
	}
	if (!existsSync(join(options.workDir, "node_modules", "vite"))) {
		throw new Error(
			`${options.workDir} has no installed project. Run materialize.mjs first.`,
		);
	}
	mkdirSync(options.outDir, { recursive: true });
	writeDummyEnv(options.workDir);

	const server = await startDevServer(options.workDir);
	let browser;
	try {
		browser = await launchBrowser();
		const session = demoSession();
		const topFiles = [];
		for (const target of options.targets) {
			topFiles.push(
				await shootTarget(browser, server.origin, target, options, session),
			);
		}
		if (options.publishId !== null) {
			await publishImages(options.publishId, topFiles);
		}
	} finally {
		try {
			await browser?.close();
		} finally {
			// The dev server group is detached. It must stop also when the browser close fails.
			await server.stop();
		}
	}
});
