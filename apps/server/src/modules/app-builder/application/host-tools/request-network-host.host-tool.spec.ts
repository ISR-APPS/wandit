import { describe, expect, it, vi } from "vitest";
import type { HostToolContext } from "../../domain/ports/host-tools";
import type { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import type { ProjectNetworkHostsRepository } from "../../infrastructure/persistence/project-network-hosts.repository";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import { createRequestNetworkHostTool } from "./request-network-host.host-tool";

const OPTIONS = {
	context: {},
	messages: [],
	toolCallId: "tc-1",
};

async function setup() {
	const provider = new FakeSandboxProvider();
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "web-app@1.0.0",
	});
	const appendHost = vi.fn<ProjectNetworkHostsRepository["appendHost"]>(
		async () => ["api.github.com"],
	);
	const insert = vi.fn<AuditEventsRepository["insert"]>(async () => undefined);
	const warn = vi.fn();
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		holdEventId: null,
		organizationId: "org-1",
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: "org-1" },
		turnId: "turn-1",
	};
	const tool = createRequestNetworkHostTool(
		{ audit: { insert }, logger: { warn }, networkHosts: { appendHost } },
		context,
	);
	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("request_network_host must define execute");
	}
	return { appendHost, context, execute, insert, provider, warn };
}

describe("createRequestNetworkHostTool", () => {
	it("appends, applies live, audits, and returns allowed for a valid host", async () => {
		const { appendHost, execute, insert, provider } = await setup();

		const result = await execute(
			{ host: "api.github.com", reason: "the app calls the GitHub API" },
			OPTIONS,
		);

		expect(result).toEqual({ host: "api.github.com", status: "allowed" });
		expect(appendHost).toHaveBeenCalledWith("project-1", "api.github.com");
		expect(provider.allowedHosts).toEqual(["api.github.com"]);
		expect(insert).toHaveBeenCalledWith({
			action: "network.host_allowed",
			actorUserId: "user-1",
			metadata: {
				host: "api.github.com",
				reason: "the app calls the GitHub API",
			},
			organizationId: "org-1",
			projectId: "project-1",
			targetId: "project-1",
			targetType: "project",
		});
	});

	it("lower-cases the host before it stores and applies it", async () => {
		const { appendHost, execute, provider } = await setup();

		const result = await execute(
			{ host: "API.GitHub.com", reason: "connector" },
			OPTIONS,
		);

		expect(result).toEqual({ host: "api.github.com", status: "allowed" });
		expect(appendHost).toHaveBeenCalledWith("project-1", "api.github.com");
		expect(provider.allowedHosts).toEqual(["api.github.com"]);
	});

	it("denies an IP address and changes nothing", async () => {
		const { appendHost, execute, insert, provider } = await setup();

		const result = await execute(
			{ host: "10.0.0.1", reason: "internal" },
			OPTIONS,
		);

		expect(result).toEqual({
			reason: "host is not a valid public DNS name",
			status: "denied",
		});
		expect(appendHost).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
		expect(provider.allowedHosts).toEqual([]);
	});

	it.each([
		"*.supabase.co",
		"otherprojectref.supabase.co",
		"supabase.co",
		"api.supabase.com",
	])("denies the Supabase host %s and changes nothing", async (host) => {
		const { appendHost, execute, insert, provider } = await setup();

		const result = await execute({ host, reason: "backend" }, OPTIONS);

		expect(result).toEqual({
			reason:
				"Supabase hosts are not allowed; the sandbox reaches the project's own backend while it is active",
			status: "denied",
		});
		expect(appendHost).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
		expect(provider.allowedHosts).toEqual([]);
	});

	it("denies a single-label host and changes nothing", async () => {
		const { appendHost, execute, insert } = await setup();

		const result = await execute(
			{ host: "metadata", reason: "internal" },
			OPTIONS,
		);

		expect(result).toEqual({
			reason: "host is not a valid public DNS name",
			status: "denied",
		});
		expect(appendHost).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("denies and writes no audit row when the live update fails", async () => {
		const { context, insert, warn } = await setup();
		// The persist step rejects; the tool must not audit a grant.
		const failing = createRequestNetworkHostTool(
			{
				audit: { insert },
				logger: { warn },
				networkHosts: {
					appendHost: async () => {
						throw new Error("db down");
					},
				},
			},
			context,
		);
		const failingExecute = failing.execute;
		if (failingExecute === undefined) {
			throw new Error("execute missing");
		}

		const result = await failingExecute(
			{ host: "api.github.com", reason: "connector" },
			OPTIONS,
		);

		expect(result).toEqual({
			reason: "could not apply the host",
			status: "denied",
		});
		expect(insert).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalled();
	});
});
