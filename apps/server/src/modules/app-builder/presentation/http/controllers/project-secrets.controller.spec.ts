import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import {
	projectSecretNameSchema,
	setProjectSecretRequestSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { ProjectSecretsController } from "./project-secrets.controller";

const LIST = { secrets: [] };

function setup() {
	const secrets = {
		listNames: vi.fn(async () => LIST),
		remove: vi.fn(async () => undefined),
		set: vi.fn(async () => undefined),
	};
	const controller = new ProjectSecretsController(secrets);

	return { controller, secrets };
}

// SAFETY: the controller reads only `user.id` for the scope derivation.
const user = { id: "user_1" } as AuthUser;
const workspace: WorkspaceContext = { kind: "personal" };
// The controller hands the request to `readClientIp`, which reads only
// the forwarded-for header and `ip`; the cast fills the unused fields.
const request = Object.assign(Object.create(null), {
	headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
	ip: "10.0.0.2",
	// SAFETY: `Object.create` yields any; the two fields above are all the route reads.
}) as FastifyRequest;

describe("ProjectSecretsController", () => {
	it("list delegates with the scope and the project id", async () => {
		const { controller, secrets } = setup();

		const result = await controller.list("project-1", user, workspace);

		expect(secrets.listNames).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
		);
		expect(result).toEqual(LIST);
	});

	it("set delegates the value as a user write with the client ip", async () => {
		const { controller, secrets } = setup();

		await controller.set(
			"project-1",
			"STRIPE_SECRET_KEY",
			{ value: "sk_live_1" },
			user,
			workspace,
			request,
		);

		expect(secrets.set).toHaveBeenCalledWith(
			"project-1",
			"STRIPE_SECRET_KEY",
			"sk_live_1",
			"user",
			{ ip: "203.0.113.9", scope: { kind: "personal", userId: "user_1" } },
		);
	});

	it("remove delegates with the client ip", async () => {
		const { controller, secrets } = setup();

		await controller.remove(
			"project-1",
			"STRIPE_SECRET_KEY",
			user,
			workspace,
			request,
		);

		expect(secrets.remove).toHaveBeenCalledWith(
			"project-1",
			"STRIPE_SECRET_KEY",
			{ ip: "203.0.113.9", scope: { kind: "personal", userId: "user_1" } },
		);
	});
});

describe("ProjectSecretsController route metadata", () => {
	it("applies V2BuilderEnabledGuard to the controller", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, ProjectSecretsController),
		).toEqual([V2BuilderEnabledGuard]);
	});

	it("gates the three routes on project:update", () => {
		for (const handler of [
			ProjectSecretsController.prototype.list,
			ProjectSecretsController.prototype.set,
			ProjectSecretsController.prototype.remove,
		]) {
			expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, handler)).toEqual({
				actions: ["update"],
				resource: "project",
			});
		}
	});

	it("answers 204 on set and remove: no body, so no value", () => {
		for (const handler of [
			ProjectSecretsController.prototype.set,
			ProjectSecretsController.prototype.remove,
		]) {
			expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
		}
	});

	it("rejects a lowercase name and a value over 8 KB in the pipes", () => {
		expect(() =>
			new ZodValidationPipe(projectSecretNameSchema).transform("stripe_key", {
				data: "name",
				type: "param",
			}),
		).toThrow(BadRequestException);
		expect(() =>
			new ZodValidationPipe(setProjectSecretRequestSchema).transform(
				{ value: "x".repeat(8 * 1024 + 1) },
				{ type: "body" },
			),
		).toThrow(BadRequestException);
		expect(
			new ZodValidationPipe(setProjectSecretRequestSchema).transform(
				{ value: "x".repeat(8 * 1024) },
				{ type: "body" },
			),
		).toEqual({ value: "x".repeat(8 * 1024) });
	});
});
