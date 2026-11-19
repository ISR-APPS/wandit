// The hiring page behind login. It follows the kit kanban page: a title row with the avatars of the hiring managers,
// a toolbar with the Board and Table tabs, a search field, a position filter, and the export, then the view.
// The /app/hiring route renders it after its loader. The route also uses the skeleton and the error below.
// The position filter and the open candidate live in the URL (?position=REQ-118&candidate=CA-5120).
import { DownloadSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { downloadCsv, PersonAvatar, toCsv } from "~/features/people";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	candidatesQueryOptions,
	positionsQueryOptions,
} from "../api/hiring.queries";
import { candidateCsvColumns } from "../lib/candidate-csv";
import { CandidateDialog } from "./candidate-dialog";
import { CandidatesTable } from "./candidates-table";
import { PipelineBoard } from "./pipeline-board";

const routeApi = getRouteApi("/app/hiring");

/** The two views of the page. */
const HIRING_VIEWS = ["board", "table"] as const;
type HiringView = (typeof HIRING_VIEWS)[number];

// The header shows three manager avatars, then a "+N" circle for the rest.
const MANAGER_AVATARS = 3;
// The Select value of "every position". A position id never has this value.
const ALL_POSITIONS = "all";

/** The board and the table show the candidates of open positions that are still in the race, and every hire. */
export function HiringPage() {
	const { t, locale } = useT();
	const { data: positions } = useSuspenseQuery(positionsQueryOptions());
	const { data: candidates } = useSuspenseQuery(candidatesQueryOptions());
	const search = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [view, setView] = useState<HiringView>("board");
	const [query, setQuery] = useState("");
	// The id of the candidate that the dialog showed last. The dialog keeps it while it closes.
	const [closingId, setClosingId] = useState<string | null>(null);

	const onBoard = candidates.filter(
		(candidate) =>
			(candidate.isPositionOpen && candidate.stage !== "rejected") ||
			candidate.stage === "hired",
	);
	// The filter lists only the positions that have a candidate on the board.
	const boardPositionIds = new Set(onBoard.map((row) => row.positionId));
	const filterPositions = positions.filter((position) =>
		boardPositionIds.has(position.id),
	);
	const positionId = filterPositions.some(
		(position) => position.id === search.position,
	)
		? search.position
		: undefined;
	const needle = query.trim().toLocaleLowerCase(locale);
	const shown = onBoard.filter(
		(candidate) =>
			(positionId === undefined || candidate.positionId === positionId) &&
			(needle === "" ||
				`${candidate.name} ${candidate.currentRole} ${candidate.positionTitle} ${candidate.id}`
					.toLocaleLowerCase(locale)
					.includes(needle)),
	);
	const managers = [
		...new Set(
			positions
				.filter((position) => position.status === "open")
				.map((position) => position.hiringManagerName)
				.filter((name) => name !== ""),
		),
	];
	const openCandidate =
		candidates.find((candidate) => candidate.id === search.candidate) ?? null;
	const dialogCandidate =
		openCandidate ??
		candidates.find((candidate) => candidate.id === closingId) ??
		null;

	function openCandidateDialog(candidateId: string) {
		navigate({
			search: (previous) => ({ ...previous, candidate: candidateId }),
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("hiring.title")}
				description={t("hiring.description")}
				actions={
					// A 4px overlap only: the avatars show initials, and a larger overlap cuts the first letter.
					<ul
						className="flex -space-x-1 rtl:space-x-reverse"
						aria-label={t("hiring.managers")}
					>
						{managers.slice(0, MANAGER_AVATARS).map((name) => (
							<li key={name}>
								<PersonAvatar name={name} className="ring-2 ring-background" />
								<span className="sr-only">{name}</span>
							</li>
						))}
						{managers.length > MANAGER_AVATARS ? (
							<li>
								<Avatar className="ring-2 ring-background">
									<AvatarFallback className="text-xs">
										{`+${new Intl.NumberFormat(locale).format(managers.length - MANAGER_AVATARS)}`}
									</AvatarFallback>
								</Avatar>
							</li>
						) : null}
					</ul>
				}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Tabs
					value={view}
					onValueChange={(value) =>
						setView(HIRING_VIEWS.find((option) => option === value) ?? "board")
					}
				>
					<TabsList>
						{HIRING_VIEWS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{t(`hiring.views.${option}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative w-full sm:w-auto">
						<MagnifyingGlassIcon
							aria-hidden
							className="pointer-events-none absolute start-3 top-2.5 size-4 opacity-50"
						/>
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("hiring.searchPlaceholder")}
							aria-label={t("hiring.searchPlaceholder")}
							className="w-full ps-8 sm:w-48 lg:w-56"
						/>
					</div>
					<Select
						value={positionId ?? ALL_POSITIONS}
						onValueChange={(value) =>
							navigate({
								search: (previous) => ({
									...previous,
									position: value === ALL_POSITIONS ? undefined : value,
								}),
								replace: true,
								resetScroll: false,
							})
						}
					>
						<SelectTrigger
							aria-label={t("hiring.positionFilter")}
							className="w-48 lg:w-56"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value={ALL_POSITIONS}>
								{t("hiring.allPositions")}
							</SelectItem>
							{filterPositions.map((position) => (
								<SelectItem key={position.id} value={position.id}>
									{position.title}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								"candidates.csv",
								toCsv(shown, candidateCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				</div>
			</div>
			{view === "board" ? (
				<PipelineBoard candidates={shown} onOpen={openCandidateDialog} />
			) : (
				<CandidatesTable candidates={shown} onOpen={openCandidateDialog} />
			)}
			<CandidateDialog
				candidate={dialogCandidate}
				open={openCandidate !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setClosingId(search.candidate ?? null);
						navigate({
							search: (previous) => ({ ...previous, candidate: undefined }),
							replace: true,
							resetScroll: false,
						});
					}
				}}
			/>
		</div>
	);
}

// Placeholder columns of the skeleton. Fixed keys, because the columns never reorder.
const SKELETON_COLUMNS = ["1", "2", "3", "4"];

/** Placeholder while the hiring loader runs. The route sets it as pendingComponent. */
export function HiringPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="flex flex-wrap justify-between gap-2">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-9 w-96 max-w-full" />
			</div>
			<div className="flex gap-4 overflow-hidden">
				{SKELETON_COLUMNS.map((key) => (
					<Skeleton key={key} className="h-128 w-80 min-w-80" />
				))}
			</div>
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
