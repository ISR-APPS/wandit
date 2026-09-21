import { getTableConfig } from "@wandit/db";
import {
	appBackendProvider,
	appBackendStatus,
} from "@wandit/db/schema/app-backends";
import { appCommitSource } from "@wandit/db/schema/app-versions";
import { builderHarness } from "@wandit/db/schema/builder-sessions";
import {
	builderTurnStatus,
	builderTurns,
} from "@wandit/db/schema/builder-turns";
import {
	projectEngine,
	projects,
	projectTargetPlatform,
} from "@wandit/db/schema/projects";
import {
	sandboxSessionStatus,
	sandboxSessions,
} from "@wandit/db/schema/sandbox-sessions";
import { describe, expect, it } from "vitest";

// Pins the V2 enum values: every later V2 issue writes them, so a drift here
// breaks production code before the migration even runs.
describe("v2 core schema", () => {
	it("keeps builder_turn_status values in order", () => {
		expect(builderTurnStatus.enumValues).toEqual([
			"queued",
			"waiting",
			"running",
			"cancelling",
			"waiting_for_answer",
			"waiting_for_approval",
			"succeeded",
			"failed",
			"canceled",
			"stalled",
			"stopped_no_credits",
			"stopped_project_cap",
			"stopped_disabled",
		]);
	});

	it("keeps builder_harness values", () => {
		expect(builderHarness.enumValues).toEqual(["claude_code", "opencode"]);
	});

	it("keeps project_engine and project_target_platform values", () => {
		expect(projectEngine.enumValues).toEqual(["v1_page", "v2_app"]);
		expect(projectTargetPlatform.enumValues).toEqual(["web", "mobile"]);
	});

	it("keeps sandbox_session_status values", () => {
		expect(sandboxSessionStatus.enumValues).toEqual([
			"creating",
			"running",
			"stopped",
			"expired",
			"destroyed",
			"error",
		]);
	});

	it("keeps app_backend_provider and app_backend_status values", () => {
		expect(appBackendProvider.enumValues).toEqual(["supabase"]);
		expect(appBackendStatus.enumValues).toEqual([
			"creating",
			"active",
			"paused",
			"restoring",
			"deleting",
			"error",
		]);
	});

	it("keeps app_commit_source values", () => {
		expect(appCommitSource.enumValues).toEqual([
			"agent",
			"restore",
			"wip",
			"merge",
		]);
	});

	it("has a unique partial index for one active builder turn per project", () => {
		const index = getTableConfig(builderTurns).indexes.find(
			(candidate) =>
				candidate.config.name === "builder_turns_active_project_uq",
		);
		expect(index).toBeDefined();
		expect(index?.config.unique).toBe(true);
	});

	it("has a unique partial index for one live sandbox per project", () => {
		const index = getTableConfig(sandboxSessions).indexes.find(
			(candidate) =>
				candidate.config.name === "sandbox_sessions_live_project_uq",
		);
		expect(index).toBeDefined();
		expect(index?.config.unique).toBe(true);
	});

	it("keeps projects.network_allowed_hosts as a not-null jsonb column", () => {
		const column = getTableConfig(projects).columns.find(
			(candidate) => candidate.name === "network_allowed_hosts",
		);
		expect(column?.columnType).toBe("PgJsonb");
		expect(column?.notNull).toBe(true);
		expect(column?.hasDefault).toBe(true);
	});
});
