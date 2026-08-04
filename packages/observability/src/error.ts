/**
 * Runtime-neutral error helpers — zero Sentry imports, usable anywhere
 * (browser, server, worker, edge, Trigger tasks).
 *
 * Deliberately has NO capture/log side effects: capture explicitly at the
 * call site with the runtime's Sentry so nothing is double-reported.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as { message: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}
	return String(error);
}
