/**
 * The real `HostToolRegistry` of the builder turn (WANDIT-169).
 * `builder-turn.task.ts` injects it into the runtime; `build` assembles
 * the per-turn tool set the harness hands to the agent: `ask_user`,
 * `generate_image`, `request_network_host`, and the seven backend tools of
 * WANDIT-186. The tools run in the task process, so platform and partner
 * secrets stay out of the sandbox.
 */
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";
import type { ProjectNetworkHostsRepository } from "../../infrastructure/persistence/project-network-hosts.repository";
import { ASK_USER_TOOL_NAME, createAskUserTool } from "./ask-user.host-tool";
import {
	createApplyDestructiveMigrationTool,
	createApplyMigrationTool,
} from "./backend/apply-migration.host-tool";
import type { BackendToolDeps } from "./backend/backend-tool-deps";
import { createDeployFunctionTool } from "./backend/deploy-function.host-tool";
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
import { createRequestNetworkHostTool } from "./request-network-host.host-tool";

/**
 * The image deps, the backend tool deps (WANDIT-186), and the network-host
 * repository (WANDIT-180). `audit` serves `request_network_host` and the
 * backend tools; `logger` serves every tool.
 */
export type BuilderHostToolRegistryDeps = GenerateImageHostToolDeps &
	BackendToolDeps & {
		/** Appends an approved egress host to the project. */
		networkHosts: Pick<ProjectNetworkHostsRepository, "appendHost">;
	};

/**
 * Assembles one turn's host tools. Connector tools land in the follow-up
 * when the Nest container exists.
 */
export class BuilderHostToolRegistry implements HostToolRegistry {
	constructor(private readonly deps: BuilderHostToolRegistryDeps) {}

	build(context: HostToolContext): Promise<HostToolSet> {
		return Promise.resolve({
			// Nothing to release yet: the connector clients that need a
			// close land in the connector follow-up issue.
			close: async () => {},
			// The harness reads approval per tool name, so each write the user
			// must approve is its own tool with "user-approval".
			toolApproval: {
				// The questions themselves are the user's turn; no approval first.
				[ASK_USER_TOOL_NAME]: "not-applicable",
				apply_destructive_migration: "user-approval",
				apply_migration: "not-applicable",
				deploy_function: "not-applicable",
				generate_image: "not-applicable",
				get_advisors: "not-applicable",
				// The user must approve each new egress host before it applies.
				request_network_host: "user-approval",
				run_sql: "not-applicable",
				run_sql_write: "user-approval",
				set_secret: "not-applicable",
			},
			tools: {
				[ASK_USER_TOOL_NAME]: createAskUserTool(),
				apply_destructive_migration: createApplyDestructiveMigrationTool(
					this.deps,
					context,
				),
				apply_migration: createApplyMigrationTool(this.deps, context),
				deploy_function: createDeployFunctionTool(this.deps, context),
				generate_image: createGenerateImageTool(this.deps, context),
				get_advisors: createGetAdvisorsTool(this.deps, context),
				request_network_host: createRequestNetworkHostTool(
					{
						audit: this.deps.audit,
						logger: this.deps.logger,
						networkHosts: this.deps.networkHosts,
					},
					context,
				),
				run_sql: createRunSqlTool(this.deps, context),
				run_sql_write: createRunSqlWriteTool(this.deps, context),
				set_secret: createSetSecretTool(this.deps, context),
			},
		});
	}
}
