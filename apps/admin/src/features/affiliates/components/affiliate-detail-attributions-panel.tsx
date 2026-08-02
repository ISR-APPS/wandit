import type {
	AffiliateAttributedUser,
	AffiliateAttributionStatus,
	AffiliateFraudFlag,
} from "@wandit/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { useAffiliateAttributionsQuery } from "../api/affiliates.queries";
import {
	formatAffiliateDate,
	formatAffiliateMoney,
	formatAffiliateNumber,
	formatAffiliateRateBps,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import { AffiliateDetailSkeleton } from "./affiliate-detail-sections";
import {
	AffiliateSectionMessage,
	AffiliateStatusBadge,
	CurrencyValues,
	PaginationControls,
} from "./affiliate-ui";

type AttributionsQuery = ReturnType<typeof useAffiliateAttributionsQuery>;

export function AffiliateDetailAttributionsPanel({
	query,
	search,
	status,
	fraud,
	onSearchChange,
	onStatusChange,
	onFraudChange,
	onPageChange,
}: {
	query: AttributionsQuery;
	search: string;
	status: AffiliateAttributionStatus | "all";
	fraud: "all" | "flagged" | "clear";
	onSearchChange: (value: string) => void;
	onStatusChange: (value: AffiliateAttributionStatus | "all") => void;
	onFraudChange: (value: "all" | "flagged" | "clear") => void;
	onPageChange: (page: number) => void;
}) {
	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Search user or link..."
					className="sm:max-w-xs"
				/>
				<Select
					value={status}
					onValueChange={(value) =>
						onStatusChange(value as AffiliateAttributionStatus | "all")
					}
				>
					<SelectTrigger className="w-full sm:w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="voided">Voided</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={fraud}
					onValueChange={(value) =>
						onFraudChange(value as "all" | "flagged" | "clear")
					}
				>
					<SelectTrigger className="w-full sm:w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All fraud states</SelectItem>
						<SelectItem value="flagged">Flagged</SelectItem>
						<SelectItem value="clear">Clear</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<AttributionsTable query={query} onPageChange={onPageChange} />
		</div>
	);
}

function AttributionsTable({
	query,
	onPageChange,
}: {
	query: AttributionsQuery;
	onPageChange: (page: number) => void;
}) {
	if (query.isPending) {
		return <AffiliateDetailSkeleton />;
	}
	if (query.isError || !query.data) {
		return (
			<AffiliateSectionMessage
				title="Attributed users could not be loaded"
				description={errorMessage(query.error, "Retry the request.")}
				action={<Button onClick={() => void query.refetch()}>Retry</Button>}
			/>
		);
	}
	if (query.data.items.length === 0) {
		return (
			<AffiliateSectionMessage
				title="No attributed users found"
				description="No attribution matches the selected filters."
			/>
		);
	}
	return (
		<div className="overflow-hidden rounded-lg border">
			<div className="overflow-x-auto">
				<Table className="min-w-[1000px]">
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Link / program</TableHead>
							<TableHead>Terms snapshot</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Paid activity</TableHead>
							<TableHead>Revenue / balance</TableHead>
							<TableHead>Fraud flags</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{query.data.items.map((item) => (
							<AttributionRow key={item.id} item={item} />
						))}
					</TableBody>
				</Table>
			</div>
			<PaginationControls
				page={query.data.page}
				pageSize={query.data.pageSize}
				total={query.data.total}
				onPageChange={onPageChange}
			/>
		</div>
	);
}

function AttributionRow({ item }: { item: AffiliateAttributedUser }) {
	return (
		<TableRow>
			<TableCell>
				<p className="font-medium">{item.user.name}</p>
				<p className="text-muted-foreground text-xs">{item.user.email}</p>
			</TableCell>
			<TableCell>
				<p className="font-mono text-xs">{item.link.code}</p>
				<p className="text-muted-foreground text-xs">{item.program.name}</p>
			</TableCell>
			<TableCell>
				{attributionTerms(item)}
				<p className="text-muted-foreground text-xs">
					{item.commissionDurationMonths === null
						? "Lifetime"
						: `${item.commissionDurationMonths} months`}
				</p>
			</TableCell>
			<TableCell>
				<AffiliateStatusBadge status={item.status} />
				<p className="mt-1 text-muted-foreground text-xs">
					{titleCaseAffiliateValue(item.source)} ·{" "}
					{formatAffiliateDate(item.lockedAt)}
				</p>
			</TableCell>
			<TableCell>
				<p>{formatAffiliateNumber(item.paidInvoiceCount)} invoices</p>
				<p className="text-muted-foreground text-xs">
					Last {formatAffiliateDate(item.lastPaidAt)}
				</p>
			</TableCell>
			<TableCell>
				<CurrencyValues
					currencies={item.currencies}
					metric="attributedRevenueCents"
				/>
				<div className="mt-1">
					<CurrencyValues currencies={item.currencies} metric="balanceCents" />
				</div>
			</TableCell>
			<TableCell>
				<FraudFlags flags={item.fraudFlags} />
			</TableCell>
		</TableRow>
	);
}

function FraudFlags({ flags }: { flags: AffiliateFraudFlag[] }) {
	if (flags.length === 0) {
		return <span className="text-muted-foreground text-xs">Clear</span>;
	}
	return (
		<div className="space-y-1">
			{flags.map((flag) => (
				<Badge
					key={`${flag.code}-${flag.detectedAt}`}
					variant="outline"
					className={
						flag.resolvedAt
							? "text-muted-foreground"
							: "border-destructive/30 text-destructive"
					}
				>
					{titleCaseAffiliateValue(flag.code)}
					{flag.resolvedAt ? " · resolved" : ""}
				</Badge>
			))}
		</div>
	);
}

function attributionTerms(item: AffiliateAttributedUser) {
	return item.programKind === "percentage_recurring"
		? formatAffiliateRateBps(item.commissionRateBps)
		: formatAffiliateMoney(item.fixedAmountCents, item.fixedCurrency);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
