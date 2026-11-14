/**
 * The app type a user picks for a new V2 project, and its API values.
 * The prompt box and the dashboard hold the pick, and the V2 create body
 * reads it. Web only: the API has no such value, it gets a target platform
 * and a desktop engine.
 */

import type { DesktopEngine, TargetPlatform } from "@wandit/contracts";

/**
 * The rows of the app type menu. "desktop-electron" is the experimental
 * "Desktop app 2". Each target platform is a valid pick.
 */
export type AppTypeChoice = TargetPlatform | "desktop-electron";

/**
 * The create body fields of one pick. `desktopEngine` is absent for every
 * pick but "desktop-electron": the server then stores Tauri for a desktop app.
 */
export function toAppTypeTarget(appType: AppTypeChoice): {
	targetPlatform: TargetPlatform;
	desktopEngine?: DesktopEngine;
} {
	if (appType === "desktop-electron") {
		return { targetPlatform: "desktop", desktopEngine: "electron" };
	}
	return { targetPlatform: appType };
}
