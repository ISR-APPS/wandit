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
	// GET the hold that the next turn reserves, before send.
	turnEstimate: (projectId: string) =>
		`/api/v2/projects/${projectId}/turns/estimate`,
	// GET the SSE stream of one turn.
	turnStream: (projectId: string, turnId: string) =>
		`/api/v2/projects/${projectId}/turns/${turnId}/stream`,
	// GET the SSE stream of the project's currently running turn, if any.
	activeTurnStream: (projectId: string) =>
		`/api/v2/projects/${projectId}/turns/active/stream`,
	// GET the running turn id and the main head; the builder page polls it.
	activeTurn: (projectId: string) =>
		`/api/v2/projects/${projectId}/turns/active`,
	// GET one page of the stored chat, newest page first; `?cursor=&limit=`.
	messages: (projectId: string) => `/api/v2/projects/${projectId}/messages`,
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
	// GET the theme.json of a project; PUT saves a selection as a "theme" commit.
	theme: (projectId: string) => `/api/v2/projects/${projectId}/theme`,
	// GET and PUT the monthly and per-turn credit caps of a project.
	costCaps: (projectId: string) => `/api/v2/projects/${projectId}/cost-caps`,
	// GET the models the builder dropdown offers, with their prices.
	models: "/api/v2/models",
	// GET the full cost of one chat: USD, credits, tokens, per model.
	chatCost: (projectId: string, chatId: string) =>
		`/api/v2/projects/${projectId}/chats/${chatId}/cost`,
	// Base path the in-sandbox agent reaches for LLM traffic (WANDIT-165).
	llmProxyBase: "/api/v2/llm",
	// POST Anthropic Messages API passthrough behind the run-token checks.
	llmProxyMessages: "/api/v2/llm/v1/messages",
	// POST Anthropic token counting behind the same proxy checks.
	llmProxyCountTokens: "/api/v2/llm/v1/messages/count_tokens",
	// Base path of the app AI gateway; an app's Edge Function gets it as
	// WANDIT_AI_GATEWAY_URL and appends `/chat/completions`.
	appAiBase: "/api/v2/ai/v1",
	// POST OpenAI chat completions of a V2 app, behind its gateway key.
	appAiChatCompletions: "/api/v2/ai/v1/chat/completions",
	// GET the AI gateway state and the month usage of a project.
	appAi: (projectId: string) => `/api/v2/projects/${projectId}/ai`,
	// PUT turns the gateway on (keeps a live key); DELETE turns it off.
	appAiKey: (projectId: string) => `/api/v2/projects/${projectId}/ai/key`,
	// POST replaces the gateway key and pushes it to the backend.
	appAiKeyRotate: (projectId: string) =>
		`/api/v2/projects/${projectId}/ai/key/rotate`,
	// GET the file tree of the running sandbox for the Code view.
	codeSnapshot: (projectId: string) => `/api/v2/projects/${projectId}/code`,
	// GET one file of the running sandbox; the caller adds `?path=<path>`.
	codeFile: (projectId: string) => `/api/v2/projects/${projectId}/code/file`,
	// GET a signed 15-minute preview URL of the running sandbox.
	previewToken: (projectId: string) =>
		`/api/v2/projects/${projectId}/preview-token`,
	// POST wakes a stopped sandbox without a turn and with no credit charge.
	wakeSandbox: (projectId: string) =>
		`/api/v2/projects/${projectId}/sandbox/wake`,
	// POST starts an Appetize device session of a mobile project (WANDIT-196).
	deviceSessions: (projectId: string) =>
		`/api/v2/projects/${projectId}/device-sessions`,
	// POST ends one device session and stores its Appetize session token.
	endDeviceSession: (projectId: string, deviceSessionId: string) =>
		`/api/v2/projects/${projectId}/device-sessions/${deviceSessionId}/end`,
	// GET the secret names, kinds, and dates of a project; never a value.
	secrets: (projectId: string) => `/api/v2/projects/${projectId}/secrets`,
	// PUT sets or replaces one secret value; DELETE removes it.
	secret: (projectId: string, name: string) =>
		`/api/v2/projects/${projectId}/secrets/${name}`,
	// GET the GitHub connection of the user and the App installations; DELETE disconnects.
	githubAccount: "/api/v2/github/account",
	// POST answers the GitHub URL that starts a connect or an App install.
	githubAuthorize: "/api/v2/github/authorize",
	// GET GitHub redirects here after the connect; public, answers a 302 to the builder.
	githubCallback: "/api/v2/github/callback",
	// GET the GitHub link and sync state; POST creates and links a repo; DELETE unlinks.
	github: (projectId: string) => `/api/v2/projects/${projectId}/github`,
	// POST merges the GitHub commits into the project as one "github" commit.
	githubPull: (projectId: string) =>
		`/api/v2/projects/${projectId}/github/pull`,
} as const;
