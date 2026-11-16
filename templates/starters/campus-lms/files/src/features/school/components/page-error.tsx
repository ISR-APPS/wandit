// The error state of a page behind login: what failed, and a button that runs the loader again.
// Each route sets a small wrapper of it as errorComponent, with the message of its page.
import { useRouter } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";

type PageErrorProps = {
	/** What failed and what to do, already translated. */
	message: string;
};

/** Try again invalidates the router, so the loader of the route runs again. */
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
