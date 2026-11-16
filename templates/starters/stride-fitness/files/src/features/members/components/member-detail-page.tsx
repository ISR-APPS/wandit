// The page of one member: the name and status, the membership facts, the attendance, the visits,
// the classes booked ahead, and the note of the front desk.
// The /app/members/$memberId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { MemberAvatar, MemberStatusBadge, useNow } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { memberQueryOptions } from "../api/members.queries";
import { MemberAttendanceCard } from "./member-attendance-card";
import { MemberFactsCard } from "./member-facts-card";
import { MemberUpcomingCard } from "./member-upcoming-card";
import { MemberVisitsCard } from "./member-visits-card";

type MemberDetailPageProps = {
	/** The `$memberId` param of the URL. The query returns null for an unknown id. */
	memberId: string;
};

/** A 2/3 main column and a 1/3 rail from the 4xl container width. One column puts the visits last. */
export function MemberDetailPage({ memberId }: MemberDetailPageProps) {
	const { t } = useT();
	const now = useNow();
	const { data: detail } = useSuspenseQuery(memberQueryOptions(memberId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/members">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("members.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("members.notFound")}</p>
			</div>
		);
	}
	const { member } = detail;

	return (
		<div className="grid gap-6">
			{backLink}
			<div className="flex items-center gap-4">
				<MemberAvatar name={member.fullName} className="size-14 text-base" />
				<div className="min-w-0 flex-1">
					<PageHeader
						title={member.fullName}
						description={
							<span className="flex flex-wrap items-center gap-2">
								<MemberStatusBadge status={member.status} />
								<span>{detail.plan.name}</span>
							</span>
						}
					/>
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				{/* One column shows the membership, then the rail, then the long visits table.
				    `contents` lets the two cards of this column take their own place in that order. */}
				<div className="@4xl/main:col-span-2 @4xl/main:grid contents gap-6">
					<MemberFactsCard detail={detail} now={now} />
					<MemberVisitsCard
						visits={detail.visits}
						now={now}
						className="@4xl/main:order-none order-last"
					/>
				</div>
				{/* The rail is shorter than the visits table, so it stays in view during the scroll. */}
				<div className="@4xl/main:sticky @4xl/main:top-6 grid gap-6">
					<MemberAttendanceCard
						weeks={detail.attendance}
						visitsInWindow={detail.visitsInWindow}
						usualPerWeek={member.weeklyVisits}
					/>
					<MemberUpcomingCard sessions={detail.upcoming} />
					<Card>
						<CardHeader>
							<CardTitle>{t("members.note")}</CardTitle>
						</CardHeader>
						<CardContent>
							<p
								className={
									member.note ? "text-sm" : "text-muted-foreground text-sm"
								}
							>
								{member.note ?? t("members.noNote")}
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function MemberDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="flex items-center gap-4">
				<Skeleton className="size-14" />
				<div className="grid gap-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-5 w-40" />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-56" />
					<Skeleton className="h-96" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-80" />
					<Skeleton className="h-48" />
				</div>
			</div>
		</div>
	);
}
