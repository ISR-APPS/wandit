import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

const SKELETON_KEYS = ["one", "two", "three", "four", "five"];

export function PortalTableSkeleton() {
	return (
		<div className="flex flex-col gap-3 p-5" aria-hidden>
			<Skeleton className="h-8 w-full" />
			{SKELETON_KEYS.map((key) => (
				<Skeleton key={key} className="h-11 w-full" />
			))}
		</div>
	);
}

export function PortalTableError({ onRetry }: { onRetry: () => void }) {
	const { t } = useTranslation();

	return (
		<div
			role="alert"
			className="flex min-h-48 flex-col items-center justify-center p-6 text-center"
		>
			<AlertTriangle className="size-5 text-destructive" aria-hidden />
			<p className="mt-3 text-muted-foreground text-sm">
				{t("affiliates.loadError")}
			</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4"
				onClick={onRetry}
			>
				<RefreshCw data-icon="inline-start" aria-hidden />
				{t("affiliates.retry")}
			</Button>
		</div>
	);
}
