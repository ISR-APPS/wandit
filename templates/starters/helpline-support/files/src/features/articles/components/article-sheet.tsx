// The side sheet of one help article. ArticlesPage opens it from a title or from the `?article=` param.
// It holds an ArticlePanel. The sheet slides in from the end side.
import { Sheet, SheetContent } from "~/shared/ui/sheet";
import type { ArticleListItem } from "../api/articles.queries";
import { ArticlePanel } from "./article-panel";

type ArticleSheetProps = {
	/** The article to show, or null when the param names no article. */
	article: ArticleListItem | null;
	onClose: () => void;
};

/** A controlled sheet: open while an article is selected. */
export function ArticleSheet({ article, onClose }: ArticleSheetProps) {
	return (
		<Sheet
			open={article !== null}
			onOpenChange={(open) => (open ? undefined : onClose())}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
				{article ? <ArticlePanel key={article.id} article={article} /> : null}
			</SheetContent>
		</Sheet>
	);
}
