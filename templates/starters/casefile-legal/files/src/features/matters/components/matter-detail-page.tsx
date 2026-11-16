// The file of one matter: the header, the stage path, the facts, the time entries, and a rail with
// the fees, the deadlines, the team, and the invoices.
// The /app/matters/$matterId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { MatterStageBadge } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { matterQueryOptions } from "../api/matters.queries";
import { DeadlinesCard } from "./deadlines-card";
import { MatterFactsCard } from "./matter-facts-card";
import { MatterFeesCard } from "./matter-fees-card";
import { MatterInvoicesCard } from "./matter-invoices-card";
import { StagePath } from "./stage-path";
import { TeamCard } from "./team-card";
import { TimeEntriesCard } from "./time-entries-card";

type MatterDetailPageProps = {
	/** The `$matterId` param of the URL. An id with no matter shows the not-found block. */
	matterId: string;
};

/** A 2/3 main column and a 1/3 rail from the 4xl container width (56rem). */
export function MatterDetailPage({ matterId }: MatterDetailPageProps) {
	const { t } = useT();
	const { data: file } = useSuspenseQuery(matterQueryOptions(matterId));

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
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={matter.name}
				description={
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<MatterStageBadge stage={matter.stage} />
						<span className="font-numeric tabular-nums">{matter.number}</span>
						<span aria-hidden="true">·</span>
						<span>{t(`areas.${matter.area}`)}</span>
						<span aria-hidden="true">·</span>
						<span dir="auto">{client.name}</span>
					</span>
				}
				actions={
					<Button asChild variant="outline">
						<Link to="/app/clients" search={{ client: client.id }}>
							{t("matters.viewClient")}
						</Link>
					</Button>
				}
			/>
			<StagePath stage={matter.stage} changes={file.stageChanges} />
			{matter.stage === "declined" ? (
				<p className="rounded-surface border border-dashed px-4 py-3 text-muted-foreground text-sm">
					{t("matters.declinedNote")}
				</p>
			) : null}
			{/* One column: facts, rail, time entries, so the fees and deadlines come before the long table. */}
			{/* From 4xl: facts and time entries in two thirds, and the rail beside both in the last third. */}
			{/* The 1fr row takes the extra height of a tall rail, so no gap opens under the facts. */}
			<div className="grid @4xl/main:grid-cols-3 @4xl/main:grid-rows-[auto_1fr] items-start gap-6">
				<div className="@4xl/main:col-span-2 min-w-0">
					<MatterFactsCard
						matter={matter}
						client={client}
						leadRole={lead ? t(`roles.${lead.role}`) : ""}
					/>
				</div>
				<div className="@4xl/main:col-start-3 @4xl/main:row-span-2 @4xl/main:row-start-1 grid min-w-0 gap-6">
					<MatterFeesCard matter={matter} />
					{matter.closedAt === null ? (
						<DeadlinesCard deadlines={file.deadlines} />
					) : null}
					<TeamCard team={file.team} />
					<MatterInvoicesCard invoices={file.invoices} />
				</div>
				<div className="@4xl/main:col-span-2 min-w-0">
					<TimeEntriesCard
						entries={file.entries}
						totalHours={matter.ledger.hours}
					/>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function MatterDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-80 max-w-full" />
				<Skeleton className="h-5 w-64 max-w-full" />
			</div>
			<Skeleton className="h-20" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<div className="@4xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-96" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-56" />
					<Skeleton className="h-48" />
				</div>
			</div>
		</div>
	);
}
