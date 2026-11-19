/**
 * The real `HostToolRegistry` of the builder turn (WANDIT-169).
 * `builder-turn.task.ts` injects it into the runtime; `build` assembles
 * the per-turn tool set the harness hands to the agent: `ask_user`,
 * `generate_image`, `suggest_follow_ups`, `web_search` when `EXA_API_KEY`
 * exists, `web_fetch` when `FIRECRAWL_API_KEY` exists, and `set_theme` for a
 * template with the theme system.
 * A web or mobile project adds `request_network_host`, the seven backend
 * tools of WANDIT-186, and `enable_ai` of the app AI gateway; a desktop
 * project adds `add_local_migration`. A web project with the Firecrawl key
 * adds `capture_site` and `compare_clone`. A Plan Mode turn gets only
 * `ask_user`, `present_plan`, `web_search`, and `web_fetch` (each with its
 * key). A `security_scan` turn gets only the two backend reads.
 * The tools run in the task process, so platform and partner secrets stay
 * out of the sandbox.
 */
import { supportsAppTheme } from "../../domain/app-theme-deal";
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";
import type {
	CaptureSitePage,
	FetchWebPage,
} from "../../domain/ports/web-pages";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";
import {
	ADD_LOCAL_MIGRATION_TOOL_NAME,
	type AddLocalMigrationHostToolDeps,
	createAddLocalMigrationTool,
} from "./add-local-migration.host-tool";
import { ASK_USER_TOOL_NAME, createAskUserTool } from "./ask-user.host-tool";
import {
	createApplyDestructiveMigrationTool,
	createApplyMigrationTool,
} from "./backend/apply-migration.host-tool";
import { createDeployFunctionTool } from "./backend/deploy-function.host-tool";
import {
	createEnableAiTool,
	type EnableAiToolDeps,
} from "./backend/enable-ai.host-tool";
import { createGetAdvisorsTool } from "./backend/get-advisors.host-tool";
import {
	createRunSqlTool,
	createRunSqlWriteTool,
} from "./backend/run-sql.host-tool";
import { createSetSecretTool } from "./backend/set-secret.host-tool";
import {
	CAPTURE_SITE_TOOL_NAME,
	type CaptureSiteHostToolDeps,
	createCaptureSiteTool,
} from "./capture-site.host-tool";
import {
	COMPARE_CLONE_TOOL_NAME,
	createCompareCloneTool,
} from "./compare-clone.host-tool";
import {
	createGenerateImageTool,
	type GenerateImageHostToolDeps,
} from "./generate-image.host-tool";
import {
	createPresentPlanTool,
	PRESENT_PLAN_TOOL_NAME,
} from "./present-plan.host-tool";
import {
	createRequestNetworkHostTool,
	type RequestNetworkHostHostToolDeps,
} from "./request-network-host.host-tool";
import { createSetThemeTool, SET_THEME_TOOL_NAME } from "./set-theme.host-tool";
import {
	createSuggestFollowUpsTool,
	SUGGEST_FOLLOW_UPS_TOOL_NAME,
} from "./suggest-follow-ups.host-tool";
import {
	createWebFetchTool,
	WEB_FETCH_TOOL_NAME,
	type WebFetchHostToolDeps,
} from "./web-fetch.host-tool";
import {
	createWebSearchTool,
	type SearchWeb,
	WEB_SEARCH_TOOL_NAME,
} from "./web-search.host-tool";

/**
 * The image deps, the backend tool deps (WANDIT-186) with the AI key write
 * of `enable_ai`, the network-host repository (WANDIT-180), and the desktop
 * migration registry, the Exa search, and the page reader with the site
 * capture. `audit` serves `request_network_host`, `capture_site`, and the
 * backend tools; `logger` serves every tool.
 */
