// The error frame of one home panel whose query failed after a period change.
// The trend, the figures, and the ranking render it in place of their content. The other panels stay.
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";

type PanelErrorProps = {
	/** What did not load, already translated. */
	message: string;
};

/** Try again refetches the home queries that failed. */
export function PanelError({ message }: PanelErrorProps) {
	const { t } = useT();
	const queryClient = useQueryClient();
	return (
		<Card>
			<CardContent className="grid justify-items-start gap-3">
				<p role="alert" className="text-sm">
					{message}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						queryClient.refetchQueries({
							queryKey: ["overview"],
							type: "active",
						})
					}
				>
					{t("common.retry")}
				</Button>
			</CardContent>
		</Card>
	);
}
