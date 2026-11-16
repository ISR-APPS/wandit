// The error state of a studio page when its route loader fails: one alert line and a "Try again" button.
// The error component of each page (overview, clients, projects, team, invoices) renders it with its own message.
// "Try again" calls router.invalidate(), so the router runs the loaders of the page again.
import { useRouter } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";

type PageErrorProps = {
	/** The translated `<feature>.loadError` text of the page. */
	message: string;
};

/** Shows `message` as an alert. The page keeps its header and sidebar, because the /app layout stays mounted. */
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
