// The placeholder of a detail page while its loader runs: the back link, the title, and the kit profile grid.
// The transaction, card, payee, and statement routes set it as their pendingComponent.
import { Skeleton } from "~/shared/ui/skeleton";

/** The start column is 1/3 and the end column 2/3 from the @4xl width, as on the loaded page. */
export function DetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-8 w-64 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-120" />
				<Skeleton className="@4xl/main:col-span-2 h-120" />
			</div>
		</div>
	);
}
