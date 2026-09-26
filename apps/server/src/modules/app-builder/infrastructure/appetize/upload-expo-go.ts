/**
 * Uploads the store Expo Go builds of one SDK to Appetize (WANDIT-196), the
 * same way Expo Snack does. The script `scripts/upload-expo-go-to-appetize.ts`
 * calls it. It reads the Expo versions endpoint, downloads the builds, and
 * uploads or updates one Appetize app per platform through `AppetizeClient`.
 */
import {
	type DevicePlatform,
	expoVersionsResponseSchema,
} from "@wandit/contracts";

import type { AppetizeAppSettings, AppetizeClient } from "./appetize.client";

/** The Expo endpoint that lists the Expo Go builds of each SDK. */
export const EXPO_VERSIONS_URL = "https://exp.host/--/api/v2/versions";

/** Inputs of one upload run. Every I/O is a parameter, so the spec passes fakes. */
export type UploadExpoGoInput = {
	client: Pick<AppetizeClient, "getApp" | "uploadApp" | "updateAppSettings">;
	/** Fetches the versions endpoint and the build files. */
	fetch: typeof fetch;
	/** Expo SDK key of the versions endpoint, for example `57.0.0`. */
	sdkVersion: string;
	/** Current Appetize app of each platform, from `APPETIZE_IOS_PUBLIC_KEY` and `APPETIZE_ANDROID_PUBLIC_KEY`. Undefined creates a new app. */
	publicKeys: Record<DevicePlatform, string | undefined>;
	settings: AppetizeAppSettings;
	/**
	 * Turns the iOS `.tar.gz` of Expo into a `.tar.gz` with an
	 * `Exponent.app` folder. The Expo archive holds the `.app` contents
	 * without the folder, and Appetize needs the folder.
	 */
	packIosApp: (expoArchive: Uint8Array) => Promise<Uint8Array>;
	log: (line: string) => void;
};

/** What the run did for one platform. */
export type UploadedExpoGo = {
	publicKey: string;
	/** Expo Go version of the Appetize app, for example `57.0.9`. */
	expoGoVersion: string;
	/** False when Appetize already had this version; only the settings changed. */
	uploaded: boolean;
};

/**
 * Uploads each platform build when its version changed, then writes the
 * session settings. A new app logs its key: a person puts it in the env.
 * Throws when the SDK has no build for a platform or a call fails.
 */
export async function uploadExpoGoBuilds(
	input: UploadExpoGoInput,
): Promise<Record<DevicePlatform, UploadedExpoGo>> {
	const response = await input.fetch(EXPO_VERSIONS_URL);
	if (!response.ok) {
		throw new Error(`Expo versions answered HTTP ${response.status}`);
	}
	const versions = expoVersionsResponseSchema.parse(await response.json());
	const release = versions.sdkVersions[input.sdkVersion];
	if (release === undefined) {
		throw new Error(`Expo lists no SDK ${input.sdkVersion}`);
	}
	const builds = {
		ios: { url: release.iosClientUrl, version: release.iosClientVersion },
		android: {
			url: release.androidClientUrl,
			version: release.androidClientVersion,
		},
	};

	// One platform after the other: two 200 MB builds in memory at once is too much.
	const ios = await uploadPlatform(input, "ios", builds.ios);
	const android = await uploadPlatform(input, "android", builds.android);
	return { ios, android };
}

/** Uploads one platform build when its version changed, then writes the settings. */
async function uploadPlatform(
	input: UploadExpoGoInput,
	platform: DevicePlatform,
	build: {
		/** Download URL of the build, from the versions endpoint. */
		url?: string;
		/** Expo Go version of the build, for example `57.0.9`. */
		version?: string;
	},
): Promise<UploadedExpoGo> {
	const { url, version } = build;
	if (url === undefined || version === undefined) {
		throw new Error(`SDK ${input.sdkVersion} has no ${platform} Expo Go build`);
	}
	// The note holds the version, so a second run with the same version skips the upload.
	const note = `expo-go:${version}`;
	const publicKey = input.publicKeys[platform];
	const current =
		publicKey === undefined ? null : await input.client.getApp(publicKey);

	const isCurrent = publicKey !== undefined && current?.note === note;
	let appKey: string;
	if (publicKey !== undefined && isCurrent) {
		input.log(`${platform} already has Expo Go ${version}; upload skipped`);
		appKey = publicKey;
	} else {
		input.log(`Downloading Expo Go ${version} for ${platform}`);
		const file = await download(input.fetch, url);
		const app = await input.client.uploadApp({
			publicKey,
			platform,
			...(platform === "ios"
				? {
						file: new Blob([await input.packIosApp(file)]),
						fileName: `Expo-Go-${version}.tar.gz`,
						fileType: "tar.gz",
					}
				: {
						file: new Blob([file]),
						fileName: `Expo-Go-${version}.apk`,
						fileType: "apk",
					}),
			note,
		});
		if (publicKey === undefined) {
			input.log(
				`New ${platform} app: set APPETIZE_${platform.toUpperCase()}_PUBLIC_KEY=${app.publicKey}`,
			);
		}
		appKey = app.publicKey;
	}
	await input.client.updateAppSettings(appKey, input.settings);
	return {
		publicKey: appKey,
		expoGoVersion: version,
		uploaded: !isCurrent,
	};
}

/** Downloads one build file into memory. The builds are 150 to 210 MB. */
async function download(
	fetchImpl: typeof fetch,
	url: string,
): Promise<Uint8Array> {
	const response = await fetchImpl(url);
	if (!response.ok) {
		throw new Error(`Download of ${url} answered HTTP ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}
