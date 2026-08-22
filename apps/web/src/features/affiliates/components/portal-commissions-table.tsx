import {
	type AffiliatePortalCommission,
	affiliateCommissionStatuses,
} from "@wandit/contracts";
import { formatDate, type Locale } from "@wandit/internationalization";
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
import { cn } from "@wandit/ui/lib/utils";
import { ReceiptText } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import {
	formatAffiliateMoney,
	formatAffiliateRate,
} from "../lib/affiliate-portal-format";
import { PortalPagination } from "./portal-pagination";
import { PortalStatusBadge } from "./portal-status-badge";
import { PortalTableError, PortalTableSkeleton } from "./portal-table-states";

type CommissionStatusFilter =
	| (typeof affiliateCommissionStatuses)[number]
	| "all";

type PortalCommissionsTableProps = {
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
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="items-center gap-3 border-b px-4 py-4 sm:px-6">
				<CardTitle>{t("affiliates.commissions.title")}</CardTitle>
				<CardAction>
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
							size="sm"
							className="w-40"
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
				</CardAction>
			</CardHeader>
			<CardContent className="p-0">
				{isPending ? (
					<PortalTableSkeleton />
				) : isError ? (
					<PortalTableError onRetry={onRetry} />
				) : (
					<>
						{items.length === 0 ? (
							<Empty className="min-h-56">
								<EmptyHeader>
									<EmptyMedia variant="icon" className="rounded-xl">
										<ReceiptText aria-hidden />
									</EmptyMedia>
									<EmptyTitle>{t("affiliates.commissions.empty")}</EmptyTitle>
								</EmptyHeader>
							</Empty>
						) : (
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="ps-4 sm:ps-6">
											{t("affiliates.commissions.date")}
										</TableHead>
										<TableHead>{t("affiliates.commissions.type")}</TableHead>
										<TableHead>
											{t("affiliates.commissions.referral")}
										</TableHead>
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
										<TableHead>
											{t("affiliates.commissions.holdUntil")}
										</TableHead>
										<TableHead className="pe-4 sm:pe-6">
											{t("affiliates.commissions.payout")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((entry) => (
										<TableRow key={entry.id}>
											<TableCell className="ps-4 text-muted-foreground text-xs sm:ps-6">
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
															: "text-muted-foreground",
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
											<TableCell className="text-muted-foreground text-xs">
												{formatDate(entry.holdUntil, locale, {
													dateStyle: "short",
												})}
											</TableCell>
											<TableCell className="pe-4 sm:pe-6">
												{entry.payoutId ? (
													<span
														dir="ltr"
														className="font-mono text-muted-foreground text-xs"
														title={entry.payoutId}
													>
														{entry.payoutId.slice(0, 8)}
													</span>
												) : (
													<span className="text-muted-foreground">—</span>
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
			</CardContent>
		</Card>
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
