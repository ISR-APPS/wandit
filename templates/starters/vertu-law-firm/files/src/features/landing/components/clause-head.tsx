// The head of one clause: "Art. n", a brass dash, the title in the display serif, then a rule to the end of the line.
// The hero teaser, the house rules, the request folder, and the footer mentions render it.
// Below 640px the title takes its own line, and the rule runs after "Art. n" instead of the dash.
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

type ClauseHeadProps = {
	/** The number in the unbroken Art. 1 to Art. 7 sequence of the page. */
	article: number;
	/** The clause title. */
	children: ReactNode;
	/** The type size of the title. The house rules use the large size, the teaser and the footer the small one. */
	size?: "large" | "small";
};

/** One baseline row. The h3 keeps the clause in the outline of its section. */
export function ClauseHead({
	article,
	children,
	size = "large",
}: ClauseHeadProps) {
	const { t } = useT();
	return (
		<div className="vt-clause-head flex items-baseline gap-x-3 gap-y-2">
			<span
				className={cn(
					LABEL,
					"whitespace-nowrap text-(--vt-brass) tabular-nums",
				)}
			>
				{t("clause.article")} {article}
			</span>
			<span
				aria-hidden="true"
				className="vt-clause-dash font-display text-(--vt-brass) leading-none"
			>
				—
			</span>
			<h3
				className={cn(
					"font-display font-normal leading-[1.2] tracking-[-0.01em]",
					size === "large"
						? "text-[clamp(1.15rem,1.5vw,1.42rem)]"
						: "text-[1.05rem]",
				)}
			>
				{children}
			</h3>
			<span aria-hidden="true" className="vt-rule" />
		</div>
	);
}
