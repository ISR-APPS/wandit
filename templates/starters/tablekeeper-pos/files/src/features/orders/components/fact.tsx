// One fact of the details card of a check: a muted label over its value.
// OrderDetailPage renders six of them inside one <dl>. The floor feature has its own copy for the table panel.
import type { ReactNode } from "react";

type FactProps = {
	/** The translated label, for example "Covers". */
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
