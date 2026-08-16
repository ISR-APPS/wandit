import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import {
	SubscriptionsEnabledGuard,
	TopupsEnabledGuard,
} from "../../../../settings";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import type { BillingService } from "../../../application/services/billing.service";
import { BillingController } from "./billing.controller";

function guardsFor(
	method: "change" | "checkout" | "previewChange" | "resume" | "topup",
): unknown[] {
	return (
		Reflect.getMetadata(GUARDS_METADATA, BillingController.prototype[method]) ??
		[]
	);
}

function setup() {
	const service = { cancel: vi.fn(async () => ({})) };
	const controller = new BillingController(
		service as unknown as BillingService,
	);

	return { controller, service };
}

function cancelBodyPipe(): ZodValidationPipe<unknown> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		BillingController,
		"cancel",
	) as Record<string, { index: number; pipes: unknown[] }>;
	const bodyArgument = Object.values(routeArguments).find(
		(argument) => argument.index === 2,
	);
	const pipe = bodyArgument?.pipes.find(
		(candidate) => candidate instanceof ZodValidationPipe,
	);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error("Billing cancel body does not have a ZodValidationPipe");
	}

	return pipe;
}

describe("BillingController admission guards", () => {
	it.each([
		"checkout",
		"previewChange",
		"change",
		"resume",
	] as const)("gates %s behind the subscriptions switch", (method) => {
		expect(guardsFor(method)).toEqual([SubscriptionsEnabledGuard]);
	});

	it("gates top-ups behind the top-ups switch", () => {
		expect(guardsFor("topup")).toEqual([TopupsEnabledGuard]);
	});

	it("validates the required cancellation survey body", () => {
		const pipe = cancelBodyPipe();

		expect(
			pipe.transform(
				{ details: "  Another reason  ", reason: "other" },
				{ type: "body" },
			),
		).toEqual({ details: "Another reason", reason: "other" });
		expect(() => pipe.transform({ reason: "other" }, { type: "body" })).toThrow(
			BadRequestException,
		);
	});

	it("delegates cancellation with the validated body and workspace", async () => {
		const { controller, service } = setup();
		const user = { id: "user_1" } as AuthUser;
		const workspace = { kind: "personal" } satisfies WorkspaceContext;
		const body = { reason: "too_expensive" } as const;

		await controller.cancel(user, workspace, body);

		expect(service.cancel).toHaveBeenCalledWith(user, body, workspace);
	});
});
