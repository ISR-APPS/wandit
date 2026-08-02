import type { AffiliateDetail, AffiliateLinkListItem } from "@wandit/contracts";
import {
	CirclePauseIcon,
	CirclePlayIcon,
	CopyIcon,
	Loader2Icon,
	PencilIcon,
} from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	formatAffiliateDateTime,
	formatAffiliateNumber,
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
	return (
		<SheetHeader className="border-b px-5 py-5 pr-14 sm:px-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<SheetTitle className="truncate">
							{detail.affiliate.name}
						</SheetTitle>
						<AffiliateStatusBadge status={detail.affiliate.status} />
					</div>
					<SheetDescription className="mt-1">
						{detail.affiliate.email}
						{detail.affiliate.company ? ` · ${detail.affiliate.company}` : ""}
					</SheetDescription>
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
					<Button type="button" variant="outline" size="sm" onClick={onEdit}>
						<PencilIcon />
						Edit
					</Button>
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
				</div>
			</div>
		</SheetHeader>
	);
}

export function AffiliateMetrics({ detail }: { detail: AffiliateDetail }) {
	const metrics = [
		["Clicks", formatAffiliateNumber(detail.aggregates.clickCount)],
		["Visitors", formatAffiliateNumber(detail.aggregates.uniqueVisitorCount)],
		[
			"Attributed users",
			formatAffiliateNumber(detail.aggregates.attributedUserCount),
		],
		[
			"Paid customers",
			formatAffiliateNumber(detail.aggregates.paidCustomerCount),
		],
		[
			"Paid invoices",
			formatAffiliateNumber(detail.aggregates.paidInvoiceCount),
		],
	] as const;
	return (
		<div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-5">
			{metrics.map(([label, value]) => (
				<div key={label} className="bg-background px-5 py-3">
					<p className="text-muted-foreground text-xs">{label}</p>
					<p className="mt-1 font-mono font-semibold tabular-nums">{value}</p>
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
		["Linked user", detail.affiliate.userId ?? "Standalone profile"],
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

async function copyText(value: string, success: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(success);
	} catch {
		toast.error("The value could not be copied.");
	}
}
