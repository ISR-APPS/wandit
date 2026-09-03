import { BadRequestException, RequestMethod } from "@nestjs/common";
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import type {
	AdminListFeedbackQuery,
	AdminUpdateFeedbackInput,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { ADMIN_PERMISSION_KEY } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import type { FeedbackAdminService } from "../../../application/services/feedback-admin.service";
import { FeedbackAdminController } from "./feedback-admin.controller";

const FEEDBACK_ID = "11111111-1111-4111-8111-111111111111";

type ValidatedMethod = "detail" | "list" | "remove" | "update";

function setup() {
	const service = {
		get: vi.fn(),
		list: vi.fn(),
		remove: vi.fn(),
		stats: vi.fn(),
		update: vi.fn(),
	};
	const controller = new FeedbackAdminController(
		service as unknown as FeedbackAdminService,
	);

	return { controller, service };
}

function routePipe(
	method: ValidatedMethod,
	parameterIndex: number,
): ZodValidationPipe<unknown> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		FeedbackAdminController,
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

describe("FeedbackAdminController", () => {
	it("protects every route with the admin auth surface, guard, and read permission", () => {
		expect(Reflect.getMetadata(AUTH_SURFACE_KEY, FeedbackAdminController)).toBe(
			ADMIN_AUTH_SURFACE,
		);
		expect(
			Reflect.getMetadata(GUARDS_METADATA, FeedbackAdminController),
		).toEqual([AdminGuard]);
		expect(
			Reflect.getMetadata(ADMIN_PERMISSION_KEY, FeedbackAdminController),
		).toEqual({ feedback: ["read"] });
	});

	it("requires manage permission for updates", () => {
		expect(
			Reflect.getMetadata(
				ADMIN_PERMISSION_KEY,
				FeedbackAdminController.prototype.update,
			),
		).toEqual({ feedback: ["manage"] });
	});

	it("exposes feedback deletion with the manage permission", () => {
		const handler = FeedbackAdminController.prototype.remove;

		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
			RequestMethod.DELETE,
		);
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(":feedbackId");
		expect(Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler)).toEqual({
			feedback: ["manage"],
		});
	});

	it("declares the static stats route before the feedback id route", () => {
		expect(Reflect.getMetadata(PATH_METADATA, FeedbackAdminController)).toBe(
			"v1/admin/feedback",
		);
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				FeedbackAdminController.prototype.stats,
			),
		).toBe("stats");
		expect(
			Object.getOwnPropertyNames(FeedbackAdminController.prototype).indexOf(
				"stats",
			),
		).toBeLessThan(
			Object.getOwnPropertyNames(FeedbackAdminController.prototype).indexOf(
				"detail",
			),
		);
	});

	it("delegates list, stats, detail, update, and delete with the acting admin", async () => {
		const { controller, service } = setup();
		const query = {
			page: 2,
			pageSize: 10,
			sort: "priority",
			status: ["new", "reviewing"],
		} satisfies AdminListFeedbackQuery;
		const patch = {
			status: "planned",
			priority: "high",
		} satisfies AdminUpdateFeedbackInput;
		const admin = { id: "admin-1" } as AuthUser;

		await controller.list(query);
		await controller.stats();
		await controller.detail(FEEDBACK_ID);
		await controller.update(FEEDBACK_ID, patch, admin);
		await controller.remove(FEEDBACK_ID, admin);

		expect(service.list).toHaveBeenCalledWith(query);
		expect(service.stats).toHaveBeenCalledOnce();
		expect(service.get).toHaveBeenCalledWith(FEEDBACK_ID);
		expect(service.update).toHaveBeenCalledWith(FEEDBACK_ID, patch, "admin-1");
		expect(service.remove).toHaveBeenCalledWith(FEEDBACK_ID, "admin-1");
	});

	it("validates every query, id, and update body parameter", () => {
		expect(
			routePipe("list", 0).transform(
				{ page: "2", pageSize: "10", sort: "oldest" },
				{ type: "query" },
			),
		).toEqual({ page: 2, pageSize: 10, sort: "oldest" });
		expect(() =>
			routePipe("list", 0).transform({ page: "0" }, { type: "query" }),
		).toThrow(BadRequestException);

		for (const method of ["detail", "remove", "update"] as const) {
			expect(
				routePipe(method, 0).transform(FEEDBACK_ID, {
					type: "param",
				}),
			).toBe(FEEDBACK_ID);
			expect(() =>
				routePipe(method, 0).transform("not-a-uuid", { type: "param" }),
			).toThrow(BadRequestException);
		}

		expect(
			routePipe("update", 1).transform(
				{ adminNote: "  Follow up  " },
				{ type: "body" },
			),
		).toEqual({ adminNote: "Follow up" });
		expect(() =>
			routePipe("update", 1).transform({}, { type: "body" }),
		).toThrow(BadRequestException);
	});
});
