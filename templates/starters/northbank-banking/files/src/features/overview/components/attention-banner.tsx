// The notice under the home title: a returned check of the period, else the pending entries.
// OverviewPage renders it with the rows of transactionsQueryOptions. The close button hides it until the page loads again.
// It follows the notification banner of the kit payment page, in the warning tokens.
import { WarningCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	countLabel,
	daysBetween,
	type PeriodDays,
	type Transaction,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { XIcon } from "~/shared/ui/icons";

type AttentionBannerProps = {
	/** Every entry, newest first. */
	rows: Transaction[];
	/** The period of the page, in days. A returned check of the period shows first. */
	days: PeriodDays;
};

/** No returned check and no pending entry: the banner does not render. */
export function AttentionBanner({ rows, days }: AttentionBannerProps) {
	const { t, locale } = useT();
	const [isDismissed, setIsDismissed] = useState(false);
	const today = todayIsoDay();
	const returned = rows.filter(
		(row) => row.status === "returned" && daysBetween(row.day, today) < days,
	);
	const pendingCount = rows.filter((row) => row.status === "pending").length;
	const newestReturned = returned[0];
	if (isDismissed || (!newestReturned && pendingCount === 0)) {
		return null;
	}
	return (
		<div
			role="status"
			className="flex flex-wrap items-center justify-between gap-3 rounded-(--surface-radius) border border-warning/25 bg-warning/12 px-4 py-3"
		>
			<p className="flex min-w-0 flex-1 items-start gap-3 font-medium text-sm">
				<WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
				{newestReturned
					? countLabel(
							returned.length,
							t("overview.banner.returnedOne"),
							t("overview.banner.returnedOther"),
							locale,
						)
					: countLabel(
							pendingCount,
							t("overview.banner.pendingOne"),
							t("overview.banner.pendingOther"),
							locale,
						)}
			</p>
			<div className="flex items-center gap-2">
				<Button size="sm" asChild>
					{newestReturned ? (
						<Link
							to="/app/transactions/$transactionId"
							params={{ transactionId: newestReturned.id }}
						>
							{t("overview.banner.review")}
						</Link>
					) : (
						<Link to="/app/transactions" search={{ tab: "upcoming" }}>
							{t("overview.banner.review")}
						</Link>
					)}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8"
					aria-label={t("overview.banner.close")}
					onClick={() => setIsDismissed(true)}
				>
					<XIcon />
				</Button>
			</div>
		</div>
	);
}
