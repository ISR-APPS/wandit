// The newest rows of the home: the 6 files that changed last, with who changed them, sharing, size, and time.
// OverviewPage renders it with the first rows of filesQueryOptions. "See all" opens the Recent page.
import { LinkSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	type FileItem,
	FileNameCell,
	formatBytes,
	formatRelativeTime,
	MemberAvatar,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

type RecentFilesCardProps = {
	/** The newest changes first. The card shows them all: the page passes 6. */
	files: FileItem[];
};

/** A table that scrolls inside the panel at 375 px. The relative time and the exact time sit at the end. */
export function RecentFilesCard({ files }: RecentFilesCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const exactTime = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.recentTitle")}</CardTitle>
				<CardAction>
					<Link
						to="/app/recent"
						className="font-medium text-sm underline decoration-ring underline-offset-4"
					>
						{t("overview.seeAll")}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent>
				{files.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("overview.recentEmpty")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("files.columns.name")}</TableHead>
								<TableHead>{t("overview.changedBy")}</TableHead>
								<TableHead>{t("files.columns.sharing")}</TableHead>
								<TableHead className="text-end">
									{t("files.columns.size")}
								</TableHead>
								<TableHead className="text-end">
									{t("files.columns.modified")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{files.map((file) => (
								<TableRow key={file.id}>
									<TableCell>
										<FileNameCell
											fileId={file.id}
											name={file.name}
											kind={file.kind}
											path={file.path}
										/>
									</TableCell>
									<TableCell>
										<span className="flex items-center gap-2 whitespace-nowrap">
											<MemberAvatar name={file.modifiedByName} />
											{/* A phone shows the avatar only. Screen readers still read the name. */}
											<span className="sr-only @md/main:not-sr-only">
												{file.modifiedByName}
											</span>
										</span>
									</TableCell>
									<TableCell>
										{file.liveShareCount > 0 ? (
											<Badge variant="info">
												<LinkSimpleIcon />
												{t("files.shared")}
											</Badge>
										) : (
											<Badge variant="secondary">{t("files.teamOnly")}</Badge>
										)}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{formatBytes(file.sizeBytes, locale)}
									</TableCell>
									<TableCell className="whitespace-nowrap text-end">
										{/* The relative day reads fast; the exact time tells apart the changes of one day. */}
										<span className="grid justify-items-end">
											<span>
												{formatRelativeTime(file.modifiedAt, now, locale)}
											</span>
											<span className="text-muted-foreground text-xs tabular-nums">
												{exactTime.format(new Date(file.modifiedAt))}
											</span>
										</span>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

// Placeholder rows. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder of the newest rows panel. */
export function RecentFilesCardSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-36" />
			</CardHeader>
			<CardContent className="grid gap-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</CardContent>
		</Card>
	);
}
