import { BadRequestException, RequestMethod } from "@nestjs/common";
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { ADMIN_PERMISSION_KEY } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import type { StoryLinkAdminService } from "../../../application/services/story-link-admin.service";
import { StoryLinkAdminController } from "./story-link-admin.controller";

function setup() {
	const service = {
		create: vi.fn(),
		list: vi.fn(),
		signups: vi.fn(),
		stats: vi.fn(),
		update: vi.fn(),
	};
	const controller = new StoryLinkAdminController(
		service as unknown as StoryLinkAdminService,
	);

	return { controller, service };
}

function routePipe(
	handlerName: "signups" | "stats",
	parameterIndex: number,
): ZodValidationPipe<unknown> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		StoryLinkAdminController,
		handlerName,
	) as Record<string, { index: number; pipes?: unknown[] }>;
	const argument = Object.values(routeArguments).find(
		(candidate) => candidate.index === parameterIndex,
	);
	const pipe = argument?.pipes?.find(
		(candidate) => candidate instanceof ZodValidationPipe,
	);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error(
			`${handlerName}[${parameterIndex}] is missing ZodValidationPipe`,
		);
	}

	return pipe;
}

describe("StoryLinkAdminController", () => {
	it("requires admin-session authentication and authorization", () => {
		expect(
			Reflect.getMetadata(AUTH_SURFACE_KEY, StoryLinkAdminController),
		).toBe(ADMIN_AUTH_SURFACE);
		expect(
			Reflect.getMetadata(GUARDS_METADATA, StoryLinkAdminController),
		).toEqual([AdminGuard]);
		expect(
			Reflect.getMetadata(ADMIN_PERMISSION_KEY, StoryLinkAdminController),
		).toEqual({ links: ["read"] });
	});

	it("exposes and validates the per-link stats route", () => {
		const handler = StoryLinkAdminController.prototype.stats;

		expect(Reflect.getMetadata(PATH_METADATA, StoryLinkAdminController)).toBe(
			"v1/admin/story-links",
		);
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
			RequestMethod.GET,
		);
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
			":storyLinkId/stats",
		);
		// Revenue figures ride in the stats payload: the route must demand
		// analytics:read on top of links:read (support holds links:read only).
		expect(Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler)).toEqual({
			analytics: ["read"],
			links: ["read"],
		});
		expect(() =>
			routePipe("stats", 0).transform("not-a-uuid", {
				data: "storyLinkId",
				type: "param",
			}),
		).toThrow(BadRequestException);
		expect(() =>
			routePipe("stats", 1).transform({ range: "custom" }, { type: "query" }),
		).toThrow(BadRequestException);
	});

	it("exposes and validates the paginated per-link signups route", () => {
		const handler = StoryLinkAdminController.prototype.signups;

		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
			RequestMethod.GET,
		);
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
			":storyLinkId/signups",
		);
		expect(Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler)).toEqual({
			analytics: ["read"],
			links: ["read"],
		});
		expect(() =>
			routePipe("signups", 0).transform("not-a-uuid", {
				data: "storyLinkId",
				type: "param",
			}),
		).toThrow(BadRequestException);
		expect(() =>
			routePipe("signups", 1).transform(
				{ page: "2", pageSize: "101" },
				{ type: "query" },
			),
		).toThrow(BadRequestException);
		expect(routePipe("signups", 1).transform({}, { type: "query" })).toEqual({
			page: 1,
			pageSize: 10,
			range: "30d",
		});
	});

	it("delegates list, stats, signups, create, and update requests", async () => {
		const { controller, service } = setup();
		const query = { range: "30d" } as const;
		const signupsQuery = { page: 2, pageSize: 10, range: "30d" } as const;
		const createInput = {
			name: "Summer story",
			slug: "summer-story",
			utmCampaign: "summer-story",
			utmMedium: "story",
			utmSource: "instagram",
		};
		const updateInput = { archived: true, name: "Archived summer story" };

		await controller.list(query);
		await controller.stats("22222222-2222-4222-8222-222222222222", query);
		await controller.signups(
			"22222222-2222-4222-8222-222222222222",
			signupsQuery,
		);
		await controller.create(createInput);
		await controller.update(
			"22222222-2222-4222-8222-222222222222",
			updateInput,
		);

		expect(service.list).toHaveBeenCalledWith(query);
		expect(service.stats).toHaveBeenCalledWith(
			"22222222-2222-4222-8222-222222222222",
			query,
		);
		expect(service.signups).toHaveBeenCalledWith(
			"22222222-2222-4222-8222-222222222222",
			signupsQuery,
		);
		expect(service.create).toHaveBeenCalledWith(createInput);
		expect(service.update).toHaveBeenCalledWith(
			"22222222-2222-4222-8222-222222222222",
			updateInput,
		);
	});
});
