import { CircleIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
	Affiliate,
	AffiliateChannel,
	AffiliateCodeStatus,
	AffiliatePayoutMethod,
	AffiliateStatus,
} from "@/features/affiliates/api/affiliates.dto";
import {
	formatAffiliateNumber,
	formatAffiliatePercent,
	getAffiliateInitials,
	titleCaseAffiliateValue,
} from "@/features/affiliates/lib/formatters";
import { cn } from "@/lib/utils";

function AffiliateIdentity({
	affiliate,
	onOpen,
}: {
	affiliate: Affiliate;
	onOpen: () => void;
}) {
	return (
		<div className="flex w-full min-w-0 items-center gap-3">
			<Avatar size="lg" className="border">
				<AvatarImage src={affiliate.avatarUrl} alt="" />
				<AvatarFallback className="font-medium">
					{getAffiliateInitials(affiliate.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<Button
					type="button"
					variant="link"
					className="h-auto max-w-full justify-start p-0 font-medium text-foreground"
					onClick={onOpen}
				>
					<span className="truncate">{affiliate.name}</span>
				</Button>
				<p className="truncate text-muted-foreground text-xs">
					{affiliate.email}
				</p>
				<p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/75">
					{affiliate.company ? `${affiliate.company} · ` : ""}
					{affiliate.id}
				</p>
			</div>
		</div>
	);
}

const affiliateStatusClasses: Record<AffiliateStatus, string> = {
	active:
		"border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	paused: "border-border bg-muted/60 text-muted-foreground",
	pending:
		"border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
};

function AffiliateStatusBadge({ status }: { status: AffiliateStatus }) {
	return (
		<Badge
			variant="outline"
			className={cn("gap-1 capitalize", affiliateStatusClasses[status])}
		>
			<CircleIcon className="size-1.5 fill-current" />
			{status}
		</Badge>
	);
}

const affiliateCodeStatusClasses: Record<AffiliateCodeStatus, string> = {
	active:
		"border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	paused: "border-border bg-muted/60 text-muted-foreground",
	expired: "border-destructive/25 bg-destructive/8 text-destructive",
};

function AffiliateCodeStatusBadge({ status }: { status: AffiliateCodeStatus }) {
	return (
		<Badge
			variant="outline"
			className={cn("capitalize", affiliateCodeStatusClasses[status])}
		>
			{status}
		</Badge>
	);
}

const channelClasses: Record<AffiliateChannel, string> = {
	creator: "border-sky-500/25 bg-sky-500/8 text-sky-700 dark:text-sky-300",
	agency:
		"border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
	community:
		"border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	partner: "border-primary/25 bg-primary/8 text-primary",
};

function AffiliateChannelBadge({ channel }: { channel: AffiliateChannel }) {
	return (
		<Badge
			variant="outline"
			className={cn("capitalize", channelClasses[channel])}
		>
			{channel}
		</Badge>
	);
}

function AffiliateCodesCell({
	affiliate,
	onOpen,
}: {
	affiliate: Affiliate;
	onOpen: () => void;
}) {
	const activeCount = affiliate.codes.filter(
		(code) => code.status === "active",
	).length;
	const previewCodes = affiliate.codes.slice(0, 2);

	return (
		<Button
			type="button"
			variant="ghost"
			className="-mx-2 h-auto min-h-9 max-w-[230px] justify-start px-2 py-1 text-left"
			onClick={onOpen}
			aria-label={`Manage ${affiliate.codes.length} codes for ${affiliate.name}`}
		>
			<span className="min-w-0 space-y-1">
				<span className="flex min-w-0 items-center gap-1.5">
					{previewCodes.length > 0 ? (
						previewCodes.map((code) => (
							<Badge
								key={code.id}
								variant="outline"
								className="max-w-[82px] rounded-md bg-muted/45 font-mono font-normal"
							>
								<span className="truncate">{code.code}</span>
							</Badge>
						))
					) : (
						<span className="text-muted-foreground text-sm">No codes</span>
					)}
					{affiliate.codes.length > 2 ? (
						<span className="text-muted-foreground text-xs">
							+{affiliate.codes.length - 2}
						</span>
					) : null}
				</span>
				<span className="block text-[11px] text-muted-foreground">
					{activeCount} active · {affiliate.codes.length} total
				</span>
			</span>
		</Button>
	);
}

function AffiliateConversionCell({ affiliate }: { affiliate: Affiliate }) {
	const { paidConversions, signups } = affiliate.performance;
	const paidRate = signups > 0 ? (paidConversions / signups) * 100 : 0;

	return (
		<div>
			<p className="font-medium font-mono tabular-nums">
				{formatAffiliatePercent(paidRate)}
			</p>
			<p className="text-muted-foreground text-xs">
				{formatAffiliateNumber(paidConversions)} paid ·{" "}
				{formatAffiliateNumber(signups)} signups
			</p>
		</div>
	);
}

function AffiliatePayoutMethodCell({
	method,
}: {
	method: AffiliatePayoutMethod | null;
}) {
	if (!method) {
		return <span className="text-muted-foreground">Not set</span>;
	}

	return (
		<span className="inline-flex items-center gap-2 text-sm">
			<span className="size-1.5 rounded-full bg-foreground/55" />
			{titleCaseAffiliateValue(method)}
		</span>
	);
}

export {
	AffiliateChannelBadge,
	AffiliateCodeStatusBadge,
	AffiliateCodesCell,
	AffiliateConversionCell,
	AffiliateIdentity,
	AffiliatePayoutMethodCell,
	AffiliateStatusBadge,
};
