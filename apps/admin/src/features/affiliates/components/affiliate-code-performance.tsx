import {
	CirclePauseIcon,
	CirclePlayIcon,
	CopyIcon,
	EllipsisIcon,
	LinkIcon,
	PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	Affiliate,
	AffiliateCode,
} from "@/features/affiliates/api/affiliates.dto";
import { useSetAffiliateCodeStatusMutation } from "@/features/affiliates/api/affiliates.mutations";
import {
	formatAffiliateCompactNumber,
	formatAffiliateCurrency,
	formatAffiliateDate,
	formatAffiliateNumber,
	formatAffiliatePercent,
} from "@/features/affiliates/lib/formatters";

import { AffiliateCodeStatusBadge } from "./table/affiliate-table-cells";

type AffiliateCodePerformanceProps = {
	affiliate: Affiliate;
	onAddCode: () => void;
};

function AffiliateCodePerformance({
	affiliate,
	onAddCode,
}: AffiliateCodePerformanceProps) {
	if (affiliate.codes.length === 0) {
		return (
			<Empty className="min-h-72 border-0">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<LinkIcon />
					</EmptyMedia>
					<EmptyTitle>No referral codes yet</EmptyTitle>
					<EmptyDescription>
						Create the first code to start attributing visits, signups, and
						revenue to this partner.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button type="button" size="sm" onClick={onAddCode}>
						<PlusIcon />
						Add first code
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<>
			<div className="space-y-3 md:hidden">
				{affiliate.codes.map((code) => (
					<CodeMobileCard
						key={code.id}
						affiliateId={affiliate.id}
						code={code}
					/>
				))}
			</div>

			<div className="hidden overflow-hidden rounded-lg border md:block">
				<Table className="min-w-[840px]">
					<TableHeader>
						<TableRow>
							<TableHead className="w-[230px] px-4">Code</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Traffic</TableHead>
							<TableHead>Signups</TableHead>
							<TableHead>Paid</TableHead>
							<TableHead>Revenue</TableHead>
							<TableHead>Commission</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{affiliate.codes.map((code) => (
							<TableRow key={code.id}>
								<TableCell className="px-4 py-3">
									<CodeIdentity code={code} />
								</TableCell>
								<TableCell>
									<AffiliateCodeStatusBadge status={code.status} />
								</TableCell>
								<TableCell>
									<p className="font-medium font-mono tabular-nums">
										{formatAffiliateCompactNumber(
											code.performance.uniqueVisitors,
										)}
									</p>
									<p className="text-muted-foreground text-xs">
										{formatAffiliateCompactNumber(code.performance.clicks)}{" "}
										clicks
									</p>
								</TableCell>
								<TableCell>
									<p className="font-medium font-mono tabular-nums">
										{formatAffiliateNumber(code.performance.signups)}
									</p>
									<p className="text-muted-foreground text-xs">
										{formatAffiliatePercent(
											getRate(
												code.performance.signups,
												code.performance.uniqueVisitors,
											),
										)}{" "}
										of visitors
									</p>
								</TableCell>
								<TableCell>
									<p className="font-medium font-mono tabular-nums">
										{formatAffiliateNumber(code.performance.paidConversions)}
									</p>
									<p className="text-muted-foreground text-xs">
										{formatAffiliatePercent(
											getRate(
												code.performance.paidConversions,
												code.performance.signups,
											),
										)}{" "}
										of signups
									</p>
								</TableCell>
								<TableCell>
									<p className="font-medium font-mono tabular-nums">
										{formatAffiliateCurrency(code.performance.revenueUsdMinor)}
									</p>
									<p className="text-muted-foreground text-xs">reporting USD</p>
								</TableCell>
								<TableCell>
									<p className="font-medium font-mono tabular-nums">
										{formatAffiliateCurrency(
											code.performance.commissionUsdMinor,
										)}
									</p>
									<p className="text-muted-foreground text-xs">
										{formatAffiliatePercent(
											code.commissionRatePercent,
											code.commissionRatePercent % 1 === 0 ? 0 : 1,
										)}{" "}
										rate
									</p>
								</TableCell>
								<TableCell>
									<CodeActions affiliateId={affiliate.id} code={code} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</>
	);
}

function CodeIdentity({ code }: { code: AffiliateCode }) {
	async function copyCode() {
		await copyToClipboard(code.code, `${code.code} copied.`);
	}

	return (
		<div className="min-w-0">
			<div className="flex items-center gap-1.5">
				<Badge
					variant="outline"
					className="max-w-[150px] rounded-md bg-muted/45 font-mono"
				>
					<span className="truncate">{code.code}</span>
				</Badge>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					title={`Copy ${code.code}`}
					onClick={() => void copyCode()}
				>
					<CopyIcon />
					<span className="sr-only">Copy {code.code}</span>
				</Button>
			</div>
			<p className="mt-1 truncate font-medium text-xs">{code.label}</p>
			<p className="mt-0.5 max-w-[210px] truncate font-mono text-[10px] text-muted-foreground">
				{code.landingPath}?ref={code.code}
			</p>
		</div>
	);
}

function CodeMobileCard({
	affiliateId,
	code,
}: {
	affiliateId: string;
	code: AffiliateCode;
}) {
	return (
		<article className="overflow-hidden rounded-lg border">
			<div className="flex items-start justify-between gap-3 border-b p-3">
				<CodeIdentity code={code} />
				<div className="flex items-center gap-1">
					<AffiliateCodeStatusBadge status={code.status} />
					<CodeActions affiliateId={affiliateId} code={code} />
				</div>
			</div>
			<div className="grid grid-cols-2 divide-x border-b">
				<CodeDatum label="Unique visitors">
					{formatAffiliateCompactNumber(code.performance.uniqueVisitors)}
				</CodeDatum>
				<CodeDatum label="Signups">
					{formatAffiliateNumber(code.performance.signups)}
				</CodeDatum>
			</div>
			<div className="grid grid-cols-2 divide-x border-b">
				<CodeDatum label="Paid conversions">
					{formatAffiliateNumber(code.performance.paidConversions)}
				</CodeDatum>
				<CodeDatum label="Revenue">
					{formatAffiliateCurrency(code.performance.revenueUsdMinor)}
				</CodeDatum>
			</div>
			<div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
				<span className="text-muted-foreground">
					{formatAffiliatePercent(
						code.commissionRatePercent,
						code.commissionRatePercent % 1 === 0 ? 0 : 1,
					)}{" "}
					commission
				</span>
				<span className="text-muted-foreground">
					Last conversion {formatAffiliateDate(code.lastConversionAt)}
				</span>
			</div>
		</article>
	);
}

function CodeDatum({ label, children }: { label: string; children: string }) {
	return (
		<div className="space-y-1 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-medium font-mono text-sm tabular-nums">{children}</p>
		</div>
	);
}

function CodeActions({
	affiliateId,
	code,
}: {
	affiliateId: string;
	code: AffiliateCode;
}) {
	const mutation = useSetAffiliateCodeStatusMutation();
	const nextStatus = code.status === "active" ? "paused" : "active";
	const canChangeStatus = code.status !== "expired";

	async function changeStatus() {
		try {
			await mutation.mutateAsync({
				affiliateId,
				codeId: code.id,
				status: nextStatus,
			});
			toast.success(
				`${code.code} is now ${nextStatus === "active" ? "active" : "paused"}.`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "The code status could not be changed.",
			);
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="icon-sm">
					<EllipsisIcon />
					<span className="sr-only">Actions for {code.code}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuGroup>
					<DropdownMenuItem
						onSelect={() => void copyToClipboard(code.code, "Code copied.")}
					>
						<CopyIcon />
						Copy code
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							void copyToClipboard(
								`https://wandit.ai${code.landingPath}?ref=${code.code}`,
								"Referral link copied.",
							)
						}
					>
						<LinkIcon />
						Copy referral link
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						disabled={!canChangeStatus || mutation.isPending}
						onSelect={() => void changeStatus()}
					>
						{nextStatus === "active" ? <CirclePlayIcon /> : <CirclePauseIcon />}
						{code.status === "expired"
							? "Expired code"
							: nextStatus === "active"
								? "Reactivate code"
								: "Pause code"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

async function copyToClipboard(value: string, successMessage: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(successMessage);
	} catch {
		toast.error("The value could not be copied.");
	}
}

function getRate(value: number, total: number) {
	return total > 0 ? (value / total) * 100 : 0;
}

export type { AffiliateCodePerformanceProps };
export { AffiliateCodePerformance };
