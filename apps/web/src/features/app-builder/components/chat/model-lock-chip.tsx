/**
 * The model chip of a conversation after its first turn. The tier is then
 * locked, so the chip shows the tier name with a lock, the Fast mark while
 * Fast mode is on, and a brain while the thinking level is not Balanced.
 * A click opens a short note, a new conversation button, a Fast mode row,
 * and the thinking row: both can still change on each message. Rendered by
 * composer.tsx in place of BuilderModelPicker. helpers.ts maps the model id
 * to its tier and its Fast row. mode-switch-row.tsx draws the Fast row, and
 * thinking-level-row.tsx the thinking row and the brain mark.
 */

import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import {
	builderTierOf,
	fastModelOf,
	hasThinkingControl,
} from "../../lib/helpers";
import type { BuilderModelPick } from "../../lib/use-builder-model-pick";
import { PROMPT_CHIP_CLASS, TIER_STYLE } from "../builder-model-picker";
import { ModeSwitchRow } from "../mode-switch-row";
import { ThinkingLevelRow, ThinkingMark } from "../thinking-level-row";
import { CARD_SECONDARY_BUTTON_CLASS } from "./message-card";

/** The locked model of the open conversation. The page makes it (lockedTurnModelOf) and passes it through the chat pane and the composer. */
export type ModelLock = {
	/** Model id the next send carries: the tier model, or its Fast row while Fast mode is on. The user never sees it. */
	modelId: string;
	/** True while a question or approval card waits. The API then refuses a Fast change, so the Fast row is off. */
	isFastBlocked: boolean;
	/** Turns Fast mode on or off for the next sends of this conversation. The tier stays. */
	onFastChange: (isFast: boolean) => void;
};

/** Props of the lock chip. composer.tsx passes them from the chat pane. */
export type ModelLockChipProps = {
	/** The model pick of the composer. The chip reads its models and its thinking pick. Nothing renders while `pick.models` is undefined. */
	pick: BuilderModelPick;
	lock: ModelLock;
	/** Creates an empty conversation and opens it, from the page. Absent for a project viewer: the note then has no button. */
	onCreateChat?: () => void;
};

/**
 * A soft chip like the model menu chip, with a lock in place of the gauge.
 * It stays enabled while a turn runs: a Fast or thinking change applies
 * from the next send.
 */
export function ModelLockChip({
	pick,
	lock,
	onCreateChat,
}: ModelLockChipProps) {
	const { t } = useTranslation();
	const models = pick.models;
	if (models === undefined) return null;
	const tier = builderTierOf(models, lock.modelId);
	// builderTierOf maps a Fast row to its tier, so an id other than the tier model is the Fast row.
	const isFast = tier !== undefined && lock.modelId !== tier.modelId;
	// A lock on a Fast row that the list no longer has stays switchable, so the user can turn it off.
	const canSwitchFast =
		isFast ||
		(tier !== undefined && fastModelOf(models, tier.modelId) !== undefined);
	const tierName =
		tier === undefined
			? undefined
			: t(`appBuilder.chat.model.tiers.${tier.id}.name`);
	// Product rule: users never see a model name. An id outside the tiers gets a generic label.
	const chipText = tierName ?? t("appBuilder.chat.model.lock.unknown");
	const hasThinking = hasThinkingControl(models, lock.modelId);
	// The chip marks a level other than Balanced, only where the control applies it.
	const markedThinking =
		hasThinking && pick.thinking !== "balanced" ? pick.thinking : undefined;
	const lockLabel =
		tierName === undefined
			? chipText
			: t(
					isFast
						? "appBuilder.chat.model.lock.chipFast"
						: "appBuilder.chat.model.lock.chip",
					{ tier: tierName },
				);
	const chipLabel =
		markedThinking === undefined
			? lockLabel
			: t("appBuilder.chat.model.thinking.chipLabel", {
					label: lockLabel,
					level: t(`appBuilder.chat.model.thinking.${markedThinking}.name`),
				});

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-label={chipLabel}
					className={cn(
						PROMPT_CHIP_CLASS,
						// The kit `sm` size pads a button with an svg child through `has-[>svg]`, so the padding uses the same variant.
						"h-8 min-w-0 shrink gap-1.5 text-[13px] has-[>svg]:ps-2.5 has-[>svg]:pe-3",
					)}
				>
					<LockSimpleIcon
						weight="bold"
						className={cn(
							"size-4 shrink-0",
							tier === undefined ? undefined : TIER_STYLE[tier.id].text,
						)}
						aria-hidden
					/>
					<span className="min-w-0 truncate">{chipText}</span>
					{isFast ? (
						<LightningIcon
							weight="fill"
							className="size-3.5 shrink-0 text-amber-500"
							aria-hidden
						/>
					) : null}
					{markedThinking === undefined ? null : (
						<ThinkingMark level={markedThinking} />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				collisionPadding={12}
				className="w-64 max-w-[calc(100vw-24px)] p-3"
			>
				<p className="font-grotesk font-semibold text-[13px]">{chipText}</p>
				<p className="mt-1 font-sans text-[12px] text-popover-foreground/75 leading-snug">
					{t("appBuilder.chat.model.lock.body")}
				</p>
				{onCreateChat ? (
					// The page opens the new conversation and mounts a new composer. The close also runs when the create fails.
					<PopoverClose asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onCreateChat}
							className={cn("mt-2.5 w-full", CARD_SECONDARY_BUTTON_CLASS)}
						>
							{t("appBuilder.chat.model.lock.newChat")}
						</Button>
					</PopoverClose>
				) : null}
				<ModeSwitchRow
					icon={LightningIcon}
					title={t("appBuilder.chat.model.fast")}
					// Fast and normal keep separate prompt caches, so the first message after a switch writes the whole conversation again.
					hint={`${t("appBuilder.chat.model.fastWarning")} ${t("appBuilder.chat.model.lock.fastSwitchHint")}`}
					unavailableHint={
						lock.isFastBlocked
							? t("appBuilder.chat.model.lock.fastAfterCard")
							: canSwitchFast
								? undefined
								: t("appBuilder.chat.model.fastUnavailable", {
										tier: chipText,
									})
					}
					checked={isFast}
					onCheckedChange={lock.onFastChange}
				/>
				<ThinkingLevelRow
					level={hasThinking ? pick.thinking : "balanced"}
					onLevelChange={pick.setThinking}
					unavailableHint={
						hasThinking
							? undefined
							: t("appBuilder.chat.model.thinking.unavailable", {
									tier: chipText,
								})
					}
				/>
			</PopoverContent>
		</Popover>
	);
}
