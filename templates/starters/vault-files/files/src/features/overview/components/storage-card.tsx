// The storage card of the home: bytes in use against the plan, as one bar, with a link to the files.
// OverviewPage renders it at the end of the folder row, from overviewQueryOptions.
// The bytes in use count the live files and the trash, as the plan does.
import { Link } from "@tanstack/react-router";
import { formatBytes } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";

type StorageCardProps = {
	/** Bytes of the live files and the trash. */
	usedBytes: number;
	/** Storage of the plan in bytes. */
	planBytes: number;
};

/** The used and the total sizes sit above the bar, at the two ends. */
export function StorageCard({ usedBytes, planBytes }: StorageCardProps) {
	const { t, locale } = useT();
	const used = formatBytes(usedBytes, locale);
	const total = formatBytes(planBytes, locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.storageTitle")}</CardTitle>
				<CardDescription>{t("overview.storageDescription")}</CardDescription>
				<CardAction>
					<Button variant="outline" size="icon" asChild>
						<Link to="/app/files" aria-label={t("overview.browseFiles")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex justify-between gap-2 text-muted-foreground text-sm">
					<span>{t("overview.bytesUsed").replace("{size}", used)}</span>
					<span>{t("overview.bytesTotal").replace("{size}", total)}</span>
				</div>
				<Progress
					value={usedBytes}
					max={planBytes}
					aria-label={`${t("overview.storageTitle")}: ${used} / ${total}`}
				/>
			</CardContent>
		</Card>
	);
}
