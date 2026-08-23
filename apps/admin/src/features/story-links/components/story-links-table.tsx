import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	EllipsisIcon,
	EyeIcon,
	Loader2Icon,
	PencilIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import {
	formatOverviewDate,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import type {
	StoryLinkListItem,
	StoryLinksQuery,
} from "@/features/story-links/api/story-links.dto";
import { useUpdateStoryLinkMutation } from "@/features/story-links/api/story-links.mutations";
import { RenameStoryLinkDialog } from "@/features/story-links/components/rename-story-link-dialog";
import { StoryLinkDetailSheet } from "@/features/story-links/components/story-link-detail-sheet";
import { StoryLinkShortUrl } from "@/features/story-links/components/story-link-short-url";
import { sortStoryLinksArchivedLast } from "@/features/story-links/lib/story-link-helpers";
import { cn } from "@/lib/utils";

type StoryLinksTableProps = {
	links: readonly StoryLinkListItem[];
	query: StoryLinksQuery;
};

function StoryLinksTable({ links, query }: StoryLinksTableProps) {
	const canManage = useAdminPermission({ links: ["manage"] });
	const updateMutation = useUpdateStoryLinkMutation();
	const updatingRef = useRef(false);
	const [renameLink, setRenameLink] = useState<StoryLinkListItem | null>(null);
	const [archiveLink, setArchiveLink] = useState<StoryLinkListItem | null>(
		null,
	);
	const [detailLinkId, setDetailLinkId] = useState<string | null>(null);
	const [updatingId, setUpdatingId] = useState<string | null>(null);
	const sortedLinks = sortStoryLinksArchivedLast(links);

	async function toggleArchived(link: StoryLinkListItem) {
		if (updatingRef.current) {
			return false;
		}

		const willArchive = link.archivedAt === null;
		updatingRef.current = true;
		setUpdatingId(link.id);

		try {
			await updateMutation.mutateAsync({
				storyLinkId: link.id,
				data: { archived: willArchive },
			});
			toast.success(
				`${link.name} was ${willArchive ? "archived" : "unarchived"}.`,
			);
			return true;
		} catch (error) {
			toast.error(
				error instanceof Error && error.message
					? error.message
					: `The story link could not be ${willArchive ? "archived" : "unarchived"}.`,
			);
			return false;
		} finally {
			updatingRef.current = false;
			setUpdatingId(null);
		}
	}

	function requestArchiveChange(link: StoryLinkListItem) {
		if (link.archivedAt === null) {
			setArchiveLink(link);
			return;
		}

		void toggleArchived(link);
	}

	async function confirmArchive() {
		if (!archiveLink) {
			return;
		}

		const archived = await toggleArchived(archiveLink);
		if (archived) {
			setArchiveLink(null);
		}
	}

	return (
		<>
			<Card className="gap-0 overflow-hidden py-0 shadow-none">
				<CardHeader className="border-b pt-6">
					<CardTitle>
						<h2>Story links</h2>
					</CardTitle>
					<CardDescription className="mt-1">
						Active links appear first. Slugs and campaign details are locked
						after creation.
					</CardDescription>
				</CardHeader>

				<CardContent className="p-0">
					<div className="divide-y lg:hidden">
						{sortedLinks.map((link) => (
							<StoryLinkMobileCard
								key={link.id}
								link={link}
								isUpdating={updatingId === link.id}
								disableActions={updateMutation.isPending}
								onDetails={() => setDetailLinkId(link.id)}
								onRename={() => setRenameLink(link)}
								onToggleArchived={() => requestArchiveChange(link)}
								showActions={canManage}
							/>
						))}
					</div>

					<div className="hidden lg:block">
						<Table className="min-w-[1420px]">
							<TableHeader className="bg-muted/20">
								<TableRow>
									<TableHead className="min-w-52 px-4">Name</TableHead>
									<TableHead className="min-w-72">Short URL</TableHead>
									<TableHead className="min-w-32">Source</TableHead>
									<TableHead className="min-w-28">Medium</TableHead>
									<TableHead className="min-w-40">Campaign</TableHead>
									<TableHead className="text-right">Clicks (range)</TableHead>
									<TableHead className="text-right">Unique (range)</TableHead>
									<TableHead className="text-right">All-time clicks</TableHead>
									<TableHead className="min-w-32">Created</TableHead>
									<TableHead className="w-14 px-3 text-right">
										<span className="sr-only">Actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedLinks.map((link) => {
									const archived = link.archivedAt !== null;

									return (
										<TableRow
											key={link.id}
											className={cn(
												"group",
												archived &&
													"bg-muted/20 text-muted-foreground hover:bg-muted/30",
											)}
										>
											<TableCell className="px-4 py-3">
												<div className="flex min-w-0 items-center gap-2">
													<button
														type="button"
														className={cn(
															"max-w-48 truncate text-left font-medium outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
															!archived && "text-foreground",
														)}
														title={link.name}
														onClick={() => setDetailLinkId(link.id)}
													>
														{link.name}
													</button>
													{archived ? <ArchivedBadge /> : null}
												</div>
											</TableCell>
											<TableCell>
												<StoryLinkShortUrl link={link} />
											</TableCell>
											<TableCell>
												<AttributionBadge
													label="Source"
													value={link.utmSource}
												/>
											</TableCell>
											<TableCell>
												<AttributionBadge
													label="Medium"
													value={link.utmMedium}
												/>
											</TableCell>
											<TableCell>
												<AttributionBadge
													label="Campaign"
													value={link.utmCampaign}
												/>
											</TableCell>
											<CountCell value={link.clicksInRange} />
											<CountCell value={link.uniqueVisitorsInRange} />
											<CountCell value={link.allTimeClicks} />
											<TableCell className="text-muted-foreground tabular-nums">
												{formatOverviewDate(link.createdAt)}
											</TableCell>
											<TableCell className="px-3 text-right">
												{canManage ? (
													<StoryLinkActions
														link={link}
														isUpdating={updatingId === link.id}
														disabled={updateMutation.isPending}
														onDetails={() => setDetailLinkId(link.id)}
														onRename={() => setRenameLink(link)}
														onToggleArchived={() => requestArchiveChange(link)}
													/>
												) : null}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<StoryLinkDetailSheet
				storyLinkId={detailLinkId}
				query={query}
				onClose={() => setDetailLinkId(null)}
			/>

			{canManage && renameLink ? (
				<RenameStoryLinkDialog
					key={renameLink.id}
					link={renameLink}
					open
					onOpenChange={(next) => {
						if (!next) {
							setRenameLink(null);
						}
					}}
				/>
			) : null}

			<AlertDialog
				open={canManage && Boolean(archiveLink)}
				onOpenChange={(next) => {
					if (!next && !updateMutation.isPending) {
						setArchiveLink(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Archive this story link?</AlertDialogTitle>
						<AlertDialogDescription>
							{archiveLink?.name} will stop redirecting visitors. Its past click
							data stays in this report, and you can unarchive it later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={updateMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={updateMutation.isPending}
							onClick={(event) => {
								event.preventDefault();
								void confirmArchive();
							}}
						>
							{updateMutation.isPending ? "Archiving…" : "Archive link"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

type StoryLinkMobileCardProps = {
	link: StoryLinkListItem;
	isUpdating: boolean;
	disableActions: boolean;
	onDetails: () => void;
	onRename: () => void;
	onToggleArchived: () => void;
	showActions: boolean;
};

function StoryLinkMobileCard({
	link,
	isUpdating,
	disableActions,
	onDetails,
	onRename,
	onToggleArchived,
	showActions,
}: StoryLinkMobileCardProps) {
	const archived = link.archivedAt !== null;

	return (
		<article
			className={cn("p-4", archived && "bg-muted/20 text-muted-foreground")}
		>
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<h3 className="min-w-0">
							<button
								type="button"
								className={cn(
									"block max-w-full truncate text-left font-medium outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
									!archived && "text-foreground",
								)}
								title={link.name}
								onClick={onDetails}
							>
								{link.name}
							</button>
						</h3>
						{archived ? <ArchivedBadge /> : null}
					</div>
					<div className="mt-2">
						<StoryLinkShortUrl link={link} mobile />
					</div>
				</div>
				{showActions ? (
					<StoryLinkActions
						link={link}
						isUpdating={isUpdating}
						disabled={disableActions}
						onDetails={onDetails}
						onRename={onRename}
						onToggleArchived={onToggleArchived}
					/>
				) : null}
			</div>

			<div className="mt-4 flex flex-wrap gap-1.5">
				<AttributionBadge label="Source" value={link.utmSource} showLabel />
				<AttributionBadge label="Medium" value={link.utmMedium} showLabel />
				<AttributionBadge label="Campaign" value={link.utmCampaign} showLabel />
			</div>

			<div className="mt-4 grid grid-cols-3 divide-x rounded-lg border bg-background/70">
				<MobileCount label="Clicks (range)" value={link.clicksInRange} />
				<MobileCount
					label="Unique (range)"
					value={link.uniqueVisitorsInRange}
				/>
				<MobileCount label="All-time clicks" value={link.allTimeClicks} />
			</div>

			<p className="mt-3 text-muted-foreground text-xs tabular-nums">
				Created {formatOverviewDate(link.createdAt)}
			</p>
		</article>
	);
}

function StoryLinkActions({
	link,
	isUpdating,
	disabled,
	onDetails,
	onRename,
	onToggleArchived,
}: {
	link: StoryLinkListItem;
	isUpdating: boolean;
	disabled: boolean;
	onDetails: () => void;
	onRename: () => void;
	onToggleArchived: () => void;
}) {
	const archived = link.archivedAt !== null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="data-[state=open]:bg-accent"
					disabled={disabled}
					aria-label={`Open actions for ${link.name}`}
				>
					{isUpdating ? (
						<Loader2Icon className="animate-spin" />
					) : (
						<EllipsisIcon />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuLabel className="truncate">{link.name}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={onDetails}>
						<EyeIcon />
						View details
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onRename}>
						<PencilIcon />
						Rename
					</DropdownMenuItem>
					<DropdownMenuItem
						variant={archived ? "default" : "destructive"}
						onSelect={onToggleArchived}
					>
						{archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
						{archived ? "Unarchive" : "Archive"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AttributionBadge({
	label,
	value,
	showLabel = false,
}: {
	label: string;
	value: string;
	showLabel?: boolean;
}) {
	return (
		<Badge
			variant="outline"
			className="max-w-44 bg-muted/30 px-1.5 font-normal text-muted-foreground"
			title={value}
			aria-label={`${label}: ${value}`}
		>
			{showLabel ? <span className="text-foreground/60">{label}:</span> : null}
			<span className="truncate">{value}</span>
		</Badge>
	);
}

function ArchivedBadge() {
	return (
		<Badge
			variant="outline"
			className="border-border bg-muted/60 text-muted-foreground"
		>
			Archived
		</Badge>
	);
}

function CountCell({ value }: { value: number }) {
	return (
		<TableCell className="text-right font-medium tabular-nums">
			{formatOverviewWholeNumber(value)}
		</TableCell>
	);
}

function MobileCount({ label, value }: { label: string; value: number }) {
	return (
		<div className="min-w-0 px-3 py-3 text-center">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className="mt-1 font-medium text-sm tabular-nums">
				{formatOverviewWholeNumber(value)}
			</p>
		</div>
	);
}

export type { StoryLinksTableProps };
export { StoryLinksTable };
