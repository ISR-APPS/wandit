/**
 * The status pill of the affiliate portal. It shows the status of the
 * affiliate, a link, a referral, a commission entry, or a payout.
 * The portal page and the four portal tables render it.
 */
import type {
	AffiliateAttributionStatus,
	AffiliateCommissionStatus,
	AffiliateLinkStatus,
	AffiliatePayoutStatus,
	AffiliateStatus,
} from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";

import { type TranslationKey, useTranslation } from "@/lib/i18n";

type StatusTone = "danger" | "info" | "neutral" | "success" | "warning";

type StatusConfig = {
	key: TranslationKey;
	tone: StatusTone;
};

// Each tone has one meaning. Green: active or paid. Amber: paused or pending.
// Blue: approved or processing. Red: reversed or failed. Neutral: expired, voided, or draft.
const TONE_CLASS = {
	success:
		"bg-green-500/[0.12] text-green-800 dark:bg-green-400/15 dark:text-green-300",
	warning:
		"bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
	info: "bg-blue-500/[0.12] text-blue-800 dark:bg-blue-400/15 dark:text-blue-300",
	danger: "bg-red-500/[0.12] text-red-700 dark:bg-red-400/15 dark:text-red-300",
	neutral:
		"bg-night/[0.06] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70",
} as const satisfies Record<StatusTone, string>;

const AFFILIATE_STATUS_CONFIG = {
	active: { key: "affiliates.status.active", tone: "success" },
	paused: { key: "affiliates.status.paused", tone: "warning" },
} as const satisfies Record<AffiliateStatus, StatusConfig>;

const LINK_STATUS_CONFIG = {
	active: { key: "affiliates.linkStatus.active", tone: "success" },
	paused: { key: "affiliates.linkStatus.paused", tone: "warning" },
	expired: { key: "affiliates.linkStatus.expired", tone: "neutral" },
} as const satisfies Record<AffiliateLinkStatus, StatusConfig>;

const REFERRAL_STATUS_CONFIG = {
	active: { key: "affiliates.referrals.active", tone: "success" },
	voided: { key: "affiliates.referrals.voided", tone: "neutral" },
} as const satisfies Record<AffiliateAttributionStatus, StatusConfig>;

const COMMISSION_STATUS_CONFIG = {
	pending: { key: "affiliates.commissionStatus.pending", tone: "warning" },
	approved: { key: "affiliates.commissionStatus.approved", tone: "info" },
	paid: { key: "affiliates.commissionStatus.paid", tone: "success" },
	reversed: { key: "affiliates.commissionStatus.reversed", tone: "danger" },
} as const satisfies Record<AffiliateCommissionStatus, StatusConfig>;

const PAYOUT_STATUS_CONFIG = {
	draft: { key: "affiliates.payoutStatus.draft", tone: "neutral" },
	processing: { key: "affiliates.payoutStatus.processing", tone: "info" },
	paid: { key: "affiliates.payoutStatus.paid", tone: "success" },
	failed: { key: "affiliates.payoutStatus.failed", tone: "danger" },
} as const satisfies Record<AffiliatePayoutStatus, StatusConfig>;

type PortalStatusBadgeProps =
	| { kind: "affiliate"; status: AffiliateStatus }
	| { kind: "link"; status: AffiliateLinkStatus }
	| { kind: "referral"; status: AffiliateAttributionStatus }
	| { kind: "commission"; status: AffiliateCommissionStatus }
	| { kind: "payout"; status: AffiliatePayoutStatus };

/** A status pill. `kind` picks the label and the tone: green, amber, blue, red, or neutral. */
export function PortalStatusBadge(props: PortalStatusBadgeProps) {
	const { t } = useTranslation();
	const config = getStatusConfig(props);

	return (
		<span
			className={cn(
				"inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-grotesk font-semibold text-[11px]",
				TONE_CLASS[config.tone],
			)}
		>
			{t(config.key)}
		</span>
	);
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
