/**
 * The "Commissions" tab of the affiliate portal: the commission ledger, one
 * row per earning or adjustment, with a status filter and a pager. The
 * portal page renders it and owns the page, the filter, and the query.
 */
import { ReceiptIcon } from "@phosphor-icons/react/Receipt";
import {
	type AffiliatePortalCommission,
	affiliateCommissionStatuses,
} from "@wandit/contracts";
import { formatDate, type Locale } from "@wandit/internationalization";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import {
	formatAffiliateMoney,
	formatAffiliateRate,
} from "../lib/affiliate-portal-format";
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

type CommissionStatusFilter =
	| (typeof affiliateCommissionStatuses)[number]
	| "all";

type PortalCommissionsTableProps = {
	/** True while the query fetches. It locks the filter and the pager, and spins the retry icon. */
	disabled?: boolean;
	isError: boolean;
	isPending: boolean;
	items: readonly AffiliatePortalCommission[];
	onPageChange: (page: number) => void;
	onRetry: () => void;
	onStatusChange: (status: CommissionStatusFilter) => void;
	page: number;
	pageSize: number;
	status: CommissionStatusFilter;
	total: number;
};

/** The commission ledger. A positive amount shows green with "+", a negative one red with "−". */
export function PortalCommissionsTable({
	disabled = false,
	isError,
	isPending,
	items,
	onPageChange,
	onRetry,
	onStatusChange,
	page,
	pageSize,
	status,
	total,
}: PortalCommissionsTableProps) {
	const { locale, t } = useTranslation();

	return (
		<PortalTableCard
			title={t("affiliates.commissions.title")}
			action={
				<Select
					value={status}
					disabled={disabled}
					onValueChange={(value) => {
						const nextStatus =
							value === "all"
								? value
								: affiliateCommissionStatuses.find(
										(status) => status === value,
									);

						if (nextStatus) {
							onStatusChange(nextStatus);
						}
					}}
				>
					<SelectTrigger
						className="h-9 w-40 rounded-full border-night/10 bg-white font-grotesk font-medium text-[13px] text-night dark:border-border dark:bg-card dark:text-foreground"
						aria-label={t("affiliates.commissions.status")}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="all">
								{t("affiliates.commissions.filterAll")}
							</SelectItem>
							{affiliateCommissionStatuses.map((status) => (
								<SelectItem key={status} value={status}>
									{t(`affiliates.commissionStatus.${status}`)}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			}
		>
			{isPending ? (
				<PortalTableSkeleton />
			) : isError ? (
				<PortalTableError onRetry={onRetry} retrying={disabled} />
			) : (
				<>
					{items.length === 0 ? (
						<PortalTableEmpty
							icon={ReceiptIcon}
							title={t("affiliates.commissions.empty")}
						/>
					) : (
						<Table>
							<TableHeader className={PORTAL_TABLE_HEADER_CLASS}>
								<TableRow className="hover:bg-transparent">
									<TableHead className="ps-4 sm:ps-6">
										{t("affiliates.commissions.date")}
									</TableHead>
									<TableHead>{t("affiliates.commissions.type")}</TableHead>
									<TableHead>{t("affiliates.commissions.referral")}</TableHead>
									<TableHead>{t("affiliates.commissions.link")}</TableHead>
									<TableHead className="text-end">
										{t("affiliates.commissions.base")}
									</TableHead>
									<TableHead className="text-end">
										{t("affiliates.commissions.rate")}
									</TableHead>
									<TableHead className="text-end">
										{t("affiliates.commissions.amount")}
									</TableHead>
									<TableHead>{t("affiliates.commissions.status")}</TableHead>
									<TableHead>{t("affiliates.commissions.holdUntil")}</TableHead>
									<TableHead className="pe-4 sm:pe-6">
										{t("affiliates.commissions.payout")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map((entry) => (
									<TableRow key={entry.id} className={PORTAL_TABLE_ROW_CLASS}>
										<TableCell className="ps-4 text-night/60 text-xs sm:ps-6 dark:text-foreground/60">
											{formatDate(entry.createdAt, locale, {
												dateStyle: "short",
											})}
										</TableCell>
										<TableCell className="text-xs">
											{t(`affiliates.entryType.${entry.entryType}`)}
										</TableCell>
										<TableCell>
											<span dir="ltr" className="font-mono text-xs">
												{entry.referral.maskedEmail}
											</span>
										</TableCell>
										<TableCell>
											<span dir="ltr" className="font-mono text-xs">
												{entry.link.code}
											</span>
										</TableCell>
										<TableCell className="text-end font-mono text-xs tabular-nums">
											<span dir="ltr">
												{formatAffiliateMoney(
													entry.baseAmountCents,
													entry.currency,
													locale,
												)}
											</span>
										</TableCell>
										<TableCell className="text-end font-mono text-xs tabular-nums">
											<span dir="ltr">
												{entry.rateBps === null
													? "—"
													: formatAffiliateRate(entry.rateBps, locale)}
											</span>
										</TableCell>
										<TableCell
											className={cn(
												"text-end font-medium font-mono text-xs tabular-nums",
												entry.amountCents > 0
													? "text-success"
													: entry.amountCents < 0
														? "text-destructive"
														: "text-night/60 dark:text-foreground/60",
											)}
										>
											<span dir="ltr">
												{formatSignedMoney(
													entry.amountCents,
													entry.currency,
													locale,
												)}
											</span>
										</TableCell>
										<TableCell>
											<PortalStatusBadge
												kind="commission"
												status={entry.status}
											/>
										</TableCell>
										<TableCell className="text-night/60 text-xs dark:text-foreground/60">
											{formatDate(entry.holdUntil, locale, {
												dateStyle: "short",
											})}
										</TableCell>
										<TableCell className="pe-4 sm:pe-6">
											{entry.payoutId ? (
												<span
													dir="ltr"
													className="font-mono text-night/60 text-xs dark:text-foreground/60"
													title={entry.payoutId}
												>
													{entry.payoutId.slice(0, 8)}
												</span>
											) : (
												<span className="text-night/60 dark:text-foreground/60">
													—
												</span>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
					<PortalPagination
						disabled={disabled}
						onPageChange={onPageChange}
						page={page}
						pageSize={pageSize}
						total={total}
					/>
				</>
			)}
		</PortalTableCard>
	);
}

function formatSignedMoney(cents: number, currency: string, locale: Locale) {
	const amount = formatAffiliateMoney(Math.abs(cents), currency, locale);

	if (cents > 0) {
		return `+${amount}`;
	}

	if (cents < 0) {
		return `−${amount}`;
	}

	return amount;
}
