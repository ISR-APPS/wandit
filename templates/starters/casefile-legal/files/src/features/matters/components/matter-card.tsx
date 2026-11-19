// One card of the matter list: the name, the practice area, the opening date, the stage progress,
// the team avatars, and a badge with the time to the next deadline. It follows the kit project card.
// MattersPage renders one per matter in its card grid. The title links to the matter page.
import { Link } from "@tanstack/react-router";
import {
	calendarDaysUntil,
	deadlinePriority,
	fillMessage,
	PersonAvatar,
	STAGE_PATH,
	stageStep,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { MatterSummary } from "../lib/matter-joins";

// Four avatars fit the card at 1/4 width. A "+n" chip counts the rest.
const SHOWN_AVATARS = 4;

/** Badge variant of the deadline badge per priority. The text always names the days. */
const DEADLINE_BADGE = {
	high: "destructive",
	medium: "warning",
	low: "info",
} as const;

type MatterCardProps = {
	matter: MatterSummary;
	/** The current time in milliseconds since 1970. The deadline badge counts from it. */
	now: number;
};

/** A declined matter has no step: its bar stays empty and the badge says "Declined". */
export function MatterCard({ matter, now }: MatterCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const step = stageStep(matter.stage) ?? 0;
	const extraCount = matter.teamNames.length - SHOWN_AVATARS;

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="line-clamp-2 leading-snug">
					<Link
						to="/app/matters/$matterId"
						params={{ matterId: matter.id }}
						className="hover:underline"
						dir="auto"
					>
						{matter.name}
					</Link>
				</CardTitle>
				<CardDescription className="truncate" dir="auto">
					{`${t(`areas.${matter.area}`)} · ${matter.clientName}`}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="text-sm tabular-nums">
					{fillMessage(t("matters.openedOn"), {
						date: date.format(new Date(matter.openedAt)),
					})}
				</p>
				<div className="grid gap-2">
					<div className="flex items-center justify-between gap-3 text-sm">
						<span>{t(`stages.${matter.stage}`)}</span>
						<span className="font-semibold tabular-nums">
							{fillMessage(t("matters.stepOf"), {
								step: number.format(step),
								count: number.format(STAGE_PATH.length),
							})}
						</span>
					</div>
					<Progress
						value={(step / STAGE_PATH.length) * 100}
						className="h-2"
						aria-label={t("matters.progress")}
					/>
				</div>
				<div className="flex items-center justify-between gap-3">
					<ul className="flex -space-x-1">
						{matter.teamNames.slice(0, SHOWN_AVATARS).map((name) => (
							<li key={name} title={name}>
								<PersonAvatar name={name} className="ring-2 ring-card" />
								<span className="sr-only">{name}</span>
							</li>
						))}
						{extraCount > 0 ? (
							<li className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs tabular-nums ring-2 ring-card">
								{`+${number.format(extraCount)}`}
							</li>
						) : null}
					</ul>
					<DeadlineBadge matter={matter} now={now} />
				</div>
			</CardContent>
		</Card>
	);
}

// The badge at the end of the card: the days to the next deadline, or the end state of the matter.
function DeadlineBadge({ matter, now }: MatterCardProps) {
	const { t, locale } = useT();
	if (matter.stage === "closed" || matter.stage === "declined") {
		return (
			<Badge variant={matter.stage === "closed" ? "success" : "outline"}>
				{t(`stages.${matter.stage}`)}
			</Badge>
		);
	}
	if (matter.nextDeadline === null) {
		return <Badge variant="outline">{t("matters.noDeadline")}</Badge>;
	}
	const days = calendarDaysUntil(matter.nextDeadline.dueAt, now);
	return (
		<Badge
			variant={DEADLINE_BADGE[deadlinePriority(matter.nextDeadline.dueAt, now)]}
			className="tabular-nums"
		>
			{fillMessage(t("matters.daysLeft"), {
				days: new Intl.NumberFormat(locale, {
					style: "unit",
					unit: "day",
					unitDisplay: "long",
				}).format(days),
			})}
		</Badge>
	);
}
