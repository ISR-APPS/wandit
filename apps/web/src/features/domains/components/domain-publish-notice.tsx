import { Button } from "@wandit/ui/components/button";
import { ArrowUp, CircleAlert } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

export function DomainPublishNotice({
	canPublish,
	onPublish,
}: {
	canPublish: boolean;
	onPublish: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-3 sm:flex-row sm:items-center">
			<CircleAlert className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
			<div className="min-w-0 flex-1">
				<p className="font-medium text-amber-900 text-sm dark:text-amber-100">
					{t("settings.domains.notPublishedTitle")}
				</p>
				<p className="mt-0.5 text-amber-800/80 text-xs dark:text-amber-200/80">
					{t("settings.domains.notPublishedDescription")}
				</p>
			</div>
			<Button
				type="button"
				size="sm"
				disabled={!canPublish}
				onClick={onPublish}
			>
				<ArrowUp />
				{t("settings.domains.publishCta")}
			</Button>
		</div>
	);
}
