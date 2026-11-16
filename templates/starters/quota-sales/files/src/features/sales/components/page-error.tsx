// The error state of a whole page when its route loader fails.
// The error component of each page (overview, reps, orders, targets) renders it with its own message.
// Try again invalidates the router, so the loader runs again.
import { useRouter } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";

type PageErrorProps = {
	/** What failed, already translated. */
	message: string;
};

/** One sentence and a Try again button at the start of the page. */
export function PageError({ message }: PageErrorProps) {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{message}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
