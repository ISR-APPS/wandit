import type {
	AffiliateCommissionEntryType,
	AffiliateCommissionStatus,
} from "@wandit/contracts";
import { InfoIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

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
import { useAffiliateCommissionsQuery } from "../api/affiliates.queries";
import {
	formatAffiliateDateTime,
	formatAffiliateMoney,
	formatAffiliateRateBps,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import {
	AffiliateSectionMessage,
	AffiliateStatusBadge,
	AffiliateTableLoading,
	PaginationControls,
} from "./affiliate-ui";

const PAGE_SIZE = 20;

export function CommissionsTab() {
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [currency, setCurrency] = useState("");
	const [status, setStatus] = useState<AffiliateCommissionStatus | "all">(
		"all",
	);
	const [entryType, setEntryType] = useState<
		AffiliateCommissionEntryType | "all"
	>("all");
	const commissionsQuery = useAffiliateCommissionsQuery({
		page,
		pageSize: PAGE_SIZE,
		q: query.trim() || undefined,
		currency:
			currency.trim().length === 3 ? currency.trim().toLowerCase() : undefined,
		status: status === "all" ? undefined : status,
		entryType: entryType === "all" ? undefined : entryType,
	});

	return (
		<div className="space-y-4">
			<div>
				<h2 className="font-semibold text-lg">Commission ledger</h2>
				<p className="text-muted-foreground text-sm">
					Immutable earnings and adjustments generated from paid invoices and
					clawbacks.
				</p>
			</div>

			<div className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm">
				<InfoIcon className="mt-0.5 size-4 shrink-0 text-blue-600" />
				<p>
					Fraud flags are not included in the commission-ledger response. Review
					the affiliate&apos;s Attributed users tab for the authoritative flag
					state before payout.
				</p>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border bg-background p-3 lg:flex-row">
				<Input
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setPage(1);
					}}
					placeholder="Search affiliate, user, link, or invoice..."
					className="lg:max-w-sm"
				/>
				<Select
					value={status}
					onValueChange={(value) => {
						setStatus(value as AffiliateCommissionStatus | "all");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full lg:w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="approved">Approved</SelectItem>
						<SelectItem value="paid">Paid</SelectItem>
						<SelectItem value="reversed">Reversed</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={entryType}
					onValueChange={(value) => {
						setEntryType(value as AffiliateCommissionEntryType | "all");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full lg:w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All entries</SelectItem>
						<SelectItem value="earning">Earnings</SelectItem>
						<SelectItem value="adjustment">Adjustments</SelectItem>
					</SelectContent>
				</Select>
				<Input
					value={currency}
					onChange={(event) => {
						setCurrency(event.target.value);
						setPage(1);
					}}
					placeholder="Currency (USD)"
					maxLength={3}
					className="uppercase lg:w-40"
				/>
			</div>

			{commissionsQuery.isPending ? (
				<AffiliateTableLoading columns={8} />
			) : commissionsQuery.isError || !commissionsQuery.data ? (
				<AffiliateSectionMessage
					title="Commissions could not be loaded"
					description={errorMessage(
						commissionsQuery.error,
						"Retry the request to restore the commission ledger.",
					)}
					action={
						<Button
							type="button"
							onClick={() => void commissionsQuery.refetch()}
						>
							<RefreshCwIcon />
							Retry
						</Button>
					}
				/>
			) : commissionsQuery.data.items.length === 0 ? (
				<AffiliateSectionMessage
					title="No commission entries found"
					description="No ledger entry matches the selected filters."
				/>
			) : (
				<div className="overflow-hidden rounded-lg border bg-background">
					<div className="overflow-x-auto">
						<Table className="min-w-[1250px]">
							<TableHeader>
								<TableRow>
									<TableHead>Created</TableHead>
									<TableHead>Affiliate / user</TableHead>
									<TableHead>Entry</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Invoice references</TableHead>
									<TableHead>Hold / payout</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Fraud</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{commissionsQuery.data.items.map((entry) => (
									<TableRow key={entry.id}>
										<TableCell>
											{formatAffiliateDateTime(entry.createdAt)}
										</TableCell>
										<TableCell>
											<p className="font-medium">{entry.affiliate.name}</p>
											<p className="text-muted-foreground text-xs">
												{entry.attributedUser.email} · {entry.link.code}
											</p>
										</TableCell>
										<TableCell>
											<Badge variant="outline">
												{titleCaseAffiliateValue(entry.entryType)}
											</Badge>
											{entry.originalCommissionId ? (
												<p className="mt-1 font-mono text-[10px] text-muted-foreground">
													Original {entry.originalCommissionId}
												</p>
											) : null}
										</TableCell>
										<TableCell>
											<p className="font-mono font-semibold tabular-nums">
												{formatAffiliateMoney(
													entry.amountCents,
													entry.currency,
												)}
											</p>
											<p className="text-muted-foreground text-xs">
												Base{" "}
												{formatAffiliateMoney(
													entry.baseAmountCents,
													entry.currency,
												)}
												{entry.rateBps === null
													? " · fixed"
													: ` · ${formatAffiliateRateBps(entry.rateBps)}`}
											</p>
										</TableCell>
										<TableCell className="font-mono text-xs">
											<p>Invoice {entry.stripeInvoiceId}</p>
											<p className="text-muted-foreground">
												Charge {entry.stripeChargeId}
											</p>
											{entry.stripeRefundId ? (
												<p>Refund {entry.stripeRefundId}</p>
											) : null}
											{entry.stripeDisputeId ? (
												<p>Dispute {entry.stripeDisputeId}</p>
											) : null}
										</TableCell>
										<TableCell>
											<p>
												Hold until {formatAffiliateDateTime(entry.holdUntil)}
											</p>
											<p className="font-mono text-[10px] text-muted-foreground">
												{entry.payoutId
													? `Payout ${entry.payoutId}`
													: "Not claimed"}
											</p>
										</TableCell>
										<TableCell>
											<AffiliateStatusBadge status={entry.status} />
											{entry.reversalReason ? (
												<p className="mt-1 max-w-48 text-destructive text-xs">
													{entry.reversalReason}
												</p>
											) : null}
										</TableCell>
										<TableCell>
											<span className="text-muted-foreground text-xs">
												Not exposed
											</span>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<PaginationControls
						page={commissionsQuery.data.page}
						pageSize={commissionsQuery.data.pageSize}
						total={commissionsQuery.data.total}
						onPageChange={setPage}
					/>
				</div>
			)}
		</div>
	);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
