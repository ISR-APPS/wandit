/**
 * Uploads the store Expo Go builds of one SDK to Appetize (WANDIT-196).
 * A person runs it after an Expo Go release or an SDK bump of the
 * mobile-app template. It reads `APPETIZE_API_TOKEN` and the two public keys
 * from the env and calls `uploadExpoGoBuilds`. Exit code 1 on a failure.
 *
 * Usage (from apps/server):
 *   pnpm appetize:upload-expo-go -- --sdk 57.0.0 --max-concurrent 3 \
 *     --referrers wandit.dev,staging.wandit.dev
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, promisify } from "node:util";

import { env } from "@wandit/env/server";

import {
	DEVICE_SESSION_IDLE_TIMEOUT_SECONDS,
	DEVICE_SESSION_TIME_LIMIT_SECONDS,
} from "../src/modules/app-builder/domain/device-minutes";
import { AppetizeClient } from "../src/modules/app-builder/infrastructure/appetize/appetize.client";
import { uploadExpoGoBuilds } from "../src/modules/app-builder/infrastructure/appetize/upload-expo-go";

const run = promisify(execFile);

const { values } = parseArgs({
	options: {
		// The SDK of templates/mobile-app; the store Expo Go must match it.
		sdk: { type: "string", default: "57.0.0" },
		// The Starter plan of Appetize runs 3 devices at a time.
		"max-concurrent": { type: "string", default: "3" },
		referrers: { type: "string", default: "wandit.dev,staging.wandit.dev" },
	},
});

/**
 * The Expo archive holds the `.app` contents without the folder. This puts
 * them in `Exponent.app/` and packs that folder again, as Appetize needs.
 */
async function packIosApp(expoArchive: Uint8Array): Promise<Uint8Array> {
	const dir = await mkdtemp(join(tmpdir(), "expo-go-ios-"));
	try {
		await writeFile(join(dir, "expo.tar.gz"), expoArchive);
		await mkdir(join(dir, "Exponent.app"));
		await run("tar", [
			"-xzf",
			join(dir, "expo.tar.gz"),
			"-C",
			join(dir, "Exponent.app"),
		]);
		// COPYFILE_DISABLE stops macOS tar from adding `._*` files.
		await run(
			"tar",
			["-czf", join(dir, "app.tar.gz"), "-C", dir, "Exponent.app"],
			{
				env: { ...process.env, COPYFILE_DISABLE: "1" },
			},
		);
		return new Uint8Array(await readFile(join(dir, "app.tar.gz")));
	} finally {
		await rm(dir, { force: true, recursive: true });
	}
}

if (env.APPETIZE_API_TOKEN === undefined) {
	throw new Error("APPETIZE_API_TOKEN is not set");
}
const maxConcurrent = Number(values["max-concurrent"]);
if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
	throw new Error("--max-concurrent must be a positive integer");
}

try {
	const result = await uploadExpoGoBuilds({
		client: new AppetizeClient({ token: env.APPETIZE_API_TOKEN }),
		fetch,
		log: (line) => process.stdout.write(`${line}\n`),
		packIosApp,
		publicKeys: {
			android: env.APPETIZE_ANDROID_PUBLIC_KEY,
			ios: env.APPETIZE_IOS_PUBLIC_KEY,
		},
		sdkVersion: values.sdk,
		settings: {
			maxConcurrent,
			referrerHostnamesRestricted: values.referrers.split(",").filter(Boolean),
			timeLimit: DEVICE_SESSION_TIME_LIMIT_SECONDS,
			timeout: DEVICE_SESSION_IDLE_TIMEOUT_SECONDS,
		},
	});
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
	process.stderr.write(`Upload failed: ${String(error)}\n`);
	process.exitCode = 1;
}
