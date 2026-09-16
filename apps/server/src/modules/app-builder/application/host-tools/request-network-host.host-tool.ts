/**
 * The `request_network_host` host tool of the builder turn (WANDIT-180).
 * `BuilderHostToolRegistry` builds it once per turn with `user-approval`, so
 * the user approves before it runs. On approval it stores the host on the
 * project, applies it to the live sandbox, and writes an audit row. It runs
 * in the task process, never in the sandbox.
 */
import {
	type RequestNetworkHostToolInput,
	type RequestNetworkHostToolOutput,
	requestNetworkHostToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../domain/ports/host-tools";
import type { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import type { ProjectNetworkHostsRepository } from "../../infrastructure/persistence/project-network-hosts.repository";
import { isValidNetworkHost } from "../../infrastructure/sandbox/network-policy";

/** What the registry hands the network-host tool factory. */
export type RequestNetworkHostHostToolDeps = {
	/** Appends the approved host to `projects.networkAllowedHosts`. */
	networkHosts: Pick<ProjectNetworkHostsRepository, "appendHost">;
	/** Writes the `network.host_allowed` audit row. */
	audit: Pick<AuditEventsRepository, "insert">;
	/** Warn sink for a failed policy update; `logger` in the task. */
	logger: Pick<Console, "warn">;
};

/**
 * Builds the AI SDK tool the harness sees. The registry marks it
 * `user-approval`, so `execute` runs only after the user approves; a denial
 * never reaches this body and changes nothing.
 */
export function createRequestNetworkHostTool(
	deps: RequestNetworkHostHostToolDeps,
	context: HostToolContext,
): Tool<RequestNetworkHostToolInput, RequestNetworkHostToolOutput> {
	return tool({
		description:
			"Request permission to reach ONE extra network host from the " +
			"sandbox, for example an API the app calls. The user approves the " +
			"request. `host` is a public DNS name (one optional `*` label), " +
			"never an IP address. On approval the host becomes reachable with " +
			"no restart. Do not use it for hosts already on the allow list.",
		inputSchema: requestNetworkHostToolInputSchema,
		execute: async ({
			host,
			reason,
		}): Promise<RequestNetworkHostToolOutput> => {
			// DNS is case-insensitive; store one canonical form so the next
			// sandbox start accepts the same host through `buildNetworkPolicy`.
			const normalized = host.trim().toLowerCase();
			// Security check: only a public DNS name, not an IP or private label.
			// A hostname that resolves into a denied range still fails at the
			// vendor firewall, because the deny ranges outrank the allow list.
			if (!isValidNetworkHost(normalized)) {
				return {
					reason: "host is not a valid public DNS name",
					status: "denied",
				};
			}
			try {
				// Persist first, so the grant survives a fresh sandbox, then
				// apply it to the live sandbox without a restart.
				await deps.networkHosts.appendHost(context.projectId, normalized);
				await context.sandbox.allowHost(normalized);
				await deps.audit.insert({
					action: "network.host_allowed",
					actorUserId: context.actorUserId,
					metadata: { host: normalized, reason },
					organizationId: context.organizationId,
					projectId: context.projectId,
					targetId: context.projectId,
					targetType: "project",
				});
				return { host: normalized, status: "allowed" };
			} catch (error) {
				// A failed live update leaves the persisted host for the next
				// start; the tool tells the agent the host is not reachable yet.
				deps.logger.warn("host-tool.request_network_host.failed", {
					message: error instanceof Error ? error.message : String(error),
					projectId: context.projectId,
				});
				return { reason: "could not apply the host", status: "denied" };
			}
		},
	});
}
