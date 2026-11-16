// One fact of the table panel: a muted label over its value.
// TableSheet renders up to four of them inside one <dl>. The orders feature has its own copy for the check page.
import type { ReactNode } from "react";

type FactProps = {
	/** The translated label, for example "Server". */
	label: string;
	children: ReactNode;
};

/** A <dt> and a <dd> in one grid cell. The parent supplies the <dl>. */
export function Fact({ label, children }: FactProps) {
	return (
		<div className="grid gap-1">
			<dt className="text-muted-foreground">{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}
