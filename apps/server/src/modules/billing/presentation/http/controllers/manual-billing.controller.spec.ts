import { BadRequestException, RequestMethod } from "@nestjs/common";
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { ManualPaymentsEnabledGuard } from "../../../../settings";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { WebOriginWriteGuard } from "../guards/web-origin-write.guard";
import { ManualBillingController } from "./manual-billing.controller";

const body = {
	amountUsd: 25,
	city: " Algiers ",
	company: " Example SARL ",
	country: "DZ",
	fullName: " Amina Example ",
	notes: " Call after 4 PM ",
	phone: "+213 661 22 33 44",
	preferredPaymentMethod: "ccp",
} as const;

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
			amountUsd: 25,
			city: "Algiers",
			company: "Example SARL",
			country: "DZ",
			fullName: "Amina Example",
			notes: "Call after 4 PM",
			phone: "+213 661 22 33 44",
			preferredPaymentMethod: "ccp",
		});
	});

	// A cached web bundle still sends a plan body. It must fail, never create a request with no amount.
	it.each([
		["a bad phone", { ...body, phone: "bad" }],
		[
			"a plan body",
			{
				...body,
				amountUsd: undefined,
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			},
		],
	])("answers 400 for %s", (_label, input) => {
		expect(() => bodyPipe().transform(input, { type: "body" })).toThrow(
			BadRequestException,
		);
	});
});
