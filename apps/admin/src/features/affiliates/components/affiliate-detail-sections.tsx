import type { AffiliateDetail, AffiliateLinkListItem } from "@wandit/contracts";
import {
	CirclePauseIcon,
	CirclePlayIcon,
	CopyIcon,
	Loader2Icon,
	PencilIcon,
} from "lucide-react";
import { toast } from "sonner";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import {
	formatAffiliateDateTime,
	formatAffiliateMoney,
	formatAffiliateNumber,
	formatNullableAffiliateMoney,
	titleCaseAffiliateValue,
} from "../lib/formatters";
import { AffiliateStatusBadge } from "./affiliate-ui";

export function AffiliateDetailHeader({
	detail,
	statusPending,
	onEdit,
	onChangeStatus,
}: {
	detail: AffiliateDetail;
	statusPending: boolean;
	onEdit: () => void;
	onChangeStatus: () => void;
}) {
	const canManage = useAdminPermission({ affiliates: ["manage"] });

	return (
		<SheetHeader className="border-b px-5 py-5 pr-14 sm:px-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<SheetTitle className="truncate">
							{detail.affiliate.name}
						</SheetTitle>
						<AffiliateStatusBadge status={detail.affiliate.status} />
						<PortalAccessBadge enabled={Boolean(detail.affiliate.userId)} />
					</div>
					<SheetDescription className="mt-1">
						{detail.affiliate.email}
						{detail.affiliate.company ? ` · ${detail.affiliate.company}` : ""}
					</SheetDescription>
					<p className="mt-1 text-muted-foreground text-xs">
						Linked user: {linkedUserLabel(detail)}
					</p>
					<p className="mt-1 font-mono text-[10px] text-muted-foreground">
						{detail.affiliate.id}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							void copyText(detail.affiliate.id, "Affiliate ID copied.")
						}
					>
						<CopyIcon />
						Copy ID
					</Button>
					{canManage ? (
						<Button type="button" variant="outline" size="sm" onClick={onEdit}>
							<PencilIcon />
							Edit
						</Button>
					) : null}
					{canManage ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={statusPending}
							onClick={onChangeStatus}
						>
							{statusPending ? (
								<Loader2Icon className="animate-spin" />
							) : detail.affiliate.status === "active" ? (
								<CirclePauseIcon />
							) : (
								<CirclePlayIcon />
							)}
							{detail.affiliate.status === "active" ? "Pause" : "Activate"}
						</Button>
					) : null}
				</div>
			</div>
		</SheetHeader>
	);
}

export function AffiliateMetrics({ detail }: { detail: AffiliateDetail }) {
	const metrics = [
		{
			label: "Clicks",
			value: formatAffiliateNumber(detail.aggregates.clickCount),
		},
		{
			label: "Visitors",
			value: formatAffiliateNumber(detail.aggregates.uniqueVisitorCount),
		},
		{
			label: "Attributed users",
			value: formatAffiliateNumber(detail.aggregates.attributedUserCount),
		},
		{
			label: "Paid customers",
			value: formatAffiliateNumber(detail.aggregates.paidCustomerCount),
		},
		{
			label: "Paid invoices",
			value: formatAffiliateNumber(detail.aggregates.paidInvoiceCount),
		},
		{
			label: "Healthy trials",
			value: formatAffiliateNumber(detail.aggregates.healthyTrials),
			tooltip:
				"Attributed free users at least seven days old who consumed at least 20 credits and completed at least two successful generations in their first seven days.",
		},
		{
			label: "Churned",
			value: formatAffiliateNumber(detail.aggregates.churnedCustomers),
			tooltip:
				"Attributed customers whose subscription ended and who have no live subscription at the current snapshot.",
		},
		{
			label: "Referred MRR",
			value: formatAffiliateMoney(detail.aggregates.referredMrrCents, "usd"),
			tooltip:
				"Current monthly list-price value of live subscriptions referred by this affiliate. Annual plans are divided by 12.",
		},
		{
			label: "Referred LTV",
			value: formatNullableAffiliateMoney(
				detail.aggregates.referredLtvCents,
				"usd",
			),
			tooltip:
				"Approximate — small samples. Referred ARPU divided by estimated monthly churn; a dash means there is not enough churn history to calculate it.",
		},
	] as const;
	return (
		<div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-3">
			{metrics.map((metric) => (
				<div key={metric.label} className="bg-background px-5 py-3">
					<p className="flex items-center gap-1 text-muted-foreground text-xs">
						{metric.label}
						{"tooltip" in metric ? (
							<MetricInfoTooltip
								label={metric.label}
								content={metric.tooltip}
							/>
						) : null}
					</p>
					<p className="mt-1 font-mono font-semibold tabular-nums">
						{metric.value}
					</p>
				</div>
			))}
		</div>
	);
}

