/**
 * Card of a saved version inside an assistant message: title, a bookmark
 * button, and the Details and Preview actions.
 * Rendered by chat-message.tsx for each `data-change` part.
 * Pure presentation: the caller owns every action.
 */

import { Button } from "@wandit/ui/components/button";
import { Bookmark } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

export type ChangeCardProps = {
	/** One line the agent wrote when it saved the version. */
	title: string;
	/** Version the card stands for. Preview passes it back to the caller. */
	versionNumber: number;
	onDetails: () => void;
	onPreview: (versionNumber: number) => void;
	onBookmark: () => void;
};

export function ChangeCard({
	title,
	versionNumber,
	onDetails,
	onPreview,
	onBookmark,
}: ChangeCardProps) {
	const { t } = useTranslation();

	return (
		<div className="rounded-2xl border bg-card p-4">
			<div className="flex items-center gap-2">
				<span dir="auto" className="min-w-0 flex-1 font-semibold text-sm">
					{title}
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={t("appBuilder.chat.bookmark")}
					onClick={onBookmark}
				>
					<Bookmark />
				</Button>
			</div>
			<div className="mt-3 grid grid-cols-2 gap-2">
				<Button variant="outline" size="sm" onClick={onDetails}>
					{t("appBuilder.chat.details")}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onPreview(versionNumber)}
				>
					{t("appBuilder.chat.preview")}
				</Button>
			</div>
		</div>
	);
}
