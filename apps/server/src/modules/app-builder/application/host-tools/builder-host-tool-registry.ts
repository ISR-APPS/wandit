/**
 * The real `HostToolRegistry` of the builder turn (WANDIT-169).
 * `builder-turn.task.ts` injects it into the runtime; `build` assembles
 * the per-turn tool set the harness hands to the agent: `ask_user`,
 * `generate_image`, and `set_theme` for a template with the theme system.
 * A web or mobile project adds `request_network_host`, the seven backend
 * tools of WANDIT-186, and `enable_ai` of the app AI gateway; a desktop
 * project adds `add_local_migration`. A Plan Mode turn gets only `ask_user`
 * and `present_plan`.
 * The tools run in the task process, so platform and partner secrets stay
 * out of the sandbox.
 */
import { supportsAppTheme } from "../../domain/app-theme-deal";
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";
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

/**
 * The image deps, the backend tool deps (WANDIT-186) with the AI key write
 * of `enable_ai`, the network-host repository (WANDIT-180), and the desktop
 * migration registry. `audit`
 * serves `request_network_host` and the backend tools; `logger` serves every tool.
 */
export type BuilderHostToolRegistryDeps = GenerateImageHostToolDeps &
	EnableAiToolDeps & {
		/** Appends an approved egress host, in one transaction with its audit row. */
		networkHosts: RequestNetworkHostHostToolDeps["networkHosts"];
		/** Reads the frozen migrations of a desktop project for `add_local_migration`. */
		desktopMigrations: AddLocalMigrationHostToolDeps["desktopMigrations"];
	};

/**
 * Assembles one turn's host tools. Connector tools land in the follow-up
 * when the Nest container exists.
 */
export class BuilderHostToolRegistry implements HostToolRegistry {
	constructor(private readonly deps: BuilderHostToolRegistryDeps) {}

	build(context: HostToolContext): Promise<HostToolSet> {
		// Plan Mode changes nothing in the project, the backend, or the
		// network: the agent only asks questions and shows the plan.
		if (context.mode === "plan") {
			return Promise.resolve({
				close: async () => {},
				// The questions and the plan are the user's turn; no approval first.
				toolApproval: {
					[ASK_USER_TOOL_NAME]: "not-applicable",
					[PRESENT_PLAN_TOOL_NAME]: "not-applicable",
				},
				tools: {
					[ASK_USER_TOOL_NAME]: createAskUserTool(),
					[PRESENT_PLAN_TOOL_NAME]: createPresentPlanTool(),
				},
			});
		}
		// Only a template with src/styles/theme.json has a theme to set.
		const hasAppTheme = supportsAppTheme(context.templateVersion);
		// A desktop app keeps its data in a local SQLite file: it has no cloud
		// backend, so no backend tool and no enable_ai. Its schema changes only
		// through add_local_migration.
		// Its CSP blocks every remote host, so it gets no request_network_host:
		// an approved host would work in the preview and fail in the installed app.
		const isDesktop = context.framework === TEMPLATE_PROFILES.desktop.framework;
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