export function PartnerDetails({ detail }: { detail: AffiliateDetail }) {
	const details = [
		["Payout method", titleCaseAffiliateValue(detail.affiliate.payoutMethod)],
		["Channel", detail.affiliate.channel ?? "Not set"],
		["Country", detail.affiliate.country ?? "Not set"],
		["Linked user", linkedUserLabel(detail)],
		["Created", formatAffiliateDateTime(detail.affiliate.createdAt)],
		["Last updated", formatAffiliateDateTime(detail.affiliate.updatedAt)],
	];
	return (
		<div className="space-y-6">
			<div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
				{details.map(([label, value]) => (
					<div key={label}>
						<p className="text-muted-foreground text-xs">{label}</p>
						<p className="mt-1 break-all text-sm">{value}</p>
					</div>
				))}
				<div>
					<p className="text-muted-foreground text-xs">Portal access</p>
					<div className="mt-1">
						<PortalAccessBadge enabled={Boolean(detail.affiliate.userId)} />
					</div>
				</div>
			</div>
			<div>
				<h3 className="font-semibold text-sm">Payout details</h3>
				<pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/20 p-4 text-xs">
					{detail.payoutDetails
						? JSON.stringify(detail.payoutDetails, null, 2)
						: "No payout details"}
				</pre>
			</div>
			<div>
				<h3 className="font-semibold text-sm">Internal notes</h3>
				<p className="mt-2 whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-muted-foreground text-sm">
					{detail.notes ?? "No internal notes."}
				</p>
			</div>
		</div>
	);
}

export function AffiliateDetailSkeleton() {
	return (
		<div className="space-y-3 p-6">
			{detailSkeletonKeys.map((key) => (
				<Skeleton key={key} className="h-12 w-full" />
			))}
		</div>
	);
}

export function DeactivateAffiliateLinkDialog({
	link,
	pending,
	onOpenChange,
	onConfirm,
}: {
	link: AffiliateLinkListItem | null;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog open={Boolean(link)} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Deactivate this referral link?</AlertDialogTitle>
					<AlertDialogDescription>
						{link?.link.code} will stop accepting new clicks and attributions.
						Existing ledger records remain intact.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={pending}
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
					>
						{pending ? "Deactivating…" : "Deactivate link"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

const detailSkeletonKeys = ["identity", "traffic", "users", "revenue", "links"];

function PortalAccessBadge({ enabled }: { enabled: boolean }) {
	return (
		<Badge
			variant="outline"
			className={
				enabled
					? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
					: "text-muted-foreground"
			}
		>
			Portal access: {enabled ? "On" : "Off"}
		</Badge>
	);
}

function linkedUserLabel(detail: AffiliateDetail) {
	return detail.linkedUser
		? `${detail.linkedUser.name} · ${detail.linkedUser.email}`
		: "No linked account";
}

async function copyText(value: string, success: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(success);
	} catch {
		toast.error("The value could not be copied.");
	}
}
