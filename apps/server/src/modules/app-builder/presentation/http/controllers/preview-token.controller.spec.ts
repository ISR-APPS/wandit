import { NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import {
	PREVIEW_TOKEN_QUERY,
	previewHostFor,
	previewTokenResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { ProjectScope } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { PreviewTokenService } from "../../../application/services/preview-token.service";
import type { V2EnvSource } from "../../../infrastructure/env/v2-env";
import type { ScopedAppProject } from "../../../infrastructure/persistence/app-commits.repository";
import { FakeSandboxSessionsRepository } from "../../../infrastructure/persistence/fake-sandbox-sessions.repository";
import type { SandboxSessionRow } from "../../../infrastructure/persistence/sandbox-sessions.repository";
import {
	RATE_LIMIT_OPTIONS,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { PreviewTokenController } from "./preview-token.controller";

const SIGNING_KEY = "preview-test-key";
const DOMAIN = "wanditpreview.app";
const PROJECT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const RUN_ID = "11111111-2222-4333-8444-555555555555";

const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: PROJECT_ID,
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user_1",
};

// One running `sandbox_sessions` row; `mint` needs a vendor preview host.
const RUNNING_ROW: SandboxSessionRow = {
	createdAt: new Date("2026-09-16T10:00:00.000Z"),
	error: null,
	expiresAt: null,
	id: RUN_ID,
	image: "vercel/sandbox/node:22",
	lastActiveAt: new Date("2026-09-16T10:00:00.000Z"),
	lastSnapshotAt: null,
	organizationId: null,
	// Stands in for the vendor host of the dev port; the vendor-isolation
	// spec forbids a real vendor hostname outside `infrastructure/sandbox/`.
	previewHost: "x-5173.preview-host.test",
	projectId: PROJECT_ID,
	provider: "vercel",
	providerSandboxId: "sbx-1",
	status: "running",
	updatedAt: new Date("2026-09-16T10:00:00.000Z"),
	userId: "user_1",
};

// Fake logged-in user for controller method calls (same shape as V1 specs).
const user = {
	banned: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	email: "user@example.com",
	emailVerified: true,
	id: "user_1",
	name: "User",
	role: "user",
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies Parameters<PreviewTokenController["mint"]>[1];

const workspace = { kind: "personal" } as const satisfies Parameters<
	PreviewTokenController["mint"]
>[2];

// An org workspace the caller does not share with the project.
const orgWorkspace: WorkspaceContext = {
	kind: "org",
	organizationId: "org_1",
	role: "member",
	roles: ["member"],
};

function setup() {
	const sessions = new FakeSandboxSessionsRepository();
	sessions.rows.set(RUNNING_ROW.id, RUNNING_ROW);
	const appCommits = {
		// The org scope sees no row: another workspace's project is a 404.
		findScopedProject: async (scope: ProjectScope) =>
			scope.kind === "org" ? null : PROJECT,
	};
	const env: V2EnvSource = {
		PREVIEW_DOMAIN: DOMAIN,
		PREVIEW_TOKEN_SIGNING_KEY: SIGNING_KEY,
		V2_HARNESS: "claude-code",
	};
	const service = new PreviewTokenService(appCommits, sessions, env);
	return { controller: new PreviewTokenController(service), sessions };
}

describe("PreviewTokenController", () => {
	it("sits behind the V2BuilderEnabledGuard and the RedisRateLimitGuard", () => {
		const guards = Reflect.getMetadata(GUARDS_METADATA, PreviewTokenController);
		// SAFETY: the metadata is the array UseGuards registered.
		expect(guards as unknown[]).toEqual(
			expect.arrayContaining([V2BuilderEnabledGuard, RedisRateLimitGuard]),
		);
	});

	it("rate-limits mint at 30 requests per user per minute", () => {
		expect(
			Reflect.getMetadata(
				RATE_LIMIT_OPTIONS,
				PreviewTokenController.prototype.mint,
			),
		).toEqual({ key: "preview-token", limit: 30, windowMs: 60_000 });
	});

	it("answers the preview-token contract for the project owner", async () => {
		const { controller } = setup();

		const body = await controller.mint(PROJECT_ID, user, workspace);

		const parsed = previewTokenResponseSchema.parse(body);
		expect(parsed.previewUrl).toBe(
			`https://${previewHostFor(PROJECT_ID, RUN_ID, DOMAIN)}/?${PREVIEW_TOKEN_QUERY}=${parsed.token}`,
		);
	});

	it("answers 404 when the project belongs to another workspace", async () => {
		const { controller } = setup();

		await expect(
			controller.mint(PROJECT_ID, user, orgWorkspace),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
