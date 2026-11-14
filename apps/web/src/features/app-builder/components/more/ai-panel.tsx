/**
 * AI panel of the More view: the app AI gateway of the project. It shows the
 * On or Off state, the credits and the calls of this month, and the models.
 * It turns the gateway on, rotates the key, or turns it off, each after a
 * confirm dialog. The panel never shows the key. Rendered by more-view.tsx
 * inside PanelShell. Reads appAiStatusQuery; writes through useChangeAppAiKey.
 */

import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery } from "@tanstack/react-query";
import { centiCreditsToCredits } from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { formatCreditAmount } from "@/features/credits";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";
import {
	type AppAiKeyAction,
	useChangeAppAiKey,
} from "../../api/app-ai.mutations";
import { appAiStatusQuery } from "../../api/app-ai.queries";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import {
	PANEL_CARD_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "./panel-shell";

/** Muted body text of the panel cards. */
const MUTED_TEXT_CLASS =
	"font-sans text-[14px] text-night/60 leading-relaxed dark:text-foreground/60";

/** Props of AiPanel. more-view.tsx passes them. */
export type AiPanelProps = {
	projectId: string;
	/** True while this panel is on screen: the More view is open and the code screen does not cover it. The status read waits for it. */
	isActive: boolean;
};

/** The gateway card with its actions, then the model card. */
export function AiPanel({ projectId, isActive }: AiPanelProps) {
	const { t, locale } = useTranslation();
	const status = useQuery(appAiStatusQuery(projectId, isActive));
	const change = useChangeAppAiKey(projectId);
	// The dialog keeps the last action while it closes, so its text does not
	// go blank during the close animation.
	const [confirmAction, setConfirmAction] = useState<AppAiKeyAction>("enable");
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);

	// A failed refetch keeps the last status on screen. Only a first load without data shows the error.
	if (status.data === undefined) {
		return status.isError ? (
			<PanelMessage
				icon={WarningCircleIcon}
				text={getApiErrorMessage(status.error)}
			/>
		) : (
			<Skeleton className="h-[260px] rounded-[20px]" />
		);
	}

	const { enabled, keyUpdatedAt, monthCredits, monthRequests, defaultModel } =
		status.data;
	// The API counts centi-credits; the credit formatters take whole credits.
	const credits = centiCreditsToCredits(monthCredits);
	const usage = [
		{
			label: t("appBuilder.ai.monthCredits"),
			value: formatCreditAmount(credits, locale),
		},
		{
			label: t("appBuilder.ai.monthRequests"),
			value: formatNumber(monthRequests, locale),
		},
	];

	function askConfirm(action: AppAiKeyAction) {
		setConfirmAction(action);
		setIsConfirmOpen(true);
	}

	function actionButton(action: AppAiKeyAction) {
		return (
			<Button
				variant={action === "enable" ? "default" : "outline"}
				className={
					action === "enable"
						? PANEL_PRIMARY_BUTTON_CLASS
						: PANEL_SECONDARY_BUTTON_CLASS
				}
				disabled={change.isPending}
				onClick={() => askConfirm(action)}
			>
				{change.isPending && change.variables === action ? (
					<CircleNotchIcon aria-hidden weight="bold" className="animate-spin" />
				) : null}
				{t(`appBuilder.ai.actions.${action}`)}
			</Button>
		);
	}

	return (
		<>
			<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4 p-5")}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
						{t("appBuilder.ai.gateway")}
					</h2>
					<PanelChip tone={enabled ? "success" : "neutral"}>
						{enabled ? t("appBuilder.ai.on") : t("appBuilder.ai.off")}
					</PanelChip>
				</div>
				<div className="flex flex-col gap-2">
					<p className={MUTED_TEXT_CLASS}>{t("appBuilder.ai.howItWorks")}</p>
					<p className={MUTED_TEXT_CLASS}>{t("appBuilder.ai.keySafety")}</p>
					<p className={MUTED_TEXT_CLASS}>{t("appBuilder.ai.noCredits")}</p>
				</div>
				<dl className="grid gap-3 sm:grid-cols-2">
					{usage.map((item) => (
						<div
							key={item.label}
							className="rounded-[14px] bg-night/[0.03] px-4 py-3 dark:bg-white/[0.04]"
						>
							<dt className="font-sans text-[12px] text-night/55 dark:text-foreground/55">
								{item.label}
							</dt>
							<dd className="mt-0.5 font-grotesk font-semibold text-[18px] text-night tabular-nums dark:text-foreground">
								{item.value}
							</dd>
						</div>
					))}
				</dl>
				{enabled && keyUpdatedAt !== null ? (
					<p className="font-sans text-[13px] text-night/50 dark:text-foreground/50">
						{t("appBuilder.ai.keyUpdated", {
							date: formatDate(keyUpdatedAt, locale, CLOUD_DATE_TIME_FORMAT),
						})}
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-3">
					{enabled ? (
						<>
							{actionButton("rotate")}
							{actionButton("disable")}
						</>
					) : (
						actionButton("enable")
					)}
				</div>
			</section>
			<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3 p-5")}>
				<h2 className="font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
					{t("appBuilder.ai.models")}
				</h2>
				<p className={MUTED_TEXT_CLASS}>{t("appBuilder.ai.modelsHint")}</p>
				<ul className="flex flex-wrap gap-2">
					{status.data.models.map((model) => (
						<li key={model}>
							<PanelChip tone={model === defaultModel ? "ember" : "neutral"}>
								{/* A model id reads left to right, also in Arabic. */}
								<span dir="ltr" className="font-mono">
									{model}
								</span>
								{model === defaultModel ? (
									<span>· {t("appBuilder.ai.defaultModel")}</span>
								) : null}
							</PanelChip>
						</li>
					))}
				</ul>
			</section>
			<AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t(`appBuilder.ai.confirm.${confirmAction}.title`)}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t(`appBuilder.ai.confirm.${confirmAction}.description`)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("appBuilder.ai.confirm.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant={confirmAction === "disable" ? "destructive" : "default"}
							onClick={() =>
								change.mutate(confirmAction, {
									onSuccess: () =>
										toast.success(
											t(`appBuilder.ai.confirm.${confirmAction}.done`),
										),
								})
							}
						>
							{t(`appBuilder.ai.actions.${confirmAction}`)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
