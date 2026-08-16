import { Logger } from "@nestjs/common";
import { creditsRoutes, leadsRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	USER_ACTIVITY_POLLING_DENYLIST,
	UserActivityService,
} from "./user-activity.service";

type ActivityRequest = Parameters<UserActivityService["record"]>[1];

const ACTIVITY_TIME = new Date("2026-08-15T12:00:00.000Z");

function activityRequest(
	method: string,
	routeUrl: string,
	url = routeUrl,
): ActivityRequest {
	return {
		method,
		routeOptions: { url: routeUrl },
		url,
	} as ActivityRequest;
}

function setup() {
	const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	const service = new UserActivityService({ insert } as unknown as Database);

	return { insert, onConflictDoNothing, service, values };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("UserActivityService", () => {
	it("deduplicates concurrent stamps for the same user and UTC day", async () => {
		const { onConflictDoNothing, service, values } = setup();
		let resolveInsert: (() => void) | undefined;
		const pendingInsert = new Promise<void>((resolve) => {
			resolveInsert = resolve;
		});
		onConflictDoNothing.mockReturnValue(pendingInsert);
		const request = activityRequest("POST", "/api/v1/projects");

		service.record("user_1", request, ACTIVITY_TIME);
		service.record("user_1", request, ACTIVITY_TIME);
		service.record("user_1", request, ACTIVITY_TIME);

		expect(values).toHaveBeenCalledOnce();
		expect(values).toHaveBeenCalledWith({
			activityDate: "2026-08-15",
			userId: "user_1",
		});
		resolveInsert?.();
		await pendingInsert;
	});

	it("allows the same user to be stamped again after UTC midnight", () => {
		const { service, values } = setup();
		const request = activityRequest("POST", "/api/v1/projects");

		service.record("user_1", request, new Date("2026-08-15T23:59:59.999Z"));
		service.record("user_1", request, new Date("2026-08-16T00:00:00.000Z"));

		expect(values).toHaveBeenNthCalledWith(1, {
			activityDate: "2026-08-15",
			userId: "user_1",
		});
		expect(values).toHaveBeenNthCalledWith(2, {
			activityDate: "2026-08-16",
			userId: "user_1",
		});
	});

	it("exports the exact three unconditional GET polling routes", () => {
		expect(USER_ACTIVITY_POLLING_DENYLIST).toEqual([
			{ method: "GET", routePath: creditsRoutes.balance },
			{ method: "GET", routePath: leadsRoutes.listForWorkspace },
			{
				method: "GET",
				routePath: leadsRoutes.listByProject(":projectId"),
			},
		]);
	});

	it.each([
		[
			"credit balance",
			creditsRoutes.balance,
			`${creditsRoutes.balance}?refresh=1`,
		],
		[
			"workspace leads",
			leadsRoutes.listForWorkspace,
			`${leadsRoutes.listForWorkspace}?cursor=next`,
		],
		[
			"project leads",
			leadsRoutes.listByProject(":projectId"),
			`${leadsRoutes.listByProject("project_1")}?cursor=next`,
		],
	])("skips the %s GET poll by registered route or URL fallback", (_name, routePath, requestUrl) => {
		const registeredMatch = setup();
		const fallbackMatch = setup();

		registeredMatch.service.record(
			"user_1",
			activityRequest("GET", routePath, "/api/v1/not-a-poller"),
			ACTIVITY_TIME,
		);
		fallbackMatch.service.record(
			"user_1",
			activityRequest("GET", "/api/v1/not-a-poller", requestUrl),
			ACTIVITY_TIME,
		);

		expect(registeredMatch.insert).not.toHaveBeenCalled();
		expect(fallbackMatch.insert).not.toHaveBeenCalled();
	});

	it.each([
		["GET", "/api/v1/credits/balances"],
		["GET", "/api/v1/leads/export"],
		["GET", "/api/v1/projects/project_1/leads/export"],
		["POST", creditsRoutes.balance],
		["POST", leadsRoutes.listForWorkspace],
		["POST", leadsRoutes.listByProject("project_1")],
	])("stamps adjacent and non-GET requests: %s %s", (method, url) => {
		const { insert, service } = setup();

		service.record("user_1", activityRequest(method, url), ACTIVITY_TIME);

		expect(insert).toHaveBeenCalledOnce();
	});

	it("swallows and logs a database failure, then retries the stamp", async () => {
		const { onConflictDoNothing, service } = setup();
		const failure = new Error("database unavailable");
		onConflictDoNothing
			.mockRejectedValueOnce(failure)
			.mockResolvedValueOnce(undefined);
		const warning = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const request = activityRequest("POST", "/api/v1/projects");

		expect(() =>
			service.record("user_1", request, ACTIVITY_TIME),
		).not.toThrow();
		await vi.waitFor(() => {
			expect(warning).toHaveBeenCalledWith(
				"Failed to stamp activity for user user_1 on 2026-08-15",
				failure,
			);
		});

		service.record("user_1", request, ACTIVITY_TIME);

		expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
	});
});
