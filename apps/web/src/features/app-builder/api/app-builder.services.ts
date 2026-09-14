/**
 * Mock data layer of the app builder. Each function waits a short delay and
 * returns a copy, like a fetch. State lives in this module until a reload.
 * Called by app-builder.queries.ts, app-builder.mutations.ts, and the route
 * loader. The backend session replaces the bodies with HTTP calls through
 * `@/lib/api-client`; the signatures and the return types stay.
 */

import { type ComposerMode, MOCK_LATENCY_MS } from "../lib/constants";
import { MOCK_CODE_FILES, MOCK_CODE_SNAPSHOT } from "../lib/mock-code";
import {
	MOCK_APP_STORES,
	MOCK_BACKEND,
	MOCK_DOMAINS,
	MOCK_PAYMENTS,
	MOCK_PAYMENTS_NOT_CONNECTED,
	MOCK_SETTINGS,
	MOCK_SIGN_IN,
} from "../lib/mock-panels";
import { MOCK_APP_PROJECTS, MOCK_APP_VERSIONS } from "../lib/mock-projects";
import { buildMockReply, MOCK_BUILDER_THREAD } from "../lib/mock-thread";
import type {
	AppProject,
	AppProjectKind,
	AppStoresSummary,
	AppVersion,
	BackendSummary,
	BuilderThread,
	CodeFile,
	CodeSnapshot,
	CollaboratorRole,
	PaymentsSummary,
	ProjectDomain,
	ProjectSettings,
	SignInMethodId,
	SignInSummary,
} from "./dto";

/** Fields the Settings panel can change. */
export type AppProjectPatch = {
	name?: string;
	description?: string;
	kind?: AppProjectKind;
};

/** One turn the composer or a chat card sends. */
export type SendBuilderMessageInput = {
	/** The trimmed draft, or the text of a card action. Never empty. */
	text: string;
	/** `build` saves a version. `plan` only replies. */
	mode: ComposerMode;
};

type MockStore = {
	projects: Map<string, AppProject>;
	threads: Map<string, BuilderThread>;
	signIn: Map<string, SignInSummary>;
	payments: Map<string, PaymentsSummary>;
	settings: Map<string, ProjectSettings>;
	versions: Map<string, AppVersion[]>;
};

let store: MockStore | null = null;

function createStore(): MockStore {
	const next: MockStore = {
		projects: new Map(),
		threads: new Map(),
		signIn: new Map(),
		payments: new Map(),
		settings: new Map(),
		versions: new Map(),
	};
	for (const project of MOCK_APP_PROJECTS) {
		next.projects.set(project.id, structuredClone(project));
		next.threads.set(project.id, {
			...structuredClone(MOCK_BUILDER_THREAD),
			projectId: project.id,
		});
		next.signIn.set(project.id, structuredClone(MOCK_SIGN_IN));
		// The mobile project shows the not-connected state of the Payments panel.
		next.payments.set(
			project.id,
			structuredClone(
				project.kind === "web" ? MOCK_PAYMENTS : MOCK_PAYMENTS_NOT_CONNECTED,
			),
		);
		next.settings.set(project.id, structuredClone(MOCK_SETTINGS));
		next.versions.set(project.id, structuredClone(MOCK_APP_VERSIONS));
	}
	return next;
}

function getStore(): MockStore {
	if (!store) store = createStore();
	return store;
}

/** Drops every change made through the mutations. Specs call it before each case. */
export function resetMockStore(): void {
	store = null;
}

