// The hiring page behind login: four figures, the position cards, and the pipeline board of the chosen position.
// The /app/hiring route renders it after its loader. The route also uses the skeleton and the error below.
// The chosen position (?position=) and the open candidate (?candidate=) live in the URL.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CARD_TITLE_CLASS,
	KpiFigures,
	KpiFiguresSkeleton,
	POSITION_STATUS_BADGE,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	candidatesQueryOptions,
	hiringKpisQueryOptions,
	positionsQueryOptions,
} from "../api/hiring.queries";
import { CandidateDialog } from "./candidate-dialog";
import { PipelineBoard } from "./pipeline-board";
import { PositionCard } from "./position-card";

const routeApi = getRouteApi("/app/hiring");

// The grid of the figure row: two columns on a phone, four from a 42rem main column (a 1024 px screen).
const KPI_GRID = "grid-cols-2 @2xl/main:grid-cols-4";
// The position cards. Up to a 64rem main column (a 1280 px screen) they form one row that scrolls
// sideways, so the board stays near the top. The padding keeps the ring of the chosen card inside the
// scroll box. A wider main column gets a grid of four.
const POSITION_GRID =
	"-m-1 grid-flow-col auto-cols-[15rem] overflow-x-auto p-1 @5xl/main:m-0 @5xl/main:grid-flow-row @5xl/main:auto-cols-auto @5xl/main:grid-cols-4 @5xl/main:overflow-visible @5xl/main:p-0";

/** The hiring page. No position in the URL shows the first position of the list, an open one. */
export function HiringPage() {
	const { t, locale } = useT();
	const { data: positions } = useSuspenseQuery(positionsQueryOptions());
	const { data: candidates } = useSuspenseQuery(candidatesQueryOptions());
	const { data: kpis } = useSuspenseQuery(hiringKpisQueryOptions());
	const search = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	// The id of the candidate that the dialog showed last. The dialog keeps it while it closes.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const position =
		positions.find((row) => row.id === search.position) ?? positions[0] ?? null;
	const positionCandidates = position
		? candidates.filter((candidate) => candidate.positionId === position.id)
		: [];
	const rejectedCount = positionCandidates.filter(
		(candidate) => candidate.stage === "rejected",
	).length;
	const openCandidate =
		candidates.find((candidate) => candidate.id === search.candidate) ?? null;
	const dialogCandidate =
		openCandidate ??
		candidates.find((candidate) => candidate.id === closingId) ??
		null;

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("hiring.title")}
				description={t("hiring.description")}
			/>
			<KpiFigures
				items={kpis.map(({ labelKey, noteKey, ...item }) => ({
					...item,
					label: t(labelKey),
					note: noteKey ? t(noteKey) : undefined,
				}))}
				className={KPI_GRID}
			/>
			<section className="grid gap-3" aria-labelledby="positions-title">
				<h2
					id="positions-title"
					className="font-(--heading-weight) text-xl tracking-(--heading-tracking)"
				>
					{t("hiring.positionsTitle")}
				</h2>
				<div className={cn("grid gap-4", POSITION_GRID)}>
					{positions.map((row) => (
						<PositionCard
							key={row.id}
							position={row}
							isSelected={row.id === position?.id}
							onSelect={() =>
								navigate({
									search: { position: row.id },
									replace: true,
									resetScroll: false,
								})
							}
						/>
					))}
				</div>
			</section>
			{position ? (
				<Card>
					<CardHeader>
						<CardTitle className={CARD_TITLE_CLASS}>{position.title}</CardTitle>
						<CardDescription>
							{`${t("hiring.pipelineOf")} ${position.hiringManagerName}`}
						</CardDescription>
						<CardAction>
							<Badge variant={POSITION_STATUS_BADGE[position.status]}>
								{t(`positionStatuses.${position.status}`)}
							</Badge>
						</CardAction>
					</CardHeader>
					<CardContent className="grid gap-3">
						<PipelineBoard
							candidates={positionCandidates}
							onOpen={(candidateId) =>
								navigate({
									search: { position: position.id, candidate: candidateId },
									replace: true,
									resetScroll: false,
								})
							}
						/>
						<p className="text-muted-foreground text-sm">
							{`${t("hiring.rejectedNote")} ${number.format(rejectedCount)}`}
						</p>
					</CardContent>
				</Card>
			) : null}
			<CandidateDialog
				candidate={dialogCandidate}
				open={openCandidate !== null}
				onOpenChange={(open) => {
					if (!open) {
						setClosingId(search.candidate ?? null);
						navigate({
							search: { position: search.position },
							replace: true,
							resetScroll: false,
						});
					}
				}}
			/>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4"];

/** Placeholder while the hiring loader runs. The route sets it as pendingComponent. */
export function HiringPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-72" />
			</div>
			<KpiFiguresSkeleton count={4} className={KPI_GRID} />
			<div className={cn("grid gap-4", POSITION_GRID)}>
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-40 rounded-surface" />
				))}
			</div>
			<Skeleton className="h-80 rounded-surface" />
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function HiringPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("hiring.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
