import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	AdminAnalyticsAcquisitionResponse,
	AdminAnalyticsEngagementResponse,
	AdminAnalyticsFeaturesResponse,
	AdminAnalyticsFunnelContactInput,
	AdminAnalyticsFunnelContactResponse,
	AdminAnalyticsFunnelResponse,
	AdminAnalyticsFunnelStepUsersExportQuery,
	AdminAnalyticsFunnelStepUsersQuery,
	AdminAnalyticsFunnelStepUsersResponse,
	AdminAnalyticsFunnelUserStep,
	AdminAnalyticsHealthResponse,
	AdminAnalyticsQuery,
	AdminAnalyticsRevenueResponse,
} from "@wandit/contracts";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";
import { AdminAnalyticsRepository } from "../../infrastructure/persistence/admin-analytics.repository";
import {
	type AdminFunnelContactRow,
	AdminFunnelContactsRepository,
} from "../../infrastructure/persistence/admin-funnel-contacts.repository";
import {
	assembleAcquisitionResponse,
	assembleEngagementResponse,
	assembleFeaturesResponse,
	assembleFunnelResponse,
	assembleFunnelStepUsersResponse,
	assembleHealthResponse,
	assembleRevenueResponse,
} from "./admin-analytics.metrics";
import { resolveAdminDashboardRange } from "./admin-dashboard-range";

export type AdminAnalyticsCsvDownload = {
	fileName: string;
	content: string;
};

@Injectable()
export class AdminAnalyticsService {
	constructor(
		@Inject(AdminAnalyticsRepository)
		private readonly adminAnalyticsRepository: AdminAnalyticsRepository,
		@Inject(AdminFunnelContactsRepository)
		private readonly adminFunnelContactsRepository: AdminFunnelContactsRepository,
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
	) {}

	async getRevenue(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsRevenueResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getRevenue(
			resolvedRange.bounds,
		);

		return assembleRevenueResponse(snapshot, generatedAt);
	}

	async getAcquisition(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsAcquisitionResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getAcquisition(
			resolvedRange.bounds,
			analyticsAttributionFilters(query),
		);

		return assembleAcquisitionResponse(snapshot, generatedAt);
	}

	async getFunnel(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsFunnelResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getFunnel(
			resolvedRange.bounds,
			analyticsAttributionFilters(query),
		);

		return assembleFunnelResponse(snapshot, generatedAt);
	}

	async getFunnelStepUsers(
		step: AdminAnalyticsFunnelUserStep,
		query: AdminAnalyticsFunnelStepUsersQuery,
	): Promise<AdminAnalyticsFunnelStepUsersResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getFunnelStepUsers(
			resolvedRange.bounds,
			step,
			analyticsAttributionFilters(query),
			{
				contacted: query.contacted,
				pagination: { page: query.page, pageSize: query.pageSize },
			},
		);

		return assembleFunnelStepUsersResponse(snapshot, step, generatedAt);
	}

	async getFunnelStepUsersCsv(
		step: AdminAnalyticsFunnelUserStep,
		query: AdminAnalyticsFunnelStepUsersExportQuery,
	): Promise<AdminAnalyticsCsvDownload> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getFunnelStepUsers(
			resolvedRange.bounds,
			step,
			analyticsAttributionFilters(query),
			{ contacted: query.contacted, pagination: null },
		);
		const response = assembleFunnelStepUsersResponse(
			snapshot,
			step,
			generatedAt,
		);
		const header = [
			"name",
			"email",
			"user_id",
			"signed_up_at",
			"first_event_at",
			"last_event_at",
			"event_count",
			"converted",
			"contacted",
			"contacted_at",
			"contacted_by",
		];
		const body = response.items.map((item) =>
			[
				item.name,
				item.email,
				item.id,
				item.signedUpAt,
				item.firstEventAt,
				item.lastEventAt,
				item.eventCount,
				item.converted ? "yes" : "no",
				item.contact ? "yes" : "no",
				item.contact?.contactedAt ?? null,
				item.contact?.contactedBy.name ?? null,
			]
				.map(csvCell)
				.join(","),
		);

		return {
			fileName: `funnel-${FUNNEL_STEP_SLUGS[step]}-users-${funnelContactedFileNameSegment(query.contacted)}${response.updatedAt.slice(0, 10)}.csv`,
			content: `${[header.join(","), ...body].join("\r\n")}\r\n`,
		};
	}

	async setFunnelContact(
		adminId: string,
		userId: string,
		input: AdminAnalyticsFunnelContactInput,
	): Promise<AdminAnalyticsFunnelContactResponse> {
		if (!(await this.adminRepository.findUserAccess(userId))) {
			throw new NotFoundException();
		}

		if (!input.contacted) {
			await this.adminFunnelContactsRepository.clear(userId);
			return { userId, contact: null };
		}

		await this.adminFunnelContactsRepository.set(userId, adminId);
		const contact = await this.adminFunnelContactsRepository.get(userId);

		return { userId, contact: mapFunnelContact(contact) };
	}

	async getEngagement(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsEngagementResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getEngagement(
			resolvedRange.bounds,
			{
				...analyticsAttributionFilters(query),
				cohortOnly: query.cohortOnly,
			},
		);

		return assembleEngagementResponse(snapshot, generatedAt);
	}

	async getFeatures(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsFeaturesResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getFeatures(
			resolvedRange.bounds,
		);

		return assembleFeaturesResponse(snapshot, generatedAt);
	}

	async getHealth(
		query: AdminAnalyticsQuery,
	): Promise<AdminAnalyticsHealthResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminAnalyticsRepository.getHealth(
			resolvedRange.bounds,
		);

		return assembleHealthResponse(snapshot, generatedAt);
	}
}

function analyticsAttributionFilters(
	query: AdminAnalyticsQuery,
): Pick<AdminAnalyticsQuery, "country" | "device" | "source"> {
	const filters: Pick<AdminAnalyticsQuery, "country" | "device" | "source"> =
		{};

	if (query.source !== undefined) filters.source = query.source;
	if (query.country !== undefined) filters.country = query.country;
	if (query.device !== undefined) filters.device = query.device;

	return filters;
}

const FUNNEL_STEP_SLUGS: Record<AdminAnalyticsFunnelUserStep, string> = {
	pricingViewed: "pricing-viewed",
	upgradeClicked: "upgrade-clicked",
	checkoutStarted: "checkout-started",
};

function funnelContactedFileNameSegment(
	contacted: AdminAnalyticsFunnelStepUsersExportQuery["contacted"],
): string {
	if (contacted === "all") return "";
	return `${contacted === "notContacted" ? "not-contacted" : "contacted"}-`;
}

function mapFunnelContact(
	contact: AdminFunnelContactRow | null,
): AdminAnalyticsFunnelContactResponse["contact"] {
	return contact
		? {
				contactedAt: contact.contactedAt.toISOString(),
				contactedBy: contact.contactedBy,
			}
		: null;
}

function csvCell(value: number | string | null): string {
	if (value === null) {
		return "";
	}

	let text = String(value);
	if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
		text = `'${text}`;
	}

	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
