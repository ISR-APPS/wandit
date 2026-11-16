// The error state of a page whose loader failed: what failed, and Try again.
// Each page exports a small error component that renders it with its own sentence.
import { useRouter } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";

type LoadErrorProps = {
	/** One sentence, already translated: what did not load and what to do. */
	message: string;
};

/** Try again runs the loaders of the route again. */
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
