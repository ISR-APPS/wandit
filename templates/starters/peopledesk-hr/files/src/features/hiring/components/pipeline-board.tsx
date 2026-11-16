// The pipeline board of one position: one column per stage, one card per candidate, newest first in a column.
// HiringPage renders it under the position cards. A card click opens the candidate dialog through the URL.
// The board scrolls inside its own container on a narrow screen, so the page never scrolls sideways.
import {
	BOARD_STAGES,
	formatRelativeTime,
	PersonAvatar,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Candidate } from "../api/hiring.queries";
import { STAGE_FILL } from "../lib/stage-fill";
import { RatingStars } from "./rating-stars";

type PipelineBoardProps = {
	/** The candidates of the chosen position, rejected ones included. The board leaves those out. */
	candidates: Candidate[];
	/** Opens the dialog of one candidate. */
	onOpen: (candidateId: string) => void;
};

/** Five columns from "applied" to "hired". An empty column keeps its place with a short line. */
export function PipelineBoard({ candidates, onOpen }: PipelineBoardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const interviewFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	const now = Date.now();

	return (
		<div className="overflow-x-auto pb-1">
			{/* 10.5rem columns: the five stages fit side by side from a 1280 px screen.
			    min-w-0 and grid-cols-1 on a card cut a long line instead of widening the card. */}
			<div className="grid auto-cols-[minmax(10.5rem,1fr)] grid-flow-col gap-3">
				{BOARD_STAGES.map((stage) => {
					const column = candidates.filter(
						(candidate) => candidate.stage === stage,
					);
					return (
						<section
							key={stage}
							aria-label={t(`stages.${stage}`)}
							className="grid content-start gap-2 rounded-surface bg-muted/60 p-2"
						>
							<h3 className="flex items-center gap-2 px-1.5 pt-1 pb-0.5 font-medium font-sans text-sm">
								<span
									className={cn("size-2 rounded-full", STAGE_FILL[stage])}
									aria-hidden
								/>
								{t(`stages.${stage}`)}
								<span className="ms-auto text-muted-foreground tabular-nums">
									{number.format(column.length)}
								</span>
							</h3>
							{column.length === 0 ? (
								<p className="px-1.5 py-3 text-muted-foreground text-xs">
									{t("hiring.columnEmpty")}
								</p>
							) : (
								column.map((candidate) => {
									return (
										<button
											key={candidate.id}
											type="button"
											onClick={() => onOpen(candidate.id)}
											className="grid min-w-0 grid-cols-1 gap-2 rounded-control border border-border bg-card p-3 text-start shadow-control transition-colors hover:bg-accent/40"
										>
											<span className="flex items-center gap-2.5">
												<PersonAvatar
													name={candidate.name}
													className="size-7"
												/>
												<span className="grid min-w-0">
													<span className="truncate font-medium text-sm">
														{candidate.name}
													</span>
													<span className="line-clamp-2 text-muted-foreground text-xs">
														{candidate.currentRole}
													</span>
												</span>
											</span>
											<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-muted-foreground text-xs">
												{/* The next interview when one is set, else the application time, as in the dialog. The stars wrap below a long time. */}
												<span className="whitespace-nowrap">
													{candidate.interviewAt ? (
														<>
															{t("hiring.interviewOn")}{" "}
															{interviewFormat.format(
																new Date(candidate.interviewAt),
															)}
														</>
													) : (
														<>
															{t("hiring.applied")}{" "}
															{formatRelativeTime(
																candidate.appliedAt,
																now,
																locale,
															)}
														</>
													)}
												</span>
												{candidate.rating === null ? null : (
													<RatingStars rating={candidate.rating} />
												)}
											</span>
										</button>
									);
								})
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}
