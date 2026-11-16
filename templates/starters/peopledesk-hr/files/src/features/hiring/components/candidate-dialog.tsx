// The dialog of one candidate: the facts of the application, the score, the next interview, and the stage history.
// HiringPage opens it from the URL (?candidate=). It reads the candidate row that the page passes.
// It has no stage buttons: a move needs a real table first (STARTER.md).
import {
	formatRelativeTime,
	PersonAvatar,
	STAGE_BADGE,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import type { Candidate } from "../api/hiring.queries";
import { RatingStars } from "./rating-stars";

type CandidateDialogProps = {
	/** The candidate to show. The dialog keeps it while it closes, so the content does not jump. */
	candidate: Candidate | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog with the application facts and a timeline of the stages, oldest first. */
export function CandidateDialog({
	candidate,
	open,
	onOpenChange,
}: CandidateDialogProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const years = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "year",
		unitDisplay: "long",
	});

	return (
		<Dialog open={open && candidate !== null} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
				{candidate ? (
					<>
						<DialogHeader className="text-start">
							<div className="flex items-center gap-3">
								<PersonAvatar
									name={candidate.name}
									className="size-10 text-sm"
								/>
								<div className="grid min-w-0 gap-1">
									<DialogTitle className="truncate">
										{candidate.name}
									</DialogTitle>
									<DialogDescription>
										{candidate.positionTitle}
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<Badge variant={STAGE_BADGE[candidate.stage]}>
								{t(`stages.${candidate.stage}`)}
							</Badge>
							{candidate.rating === null ? null : (
								<RatingStars rating={candidate.rating} />
							)}
							<span className="text-muted-foreground tabular-nums">
								{candidate.id}
							</span>
						</div>
						<dl className="grid gap-4 text-sm sm:grid-cols-2">
							<div className="grid gap-1">
								<dt className="text-muted-foreground">{t("hiring.applied")}</dt>
								<dd className="tabular-nums">
									{dateTime.format(new Date(candidate.appliedAt))}
									<span className="block text-muted-foreground">
										{formatRelativeTime(candidate.appliedAt, now, locale)}
									</span>
								</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">{t("hiring.source")}</dt>
								<dd>{t(`sources.${candidate.source}`)}</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("hiring.currentRole")}
								</dt>
								<dd dir="auto">{candidate.currentRole}</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("hiring.experience")}
								</dt>
								<dd className="tabular-nums">
									{years.format(candidate.experienceYears)}
								</dd>
							</div>
							{candidate.interviewAt ? (
								<div className="grid gap-1 sm:col-span-2">
									<dt className="text-muted-foreground">
										{t("hiring.nextInterview")}
									</dt>
									<dd className="tabular-nums">
										{dateTime.format(new Date(candidate.interviewAt))}
										<span className="text-muted-foreground">
											{` · ${formatRelativeTime(candidate.interviewAt, now, locale)}`}
										</span>
									</dd>
								</div>
							) : null}
						</dl>
						<div className="grid gap-3">
							<h3 className="font-medium font-sans text-sm">
								{t("hiring.history")}
							</h3>
							<ol className="grid">
								{candidate.stageChanges.map((change, index) => {
									const isLast = index === candidate.stageChanges.length - 1;
									return (
										<li
											key={`${change.stage}-${change.at}`}
											className="grid grid-cols-[1rem_1fr_auto] gap-x-3 text-sm"
										>
											<span className="flex flex-col items-center">
												<span
													className={cn(
														"mt-1.5 size-2.5 shrink-0 rounded-full",
														isLast ? "bg-primary" : "bg-muted-foreground/40",
													)}
													aria-hidden
												/>
												{isLast ? null : (
													<span className="w-px flex-1 bg-border" aria-hidden />
												)}
											</span>
											<span className={cn("pb-4", isLast && "font-medium")}>
												{t(`stages.${change.stage}`)}
											</span>
											<span className="text-muted-foreground tabular-nums">
												{dateTime.format(new Date(change.at))}
											</span>
										</li>
									);
								})}
							</ol>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								{t("hiring.close")}
							</Button>
						</DialogFooter>
					</>
				) : (
					<DialogTitle className="sr-only">{t("hiring.title")}</DialogTitle>
				)}
			</DialogContent>
		</Dialog>
	);
}
