import type {
	AffiliateStatus,
	AffiliatesSummary,
	ListAffiliatesQuery,
} from "@wandit/contracts";
import {
	CirclePauseIcon,
	CirclePlayIcon,
	DownloadIcon,
	Loader2Icon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
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
import type { AffiliateTableRow } from "../api/affiliates.dto";
import { mapAffiliateListItemToTableRow } from "../api/affiliates.dto";
import { useUpdateAffiliateMutation } from "../api/affiliates.mutations";
import {
	useAffiliateProgramsQuery,
	useAffiliatesQuery,
} from "../api/affiliates.queries";
import { downloadAffiliateCsv } from "../api/affiliates.services";
import {
	formatAffiliateDateTime,
	formatAffiliateMoney,
	formatAffiliateNumber,
	formatNullableAffiliateMoney,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import { AffiliateDetailSheet } from "./affiliate-detail-sheet";
import { AffiliateEditorDialog } from "./affiliate-editor-dialog";
import {
	AffiliateSectionMessage,
	AffiliateStatusBadge,
	AffiliateTableLoading,
	CurrencyValues,
	PaginationControls,
} from "./affiliate-ui";

const PAGE_SIZE = 15;

export function AffiliatesTab() {
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState<AffiliateStatus | "all">("all");
	const [sort, setSort] = useState<ListAffiliatesQuery["sort"]>("newest");
	const [programSearch, setProgramSearch] = useState("");
	const [programId, setProgramId] = useState("all");
	const [createOpen, setCreateOpen] = useState(false);
	const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(
		null,
	);
	const [exporting, setExporting] = useState(false);
	const affiliatesQuery = useAffiliatesQuery({
		page,
		pageSize: PAGE_SIZE,
		q: query.trim() || undefined,
		status: status === "all" ? undefined : status,
		sort,
		programId: programId === "all" ? undefined : programId,
	});
	const programsQuery = useAffiliateProgramsQuery({
		page: 1,
		pageSize: 100,
		q: programSearch.trim() || undefined,
	});
	const rows = useMemo(
		() => affiliatesQuery.data?.items.map(mapAffiliateListItemToTableRow) ?? [],
		[affiliatesQuery.data?.items],
	);

	async function exportCsv() {
		setExporting(true);
		try {
			const fileName = await downloadAffiliateCsv({
				q: query.trim() || undefined,
				status: status === "all" ? undefined : status,
				programId: programId === "all" ? undefined : programId,
			});
			toast.success(`${fileName} downloaded.`);
		} catch (error) {
			toast.error(
				errorMessage(error, "The affiliate export could not be downloaded."),
			);
		} finally {
			setExporting(false);
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 className="font-semibold text-lg">Affiliate partners</h2>
					<p className="text-muted-foreground text-sm">
						Manage partner profiles, referral links, and attributed users.
					</p>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						disabled={exporting}
						onClick={() => void exportCsv()}
					>
						{exporting ? (
							<Loader2Icon className="animate-spin" />
						) : (
							<DownloadIcon />
						)}
						{exporting ? "Exporting…" : "Export CSV"}
					</Button>
					<Button type="button" onClick={() => setCreateOpen(true)}>
						<PlusIcon />
						Create affiliate
					</Button>
				</div>
			</div>

			{affiliatesQuery.data ? (
				<AffiliatesSummaryStrip summary={affiliatesQuery.data.summary} />
			) : null}

			<div className="flex flex-col gap-2 rounded-lg border bg-background p-3 lg:flex-row">
				<Input
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setPage(1);
					}}
					placeholder="Search name or email..."
					className="lg:max-w-xs"
				/>
				<Select
					value={status}
					onValueChange={(value) => {
						setStatus(value as AffiliateStatus | "all");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full lg:w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="paused">Paused</SelectItem>
					</SelectContent>
				</Select>
				<Input
					value={programSearch}
					onChange={(event) => {
						setProgramSearch(event.target.value);
						setProgramId("all");
						setPage(1);
					}}
					placeholder="Find program..."
					className="lg:w-48"
				/>
				<Select
					value={programId}
					onValueChange={(value) => {
						setProgramId(value);
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full lg:w-56">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All programs</SelectItem>
						{programsQuery.data?.items.map((item) => (
							<SelectItem key={item.program.id} value={item.program.id}>
								{item.program.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={sort}
					onValueChange={(value) => {
						setSort(value as ListAffiliatesQuery["sort"]);
						setPage(1);
					}}
				>
					<SelectTrigger className="w-full lg:w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="newest">Newest first</SelectItem>
						<SelectItem value="oldest">Oldest first</SelectItem>
						<SelectItem value="name">Name</SelectItem>
						<SelectItem value="email">Email</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{affiliatesQuery.isPending ? (
				<AffiliateTableLoading columns={14} />
			) : affiliatesQuery.isError || !affiliatesQuery.data ? (
				<AffiliateSectionMessage
					title="Affiliates could not be loaded"
					description={errorMessage(
						affiliatesQuery.error,
						"Retry the request to restore partner management.",
					)}
					action={
						<Button
							type="button"
							onClick={() => void affiliatesQuery.refetch()}
						>
							<RefreshCwIcon />
							Retry
						</Button>
					}
				/>
			) : rows.length === 0 ? (
				<AffiliateSectionMessage
					title="No affiliates found"
					description="Create a partner or clear the filters to see affiliates."
					action={
						<Button type="button" onClick={() => setCreateOpen(true)}>
							<PlusIcon />
							Create affiliate
						</Button>
					}
				/>
			) : (
				<div className="overflow-hidden rounded-lg border bg-background">
					<div className="overflow-x-auto">
						<Table className="min-w-[1680px]">
							<TableHeader>
								<TableRow>
									<TableHead>Affiliate</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Links</TableHead>
									<TableHead>Traffic</TableHead>
									<TableHead>Conversions</TableHead>
									<TableHead>
										<AffiliateTableHeading
											label="Healthy trials"
											tooltip="Attributed free users at least seven days old who consumed at least 20 credits and completed at least two successful generations in their first seven days."
										/>
									</TableHead>
									<TableHead>
										<AffiliateTableHeading
											label="Churned"
											tooltip="Attributed customers whose subscription ended and who have no live subscription at the current snapshot."
										/>
									</TableHead>
									<TableHead>
										<AffiliateTableHeading
											label="Referred MRR"
											tooltip="Current monthly list-price value of live subscriptions referred by this affiliate. Annual plans are divided by 12."
										/>
									</TableHead>
									<TableHead>
										<AffiliateTableHeading
											label="Referred LTV"
											tooltip="Approximate — small samples. Referred ARPU divided by estimated monthly churn; a dash means there is not enough churn history to calculate it."
										/>
									</TableHead>
									<TableHead>Revenue</TableHead>
									<TableHead>Balance</TableHead>
									<TableHead>Payout</TableHead>
									<TableHead>Last conversion</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<AffiliateRow
										key={row.id}
										row={row}
										onOpen={() => setSelectedAffiliateId(row.id)}
									/>
								))}
							</TableBody>
						</Table>
					</div>
					<PaginationControls
						page={affiliatesQuery.data.page}
						pageSize={affiliatesQuery.data.pageSize}
						total={affiliatesQuery.data.total}
						onPageChange={setPage}
					/>
				</div>
			)}

			<AffiliateEditorDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onSaved={setSelectedAffiliateId}
			/>
			<AffiliateDetailSheet
				affiliateId={selectedAffiliateId}
				open={Boolean(selectedAffiliateId)}
				onOpenChange={(next) => {
					if (!next) {
						setSelectedAffiliateId(null);
					}
				}}
			/>
		</div>
	);
}

function AffiliateRow({
	row,
	onOpen,
}: {
	row: AffiliateTableRow;
	onOpen: () => void;
}) {
	const mutation = useUpdateAffiliateMutation();
	const nextStatus = row.status === "active" ? "paused" : "active";

	async function changeStatus() {
		try {
			await mutation.mutateAsync({
				affiliateId: row.id,
				data: { status: nextStatus },
			});
			toast.success(
				nextStatus === "active"
					? `${row.name} is active.`
					: `${row.name} was paused.`,
			);
		} catch (error) {
			toast.error(
				errorMessage(error, "The affiliate status could not be changed."),
			);
		}
	}

	return (
		<TableRow>
			<TableCell>
				<button
					type="button"
					className="text-left hover:underline"
					onClick={onOpen}
				>
					<span className="block font-medium">{row.name}</span>
					<span className="block text-muted-foreground text-xs">
						{row.email}
					</span>
				</button>
				<p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
					{row.company ? `${row.company} · ` : ""}
					{row.id}
				</p>
			</TableCell>
			<TableCell>
				<AffiliateStatusBadge status={row.status} />
			</TableCell>
			<TableCell>
				<p>{formatAffiliateNumber(row.activeLinkCount)} active</p>
				<p className="text-muted-foreground text-xs">
					{formatAffiliateNumber(row.linkCount)} total
				</p>
			</TableCell>
			<TableCell>
				<p>{formatAffiliateNumber(row.uniqueVisitorCount)} visitors</p>
				<p className="text-muted-foreground text-xs">
					{formatAffiliateNumber(row.clickCount)} clicks
				</p>
			</TableCell>
			<TableCell>
				<p>{formatAffiliateNumber(row.attributedUserCount)} users</p>
				<p className="text-muted-foreground text-xs">
					{formatAffiliateNumber(row.paidCustomerCount)} paid ·{" "}
					{formatAffiliateNumber(row.paidInvoiceCount)} invoices
				</p>
			</TableCell>
			<TableCell>{formatAffiliateNumber(row.healthyTrials)}</TableCell>
			<TableCell>{formatAffiliateNumber(row.churnedCustomers)}</TableCell>
			<TableCell>{formatAffiliateMoney(row.referredMrrCents, "usd")}</TableCell>
			<TableCell>
				{formatNullableAffiliateMoney(row.referredLtvCents, "usd")}
			</TableCell>
			<TableCell>
				<CurrencyValues
					currencies={row.currencies}
					metric="attributedRevenueCents"
				/>
			</TableCell>
			<TableCell>
				<CurrencyValues currencies={row.currencies} metric="balanceCents" />
			</TableCell>
			<TableCell>
				<p>{titleCaseAffiliateValue(row.payoutMethod)}</p>
				<p className="text-muted-foreground text-xs">
					{row.channel ?? row.country ?? "No channel"}
				</p>
			</TableCell>
			<TableCell>{formatAffiliateDateTime(row.lastConversionAt)}</TableCell>
			<TableCell>
				<div className="flex justify-end gap-1">
					<Button type="button" variant="outline" size="sm" onClick={onOpen}>
						Manage
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={mutation.isPending}
						onClick={() => void changeStatus()}
					>
						{mutation.isPending ? (
							<Loader2Icon className="animate-spin" />
						) : nextStatus === "active" ? (
							<CirclePlayIcon />
						) : (
							<CirclePauseIcon />
						)}
						<span className="sr-only">
							{nextStatus === "active" ? "Activate" : "Pause"} {row.name}
						</span>
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}

function AffiliateTableHeading({
	label,
	tooltip,
}: {
	label: string;
	tooltip: string;
}) {
	return (
		<div className="flex items-center gap-1">
			<span>{label}</span>
			<MetricInfoTooltip label={label} content={tooltip} />
		</div>
	);
}

function AffiliatesSummaryStrip({ summary }: { summary: AffiliatesSummary }) {
	const cards = [
		{
			label: "Affiliate partners",
			value: formatAffiliateNumber(summary.affiliateCount),
			detail: `${formatAffiliateNumber(summary.activeAffiliateCount)} active`,
		},
		{
			label: "Referral links",
			value: formatAffiliateNumber(summary.linkCount),
			detail: `${formatAffiliateNumber(summary.activeLinkCount)} active`,
		},
		{
			label: "Attributed users",
			value: formatAffiliateNumber(summary.attributedUserCount),
			detail: `${formatAffiliateNumber(summary.paidCustomerCount)} paid customers`,
		},
		{
			label: "Paid invoices",
			value: formatAffiliateNumber(summary.paidInvoiceCount),
			detail: `${formatAffiliateNumber(summary.clickCount)} clicks`,
		},
	] as const;
	return (
		<div className="overflow-hidden rounded-xl border bg-border">
			<div className="grid gap-px sm:grid-cols-2 xl:grid-cols-6">
				{cards.map((card) => (
					<div key={card.label} className="bg-background p-4">
						<p className="text-muted-foreground text-xs">{card.label}</p>
						<p className="mt-1 font-semibold text-xl tabular-nums">
							{card.value}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">{card.detail}</p>
					</div>
				))}
				<div className="bg-background p-4">
					<p className="text-muted-foreground text-xs">Attributed revenue</p>
					<div className="mt-2">
						<CurrencyValues
							currencies={summary.currencies}
							metric="attributedRevenueCents"
							compact
						/>
					</div>
				</div>
				<div className="bg-background p-4">
					<p className="text-muted-foreground text-xs">Commission balance</p>
					<div className="mt-2">
						<CurrencyValues
							currencies={summary.currencies}
							metric="balanceCents"
							compact
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
