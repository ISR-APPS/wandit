/**
 * The credit activity list: one row per credit event, with an icon per
 * operation (`OPERATION_ICONS`) and a translated label. The billing page and
 * the credits chip render it and pass the activity items of the credits API.
 */
import type { Icon } from "@phosphor-icons/react";
import { ChatCircleIcon } from "@phosphor-icons/react/ChatCircle";
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { FileTextIcon } from "@phosphor-icons/react/FileText";
import { GiftIcon } from "@phosphor-icons/react/Gift";
import { HardDrivesIcon } from "@phosphor-icons/react/HardDrives";
import { HourglassIcon } from "@phosphor-icons/react/Hourglass";
import { ImageIcon } from "@phosphor-icons/react/Image";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone";
import { MicrophoneIcon } from "@phosphor-icons/react/Microphone";
import { MinusCircleIcon } from "@phosphor-icons/react/MinusCircle";
import { PlugsIcon } from "@phosphor-icons/react/Plugs";
import { RobotIcon } from "@phosphor-icons/react/Robot";
import { ScalesIcon } from "@phosphor-icons/react/Scales";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import { VideoCameraIcon } from "@phosphor-icons/react/VideoCamera";
import type {
	CreditActivityItem,
	CreditActivityOperation,
} from "@wandit/contracts";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { formatCreditDelta } from "../lib/format-credits";

const OPERATION_ICONS: Record<CreditActivityOperation, Icon> = {
	chat: ChatCircleIcon,
	page_build: FileTextIcon,
	image: ImageIcon,
	video: VideoCameraIcon,
	marketing: MegaphoneIcon,
	connector: PlugsIcon,
	lead_scrape: UsersThreeIcon,
	transcription: MicrophoneIcon,
	agent_session: RobotIcon,
	sandbox: HardDrivesIcon,
	mobile_build: DeviceMobileIcon,
	mobile_preview: DeviceMobileIcon,
	topup_adjust: ScalesIcon,
};

const LEDGER_ICONS: Record<
	NonNullable<CreditActivityItem["ledgerKind"]>,
	Icon
> = {
	grant: GiftIcon,
	consume: LightningIcon,
	topup: CreditCardIcon,
	expire: HourglassIcon,
	revoke: MinusCircleIcon,
};

const SKELETON_KEYS = ["one", "two", "three", "four", "five"];

type ActivityListProps = {
	items: readonly CreditActivityItem[];
	isError?: boolean;
	isPending?: boolean;
	compact?: boolean;
	className?: string;
};

function rowIcon(item: CreditActivityItem): Icon {
	if (item.kind === "usage" && item.operation) {
		return OPERATION_ICONS[item.operation];
	}
	return item.ledgerKind ? LEDGER_ICONS[item.ledgerKind] : LightningIcon;
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
						<Skeleton className="size-8 shrink-0 rounded-full" />
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
								"grid size-8 shrink-0 place-items-center rounded-full",
								positive
									? "bg-success/10 text-success"
									: "bg-muted text-muted-foreground",
							)}
						>
							<Icon aria-hidden weight="duotone" className="size-4" />
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate font-grotesk font-medium text-sm leading-tight">
								{label}
							</p>
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								{item.status === "refunded"
									? `${t("credits.activityStatus.refunded")} · `
									: null}
								{relativeTime(item.createdAt)}
							</p>
						</div>
						{credits === null ? (
							<span className="shrink-0 text-[11px] text-muted-foreground">
								{t("credits.activityStatus.inProgress")}
							</span>
						) : (
							<span
								dir="ltr"
								className={cn(
									"shrink-0 font-grotesk font-semibold text-sm tabular-nums",
									positive && "text-success",
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
