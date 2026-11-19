// The upcoming deadlines of one matter as a list: the kind, the title, the date, and a priority badge.
// MatterDetailPage renders it beside the recent entries card, in the place of the kit "connections" card.
// The priority comes from deadline.ts, so the dashboard and this card agree on each deadline.
import {
	FileTextIcon,
	GavelIcon,
	HandshakeIcon,
	PenNibIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import {
	type DeadlineRow,
	deadlinePriority,
	formatRelativeTime,
	PriorityBadge,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

/** The icon of each kind of deadline. The kind word also shows in the row. */
const KIND_ICON = {
	hearing: GavelIcon,
	filing: FileTextIcon,
	meeting: UsersThreeIcon,
	closing: HandshakeIcon,
	signing: PenNibIcon,
} satisfies Record<DeadlineRow["kind"], KitIcon>;

type MatterDeadlinesCardProps = {
	/** Soonest first. Empty for an ended matter. */
	deadlines: DeadlineRow[];
	/** The current time in milliseconds since 1970. The priorities count from it. */
	now: number;
};

/** Each row shows the date and the relative time, so the badge color is never the only mark. */
export function MatterDeadlinesCard({
	deadlines,
	now,
}: MatterDeadlinesCardProps) {
	const { t, locale } = useT();
	// Deadlines go up to some months ahead. The year shows only when it is not the current year, so the line stays short.
	const dateParts = {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	} satisfies Intl.DateTimeFormatOptions;
	const sameYearDate = new Intl.DateTimeFormat(locale, dateParts);
	const otherYearDate = new Intl.DateTimeFormat(locale, {
		...dateParts,
		year: "numeric",
	});
	const currentYear = new Date(now).getFullYear();
	const formatDue = (dueAt: string) => {
		const due = new Date(dueAt);
		return (
			due.getFullYear() === currentYear ? sameYearDate : otherYearDate
		).format(due);
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.deadlines")}</CardTitle>
			</CardHeader>
			<CardContent>
				{deadlines.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("matters.noDeadlines")}
					</p>
				) : (
					<ul className="grid gap-4">
						{deadlines.map((deadline) => {
							const KindIcon = KIND_ICON[deadline.kind];
							return (
								<li key={deadline.id} className="flex items-center gap-3">
									<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
										<KindIcon className="size-4" />
									</span>
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="font-medium text-sm" dir="auto">
											{deadline.title}
										</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{`${t(`deadlineKinds.${deadline.kind}`)} · ${formatDue(deadline.dueAt)} · ${formatRelativeTime(deadline.dueAt, now, locale)}`}
										</span>
									</span>
									<PriorityBadge
										priority={deadlinePriority(deadline.dueAt, now)}
									/>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
