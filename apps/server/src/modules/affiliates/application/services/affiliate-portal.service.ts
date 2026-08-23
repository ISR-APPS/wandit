import {
	Inject,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import type {
	AffiliatePortalCommissionsResponse,
	AffiliatePortalMeResponse,
	AffiliatePortalOverview,
	AffiliatePortalPayoutsResponse,
	AffiliatePortalProfile,
	AffiliatePortalReferralsResponse,
	ListAffiliatePortalCommissionsQuery,
	ListAffiliatePortalPayoutsQuery,
	ListAffiliatePortalReferralsQuery,
} from "@wandit/contracts";

import {
	maskAffiliateEmail,
	toPortalReversalReason,
} from "../../domain/affiliate-privacy";
import type { AffiliateAdminAffiliateRow } from "../../infrastructure/persistence/affiliate-admin.repository";
import { AffiliateAdminRepository } from "../../infrastructure/persistence/affiliate-admin.repository";
import { AffiliatePortalRepository } from "../../infrastructure/persistence/affiliate-portal.repository";
import { mapLinkRecord, mapProgram } from "../mappers/affiliate-dto.mappers";

@Injectable()
export class AffiliatePortalService {
	constructor(
		@Inject(AffiliateAdminRepository)
		private readonly adminRepository: AffiliateAdminRepository,
		@Inject(AffiliatePortalRepository)
		private readonly portalRepository: AffiliatePortalRepository,
	) {}

	async me(userId: string): Promise<AffiliatePortalMeResponse> {
		const affiliate = await this.portalRepository.findAffiliateByUserId(userId);

		return {
			affiliate: affiliate ? mapPortalProfile(affiliate) : null,
		};
	}

	async overview(userId: string): Promise<AffiliatePortalOverview> {
		const affiliate = await this.requireAffiliate(userId);
		const [aggregates, linkRecords] = await Promise.all([
			this.adminRepository.getAffiliateCoreAggregates(affiliate.id),
			this.adminRepository.listAllLinks(affiliate.id),
		]);

		if (!aggregates) {
			throw new InternalServerErrorException(
				"Affiliate profile could not be read",
			);
		}

		const programIds = [
			...new Set(linkRecords.map(({ link }) => link.programId)),
		];
		const programs =
			programIds.length > 0
				? await this.portalRepository.listProgramsByIds(programIds)
				: [];
		const programsById = new Map(
			programs.map((program) => [program.id, program]),
		);

		return {
			affiliate: mapPortalProfile(affiliate),
			aggregates: {
				linkCount: aggregates.linkCount,
				activeLinkCount: aggregates.activeLinkCount,
				clickCount: aggregates.clickCount,
				uniqueVisitorCount: aggregates.uniqueVisitorCount,
				attributedUserCount: aggregates.attributedUserCount,
				paidCustomerCount: aggregates.paidCustomerCount,
				paidInvoiceCount: aggregates.paidInvoiceCount,
				lastConversionAt: aggregates.lastConversionAt?.toISOString() ?? null,
				currencies: aggregates.currencies,
			},
			links: linkRecords.map((linkRecord) => {
				const program = programsById.get(linkRecord.link.programId);

				if (!program) {
					throw new InternalServerErrorException(
						"Affiliate link program could not be read",
					);
				}

				const mapped = mapLinkRecord(linkRecord);

				return {
					link: mapped.link,
					program: mapProgram(program),
					aggregates: mapped.aggregates,
				};
			}),
		};
	}

	async listReferrals(
		userId: string,
		query: ListAffiliatePortalReferralsQuery,
	): Promise<AffiliatePortalReferralsResponse> {
		const affiliate = await this.requireAffiliate(userId);
		const page = await this.adminRepository.listAttributions(affiliate.id, {
			page: query.page,
			pageSize: query.pageSize,
			status: query.status,
			fraud: "all",
		});

		return {
			items: page.items.map((record) => ({
				id: record.attribution.id,
				maskedEmail: maskAffiliateEmail(record.user.email),
				signedUpAt: record.attribution.lockedAt.toISOString(),
				status: record.attribution.status,
				link: record.link,
				program: record.program,
				programKind: record.attribution.programKind,
				commissionRateBps: record.attribution.commissionRateBps,
				fixedAmountCents: record.attribution.fixedAmountCents,
				fixedCurrency: record.attribution.fixedCurrency,
				commissionDurationMonths: record.attribution.commissionDurationMonths,
				paidInvoiceCount: record.paidInvoiceCount,
				firstPaidAt: record.firstPaidAt?.toISOString() ?? null,
				lastPaidAt: record.lastPaidAt?.toISOString() ?? null,
				currencies: record.currencies,
			})),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async listCommissions(
		userId: string,
		query: ListAffiliatePortalCommissionsQuery,
	): Promise<AffiliatePortalCommissionsResponse> {
		const affiliate = await this.requireAffiliate(userId);
		const page = await this.adminRepository.listCommissions({
			page: query.page,
			pageSize: query.pageSize,
			affiliateId: affiliate.id,
			entryType: query.entryType,
			status: query.status,
			currency: query.currency,
			sort: "newest",
		});

		return {
			items: page.items.map((record) => ({
				id: record.commission.id,
				entryType: record.commission.entryType,
				status: record.commission.status,
				currency: record.commission.currency,
				baseAmountCents: record.commission.baseAmountCents,
				rateBps: record.commission.rateBps,
				amountCents: record.commission.amountCents,
				holdUntil: record.commission.holdUntil.toISOString(),
				payoutId: record.commission.payoutId,
				reversalReason: toPortalReversalReason(
					record.commission.reversalReason,
				),
				createdAt: record.commission.createdAt.toISOString(),
				referral: {
					id: record.commission.attributionId,
					maskedEmail: maskAffiliateEmail(record.attributedUser.email),
				},
				link: record.link,
			})),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async listPayouts(
		userId: string,
		query: ListAffiliatePortalPayoutsQuery,
	): Promise<AffiliatePortalPayoutsResponse> {
		const affiliate = await this.requireAffiliate(userId);
		const page = await this.adminRepository.listPayouts({
			page: query.page,
			pageSize: query.pageSize,
			affiliateId: affiliate.id,
			status: query.status,
		});

		return {
			items: page.items.map((record) => ({
				id: record.payout.id,
				totalCents: record.payout.totalCents,
				currency: record.payout.currency,
				method: record.payout.method,
				externalRef: record.payout.externalRef,
				status: record.payout.status,
				periodStart: record.payout.periodStart.toISOString(),
				periodEnd: record.payout.periodEnd.toISOString(),
				paidAt: record.payout.paidAt?.toISOString() ?? null,
				entryCount: record.entryCount,
				createdAt: record.payout.createdAt.toISOString(),
			})),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	private async requireAffiliate(
		userId: string,
	): Promise<AffiliateAdminAffiliateRow> {
		const affiliate = await this.portalRepository.findAffiliateByUserId(userId);

		if (!affiliate) {
			throw new NotFoundException("Affiliate profile not found");
		}

		return affiliate;
	}
}

function mapPortalProfile(
	affiliate: AffiliateAdminAffiliateRow,
): AffiliatePortalProfile {
	return {
		id: affiliate.id,
		name: affiliate.name,
		email: affiliate.email,
		status: affiliate.status,
		payoutMethod: affiliate.payoutMethod,
		createdAt: affiliate.createdAt.toISOString(),
	};
}
