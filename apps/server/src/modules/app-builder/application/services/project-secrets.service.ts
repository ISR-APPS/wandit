/**
 * Write-only store of the secret values of one V2 app project (WANDIT-185).
 * `project-secrets.controller.ts` calls `set`, `remove`, and `listNames`;
 * only server code calls `readValue` (the provisioning task of WANDIT-183,
 * the `set_secret` tool of WANDIT-186, the connectors of WANDIT-189).
 * Encrypts through `secret-crypto.ts`, writes through
 * `ProjectSecretsRepository`, and records every write in `audit_events`.
 */
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	ListProjectSecretsResponse,
	ProjectSecretKind,
} from "@wandit/contracts";

import {
	type ProjectScope,
	projectOwnerColumns,
} from "../../../projects/domain/project-scope";
import { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { ProjectSecretSystemError } from "../../domain/errors/project-secret-system.error";
import {
	requireV2Env,
	V2_ENV,
	type V2EnvSource,
} from "../../infrastructure/env/v2-env";
import { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import { ProjectSecretsRepository } from "../../infrastructure/persistence/project-secrets.repository";
import {
	decryptSecret,
	encryptSecret,
	parseSecretKeyRing,
	type SecretKeyRing,
} from "../../infrastructure/secrets/secret-crypto";

/** Who performs a write. The audit row and the owner columns read it. */
export type SecretActor = {
	/**
	 * Membership proof of the caller: `set` and `remove` answer 404 when the
	 * project is outside it. A task builds it from the `projects` row.
	 */
	scope: ProjectScope;
	/** Client IP of the HTTP request, for the audit row; null when a task writes. */
	ip: string | null;
};

@Injectable()
export class ProjectSecretsService {
	constructor(
		@Inject(ProjectSecretsRepository)
		private readonly secrets: Pick<
			ProjectSecretsRepository,
			"upsert" | "deleteUserSecret" | "listSummaries" | "findCipherByName"
		>,
		@Inject(ProjectsRepository)
		private readonly projects: Pick<
			ProjectsRepository,
			"findEngineByIdForScope"
		>,
		@Inject(AuditEventsRepository)
		private readonly audit: Pick<AuditEventsRepository, "insert">,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	/**
	 * Encrypts `value` and inserts or replaces the row. A `user` write over
	 * a `system` row answers 409. Writes one `secret.set` audit row; the
	 * value itself is never logged or stored in the clear.
	 */
	async set(
		projectId: string,
		name: string,
		value: string,
		kind: ProjectSecretKind,
		actor: SecretActor,
	): Promise<void> {
		await this.requireV2AppProject(actor.scope, projectId);
		const encrypted = encryptSecret(this.keyRing(), { name, projectId }, value);
		const owner = projectOwnerColumns(actor.scope);
		// A system row has no human author: the task, not the member, wrote it.
		const actorUserId = kind === "user" ? actor.scope.userId : null;

		const rowId = await this.secrets.upsert({
			ciphertext: encrypted.ciphertext,
			createdBy: actorUserId,
			keyVersion: encrypted.keyVersion,
			kind,
			name,
			organizationId: owner.organizationId,
			projectId,
			userId: owner.userId,
		});
		if (rowId === null) {
			throw new ProjectSecretSystemError(name);
		}

		await this.audit.insert({
			action: "secret.set",
			actorUserId,
			ip: actor.ip,
			metadata: { kind, name },
			organizationId: owner.organizationId,
			projectId,
			targetId: rowId,
			targetType: "project_secret",
		});
	}

	/**
	 * Deletes one `user` row and writes a `secret.deleted` audit row. A
	 * `system` row answers 409; a missing row answers 404.
	 */
	async remove(
		projectId: string,
		name: string,
		actor: SecretActor,
	): Promise<void> {
		await this.requireV2AppProject(actor.scope, projectId);

		const result = await this.secrets.deleteUserSecret(projectId, name);
		if (result.outcome === "missing") {
			throw new NotFoundException();
		}
		if (result.outcome === "system") {
			throw new ProjectSecretSystemError(name);
		}

		await this.audit.insert({
			action: "secret.deleted",
			actorUserId: actor.scope.userId,
			ip: actor.ip,
			metadata: { name },
			organizationId: projectOwnerColumns(actor.scope).organizationId,
			projectId,
			targetId: result.id,
			targetType: "project_secret",
		});
	}

	/** `GET /v2/projects/:id/secrets`: names, kinds, and dates. Never a value. */
	async listNames(
		scope: ProjectScope,
		projectId: string,
	): Promise<ListProjectSecretsResponse> {
		await this.requireV2AppProject(scope, projectId);

		const rows = await this.secrets.listSummaries(projectId);
		return {
			secrets: rows.map((row) => ({
				createdAt: row.createdAt.toISOString(),
				kind: row.kind,
				name: row.name,
				updatedAt: row.updatedAt.toISOString(),
			})),
		};
	}

	/**
	 * The plain value of one secret, or null when the project has no row
	 * of that name. Server code only: no controller may call it. Throws
	 * when the row cannot decrypt (a missing key version or a moved row).
	 */
	async readValue(projectId: string, name: string): Promise<string | null> {
		const row = await this.secrets.findCipherByName(projectId, name);
		if (row === null) {
			return null;
		}

		return decryptSecret(
			this.keyRing(),
			{ name, projectId },
			row.ciphertext,
			row.keyVersion,
		);
	}

	/** Parsed at call time: a missing key is a 503 `V2_ENV_MISSING`, not a boot failure. */
	private keyRing(): SecretKeyRing {
		return parseSecretKeyRing(
			requireV2Env("APP_SECRETS_ENCRYPTION_KEY", this.v2Env),
		);
	}

	/**
	 * The secrets routes share the turn routes' rule: one 404 for
	 * "missing", "out of scope", and "not a V2 project".
	 */
	private async requireV2AppProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const engine = await this.projects.findEngineByIdForScope(scope, projectId);
		if (engine !== "v2_app") {
			throw new NotFoundException();
		}
	}
}
