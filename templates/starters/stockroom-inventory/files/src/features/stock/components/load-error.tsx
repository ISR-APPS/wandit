// The error state of a page whose loader failed: what failed, and Try again.
// Every route of the stockroom sets it as errorComponent, through a small wrapper with its own text.
import { useRouter } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";

type LoadErrorProps = {
	/** What failed and what to do, already translated. */
	message: string;
};

/** Try again runs the loaders of the current route again. */
export function LoadError({ message }: LoadErrorProps) {
	const { t } = useT();
	const router = useRouter();
	return (
		<Card>
			<CardContent className="grid justify-items-start gap-4">
				<p role="alert" className="text-sm">
					{message}
				</p>
				<Button type="button" onClick={() => router.invalidate()}>
					{t("common.retry")}
				</Button>
			</CardContent>
		</Card>
	);
}
