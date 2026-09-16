import {
	ConflictException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	PREVIEW_TOKEN_QUERY,
	PREVIEW_TOKEN_TTL_SECONDS,
	previewHostFor,
	previewTokenResponseSchema,
	verifyPreviewToken,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { V2EnvSource } from "../../infrastructure/env/v2-env";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import { FakeSandboxSessionsRepository } from "../../infrastructure/persistence/fake-sandbox-sessions.repository";
import type { SandboxSessionRow } from "../../infrastructure/persistence/sandbox-sessions.repository";
import { PreviewTokenService } from "./preview-token.service";

const SIGNING_KEY = "preview-test-key";
const DOMAIN = "wanditpreview.app";
const PROJECT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
// `rid` must be a uuid: the claims schema parses it as one.
const RUN_ID = "11111111-2222-4333-8444-555555555555";
// Stands in for the vendor host of the dev port; the vendor-isolation
// spec forbids a real vendor hostname outside `infrastructure/sandbox/`.
const PREVIEW_HOST = "x-5173.preview-host.test";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };

const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: PROJECT_ID,
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

// One `sandbox_sessions` row as `findLiveByProjectId` returns it.
function sessionRow(overrides?: Partial<SandboxSessionRow>): SandboxSessionRow {
	return {
		createdAt: new Date("2026-09-16T10:00:00.000Z"),
		error: null,
		expiresAt: null,
		id: RUN_ID,
		image: "vercel/sandbox/node:22",
		lastActiveAt: new Date("2026-09-16T10:00:00.000Z"),
		lastSnapshotAt: null,
		organizationId: null,
		previewHost: PREVIEW_HOST,
		projectId: PROJECT_ID,
		provider: "vercel",
		providerSandboxId: "sbx-1",
		status: "running",
		updatedAt: new Date("2026-09-16T10:00:00.000Z"),
		userId: "user-1",
		...overrides,
	};
}

function fixture(options?: {
	env?: V2EnvSource;
	project?: ScopedAppProject | null;
	row?: SandboxSessionRow;
}) {
	const sessions = new FakeSandboxSessionsRepository();
	if (options?.row) {
		sessions.rows.set(options.row.id, options.row);
	}
	// Records each stamp call; the mint path must touch the row once.
	sessions.touchActivity = vi.fn(async () => undefined);

	const appCommits = {
		findScopedProject: async () =>
			options?.project === undefined ? PROJECT : options.project,
	};
	const env: V2EnvSource = options?.env ?? {
		PREVIEW_DOMAIN: DOMAIN,
		PREVIEW_TOKEN_SIGNING_KEY: SIGNING_KEY,
		V2_HARNESS: "claude-code",
	};
	const service = new PreviewTokenService(appCommits, sessions, env);
	return { service, sessions };
}

describe("PreviewTokenService.mint", () => {
	it("mints a token the Worker verifies, on the isolated preview host", async () => {
		const { service, sessions } = fixture({ row: sessionRow() });

		const body = await service.mint(SCOPE, PROJECT_ID);

		const parsed = previewTokenResponseSchema.parse(body);
		const verified = await verifyPreviewToken(
			parsed.token,
			SIGNING_KEY,
			Math.floor(Date.now() / 1000),
		);
		if (!verified.ok) {
			throw new Error(`preview token did not verify: ${verified.reason}`);
		}
		expect(verified.claims).toMatchObject({
			pid: PROJECT_ID,
			rid: RUN_ID,
			uid: "user-1",
			up: `https://${PREVIEW_HOST}`,
		});
		expect(parsed.previewUrl).toBe(
			`https://${previewHostFor(PROJECT_ID, RUN_ID, DOMAIN)}/?${PREVIEW_TOKEN_QUERY}=${parsed.token}`,
		);
		// The token `exp` and the `expiresAt` field are the same instant.
		expect(verified.claims.exp * 1000).toBe(Date.parse(parsed.expiresAt));
		// `mint` floors `exp` to whole seconds, so the gap is below the
		// 900 s TTL. Five seconds of slack cover the test runtime.
		const ttlMs = Date.parse(parsed.expiresAt) - Date.now();
		expect(ttlMs).toBeGreaterThan(PREVIEW_TOKEN_TTL_SECONDS * 1000 - 5_000);
		expect(ttlMs).toBeLessThanOrEqual(PREVIEW_TOKEN_TTL_SECONDS * 1000);
		expect(sessions.touchActivity).toHaveBeenCalledTimes(1);
		expect(sessions.touchActivity).toHaveBeenCalledWith(PROJECT_ID);
	});

	it("answers 409 SANDBOX_NOT_RUNNING when the live row is stopped", async () => {
		const { service } = fixture({ row: sessionRow({ status: "stopped" }) });

		const failure = await service
			.mint(SCOPE, PROJECT_ID)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the type; getResponse carries
		// the { code, message } body passed to the exception.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "SANDBOX_NOT_RUNNING",
		});
	});

	it("answers 409 when the running row has no preview host", async () => {
		const { service } = fixture({ row: sessionRow({ previewHost: null }) });

		const failure = await service
			.mint(SCOPE, PROJECT_ID)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the type; getResponse carries
		// the { code, message } body passed to the exception.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "SANDBOX_NOT_RUNNING",
		});
	});

	it("answers 409 when the project has no live sandbox row", async () => {
		const { service } = fixture();

		const failure = await service
			.mint(SCOPE, PROJECT_ID)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the type; getResponse carries
		// the { code, message } body passed to the exception.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "SANDBOX_NOT_RUNNING",
		});
	});

	it("answers 404 for a v1_page project", async () => {
		const { service } = fixture({
			project: { ...PROJECT, engine: "v1_page" },
		});

		await expect(service.mint(SCOPE, PROJECT_ID)).rejects.toEqual(
			expect.any(NotFoundException),
		);
	});

	it("answers 404 for a project outside the caller's scope", async () => {
		const { service } = fixture({ project: null });

		await expect(service.mint(SCOPE, PROJECT_ID)).rejects.toEqual(
			expect.any(NotFoundException),
		);
	});

	it("answers 503 V2_ENV_MISSING without the signing key", async () => {
		const { service } = fixture({
			env: { V2_HARNESS: "claude-code" },
			row: sessionRow(),
		});

		const failure = await service
			.mint(SCOPE, PROJECT_ID)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ServiceUnavailableException);
		// SAFETY: toBeInstanceOf above proves the type; getResponse carries
		// the { code, message } body passed to the exception.
		expect(
			(failure as ServiceUnavailableException).getResponse(),
		).toMatchObject({ code: "V2_ENV_MISSING" });
	});
});
