import { BadRequestException } from "@nestjs/common";
import {
	GUARDS_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import type {
	ListAffiliatePortalCommissionsQuery,
	ListAffiliatePortalPayoutsQuery,
	ListAffiliatePortalReferralsQuery,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import type { AffiliatePortalService } from "../../../application/services/affiliate-portal.service";
import { AffiliatePortalController } from "./affiliate-portal.controller";

type QueryMethod = "commissions" | "payouts" | "referrals";

function setup() {
	const service = {
		listCommissions: vi.fn(),
		listPayouts: vi.fn(),
		listReferrals: vi.fn(),
		me: vi.fn(),
		overview: vi.fn(),
	};
	const controller = new AffiliatePortalController(
		service as unknown as AffiliatePortalService,
	);

	return { controller, service };
}

function queryPipe<T>(method: QueryMethod): ZodValidationPipe<T> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		AffiliatePortalController,
		method,
	) as Record<string, { pipes?: unknown[] }>;
	const pipe = Object.values(routeArguments)
		.flatMap((argument) => argument.pipes ?? [])
		.find((candidate) => candidate instanceof ZodValidationPipe);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error(`${method} is missing its Zod query validation pipe`);
	}

	return pipe as ZodValidationPipe<T>;
}

describe("AffiliatePortalController", () => {
	it("uses the global authenticated-user surface without public or admin metadata", () => {
		expect(Reflect.getMetadata(PATH_METADATA, AffiliatePortalController)).toBe(
			"v1/affiliates/me",
		);
		expect(
			Reflect.getMetadata(GUARDS_METADATA, AffiliatePortalController),
		).toBeUndefined();
		expect(
			Reflect.getMetadata(IS_PUBLIC_KEY, AffiliatePortalController),
		).toBeUndefined();

		for (const method of [
			"me",
			"overview",
			"referrals",
			"commissions",
			"payouts",
		] as const) {
			expect(
				Reflect.getMetadata(
					GUARDS_METADATA,
					AffiliatePortalController.prototype[method],
				),
			).toBeUndefined();
			expect(
				Reflect.getMetadata(
					IS_PUBLIC_KEY,
					AffiliatePortalController.prototype[method],
				),
			).toBeUndefined();
		}
	});

	it("delegates profile and overview reads with the session user id", async () => {
		const { controller, service } = setup();
		const user = { id: "user_1" } as AuthUser;

		await controller.me(user);
		await controller.overview(user);

		expect(service.me).toHaveBeenCalledWith("user_1");
		expect(service.overview).toHaveBeenCalledWith("user_1");
	});

	it("validates and delegates referral queries with the session user id", async () => {
		const { controller, service } = setup();
		const user = { id: "user_1" } as AuthUser;
		const query = queryPipe<ListAffiliatePortalReferralsQuery>(
			"referrals",
		).transform(
			{ page: "2", pageSize: "10", status: "active" },
			{ type: "query" },
		);

		await controller.referrals(user, query);

		expect(query).toEqual({ page: 2, pageSize: 10, status: "active" });
		expect(service.listReferrals).toHaveBeenCalledWith("user_1", query);
	});

	it("validates and delegates commission queries with the session user id", async () => {
		const { controller, service } = setup();
		const user = { id: "user_1" } as AuthUser;
		const query = queryPipe<ListAffiliatePortalCommissionsQuery>(
			"commissions",
		).transform(
			{
				currency: "usd",
				entryType: "earning",
				page: "3",
				pageSize: "15",
				status: "approved",
			},
			{ type: "query" },
		);

		await controller.commissions(user, query);

		expect(query).toEqual({
			currency: "usd",
			entryType: "earning",
			page: 3,
			pageSize: 15,
			status: "approved",
		});
		expect(service.listCommissions).toHaveBeenCalledWith("user_1", query);
	});

	it("validates and delegates payout queries with the session user id", async () => {
		const { controller, service } = setup();
		const user = { id: "user_1" } as AuthUser;
		const query = queryPipe<ListAffiliatePortalPayoutsQuery>(
			"payouts",
		).transform(
			{ page: "4", pageSize: "25", status: "paid" },
			{ type: "query" },
		);

		await controller.payouts(user, query);

		expect(query).toEqual({ page: 4, pageSize: 25, status: "paid" });
		expect(service.listPayouts).toHaveBeenCalledWith("user_1", query);
	});

	it.each([
		"referrals",
		"commissions",
		"payouts",
	] as const)("rejects unknown query keys for %s", (method) => {
		expect(() =>
			queryPipe(method).transform({ unexpected: "value" }, { type: "query" }),
		).toThrow(BadRequestException);
	});
});
