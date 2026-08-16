import { Link } from "@tanstack/react-router";
import {
	type AcademyGuideListItem,
	youtubeThumbnailUrl,
} from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { BookOpen, Play } from "lucide-react";

import { formatDate, useTranslation } from "@/lib/i18n";
import { academyCategoryLabel, guideGradient } from "../lib/academy-helpers";

type GuideCardProps = {
	guide: AcademyGuideListItem;
};

export function GuideCard({ guide }: GuideCardProps) {
	const { locale, t } = useTranslation();
	const category = guide.category?.trim();
	const description = guide.description?.trim();

	return (
		<Link
			to="/academy/$guideId"
			params={{ guideId: guide.id }}
			className="group flex overflow-hidden rounded-xl border border-border bg-card outline-none transition-colors duration-150 hover:border-foreground/20 hover:bg-secondary/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
		>
			<article className="flex min-w-0 flex-1 flex-col">
				<div className="relative aspect-video overflow-hidden bg-secondary">
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
							<BookOpen
								className="size-7 text-foreground/50"
								strokeWidth={1.6}
							/>
						</div>
					)}
					{guide.youtubeVideoId ? (
						<span className="absolute inset-0 grid place-items-center bg-foreground/5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
							<span className="grid size-10 place-items-center rounded-full border border-border/80 bg-background/85 text-foreground backdrop-blur-sm">
								<Play
									aria-hidden
									className="size-4 fill-current"
									strokeWidth={1.7}
								/>
							</span>
						</span>
					) : null}
				</div>

				<div className="flex min-h-36 flex-1 flex-col p-4">
					{category ? (
						<Badge variant="outline" className="mb-2.5 max-w-full">
							<span dir="auto" className="truncate">
								{academyCategoryLabel(category, t)}
							</span>
						</Badge>
					) : null}
					<h2
						dir="auto"
						className="line-clamp-2 font-medium text-base leading-snug"
					>
						{guide.title}
					</h2>
					{description ? (
						<p
							dir="auto"
							className="mt-1.5 line-clamp-2 text-muted-foreground text-sm leading-relaxed"
						>
							{description}
						</p>
					) : null}
					{guide.publishedAt ? (
						<time
							dateTime={guide.publishedAt}
							className="mt-auto pt-3 text-muted-foreground text-xs"
						>
							{formatDate(guide.publishedAt, locale, {
								dateStyle: "medium",
							})}
						</time>
					) : null}
				</div>
			</article>
		</Link>
	);
}

export function GuideCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card">
			<Skeleton className="aspect-video rounded-none" />
			<div className="space-y-2.5 p-4">
				<Skeleton className="h-4 w-20 rounded-full" />
				<Skeleton className="h-4 w-4/5" />
				<Skeleton className="h-3 w-3/5" />
			</div>
		</div>
	);
}