function delay(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

/** Reads a value the store must hold for a known project. */
function required<T>(map: Map<string, T>, projectId: string): T {
	const value = map.get(projectId);
	if (value === undefined) {
		throw new Error(`Unknown app project: ${projectId}`);
	}
	return value;
}

export async function listAppProjects(): Promise<AppProject[]> {
	await delay();
	return structuredClone([...getStore().projects.values()]);
}

/** null when no project has this id, so the route can show its not-found screen. */
export async function getAppProject(
	projectId: string,
): Promise<AppProject | null> {
	await delay();
	const project = getStore().projects.get(projectId);
	return project ? structuredClone(project) : null;
}

export async function updateAppProject(
	projectId: string,
	patch: AppProjectPatch,
): Promise<AppProject> {
	await delay();
	const project = required(getStore().projects, projectId);
	Object.assign(project, patch);
	return structuredClone(project);
}

export async function getBuilderThread(
	projectId: string,
): Promise<BuilderThread> {
	await delay();
	return structuredClone(required(getStore().threads, projectId));
}

/**
 * Appends the user message and a canned assistant reply. The text also
 * answers an open question. A `build` turn also saves a new version.
 */
export async function sendBuilderMessage(
	projectId: string,
	input: SendBuilderMessageInput,
): Promise<BuilderThread> {
	await delay();
	const current = getStore();
	const thread = required(current.threads, projectId);
	const project = required(current.projects, projectId);
	// A reply closes the open question of the last assistant message, as the backend will.
	const last = thread.messages.at(-1);
	if (last?.role === "assistant") {
		for (const part of last.parts) {
			if (part.type === "data-question" && part.data.answer === null) {
				part.data.answer = input.text;
			}
		}
	}
	thread.messages.push({
		id: crypto.randomUUID(),
		role: "user",
		parts: [{ type: "text", text: input.text }],
	});
	if (input.mode === "build") {
		project.versionNumber += 1;
		project.unpublishedChanges += 1;
		required(current.versions, projectId).unshift({
			number: project.versionNumber,
			summary: input.text,
			createdAt: new Date().toISOString(),
			isLive: false,
		});
	}
	thread.messages.push(
		buildMockReply(input.text, input.mode, project.versionNumber),
	);
	return structuredClone(thread);
}

export async function getCodeSnapshot(
	projectId: string,
): Promise<CodeSnapshot> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_CODE_SNAPSHOT);
}

/** null when the repository has no file at this path. */
export async function getCodeFile(
	projectId: string,
	path: string,
): Promise<CodeFile | null> {
	await delay();
	required(getStore().projects, projectId);
	const file = MOCK_CODE_FILES.find((candidate) => candidate.path === path);
	return file ? structuredClone(file) : null;
}

export async function getBackendSummary(
	projectId: string,
): Promise<BackendSummary> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_BACKEND);
}

export async function getSignInSummary(
	projectId: string,
): Promise<SignInSummary> {
	await delay();
	return structuredClone(required(getStore().signIn, projectId));
}

export async function setSignInMethod(
	projectId: string,
	input: { methodId: SignInMethodId; enabled: boolean },
): Promise<SignInSummary> {
	await delay();
	const summary = required(getStore().signIn, projectId);
	for (const method of summary.methods) {
		if (method.id === input.methodId) method.enabled = input.enabled;
	}
	return structuredClone(summary);
}

export async function getPaymentsSummary(
	projectId: string,
): Promise<PaymentsSummary> {
	await delay();
	return structuredClone(required(getStore().payments, projectId));
}

/** Switches the connected provider between test and live keys. No-op without a provider. */
export async function setPaymentsMode(
	projectId: string,
	mode: "test" | "live",
): Promise<PaymentsSummary> {
	await delay();
	const summary = required(getStore().payments, projectId);
	if (summary.provider) summary.provider.mode = mode;
	return structuredClone(summary);
}

export async function getProjectDomains(
	projectId: string,
): Promise<ProjectDomain[]> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_DOMAINS);
}

export async function getAppStoresSummary(
	projectId: string,
): Promise<AppStoresSummary> {
	await delay();
	required(getStore().projects, projectId);
	return structuredClone(MOCK_APP_STORES);
}

export async function getProjectSettings(
	projectId: string,
): Promise<ProjectSettings> {
	await delay();
	return structuredClone(required(getStore().settings, projectId));
}

export async function setCollaboratorRole(
	projectId: string,
	input: { collaboratorId: string; role: CollaboratorRole },
): Promise<ProjectSettings> {
	await delay();
	const settings = required(getStore().settings, projectId);
	const collaborator = settings.collaborators.find(
		(candidate) => candidate.id === input.collaboratorId,
	);
	if (!collaborator) {
		throw new Error(`Unknown collaborator: ${input.collaboratorId}`);
	}
	collaborator.role = input.role;
	return structuredClone(settings);
}

/** Versions newest first. */
export async function listAppVersions(
	projectId: string,
): Promise<AppVersion[]> {
	await delay();
	return structuredClone(required(getStore().versions, projectId));
}
