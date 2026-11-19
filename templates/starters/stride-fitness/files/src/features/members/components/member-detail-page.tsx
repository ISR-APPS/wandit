// The page of one member, in the anatomy of the kit profile page: a title row, the Overview and Visits tabs,
// then a side column (profile, week, classes) and a main column (timeline, payments, bookings).
// The /app/members/$memberId route renders it after its loader. An unknown id shows a not-found block.
import { ArrowLeftIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { copyToClipboard, MemberStatusBadge, useNow } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { memberQueryOptions } from "../api/members.queries";
import { MemberBookingsCard } from "./member-bookings-card";
import { MemberClassesCard } from "./member-classes-card";
import { MemberPaymentsCard } from "./member-payments-card";
import { MemberProfileCard } from "./member-profile-card";
import { MemberTimelineCard } from "./member-timeline-card";
import { MemberVisitsTable } from "./member-visits-table";
import { MemberWeekCard } from "./member-week-card";

type MemberDetailPageProps = {
	/** The `$memberId` param of the URL. The query returns null for an unknown id. */
	memberId: string;
};

/** A 1/3 side column and a 2/3 main column from the 4xl container width. One column on a phone. */
export function MemberDetailPage({ memberId }: MemberDetailPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const { data: detail } = useSuspenseQuery(memberQueryOptions(memberId));
	const [tab, setTab] = useState("overview");

	const backLink = (
		<Button asChild variant="outline">
			<Link to="/app/members">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("members.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid justify-items-start gap-4">
				<p className="text-muted-foreground text-sm">{t("members.notFound")}</p>
				{backLink}
			</div>
		);
	}
	const { member, plan } = detail;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={member.fullName}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<MemberStatusBadge status={member.status} />
						<span>{plan.name}</span>
					</span>
				}
				actions={
					<>
						{backLink}
						<Button
							type="button"
							onClick={() =>
								copyToClipboard(member.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<EnvelopeSimpleIcon />
							{t("members.copyEmail")}
						</Button>
					</>
				}
			/>
			<Tabs value={tab} onValueChange={setTab} className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">{t("members.overview")}</TabsTrigger>
					<TabsTrigger value="visits">
						{`${t("members.visitsTab")} (${new Intl.NumberFormat(locale).format(detail.visits.length)})`}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid gap-4">
							<MemberProfileCard detail={detail} now={now} />
							<MemberWeekCard
								visits={detail.visitsThisWeek}
								usual={member.weeklyVisits}
							/>
							<MemberClassesCard counts={detail.classCounts} />
						</div>
						<div className="@4xl/main:col-span-2 grid gap-4">
							<MemberTimelineCard
								visits={detail.visits}
								now={now}
								onViewAll={() => setTab("visits")}
							/>
							<div className="grid @2xl/main:grid-cols-2 items-start gap-4">
								<MemberPaymentsCard payments={detail.payments} />
								<MemberBookingsCard sessions={detail.upcoming} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="visits">
					<Card>
						<CardContent>
							<MemberVisitsTable visits={detail.visits} now={now} />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function MemberDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-5 w-40" />
				</div>
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<Skeleton className="h-9 w-48" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-28" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-96" />
					<Skeleton className="h-72" />
				</div>
			</div>
		</div>
	);
}
