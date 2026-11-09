import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import {
	projectSecretNameSchema,
	setProjectSecretRequestSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { PROJECT_ROLE_KEY } from "../../../../projects";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { ProjectSecretsController } from "./project-secrets.controller";

describe("ProjectSecretsController route metadata", () => {
	it("applies V2BuilderEnabledGuard to the controller", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, ProjectSecretsController),
		).toEqual([V2BuilderEnabledGuard]);
	});

	it("needs the editor role on the three routes", () => {
		for (const handler of [
			ProjectSecretsController.prototype.list,
			ProjectSecretsController.prototype.set,
			ProjectSecretsController.prototype.remove,
		]) {
			expect(Reflect.getMetadata(PROJECT_ROLE_KEY, handler)).toEqual({
				anyEngine: false,
				role: "editor",
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
