import type {
	AffiliateAttributionStatus,
	AffiliateCommissionStatus,
	AffiliateLinkStatus,
	AffiliatePayoutStatus,
	AffiliateStatus,
} from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";

import { type TranslationKey, useTranslation } from "@/lib/i18n";

type BadgeVariant = "destructive" | "info" | "outline" | "success" | "warning";

type StatusConfig = {
	key: TranslationKey;
	variant: BadgeVariant;
};

const AFFILIATE_STATUS_CONFIG = {
	active: { key: "affiliates.status.active", variant: "success" },
	paused: { key: "affiliates.status.paused", variant: "warning" },
} as const satisfies Record<AffiliateStatus, StatusConfig>;

const LINK_STATUS_CONFIG = {
	active: { key: "affiliates.linkStatus.active", variant: "success" },
	paused: { key: "affiliates.linkStatus.paused", variant: "warning" },
	expired: { key: "affiliates.linkStatus.expired", variant: "outline" },
} as const satisfies Record<AffiliateLinkStatus, StatusConfig>;

const REFERRAL_STATUS_CONFIG = {
	active: { key: "affiliates.referrals.active", variant: "success" },
	voided: { key: "affiliates.referrals.voided", variant: "outline" },
} as const satisfies Record<AffiliateAttributionStatus, StatusConfig>;

const COMMISSION_STATUS_CONFIG = {
	pending: { key: "affiliates.commissionStatus.pending", variant: "warning" },
	approved: { key: "affiliates.commissionStatus.approved", variant: "info" },
	paid: { key: "affiliates.commissionStatus.paid", variant: "success" },
	reversed: {
		key: "affiliates.commissionStatus.reversed",
		variant: "destructive",
	},
} as const satisfies Record<AffiliateCommissionStatus, StatusConfig>;

const PAYOUT_STATUS_CONFIG = {
	draft: { key: "affiliates.payoutStatus.draft", variant: "outline" },
	processing: { key: "affiliates.payoutStatus.processing", variant: "info" },
	paid: { key: "affiliates.payoutStatus.paid", variant: "success" },
	failed: { key: "affiliates.payoutStatus.failed", variant: "destructive" },
} as const satisfies Record<AffiliatePayoutStatus, StatusConfig>;

type PortalStatusBadgeProps =
	| { kind: "affiliate"; status: AffiliateStatus }
	| { kind: "link"; status: AffiliateLinkStatus }
	| { kind: "referral"; status: AffiliateAttributionStatus }
	| { kind: "commission"; status: AffiliateCommissionStatus }
	| { kind: "payout"; status: AffiliatePayoutStatus };

export function PortalStatusBadge(props: PortalStatusBadgeProps) {
	const { t } = useTranslation();
	const config = getStatusConfig(props);

	return <Badge variant={config.variant}>{t(config.key)}</Badge>;
}

function getStatusConfig(props: PortalStatusBadgeProps): StatusConfig {
	switch (props.kind) {
		case "affiliate":
			return AFFILIATE_STATUS_CONFIG[props.status];
		case "link":
			return LINK_STATUS_CONFIG[props.status];
		case "referral":
			return REFERRAL_STATUS_CONFIG[props.status];
		case "commission":
			return COMMISSION_STATUS_CONFIG[props.status];
		case "payout":
			return PAYOUT_STATUS_CONFIG[props.status];
	}
}
