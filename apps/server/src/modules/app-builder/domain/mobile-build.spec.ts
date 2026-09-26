import type { ExpoAppJson } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	checkConfigPlugins,
	easIdentityFor,
	pluginPackageName,
	statusesThatMayMoveTo,
	withWanditEasIdentity,
} from "./mobile-build";

const PROJECT_ID = "0F3A9C1B-4E7D-4A2B-9C3D-1E2F3A4B5C6D";

describe("statusesThatMayMoveTo", () => {
	it("lets only a live build move to building, finished, failed, or canceled", () => {
		expect(statusesThatMayMoveTo("building")).toEqual(["queued"]);
		expect(statusesThatMayMoveTo("finished")).toEqual(["building"]);
		expect(statusesThatMayMoveTo("failed")).toEqual(["queued", "building"]);
		expect(statusesThatMayMoveTo("canceled")).toEqual(["queued", "building"]);
	});

	it("never moves a row back to queued", () => {
		expect(statusesThatMayMoveTo("queued")).toEqual([]);
	});
});

describe("easIdentityFor", () => {
	it("builds the slug and the Android package from the full project id", () => {
		expect(easIdentityFor(PROJECT_ID, "wandit")).toEqual({
			account: "wandit",
			androidPackage: "app.wandit.p0f3a9c1b4e7d4a2b9c3d1e2f3a4b5c6d",
			slug: "p0f3a9c1b4e7d4a2b9c3d1e2f3a4b5c6d",
		});
	});
});

describe("withWanditEasIdentity", () => {
	it("replaces the user EAS identity and keeps every other key", () => {
		const appJson: ExpoAppJson = {
			expo: {
				android: {
					adaptiveIcon: { backgroundColor: "#fff" },
					package: "com.evil",
				},
				extra: {
					eas: { projectId: "someone-else" },
					router: { origin: false },
				},
				name: "Nadi",
				owner: "someone",
				plugins: ["expo-router"],
				slug: "my-app",
			},
		};

		const result = withWanditEasIdentity(
			appJson,
			easIdentityFor(PROJECT_ID, "wandit"),
		);

		expect(result.expo).toEqual({
			android: {
				adaptiveIcon: { backgroundColor: "#fff" },
				package: "app.wandit.p0f3a9c1b4e7d4a2b9c3d1e2f3a4b5c6d",
			},
			extra: { router: { origin: false } },
			name: "Nadi",
			owner: "wandit",
			plugins: ["expo-router"],
			slug: "p0f3a9c1b4e7d4a2b9c3d1e2f3a4b5c6d",
		});
	});
});

describe("pluginPackageName", () => {
	it("answers the package of a bare, scoped, or subpath module name", () => {
		expect(pluginPackageName("expo-router")).toBe("expo-router");
		expect(pluginPackageName("expo-router/plugin")).toBe("expo-router");
		expect(pluginPackageName("@sentry/react-native/expo")).toBe(
			"@sentry/react-native",
		);
	});

	it("refuses a file path or a segment that leaves the package", () => {
		expect(pluginPackageName("./plugins/with-evil.js")).toBeNull();
		expect(pluginPackageName("/tmp/evil.js")).toBeNull();
		expect(pluginPackageName("expo-router/../../evil")).toBeNull();
		expect(pluginPackageName("expo-router/./x")).toBeNull();
	});
});

describe("checkConfigPlugins", () => {
	const template = { expo: "57.0.25", "expo-router": "6.0.1" };
	const native = { "expo-camera": "~57.0.5", "expo-router": "~6.0.1" };

	it("adds an allowed module the template lacks at its SDK range", () => {
		expect(
			checkConfigPlugins(
				["expo-router", ["expo-camera", { cameraPermission: "Scan" }]],
				template,
				native,
			),
		).toEqual({
			extraDependencies: { "expo-camera": "~57.0.5" },
			kind: "allowed",
		});
	});

	it("refuses a module outside the template and the allowed modules", () => {
		expect(checkConfigPlugins(["evil-plugin"], template, native)).toEqual({
			kind: "refused",
			moduleName: "evil-plugin",
		});
	});

	it("refuses a prototype key as a package name", () => {
		expect(checkConfigPlugins(["constructor"], template, native)).toEqual({
			kind: "refused",
			moduleName: "constructor",
		});
	});

	it("refuses a local plugin file", () => {
		expect(checkConfigPlugins(["./plugin.js"], template, native)).toEqual({
			kind: "refused",
			moduleName: "./plugin.js",
		});
	});
});
