/**
 * TanStack Query options and keys of the app builder. queryFn delegates to
 * app-builder.services.ts. The route loader calls `ensureQueryData` with the
 * same options, so components read with `useSuspenseQuery` and never see a
 * loading state for the project and the thread.
 */

import { queryOptions } from "@tanstack/react-query";

import {
	getAppProject,
	getAppStoresSummary,
	getBackendSummary,
	getBuilderThread,
	getCodeFile,
	getCodeSnapshot,
	getPaymentsSummary,
	getProjectDomains,
	getProjectSettings,
	getSignInSummary,
	getVersionDiff,
	listAppProjects,
	listVersions,
} from "./app-builder.services";

export const appBuilderKeys = {
	all: ["app-builder"] as const,
	projects: () => [...appBuilderKeys.all, "projects"] as const,
	project: (projectId: string) =>
		[...appBuilderKeys.all, "project", projectId] as const,
	thread: (projectId: string) =>
		[...appBuilderKeys.all, "thread", projectId] as const,
	code: (projectId: string) =>
		[...appBuilderKeys.all, "code", projectId] as const,
	codeFile: (projectId: string, path: string) =>
		[...appBuilderKeys.all, "code", projectId, path] as const,
	backend: (projectId: string) =>
		[...appBuilderKeys.all, "backend", projectId] as const,
	signIn: (projectId: string) =>
		[...appBuilderKeys.all, "sign-in", projectId] as const,
	payments: (projectId: string) =>
		[...appBuilderKeys.all, "payments", projectId] as const,
	domains: (projectId: string) =>
		[...appBuilderKeys.all, "domains", projectId] as const,
	appStores: (projectId: string) =>
		[...appBuilderKeys.all, "app-stores", projectId] as const,
	settings: (projectId: string) =>
		[...appBuilderKeys.all, "settings", projectId] as const,
	versions: (projectId: string) =>
		[...appBuilderKeys.all, "versions", projectId] as const,
	// A sibling of `versions`, not a child: a list refresh must not refetch the immutable diffs.
	versionDiff: (projectId: string, sha: string) =>
		[...appBuilderKeys.all, "version-diff", projectId, sha] as const,
};

/** Every project the user can open from the project menu. */
export const appProjectsQuery = () =>
	queryOptions({
		queryKey: appBuilderKeys.projects(),
		queryFn: listAppProjects,
	});

/** null data means the project does not exist. */
export const appProjectQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.project(projectId),
		queryFn: () => getAppProject(projectId),
	});

export const builderThreadQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.thread(projectId),
		queryFn: () => getBuilderThread(projectId),
	});

/** null data means the sandbox is asleep; the Code view waits for a turn. */
export const codeSnapshotQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.code(projectId),
		queryFn: () => getCodeSnapshot(projectId),
	});

/**
 * One file of the sandbox. Its key is a child of `code(projectId)`, so one
 * invalidation of that key refetches the tree and the open file.
 */
export const codeFileQuery = (projectId: string, path: string) =>
	queryOptions({
		queryKey: appBuilderKeys.codeFile(projectId, path),
		queryFn: () => getCodeFile(projectId, path),
	});

export const backendSummaryQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.backend(projectId),
		queryFn: () => getBackendSummary(projectId),
	});

export const signInSummaryQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.signIn(projectId),
		queryFn: () => getSignInSummary(projectId),
	});

export const paymentsSummaryQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.payments(projectId),
		queryFn: () => getPaymentsSummary(projectId),
	});

/** Web projects only. The route loader warms it when the kind is `web`. */
export const projectDomainsQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.domains(projectId),
		queryFn: () => getProjectDomains(projectId),
	});

/** Mobile projects only. The route loader warms it when the kind is `mobile`. */
export const appStoresSummaryQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.appStores(projectId),
		queryFn: () => getAppStoresSummary(projectId),
	});

export const projectSettingsQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.settings(projectId),
		queryFn: () => getProjectSettings(projectId),
	});

/** The version list of a project: `items` newest first. */
export const appVersionsQuery = (projectId: string) =>
	queryOptions({
		queryKey: appBuilderKeys.versions(projectId),
		queryFn: () => listVersions(projectId),
	});

/** The stored `git show` patch of one commit. */
export const versionDiffQuery = (projectId: string, sha: string) =>
	queryOptions({
		queryKey: appBuilderKeys.versionDiff(projectId, sha),
		queryFn: () => getVersionDiff(projectId, sha),
		// A commit's patch never changes, so the answer stays fresh forever.
		staleTime: Number.POSITIVE_INFINITY,
	});
