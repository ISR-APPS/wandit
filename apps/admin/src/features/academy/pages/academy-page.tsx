import { Link, useNavigate } from "@tanstack/react-router";
import {
	type AcademyGuideStatus,
	type AdminAcademyGuideListItem,
	youtubeThumbnailUrl,
} from "@wandit/contracts";
import {
	BookOpenIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeOffIcon,
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	SendIcon,
	Trash2Icon,
	VideoOffIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
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
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
	useDeleteAcademyGuideMutation,
	useUpdateAcademyGuideMutation,
} from "../api/academy.mutations";
import { useAcademyGuidesQuery } from "../api/academy.queries";
import {
	academyCategoryLabel,
	errorMessage,
	formatGuideDate,
	pageAfterListItemRemoval,
} from "../lib/academy-helpers";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROW_KEYS = ["one", "two", "three", "four", "five", "six"];

type StatusFilter = AcademyGuideStatus | "all";

export function AcademyPage() {
	const navigate = useNavigate();
	const canManage = useAdminPermission({ academy: ["manage"] });
	const [page, setPage] = useState(1);
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [deleteTarget, setDeleteTarget] =
		useState<AdminAcademyGuideListItem | null>(null);
	const updateMutation = useUpdateAcademyGuideMutation();
	const deleteMutation = useDeleteAcademyGuideMutation();

	useEffect(() => {
		const handle = window.setTimeout(() => {
			setDebouncedQuery(searchValue.trim());
			setPage(1);
		}, SEARCH_DEBOUNCE_MS);

		return () => window.clearTimeout(handle);
	}, [searchValue]);

	const guidesQuery = useAcademyGuidesQuery({
		page,
		pageSize: PAGE_SIZE,
		q: debouncedQuery || undefined,
		status: status === "all" ? undefined : status,
	});
	const result = guidesQuery.data;
	const hasFilters = debouncedQuery.length > 0 || status !== "all";

	async function togglePublication(guide: AdminAcademyGuideListItem) {
		const nextStatus: AcademyGuideStatus =
			guide.status === "published" ? "draft" : "published";

		try {
			await updateMutation.mutateAsync({
				guideId: guide.id,
				data: { status: nextStatus },
			});
			toast.success(
				nextStatus === "published"
					? "Guide was published."
					: "Guide was unpublished.",
			);
			if (status !== "all") {
				setPage((current) =>
					pageAfterListItemRemoval(current, result?.items.length ?? 0),
				);
			}
		} catch (error) {
			toast.error(errorMessage(error, "The guide could not be updated."));
		}
	}

	async function deleteGuide() {
		if (!deleteTarget) {
			return;
		}

		try {
			await deleteMutation.mutateAsync(deleteTarget.id);
			toast.success("Guide was deleted.");
			setDeleteTarget(null);
			setPage((current) =>
				pageAfterListItemRemoval(current, result?.items.length ?? 0),
			);
		} catch (error) {
			toast.error(errorMessage(error, "The guide could not be deleted."));
		}
	}

	function clearFilters() {
		setSearchValue("");
		setDebouncedQuery("");
		setStatus("all");
		setPage(1);
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Learning library
					</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">
						Academy
					</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
						Create, organize, and publish guides for the Academy library.
					</p>
				</div>

				{canManage ? (
					<Button asChild>
						<Link to="/academy/new">
							<PlusIcon aria-hidden="true" />
							New guide
						</Link>
					</Button>
				) : null}
			</div>

			<section
				aria-label="Academy guides"
				className="overflow-hidden rounded-xl border bg-background"
			>
				<div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
					<div className="relative min-w-0 flex-1 sm:max-w-md">
						<SearchIcon
							aria-hidden="true"
							className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							placeholder="Search guides..."
							aria-label="Search guides"
							maxLength={200}
							className="ps-9"
						/>
					</div>
					<Select
						value={status}
						onValueChange={(value) => {
							setStatus(value as StatusFilter);
							setPage(1);
						}}
					>
						<SelectTrigger
							className="w-full sm:w-44"
							aria-label="Filter guides by status"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="draft">Draft</SelectItem>
								<SelectItem value="published">Published</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>

				{guidesQuery.isPending ? (
					<AcademyTableSkeleton />
				) : guidesQuery.isError || !result ? (
					<Empty className="min-h-[360px] border-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<BookOpenIcon />
							</EmptyMedia>
							<EmptyTitle>Academy could not be loaded</EmptyTitle>
							<EmptyDescription>
								{errorMessage(
									guidesQuery.error,
									"Retry the request to restore guide management.",
								)}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button type="button" onClick={() => void guidesQuery.refetch()}>
								<RefreshCwIcon aria-hidden="true" />
								Retry
							</Button>
						</EmptyContent>
					</Empty>
				) : result.items.length === 0 ? (
					<AcademyEmptyState
						hasFilters={hasFilters}
						onClearFilters={clearFilters}
					/>
				) : (
					<>
						<Table className="min-w-[880px]">
							<TableHeader>
								<TableRow>
									<TableHead className="ps-4">Title</TableHead>
									<TableHead>Video</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Updated</TableHead>
									<TableHead className="pe-4 text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{result.items.map((guide) => {
									const isUpdating =
										updateMutation.isPending &&
										updateMutation.variables?.guideId === guide.id;

									return (
										<TableRow
											key={guide.id}
											className="cursor-pointer"
											onClick={() =>
												void navigate({
													to: "/academy/$guideId",
													params: { guideId: guide.id },
												})
											}
										>
											<TableCell className="max-w-md whitespace-normal py-3 ps-4">
												<Link
													to="/academy/$guideId"
													params={{ guideId: guide.id }}
													className="font-medium text-foreground hover:underline"
													onClick={(event) => event.stopPropagation()}
												>
													{guide.title}
												</Link>
												<p className="mt-1 text-muted-foreground text-xs">
													{guide.category === null
														? "Uncategorized"
														: academyCategoryLabel(guide.category)}
												</p>
											</TableCell>
											<TableCell>
												<GuideVideo guide={guide} />
											</TableCell>
											<TableCell>
												<GuideStatusBadge status={guide.status} />
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatGuideDate(guide.updatedAt)}
											</TableCell>
											<TableCell className="pe-4">
												{canManage ? (
													<div className="flex justify-end gap-1">
														<Button asChild variant="ghost" size="sm">
															<Link
																to="/academy/$guideId"
																params={{ guideId: guide.id }}
																onClick={(event) => event.stopPropagation()}
															>
																<PencilIcon aria-hidden="true" />
																Edit
															</Link>
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															disabled={
																updateMutation.isPending ||
																deleteMutation.isPending
															}
															onClick={(event) => {
																event.stopPropagation();
																void togglePublication(guide);
															}}
														>
															{isUpdating ? (
																<Loader2Icon
																	aria-hidden="true"
																	className="animate-spin"
																/>
															) : guide.status === "published" ? (
																<EyeOffIcon aria-hidden="true" />
															) : (
																<SendIcon aria-hidden="true" />
															)}
															{guide.status === "published"
																? "Unpublish"
																: "Publish"}
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															disabled={
																updateMutation.isPending ||
																deleteMutation.isPending
															}
															className="text-destructive hover:bg-destructive/10 hover:text-destructive"
															onClick={(event) => {
																event.stopPropagation();
																setDeleteTarget(guide);
															}}
														>
															<Trash2Icon aria-hidden="true" />
															Delete
														</Button>
													</div>
												) : null}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
						<AcademyPagination
							page={result.page}
							pageSize={result.pageSize}
							total={result.total}
							onPageChange={setPage}
						/>
					</>
				)}
			</section>

			<AlertDialog
				open={canManage && Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open && !deleteMutation.isPending) {
						setDeleteTarget(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this guide?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes the guide. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={deleteMutation.isPending}
							onClick={(event) => {
								event.preventDefault();
								void deleteGuide();
							}}
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete guide"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function GuideStatusBadge({ status }: { status: AcademyGuideStatus }) {
	return (
		<Badge variant={status === "published" ? "default" : "secondary"}>
			{status === "published" ? "Published" : "Draft"}
		</Badge>
	);
}

function GuideVideo({ guide }: { guide: AdminAcademyGuideListItem }) {
	if (!guide.youtubeVideoId) {
		return (
			<span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
				<VideoOffIcon aria-hidden="true" className="size-4" />
				<span>—</span>
			</span>
		);
	}

	return (
		<div className="aspect-video w-20 overflow-hidden rounded-md border bg-muted">
			<img
				src={youtubeThumbnailUrl(guide.youtubeVideoId)}
				alt={`YouTube thumbnail for ${guide.title}`}
				loading="lazy"
				className="size-full object-cover"
			/>
		</div>
	);
}

function AcademyTableSkeleton() {
	return (
		<Table className="min-w-[880px]">
			<TableHeader>
				<TableRow>
					<TableHead className="ps-4">Title</TableHead>
					<TableHead>Video</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Updated</TableHead>
					<TableHead className="pe-4 text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{SKELETON_ROW_KEYS.map((rowKey) => (
					<TableRow key={rowKey}>
						<TableCell className="space-y-2 py-3 ps-4">
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-3 w-24" />
						</TableCell>
						<TableCell>
							<Skeleton className="aspect-video w-20 rounded-md" />
						</TableCell>
						<TableCell>
							<Skeleton className="h-5 w-20 rounded-full" />
						</TableCell>
						<TableCell>
							<Skeleton className="h-4 w-24" />
						</TableCell>
						<TableCell className="pe-4">
							<div className="flex justify-end gap-2">
								<Skeleton className="h-8 w-16" />
								<Skeleton className="h-8 w-24" />
								<Skeleton className="h-8 w-20" />
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function AcademyEmptyState({
	hasFilters,
	onClearFilters,
}: {
	hasFilters: boolean;
	onClearFilters: () => void;
}) {
	const canManage = useAdminPermission({ academy: ["manage"] });

	return (
		<Empty className="min-h-[360px] border-0">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<BookOpenIcon />
				</EmptyMedia>
				<EmptyTitle>
					{hasFilters ? "No guides match your filters" : "No guides yet"}
				</EmptyTitle>
				<EmptyDescription>
					{hasFilters
						? "Try another search or clear the status filter."
						: "Create the first tutorial for your Academy library."}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				{hasFilters ? (
					<Button type="button" variant="outline" onClick={onClearFilters}>
						Clear filters
					</Button>
				) : canManage ? (
					<Button asChild>
						<Link to="/academy/new">
							<PlusIcon aria-hidden="true" />
							Create your first guide
						</Link>
					</Button>
				) : null}
			</EmptyContent>
		</Empty>
	);
}

function AcademyPagination({
	page,
	pageSize,
	total,
	onPageChange,
}: {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
}) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-2 border-t px-4 py-3 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
			<span>
				{from.toLocaleString("en-US")}–{to.toLocaleString("en-US")} of{" "}
				{total.toLocaleString("en-US")}
			</span>
			<div className="flex items-center gap-2">
				<span>
					Page {page.toLocaleString("en-US")} of{" "}
					{pageCount.toLocaleString("en-US")}
				</span>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<ChevronLeftIcon aria-hidden="true" />
					<span className="sr-only">Previous page</span>
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					disabled={page >= pageCount}
					onClick={() => onPageChange(page + 1)}
				>
					<ChevronRightIcon aria-hidden="true" />
					<span className="sr-only">Next page</span>
				</Button>
			</div>
		</div>
	);
}
