// One quick-access folder of the home: the folder name, a row menu, its file count, and the time of its last change.
// OverviewPage renders three of them beside the storage card, from overviewQueryOptions.
// "Open" goes to the folder in the Files page. "Copy link" puts the folder URL on the clipboard.
import {
	ArrowRightIcon,
	DotsThreeVerticalIcon,
	FolderSimpleIcon,
	LinkSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	fillCount,
	folderUrl,
	formatRelativeTime,
	pluralForm,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import type { QuickFolder } from "../lib/series";

type FolderCardProps = {
	folder: QuickFolder;
	/** The current time in milliseconds. The page reads it once, so all cards use one clock. */
	now: number;
};

/** The count sits in a muted box, as in the kit folder card. The arrow button opens the folder. */
export function FolderCard({ folder, now }: FolderCardProps) {
	const { t, locale } = useT();
	const folderLocation = {
		to: "/app/files",
		search: { folder: folder.id },
	} as const;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex min-w-0 items-center gap-2">
					<FolderSimpleIcon className="size-4 shrink-0 text-primary" />
					<span className="truncate" dir="auto">
						{folder.name}
					</span>
				</CardTitle>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="-mt-1.5 size-8"
								aria-label={t("table.rowActions")}
							>
								<DotsThreeVerticalIcon className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-40">
							<DropdownMenuItem asChild>
								<Link {...folderLocation}>
									<FolderSimpleIcon />
									{t("files.open")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(folderUrl(folder.id), {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								<LinkSimpleIcon />
								{t("files.copyLink")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-3">
				<p className="rounded-md border bg-muted px-4 py-2 text-sm tabular-nums">
					{fillCount(
						t(`files.fileCount.${pluralForm(folder.fileCount, locale)}`),
						folder.fileCount,
						locale,
					)}
				</p>
				<div className="flex items-center justify-between gap-2">
					<p className="text-muted-foreground text-xs">
						{t("overview.lastUpdate").replace(
							"{time}",
							formatRelativeTime(folder.modifiedAt, now, locale),
						)}
					</p>
					<Button variant="ghost" size="icon" className="size-8" asChild>
						<Link
							{...folderLocation}
							aria-label={`${t("files.open")} ${folder.name}`}
						>
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
