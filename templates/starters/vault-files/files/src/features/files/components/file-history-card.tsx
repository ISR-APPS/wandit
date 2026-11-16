// The timeline of one file: its uploads, new versions, and shares, newest first.
// FileDetailPage renders it in the rail. It reads the feed entries of buildFileDetail.
import {
	type ActivityItem,
	ActivityMark,
	formatRelativeTime,
} from "~/features/workspace";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

// The rail shows the newest entries only. The Recent page shows the whole feed.
const HISTORY_LIMIT = 8;

// The sentence of each entry. The file is the subject of the card, so the sentence does not name it.
function historyKey(item: ActivityItem): TranslationKey {
	if (item.action === "shared") {
		return item.recipientNames.length > 0
			? "activity.history.sharedWith"
			: "activity.history.sharedLink";
	}
	return `activity.history.${item.action}`;
}

type FileHistoryCardProps = {
	/** The feed entries of this file, newest first. */
	activity: ActivityItem[];
};

/** A vertical timeline. A line behind the marks links the entries. */
export function FileHistoryCard({ activity }: FileHistoryCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.history")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="relative grid gap-4 before:absolute before:start-3.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
					{activity.slice(0, HISTORY_LIMIT).map((item) => (
						<li key={item.id} className="flex gap-3 text-sm">
							<ActivityMark action={item.action} />
							<div className="grid min-w-0 gap-0.5 pt-1">
								<p>
									<span className="font-medium">{item.actorName}</span>{" "}
									{t(historyKey(item))
										.replace(
											"{version}",
											number.format(item.versionNumber ?? 0),
										)
										.replace("{people}", item.recipientNames.join(", "))}
								</p>
								<p className="text-muted-foreground text-xs">
									{formatRelativeTime(item.at, now, locale)}
								</p>
							</div>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
