/**
 * Academy guide page at `/academy/$guideId`: the title, the YouTube video, and the guide body.
 * The route file imports it by path and passes the id from the URL.
 * Calls the academy guide query and renders GuideBody for the sanitized HTML.
 */
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { GraduationCapIcon } from "@phosphor-icons/react/GraduationCap";
import { Link } from "@tanstack/react-router";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Separator } from "@wandit/ui/components/separator";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { formatDate, useTranslation } from "@/lib/i18n";
import { useAcademyGuideQuery } from "../api/academy.queries";
import { GuideBody } from "../components/guide-body";
import {
	academyCategoryLabel,
	hasAcademyGuideBodyContent,
} from "../lib/academy-helpers";

// The ghost pill of the back link and the YouTube link. -ms-3 aligns the label with the text column.
const GHOST_PILL_CLASS =
	"-ms-3 rounded-full font-grotesk text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06]";

// The white frame of the video, like the dashboard project card.
const VIDEO_FRAME_CLASS =
	"mt-7 rounded-[1.75rem] bg-white p-1.5 shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

type AcademyGuidePageProps = {
	/** The guide id from the `/academy/$guideId` URL. The API answers 404 for a draft or an unknown id. */
	guideId: string;
};

/** One guide. A failed load and a missing guide show the same "not available" state. */
export default function AcademyGuidePage({ guideId }: AcademyGuidePageProps) {
	const { locale, t } = useTranslation();
	const guideQuery = useAcademyGuideQuery(guideId);

	return (
		<DashboardShell titleKey="academy.title">
			{/* A narrow column: the guide body is long text, and short lines read better. */}
			<div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 md:px-6">
				{guideQuery.isPending ? (
					<>
						<BackToAcademyButton />
						<GuideDetailSkeleton />
					</>
				) : guideQuery.isError || !guideQuery.data ? (
					<GuideUnavailable />
				) : (
					<>
						<BackToAcademyButton />
						<article className="mt-6">
							{guideQuery.data.category || guideQuery.data.publishedAt ? (
								<div className="flex flex-wrap items-center gap-2.5 text-night/60 text-xs dark:text-foreground/60">
									{guideQuery.data.category ? (
										<span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-night/[0.06] px-2.5 font-grotesk font-semibold text-[11px] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70">
											<span dir="auto">
												{academyCategoryLabel(guideQuery.data.category, t)}
											</span>
										</span>
									) : null}
									{guideQuery.data.publishedAt ? (
										<time dateTime={guideQuery.data.publishedAt}>
											{formatDate(guideQuery.data.publishedAt, locale, {
												dateStyle: "long",
											})}
										</time>
									) : null}
								</div>
							) : null}

							<h1
								dir="auto"
								className="mt-4 font-extrabold font-grotesk text-[clamp(1.75rem,3.6vw,2.5rem)] text-night leading-[1.05] tracking-[-0.04em] rtl:leading-[1.3] rtl:tracking-normal dark:text-foreground"
							>
								{guideQuery.data.title}
							</h1>
							{guideQuery.data.description?.trim() ? (
								<p
									dir="auto"
									className="mt-3 text-base text-night/60 leading-relaxed sm:text-lg dark:text-foreground/60"
								>
									{guideQuery.data.description}
								</p>
							) : null}

							{guideQuery.data.youtubeVideoId ? (
								<div>
									<div className={VIDEO_FRAME_CLASS}>
										<div className="aspect-video overflow-hidden rounded-[1.375rem] bg-night/[0.04] dark:bg-white/[0.04]">
											<iframe
												src={youtubeEmbedUrl(guideQuery.data.youtubeVideoId)}
												title={guideQuery.data.title}
												loading="lazy"
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
												allowFullScreen
												referrerPolicy="strict-origin-when-cross-origin"
												className="size-full"
											/>
										</div>
									</div>
									<Button
										asChild
										variant="ghost"
										size="sm"
										className={cn("mt-2", GHOST_PILL_CLASS)}
									>
										<a
											href={youtubeWatchUrl(guideQuery.data.youtubeVideoId)}
											target="_blank"
											rel="noopener"
										>
											<ArrowSquareOutIcon
												aria-hidden
												weight="bold"
												className="size-3.5"
											/>
											{t("academy.watchOnYoutube")}
										</a>
									</Button>
								</div>
							) : null}

							{hasAcademyGuideBodyContent(guideQuery.data.bodyHtml) ? (
								<>
									{guideQuery.data.youtubeVideoId ? (
										<Separator className="my-8 bg-night/[0.08] dark:bg-white/10" />
									) : null}
									<div
										className={
											guideQuery.data.youtubeVideoId ? undefined : "mt-8"
										}
									>
										<GuideBody bodyHtml={guideQuery.data.bodyHtml} />
									</div>
								</>
							) : null}
						</article>
					</>
				)}
			</div>
		</DashboardShell>
	);
}

function BackToAcademyButton() {
	const { t } = useTranslation();

	return (
		<Button asChild variant="ghost" size="sm" className={GHOST_PILL_CLASS}>
			<Link to="/academy">
				<ArrowLeftIcon
					aria-hidden
					weight="bold"
					className="size-4 rtl:-scale-x-100"
				/>
				{t("academy.backToAcademy")}
			</Link>
		</Button>
	);
}

/** The guide failed to load or does not exist: the dashed frame of the dashboard empty state. */
function GuideUnavailable() {
	const { t } = useTranslation();

	return (
		<div className="mt-2 flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
			>
				<GraduationCapIcon weight="fill" className="size-7 text-spark" />
			</span>
			<h2 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
				{t("academy.notAvailable")}
			</h2>
			<Button
				asChild
				variant="outline"
				size="sm"
				className="mt-6 rounded-full font-grotesk"
			>
				<Link to="/academy">
					<ArrowLeftIcon
						aria-hidden
						weight="bold"
						className="size-4 rtl:-scale-x-100"
					/>
					{t("academy.backToAcademy")}
				</Link>
			</Button>
		</div>
	);
}

/** The loading shape of the guide: the meta row, the title, the video frame, and three body lines. */
function GuideDetailSkeleton() {
	return (
		<div className="mt-6" aria-hidden>
			<Skeleton className="h-6 w-24 rounded-full" />
			<Skeleton className="mt-4 h-9 w-4/5" />
			<Skeleton className="mt-3 h-4 w-2/3" />
			<div className={VIDEO_FRAME_CLASS}>
				<Skeleton className="aspect-video w-full rounded-[1.375rem]" />
			</div>
			<div className="mt-8 space-y-3">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-11/12" />
				<Skeleton className="h-4 w-4/5" />
			</div>
		</div>
	);
}
