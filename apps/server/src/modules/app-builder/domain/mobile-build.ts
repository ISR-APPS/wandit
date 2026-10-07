/**
 * The pure rules of a V2 mobile build (WANDIT-194): the status machine, the
 * EAS identity of a project, and the app.json checks before a build.
 * The mobile builds service, the repository, and the `mobile-build` task
 * call these functions. Nothing here does IO.
 */
import {
	type ExpoAppJson,
	type ExpoPluginEntry,
	type MobileBuildStatus,
	mobileBuildStatuses,
} from "@wandit/contracts";

/** The next statuses of each status. A terminal status has none. */
const MOBILE_BUILD_TRANSITIONS: Readonly<
	Record<MobileBuildStatus, readonly MobileBuildStatus[]>
> = {
	queued: ["building", "failed", "canceled"],
	building: ["finished", "failed", "canceled"],
	finished: [],
	failed: [],
	canceled: [],
};

/**
 * The statuses a row must hold before a compare-and-set to `to`. The
 * repository puts them in the WHERE clause, so a stale writer changes
 * nothing.
 */
export function statusesThatMayMoveTo(
	to: MobileBuildStatus,
): MobileBuildStatus[] {
	return mobileBuildStatuses.filter((from) =>
		MOBILE_BUILD_TRANSITIONS[from].includes(to),
	);
}

/**
 * Idempotency key of the credit hold of one build. The API reserves the
 * hold with it; the `mobile-build` task settles or refunds the same hold.
 */
export function mobileBuildHoldKey(buildId: string): string {
	return `mobile_build:${buildId}`;
}

/** The EAS names of one project under the wandit Expo organization. */
export type EasProjectIdentity = {
	/** `EXPO_ACCOUNT`: the Expo organization that owns the EAS project. */
	account: string;
	/** EAS project slug, also the last segment of the Android package. */
	slug: string;
	/** Android application id, for example `app.wandit.p0f3...`. */
	androidPackage: string;
};

/**
 * The EAS names of a project. The slug holds the full project id, not a
 * short prefix: two projects must never share an EAS project, because they
 * would share the keystore that signs their APKs. The id never changes, so
 * an installed APK always accepts the next one.
 */
export function easIdentityFor(
	projectId: string,
	account: string,
): EasProjectIdentity {
	// `p` first: an Android package segment must start with a letter.
	const slug = `p${projectId.replaceAll("-", "").toLowerCase()}`;
	return { account, slug, androidPackage: `app.wandit.${slug}` };
}

/**
 * The app.json that goes to EAS. wandit owns the EAS identity of every app:
 * a user value for `slug`, `owner`, `android.package`, or `extra.eas` never
 * reaches EAS, so an app can never link the EAS project of another app.
 */
export function withWanditEasIdentity(
	appJson: ExpoAppJson,
	identity: EasProjectIdentity,
): ExpoAppJson {
	// `eas init` writes a fresh `extra.eas.projectId` for this slug.
	const extra = Object.fromEntries(
		Object.entries(appJson.expo.extra ?? {}).filter(([key]) => key !== "eas"),
	);
	return {
		...appJson,
		expo: {
			...appJson.expo,
			slug: identity.slug,
			owner: identity.account,
			android: { ...appJson.expo.android, package: identity.androidPackage },
			extra,
		},
	};
}

// An npm package name, maybe scoped, maybe with a subpath like
// `expo-router/plugin`. A file path such as `./plugin.js` never matches.
const PLUGIN_MODULE_PATTERN =
	/^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(\/[a-zA-Z0-9._~-]+)*$/;

/**
 * The npm package of a config plugin module name, or null when the name is
 * a file path or leaves the package with a `.` or `..` segment.
 */
export function pluginPackageName(moduleName: string): string | null {
	const segments = moduleName.split("/");
	if (
		!PLUGIN_MODULE_PATTERN.test(moduleName) ||
		segments.some((segment) => segment === "." || segment === "..")
	) {
		return null;
	}
	return moduleName.startsWith("@")
		? `${segments[0]}/${segments[1]}`
		: (segments[0] ?? null);
}

/** Result of `checkConfigPlugins`. */
export type ConfigPluginCheck =
	| {
			kind: "allowed";
			/** Allowed modules the template lacks, with their SDK version range. */
			extraDependencies: Record<string, string>;
	  }
	| {
			kind: "refused";
			/** The first plugin module name that failed the check. */
			moduleName: string;
	  };

/**
 * Checks the config plugins of a user app.json before `eas` evaluates them
 * on the worker. The worker runs only code from the trusted install: a
 * plugin package must be a template dependency, or a module of
 * native-modules.json that then joins the install at the SDK range.
 */
export function checkConfigPlugins(
	plugins: readonly ExpoPluginEntry[],
	templateDependencies: Readonly<Record<string, string>>,
	nativeModules: Readonly<Record<string, string>>,
): ConfigPluginCheck {
	const extraDependencies: Record<string, string> = {};
	for (const entry of plugins) {
		const moduleName = Array.isArray(entry) ? entry[0] : entry;
		const packageName = pluginPackageName(moduleName);
		if (packageName === null) {
			return { kind: "refused", moduleName };
		}
		if (Object.hasOwn(templateDependencies, packageName)) {
			continue;
		}
		const range = Object.hasOwn(nativeModules, packageName)
			? nativeModules[packageName]
			: undefined;
		if (range === undefined) {
			return { kind: "refused", moduleName };
		}
		extraDependencies[packageName] = range;
	}
	return { kind: "allowed", extraDependencies };
}
