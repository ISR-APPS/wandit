import { Link, useNavigate } from "@tanstack/react-router";
import {
	ACADEMY_GUIDE_CATEGORIES,
	type AcademyGuide,
	type AcademyGuideCategory,
	type AcademyGuideStatus,
	parseYouTubeVideoId,
	youtubeEmbedUrl,
} from "@wandit/contracts";
import {
	ArrowLeftIcon,
	BookOpenTextIcon,
	Loader2Icon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	useCreateAcademyGuideMutation,
	useDeleteAcademyGuideMutation,
	useUpdateAcademyGuideMutation,
} from "@/features/academy/api/academy.mutations";
import { useAcademyGuideQuery } from "@/features/academy/api/academy.queries";
import { RichTextEditor } from "@/features/academy/components/rich-text-editor";
import {
	academyCategoryLabel,
	canSaveGuide,
	errorMessage,
	hasGuideBodyContent,
	isAcademyGuideCategory,
} from "@/features/academy/lib/academy-helpers";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import { cn } from "@/lib/utils";

type AcademyEditorPageProps = {
	guideId?: string;
};

type SaveIntent = "publish" | "save" | "unpublish";

const MAX_BODY_HTML_LENGTH = 300_000;
const NO_CATEGORY_SELECT_VALUE = "__no-category__";

export function AcademyEditorPage({ guideId }: AcademyEditorPageProps) {
	const guideQuery = useAcademyGuideQuery(guideId);
	const isEditing = guideId !== undefined;

	if (isEditing && guideQuery.isPending) {
		return <AcademyEditorSkeleton />;
	}

	if (isEditing && !guideQuery.data) {
		return (
			<div className="mx-auto w-full max-w-4xl space-y-6">
				<AcademyBackLink />
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<BookOpenTextIcon />
						</EmptyMedia>
						<EmptyTitle>Guide could not be loaded</EmptyTitle>
						<EmptyDescription>
							{errorMessage(
								guideQuery.error,
								"Retry the request or return to the Academy.",
							)}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void guideQuery.refetch()}>
							<RefreshCwIcon aria-hidden="true" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<AcademyGuideEditor
			key={guideQuery.data?.id ?? "new-guide"}
			guideId={guideId}
			initialGuide={guideQuery.data ?? null}
			refreshError={isEditing && guideQuery.isError ? guideQuery.error : null}
			onRetry={() => void guideQuery.refetch()}
		/>
	);
}

