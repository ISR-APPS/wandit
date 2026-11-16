// The money path of a phone: the five nodes as cards on one dashed spine.
// PathSection renders it under 1024px, where the diagram canvas is too small to read.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PATH_NODES, type PathNodeId } from "../lib/path-nodes";
import { ResultChip, type ResultChipKind } from "./result-chip";

// The node that shows each result chip. The shop and the product node show none.
const CHIP_OF_NODE: Partial<Record<PathNodeId, ResultChipKind>> = {
	customer: "sent",
	bank: "received",
	accountant: "ready",
};

/** An ordered list: the order of the cards is the order that the money takes. */
export function PathRail() {
	const { t } = useT();
	return (
		<ol className="mx-auto mt-9 grid max-w-[460px] gap-3.5 ps-7 lg:hidden">
			{PATH_NODES.map((node, index) => {
				const chipKind = CHIP_OF_NODE[node.id];
				return (
					<li
						key={node.id}
						data-reveal
						className="fw-card relative px-4.5 py-3.5"
					>
						{/* The spine goes down to the bead of the next card: the card height plus the 14px gap. */}
						{index < PATH_NODES.length - 1 ? (
							<span
								aria-hidden="true"
								className="fw-rail absolute -start-5 top-7 h-[calc(100%+0.875rem)]"
							/>
						) : null}
						{/* The bead is 16px wide. Its center is on the 2px spine. */}
						<span
							aria-hidden="true"
							className="fw-rail-bead absolute -start-[27px] top-5 size-4 rounded-full"
						/>
						<p
							className={cn(
								"font-bold font-display text-[0.98rem]",
								node.id === "fawtara" && "text-(--fw-blue-deep)",
							)}
						>
							{t(node.titleKey)}
						</p>
						<p className="mt-0.5 text-[0.86rem] text-muted-foreground leading-normal">
							{t(node.detailKey)}
						</p>
						{chipKind === undefined ? null : (
							<ResultChip kind={chipKind} className="mt-2.5" />
						)}
					</li>
				);
			})}
		</ol>
	);
}
