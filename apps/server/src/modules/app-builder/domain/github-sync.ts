/**
 * Pure rules of the GitHub two-way sync. No I/O.
 * The `github-sync` Trigger task calls `decideGithubSync`. The project GitHub
 * status route calls `isGithubUpdateAvailable` and `githubStateScheduleKey`.
 */

/**
 * What one sync run does. "noop": nothing. "in-sync": both heads are equal,
 * so the run only marks the link synced. "push": fast-forward GitHub `main`
 * to the code.storage head. "mirror": copy GitHub `main` to the code.storage
 * branch `github/main`, so the user can click Update.
 */
export type GithubSyncAction = "noop" | "in-sync" | "push" | "mirror";

/** The heads that one sync run reads before it decides. */
export type GithubSyncHeads = {
	/** `app_branches(main).head_sha` of the project; null before the first push to code.storage. */
	csHead: string | null;
	/** Head of GitHub `main`; null when the GitHub repo has no `main` (an empty repo). */
	githubHead: string | null;
	/**
	 * `git merge-base --is-ancestor <githubHead> <csHead>` exited 0. The rule
	 * reads it only when both heads are set and differ, so the worker may pass
	 * false in the other cases.
	 */
	githubIsAncestorOfCs: boolean;
};

/**
 * Decides one sync run. GitHub never gets a force push: a
 * GitHub head that is not an ancestor of ours is mirrored for an Update.
 */
export function decideGithubSync(heads: GithubSyncHeads): GithubSyncAction {
	// No code.storage history yet: no repo to mirror into. The `push:<sha>`
	// run of the first commit handles a GitHub repo that is ahead.
	if (heads.csHead === null) {
		return "noop";
	}
	if (heads.githubHead === null) {
		return "push";
	}
	if (heads.githubHead === heads.csHead) {
		return "in-sync";
	}
	if (heads.githubIsAncestorOfCs) {
		return "push";
	}
	// GitHub is ahead or the two histories diverged.
	return "mirror";
}

/** The sync columns of one `project_github_links` row. */
export type GithubLinkHeads = {
	/** GitHub head copied to code.storage `github/main`; null before the first mirror. */
	mirroredSha: string | null;
	/** GitHub head that the worker last saw. */
	remoteHeadSha: string | null;
	/** GitHub head that the project last pushed or pulled. */
	lastSyncedSha: string | null;
};

/**
 * True when GitHub has commits that the project did not pull, and the
 * worker already mirrored them. The pull route also refuses with 409 when
 * this is false.
 */
export function isGithubUpdateAvailable(link: GithubLinkHeads): boolean {
	return (
		link.mirroredSha !== null &&
		link.remoteHeadSha === link.mirroredSha &&
		link.remoteHeadSha !== link.lastSyncedSha
	);
}

/**
 * The reason key for `GithubSyncScheduler.scheduleIfLinked` when the status
 * route sees the heads differ, or null when all three are equal.
 * One key per pair of heads, so a waiting state costs at most one run per
 * hour (the idempotency TTL). A failed run frees its key, so the next poll
 * retries a lost push. Also schedules when GitHub equals our head but the row
 * holds an older GitHub head (a force push on GitHub). The in-sync run then
 * calls `markSynced` and clears the banner.
 */
export function githubStateScheduleKey(
	/** `app_branches(main).head_sha`; null before the first push. */
	headSha: string | null,
	/** GitHub `main` head from GitHub REST; null for an empty repo. */
	githubHead: string | null,
	/** `project_github_links.remote_head_sha`: the GitHub head that the worker last saw. */
	remoteHeadSha: string | null,
): string | null {
	if (headSha === githubHead && githubHead === remoteHeadSha) {
		return null;
	}
	return `state:${headSha ?? "none"}:${githubHead ?? "none"}`;
}
