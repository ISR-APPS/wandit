import { BadRequestException, HttpStatus } from "@nestjs/common";
import {
	HTTP_CODE_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import {
	type CreateProductEventRequest,
	createProductEventRequestSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import type { ProductEventsService } from "../../../application/services/product-events.service";
import { ProductEventsController } from "./product-events.controller";

const INPUT = {
	idempotencyKey: "11111111-1111-4111-8111-111111111111",
	kind: "upgrade_clicked",
	properties: { method: "card" },
	surface: "workspace_header",
} satisfies CreateProductEventRequest;

function setup() {
	const service = {
		create: vi.fn(async () => undefined),
	};
	const controller = new ProductEventsController(
		service as unknown as ProductEventsService,
	);

	return { controller, service };
}

function bodyPipe(): ZodValidationPipe<CreateProductEventRequest> {
	const metadata = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		ProductEventsController,
		"create",
	) as Record<string, { pipes?: unknown[] }>;
	const pipe = Object.values(metadata)
		.flatMap((argument) => argument.pipes ?? [])
		.find((candidate) => candidate instanceof ZodValidationPipe);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error("Product event body is missing its Zod validation pipe");
	}

	return pipe as ZodValidationPipe<CreateProductEventRequest>;
}

describe("ProductEventsController", () => {
	it("is authenticated by default and responds with no content", () => {
		expect(Reflect.getMetadata(PATH_METADATA, ProductEventsController)).toBe(
			"v1/product-events",
		);
		expect(Reflect.getMetadata(IS_PUBLIC_KEY, ProductEventsController)).toBe(
			undefined,
		);
		expect(
			Reflect.getMetadata(
				HTTP_CODE_METADATA,
				ProductEventsController.prototype.create,
			),
		).toBe(HttpStatus.NO_CONTENT);
	});

	it("delegates the event with the acting user's id", async () => {
		const { controller, service } = setup();

		await expect(
			controller.create({ id: "user_1" } as never, INPUT),
		).resolves.toBeUndefined();

		expect(service.create).toHaveBeenCalledWith("user_1", INPUT);
	});

	it("attaches the shared request schema through ZodValidationPipe", () => {
		const pipe = bodyPipe();

		expect(pipe.transform(INPUT, { type: "body" })).toEqual(INPUT);
		expect(
			pipe.transform(
				{
					idempotencyKey: "22222222-2222-4222-8222-222222222222",
					kind: "pricing_viewed",
					surface: "marketing_pricing",
				},
				{ type: "body" },
			),
		).toEqual({
			idempotencyKey: "22222222-2222-4222-8222-222222222222",
			kind: "pricing_viewed",
			surface: "marketing_pricing",
		});
		expect(() =>
			pipe.transform(
				{
					idempotencyKey: "33333333-3333-4333-8333-333333333333",
					kind: "upgrade_clicked",
					surface: "sidebar",
				},
				{ type: "body" },
			),
		).toThrow(BadRequestException);
		expect(() =>
			pipe.transform(
				{
					idempotencyKey: "not-a-uuid",
					kind: "upgrade_clicked",
					surface: "invented_surface",
				},
				{ type: "body" },
			),
		).toThrow(BadRequestException);
		expect(createProductEventRequestSchema.parse(INPUT)).toEqual(INPUT);
	});
});
