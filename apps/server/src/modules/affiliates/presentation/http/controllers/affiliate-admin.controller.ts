import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Param,
	Patch,
	Post,
	Query,
	Res,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AffiliateAttributionsResponse,
	type AffiliateCommissionsResponse,
	type AffiliateCsvExportQuery,
	type AffiliateDetail,
	type AffiliateLinkListItem,
	type AffiliateLinksResponse,
	type AffiliatePayoutDetail,
	type AffiliatePayoutsResponse,
	type AffiliateProgramDetail,
	type AffiliateProgramsResponse,
	type AffiliatesResponse,
	affiliateCsvExportQuerySchema,
	type BuildAffiliatePayoutInput,
	buildAffiliatePayoutInputSchema,
	type CreateAffiliateInput,
	type CreateAffiliateLinkInput,
	type CreateAffiliateProgramInput,
	createAffiliateInputSchema,
	createAffiliateLinkInputSchema,
	createAffiliateProgramInputSchema,
	type DeleteAffiliateResourceResponse,
	type ListAffiliateAttributionsQuery,
	type ListAffiliateCommissionsQuery,
	type ListAffiliateLinksQuery,
	type ListAffiliatePayoutsQuery,
	type ListAffiliateProgramsQuery,
	type ListAffiliatesQuery,
	listAffiliateAttributionsQuerySchema,
	listAffiliateCommissionsQuerySchema,
	listAffiliateLinksQuerySchema,
	listAffiliatePayoutsQuerySchema,
	listAffiliateProgramsQuerySchema,
	listAffiliatesQuerySchema,
	type MarkAffiliatePayoutFailedInput,
	type MarkAffiliatePayoutPaidInput,
	markAffiliatePayoutFailedInputSchema,
	markAffiliatePayoutPaidInputSchema,
	type UpdateAffiliateInput,
	type UpdateAffiliateLinkInput,
	type UpdateAffiliateProgramInput,
	updateAffiliateInputSchema,
	updateAffiliateLinkInputSchema,
	updateAffiliateProgramInputSchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AdminOnly } from "../../../../admin/presentation/http/decorators/admin-only.decorator";
import { CurrentUser } from "../../../../auth";
import { AffiliateAdminService } from "../../../application/services/affiliate-admin.service";

@Controller("v1/admin/affiliates")
@AdminOnly()
export class AffiliateAdminController {
	constructor(
		@Inject(AffiliateAdminService)
		private readonly service: AffiliateAdminService,
	) {}

	@Get("programs")
	listPrograms(
		@Query(new ZodValidationPipe(listAffiliateProgramsQuerySchema))
		query: ListAffiliateProgramsQuery,
	): Promise<AffiliateProgramsResponse> {
		return this.service.listPrograms(query);
	}

	@Post("programs")
	createProgram(
		@Body(new ZodValidationPipe(createAffiliateProgramInputSchema))
		body: CreateAffiliateProgramInput,
	): Promise<AffiliateProgramDetail> {
		return this.service.createProgram(body);
	}

	@Get("programs/:programId")
	program(
		@Param("programId", new ZodValidationPipe(uuidSchema)) programId: string,
	): Promise<AffiliateProgramDetail> {
		return this.service.getProgram(programId);
	}

	@Patch("programs/:programId")
	updateProgram(
		@Param("programId", new ZodValidationPipe(uuidSchema)) programId: string,
		@Body(new ZodValidationPipe(updateAffiliateProgramInputSchema))
		body: UpdateAffiliateProgramInput,
	): Promise<AffiliateProgramDetail> {
		return this.service.updateProgram(programId, body);
	}

	@Delete("programs/:programId")
	archiveProgram(
		@Param("programId", new ZodValidationPipe(uuidSchema)) programId: string,
	): Promise<DeleteAffiliateResourceResponse> {
		return this.service.archiveProgram(programId);
	}

	@Get("commissions")
	commissions(
		@Query(new ZodValidationPipe(listAffiliateCommissionsQuerySchema))
		query: ListAffiliateCommissionsQuery,
	): Promise<AffiliateCommissionsResponse> {
		return this.service.listCommissions(query);
	}

	@Get("payouts")
	payouts(
		@Query(new ZodValidationPipe(listAffiliatePayoutsQuerySchema))
		query: ListAffiliatePayoutsQuery,
	): Promise<AffiliatePayoutsResponse> {
		return this.service.listPayouts(query);
	}

