/**
 * Route path builders for the V2 app builder API.
 * These return strings; they do not make network calls.
 */

/** Every `/api/v2` route the app-builder module owns or plans. */
export const appBuilderRoutes = {
	// GET V2 rollout and env readiness; requires a session.
	health: "/api/v2/health",
	// POST create an app project from a prompt.
	createProject: "/api/v2/projects",
	// GET one app project.
	project: (projectId: string) => `/api/v2/projects/${projectId}`,
	// POST start a builder turn.
	createTurn: (projectId: string) => `/api/v2/projects/${projectId}/turns`,
	// GET the SSE stream of one turn.
	turnStream: (projectId: string, turnId: string) =>
		`/api/v2/projects/${projectId}/turns/${turnId}/stream`,
	// GET the SSE stream of the project's currently running turn, if any.
	activeTurnStream: (projectId: string) =>
		`/api/v2/projects/${projectId}/turns/active/stream`,
	// POST cancel a builder turn.
	cancelTurn: (projectId: string, turnId: string) =>
		`/api/v2/projects/${projectId}/turns/${turnId}/cancel`,
	// GET the version list of a project (one commit per turn, newest first).
	versions: (projectId: string) => `/api/v2/projects/${projectId}/versions`,
	// GET the stored patch and numstat of one version.
	versionDiff: (projectId: string, sha: string) =>
		`/api/v2/projects/${projectId}/versions/${sha}/diff`,
	// POST restore one version as a new copy-forward commit.
	restoreVersion: (projectId: string, sha: string) =>
		`/api/v2/projects/${projectId}/versions/${sha}/restore`,
	// GET and PUT the monthly and per-turn credit caps of a project.
	costCaps: (projectId: string) => `/api/v2/projects/${projectId}/cost-caps`,
	// Base path the in-sandbox agent reaches for LLM traffic (WANDIT-165).
	llmProxyBase: "/api/v2/llm",
	// POST Anthropic Messages API passthrough behind the run-token checks.
	llmProxyMessages: "/api/v2/llm/v1/messages",
	// POST Anthropic token counting behind the same proxy checks.
	llmProxyCountTokens: "/api/v2/llm/v1/messages/count_tokens",
	// GET the file tree of the running sandbox for the Code view.
	codeSnapshot: (projectId: string) => `/api/v2/projects/${projectId}/code`,
	// GET one file of the running sandbox; the caller adds `?path=<path>`.
	codeFile: (projectId: string) => `/api/v2/projects/${projectId}/code/file`,
	// GET a signed 15-minute preview URL of the running sandbox.
	previewToken: (projectId: string) =>
		`/api/v2/projects/${projectId}/preview-token`,
	// GET the secret names, kinds, and dates of a project; never a value.
	secrets: (projectId: string) => `/api/v2/projects/${projectId}/secrets`,
	// PUT sets or replaces one secret value; DELETE removes it.
	secret: (projectId: string, name: string) =>
		`/api/v2/projects/${projectId}/secrets/${name}`,
} as const;
