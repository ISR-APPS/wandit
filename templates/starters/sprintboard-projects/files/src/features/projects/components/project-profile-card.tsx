// The profile card of a project page: the key tile, the name and state, the summary, three counts, and five facts.
// ProjectDetailPage renders it first in the 1/3 column of the Overview tab.
import {
	CalendarBlankIcon,
	FlagBannerIcon,
	HourglassMediumIcon,
	UserIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { fillMessage, ProjectStateBadge, pluralOf } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { ProjectDetail } from "../api/projects.queries";
import { timeLeftOf } from "../lib/project-progress";

type ProjectProfileCardProps = {
	project: ProjectDetail;
	/** The current time in milliseconds since 1970. */
	now: number;
};

/** The counts sit in one muted strip with a rule between the cells. */
export function ProjectProfileCard({ project, now }: ProjectProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const time = timeLeftOf(project, now);
	const timeText =
		time.kind === "completed" || time.kind === "paused"
			? t(`projectStatus.${time.kind}`)
			: fillMessage(
					t(`projects.time.${time.kind}.days.${pluralOf(time.days, locale)}`),
					{ count: number.format(time.days) },
				);

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4 text-center">
					<span
						aria-hidden="true"
						className="flex size-20 items-center justify-center rounded-full bg-muted font-display font-semibold text-xl"
					>
						{project.key}
					</span>
					<div className="grid justify-items-center gap-1">
						<h2 className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							{project.name}
							<ProjectStateBadge
								status={project.status}
								health={project.health}
							/>
						</h2>
						<p className="text-muted-foreground text-sm" dir="auto">
							{project.summary}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center *:py-3 rtl:divide-x-reverse">
					<Count
						label={t("project.tasks")}
						value={number.format(project.taskCount)}
					/>
					<Count
						label={t("project.points")}
						value={number.format(project.pointsTotal)}
					/>
					<Count
						label={t("project.people")}
						value={number.format(project.members.length)}
					/>
				</dl>
				<ul className="grid gap-4">
					<Fact icon={UserIcon}>
						{fillMessage(t("project.leadIs"), { name: project.leadName })}
					</Fact>
					<Fact icon={CalendarBlankIcon}>
						{fillMessage(t("project.started"), {
							date: date.format(new Date(project.startAt)),
						})}
					</Fact>
					<Fact icon={FlagBannerIcon}>
						{fillMessage(t("project.targetOn"), {
							date: date.format(new Date(project.targetAt)),
						})}
					</Fact>
					<Fact icon={HourglassMediumIcon}>{timeText}</Fact>
					<Fact icon={WarningCircleIcon}>
						{fillMessage(
							t(`project.overdue.${pluralOf(project.overdueCount, locale)}`),
							{ count: number.format(project.overdueCount) },
						)}
					</Fact>
				</ul>
			</CardContent>
		</Card>
	);
}

// One cell of the count strip. The dt comes first in the markup; the order classes show the value over its label.
function Count({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-0.5">
			<dt className="order-2 text-muted-foreground text-sm">{label}</dt>
			<dd className="order-1 font-numeric font-semibold text-lg tabular-nums">
				{value}
			</dd>
		</div>
	);
}

// One fact line: a muted icon, then the text.
function Fact({
	icon: Icon,
	children,
}: {
	icon: KitIcon;
	children: ReactNode;
}) {
	return (
		<li className="flex items-center gap-3 text-sm">
			<Icon className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0">{children}</span>
		</li>
	);
}
