// Metro config for the one dev server on port 8081 (web and native).
// Expo CLI loads it on `expo start` and `expo export`.
// Reanimated wraps the Expo defaults; Uniwind compiles src/global.css.
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const {
	wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Uniwind writes the class name types to dtsFile on each Metro start.
module.exports = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
	cssEntryFile: "./src/global.css",
	dtsFile: "./uniwind-types.d.ts",
});
