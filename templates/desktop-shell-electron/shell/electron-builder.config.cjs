/**
 * The packaging config of the desktop shell (docs/v2/desktop-apps.md, section 3).
 * The CI runs `electron-builder --config electron-builder.config.cjs` in this folder.
 * It reads `./wandit.desktop.json`, which the server writes for each build, and packs
 * `../dist` and `../migrations` of the build input into the app archive.
 */

const fs = require("node:fs");
const path = require("node:path");
const { readDesktopConfig } = require("./src/config.js");

const { productName, mainBinaryName, version, identifier } = readDesktopConfig(
	path.join(__dirname, "wandit.desktop.json"),
);

// The build input always holds these two. A build without them must stop here, not ship.
for (const required of ["../dist/index.html", "../migrations"]) {
	if (!fs.existsSync(path.join(__dirname, required))) {
		throw new Error(`The build input has no ${required}.`);
	}
}

/**
 * Writes the real product name into `InfoPlist.strings` of each language folder of the macOS
 * app. macOS then shows it in the menu bar, the Dock, and Finder. The file names stay ASCII.
 * electron-builder calls it after it packs the app and before it signs the app.
 * @param {object} context
 * @param {string} context.appOutDir The folder that holds the packed app.
 * @param {string} context.electronPlatformName `darwin` or `win32`.
 */
async function localizeMacBundleName({ appOutDir, electronPlatformName }) {
	if (electronPlatformName !== "darwin") {
		return;
	}
	const resources = path.join(
		appOutDir,
		`${mainBinaryName}.app`,
		"Contents",
		"Resources",
	);
	// A `.strings` value has the escapes of a JSON string for `"` and `\`.
	const name = JSON.stringify(productName);
	const strings = `"CFBundleName" = ${name};\n"CFBundleDisplayName" = ${name};\n`;
	for (const entry of fs.readdirSync(resources)) {
		if (entry.endsWith(".lproj")) {
			fs.writeFileSync(
				path.join(resources, entry, "InfoPlist.strings"),
				strings,
			);
		}
	}
}

module.exports = {
	appId: identifier,
	// File names stay ASCII: the app bundle, the executable, and the install folder take this
	// name. A product name with an accent breaks the seal of the macOS signature on a disk image.
	productName: mainBinaryName,
	extraMetadata: { name: mainBinaryName, version },
	directories: { output: "release" },
	files: [
		"package.json",
		"wandit.desktop.json",
		"src/**/*",
		{ from: "../dist", to: "dist" },
		{ from: "../migrations", to: "migrations" },
	],
	asar: true,
	// The shell has no native module and no update feed of electron-builder.
	npmRebuild: false,
	publish: null,
	// Security: the Electron zip must match the hashes inside the electron package, which
	// package-lock.json pins. Without this key, the zip and its hash list come from one download host.
	electronDownload: { checksums: require("electron/checksums.json") },
	// Security: the installed app runs only its own sealed archive, never a script of the user.
	electronFuses: {
		runAsNode: false,
		enableNodeOptionsEnvironmentVariable: false,
		enableNodeCliInspectArguments: false,
		onlyLoadAppFromAsar: true,
		enableEmbeddedAsarIntegrityValidation: true,
		enableCookieEncryption: true,
	},
	mac: {
		target: [{ target: "dmg", arch: ["arm64"] }],
		// The fixed icon file: no file in the app takes the product name.
		icon: "icons/icon.icns",
		// An ad-hoc signature. Apple silicon runs no executable without a signature.
		identity: "-",
		minimumSystemVersion: "15.0",
		// CFBundleName stays the ASCII name: Electron finds its helper apps by that name.
		// `localizeMacBundleName` below gives macOS the real product name.
		extendInfo: {
			CFBundleDisplayName: productName,
			LSHasLocalizedDisplayName: true,
		},
	},
	afterPack: localizeMacBundleName,
	dmg: {
		artifactName: `${mainBinaryName}-${version}.dmg`,
		writeUpdateInfo: false,
	},
	win: {
		target: [{ target: "nsis", arch: ["x64"] }],
		icon: "icons/icon.ico",
	},
	nsis: {
		// One click, for the current user: no admin prompt.
		oneClick: true,
		perMachine: false,
		artifactName: `${mainBinaryName}-${version}-setup.exe`,
		shortcutName: productName,
		uninstallDisplayName: productName,
		// The uninstaller keeps the data of the user.
		deleteAppDataOnUninstall: false,
		differentialPackage: false,
	},
};
