// A list of labelled facts: a small caps label on the start side, its value on the end side, a hairline under each row.
// ChefSection and BookingSection render it. It reads Fact rows of lib/content.ts.
import type { ComponentProps } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Fact } from "../lib/content";
import { MICRO_LABEL } from "../lib/type-styles";

/** A <dl> with one hairline row per fact. Other props, such as data-reveal, go to the <dl>. */
export function FactList({
	facts,
	className,
	...props
}: ComponentProps<"dl"> & { facts: readonly Fact[] }) {
	const { t } = useT();
	return (
		<dl className={cn("border-(--br-hair) border-t", className)} {...props}>
			{facts.map((fact) => (
				<div
					key={fact.labelKey}
					className="flex items-baseline justify-between gap-4 border-(--br-hair) border-b py-3.5"
				>
					<dt className={cn(MICRO_LABEL, "shrink-0")}>{t(fact.labelKey)}</dt>
					<dd className="text-end font-display font-medium text-[clamp(14px,1.05vw,16.5px)] tracking-[-0.01em]">
						{t(fact.valueKey)}
					</dd>
				</div>
			))}
		</dl>
	);
}
