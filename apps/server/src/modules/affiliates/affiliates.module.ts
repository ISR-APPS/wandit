import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { BillingPaymentsModule } from "../billing/billing-payments.module";
import { AffiliateAdminService } from "./application/services/affiliate-admin.service";
import { AffiliateApprovalService } from "./application/services/affiliate-approval.service";
import { AffiliateAttributionService } from "./application/services/affiliate-attribution.service";
import { AffiliateClawbackService } from "./application/services/affiliate-clawback.service";
import { AffiliateClickService } from "./application/services/affiliate-click.service";
import { AffiliateClickThrottle } from "./application/services/affiliate-click-throttle";
import { AffiliateCommissionService } from "./application/services/affiliate-commission.service";
import { AffiliatePayoutService } from "./application/services/affiliate-payout.service";
import { AffiliateSelfReferralService } from "./application/services/affiliate-self-referral.service";
import { AffiliateTokenService } from "./application/services/affiliate-token.service";
import { AffiliateAdminRepository } from "./infrastructure/persistence/affiliate-admin.repository";
import { AffiliateAdminController } from "./presentation/http/controllers/affiliate-admin.controller";
import { AffiliateClickController } from "./presentation/http/controllers/affiliate-click.controller";

@Module({
	controllers: [AffiliateAdminController, AffiliateClickController],
	exports: [
		AffiliateApprovalService,
		AffiliateAttributionService,
		AffiliateClawbackService,
		AffiliateCommissionService,
		AffiliatePayoutService,
		AffiliateSelfReferralService,
	],
	imports: [
		AdminSecurityModule,
		BillingPaymentsModule,
		DatabaseModule,
		QueuesModule,
	],
	providers: [
		AffiliateAdminRepository,
		AffiliateAdminService,
		AffiliateApprovalService,
		AffiliateAttributionService,
		AffiliateClawbackService,
		AffiliateClickService,
		AffiliateClickThrottle,
		AffiliateCommissionService,
		AffiliatePayoutService,
		AffiliateSelfReferralService,
		AffiliateTokenService,
	],
})
export class AffiliatesModule {}
