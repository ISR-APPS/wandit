/**
 * Feature hooks of project sharing that are not queries or mutations.
 * Called by the Share button, the project card menu, and the dashboard.
 */
import { usePublicSettingsQuery } from "@/features/settings";

/**
 * True when the `organizationsEnabled` switch is on. While it is off, the web
 * hides Share and "Shared with me" (workspaces-sharing.md 3.4). Existing
 * access stays. False while the settings load, so nothing flashes in.
 */
export function useSharingEnabled(): boolean {
	return usePublicSettingsQuery().data?.organizationsEnabled === true;
}
