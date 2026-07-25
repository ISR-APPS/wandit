import {
	CirclePauseIcon,
	CirclePlayIcon,
	CopyIcon,
	HandshakeIcon,
	Loader2Icon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetAffiliateStatusMutation } from "@/features/affiliates/api/affiliates.mutations";
import { useAffiliateQuery } from "@/features/affiliates/api/affiliates.queries";
import {
	formatAffiliateCompactNumber,
	formatAffiliateCurrency,
	formatAffiliateDate,
	formatAffiliateNumber,
	formatAffiliatePercent,
	getAffiliateInitials,
	titleCaseAffiliateValue,
} from "@/features/affiliates/lib/formatters";

import { AffiliateCodePerformance } from "./affiliate-code-performance";
import { CreateAffiliateCodeDialog } from "./create-affiliate-code-dialog";
import {
	AffiliateChannelBadge,
	AffiliateStatusBadge,
} from "./table/affiliate-table-cells";

type AffiliateDetailSheetProps = {
	affiliateId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const detailMetricSkeletonKeys = [
	"visitors",
	"signups",
	"conversions",
	"revenue",
	"commission",
] as const;

function AffiliateDetailSheet({
	affiliateId,
	open,
	onOpenChange,
}: AffiliateDetailSheetProps) {
	const [codeDialogOpen, setCodeDialogOpen] = useState(false);
	const {
		data: affiliate,
		isError,
		isPending,
		refetch,
	} = useAffiliateQuery(affiliateId ?? undefined);
	const statusMutation = useSetAffiliateStatusMutation();

	async function copyAffiliateId() {
		if (!affiliate) {
			return;
		}

		try {
			await navigator.clipboard.writeText(affiliate.id);
			toast.success("Affiliate ID copied.");
		} catch {
			toast.error("The affiliate ID could not be copied.");
		}
	}

	async function changeStatus() {
		if (!affiliate) {
			return;
		}

		const nextStatus = affiliate.status === "active" ? "paused" : "active";

		try {
			await statusMutation.mutateAsync({
				affiliateId: affiliate.id,
				status: nextStatus,
			});
			toast.success(
				nextStatus === "active"
					? `${affiliate.name} is active.`
					: `${affiliate.name} has been paused.`,
			);
		} catch {
			toast.error("The affiliate status could not be changed.");
		}
	}

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent className="w-full gap-0 sm:max-w-[900px]">
					{isPending ? (
						<AffiliateDetailSkeleton />
					) : isError || !affiliate ? (
						<Empty className="m-auto min-h-[420px] border-0">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<HandshakeIcon />
								</EmptyMedia>
								<EmptyTitle>Affiliate could not be loaded</EmptyTitle>
								<EmptyDescription>
									Retry the mock request to restore this partner&apos;s
									performance.
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button
									type="button"
									variant="outline"
									onClick={() => void refetch()}
								>
									<RefreshCwIcon />
									Retry
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<>
							<SheetHeader className="border-b py-5 pr-16 pl-5 sm:pr-20 sm:pl-6">
								<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
									<div className="flex min-w-0 flex-1 items-center gap-3">
										<Avatar className="size-11 border">
											<AvatarImage src={affiliate.avatarUrl} alt="" />
											<AvatarFallback className="font-medium">
												{getAffiliateInitials(affiliate.name)}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<SheetTitle className="truncate text-lg">
													{affiliate.name}
												</SheetTitle>
												<AffiliateStatusBadge status={affiliate.status} />
												<AffiliateChannelBadge channel={affiliate.channel} />
											</div>
											<SheetDescription className="mt-1 truncate">
												{affiliate.email}
												{affiliate.company ? ` · ${affiliate.company}` : ""}
											</SheetDescription>
											<p className="mt-1 font-mono text-[10px] text-muted-foreground">
												{affiliate.id}
											</p>
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => void copyAffiliateId()}
										>
											<CopyIcon />
											Copy ID
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={statusMutation.isPending}
											onClick={() => void changeStatus()}
										>
											{statusMutation.isPending ? (
												<Loader2Icon className="animate-spin" />
											) : affiliate.status === "active" ? (
												<CirclePauseIcon />
											) : (
												<CirclePlayIcon />
											)}
											{affiliate.status === "active" ? "Pause" : "Activate"}
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={() => setCodeDialogOpen(true)}
										>
											<PlusIcon />
											Add code
										</Button>
									</div>
								</div>
							</SheetHeader>

							<div className="border-b bg-muted/15 px-5 py-4 sm:px-6">
								<AffiliateDetailMetrics affiliate={affiliate} />
							</div>

							<Tabs
								defaultValue="codes"
								className="min-h-0 flex-1 gap-0 overflow-hidden"
							>
								<div className="border-b px-5 sm:px-6">
									<TabsList variant="line" className="h-11">
										<TabsTrigger value="codes">
											Referral codes
											<span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px]">
												{affiliate.codes.length}
											</span>
										</TabsTrigger>
										<TabsTrigger value="program">Program details</TabsTrigger>
									</TabsList>
								</div>

								<TabsContent
									value="codes"
									className="min-h-0 overflow-y-auto p-5 sm:p-6"
								>
									<div className="mb-4 flex items-end justify-between gap-4">
										<div>
											<h2 className="font-semibold text-sm">
												Code performance
											</h2>
											<p className="mt-1 text-muted-foreground text-xs">
												Traffic, acquisition, and commission are attributed to
												one code at a time.
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setCodeDialogOpen(true)}
										>
											<PlusIcon />
											Add code
										</Button>
									</div>
									<AffiliateCodePerformance
										affiliate={affiliate}
										onAddCode={() => setCodeDialogOpen(true)}
									/>
								</TabsContent>

								<TabsContent
									value="program"
									className="min-h-0 overflow-y-auto p-5 sm:p-6"
								>
									<AffiliateProgramDetails affiliate={affiliate} />
								</TabsContent>
							</Tabs>
						</>
					)}
				</SheetContent>
			</Sheet>

			{affiliate ? (
				<CreateAffiliateCodeDialog
					affiliateId={affiliate.id}
					affiliateName={affiliate.name}
					defaultCommissionRatePercent={affiliate.defaultCommissionRatePercent}
					open={codeDialogOpen}
					onOpenChange={setCodeDialogOpen}
				/>
			) : null}
		</>
	);
}

