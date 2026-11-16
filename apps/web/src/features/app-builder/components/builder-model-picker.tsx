/**
 * The model menu of a V2 prompt box: a chip with the model name, a list of
 * every priced model with its input and output price, and a lightning toggle
 * for the Fast variant. The builder composer and the dashboard prompt box
 * (features/projects, through the barrel) render it. useBuilderModelPick owns
 * the state. helpers.ts pairs a model with its Fast variant.
 */

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CpuIcon } from "@phosphor-icons/react/Cpu";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import type { LlmModelPrice } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import { baseModelIdOf, fastModelOf } from "../lib/helpers";
import type { BuilderModelPick } from "../lib/use-builder-model-pick";

/** Props of the model menu. The caller wraps it in a TooltipProvider. */
export type BuilderModelPickerProps = {
	/** The menu state from useBuilderModelPick. Nothing renders while `pick.models` is undefined. */
	pick: BuilderModelPick;
	/** True while the prompt box cannot send, for example during a send. */
	disabled?: boolean;
	/** `md` is 36 px high, for the dashboard hero box. `sm` is 32 px, for the builder composer. */
	size?: "sm" | "md";
};

/**
 * A soft navy chip that turns into a solid night pill (spark in dark mode)
 * while its menu is open. chat/composer.tsx uses it for its menu chips too.
 * A copy of HERO_CHIP_CLASS in features/projects/components/prompt-box.tsx,
 * so the two prompt boxes match. The open look keys on aria-expanded: a
 * tooltip on the same button overwrites data-state.
 */
export const PROMPT_CHIP_CLASS =
	"group/trigger rounded-full border-transparent bg-night/[0.05] font-grotesk font-medium text-night/75 shadow-none transition-colors duration-200 hover:bg-night/[0.09] hover:text-night aria-expanded:bg-night aria-expanded:text-paper dark:border-transparent dark:bg-white/[0.06] dark:text-foreground/75 dark:aria-expanded:bg-spark dark:aria-expanded:text-night dark:hover:bg-white/[0.1] dark:hover:text-foreground";

/**
 * A chip that opens the model list, and a lightning toggle while the picked
 * model has a Fast variant. A pick applies from the next send. The chip
 * shrinks and cuts the name in a narrow composer row.
 */
export function BuilderModelPicker({
	pick,
	disabled = false,
	size = "sm",
}: BuilderModelPickerProps) {
	const { t, locale } = useTranslation();
	const models = pick.models;
	if (models === undefined) return null;
	// The chip and the menu show the base model, also while its Fast variant runs.
	const baseModelId =
		pick.modelId === undefined
			? undefined
			: baseModelIdOf(models, pick.modelId);
	const fastModel =
		baseModelId === undefined ? undefined : fastModelOf(models, baseModelId);
	const isFast = fastModel !== undefined && pick.modelId === fastModel.modelId;
	const label =
		baseModelId === undefined
			? t("appBuilder.chat.model.default")
			: getModelLabel(baseModelId);
	const usd = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
	});
	const priceOf = (model: LlmModelPrice) =>
		t("appBuilder.chat.model.price", {
			input: usd.format(model.inputUsdPerMTok),
			output: usd.format(model.outputUsdPerMTok),
		});
	const pickModel = (modelId: string) => {
		// Product rule: Fast mode stays on across a model switch when the new model has a Fast variant.
		const nextFastModel = isFast ? fastModelOf(models, modelId) : undefined;
		pick.setModelId(nextFastModel?.modelId ?? modelId);
	};
	return (
		<div className="flex min-w-0 items-center gap-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						aria-label={t("appBuilder.chat.model.chip", { model: label })}
						className={cn(
							PROMPT_CHIP_CLASS,
							"min-w-0 shrink gap-1.5",
							// The kit `sm` size pads a button with an svg child through `has-[>svg]`, so the padding uses the same variant.
							size === "md"
								? "h-9 text-[13.5px] has-[>svg]:ps-3 has-[>svg]:pe-3"
								: "h-8 text-[13px] has-[>svg]:ps-2.5 has-[>svg]:pe-2.5",
						)}
					>
						<CpuIcon weight="bold" className="size-4 shrink-0" aria-hidden />
						<span className="min-w-0 truncate">{label}</span>
						<CaretDownIcon
							weight="bold"
							className="size-3 shrink-0 transition-transform duration-200 group-aria-expanded/trigger:rotate-180 motion-reduce:transition-none"
							aria-hidden
						/>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					sideOffset={8}
					collisionPadding={12}
					className="w-72"
				>
					<DropdownMenuLabel>
						{t("appBuilder.chat.model.title")}
					</DropdownMenuLabel>
					{/* "" checks no row while the server default runs. */}
					<DropdownMenuRadioGroup
						value={baseModelId ?? ""}
						onValueChange={pickModel}
					>
						{/* A paired Fast row has no menu row. The lightning toggle of its base picks it. */}
						{models
							.filter(
								(model) =>
									baseModelIdOf(models, model.modelId) === model.modelId,
							)
							.map((model) => (
								<DropdownMenuRadioItem
									key={model.modelId}
									value={model.modelId}
								>
									<span className="min-w-0">
										<span className="block truncate font-medium">
											{getModelLabel(model.modelId)}
										</span>
										<span className="block font-sans text-muted-foreground text-xs tabular-nums">
											{priceOf(model)}
										</span>
									</span>
								</DropdownMenuRadioItem>
							))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{baseModelId !== undefined && fastModel !== undefined ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							aria-label={t("appBuilder.chat.model.fast")}
							aria-pressed={isFast}
							disabled={disabled}
							onClick={() =>
								pick.setModelId(isFast ? baseModelId : fastModel.modelId)
							}
							className={cn(
								PROMPT_CHIP_CLASS,
								"aria-pressed:bg-night aria-pressed:text-paper dark:aria-pressed:bg-spark dark:aria-pressed:text-night",
								size === "md" && "size-9",
							)}
						>
							<LightningIcon
								weight={isFast ? "fill" : "bold"}
								className="size-4"
								aria-hidden
							/>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="text-center">
						<span className="block">{t("appBuilder.chat.model.fast")}</span>
						<span className="block font-normal font-sans tabular-nums opacity-75">
							{priceOf(fastModel)}
						</span>
					</TooltipContent>
				</Tooltip>
			) : null}
		</div>
	);
}
