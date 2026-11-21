// The stacked bar card of the last band: the share of engagements that start a conversation
// (comments, shares, saves) over six weeks, a stacked bar per week, and two rows with their change.
// OverviewPage renders it in 4 of 12 columns. It does not follow the period: it always shows six weeks.
import { ChatsCircleIcon, HeartIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { DeltaText, shareFormat } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { CaretDownIcon, CaretUpIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import type { OverviewData } from "../api/overview.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ConversationBars = lazy(() =>
	import("./conversation-bars").then((module) => ({
		default: module.ConversationBars,
	})),
);

type ConversationCardProps = {
	conversation: OverviewData["conversation"];
};

/** The change badge compares the share with the six weeks before. */
export function ConversationCard({ conversation }: ConversationCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const rows = [
		{
			id: "likes",
			icon: HeartIcon,
			label: t("overview.conversation.likes"),
			detail: t("overview.conversation.likesDetail"),
			change: conversation.likesChange,
		},
		{
			id: "conversations",
			icon: ChatsCircleIcon,
			label: t("overview.conversation.conversations"),
			detail: t("overview.conversation.conversationsDetail"),
			change: conversation.conversationsChange,
		},
	];
	const isUp = (conversation.change ?? 0) >= 0;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.conversation.label")}</CardDescription>
				{conversation.change === null ? null : (
					<CardAction>
						<Badge
							variant="outline"
							className={cn(isUp ? "text-success" : "text-destructive")}
						>
							{isUp ? <CaretUpIcon /> : <CaretDownIcon />}
							<bdi dir="ltr" className="tabular-nums">
								{percent.format(Math.abs(conversation.change))}
							</bdi>
							<span className="sr-only">
								{t("overview.conversation.vsPrevious")}
							</span>
						</Badge>
					</CardAction>
				)}
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{shareFormat(locale).format(conversation.share)}
				</p>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-36 w-full" />}>
					<ConversationBars
						weeks={conversation.weeks}
						likesLabel={t("overview.conversation.likes")}
						conversationsLabel={t("overview.conversation.conversations")}
					/>
				</Suspense>
				<ul className="mt-5 grid gap-4">
					{rows.map((row) => (
						<li key={row.id} className="flex items-center gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
								<row.icon className="size-4" />
							</span>
							<div className="grid min-w-0">
								<span className="truncate font-medium">{row.label}</span>
								<span className="truncate text-muted-foreground text-xs">
									{row.detail}
								</span>
							</div>
							<DeltaText change={row.change} className="ms-auto text-sm" />
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
