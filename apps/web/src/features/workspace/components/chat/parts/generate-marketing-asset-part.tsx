// In-thread status line for a generate_marketing_asset call. The document
// itself NEVER renders in chat — generation runs in a background task and the
// finished card lands in the Marketing tab. This part reports the hand-off
// stage and offers a jump to that tab.

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect } from "react";

import { useTranslation } from "@/lib/i18n";
import { marketingAssetKeys } from "../../../api/marketing-assets.queries";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type GenerateMarketingAssetToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_marketing_asset" }
>;

export function GenerateMarketingAssetPart({
	part,
}: {
	part: GenerateMarketingAssetToolPart;
}) {
	const { t } = useTranslation();
	const { projectId, setTab } = useWorkspace();
	const queryClient = useQueryClient();

	const queued =
		part.state === "output-available" && part.output.status === "queued";

	// Wake the Marketing tab's list the moment work is queued so its polling
	// starts even before the user switches tabs.
	useEffect(() => {
		if (!queued) return;
		void queryClient.invalidateQueries({
			queryKey: marketingAssetKeys.list(projectId),
		});
	}, [queued, projectId, queryClient]);

	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={
					part.state === "input-streaming"
						? t("workspace.chat.marketingAsset.preparing")
						: t("workspace.chat.marketingAsset.queueing")
				}
			/>
		);
	}

	if (part.state === "output-error") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker={t("workspace.chat.marketingAsset.failedToStart")}
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{part.errorText}
				</p>
			</div>
		);
	}

	if (part.state !== "output-available") return null;

	if (part.output.status === "queued") {
		const title = part.input?.title;
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-primary/38 bg-primary/12 text-ember-text"
					kickerClass="text-ember-text"
					kicker={t("workspace.chat.marketingAsset.buildingKicker")}
				>
					<SpinnerArc className="size-3" />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{title
						? t("workspace.chat.marketingAsset.buildingNamed", { title })
						: t("workspace.chat.marketingAsset.building")}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-2 h-7 rounded-lg px-2.5 text-xs"
					onClick={() => setTab("marketing")}
				>
					{t("workspace.chat.marketingAsset.openTab")}
					<ArrowRight className="size-3" aria-hidden />
				</Button>
			</div>
		);
	}

	// "unavailable" — relay the tool's honest message.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

function WorkingLine({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
			<SpinnerArc className="size-3.5" />
			<span>{text}</span>
		</div>
	);
}
