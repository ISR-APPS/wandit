// A ledger of facts: one mono label and one value on each hairline row.
// StudioSection renders the studio facts with it, and CaseSection the facts of the project.
import { LEDGER_LABEL, MONO } from "../lib/type-styles";

/** One row of a ledger. Both texts are already translated. */
export type Fact = {
	/** The header of the row, printed in capitals. It is also the React key, so it is unique in a ledger. */
	label: string;
	value: string;
};

type FactsLedgerProps = {
	facts: readonly Fact[];
	/** The case study uses tighter rows, and a value that never crosses the middle of the row. */
	isCompact?: boolean;
};

/** A description list under one ink rule. On a phone each value goes under its label. */
export function FactsLedger({ facts, isCompact = false }: FactsLedgerProps) {
	return (
		<dl className="border-foreground border-t">
			{facts.map((fact) => (
				<div
					key={fact.label}
					className={`sable-row flex flex-col gap-[3px] border-foreground/14 border-b min-[601px]:flex-row min-[601px]:justify-between min-[601px]:gap-[18px] ${isCompact ? "py-[9px]" : "py-[13px]"}`}
				>
					<dt className={LEDGER_LABEL}>{fact.label}</dt>
					<dd
						className={`${MONO} min-[601px]:text-end ${isCompact ? "min-[601px]:max-w-[62%]" : ""}`}
					>
						{fact.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
