import { Inject, Injectable, Logger } from "@nestjs/common";
import { creditsRoutes, leadsRoutes } from "@wandit/contracts";
import { userActivityDays } from "@wandit/db/schema/user-activity";
import type { FastifyRequest } from "fastify";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/**
 * Authenticated GET routes that poll without a user action.
 * These requests do not count as daily activity.
 */
export const USER_ACTIVITY_POLLING_DENYLIST = [
	{ method: "GET", routePath: creditsRoutes.balance },
	{ method: "GET", routePath: leadsRoutes.listForWorkspace },
	{
		method: "GET",
		routePath: leadsRoutes.listByProject(":projectId"),
	},
] as const;

type ActivityRequest = Pick<FastifyRequest, "method" | "routeOptions" | "url">;

@Injectable()
export class UserActivityService {
	private readonly logger = new Logger(UserActivityService.name);
	private cachedActivityDate: string | null = null;
	private readonly cachedUserIds = new Set<string>();

	constructor(@Inject(DATABASE) private readonly db: Database) {}

	record(userId: string, request: ActivityRequest, now = new Date()): void {
		if (isPollingRequest(request)) {
			return;
		}

		const activityDate = now.toISOString().slice(0, 10);

		if (this.cachedActivityDate !== activityDate) {
			this.cachedActivityDate = activityDate;
			this.cachedUserIds.clear();
		}

		if (this.cachedUserIds.has(userId)) {
			return;
		}

		this.cachedUserIds.add(userId);
		void this.persist(userId, activityDate);
	}

	private async persist(userId: string, activityDate: string): Promise<void> {
		try {
			await this.db
				.insert(userActivityDays)
				.values({ activityDate, userId })
				.onConflictDoNothing({
					target: [userActivityDays.userId, userActivityDays.activityDate],
				});
		} catch (error) {
			if (this.cachedActivityDate === activityDate) {
				this.cachedUserIds.delete(userId);
			}

			this.logger.warn(
				`Failed to stamp activity for user ${userId} on ${activityDate}`,
				error,
			);
		}
	}
}

function isPollingRequest(request: ActivityRequest): boolean {
	if (request.method.toUpperCase() !== "GET") {
		return false;
	}

	const registeredPath = normalizeApiPath(request.routeOptions.url ?? "");
	const requestPath = registeredPathFromUrl(normalizeApiPath(request.url));

	return USER_ACTIVITY_POLLING_DENYLIST.some(
		(entry) =>
			entry.method === "GET" &&
			(entry.routePath === registeredPath || entry.routePath === requestPath),
	);
}

function normalizeApiPath(value: string): string {
	const [pathWithTrailingSlash = ""] = value.split(/[?#]/, 1);
	const withLeadingSlash = pathWithTrailingSlash.startsWith("/")
		? pathWithTrailingSlash
		: `/${pathWithTrailingSlash}`;
	const withoutTrailingSlash =
		withLeadingSlash.length > 1
			? withLeadingSlash.replace(/\/$/, "")
			: withLeadingSlash;

	return withoutTrailingSlash === "/api" ||
		withoutTrailingSlash.startsWith("/api/")
		? withoutTrailingSlash
		: `/api${withoutTrailingSlash}`;
}

function registeredPathFromUrl(path: string): string {
	return /^\/api\/v1\/projects\/[^/]+\/leads$/.test(path)
		? leadsRoutes.listByProject(":projectId")
		: path;
}
