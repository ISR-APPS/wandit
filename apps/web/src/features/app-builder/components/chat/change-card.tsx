/**
 * Card of a saved version inside an assistant message: a commit medallion,
 * the title and the version number, a bookmark button, and the Details and
 * Preview pills. Rendered by chat-message.tsx for each `data-change` part.
 * Pure presentation: the caller owns every action.
 */

import { BookmarkSimpleIcon } from "@phosphor-icons/react/BookmarkSimple";
import { GitCommitIcon } from "@phosphor-icons/react/GitCommit";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { IconAction } from "../shell/top-bar";
import {
	CARD_ICON_BUTTON_CLASS,
	CARD_PRIMARY_PILL_CLASS,
	CARD_SECONDARY_PILL_CLASS,
	CardMedallion,
	MessageCard,
} from "./message-card";

/** Props of one `data-change` part, as chat-message.tsx passes them. */
export type ChangeCardProps = {
	/** One line the agent wrote when it saved the version. */
	title: string;
	/** Version the card stands for. Preview passes it back to the caller. */
	versionNumber: number;
	/** Opens the details of the version. chat-message.tsx passes the notWired toast. */
	onDetails: () => void;
	onPreview: (versionNumber: number) => void;
	/** Saves the version as a checkpoint. chat-message.tsx passes the notWired toast. */
	onBookmark: () => void;
};

/** The saved-version card. Preview is the ember pill: it is the one action that works today. */
export function ChangeCard({
	title,
	versionNumber,
	onDetails,
	onPreview,
	onBookmark,
}: ChangeCardProps) {
	const { t } = useTranslation();

	return (
		<MessageCard className="flex items-start gap-3">
			<CardMedallion icon={GitCommitIcon} tone="spark" />
			<div className="min-w-0 flex-1">
				<div className="flex items-start gap-2">
					<div className="min-w-0 flex-1 pt-0.5">
						<p
							dir="auto"
							className="font-grotesk font-semibold text-[14px] text-night leading-snug dark:text-foreground"
						>
							{title}
						</p>
						<p className="mt-0.5 font-grotesk text-[12px] text-night/45 tabular-nums dark:text-foreground/45">
							{t("appBuilder.chat.versionLabel", { number: versionNumber })}
						</p>
					</div>
					<IconAction label={t("appBuilder.chat.bookmark")}>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={onBookmark}
							className={cn("-me-1.5 -mt-1", CARD_ICON_BUTTON_CLASS)}
						>
							<BookmarkSimpleIcon weight="bold" aria-hidden />
						</Button>
					</IconAction>
				</div>
				<div className="mt-3 flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onDetails}
						className={CARD_SECONDARY_PILL_CLASS}
					>
						{t("appBuilder.chat.details")}
					</Button>
					<Button
						size="sm"
						onClick={() => onPreview(versionNumber)}
						className={CARD_PRIMARY_PILL_CLASS}
					>
						{t("appBuilder.chat.preview")}
					</Button>
				</div>
			</div>
		</MessageCard>
	);
}
