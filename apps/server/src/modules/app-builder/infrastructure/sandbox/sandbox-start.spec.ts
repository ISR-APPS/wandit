import { describe, expect, it, vi } from "vitest";

import type { AppBackendRow } from "../persistence/app-backends.repository";
import type { TurnProjectRow } from "../persistence/turn-project.repository";
import { FakeSandboxProvider } from "./fake-sandbox.provider";
import { startSandboxWithoutTurn } from "./sandbox-start";

const PROJECT: TurnProjectRow = {
	engine: "v2_app",
	framework: "web-app",
	languages: ["en"],
	networkAllowedHosts: ["api.stripe.com"],
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

const ACTIVE_BACKEND: AppBackendRow = {
	anonKey: "anon-key-1",
	dbHost: "db.abcdefghijklmnopqrst.supabase.co",
	failureCode: null,
	id: "backend-1",
	orgId: "sb-org",
	organizationId: null,
	projectId: "p-1",
	ref: "abcdefghijklmnopqrst",
	region: "eu-west-3",
	requestKey: "request-1",
	status: "active",
	triggerRunId: null,
	userId: "user-1",
};

function start(sandboxes: FakeSandboxProvider, backend: AppBackendRow | null) {
	// The `.env` write waits for the dev port with one `bash` command.
	sandboxes.respondTo("bash", { exitCode: 0, stderr: "", stdout: "" });
	return startSandboxWithoutTurn(
		{
			backends: { findByProjectId: async () => backend },
			logger: { warn: vi.fn() },
			projects: { findForTurn: async () => PROJECT },
			sandboxes,
		},
		"p-1",
	);
}

describe("startSandboxWithoutTurn", () => {
	// D18 and WANDIT-283: only the project's own active backend may reach the
	// egress list. A paused or new backend host stays out, like in a turn.
	it.each<[string, AppBackendRow | null, string | undefined]>([
		["active", ACTIVE_BACKEND, "https://abcdefghijklmnopqrst.supabase.co"],
		["paused", { ...ACTIVE_BACKEND, status: "paused" }, undefined],
		[
			"creating",
			{ ...ACTIVE_BACKEND, anonKey: null, status: "creating" },
			undefined,
		],
		["missing", null, undefined],
	])("gives the backend host only for an active backend (%s)", async (_state, backend, backendUrl) => {
		const sandboxes = new FakeSandboxProvider();

		await start(sandboxes, backend);

		expect(sandboxes.createOptions[0]?.backendUrl).toBe(backendUrl);
	});

	// git does not keep `.env`. Without this write, a wake that rebuilds a lost
	// sandbox serves the app with no Supabase values until the next paid turn.
	it("writes the backend .env when the start boots the sandbox", async () => {
		const sandboxes = new FakeSandboxProvider();

		const sandbox = await start(sandboxes, ACTIVE_BACKEND);

		const file = await sandbox.readFile(`${sandbox.workspaceDir}/.env`);
		expect(new TextDecoder().decode(file ?? new Uint8Array())).toContain(
			"VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co",
		);
	});
});
