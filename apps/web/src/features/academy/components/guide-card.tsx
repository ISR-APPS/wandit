/**
 * The guide card of the Academy grid, in the look of the dashboard project card.
 * The stage shows the YouTube thumbnail, or a gradient placeholder when the guide has no video.
 * academy-page.tsx renders the card and GuideCardSkeleton. A click opens /academy/$guideId.
 */
import { BookOpenIcon } from "@phosphor-icons/react/BookOpen";
import { PlayIcon } from "@phosphor-icons/react/Play";
import { Link } from "@tanstack/react-router";
import {
	type AcademyGuideListItem,
	youtubeThumbnailUrl,
} from "@wandit/contracts";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { formatDate, useTranslation } from "@/lib/i18n";
import { academyCategoryLabel, guideGradient } from "../lib/academy-helpers";

type GuideCardProps = {
	guide: AcademyGuideListItem;
};

/** One guide in the Academy grid. The play circle shows on hover and focus only when the guide has a video. */
export function GuideCard({ guide }: GuideCardProps) {
	const { locale, t } = useTranslation();
	const category = guide.category?.trim();
	const description = guide.description?.trim();

	return (
		// The outer div keeps still, so the cursor stays on it while the inner card lifts.
		<div className="group relative">
			<div className="h-full transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-within:-translate-y-1">
				<Link
					to="/academy/$guideId"
					params={{ guideId: guide.id }}
					className={cn(
						"flex h-full flex-col rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08]",
						// A solid bottom edge, like a key. It grows when the card lifts.
						"shadow-[0_2px_0_rgb(11_16_51/0.06)] transition-shadow duration-200 group-focus-within:shadow-[0_6px_0_rgb(11_16_51/0.12)] group-hover:shadow-[0_6px_0_rgb(11_16_51/0.12)]",
						"outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember",
						"dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10 dark:group-hover:shadow-[0_6px_0_rgb(0_0_0/0.5)] dark:group-focus-within:shadow-[0_6px_0_rgb(0_0_0/0.5)]",
					)}
				>
					<article className="flex min-w-0 flex-1 flex-col">
						<div className="relative aspect-video overflow-hidden rounded-[1.375rem] bg-night/[0.04] dark:bg-white/[0.04]">
							{guide.youtubeVideoId ? (
								<img
									src={youtubeThumbnailUrl(guide.youtubeVideoId)}
									alt=""
									loading="lazy"
									decoding="async"
									className="size-full object-cover"
								/>
							) : (
								<div
									aria-hidden
									className="grid size-full place-items-center"
									style={{ backgroundImage: guideGradient(guide.id) }}
								>
									<BookOpenIcon
										weight="duotone"
										className="size-7 text-night/40 dark:text-foreground/45"
									/>
								</div>
							)}
							{guide.youtubeVideoId ? (
								<span
									aria-hidden
									className="absolute inset-0 grid place-items-center bg-night/10 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
								>
									<span className="grid size-11 place-items-center rounded-full bg-spark text-night shadow-[0_3px_0_var(--color-spark-deep)]">
										<PlayIcon weight="fill" className="size-5" />
									</span>
								</span>
							) : null}
						</div>

						<div className="flex min-h-36 flex-1 flex-col px-3 pt-3 pb-2.5">
							{category ? (
								<span className="mb-2.5 inline-flex h-6 max-w-full items-center gap-1.5 self-start rounded-full bg-night/[0.06] px-2.5 font-grotesk font-semibold text-[11px] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70">
									<span dir="auto" className="truncate">
										{academyCategoryLabel(category, t)}
									</span>
								</span>
							) : null}
							<h3
								dir="auto"
								className="line-clamp-2 font-grotesk font-semibold text-[15px] text-night leading-snug tracking-[-0.01em] dark:text-foreground"
							>
								{guide.title}
							</h3>
							{description ? (
								<p
									dir="auto"
									className="mt-1.5 line-clamp-2 text-night/60 text-sm leading-relaxed dark:text-foreground/60"
								>
									{description}
								</p>
							) : null}
							{guide.publishedAt ? (
								<time
									dateTime={guide.publishedAt}
									className="mt-auto pt-3 text-night/60 text-xs tabular-nums dark:text-foreground/60"
								>
									{formatDate(guide.publishedAt, locale, {
										dateStyle: "medium",
									})}
								</time>
							) : null}
						</div>
					</article>
				</Link>
			</div>
		</div>
	);
}

/** The loading shape of a GuideCard. The Academy grid shows it while the guide list loads. */
export function GuideCardSkeleton() {
	return (
		<div className="rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08] dark:bg-card dark:ring-white/10">
			<Skeleton className="aspect-video rounded-[1.375rem]" />
			<div className="space-y-2.5 px-3 pt-3 pb-2.5">
				<Skeleton className="h-6 w-20 rounded-full" />
				<Skeleton className="h-4 w-4/5" />
				<Skeleton className="h-3 w-3/5" />
			</div>
		</div>
	);
}
