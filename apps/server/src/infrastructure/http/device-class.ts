export type DeviceClass = "desktop" | "mobile" | "tablet";

/**
 * Best-effort device classification from a request user-agent.
 *
 * Tablet checks intentionally run before mobile checks because some tablet
 * user-agents also include mobile-like tokens.
 */
export function classifyDeviceFromUserAgent(
	userAgent: string | null | undefined,
): DeviceClass | null {
	const value = userAgent?.trim();

	if (!value) {
		return null;
	}

	const isAndroid = /Android/i.test(value);
	const isMobile = /Mobi/i.test(value);

	if (
		/iPad/i.test(value) ||
		/Tablet/i.test(value) ||
		(isAndroid && !isMobile)
	) {
		return "tablet";
	}

	if (/iPhone/i.test(value) || isMobile) {
		return "mobile";
	}

	return "desktop";
}
