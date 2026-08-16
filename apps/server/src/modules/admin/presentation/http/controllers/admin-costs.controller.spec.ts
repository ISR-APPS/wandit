import { BadRequestException, HttpStatus } from "@nestjs/common";
import {
	GUARDS_METADATA,
	HTTP_CODE_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { AdminCostsService } from "../../../application/services/admin-costs.service";
import { AdminGuard } from "../guards/admin.guard";
import { AdminCostsController } from "./admin-costs.controller";

function setup() {
	const service = {
		list: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
	const controller = new AdminCostsController(
		service as unknown as AdminCostsService,
	);

	return { controller, service };
}

function routePipe(
	method: "create" | "delete" | "list" | "update",
	parameterIndex: number,
): ZodValidationPipe<unknown> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		AdminCostsController,
		method,
	) as Record<string, { index: number; pipes?: unknown[] }>;
	const argument = Object.values(routeArguments).find(
		(candidate) => candidate.index === parameterIndex,
	);
	const pipe = argument?.pipes?.find(
		(candidate) => candidate instanceof ZodValidationPipe,
	);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error(
			`${method}[${parameterIndex}] is missing ZodValidationPipe`,
		);
	}

	return pipe;
}

describe("AdminCostsController", () => {
	it("protects every costs route with AdminGuard", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, AdminCostsController)).toEqual([
			AdminGuard,
		]);
	});

	it("delegates list/create/update/delete with the acting admin", async () => {
		const { controller, service } = setup();
		const admin = { id: "admin-1" } as AuthUser;
		const createBody = {
			month: "2026-08" as const,
			currency: "usd",
			adSpendBySourceCents: {},
			infrastructureCostCents: 0,
			otherCostCents: 0,
			notes: null,
		};

		await controller.list({});
		await controller.create(createBody, admin);
		await controller.update("2026-08", { version: 1, notes: "note" }, admin);
		await controller.delete("2026-08");

		expect(service.list).toHaveBeenCalledWith({});
		expect(service.create).toHaveBeenCalledWith("admin-1", createBody);
		expect(service.update).toHaveBeenCalledWith("admin-1", "2026-08", {
			version: 1,
			notes: "note",
		});
		expect(service.delete).toHaveBeenCalledWith("2026-08");
	});

	it("attaches every shared request schema and returns 204 on delete", () => {
		expect(Reflect.getMetadata(PATH_METADATA, AdminCostsController)).toBe(
			"v1/admin/costs",
		);
		expect(() =>
			routePipe("list", 0).transform(
				{ fromMonth: "2026-13" },
				{ type: "query" },
			),
		).toThrow(BadRequestException);
		expect(() =>
			routePipe("create", 0).transform(
				{
					month: "2026-08",
					currency: "usd",
					adSpendBySourceCents: { meta: -1 },
					infrastructureCostCents: 0,
					otherCostCents: 0,
					notes: null,
				},
				{ type: "body" },
			),
		).toThrow(BadRequestException);
		expect(() =>
			routePipe("update", 1).transform({ version: 1 }, { type: "body" }),
		).toThrow(BadRequestException);
		for (const method of ["update", "delete"] as const) {
			expect(() =>
				routePipe(method, 0).transform("2026-13", { type: "param" }),
			).toThrow(BadRequestException);
		}
		expect(
			Reflect.getMetadata(
				HTTP_CODE_METADATA,
				AdminCostsController.prototype.delete,
			),
		).toBe(HttpStatus.NO_CONTENT);
	});
});
