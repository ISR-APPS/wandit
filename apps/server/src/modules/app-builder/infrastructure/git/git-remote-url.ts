/**
 * URL helpers for git over HTTPS against code.storage.
 * `commitTurn` and `CodeStorageRepoRestorer` build the authenticated remote
 * for one command, and logs and errors print the redacted form.
 */

/** The username code.storage expects in a git URL; the JWT is the password. */
export const CODE_STORAGE_GIT_USERNAME = "t";

/** The credential shape `authenticatedRemoteUrl` needs: a minted JWT. */
export type GitCredential = {
	username: string;
	password: string;
};

/**
 * Builds `https://t:<jwt>@<host>/<repo>.git` for one git command. The JWT
 * sits in the URL for the duration of the command only; never log the
 * result — use `redactRemoteUrl` for output.
 */
export function authenticatedRemoteUrl(
	remoteUrl: string,
	credential: GitCredential,
): string {
	const url = new URL(remoteUrl);
	url.username = credential.username;
	url.password = credential.password;
	return url.toString();
}

/**
 * Masks the password of a remote URL for logs and error messages, so a JWT
 * never lands in output: `https://t:***@host/...`.
 */
export function redactRemoteUrl(url: string): string {
	try {
		const parsed = new URL(url);
		if (parsed.password !== "") {
			parsed.password = "***";
		}
		return parsed.toString();
	} catch {
		// Not a URL: the value cannot carry URL credentials; return it as is.
		return url;
	}
}
