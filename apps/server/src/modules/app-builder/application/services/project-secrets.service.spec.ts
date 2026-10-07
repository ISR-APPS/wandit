import {
	ConflictException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { listProjectSecretsResponseSchema } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import type { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import type {
	DeleteUserSecretOutcome,
	ProjectSecretCipherRow,
	ProjectSecretsRepository,
	ProjectSecretUpsertInput,
} from "../../infrastructure/persistence/project-secrets.repository";
import {
	decryptSecret,
	parseSecretKeyRing,
} from "../../infrastructure/secrets/secret-crypto";
import {
	ProjectSecretsService,
	type SecretActor,
} from "./project-secrets.service";

const KEY_V1 = Buffer.alloc(32, 1).toString("base64");
const KEY_V2 = Buffer.alloc(32, 2).toString("base64");
const ENV_KEY = `v1:${KEY_V1},v2:${KEY_V2}`;
const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const ORG_SCOPE: ProjectScope = {
	actorIsLimitExempt: false,
	kind: "org",
	organizationId: "org-1",
	userId: "member-1",
};
const ACTOR: SecretActor = { ip: "203.0.113.9", scope: SCOPE };

function setup(options?: {
	deleteOutcome?: DeleteUserSecretOutcome;
	engine?: "v1_page" | "v2_app" | null;
	upsertId?: string | null;
}) {
	const secrets = {
		deleteUserSecret: vi.fn<ProjectSecretsRepository["deleteUserSecret"]>(
			async () => options?.deleteOutcome ?? { id: "row-1", outcome: "deleted" },
		),
		findCipherByName: vi.fn<ProjectSecretsRepository["findCipherByName"]>(
			async () => null,
		),
		listSummaries: vi.fn<ProjectSecretsRepository["listSummaries"]>(
			async () => [],
		),
		upsert: vi.fn<ProjectSecretsRepository["upsert"]>(
			// `??` would turn the null id of the 409 case into "row-1".
			async () =>
				options?.upsertId === undefined ? "row-1" : options.upsertId,
		),
	};
	const projects = {
		findEngineByIdForScope: vi.fn<ProjectsRepository["findEngineByIdForScope"]>(
			// `??` would turn the null engine of the 404 cases into "v2_app".
			async () => (options?.engine === undefined ? "v2_app" : options.engine),
		),
	};
	const audit = {
		insert: vi.fn<AuditEventsRepository["insert"]>(async () => undefined),
	};
	const service = new ProjectSecretsService(secrets, projects, audit, {
		APP_SECRETS_ENCRYPTION_KEY: ENV_KEY,
		V2_HARNESS: "claude-code",
	});

	return { audit, projects, secrets, service };
}

/** The input of the first `upsert` call; fails the case when none happened. */
function writtenRow(secrets: {
	upsert: { mock: { calls: [ProjectSecretUpsertInput][] } };
}): ProjectSecretUpsertInput {
	const input = secrets.upsert.mock.calls[0]?.[0];
	if (input === undefined) {
		throw new Error("upsert was not called");
	}
	return input;
}

describe("ProjectSecretsService.set", () => {
	it("encrypts with the newest version, writes the row, and audits without the value", async () => {
		const { audit, projects, secrets, service } = setup();

		await service.set(
			"project-1",
			"STRIPE_SECRET_KEY",
			"sk_live_secret",
			"user",
			ACTOR,
		);

		expect(projects.findEngineByIdForScope).toHaveBeenCalledWith(
			SCOPE,
			"project-1",
		);
		const written = writtenRow(secrets);
		expect(written).toMatchObject({
			createdBy: "user-1",
			keyVersion: 2,
			kind: "user",
			name: "STRIPE_SECRET_KEY",
			organizationId: null,
			projectId: "project-1",
			userId: "user-1",
		});
		expect(written.ciphertext).not.toContain("sk_live_secret");
		expect(
			decryptSecret(
				parseSecretKeyRing(ENV_KEY),
				{ name: "STRIPE_SECRET_KEY", projectId: "project-1" },
				written.ciphertext,
				2,
			),
		).toBe("sk_live_secret");
		expect(audit.insert).toHaveBeenCalledWith({
			action: "secret.set",
			actorUserId: "user-1",
			ip: "203.0.113.9",
			metadata: { kind: "user", name: "STRIPE_SECRET_KEY" },
			organizationId: null,
			projectId: "project-1",
			targetId: "row-1",
			targetType: "project_secret",
		});
		expect(JSON.stringify(audit.insert.mock.calls)).not.toContain(
			"sk_live_secret",
		);
	});

	it("writes the org owner pair and no author for a system row", async () => {
		const { audit, secrets, service } = setup();

		await service.set(
			"project-1",
			"SUPABASE_SERVICE_ROLE_KEY",
			"srv",
			"system",
			{
				ip: null,
				scope: ORG_SCOPE,
			},
		);

		expect(secrets.upsert.mock.calls[0]?.[0]).toMatchObject({
			createdBy: null,
			kind: "system",
			organizationId: "org-1",
			userId: "member-1",
		});
		expect(audit.insert.mock.calls[0]?.[0]).toMatchObject({
			actorUserId: null,
			ip: null,
			organizationId: "org-1",
		});
	});

	it("answers 409 and writes no audit row when a user write meets a system row", async () => {
		const { audit, service } = setup({ upsertId: null });

		await expect(
			service.set("project-1", "SUPABASE_SERVICE_ROLE_KEY", "x", "user", ACTOR),
		).rejects.toBeInstanceOf(ConflictException);
		expect(audit.insert).not.toHaveBeenCalled();
	});

	it("answers 404 before any write when the project is out of scope or not v2", async () => {
		for (const engine of [null, "v1_page"] as const) {
			const { secrets, service } = setup({ engine });

			await expect(
				service.set("project-1", "NAME", "x", "user", ACTOR),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(secrets.upsert).not.toHaveBeenCalled();
		}
	});

	it("answers 503 V2_ENV_MISSING when the encryption key is unset", async () => {
		const secrets = {
			deleteUserSecret: vi.fn<ProjectSecretsRepository["deleteUserSecret"]>(),
			findCipherByName: vi.fn<ProjectSecretsRepository["findCipherByName"]>(),
			listSummaries: vi.fn<ProjectSecretsRepository["listSummaries"]>(),
			upsert: vi.fn<ProjectSecretsRepository["upsert"]>(),
		};
		const service = new ProjectSecretsService(
			secrets,
			{ findEngineByIdForScope: vi.fn(async () => "v2_app" as const) },
			{ insert: vi.fn(async () => undefined) },
			{ V2_HARNESS: "claude-code" },
		);

		await expect(
			service.set("project-1", "NAME", "x", "user", ACTOR),
		).rejects.toMatchObject({
			response: { code: "V2_ENV_MISSING" },
		});
		await expect(
			service.set("project-1", "NAME", "x", "user", ACTOR),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(secrets.upsert).not.toHaveBeenCalled();
	});
});

describe("ProjectSecretsService.remove", () => {
	it("deletes a user row and audits the delete with the ip", async () => {
		const { audit, secrets, service } = setup();

		await service.remove("project-1", "STRIPE_SECRET_KEY", ACTOR);

		expect(secrets.deleteUserSecret).toHaveBeenCalledWith(
			"project-1",
			"STRIPE_SECRET_KEY",
		);
		expect(audit.insert).toHaveBeenCalledWith({
			action: "secret.deleted",
			actorUserId: "user-1",
			ip: "203.0.113.9",
			metadata: { name: "STRIPE_SECRET_KEY" },
			organizationId: null,
			projectId: "project-1",
			targetId: "row-1",
			targetType: "project_secret",
		});
	});

	it("answers 409 on a system row and 404 on a missing row, without audit", async () => {
		const system = setup({ deleteOutcome: { outcome: "system" } });
		const missing = setup({ deleteOutcome: { outcome: "missing" } });

		await expect(
			system.service.remove("project-1", "SUPABASE_SERVICE_ROLE_KEY", ACTOR),
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			missing.service.remove("project-1", "NOPE", ACTOR),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(system.audit.insert).not.toHaveBeenCalled();
		expect(missing.audit.insert).not.toHaveBeenCalled();
	});
});

describe("ProjectSecretsService.listNames", () => {
	it("answers names, kinds, and ISO dates that match the contract", async () => {
		const { secrets, service } = setup();
		secrets.listSummaries.mockResolvedValueOnce([
			{
				createdAt: new Date("2026-09-01T00:00:00.000Z"),
				kind: "system",
				name: "SUPABASE_SERVICE_ROLE_KEY",
				updatedAt: new Date("2026-09-02T00:00:00.000Z"),
			},
		]);

		const response = await service.listNames(SCOPE, "project-1");

		expect(listProjectSecretsResponseSchema.parse(response)).toEqual({
			secrets: [
				{
					createdAt: "2026-09-01T00:00:00.000Z",
					kind: "system",
					name: "SUPABASE_SERVICE_ROLE_KEY",
					updatedAt: "2026-09-02T00:00:00.000Z",
				},
			],
		});
	});

	it("answers 404 for a project out of scope", async () => {
		const { service } = setup({ engine: null });

		await expect(service.listNames(SCOPE, "project-1")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});

describe("ProjectSecretsService.readValue", () => {
	it("decrypts the stored row and answers null without a row", async () => {
		const { secrets, service } = setup();
		await service.set("project-1", "STRIPE_SECRET_KEY", "plain", "user", ACTOR);
		const written = writtenRow(secrets);
		const row: ProjectSecretCipherRow = {
			ciphertext: written.ciphertext,
			id: "row-1",
			keyVersion: written.keyVersion,
			name: "STRIPE_SECRET_KEY",
			projectId: "project-1",
		};
		secrets.findCipherByName.mockResolvedValueOnce(row);

		expect(await service.readValue("project-1", "STRIPE_SECRET_KEY")).toBe(
			"plain",
		);
		expect(
			await service.readValue("project-1", "STRIPE_SECRET_KEY"),
		).toBeNull();
	});

	it("throws when the row was copied from another project", async () => {
		const { secrets, service } = setup();
		await service.set("project-1", "STRIPE_SECRET_KEY", "plain", "user", ACTOR);
		const written = writtenRow(secrets);
		secrets.findCipherByName.mockResolvedValueOnce({
			ciphertext: written.ciphertext,
			id: "row-2",
			keyVersion: written.keyVersion,
			name: "STRIPE_SECRET_KEY",
			projectId: "project-2",
		});

		await expect(
			service.readValue("project-2", "STRIPE_SECRET_KEY"),
		).rejects.toThrow("project-2:STRIPE_SECRET_KEY failed to decrypt");
	});
});
