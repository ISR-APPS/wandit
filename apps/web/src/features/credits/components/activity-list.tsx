import type {
	CreditActivityItem,
	CreditActivityOperation,
} from "@wandit/contracts";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	CircleMinus,
	CreditCard,
	FileText,
	Gift,
	Hourglass,
	Image,
	type LucideIcon,
	Megaphone,
	MessageSquare,
	Mic,
	Plug,
	Scale,
	Users,
	Video,
	Zap,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { formatCreditDelta } from "../lib/format-credits";

const OPERATION_ICONS: Record<CreditActivityOperation, LucideIcon> = {
	chat: MessageSquare,
	page_build: FileText,
	image: Image,
	video: Video,
	marketing: Megaphone,
	connector: Plug,
	lead_scrape: Users,
	transcription: Mic,
	topup_adjust: Scale,
};

const LEDGER_ICONS: Record<
	NonNullable<CreditActivityItem["ledgerKind"]>,
	LucideIcon
> = {
	grant: Gift,
	consume: Zap,
	topup: CreditCard,
	expire: Hourglass,
	revoke: CircleMinus,
};

const SKELETON_KEYS = ["one", "two", "three", "four", "five"];

type ActivityListProps = {
	items: readonly CreditActivityItem[];
	isError?: boolean;
	isPending?: boolean;
	compact?: boolean;
	className?: string;
};

function rowIcon(item: CreditActivityItem): LucideIcon {
	if (item.kind === "usage" && item.operation) {
		return OPERATION_ICONS[item.operation];
	}
	return item.ledgerKind ? LEDGER_ICONS[item.ledgerKind] : Zap;
}

export function ActivityList({
	items,
	isError = false,
	isPending = false,
	compact = false,
	className,
}: ActivityListProps) {
	const { locale, t } = useTranslation();

	if (isPending) {
		return (
			<div className={cn("flex flex-col", className)} aria-hidden>
				{SKELETON_KEYS.slice(0, compact ? 3 : 5).map((key) => (
					<div key={key} className="flex items-center gap-3 px-2 py-2">
						<Skeleton className="size-7 shrink-0 rounded-full" />
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton className="h-3 w-28" />
							<Skeleton className="h-2.5 w-16" />
						</div>
						<Skeleton className="h-3 w-10" />
					</div>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p
				role="alert"
				className={cn("px-2 py-3 text-muted-foreground text-xs", className)}
			>
				{t("credits.activityLoadError")}
			</p>
		);
	}

	if (items.length === 0) {
		return (
			<p className={cn("px-2 py-3 text-muted-foreground text-xs", className)}>
				{t("credits.emptyActivity")}
			</p>
		);
	}

	return (
		<ul className={cn("flex flex-col divide-y divide-border/65", className)}>
			{items.map((item) => {
				const Icon = rowIcon(item);
				const inProgress = item.status === "in_progress";
				const credits = inProgress ? null : (item.credits ?? 0);
				const positive = credits !== null && credits > 0;
				const label =
					item.kind === "usage" && item.operation
						? t(`credits.activityOperations.${item.operation}`)
						: item.ledgerKind
							? t(`credits.ledgerKinds.${item.ledgerKind}`)
							: t("credits.activityOperations.topup_adjust");

				return (
					<li
						key={item.id}
						className={cn(
							"flex items-center gap-3 px-2",
							compact ? "py-2" : "py-3",
						)}
					>
						<span
							className={cn(
								"grid size-7 shrink-0 place-items-center rounded-full border",
								positive
									? "border-success/25 bg-success/8 text-success"
									: "border-border bg-muted/55 text-muted-foreground",
							)}
						>
							<Icon className="size-3.5" aria-hidden />
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-xs">{label}</p>
							<p className="mt-0.5 text-[10px] text-muted-foreground">
								{item.status === "refunded"
									? `${t("credits.activityStatus.refunded")} · `
									: null}
								{relativeTime(item.createdAt)}
							</p>
						</div>
						{credits === null ? (
							<span className="shrink-0 text-[10px] text-muted-foreground">
								{t("credits.activityStatus.inProgress")}
							</span>
						) : (
							<span
								dir="ltr"
								className={cn(
									"shrink-0 font-mono text-xs tabular-nums",
									positive ? "text-success" : "text-muted-foreground",
								)}
							>
								{formatCreditDelta(credits, locale)}
							</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}
