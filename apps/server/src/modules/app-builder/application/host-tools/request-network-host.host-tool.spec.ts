import { describe, expect, it, vi } from "vitest";
import type { HostToolContext } from "../../domain/ports/host-tools";
import type { AuditEventInput } from "../../infrastructure/persistence/audit-events.repository";
import type { ProjectNetworkHostsTransaction } from "../../infrastructure/persistence/project-network-hosts.repository";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import {
	createRequestNetworkHostTool,
	type RequestNetworkHostHostToolDeps,
} from "./request-network-host.host-tool";

const OPTIONS = {
	context: {},
	messages: [],
	toolCallId: "tc-1",
};

/** The grant step a failure case makes throw. */
type FailingStep = "host write" | "audit insert" | "live allow";

// In-memory stand-in for Postgres. A write with the open `tx` reaches the
// lists only when the `transaction` callback resolves.
function fakeStore(failingStep: FailingStep | undefined) {
	const hosts: string[] = [];
	const auditRows: AuditEventInput[] = [];
	// SAFETY: the fakes compare this object by identity only; nothing calls it.
	const tx = {} as ProjectNetworkHostsTransaction;
	let pending: (() => void)[] = [];
	// A write of the open transaction waits for the commit; any other lands now.
	const write = (inTransaction: boolean, apply: () => void) => {
		if (inTransaction) {
			pending.push(apply);
		} else {
			apply();
		}
	};
	const networkHosts: RequestNetworkHostHostToolDeps["networkHosts"] = {
		appendHost: async (_projectId, host, client) => {
			if (failingStep === "host write") {
				throw new Error("db down");
			}
			write(client === tx, () => hosts.push(host));
			return [host];
		},
		transaction: async (work) => {
			pending = [];
			// A throw skips the commit loop, like a Postgres rollback.
			await work(tx);
			for (const apply of pending) {
				apply();
			}
		},
	};
	const audit: RequestNetworkHostHostToolDeps["audit"] = {
		insert: async (input, client) => {
			if (failingStep === "audit insert") {
				throw new Error("db down");
			}
			write(client === tx, () => auditRows.push(input));
		},
	};
	return { audit, auditRows, hosts, networkHosts };
}

async function setup(failingStep?: FailingStep) {
	const provider = new FakeSandboxProvider();
	if (failingStep === "live allow") {
		provider.allowHostFailure = new Error("vendor down");
	}
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "web-app@1.0.0",
	});
	const store = fakeStore(failingStep);
	const warn = vi.fn();
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		holdEventId: null,
		mode: "build",
		organizationId: "org-1",
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: "org-1" },
		turnId: "turn-1",
	};
	const tool = createRequestNetworkHostTool(
		{
			audit: store.audit,
			logger: { warn },
			networkHosts: store.networkHosts,
		},
		context,
	);
	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("request_network_host must define execute");
	}
	return { execute, provider, store, warn };
}

describe("createRequestNetworkHostTool", () => {
	it("stores, audits, applies live, and returns allowed for a valid host", async () => {
		const { execute, provider, store } = await setup();

		const result = await execute(
			{ host: "api.github.com", reason: "the app calls the GitHub API" },
			OPTIONS,
		);

		expect(result).toEqual({ host: "api.github.com", status: "allowed" });
		expect(store.hosts).toEqual(["api.github.com"]);
		expect(provider.allowedHosts).toEqual(["api.github.com"]);
		expect(store.auditRows).toEqual([
			{
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
			},
		]);
	});

	it("lower-cases the host before it stores and applies it", async () => {
		const { execute, provider, store } = await setup();

		const result = await execute(
			{ host: "API.GitHub.com", reason: "connector" },
			OPTIONS,
		);

		expect(result).toEqual({ host: "api.github.com", status: "allowed" });
		expect(store.hosts).toEqual(["api.github.com"]);
		expect(provider.allowedHosts).toEqual(["api.github.com"]);
	});

	it("denies an IP address and changes nothing", async () => {
		const { execute, provider, store } = await setup();

		const result = await execute(
			{ host: "10.0.0.1", reason: "internal" },
			OPTIONS,
		);

		expect(result).toEqual({
			reason: "host is not a valid public DNS name",
			status: "denied",
		});
		expect(store.hosts).toEqual([]);
		expect(store.auditRows).toEqual([]);
		expect(provider.allowedHosts).toEqual([]);
	});

	it.each([
		"*.supabase.co",
		"otherprojectref.supabase.co",
		"supabase.co",
		"api.supabase.com",
	])("denies the Supabase host %s and changes nothing", async (host) => {
		const { execute, provider, store } = await setup();

		const result = await execute({ host, reason: "backend" }, OPTIONS);

		expect(result).toEqual({
			reason:
				"Supabase hosts are not allowed; the sandbox reaches the project's own backend while it is active",
			status: "denied",
		});
		expect(store.hosts).toEqual([]);
		expect(store.auditRows).toEqual([]);
		expect(provider.allowedHosts).toEqual([]);
	});

	it("denies a single-label host and changes nothing", async () => {
		const { execute, store } = await setup();

		const result = await execute(
			{ host: "metadata", reason: "internal" },
			OPTIONS,
		);

		expect(result).toEqual({
			reason: "host is not a valid public DNS name",
			status: "denied",
		});
		expect(store.hosts).toEqual([]);
		expect(store.auditRows).toEqual([]);
	});

	// WANDIT-180: a host the agent hears as denied must not go live at the
	// next sandbox start, and no audit row may claim a grant.
	it.each<FailingStep>([
		"host write",
		"audit insert",
		"live allow",
	])("denies and stores nothing when the %s fails", async (failingStep) => {
		const { execute, provider, store, warn } = await setup(failingStep);

		const result = await execute(
			{ host: "api.github.com", reason: "connector" },
			OPTIONS,
		);

		expect(result).toEqual({
			reason: "could not apply the host",
			status: "denied",
		});
		expect(store.hosts).toEqual([]);
		expect(store.auditRows).toEqual([]);
		// The live allow has no undo, so a failed write must stop it first.
		expect(provider.allowedHosts).toEqual([]);
		expect(warn).toHaveBeenCalled();
	});
});
