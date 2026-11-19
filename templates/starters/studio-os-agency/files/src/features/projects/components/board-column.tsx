// One column of the project task board: the status name, its count, and the cards of that status.
// ProjectDetailPage renders one column per deliverable status, in workflow order.
import type { DeliverableStatus } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { BoardItem } from "../lib/project-detail";
import { BoardCard } from "./board-card";

type BoardColumnProps = {
	status: DeliverableStatus;
	/** The deliverables of this status after the search and the filter, the nearest due day first. */
	items: BoardItem[];
};

/** An empty column keeps its head and shows one muted line, so the four steps always show. */
export function BoardColumn({ status, items }: BoardColumnProps) {
	const { t, locale } = useT();
	return (
		<section
			aria-label={t(`codes.deliverables.${status}`)}
			className="flex min-w-64 flex-1 flex-col gap-3 self-start rounded-surface bg-muted p-3"
		>
			<h2 className="flex items-center gap-2 px-1 font-semibold text-sm">
				{t(`codes.deliverables.${status}`)}
				<Badge variant="outline" className="tabular-nums">
					{new Intl.NumberFormat(locale).format(items.length)}
				</Badge>
			</h2>
			{items.length === 0 ? (
				<p className="px-1 pb-2 text-muted-foreground text-sm">
					{t("projectDetail.emptyColumn")}
				</p>
			) : (
				<ul className="grid gap-2">
					{items.map((item) => (
						<li key={item.id}>
							<BoardCard item={item} />
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
