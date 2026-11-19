// The team card of the home: the headcount, the people with the most points done, and three highlight rows.
// OverviewPage renders it in the 1/3 column beside the work chart. It reads the summary of the page period.
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { fillMessage, PersonAvatar, pluralOf } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type {
	Contributor,
	OptionalFigure,
	OverviewSummary,
} from "../lib/overview-data";

type TeamHighlightsCardProps = {
	summary: OverviewSummary;
};

/** Each highlight row shows an arrow in the color of its meaning, then the value of the period. */
export function TeamHighlightsCard({ summary }: TeamHighlightsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const oneDecimal = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
	});
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
		maximumFractionDigits: 1,
	});

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.teamLabel")}</CardDescription>
				<CardTitle className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{number.format(summary.headcount)}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-8">
				<div className="grid gap-2">
					<p className="font-semibold text-sm">
						{t("overview.topContributors")}
					</p>
					{summary.contributors.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("overview.noContributors")}
						</p>
					) : (
						<ul className="flex -space-x-1.5">
							{summary.contributors.map((person) => (
								<ContributorAvatar key={person.id} person={person} />
							))}
						</ul>
					)}
				</div>
				<div className="grid gap-2">
					<p className="font-semibold text-sm">{t("overview.highlights")}</p>
					<dl className="divide-y *:py-3">
						<HighlightRow
							label={t("overview.cycleTime")}
							figure={summary.cycleTime}
							goodWhen="down"
							format={(value) => days.format(value)}
						/>
						<HighlightRow
							label={t("overview.pointsPerPerson")}
							figure={summary.pointsPerPerson}
							goodWhen="up"
							format={(value) => oneDecimal.format(value)}
						/>
						<HighlightRow
							label={t("overview.bugsFixed")}
							figure={summary.bugsFixed}
							goodWhen="up"
							format={(value) => number.format(value)}
						/>
					</dl>
				</div>
			</CardContent>
		</Card>
	);
}

// One stacked avatar. The tooltip and the screen reader text give the name and the points.
function ContributorAvatar({ person }: { person: Contributor }) {
	const { t, locale } = useT();
	const text = `${person.name}, ${fillMessage(
		t(`task.points.${pluralOf(person.points, locale)}`),
		{ count: new Intl.NumberFormat(locale).format(person.points) },
	)}`;
	return (
		<li>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="relative rounded-full outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<PersonAvatar
							name={person.name}
							className="size-11 text-sm ring-2 ring-card"
						/>
						<span className="sr-only">{text}</span>
					</button>
				</TooltipTrigger>
				<TooltipContent>{text}</TooltipContent>
			</Tooltip>
		</li>
	);
}

type HighlightRowProps = {
	label: string;
	figure: OptionalFigure;
	goodWhen: "up" | "down";
	/** Formats the value with its unit, in the app language. */
	format: (value: number) => string;
};

// No change gives no arrow. A missing value shows a dash.
function HighlightRow({ label, figure, goodWhen, format }: HighlightRowProps) {
	const { t } = useT();
	const change = figure.change;
	const isUp = change !== null && change > 0;
	const isGood = change !== null && (goodWhen === "up" ? isUp : change < 0);
	const Arrow = isUp ? ArrowUpRightIcon : ArrowDownRightIcon;
	return (
		<div className="flex items-center justify-between gap-3 text-sm">
			<dt>{label}</dt>
			<dd className="flex items-center gap-1 tabular-nums">
				{change === null || change === 0 ? null : (
					<>
						<Arrow
							aria-hidden="true"
							className={cn(
								"size-4",
								isGood ? "text-success" : "text-destructive",
							)}
						/>
						<span className="sr-only">
							{t(isUp ? "overview.rising" : "overview.falling")}
						</span>
					</>
				)}
				{figure.value === null ? "–" : format(figure.value)}
			</dd>
		</div>
	);
}
