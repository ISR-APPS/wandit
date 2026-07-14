// The publish slide-in panel (dc 4a): a 416px sheet anchored under the 52px
// header that walks the go-live journey — subdomain config, deploy progress,
// the live state with share tools, updates and version history. All
// deployment effects run through the workspace store's mock jobs; the panel
// is a pure view over that state.

import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetTitle,
} from "@wandit/ui/components/sheet";
import { ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";
import { RoundIconButton } from "./publish-bits";
import {
	ConfigStep,
	HistoryStep,
	LiveStep,
	PublishingStep,
	UpdateStep,
} from "./publish-steps";

export type PublishPanelStep =
	| "config"
	| "publishing"
	| "live"
	| "update"
	| "history";

export function PublishPanel() {
	const { t } = useTranslation();
	const {
		publishPanelOpen,
		setPublishPanelOpen,
		state,
		activeVersion,
		project,
	} = useWorkspace();
	const deployment = state?.deployment;

	const [step, setStep] = useState<PublishPanelStep>("config");

	// Where the panel lands when opened, from the current mock state.
	const deriveLandingStep = (): PublishPanelStep => {
		if (!deployment || deployment.state === "draft") return "config";
		if (deployment.state === "publishing") return "publishing";
		const hasChanges =
			activeVersion != null &&
			deployment.publishedVersionId !== null &&
			activeVersion.id !== deployment.publishedVersionId;
		return hasChanges ? "update" : "live";
	};
	const deriveRef = useRef(deriveLandingStep);
	deriveRef.current = deriveLandingStep;
	useEffect(() => {
		if (publishPanelOpen) setStep(deriveRef.current());
	}, [publishPanelOpen]);

	// The mock publish job completes on its own — advance the view when it does.
	useEffect(() => {
		if (step === "publishing" && deployment?.state === "published") {
			setStep("live");
		}
	}, [step, deployment?.state]);

	return (
		<Sheet open={publishPanelOpen} onOpenChange={setPublishPanelOpen}>
			<SheetContent
				side="right"
				showCloseButton={false}
				aria-describedby={undefined}
				overlayClassName="top-[52px] bg-foreground/25 backdrop-blur-[1.5px]"
				className="top-[52px] flex h-auto w-[416px] max-w-full flex-col gap-0 border-s p-0 shadow-panel sm:max-w-none"
			>
				<header className="flex h-14 shrink-0 items-center gap-[9px] border-b px-[18px]">
					<ArrowUp
						className="size-[17px] shrink-0 text-ember-text"
						strokeWidth={2.2}
					/>
					<SheetTitle className="truncate font-semibold text-base tracking-[-0.4px]">
						{t(`workspace.publish.panel.titles.${step}`)}
					</SheetTitle>
					{step === "config" && project ? (
						<span dir="auto" className="truncate text-muted-foreground text-sm">
							· {project.name}
						</span>
					) : null}
					<SheetClose asChild>
						<RoundIconButton
							aria-label={t("common.close")}
							className="ms-auto bg-transparent text-muted-foreground"
						>
							<X className="size-[15px]" strokeWidth={2} />
						</RoundIconButton>
					</SheetClose>
				</header>

				<div
					key={step}
					className="fade-in-0 flex min-h-0 flex-1 animate-in flex-col duration-200"
				>
					{step === "config" ? (
						<ConfigStep onPublishStart={() => setStep("publishing")} />
					) : step === "publishing" ? (
						<PublishingStep
							onCancelled={(stillLive) =>
								setStep(stillLive ? "live" : "config")
							}
						/>
					) : step === "live" ? (
						<LiveStep onShowHistory={() => setStep("history")} />
					) : step === "update" ? (
						<UpdateStep
							onPublishStart={() => setStep("publishing")}
							onShowHistory={() => setStep("history")}
						/>
					) : step === "history" ? (
						<HistoryStep
							onRestoreStart={() => setStep("publishing")}
							onUnpublished={() => setStep("config")}
						/>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}
