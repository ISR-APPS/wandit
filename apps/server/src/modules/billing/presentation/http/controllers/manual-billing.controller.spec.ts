import { BadRequestException, RequestMethod } from "@nestjs/common";
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import type { CreateManualSubscriptionRequestBody } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { ManualPaymentsEnabledGuard } from "../../../../settings";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { ManualSubscriptionRequestsService } from "../../../application/services/manual-subscription-requests.service";
import { WebOriginWriteGuard } from "../guards/web-origin-write.guard";
import { ManualBillingController } from "./manual-billing.controller";

const user = { id: "user_1" } as AuthUser;
const workspace = { kind: "personal" } satisfies WorkspaceContext;
const body = {
	city: " Algiers ",
	company: " Example SARL ",
	country: "DZ",
	fullName: " Amina Example ",
	interval: "month",
	notes: " Call after 4 PM ",
	phone: "+213 661 22 33 44",
	plan: "pro",
	preferredPaymentMethod: "ccp",
	tierCredits: 500,
} as const;

function setup() {
	const service = {
		cancel: vi.fn(async () => ({ request: null })),
		create: vi.fn(async () => ({ request: null })),
		getCurrent: vi.fn(async () => ({ request: null })),
	};
	const controller = new ManualBillingController(
		service as unknown as ManualSubscriptionRequestsService,
	);

	return { controller, service };
}

function bodyPipe(): ZodValidationPipe<unknown> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		ManualBillingController,
		"create",
	) as Record<string, { index: number; pipes: unknown[] }>;
	const bodyArgument = Object.values(routeArguments).find(
		(argument) => argument.index === 2,
	);
	const pipe = bodyArgument?.pipes.find(
		(candidate) => candidate instanceof ZodValidationPipe,
	);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error("Manual request body does not have a ZodValidationPipe");
	}

	return pipe;
}

describe("ManualBillingController", () => {
	it("exposes the manual request route table", () => {
		expect(Reflect.getMetadata(PATH_METADATA, ManualBillingController)).toBe(
			"v1/billing",
		);
		expect(
			[
				ManualBillingController.prototype.getCurrent,
				ManualBillingController.prototype.create,
				ManualBillingController.prototype.cancel,
			].map((handler) => ({
				method: Reflect.getMetadata(METHOD_METADATA, handler),
				path: Reflect.getMetadata(PATH_METADATA, handler),
			})),
		).toEqual([
			{ method: RequestMethod.GET, path: "manual-request" },
			{ method: RequestMethod.POST, path: "manual-request" },
			{ method: RequestMethod.POST, path: "manual-request/cancel" },
		]);
	});

	it("guards create with the switch and both writes with billing:manage", () => {
		expect(
			Reflect.getMetadata(
				GUARDS_METADATA,
				ManualBillingController.prototype.create,
			),
		).toEqual([WebOriginWriteGuard, ManualPaymentsEnabledGuard]);
		expect(
			Reflect.getMetadata(
				GUARDS_METADATA,
				ManualBillingController.prototype.cancel,
			),
		).toEqual([WebOriginWriteGuard]);
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				ManualBillingController.prototype.create,
			),
		).toEqual({ actions: ["manage"], resource: "billing" });
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				ManualBillingController.prototype.cancel,
			),
		).toEqual({ actions: ["manage"], resource: "billing" });
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				ManualBillingController.prototype.getCurrent,
			),
		).toBeUndefined();
	});

	it("validates and normalizes the create body", () => {
		const pipe = bodyPipe();

		expect(pipe.transform(body, { type: "body" })).toEqual({
			city: "Algiers",
			company: "Example SARL",
			country: "DZ",
			fullName: "Amina Example",
			interval: "month",
			notes: "Call after 4 PM",
			phone: "+213 661 22 33 44",
			plan: "pro",
			preferredPaymentMethod: "ccp",
			tierCredits: 500,
		});
		expect(() =>
			pipe.transform({ ...body, phone: "bad" }, { type: "body" }),
		).toThrow(BadRequestException);
	});

	it("delegates reads and writes with the active workspace", async () => {
		const { controller, service } = setup();
		const validated = bodyPipe().transform(body, {
			type: "body",
		}) as CreateManualSubscriptionRequestBody;

		await controller.getCurrent(user, workspace);
		await controller.create(user, workspace, validated);
		await controller.cancel(user, workspace);

		expect(service.getCurrent).toHaveBeenCalledWith(user, workspace);
		expect(service.create).toHaveBeenCalledWith(user, validated, workspace);
		expect(service.cancel).toHaveBeenCalledWith(user, workspace);
	});
});
