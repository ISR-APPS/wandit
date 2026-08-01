import { Button } from "@wandit/ui/components/button";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

export function TargetCommentReviewBar({
	count,
	disabled,
	onClear,
	onSend,
}: {
	count: number;
	disabled: boolean;
	onClear: () => void;
	onSend: () => void;
}) {
	const { t } = useTranslation();
	const countLabel = t("workspace.page.editor.commentsCount", { count });

	return (
		<div
			role="toolbar"
			aria-label={countLabel}
			className="absolute start-1/2 bottom-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover py-1.5 ps-3 pe-1.5 text-popover-foreground shadow-xl rtl:translate-x-1/2"
		>
			<span
				aria-live="polite"
				className="whitespace-nowrap font-medium text-xs"
			>
				{countLabel}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				disabled={disabled}
				aria-label={t("workspace.page.editor.clearAll")}
				onClick={onClear}
			>
				<X className="size-3.5" aria-hidden />
			</Button>
			<Button type="button" size="sm" disabled={disabled} onClick={onSend}>
				{t("workspace.page.editor.send")}
			</Button>
		</div>
	);
}
