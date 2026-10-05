import type { AppetizeApp, DevicePlatform } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { AppetizeAppSettings } from "./appetize.client";
import {
	EXPO_VERSIONS_URL,
	type UploadExpoGoInput,
	uploadExpoGoBuilds,
} from "./upload-expo-go";

const IOS_URL =
	"https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.tar.gz";
const ANDROID_URL =
	"https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.apk";

const SETTINGS: AppetizeAppSettings = {
	timeout: 120,
	timeLimit: 900,
	maxConcurrent: 3,
	referrerHostnamesRestricted: ["wandit.dev"],
};

/** A fetch for the versions endpoint and the two build files. */
const expoFetch: typeof fetch = async (input) => {
	const url = String(input);
	if (url === EXPO_VERSIONS_URL) {
		return Response.json({
			sdkVersions: {
				"56.0.0": {},
				"57.0.0": {
					iosClientUrl: IOS_URL,
					iosClientVersion: "57.0.9",
					androidClientUrl: ANDROID_URL,
					androidClientVersion: "57.0.9",
				},
			},
		});
	}
	return new Response(url === IOS_URL ? "ios-archive" : "android-apk");
};

/** A fake Appetize client that stores apps by key and records each call. */
function fakeAppetize(apps: Map<string, AppetizeApp>) {
	const uploads: {
		publicKey?: string;
		platform: DevicePlatform;
		fileType: string;
		note: string;
	}[] = [];
	const settings: string[] = [];
	const client: UploadExpoGoInput["client"] = {
		getApp: async (publicKey) => {
			const app = apps.get(publicKey);
			if (app === undefined) throw new Error(`no app ${publicKey}`);
			return app;
		},
		uploadApp: async (upload) => {
			uploads.push({
				publicKey: upload.publicKey,
				platform: upload.platform,
				fileType: upload.fileType,
				note: upload.note,
			});
			const publicKey = upload.publicKey ?? `new-${upload.platform}`;
			const app: AppetizeApp = {
				publicKey,
				platform: upload.platform,
				note: upload.note,
			};
			apps.set(publicKey, app);
			return app;
		},
		updateAppSettings: async (publicKey) => {
			settings.push(publicKey);
			const app = apps.get(publicKey);
			if (app === undefined) throw new Error(`no app ${publicKey}`);
			return app;
		},
	};
	return { client, uploads, settings };
}

describe("uploadExpoGoBuilds", () => {
	it("creates both apps, packs the iOS archive, and logs the new keys", async () => {
		const appetize = fakeAppetize(new Map());
		const logs: string[] = [];
		const packed: string[] = [];

		const result = await uploadExpoGoBuilds({
			client: appetize.client,
			fetch: expoFetch,
			sdkVersion: "57.0.0",
			publicKeys: { ios: undefined, android: undefined },
			settings: SETTINGS,
			packIosApp: async (archive) => {
				packed.push(new TextDecoder().decode(archive));
				return new TextEncoder().encode("packed");
			},
			log: (line) => logs.push(line),
		});

		expect(packed).toEqual(["ios-archive"]);
		expect(appetize.uploads).toEqual([
			{
				publicKey: undefined,
				platform: "ios",
				fileType: "tar.gz",
				note: "expo-go:57.0.9",
			},
			{
				publicKey: undefined,
				platform: "android",
				fileType: "apk",
				note: "expo-go:57.0.9",
			},
		]);
		expect(appetize.settings).toEqual(["new-ios", "new-android"]);
		expect(logs).toContain("New ios app: set APPETIZE_IOS_PUBLIC_KEY=new-ios");
		expect(result.android).toEqual({
			publicKey: "new-android",
			expoGoVersion: "57.0.9",
			uploaded: true,
		});
	});

	it("skips the upload of a version the app already has and still writes the settings", async () => {
		const apps = new Map<string, AppetizeApp>([
			[
				"pk-ios",
				{ publicKey: "pk-ios", platform: "ios", note: "expo-go:57.0.9" },
			],
			[
				"pk-android",
				{
					publicKey: "pk-android",
					platform: "android",
					note: "expo-go:57.0.8",
				},
			],
		]);
		const appetize = fakeAppetize(apps);

		const result = await uploadExpoGoBuilds({
			client: appetize.client,
			fetch: expoFetch,
			sdkVersion: "57.0.0",
			publicKeys: { ios: "pk-ios", android: "pk-android" },
			settings: SETTINGS,
			packIosApp: async () => {
				throw new Error("the iOS build must not download");
			},
			log: () => {},
		});

		expect(result.ios.uploaded).toBe(false);
		expect(result.android.uploaded).toBe(true);
		// The update keeps the key of the existing Android app.
		expect(appetize.uploads).toEqual([
			{
				publicKey: "pk-android",
				platform: "android",
				fileType: "apk",
				note: "expo-go:57.0.9",
			},
		]);
		expect(appetize.settings).toEqual(["pk-ios", "pk-android"]);
	});

	it("throws for an SDK that has no Expo Go build", async () => {
		const appetize = fakeAppetize(new Map());

		await expect(
			uploadExpoGoBuilds({
				client: appetize.client,
				fetch: expoFetch,
				sdkVersion: "56.0.0",
				publicKeys: { ios: undefined, android: undefined },
				settings: SETTINGS,
				packIosApp: async (archive) => archive,
				log: () => {},
			}),
		).rejects.toThrow("SDK 56.0.0 has no ios Expo Go build");
		expect(appetize.uploads).toEqual([]);
	});
});
