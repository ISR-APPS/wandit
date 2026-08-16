import { Link } from "@tanstack/react-router";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Separator } from "@wandit/ui/components/separator";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { ArrowLeft, ExternalLink, GraduationCap } from "lucide-react";

import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { formatDate, useTranslation } from "@/lib/i18n";
import { useAcademyGuideQuery } from "../api/academy.queries";
import { GuideBody } from "../components/guide-body";
import {
	academyCategoryLabel,
	hasAcademyGuideBodyContent,
} from "../lib/academy-helpers";

type AcademyGuidePageProps = {
	guideId: string;
};

export default function AcademyGuidePage({ guideId }: AcademyGuidePageProps) {
	const { locale, t } = useTranslation();
	const guideQuery = useAcademyGuideQuery(guideId);

	return (
		<DashboardShell titleKey="academy.title">
			<div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16">
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
								<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
									{guideQuery.data.category ? (
										<Badge variant="outline">
											<span dir="auto">
												{academyCategoryLabel(guideQuery.data.category, t)}
											</span>
										</Badge>
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
								className="mt-3 font-semibold text-2xl tracking-tight sm:text-3xl"
							>
								{guideQuery.data.title}
							</h1>
							{guideQuery.data.description?.trim() ? (
								<p
									dir="auto"
									className="mt-3 text-base text-muted-foreground leading-relaxed sm:text-lg"
								>
									{guideQuery.data.description}
								</p>
							) : null}

							{guideQuery.data.youtubeVideoId ? (
								<div className="mt-7">
									<div className="aspect-video overflow-hidden rounded-xl border border-border bg-secondary">
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
									<Button
										asChild
										variant="ghost"
										size="sm"
										className="-ms-3 mt-2 text-muted-foreground"
									>
										<a
											href={youtubeWatchUrl(guideQuery.data.youtubeVideoId)}
											target="_blank"
											rel="noopener"
										>
											<ExternalLink className="size-3.5" aria-hidden />
											{t("academy.watchOnYoutube")}
										</a>
									</Button>
								</div>
							) : null}

							{hasAcademyGuideBodyContent(guideQuery.data.bodyHtml) ? (
								<>
									{guideQuery.data.youtubeVideoId ? (
										<Separator className="my-8" />
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
		<Button asChild variant="ghost" size="sm" className="-ms-3">
			<Link to="/academy">
				<ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
				{t("academy.backToAcademy")}
			</Link>
		</Button>
	);
}

function GuideUnavailable() {
	const { t } = useTranslation();

	return (
		<Empty className="mt-2 rounded-xl border border-dashed py-16">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<GraduationCap aria-hidden />
				</EmptyMedia>
				<EmptyTitle>{t("academy.notAvailable")}</EmptyTitle>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild variant="outline" size="sm">
					<Link to="/academy">
						<ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
						{t("academy.backToAcademy")}
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function GuideDetailSkeleton() {
	return (
		<div className="mt-6" aria-hidden>
			<Skeleton className="h-5 w-24 rounded-full" />
			<Skeleton className="mt-4 h-8 w-4/5" />
			<Skeleton className="mt-3 h-4 w-2/3" />
			<Skeleton className="mt-7 aspect-video w-full rounded-xl" />
			<div className="mt-8 space-y-3">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-11/12" />
				<Skeleton className="h-4 w-4/5" />
			</div>
		</div>
	);
}
