// The file of one matter, built on the kit profile page: a back link, the header, and three tabs.
// Overview: the profile, fee, and team cards in 1/3, the activity timeline, recent entries, and deadlines in 2/3.
// The other tabs list every time entry and every invoice. The /app/matters/$matterId route renders it.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { matterQueryOptions } from "../api/matters.queries";
import { MatterActivityCard } from "./matter-activity-card";
import { MatterDeadlinesCard } from "./matter-deadlines-card";
import { MatterFeesCard } from "./matter-fees-card";
import { MatterInvoicesTable } from "./matter-invoices-table";
import { MatterProfileCard } from "./matter-profile-card";
import { RecentEntriesCard } from "./recent-entries-card";
import { TeamCard } from "./team-card";
import { TimeEntriesTable } from "./time-entries-table";

type MatterDetailPageProps = {
	/** The `$matterId` param of the URL. An id with no matter shows the not-found block. */
	matterId: string;
};

/** A 1/3 column and a 2/3 column from the 4xl container width (56rem), as the kit profile page. */
export function MatterDetailPage({ matterId }: MatterDetailPageProps) {
	const { t } = useT();
	const { data: file } = useSuspenseQuery(matterQueryOptions(matterId));
	const now = Date.now();

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/matters">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("matters.title")}
			</Link>
		</Button>
	);
	if (!file) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("matters.notFound")}</p>
			</div>
		);
	}
	const { matter, client } = file;
	const lead = file.team.find((member) => member.isLead);

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={matter.name}
				description={
					matter.stage === "declined" ? t("matters.declinedNote") : undefined
				}
				actions={
					<Button asChild>
						<Link to="/app/clients" search={{ client: client.id }}>
							{t("matters.viewClient")}
						</Link>
					</Button>
				}
			/>
			<Tabs defaultValue="overview" className="gap-4">
				<TabsList>
					<TabsTrigger value="overview">
						{t("matters.tabs.overview")}
					</TabsTrigger>
					<TabsTrigger value="time">{t("matters.tabs.time")}</TabsTrigger>
					<TabsTrigger value="invoices">
						{t("matters.tabs.invoices")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
						<div className="grid min-w-0 gap-4">
							<MatterProfileCard
								matter={matter}
								client={client}
								leadRole={lead ? t(`roles.${lead.role}`) : ""}
								deadlineCount={file.deadlines.length}
							/>
							<MatterFeesCard matter={matter} />
							<TeamCard team={file.team} />
						</div>
						<div className="@4xl/main:col-span-2 grid min-w-0 gap-4">
							<MatterActivityCard
								stageChanges={file.stageChanges}
								invoices={file.invoices}
								payments={file.payments}
							/>
							<div className="grid @2xl/main:grid-cols-2 items-start gap-4">
								<RecentEntriesCard entries={file.entries} />
								<MatterDeadlinesCard deadlines={file.deadlines} now={now} />
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="time">
					<TimeEntriesTable
						entries={file.entries}
						matterNumber={matter.number}
					/>
				</TabsContent>
				<TabsContent value="invoices">
					<MatterInvoicesTable invoices={file.invoices} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function MatterDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-28" />
			<Skeleton className="h-8 w-80 max-w-full" />
			<Skeleton className="h-9 w-72 max-w-full" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-48" />
				</div>
				<div className="@4xl/main:col-span-2 grid gap-4">
					<Skeleton className="h-96" />
					<Skeleton className="h-72" />
				</div>
			</div>
		</div>
	);
}
