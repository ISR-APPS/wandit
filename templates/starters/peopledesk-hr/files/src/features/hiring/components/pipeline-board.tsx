// The Board tab of the hiring page: one column per stage, applied to hired, with one card per candidate.
// HiringPage renders it with the candidates after its filters. A card title opens the candidate dialog.
// It follows the kit kanban board: muted columns that scroll sideways, a head with a count, and task cards.
// There is no drag and drop: a stage move needs a real table first (STARTER.md).
import { BriefcaseIcon, ClockIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
	BOARD_STAGES,
	type BoardStage,
	calendarDaysFromNow,
	fillMessage,
	PersonAvatar,
	STAGE_DOT,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";
import type { Candidate } from "../api/hiring.queries";

// A column shows four cards, then a button that shows the rest, so the board stays one screen high.
const CARDS_PER_COLUMN = 4;
// The rating ring: a circle of radius 16 in a 36 by 36 box, so the stroke stays inside the box.
const RING_RADIUS = 16;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
// The top score of an interviewer.
const MAX_RATING = 5;

type PipelineBoardProps = {
	/** The candidates on the board, after the position filter and the search field. */
	candidates: Candidate[];
	/** Opens the candidate dialog of one candidate id. */
	onOpen: (candidateId: string) => void;
};

/** Five columns in the order of BOARD_STAGES. A rejected candidate is not on the board. */
export function PipelineBoard({ candidates, onOpen }: PipelineBoardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	// The stages whose column shows every card.
	const [expanded, setExpanded] = useState<ReadonlySet<BoardStage>>(new Set());

	function toggle(stage: BoardStage) {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(stage)) {
				next.delete(stage);
			} else {
				next.add(stage);
			}
			return next;
		});
	}

	return (
		// The board scrolls sideways inside the page, so the page never scrolls sideways.
		// min-w-0 lets this grid item shrink below the width of its five columns.
		// relative makes the board the box of each sr-only label. Without it, a label of a far column widens the page.
		<div className="relative flex w-full min-w-0 items-start gap-4 overflow-x-auto pb-4">
			{BOARD_STAGES.map((stage) => {
				const stageCandidates = candidates.filter(
					(candidate) => candidate.stage === stage,
				);
				const isExpanded = expanded.has(stage);
				const shown = isExpanded
					? stageCandidates
					: stageCandidates.slice(0, CARDS_PER_COLUMN);
				const hidden = stageCandidates.length - CARDS_PER_COLUMN;
				return (
					<section
						key={stage}
						aria-label={t(`stages.${stage}`)}
						className="grid w-72 min-w-72 gap-3 rounded-md bg-muted p-2.5"
					>
						<div className="flex items-center gap-2 px-1 pt-1">
							<span
								aria-hidden
								className={`size-2 rounded-full ${STAGE_DOT[stage]}`}
							/>
							<h2 className="font-semibold text-sm">{t(`stages.${stage}`)}</h2>
							<Badge variant="outline" className="tabular-nums">
								{number.format(stageCandidates.length)}
							</Badge>
						</div>
						{stageCandidates.length === 0 ? (
							<p className="px-1 pb-2 text-muted-foreground text-sm">
								{t("hiring.emptyStage")}
							</p>
						) : (
							<ul className="grid gap-2">
								{shown.map((candidate) => (
									<li key={candidate.id}>
										<CandidateCard candidate={candidate} onOpen={onOpen} />
									</li>
								))}
							</ul>
						)}
						{hidden > 0 ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => toggle(stage)}
							>
								{isExpanded
									? t("hiring.showLess")
									: fillMessage(t("hiring.showMore"), {
											count: number.format(hidden),
										})}
							</Button>
						) : null}
					</section>
				);
			})}
		</div>
	);
}

type CandidateCardProps = {
	candidate: Candidate;
	onOpen: (candidateId: string) => void;
};

// The kit task card: the title and two lines, the avatars and a score ring, a rule, then the tag and two counts.
function CandidateCard({ candidate, onOpen }: CandidateCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const daysAgo = -calendarDaysFromNow(candidate.appliedAt, Date.now());
	// No rating before the screening: the ring stays empty.
	const ratingShare = (candidate.rating ?? 0) / MAX_RATING;
	return (
		<Card className="gap-4 py-4">
			<CardHeader className="px-4">
				<CardTitle className="font-semibold text-base">
					<button
						type="button"
						onClick={() => onOpen(candidate.id)}
						className="text-start outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						dir="auto"
					>
						{candidate.name}
					</button>
				</CardTitle>
				<CardDescription className="grid">
					<span className="truncate" dir="auto">
						{candidate.positionTitle}
					</span>
					<span className="truncate" dir="auto">
						{fillMessage(t("hiring.nowRole"), { role: candidate.currentRole })}
					</span>
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 px-4">
				<div className="flex items-center justify-between text-muted-foreground text-sm">
					{/* A 4px overlap only: the avatars show initials, and a larger overlap cuts the first letter. */}
					<div className="flex -space-x-1 rtl:space-x-reverse">
						<PersonAvatar name={candidate.name} className="ring-2 ring-card" />
						{candidate.hiringManagerName ? (
							<PersonAvatar
								name={candidate.hiringManagerName}
								className="ring-2 ring-card"
							/>
						) : null}
					</div>
					<span className="flex items-center gap-2 rounded-md border p-1 tabular-nums">
						<span className="sr-only">
							{candidate.rating === null
								? t("hiring.notRated")
								: fillMessage(t("hiring.ratingLabel"), {
										rating: number.format(candidate.rating),
									})}
						</span>
						<svg
							viewBox="0 0 36 36"
							className="size-4 -rotate-90"
							aria-hidden="true"
						>
							<circle
								cx="18"
								cy="18"
								r={RING_RADIUS}
								fill="none"
								strokeWidth="3"
								className="stroke-current text-border"
							/>
							<circle
								cx="18"
								cy="18"
								r={RING_RADIUS}
								fill="none"
								strokeWidth="3"
								strokeLinecap="round"
								strokeDasharray={RING_LENGTH}
								strokeDashoffset={RING_LENGTH * (1 - ratingShare)}
								className="stroke-current text-primary"
							/>
						</svg>
						<span aria-hidden="true">
							{candidate.rating === null
								? "–"
								: `${number.format(candidate.rating)}/${number.format(MAX_RATING)}`}
						</span>
					</span>
				</div>
				<Separator />
				<div className="flex items-center justify-between gap-2 text-muted-foreground text-sm">
					<Badge variant="outline">{t(`sources.${candidate.source}`)}</Badge>
					<div className="flex items-center gap-3 tabular-nums">
						<span className="flex items-center gap-1">
							<span className="sr-only">{t("hiring.daysSinceApplied")}</span>
							<ClockIcon className="size-4" aria-hidden />
							{fillMessage(t("hiring.daysShort"), {
								count: number.format(daysAgo),
							})}
						</span>
						<span className="flex items-center gap-1">
							<span className="sr-only">{t("hiring.experience")}</span>
							<BriefcaseIcon className="size-4" aria-hidden />
							{fillMessage(t("hiring.yearsShort"), {
								count: number.format(candidate.experienceYears),
							})}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
