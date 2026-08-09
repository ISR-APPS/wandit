/**
 * Deploy pipelines can interpolate an empty commit SHA and produce a release
 * like "server@" — a versionless release is worse than none (every deploy
 * groups together in Sentry). Prefer the configured value, else fall back to
 * the platform-provided commit SHA, else stay unset.
 *
 * Node-only (reads process.env) — never import from browser entry points.
 */
export function normalizeSentryRelease(
	release: string | undefined,
	prefix: string,
): string | undefined {
	if (release && !release.endsWith("@")) {
		return release;
	}

	const sha =
		process.env.RAILWAY_GIT_COMMIT_SHA ??
		process.env.VERCEL_GIT_COMMIT_SHA ??
		process.env.SOURCE_COMMIT;

	return sha ? `${prefix}@${sha.slice(0, 12)}` : undefined;
}
