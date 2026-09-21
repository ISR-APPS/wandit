/**
 * The real `HostToolRegistry` of the builder turn (WANDIT-169).
 * `builder-turn.task.ts` injects it into the runtime; `build` assembles
 * the per-turn tool set the harness hands to the agent. The tools run in
 * the task process, so platform and partner secrets stay out of the
 * sandbox.
 */
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";
import type { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import type { ProjectNetworkHostsRepository } from "../../infrastructure/persistence/project-network-hosts.repository";
import {
	createGenerateImageTool,
	type GenerateImageHostToolDeps,
} from "./generate-image.host-tool";
import { createRequestNetworkHostTool } from "./request-network-host.host-tool";

/** The image deps plus the network-host tool's repositories (WANDIT-180). */
export type BuilderHostToolRegistryDeps = GenerateImageHostToolDeps & {
	/** Appends an approved egress host to the project. */
	networkHosts: Pick<ProjectNetworkHostsRepository, "appendHost">;
	/** Writes the `network.host_allowed` audit row. */
	audit: Pick<AuditEventsRepository, "insert">;
};

/**
 * Assembles one turn's host tools: `generate_image` and, with approval,
 * `request_network_host`. Connector tools land in the follow-up when the
 * Nest container exists.
 */
export class BuilderHostToolRegistry implements HostToolRegistry {
	constructor(private readonly deps: BuilderHostToolRegistryDeps) {}

	build(context: HostToolContext): Promise<HostToolSet> {
		return Promise.resolve({
			// Nothing to release yet: the connector clients that need a
			// close land in the connector follow-up issue.
			close: async () => {},
			toolApproval: {
				generate_image: "not-applicable",
				// The user must approve each new egress host before it applies.
				request_network_host: "user-approval",
			},
			tools: {
				generate_image: createGenerateImageTool(this.deps, context),
				request_network_host: createRequestNetworkHostTool(
					{
						audit: this.deps.audit,
						logger: this.deps.logger,
						networkHosts: this.deps.networkHosts,
					},
					context,
				),
			},
		});
	}
}
