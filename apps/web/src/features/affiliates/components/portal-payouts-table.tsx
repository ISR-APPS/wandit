import type { AffiliatePortalPayout } from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import {
	Card,
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { Banknote } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { formatAffiliateMoney } from "../lib/affiliate-portal-format";
import { PortalPagination } from "./portal-pagination";
import { PortalStatusBadge } from "./portal-status-badge";
import { PortalTableError, PortalTableSkeleton } from "./portal-table-states";

type PortalPayoutsTableProps = {
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
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="border-b px-4 py-5 sm:px-6">
				<CardTitle>{t("affiliates.payouts.title")}</CardTitle>
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
								<Banknote aria-hidden />
							</EmptyMedia>
							<EmptyTitle>{t("affiliates.payouts.empty")}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
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
								<TableRow key={payout.id}>
									<TableCell className="ps-4 text-muted-foreground text-xs sm:ps-6">
										{formatDate(payout.createdAt, locale, {
											dateStyle: "short",
										})}
									</TableCell>
									<TableCell className="text-muted-foreground text-xs">
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
												className="block max-w-48 truncate font-mono text-muted-foreground text-xs"
												title={payout.externalRef}
											>
												<span dir="ltr">{payout.externalRef}</span>
											</span>
										) : (
											<span className="text-muted-foreground">—</span>
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
			</CardContent>
		</Card>
	);
}
