// The error state of a page whose loader failed: what failed, and Try again.
// The routes of every page set it as errorComponent through a small wrapper that names the page.
import { useRouter } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";

type LoadErrorProps = {
	/** One sentence that names what did not load and what to do, already translated. */
	message: string;
};

/** Try again runs the loaders of the current route again. */
export function LoadError({ message }: LoadErrorProps) {
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
