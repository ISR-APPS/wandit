/**
 * The "Referrals" tab of the affiliate portal: one row per referred user,
 * with a status filter and a pager. The portal page renders it and owns the
 * page, the filter, and the query. Emails come masked from the API.
 */
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import {
	type AffiliateCurrencyAggregate,
	type AffiliatePortalReferral,
	affiliateAttributionStatuses,
} from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
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

import { useTranslation } from "@/lib/i18n";
import { formatAffiliateMoney } from "../lib/affiliate-portal-format";
import { PortalPagination } from "./portal-pagination";
import { PortalProgramTerms } from "./portal-program-terms";
import { PortalStatusBadge } from "./portal-status-badge";
import {
	PORTAL_TABLE_HEADER_CLASS,
	PORTAL_TABLE_ROW_CLASS,
	PortalTableCard,
	PortalTableEmpty,
	PortalTableError,
	PortalTableSkeleton,
} from "./portal-table-states";

type ReferralStatusFilter =
	| (typeof affiliateAttributionStatuses)[number]
	| "all";

type PortalReferralsTableProps = {
	/** True while the query fetches. It locks the filter and the pager, and spins the retry icon. */
	disabled?: boolean;
	isError: boolean;
	isPending: boolean;
	items: readonly AffiliatePortalReferral[];
	onPageChange: (page: number) => void;
	onRetry: () => void;
	onStatusChange: (status: ReferralStatusFilter) => void;
	page: number;
	pageSize: number;
	status: ReferralStatusFilter;
	total: number;
};

/** The referrals table. A new status filter sends the page back to 1 in the parent. */
export function PortalReferralsTable({
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
}: PortalReferralsTableProps) {
	const { locale, t } = useTranslation();

	return (
		<PortalTableCard
			title={t("affiliates.referrals.title")}
			action={
				<Select
					value={status}
					disabled={disabled}
					onValueChange={(value) => {
						const nextStatus =
							value === "all"
								? value
								: affiliateAttributionStatuses.find(
										(status) => status === value,
									);

						if (nextStatus) {
							onStatusChange(nextStatus);
						}
					}}
				>
					<SelectTrigger
						className="h-9 w-40 rounded-full border-night/10 bg-white font-grotesk font-medium text-[13px] text-night dark:border-border dark:bg-card dark:text-foreground"
						aria-label={t("affiliates.referrals.status")}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="all">
								{t("affiliates.referrals.filterAll")}
							</SelectItem>
							{affiliateAttributionStatuses.map((status) => (
								<SelectItem key={status} value={status}>
									{t(`affiliates.referrals.${status}`)}
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
			) : items.length === 0 ? (
				<PortalTableEmpty
					icon={UsersThreeIcon}
					title={t("affiliates.referrals.empty")}
				/>
			) : (
				<Table>
					<TableHeader className={PORTAL_TABLE_HEADER_CLASS}>
						<TableRow className="hover:bg-transparent">
							<TableHead className="ps-4 sm:ps-6">
								{t("affiliates.referrals.email")}
							</TableHead>
							<TableHead>{t("affiliates.referrals.signedUp")}</TableHead>
							<TableHead>{t("affiliates.referrals.link")}</TableHead>
							<TableHead>{t("affiliates.referrals.terms")}</TableHead>
							<TableHead>{t("affiliates.referrals.status")}</TableHead>
							<TableHead className="text-end">
								{t("affiliates.referrals.paidInvoices")}
							</TableHead>
							<TableHead>{t("affiliates.referrals.lastPaid")}</TableHead>
							<TableHead>{t("affiliates.referrals.revenue")}</TableHead>
							<TableHead className="pe-4 sm:pe-6">
								{t("affiliates.referrals.commission")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((referral) => (
							<TableRow key={referral.id} className={PORTAL_TABLE_ROW_CLASS}>
								<TableCell className="ps-4 sm:ps-6">
									<span dir="ltr" className="font-mono text-xs">
										{referral.maskedEmail}
									</span>
								</TableCell>
								<TableCell className="text-night/60 text-xs dark:text-foreground/60">
									{formatDate(referral.signedUpAt, locale, {
										dateStyle: "short",
									})}
								</TableCell>
								<TableCell>
									<span dir="ltr" className="font-mono text-xs">
										{referral.link.code}
									</span>
								</TableCell>
								<TableCell>
									{/* bdi keeps the name in its own direction; the line follows the page side, like the terms below. */}
									<p className="max-w-44 truncate font-grotesk font-semibold text-night text-xs dark:text-foreground">
										<bdi>{referral.program.name}</bdi>
									</p>
									<ReferralProgramTerms referral={referral} />
								</TableCell>
								<TableCell>
									<PortalStatusBadge kind="referral" status={referral.status} />
								</TableCell>
								<TableCell className="text-end font-mono tabular-nums">
									{formatNumber(referral.paidInvoiceCount, locale)}
								</TableCell>
								<TableCell className="text-night/60 text-xs dark:text-foreground/60">
									{referral.lastPaidAt
										? formatDate(referral.lastPaidAt, locale, {
												dateStyle: "short",
											})
										: "—"}
								</TableCell>
								<TableCell>
									<CurrencyAmounts
										currencies={referral.currencies}
										type="revenue"
									/>
								</TableCell>
								<TableCell className="pe-4 sm:pe-6">
									<CurrencyAmounts
										currencies={referral.currencies}
										type="commission"
									/>
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

function ReferralProgramTerms({
	referral,
}: {
	referral: AffiliatePortalReferral;
}) {
	if (
		referral.programKind === "percentage_recurring" &&
		referral.commissionRateBps !== null
	) {
		return (
			<PortalProgramTerms
				className="mt-1 block"
				parts={{
					kind: referral.programKind,
					rateBps: referral.commissionRateBps,
					durationMonths: referral.commissionDurationMonths,
				}}
			/>
		);
	}

	if (
		referral.programKind === "fixed_one_time" &&
		referral.fixedAmountCents !== null &&
		referral.fixedCurrency !== null
	) {
		return (
			<PortalProgramTerms
				className="mt-1 block"
				parts={{
					kind: referral.programKind,
					amountCents: referral.fixedAmountCents,
					currency: referral.fixedCurrency,
					durationMonths: referral.commissionDurationMonths,
				}}
			/>
		);
	}

	return (
		<span className="text-night/60 text-xs dark:text-foreground/60">—</span>
	);
}

function CurrencyAmounts({
	currencies,
	type,
}: {
	currencies: readonly AffiliateCurrencyAggregate[];
	type: "commission" | "revenue";
}) {
	const { locale } = useTranslation();

	if (currencies.length === 0) {
		return <span className="text-night/60 dark:text-foreground/60">—</span>;
	}

	return (
		<ul className="flex flex-col gap-1">
			{currencies.map((currency) => {
				const cents =
					type === "revenue"
						? currency.attributedRevenueCents
						: currency.pendingCommissionCents +
							currency.approvedCommissionCents +
							currency.paidCommissionCents;

				return (
					<li
						key={currency.currency}
						className="font-mono text-xs tabular-nums"
					>
						<span dir="ltr" className="inline-flex items-center gap-1.5">
							<span className="text-night/60 uppercase dark:text-foreground/60">
								{currency.currency}
							</span>
							<span>
								{formatAffiliateMoney(cents, currency.currency, locale)}
							</span>
						</span>
					</li>
				);
			})}
		</ul>
	);
}
