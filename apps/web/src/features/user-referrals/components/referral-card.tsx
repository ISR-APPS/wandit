/**
 * The "Get free credits" card of the dashboard sidebar. It links to the /refer page.
 * AppSidebar in features/projects renders it below the Upgrade card.
 * It reads the reward amounts from the public settings and the totals from the summary query.
 */
import { GiftIcon } from "@phosphor-icons/react/Gift";
import { Link } from "@tanstack/react-router";
import { captureEvent } from "@wandit/analytics/browser";
import { formatNumber } from "@wandit/internationalization";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { useUserReferralSummaryQuery } from "../api/user-referrals.queries";
import { useCreditPhrase, useUserReferralRewards } from "../lib/hooks";

/** The sidebar card. It renders nothing while the program is off. It has no icon-only form: the caller hides it in a collapsed sidebar. */
export function ReferralCard({ className }: { className?: string }) {
	const { locale, t } = useTranslation();
	const creditPhrase = useCreditPhrase();
	const rewards = useUserReferralRewards();
	// `rewards` is undefined while the program is off. The API then answers 403, so the request does not start.
	const summaryQuery = useUserReferralSummaryQuery({
		enabled: rewards !== undefined,
	});

	if (rewards === undefined) {
		return null;
	}

	const stats = summaryQuery.data?.stats;
	// Product rule: a user with a result sees the result, not the offer. The result is the reason to share again.
	const body =
		stats !== undefined && stats.joinedCount > 0
			? t("userReferrals.card.progress", {
					count: stats.joinedCount,
					countDisplay: formatNumber(stats.joinedCount, locale),
					earned: creditPhrase(stats.earnedCredits),
				})
			: t("userReferrals.card.body", {
					max: creditPhrase(rewards.maxCredits),
				});

	return (
		<Link
			to="/refer"
			onClick={() =>
				captureEvent("user_referral_card_clicked", { surface: "sidebar" })
			}
			className={cn(
				"flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-card/70 px-3 py-2.5 text-start transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				className,
			)}
		>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-grotesk font-medium text-sm">
					{t("userReferrals.card.title")}
				</span>
				<span className="mt-0.5 block text-muted-foreground text-xs">
					{body}
				</span>
			</span>
			<span
				aria-hidden
				className="grid size-8 shrink-0 place-items-center rounded-full bg-spark text-night"
			>
				<GiftIcon weight="fill" className="size-4" />
			</span>
		</Link>
	);
}
