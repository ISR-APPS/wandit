import { sentryVitePlugin } from "@sentry/vite-plugin";

/**
 * Source-map upload for the Vite SPAs. Goes LAST in the plugins array, paired
 * with `build: { sourcemap: "hidden" }`.
 *
 * Build-time only, so raw process.env is correct here (these vars must never
 * be part of app runtime env): SENTRY_ORG + SENTRY_AUTH_TOKEN come from the
 * Railway service, RAILWAY_GIT_COMMIT_SHA from Railway itself. Without an
 * auth token the plugin is fully disabled — local builds and the
 * `check-types` vite build never attempt an upload.
 */
export function wanditSentryVitePlugin({ project }: { project: string }) {
	return sentryVitePlugin({
		org: process.env.SENTRY_ORG,
		project,
		authToken: process.env.SENTRY_AUTH_TOKEN,
		disable: !process.env.SENTRY_AUTH_TOKEN,
		release: {
			name: `${project}@${
				process.env.RAILWAY_GIT_COMMIT_SHA ??
				process.env.VERCEL_GIT_COMMIT_SHA ??
				"dev"
			}`,
		},
		sourcemaps: {
			// Upload maps, then make sure none ship in dist/.
			filesToDeleteAfterUpload: ["./dist/**/*.map"],
		},
	});
}
