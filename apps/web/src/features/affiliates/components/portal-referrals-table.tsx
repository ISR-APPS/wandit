import {
	type AffiliateCurrencyAggregate,
	type AffiliatePortalReferral,
	affiliateAttributionStatuses,
} from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
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
import { Users } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { formatAffiliateMoney } from "../lib/affiliate-portal-format";
import { PortalPagination } from "./portal-pagination";
import { PortalProgramTerms } from "./portal-program-terms";
import { PortalStatusBadge } from "./portal-status-badge";
import { PortalTableError, PortalTableSkeleton } from "./portal-table-states";

type ReferralStatusFilter =
	| (typeof affiliateAttributionStatuses)[number]
	| "all";

type PortalReferralsTableProps = {
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
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="items-center gap-3 border-b px-4 py-4 sm:px-6">
				<CardTitle>{t("affiliates.referrals.title")}</CardTitle>
				<CardAction>
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
							size="sm"
							className="w-40"
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
				</CardAction>
			</CardHeader>
			<CardContent className="p-0">
				{isPending ? (
					<PortalTableSkeleton />
				) : isError ? (
					<PortalTableError onRetry={onRetry} />
				) : items.length === 0 ? (
					<Empty className="min-h-56">
						<EmptyHeader>
							<EmptyMedia variant="icon" className="rounded-xl">
								<Users aria-hidden />
							</EmptyMedia>
							<EmptyTitle>{t("affiliates.referrals.empty")}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
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
								<TableRow key={referral.id}>
									<TableCell className="ps-4 sm:ps-6">
										<span dir="ltr" className="font-mono text-xs">
											{referral.maskedEmail}
										</span>
									</TableCell>
									<TableCell className="text-muted-foreground text-xs">
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
										<p className="max-w-44 truncate font-medium text-xs">
											{referral.program.name}
										</p>
										<ReferralProgramTerms referral={referral} />
									</TableCell>
									<TableCell>
										<PortalStatusBadge
											kind="referral"
											status={referral.status}
										/>
									</TableCell>
									<TableCell className="text-end font-mono tabular-nums">
										{formatNumber(referral.paidInvoiceCount, locale)}
									</TableCell>
									<TableCell className="text-muted-foreground text-xs">
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
			</CardContent>
		</Card>
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

	return <span className="text-muted-foreground text-xs">—</span>;
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
		return <span className="text-muted-foreground">—</span>;
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
							<span className="text-muted-foreground uppercase">
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
