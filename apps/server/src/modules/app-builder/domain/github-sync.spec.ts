import { describe, expect, it } from "vitest";

import {
	decideGithubSync,
	githubStateScheduleKey,
	isGithubUpdateAvailable,
} from "./github-sync";

const OURS = "a".repeat(40);
const THEIRS = "b".repeat(40);
const OLDER = "c".repeat(40);

describe("decideGithubSync", () => {
	it.each([
		// A GitHub repo that is ahead before our first commit waits for that commit's run.
		{ csHead: null, githubHead: THEIRS, ancestor: false, expected: "noop" },
		{ csHead: null, githubHead: null, ancestor: false, expected: "noop" },
		{ csHead: OURS, githubHead: null, ancestor: false, expected: "push" },
		{ csHead: OURS, githubHead: OURS, ancestor: false, expected: "in-sync" },
		{ csHead: OURS, githubHead: OLDER, ancestor: true, expected: "push" },
		// GitHub ahead or diverged: never a force push, always a mirror.
		{ csHead: OURS, githubHead: THEIRS, ancestor: false, expected: "mirror" },
	] as const)("answers $expected for ours=$csHead github=$githubHead ancestor=$ancestor", ({
		csHead,
		githubHead,
		ancestor,
		expected,
	}) => {
		expect(
			decideGithubSync({ csHead, githubHead, githubIsAncestorOfCs: ancestor }),
		).toBe(expected);
	});
});

describe("isGithubUpdateAvailable", () => {
	it.each([
		{
			name: "a new mirror",
			mirrored: THEIRS,
			remote: THEIRS,
			synced: OURS,
			expected: true,
		},
		{
			name: "a first mirror",
			mirrored: THEIRS,
			remote: THEIRS,
			synced: null,
			expected: true,
		},
		{
			name: "a pulled head",
			mirrored: THEIRS,
			remote: THEIRS,
			synced: THEIRS,
			expected: false,
		},
		// A push after the mirror moved the remote head: the old mirror is not an update.
		{
			name: "a remote head that a push moved",
			mirrored: THEIRS,
			remote: OURS,
			synced: OURS,
			expected: false,
		},
		{
			name: "no mirror yet",
			mirrored: null,
			remote: null,
			synced: null,
			expected: false,
		},
	])("answers $expected for $name", ({
		mirrored,
		remote,
		synced,
		expected,
	}) => {
		expect(
			isGithubUpdateAvailable({
				lastSyncedSha: synced,
				mirroredSha: mirrored,
				remoteHeadSha: remote,
			}),
		).toBe(expected);
	});
});

describe("githubStateScheduleKey", () => {
	it.each([
		{ head: OURS, github: OURS, remote: OURS, expected: null },
		{ head: null, github: null, remote: null, expected: null },
		{
			head: OURS,
			github: THEIRS,
			remote: OURS,
			expected: `state:${OURS}:${THEIRS}`,
		},
		// A link whose first push failed: GitHub is still empty.
		{ head: OURS, github: null, remote: null, expected: `state:${OURS}:none` },
		{
			head: null,
			github: THEIRS,
			remote: null,
			expected: `state:none:${THEIRS}`,
		},
		// A force push on GitHub dropped the mirrored head. The run must clear the banner.
		{
			head: OURS,
			github: OURS,
			remote: THEIRS,
			expected: `state:${OURS}:${OURS}`,
		},
	])("answers $expected for head=$head github=$github remote=$remote", ({
		head,
		github,
		remote,
		expected,
	}) => {
		expect(githubStateScheduleKey(head, github, remote)).toBe(expected);
	});
});