function AcademyGuideEditor({
	guideId,
	initialGuide,
	refreshError,
	onRetry,
}: {
	guideId?: string;
	initialGuide: AcademyGuide | null;
	refreshError: unknown;
	onRetry: () => void;
}) {
	const navigate = useNavigate();
	const canManage = useAdminPermission({ academy: ["manage"] });
	const createMutation = useCreateAcademyGuideMutation();
	const updateMutation = useUpdateAcademyGuideMutation();
	const deleteMutation = useDeleteAcademyGuideMutation();
	const initialCategory = initialGuide?.category ?? null;
	const [title, setTitle] = useState(() => initialGuide?.title ?? "");
	const [category, setCategory] = useState<AcademyGuideCategory | null>(() =>
		initialCategory !== null && isAcademyGuideCategory(initialCategory)
			? initialCategory
			: null,
	);
	const [legacyCategory, setLegacyCategory] = useState<string | null>(() =>
		initialCategory !== null && !isAcademyGuideCategory(initialCategory)
			? initialCategory
			: null,
	);
	const [description, setDescription] = useState(
		() => initialGuide?.description ?? "",
	);
	const [youtubeUrl, setYoutubeUrl] = useState(
		() => initialGuide?.youtubeUrl ?? "",
	);
	const [bodyHtml, setBodyHtml] = useState(() => initialGuide?.bodyHtml ?? "");
	const [status, setStatus] = useState<AcademyGuideStatus>(
		() => initialGuide?.status ?? "draft",
	);
	const [requestError, setRequestError] = useState<string | null>(null);
	const [showContentError, setShowContentError] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const normalizedYoutubeUrl = youtubeUrl.trim();
	const youtubeVideoId = normalizedYoutubeUrl
		? parseYouTubeVideoId(normalizedYoutubeUrl)
		: null;
	const youtubeIsInvalid =
		normalizedYoutubeUrl.length > 0 && youtubeVideoId === null;
	const bodyIsTooLong = bodyHtml.length > MAX_BODY_HTML_LENGTH;
	const contentIsMissing =
		youtubeVideoId === null && !hasGuideBodyContent(bodyHtml);
	const saving = createMutation.isPending || updateMutation.isPending;
	const busy = saving || deleteMutation.isPending;
	const editorDisabled = busy || !canManage;
	const isPublished = status === "published";

	function applySavedGuide(guide: AcademyGuide) {
		setTitle(guide.title);
		if (guide.category !== null && isAcademyGuideCategory(guide.category)) {
			setCategory(guide.category);
			setLegacyCategory(null);
		} else {
			setCategory(null);
			setLegacyCategory(guide.category);
		}
		setDescription(guide.description ?? "");
		setYoutubeUrl(guide.youtubeUrl ?? "");
		setBodyHtml(guide.bodyHtml);
		setStatus(guide.status);
	}

	async function saveGuide(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canManage) {
			return;
		}
		setRequestError(null);

		const intent = saveIntent(event);
		if (intent === "unpublish" && guideId) {
			try {
				const updatedGuide = await updateMutation.mutateAsync({
					guideId,
					data: { status: "draft" },
				});
				setStatus(updatedGuide.status);
				toast.success("Guide was unpublished.");
			} catch (error) {
				setRequestError(
					errorMessage(error, "The guide could not be unpublished."),
				);
			}
			return;
		}

		setShowContentError(true);
		if (title.trim().length === 0) {
			setRequestError("Enter a title before saving.");
			return;
		}

		if (youtubeIsInvalid) {
			return;
		}

		if (bodyIsTooLong) {
			return;
		}

		if (!canSaveGuide({ title, youtubeVideoId, bodyHtml })) {
			return;
		}

		const nextStatus: AcademyGuideStatus =
			intent === "publish" ? "published" : status;
		const data = {
			title: title.trim(),
			description: description.trim() || null,
			category,
			youtubeUrl: normalizedYoutubeUrl || null,
			bodyHtml,
			status: nextStatus,
		};

		try {
			if (guideId) {
				const updatedGuide = await updateMutation.mutateAsync({
					guideId,
					data,
				});
				applySavedGuide(updatedGuide);
				if (intent === "publish") {
					toast.success("Guide was published.");
				} else {
					toast.success("Guide was updated.");
				}
				return;
			}

			const createdGuide = await createMutation.mutateAsync(data);
			toast.success("Guide was created.");
			await navigate({
				to: "/academy/$guideId",
				params: { guideId: createdGuide.id },
				replace: true,
			});
		} catch (error) {
			setRequestError(errorMessage(error, "The guide could not be saved."));
		}
	}

	async function deleteGuide() {
		if (!canManage || !guideId) {
			return;
		}

		try {
			await deleteMutation.mutateAsync(guideId);
			toast.success("Guide was deleted.");
			await navigate({ to: "/academy" });
		} catch (error) {
			toast.error(errorMessage(error, "The guide could not be deleted."));
		}
	}

	return (
		<div className="mx-auto w-full max-w-4xl pb-12">
			<form onSubmit={saveGuide} className="space-y-8">
				<div className="flex flex-col gap-5 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<AcademyBackLink />
						<h1 className="mt-4 font-semibold text-2xl tracking-tight">
							{guideId ? "Edit guide" : "New guide"}
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							Build a clear tutorial with video, written steps, or both.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2 sm:justify-end">
						<GuideStatusBadge status={status} />
						{canManage && isPublished ? (
							<>
								<Button
									type="submit"
									variant="outline"
									data-intent="unpublish"
									formNoValidate
									disabled={busy}
								>
									{saving ? <Loader2Icon className="animate-spin" /> : null}
									{saving ? "Saving…" : "Unpublish"}
								</Button>
								<Button type="submit" data-intent="save" disabled={busy}>
									{saving ? <Loader2Icon className="animate-spin" /> : null}
									{saving ? "Saving…" : "Save"}
								</Button>
							</>
						) : canManage ? (
							<>
								<Button
									type="submit"
									variant="secondary"
									data-intent="save"
									disabled={busy}
								>
									{saving ? <Loader2Icon className="animate-spin" /> : null}
									{saving ? "Saving…" : "Save draft"}
								</Button>
								<Button type="submit" data-intent="publish" disabled={busy}>
									{saving ? <Loader2Icon className="animate-spin" /> : null}
									{saving ? "Saving…" : "Publish"}
								</Button>
							</>
						) : null}
					</div>
				</div>

				{refreshError ? (
					<div
						role="alert"
						className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-destructive text-sm"
					>
						<span>
							This guide could not be refreshed. Your unsaved changes are still
							here.
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={busy}
							onClick={onRetry}
						>
							<RefreshCwIcon aria-hidden="true" />
							Retry
						</Button>
					</div>
				) : null}

				{requestError ? (
					<div
						role="alert"
						className="rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-destructive text-sm"
					>
						{requestError}
					</div>
				) : null}

				<section className="space-y-6" aria-labelledby="guide-details-heading">
					<div>
						<h2 id="guide-details-heading" className="font-semibold text-base">
							Guide details
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Give people enough context to find the right guide quickly.
						</p>
					</div>

					<EditorField label="Title" htmlFor="academy-guide-title">
						<Input
							id="academy-guide-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Give this guide a clear title"
							required
							maxLength={200}
							disabled={editorDisabled}
							autoFocus={!guideId}
							className="h-12 font-medium text-base sm:text-lg"
						/>
					</EditorField>

					<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
						<EditorField label="Category" htmlFor="academy-guide-category">
							<Select
								value={category ?? NO_CATEGORY_SELECT_VALUE}
								disabled={editorDisabled}
								onValueChange={(value) => {
									if (value === NO_CATEGORY_SELECT_VALUE) {
										setCategory(null);
									} else if (isAcademyGuideCategory(value)) {
										setCategory(value);
									}
								}}
							>
								<SelectTrigger
									id="academy-guide-category"
									className="w-full"
									aria-describedby={
										legacyCategory !== null
											? "academy-guide-category-legacy"
											: undefined
									}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value={NO_CATEGORY_SELECT_VALUE}>
											No category
										</SelectItem>
										{ACADEMY_GUIDE_CATEGORIES.map((option) => (
											<SelectItem key={option} value={option}>
												{academyCategoryLabel(option)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							{legacyCategory !== null ? (
								<p
									id="academy-guide-category-legacy"
									className="text-muted-foreground text-xs"
								>
									Previous category: “{legacyCategory}”. It is no longer
									supported, so No category is selected. Choose a category or
									save to remove the old value.
								</p>
							) : null}
						</EditorField>

						<EditorField
							label="Short description"
							htmlFor="academy-guide-description"
							descriptionId="academy-guide-description-help"
							description="Shown on the guide card in the Academy library."
						>
							<Textarea
								id="academy-guide-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="What will someone learn?"
								maxLength={300}
								disabled={editorDisabled}
								aria-describedby="academy-guide-description-help"
								rows={3}
							/>
						</EditorField>
					</div>
				</section>

				<section
					className="space-y-6 border-t pt-8"
					aria-labelledby="guide-content-heading"
				>
					<div>
						<h2 id="guide-content-heading" className="font-semibold text-base">
							Guide content
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Add a YouTube walkthrough, written instructions, or both.
						</p>
					</div>

					<EditorField label="YouTube link" htmlFor="academy-guide-youtube">
						<Input
							id="academy-guide-youtube"
							type="url"
							value={youtubeUrl}
							onChange={(event) => setYoutubeUrl(event.target.value)}
							placeholder="https://www.youtube.com/watch?v=…"
							disabled={editorDisabled}
							aria-invalid={youtubeIsInvalid}
							aria-describedby={
								youtubeIsInvalid ? "academy-youtube-error" : undefined
							}
						/>
						{youtubeIsInvalid ? (
							<p
								id="academy-youtube-error"
								role="alert"
								className="text-destructive text-sm"
							>
								This does not look like a YouTube link.
							</p>
						) : null}
					</EditorField>

					{youtubeVideoId ? (
						<div className="overflow-hidden rounded-xl border bg-muted/30">
							<div className="aspect-video">
								<iframe
									src={youtubeEmbedUrl(youtubeVideoId)}
									title={`Video preview for ${title.trim() || "this guide"}`}
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
									loading="lazy"
									referrerPolicy="strict-origin-when-cross-origin"
									className="size-full"
								/>
							</div>
						</div>
					) : null}

					<EditorField label="Body" htmlFor="academy-guide-body">
						<RichTextEditor
							id="academy-guide-body"
							value={bodyHtml}
							onChange={setBodyHtml}
							disabled={editorDisabled}
							placeholder="Write the steps, tips, and context for this guide…"
						/>
						{bodyIsTooLong ? (
							<p role="alert" className="text-destructive text-sm">
								The guide body is too long. Shorten it before saving.
							</p>
						) : null}
						{showContentError && contentIsMissing ? (
							<p role="alert" className="text-destructive text-sm">
								Add a YouTube video or body content before saving.
							</p>
						) : null}
					</EditorField>
				</section>

				{canManage && guideId ? (
					<div className="flex items-center justify-between gap-4 border-t pt-6">
						<div>
							<p className="font-medium text-sm">Delete guide</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								This action cannot be undone.
							</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							disabled={busy}
							onClick={() => setDeleteDialogOpen(true)}
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<Trash2Icon aria-hidden="true" />
							Delete guide
						</Button>
					</div>
				) : null}
			</form>

			<AlertDialog
				open={canManage && deleteDialogOpen}
				onOpenChange={(open) => {
					if (!busy) {
						setDeleteDialogOpen(open);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this guide?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes the guide.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={busy}
							onClick={(event) => {
								event.preventDefault();
								void deleteGuide();
							}}
						>
							{deleteMutation.isPending ? (
								<Loader2Icon className="animate-spin" />
							) : null}
							{deleteMutation.isPending ? "Deleting…" : "Delete guide"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function saveIntent(event: FormEvent<HTMLFormElement>): SaveIntent {
	const submitter = (event.nativeEvent as SubmitEvent)
		.submitter as HTMLButtonElement | null;
	const intent = submitter?.dataset.intent;
	if (intent === "publish" || intent === "unpublish" || intent === "save") {
		return intent;
	}
	return "save";
}

function GuideStatusBadge({ status }: { status: AcademyGuideStatus }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				status === "published"
					? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
					: "border-border bg-muted/60 text-muted-foreground",
			)}
		>
			{status === "published" ? "Published" : "Draft"}
		</Badge>
	);
}

function AcademyBackLink() {
	return (
		<Button asChild variant="ghost" size="sm" className="-ml-2">
			<Link to="/academy">
				<ArrowLeftIcon aria-hidden="true" />
				Academy
			</Link>
		</Button>
	);
}

function EditorField({
	label,
	htmlFor,
	description,
	descriptionId,
	children,
}: {
	label: string;
	htmlFor: string;
	description?: string;
	descriptionId?: string;
	children: ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{description ? (
				<p id={descriptionId} className="text-muted-foreground text-xs">
					{description}
				</p>
			) : null}
		</div>
	);
}

function AcademyEditorSkeleton() {
	return (
		<div
			className="mx-auto w-full max-w-4xl space-y-8"
			role="status"
			aria-label="Loading guide"
		>
			<div className="flex items-end justify-between gap-4 border-b pb-5">
				<div className="space-y-3">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-20" />
					<Skeleton className="h-9 w-24" />
				</div>
			</div>
			<div className="space-y-6">
				<Skeleton className="h-12 w-full" />
				<div className="grid gap-6 md:grid-cols-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full md:col-span-2" />
				</div>
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-[380px] w-full" />
			</div>
		</div>
	);
}