export type BuilderHostToolRegistryDeps = GenerateImageHostToolDeps &
	EnableAiToolDeps & {
		/** Appends an approved egress host, in one transaction with its audit row. */
		networkHosts: RequestNetworkHostHostToolDeps["networkHosts"];
		/** Reads the frozen migrations of a desktop project for `add_local_migration`. */
		desktopMigrations: AddLocalMigrationHostToolDeps["desktopMigrations"];
		/** One Exa search, bound to `EXA_API_KEY`. Absent when the key is absent: no `web_search` tool. */
		searchWeb?: SearchWeb;
		/** The page reader and the site capture, bound to `FIRECRAWL_API_KEY`. Absent without the key: no `web_fetch`, `capture_site`, or `compare_clone`. */
		webPages?: {
			/** One page read at the provider, for `web_fetch`. */
			fetchWebPage: FetchWebPage;
			/** The 24 h Redis cache of the pages that `web_fetch` reads. */
			pageCache: WebFetchHostToolDeps["pageCache"];
			/** One provider capture of one device, for `capture_site`. */
			captureSitePage: CaptureSitePage;
			/** The guarded download of one file of the source site, for `capture_site`. */
			fetchPublicFile: CaptureSiteHostToolDeps["fetchPublicFile"];
		};
	};

/**
 * Assembles one turn's host tools. Connector tools land in the follow-up
 * when the Nest container exists.
 */
export class BuilderHostToolRegistry implements HostToolRegistry {
	constructor(private readonly deps: BuilderHostToolRegistryDeps) {}

