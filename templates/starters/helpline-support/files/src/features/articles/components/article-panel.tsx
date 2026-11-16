// The content of the article sheet: the title, the summary, the steps, the figures, and the tickets that link it.
// ArticleSheet renders it for the article of the `?article=` param.
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatUpdateDate,
	TicketStatusBadge,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "~/shared/ui/sheet";
import {
	ARTICLE_FIGURE_DAYS,
	type ArticleListItem,
} from "../api/articles.queries";

type ArticlePanelProps = {
	article: ArticleListItem;
};

/** The article as readers see it, then the numbers of the last 30 days for the team. */
export function ArticlePanel({ article }: ArticlePanelProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const figures = [
		{
			key: "views",
			label: t("articles.views"),
			value: number.format(article.views30d),
		},
		{
			key: "helpful",
			label: t("articles.helpful"),
			value: article.helpful === null ? "—" : percent.format(article.helpful),
		},
		{
			key: "linked",
			label: t("articles.linked"),
			value: number.format(article.linkedTickets),
		},
	];
	return (
		<div className="grid gap-6 pb-6">
			<SheetHeader className="gap-2 border-b pe-12">
				<span className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary">
						{t(`articles.collections.${article.collection}`)}
					</Badge>
					{article.isDraft ? (
						<Badge variant="warning">{t("articles.draft")}</Badge>
					) : null}
				</span>
				<SheetTitle className="font-display text-xl">
					{article.title}
				</SheetTitle>
				<SheetDescription>
					{fillMessage(t("articles.updatedBy"), {
						name: article.authorName,
						time: formatUpdateDate(article.updatedAt, now, locale),
					})}
				</SheetDescription>
			</SheetHeader>
			<section className="grid gap-4 px-4">
				<p className="text-sm leading-relaxed">{article.summary}</p>
				<ol className="grid gap-3">
					{article.steps.map((step, index) => (
						<li
							key={step}
							className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-sm"
						>
							<span className="flex size-6 items-center justify-center rounded-full bg-primary/15 font-medium text-xs tabular-nums">
								{number.format(index + 1)}
							</span>
							<span className="pt-0.5 leading-relaxed">{step}</span>
						</li>
					))}
				</ol>
			</section>
			<section className="grid gap-3 px-4">
				<h3 className="font-medium text-sm">
					{fillMessage(t("articles.lastDays"), {
						days: number.format(ARTICLE_FIGURE_DAYS),
					})}
				</h3>
				<dl className="grid grid-cols-3 overflow-hidden rounded-lg border">
					{figures.map((figure, index) => (
						<div
							key={figure.key}
							className={cn("grid gap-0.5 p-3", index > 0 && "border-s")}
						>
							<dt className="text-muted-foreground text-xs">{figure.label}</dt>
							<dd className="font-numeric text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				{article.recentTickets.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("articles.noLinkedTickets")}
					</p>
				) : (
					<div className="grid gap-1 border-t pt-3">
						<h4 className="text-muted-foreground text-xs">
							{t("articles.linkedTickets")}
						</h4>
						<ul className="grid">
							{/* The link covers its row (after:inset-0), so a tap anywhere in the row opens the ticket. */}
							{article.recentTickets.map((ticket) => (
								<li
									key={ticket.id}
									className="relative flex items-center gap-3 border-t py-2.5 first:border-t-0"
								>
									<Link
										to="/app/tickets/$ticketId"
										params={{ ticketId: ticket.id }}
										className="min-w-0 flex-1 truncate text-sm after:absolute after:inset-0 hover:underline"
									>
										{ticket.subject}
									</Link>
									<span className="text-muted-foreground text-xs tabular-nums">{`#${ticket.id}`}</span>
									<TicketStatusBadge status={ticket.status} />
								</li>
							))}
						</ul>
					</div>
				)}
			</section>
		</div>
	);
}
