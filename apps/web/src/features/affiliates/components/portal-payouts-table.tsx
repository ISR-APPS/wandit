/**
 * The "Payouts" tab of the affiliate portal: one row per payout batch, with
 * its period, total, method, and status, and a pager. The portal page
 * renders it and owns the page and the query.
 */
import { MoneyIcon } from "@phosphor-icons/react/Money";
import type { AffiliatePortalPayout } from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";

import { useTranslation } from "@/lib/i18n";
import { formatAffiliateMoney } from "../lib/affiliate-portal-format";
import { PortalPagination } from "./portal-pagination";
import { PortalStatusBadge } from "./portal-status-badge";
import {
	PORTAL_TABLE_HEADER_CLASS,
	PORTAL_TABLE_ROW_CLASS,
	PortalTableCard,
	PortalTableEmpty,
	PortalTableError,
	PortalTableSkeleton,
} from "./portal-table-states";

type PortalPayoutsTableProps = {
	/** True while the query fetches. It locks the pager and spins the retry icon. */
	disabled?: boolean;
	isError: boolean;
	isPending: boolean;
	items: readonly AffiliatePortalPayout[];
	onPageChange: (page: number) => void;
	onRetry: () => void;
	page: number;
	pageSize: number;
	total: number;
};

/** The payout history. The total of a payout is in cents and shows in its own currency. */
export function PortalPayoutsTable({
	disabled = false,
	isError,
	isPending,
	items,
	onPageChange,
	onRetry,
	page,
	pageSize,
	total,
}: PortalPayoutsTableProps) {
	const { locale, t } = useTranslation();

	return (
		<PortalTableCard title={t("affiliates.payouts.title")}>
			{isPending ? (
				<PortalTableSkeleton />
			) : isError ? (
				<PortalTableError onRetry={onRetry} retrying={disabled} />
			) : items.length === 0 ? (
				<PortalTableEmpty
					icon={MoneyIcon}
					title={t("affiliates.payouts.empty")}
				/>
			) : (
				<Table>
					<TableHeader className={PORTAL_TABLE_HEADER_CLASS}>
						<TableRow className="hover:bg-transparent">
							<TableHead className="ps-4 sm:ps-6">
								{t("affiliates.payouts.created")}
							</TableHead>
							<TableHead>{t("affiliates.payouts.period")}</TableHead>
							<TableHead className="text-end">
								{t("affiliates.payouts.total")}
							</TableHead>
							<TableHead>{t("affiliates.payouts.method")}</TableHead>
							<TableHead>{t("affiliates.payouts.reference")}</TableHead>
							<TableHead>{t("affiliates.payouts.status")}</TableHead>
							<TableHead className="pe-4 text-end sm:pe-6">
								{t("affiliates.payouts.entries")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((payout) => (
							<TableRow key={payout.id} className={PORTAL_TABLE_ROW_CLASS}>
								<TableCell className="ps-4 text-night/60 text-xs sm:ps-6 dark:text-foreground/60">
									{formatDate(payout.createdAt, locale, {
										dateStyle: "short",
									})}
								</TableCell>
								<TableCell className="text-night/60 text-xs dark:text-foreground/60">
									{formatDate(payout.periodStart, locale, {
										dateStyle: "short",
									})}
									{" – "}
									{formatDate(payout.periodEnd, locale, {
										dateStyle: "short",
									})}
								</TableCell>
								<TableCell className="text-end font-medium font-mono text-xs tabular-nums">
									<span dir="ltr">
										{formatAffiliateMoney(
											payout.totalCents,
											payout.currency,
											locale,
										)}
									</span>
								</TableCell>
								<TableCell className="text-xs">
									{t(`affiliates.payoutMethod.${payout.method}`)}
								</TableCell>
								<TableCell>
									{payout.externalRef ? (
										<span
											className="block max-w-48 truncate font-mono text-night/60 text-xs dark:text-foreground/60"
											title={payout.externalRef}
										>
											<span dir="ltr">{payout.externalRef}</span>
										</span>
									) : (
										<span className="text-night/60 dark:text-foreground/60">
											—
										</span>
									)}
								</TableCell>
								<TableCell>
									<PortalStatusBadge kind="payout" status={payout.status} />
								</TableCell>
								<TableCell className="pe-4 text-end font-mono tabular-nums sm:pe-6">
									{formatNumber(payout.entryCount, locale)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
			{!isPending && !isError ? (
				<PortalPagination
					disabled={disabled}
					onPageChange={onPageChange}
					page={page}
					pageSize={pageSize}
					total={total}
				/>
			) : null}
		</PortalTableCard>
	);
}
