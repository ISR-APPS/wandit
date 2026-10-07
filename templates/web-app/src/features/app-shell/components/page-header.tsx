// The title row at the top of a page behind login: the h1, a muted line, and the page actions.
// Pages import it from ~/features/app-shell.
// The home page can draw its own header with the style Anatomy. Other pages use this one.
// The h1 reads the --heading-* style knobs of src/styles/tokens.css.
import type { ReactNode } from "react";

type PageHeaderProps = {
	/** The page title, already translated. It is the only h1 of the page. */
	title: string;
	/** One muted line under the title, for example a scope or the email. */
	description?: ReactNode;
	/** Buttons at the end of the row, for example "Add machine". They wrap under the title at 375 px. */
	actions?: ReactNode;
};

/** The header of one page. Put it first in the page component. The knobs give the h1 weight, tracking, and case. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
			<div className="grid min-w-0 gap-1">
				<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking) [text-transform:var(--heading-case)]">
					{title}
				</h1>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
