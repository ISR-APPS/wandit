// One line of the Recent feed: the action mark, a sentence with the person and the file, and the place and time.
// RecentPage renders one per feed entry. A file in the trash shows its name with no link and an "In trash" badge.
import { Link } from "@tanstack/react-router";
import { type ActivityItem, ActivityMark } from "~/features/workspace";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";

/** The sentence of each action. "{file}" marks the place of the file name. */
function sentenceKey(item: ActivityItem): TranslationKey {
	if (item.action === "shared") {
		return item.recipientNames.length > 0
			? "activity.sentences.sharedWith"
			: "activity.sentences.sharedLink";
	}
	return `activity.sentences.${item.action}`;
}

type ActivityEntryProps = {
	item: ActivityItem;
};

/** A list item. The sentence wraps; the file name never breaks the line height. */
export function ActivityEntry({ item }: ActivityEntryProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const sentence = t(sentenceKey(item))
		.replace(
			"{version}",
			new Intl.NumberFormat(locale).format(item.versionNumber ?? 0),
		)
		.replace("{people}", item.recipientNames.join(", "));
	const [before = "", after = ""] = sentence.split("{file}");
	const fileName = item.isInTrash ? (
		<span className="font-medium" dir="auto">
			{item.fileName}
		</span>
	) : (
		<Link
			to="/app/files/$fileId"
			params={{ fileId: item.fileId }}
			className="font-medium hover:underline"
			dir="auto"
		>
			{item.fileName}
		</Link>
	);

	return (
		<li className="flex gap-3 py-3 text-sm">
			<ActivityMark action={item.action} />
			<div className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
				<p className="break-words">
					<span className="font-medium">{item.actorName}</span> {before}
					{fileName}
					{after}
					{item.isInTrash && item.action !== "deleted" ? (
						<Badge variant="outline" className="ms-2 align-middle">
							{t("activity.inTrash")}
						</Badge>
					) : null}
				</p>
				<p className="truncate text-muted-foreground text-xs" dir="auto">
					{`${item.path.length > 0 ? item.path.join(" / ") : t("files.allFiles")}`}
				</p>
			</div>
			<time
				dateTime={item.at}
				className="shrink-0 pt-0.5 text-muted-foreground text-xs tabular-nums"
			>
				{time.format(new Date(item.at))}
			</time>
		</li>
	);
}