function AffiliateDetailMetrics({
	affiliate,
}: {
	affiliate: NonNullable<ReturnType<typeof useAffiliateQuery>["data"]>;
}) {
	const items = [
		{
			label: "Unique visitors",
			value: formatAffiliateCompactNumber(affiliate.performance.uniqueVisitors),
		},
		{
			label: "Referred signups",
			value: formatAffiliateNumber(affiliate.performance.signups),
		},
		{
			label: "Paid conversions",
			value: formatAffiliateNumber(affiliate.performance.paidConversions),
		},
		{
			label: "Attributed revenue",
			value: formatAffiliateCurrency(affiliate.performance.revenueUsdMinor),
		},
		{
			label: "Commission due",
			value: formatAffiliateCurrency(
				affiliate.performance.pendingCommissionUsdMinor,
			),
		},
	];

	return (
		<div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-5">
			{items.map((item) => (
				<div key={item.label} className="min-w-0">
					<p className="truncate text-[11px] text-muted-foreground">
						{item.label}
					</p>
					<p className="mt-1 truncate font-mono font-semibold text-sm tabular-nums">
						{item.value}
					</p>
				</div>
			))}
		</div>
	);
}

function AffiliateProgramDetails({
	affiliate,
}: {
	affiliate: NonNullable<ReturnType<typeof useAffiliateQuery>["data"]>;
}) {
	const details = [
		{
			label: "Base commission",
			value: formatAffiliatePercent(
				affiliate.defaultCommissionRatePercent,
				affiliate.defaultCommissionRatePercent % 1 === 0 ? 0 : 1,
			),
		},
		{
			label: "Payout method",
			value: affiliate.payoutMethod
				? titleCaseAffiliateValue(affiliate.payoutMethod)
				: "Not set",
		},
		{
			label: "Payout email",
			value: affiliate.payoutEmail ?? "Not set",
		},
		{
			label: "Country",
			value: affiliate.country,
		},
		{
			label: "Joined",
			value: formatAffiliateDate(affiliate.joinedAt),
		},
		{
			label: "Last active",
			value: formatAffiliateDate(affiliate.lastActiveAt),
		},
		{
			label: "Linked user",
			value: affiliate.userId ?? "Standalone profile",
		},
		{
			label: "Commission paid",
			value: formatAffiliateCurrency(
				affiliate.performance.paidCommissionUsdMinor,
			),
		},
	];

	return (
		<div className="space-y-6">
			<div className="grid gap-x-8 gap-y-5 rounded-lg border p-4 sm:grid-cols-2">
				{details.map((detail) => (
					<div key={detail.label} className="min-w-0">
						<p className="text-muted-foreground text-xs">{detail.label}</p>
						<p className="mt-1 truncate font-medium text-sm">{detail.value}</p>
					</div>
				))}
			</div>

			<div>
				<h2 className="font-semibold text-sm">Internal notes</h2>
				<p className="mt-2 rounded-lg border bg-muted/20 p-4 text-muted-foreground text-sm leading-relaxed">
					{affiliate.notes ?? "No internal notes have been added."}
				</p>
			</div>
		</div>
	);
}

function AffiliateDetailSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex items-center gap-3 border-b p-6">
				<Skeleton className="size-11 rounded-full" />
				<div className="space-y-2">
					<Skeleton className="h-5 w-44" />
					<Skeleton className="h-3 w-60" />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-5 border-b p-6 sm:grid-cols-5">
				{detailMetricSkeletonKeys.map((key) => (
					<div key={key} className="space-y-2">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-5 w-16" />
					</div>
				))}
			</div>
			<div className="space-y-3 p-6">
				<Skeleton className="h-9 w-64" />
				<Skeleton className="h-14 w-full" />
				<Skeleton className="h-14 w-full" />
				<Skeleton className="h-14 w-full" />
				<Skeleton className="h-14 w-full" />
			</div>
		</div>
	);
}

export type { AffiliateDetailSheetProps };
export { AffiliateDetailSheet };
