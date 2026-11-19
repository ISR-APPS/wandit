// The line timeline of one file: a mark per event on a start rule, the event title, its time, and one sentence.
// The "Latest activity" card shows the first three events; the Activity tab of the file page shows all of them.
// The first event gets a "Latest" badge and an optional action under its sentence.
import { ClockIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { type ActivityItem, ActivityMark } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";

type FileTimelineProps = {
	/** The events of the file, newest first. */
	activity: ActivityItem[];
	/** A control under the newest event, for example a button that opens the Versions tab. */
	latestAction?: ReactNode;
};

/** An empty list shows one muted sentence. */
export function FileTimeline({ activity, latestAction }: FileTimelineProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
		timeStyle: "short",
	});

	if (activity.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">{t("files.noActivity")}</p>
		);
	}

	return (
		<ol className="relative ms-3.5 grid gap-10 border-s">
			{activity.map((item, index) => (
				<li key={item.id} className="relative grid gap-2 ps-7">
					{/* The mark is 28 px wide; -start-3.5 centers it on the start rule. */}
					<span className="absolute -start-3.5 top-0">
						<ActivityMark action={item.action} />
					</span>
					<h3 className="flex flex-wrap items-center gap-2 font-semibold">
						{t(`activity.titles.${item.action}`)}
						{index === 0 ? (
							<Badge variant="outline">{t("files.latest")}</Badge>
						) : null}
					</h3>
					<time
						dateTime={item.at}
						className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
					>
						<ClockIcon className="size-3" />
						{dateTime.format(new Date(item.at))}
					</time>
					<p className="text-muted-foreground text-sm" dir="auto">
						{`${item.actorName} ${historyPhrase(item, t)}`}
					</p>
					{index === 0 && latestAction ? (
						<div className="pt-1">{latestAction}</div>
					) : null}
				</li>
			))}
		</ol>
	);
}

// The verb phrase of one event: "uploaded version 3", "shared it with Hana Sato".
function historyPhrase(
	item: ActivityItem,
	t: ReturnType<typeof useT>["t"],
): string {
	if (item.action === "updated") {
		return t("activity.history.updated").replace(
			"{version}",
			String(item.versionNumber ?? ""),
		);
	}
	if (item.action === "shared") {
		return item.recipientNames.length > 0
			? t("activity.history.sharedWith").replace(
					"{people}",
					item.recipientNames.join(", "),
				)
			: t("activity.history.sharedLink");
	}
	return t(`activity.history.${item.action}`);
}
