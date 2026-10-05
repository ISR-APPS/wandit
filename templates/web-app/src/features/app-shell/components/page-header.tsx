// The title row at the top of every page behind login: the h1, a muted line, and the page actions.
// Pages import it from ~/features/app-shell. The home file gives the home header.
import type { ReactNode } from "react";

type PageHeaderProps = {
	/** The page title, already translated. It is the only h1 of the page. */
	title: string;
	/** One muted line under the title, for example a scope or the email. */
	description?: ReactNode;
	/** Buttons at the end of the row, for example "Add machine". They wrap under the title at 375 px. */
	actions?: ReactNode;
};

/** The header of one page. Put it first in the page component. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
			<div className="grid min-w-0 gap-1">
				<h1 className="font-display text-2xl tracking-tight">{title}</h1>
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
