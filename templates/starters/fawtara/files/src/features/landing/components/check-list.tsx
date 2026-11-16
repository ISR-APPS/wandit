// A list of claims, each with the drawn check.
// The product panels, the "with Fawtara" card, and the price cards render it.
import { cn } from "~/shared/lib/utils";
import { CheckGlyph } from "./check-glyph";

type CheckListProps = {
	/** The claims, already translated. Each text is also the React key, so the texts differ. */
	items: readonly string[];
	/** "ink" is the full text color. "muted" is the secondary ink. */
	tone: "ink" | "muted";
	/** Extra classes, for example a margin or a text size. */
	className?: string;
};

/** The check sits on the first line of its claim, also when the claim wraps. */
export function CheckList({ items, tone, className }: CheckListProps) {
	return (
		<ul
			className={cn(
				"grid gap-3.5",
				tone === "muted" && "text-muted-foreground",
				className,
			)}
		>
			{items.map((item) => (
				<li key={item} className="flex items-start gap-3">
					<CheckGlyph className="mt-[0.2em] shrink-0" />
					<span className="text-pretty">{item}</span>
				</li>
			))}
		</ul>
	);
}
