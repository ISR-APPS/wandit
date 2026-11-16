// The heading block of one digest section: the h2 with its figure at the end, a muted line, and "See all".
// The three sections of OverviewPage render it at the top of their Card.
import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "~/shared/ui/icons";

type DigestSectionHeaderProps = {
	/** The section title, already translated. It is an h2. */
	title: string;
	/** The figure of the section, already formatted. It ends the h2 line. */
	figure: string;
	/** The unit or the scope of the figure, for example "days off". */
	figureLabel: string;
	/** One muted line under the title, for example a legend. */
	description: ReactNode;
	/** The list page of the section. */
	to: LinkProps["to"];
	/** The text of the "See all" link, already translated. */
	linkLabel: string;
};

/** The heading of a section. The figure sits on the h2 line, so a reader scans the totals down the page. */
export function DigestSectionHeader({
	title,
	figure,
	figureLabel,
	description,
	to,
	linkLabel,
}: DigestSectionHeaderProps) {
	return (
		<div className="grid gap-3 px-6">
			<h2 className="flex items-baseline justify-between gap-4 font-(--heading-weight) text-xl tracking-(--heading-tracking)">
				<span>{title}</span>
				<span className="flex items-baseline gap-2">
					<span className="font-numeric text-3xl tabular-nums">{figure}</span>
					<span className="font-sans text-muted-foreground text-sm">
						{figureLabel}
					</span>
				</span>
			</h2>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
				<div className="min-w-0 text-muted-foreground">{description}</div>
				<Link
					to={to}
					className="inline-flex min-h-11 items-center gap-1 font-medium hover:underline sm:min-h-0"
				>
					{linkLabel}
					<ArrowRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</div>
		</div>
	);
}
