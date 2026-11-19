// The "Recently uploaded" card of the home: the five newest files with their size, upload day, and a row menu.
// OverviewPage renders it beside the transfer card, from overviewQueryOptions. "View all" opens the Recent page.
// The row menu opens the file page or copies its link.
import { DotsThreeIcon, FileIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	FileTile,
	fileUrl,
	formatBytes,
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
import { CaretRightIcon } from "~/shared/ui/icons";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { RecentUpload } from "../lib/series";

type RecentUploadsCardProps = {
	/** The newest files, newest first. */
	uploads: RecentUpload[];
};

/** A plain table: name, size, upload day, and the menu column. No paging: the card shows five rows. */
export function RecentUploadsCard({ uploads }: RecentUploadsCardProps) {
	const { t, locale } = useT();
	const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.recentTitle")}</CardTitle>
				<CardAction>
					<Button variant="outline" asChild>
						<Link to="/app/recent">
							<span className="hidden lg:inline">{t("overview.viewAll")}</span>
							<span className="sr-only lg:hidden">{t("overview.viewAll")}</span>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{uploads.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("overview.recentEmpty")}
					</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("files.columns.name")}</TableHead>
									<TableHead>{t("files.columns.size")}</TableHead>
									<TableHead>{t("overview.uploadDate")}</TableHead>
									<TableHead className="text-end">
										{t("table.actions")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{uploads.map((upload) => (
									<TableRow key={upload.id}>
										<TableCell className="max-w-56">
											<Link
												to="/app/files/$fileId"
												params={{ fileId: upload.id }}
												className="flex min-w-0 items-center gap-2 text-muted-foreground hover:text-primary hover:underline"
											>
												<FileTile kind={upload.kind} size="xs" />
												<span className="truncate" dir="auto">
													{upload.name}
												</span>
											</Link>
										</TableCell>
										<TableCell className="tabular-nums">
											{formatBytes(upload.sizeBytes, locale)}
										</TableCell>
										<TableCell className="tabular-nums">
											{dayFormat.format(new Date(upload.uploadedAt))}
										</TableCell>
										<TableCell className="text-end">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="size-8"
														aria-label={t("table.rowActions")}
													>
														<DotsThreeIcon className="size-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="min-w-40">
													<DropdownMenuItem asChild>
														<Link
															to="/app/files/$fileId"
															params={{ fileId: upload.id }}
														>
															<FileIcon />
															{t("files.open")}
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem
														onSelect={() =>
															copyToClipboard(fileUrl(upload.id), {
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
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