	@Post("payouts")
	@HttpCode(200)
	buildPayout(
		@Body(new ZodValidationPipe(buildAffiliatePayoutInputSchema))
		body: BuildAffiliatePayoutInput,
		@CurrentUser() admin: AuthUser,
	): Promise<AffiliatePayoutDetail> {
		return this.service.buildPayout(body, admin.id);
	}

	@Get("payouts/:payoutId")
	payout(
		@Param("payoutId", new ZodValidationPipe(uuidSchema)) payoutId: string,
	): Promise<AffiliatePayoutDetail> {
		return this.service.getPayout(payoutId);
	}

	@Post("payouts/:payoutId/mark-paid")
	@HttpCode(200)
	markPayoutPaid(
		@Param("payoutId", new ZodValidationPipe(uuidSchema)) payoutId: string,
		@Body(new ZodValidationPipe(markAffiliatePayoutPaidInputSchema))
		body: MarkAffiliatePayoutPaidInput,
	): Promise<AffiliatePayoutDetail> {
		return this.service.markPayoutPaid(payoutId, body.externalRef);
	}

	@Post("payouts/:payoutId/mark-failed")
	@HttpCode(200)
	markPayoutFailed(
		@Param("payoutId", new ZodValidationPipe(uuidSchema)) payoutId: string,
		@Body(new ZodValidationPipe(markAffiliatePayoutFailedInputSchema))
		body: MarkAffiliatePayoutFailedInput,
	): Promise<AffiliatePayoutDetail> {
		return this.service.markPayoutFailed(payoutId, body.reason);
	}

	@Get("export")
	@SkipResponseEnvelope()
	async exportCsv(
		@Query(new ZodValidationPipe(affiliateCsvExportQuerySchema))
		query: AffiliateCsvExportQuery,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.service.exportAffiliates(query);

		await reply
			.header("Content-Type", "text/csv; charset=utf-8")
			.header(
				"Content-Disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("Cache-Control", "private, no-store")
			.send(download.content);
	}

	@Get()
	affiliates(
		@Query(new ZodValidationPipe(listAffiliatesQuerySchema))
		query: ListAffiliatesQuery,
	): Promise<AffiliatesResponse> {
		return this.service.listAffiliates(query);
	}

	@Post()
	createAffiliate(
		@Body(new ZodValidationPipe(createAffiliateInputSchema))
		body: CreateAffiliateInput,
	): Promise<AffiliateDetail> {
		return this.service.createAffiliate(body);
	}

	@Get(":affiliateId")
	affiliate(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
	): Promise<AffiliateDetail> {
		return this.service.getAffiliate(affiliateId);
	}

	@Patch(":affiliateId")
	updateAffiliate(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
		@Body(new ZodValidationPipe(updateAffiliateInputSchema))
		body: UpdateAffiliateInput,
	): Promise<AffiliateDetail> {
		return this.service.updateAffiliate(affiliateId, body);
	}

	@Get(":affiliateId/links")
	links(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
		@Query(new ZodValidationPipe(listAffiliateLinksQuerySchema))
		query: ListAffiliateLinksQuery,
	): Promise<AffiliateLinksResponse> {
		return this.service.listLinks(affiliateId, query);
	}

	@Post(":affiliateId/links")
	createLink(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
		@Body(new ZodValidationPipe(createAffiliateLinkInputSchema))
		body: CreateAffiliateLinkInput,
	): Promise<AffiliateLinkListItem> {
		return this.service.createLink(affiliateId, body);
	}

	@Patch(":affiliateId/links/:linkId")
	updateLink(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
		@Param("linkId", new ZodValidationPipe(uuidSchema)) linkId: string,
		@Body(new ZodValidationPipe(updateAffiliateLinkInputSchema))
		body: UpdateAffiliateLinkInput,
	): Promise<AffiliateLinkListItem> {
		return this.service.updateLink(affiliateId, linkId, body);
	}

	@Delete(":affiliateId/links/:linkId")
	deactivateLink(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
		@Param("linkId", new ZodValidationPipe(uuidSchema)) linkId: string,
	): Promise<DeleteAffiliateResourceResponse> {
		return this.service.deactivateLink(affiliateId, linkId);
	}

	@Get(":affiliateId/attributions")
	attributions(
		@Param("affiliateId", new ZodValidationPipe(uuidSchema))
		affiliateId: string,
		@Query(new ZodValidationPipe(listAffiliateAttributionsQuerySchema))
		query: ListAffiliateAttributionsQuery,
	): Promise<AffiliateAttributionsResponse> {
		return this.service.listAttributions(affiliateId, query);
	}
}
