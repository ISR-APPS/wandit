import { Inject, Injectable } from "@nestjs/common";

import { AffiliatesRepository } from "../../infrastructure/persistence/affiliates.repository";

@Injectable()
export class AffiliateApprovalService {
	constructor(
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository: AffiliatesRepository,
	) {}

	async sweepEligible(): Promise<{ approved: number }> {
		const approved = await this.affiliatesRepository.approveEligible();

		return { approved };
	}
}
