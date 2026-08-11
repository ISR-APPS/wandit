export type LoginError = "oauth" | "forbidden";

const ADMIN_ACCESS_REQUIRED_ERROR_CODE = "ADMIN_ACCESS_REQUIRED";
const SIGNUP_DISABLED_ERROR_CODE = "signup_disabled";

export function buildAdminAuthCallbackUrls(origin: string): {
	callbackURL: string;
	errorCallbackURL: string;
} {
	return {
		callbackURL: new URL("/dashboard", origin).toString(),
		errorCallbackURL: new URL("/login", origin).toString(),
	};
}

export function parseLoginError(error: unknown): LoginError | undefined {
	if (
		error === "forbidden" ||
		error === ADMIN_ACCESS_REQUIRED_ERROR_CODE ||
		error === SIGNUP_DISABLED_ERROR_CODE
	) {
		return "forbidden";
	}

	return typeof error === "string" && error.length > 0 ? "oauth" : undefined;
}