	build(context: HostToolContext): Promise<HostToolSet> {
		const { searchWeb, webPages } = this.deps;
		// A search changes nothing in the project, so Plan Mode gets it too.
		// No approval card: a search only reads, and its description names the cost.
		const webSearch =
			searchWeb === undefined
				? null
				: {
						approval: {
							[WEB_SEARCH_TOOL_NAME]: "not-applicable",
						} satisfies HostToolSet["toolApproval"],
						tools: {
							[WEB_SEARCH_TOOL_NAME]: createWebSearchTool(
								{
									logger: this.deps.logger,
									metering: this.deps.metering,
									searchWeb,
								},
								context,
							),
						},
					};
		// A page read changes nothing in the project, so Plan Mode gets it too.
		// No approval card: a read only reads, and its description names the cost.
		const webFetch =
			webPages === undefined
				? null
				: {
						approval: {
							[WEB_FETCH_TOOL_NAME]: "not-applicable",
						} satisfies HostToolSet["toolApproval"],
						tools: {
							[WEB_FETCH_TOOL_NAME]: createWebFetchTool(
								{
									fetchWebPage: webPages.fetchWebPage,
									logger: this.deps.logger,
									metering: this.deps.metering,
									pageCache: webPages.pageCache,
								},
								context,
							),
						},
					};
		// Plan Mode changes nothing in the project, the backend, or the
		// network: the agent only asks questions, searches, reads pages, and
		// shows the plan.
		if (context.mode === "plan") {
			return Promise.resolve({
				close: async () => {},
				// The questions and the plan are the user's turn; no approval first.
				toolApproval: {
					[ASK_USER_TOOL_NAME]: "not-applicable",
					[PRESENT_PLAN_TOOL_NAME]: "not-applicable",
					...webSearch?.approval,
					...webFetch?.approval,
				},
				tools: {
					[ASK_USER_TOOL_NAME]: createAskUserTool(),
					[PRESENT_PLAN_TOOL_NAME]: createPresentPlanTool(),
					...webSearch?.tools,
					...webFetch?.tools,
				},
			});
		}
		// A desktop app keeps its data in a local SQLite file: it has no cloud
		// backend, so no backend tool and no enable_ai. Its schema changes only
		// through add_local_migration.
		// Its CSP blocks every remote host, so it gets no request_network_host:
		// an approved host would work in the preview and fail in the installed app.
		const isDesktop = context.framework === TEMPLATE_PROFILES.desktop.framework;
		// A security scan only reads: no write, no approval card, no question.
		// `run_sql` refuses a write statement without running it.
		if (context.mode === "security_scan" && isDesktop) {
			return Promise.resolve({
				close: async () => {},
				toolApproval: {},
				tools: {},
			});
		}
		if (context.mode === "security_scan") {
			return Promise.resolve({
				close: async () => {},
				toolApproval: {
					get_advisors: "not-applicable",
					run_sql: "not-applicable",
				},
				tools: {
					get_advisors: createGetAdvisorsTool(this.deps, context),
					run_sql: createRunSqlTool(this.deps, context),
				},
			});
		}
		// Only a template with src/styles/theme.json has a theme to set.
		const hasAppTheme = supportsAppTheme(context.templateVersion);
		// The clone rules and the capture files fit only the web template, so
		// a mobile or desktop project gets no clone tool.
		// No approval card: the user asks for the clone, and the capture
		// description names the cost.
		const siteClone =
			webPages === undefined ||
			context.framework !== TEMPLATE_PROFILES.web.framework
				? null
				: {
						approval: {
							[CAPTURE_SITE_TOOL_NAME]: "not-applicable",
							[COMPARE_CLONE_TOOL_NAME]: "not-applicable",
						} satisfies HostToolSet["toolApproval"],
						tools: {
							[CAPTURE_SITE_TOOL_NAME]: createCaptureSiteTool(
								{
									audit: this.deps.audit,
									captureSitePage: webPages.captureSitePage,
									fetchPublicFile: webPages.fetchPublicFile,
									logger: this.deps.logger,
									metering: this.deps.metering,
								},
								context,
							),
							[COMPARE_CLONE_TOOL_NAME]: createCompareCloneTool(
								{ logger: this.deps.logger },
								context,
							),
						},
					};
		return Promise.resolve({
			// Nothing to release yet: the connector clients that need a
			// close land in the connector follow-up issue.
			close: async () => {},
			// The harness reads approval per tool name, so each write the user
			// must approve is its own tool with "user-approval".
			toolApproval: {
				// The questions themselves are the user's turn; no approval first.
				[ASK_USER_TOOL_NAME]: "not-applicable",
				generate_image: "not-applicable",
				// The ideas only show under the answer; the user picks one or not.
				[SUGGEST_FOLLOW_UPS_TOOL_NAME]: "not-applicable",
				...webSearch?.approval,
				...webFetch?.approval,
				...siteClone?.approval,
				...(isDesktop
					? // The gate refuses every statement that can lose saved data.
						{ [ADD_LOCAL_MIGRATION_TOOL_NAME]: "not-applicable" }
					: {
							// The user must approve each new egress host before it applies.
							request_network_host: "user-approval",
							apply_destructive_migration: "user-approval",
							apply_migration: "not-applicable",
							deploy_function: "not-applicable",
							// The user must agree that each AI call of the app spends credits.
							enable_ai: "user-approval",
							get_advisors: "not-applicable",
							run_sql: "not-applicable",
							run_sql_write: "user-approval",
							set_secret: "not-applicable",
						}),
				// The theme is the user's own words; the preview shows it at once.
				...(hasAppTheme ? { [SET_THEME_TOOL_NAME]: "not-applicable" } : {}),
			},
			tools: {
				[ASK_USER_TOOL_NAME]: createAskUserTool(),
				generate_image: createGenerateImageTool(this.deps, context),
				[SUGGEST_FOLLOW_UPS_TOOL_NAME]: createSuggestFollowUpsTool(),
				...webSearch?.tools,
				...webFetch?.tools,
				...siteClone?.tools,
				...(isDesktop
					? {
							[ADD_LOCAL_MIGRATION_TOOL_NAME]: createAddLocalMigrationTool(
								{
									desktopMigrations: this.deps.desktopMigrations,
									logger: this.deps.logger,
								},
								context,
							),
						}
					: {
							request_network_host: createRequestNetworkHostTool(
								{
									audit: this.deps.audit,
									logger: this.deps.logger,
									networkHosts: this.deps.networkHosts,
								},
								context,
							),
							apply_destructive_migration: createApplyDestructiveMigrationTool(
								this.deps,
								context,
							),
							apply_migration: createApplyMigrationTool(this.deps, context),
							deploy_function: createDeployFunctionTool(this.deps, context),
							enable_ai: createEnableAiTool(this.deps, context),
							get_advisors: createGetAdvisorsTool(this.deps, context),
							run_sql: createRunSqlTool(this.deps, context),
							run_sql_write: createRunSqlWriteTool(this.deps, context),
							set_secret: createSetSecretTool(this.deps, context),
						}),
				...(hasAppTheme
					? {
							[SET_THEME_TOOL_NAME]: createSetThemeTool(
								{ logger: this.deps.logger },
								context,
							),
						}
					: {}),
			},
		});
	}
}
