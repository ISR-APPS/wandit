// Launch-window teaser for accounts outside the early-access list: the
// dashboard prompt box accepts their idea, then lands here — a lightweight
// lookalike of the real /p/$projectId workspace (same horizon band, header,
// floating chat + main cards) with the chat frozen and the main pane showing
// Coming Soon. Nothing is created server-side; the typed prompt only travels
// via same-tab history state so it can be echoed back as their chat bubble.

import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Textarea } from "@wandit/ui/components/textarea";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowUp } from "lucide-react";

import { Spark } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/features/auth";
import { WORKSPACE_TABS } from "@/features/workspace";
import { useTranslation } from "@/lib/i18n";

// The real workspace's tab bar, frozen: Page reads as active, the rest sit
// muted and inert — the teaser shows what exists without letting anyone in.
function PreviewTabs() {
	const { t } = useTranslation();

	return (
		<nav
			aria-label={t("workspace.tabsAriaLabel")}
			className="flex items-center gap-0.5 rounded-full border border-border bg-muted p-[3px]"
		>
			{WORKSPACE_TABS.map((def, index) => {
				const isActive = index === 0;
				return (
					<span
						key={def.value}
						aria-disabled="true"
						className={cn(
							"relative flex h-7 select-none items-center gap-1.5 rounded-full px-3 text-[13px]",
							isActive
								? "bg-background font-medium text-foreground shadow-segment"
								: "text-muted-foreground",
						)}
					>
						<def.icon className="size-3.5 shrink-0" strokeWidth={1.7} />
						<span>{t(`workspace.tabs.${def.value}`)}</span>
					</span>
				);
			})}
		</nav>
	);
}

export default function WorkspacePreviewPage({ prompt }: { prompt?: string }) {
	const { t } = useTranslation();

	return (
		<div className="relative flex h-svh flex-col overflow-hidden bg-background">
			{/* Same ambient horizon band as the real workspace. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[150px] bg-gradient-horizon opacity-90 [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_34%,transparent_92%)] [mask-image:linear-gradient(to_bottom,black_0%,black_34%,transparent_92%)]"
			/>

			<header className="relative z-40 flex h-[52px] shrink-0 items-center gap-[11px] border-b bg-background/72 px-4 backdrop-blur-sm">
				<Link
					to="/dashboard"
					aria-label={t("workspace.backToDashboard")}
					className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-gradient-ember">
						<Spark className="size-3.5 text-background" />
					</span>
					<span className="hidden font-semibold text-foreground text-lg tracking-[-0.5px] sm:block">
						wandit
					</span>
				</Link>
				<div className="ms-auto flex items-center gap-1.5">
					<ModeToggle />
					<UserMenu />
				</div>
			</header>

			<div className="relative z-10 flex min-h-0 flex-1 bg-background">
				{/* Chat card — frozen: their prompt, one reply, disabled composer. */}
				<div className="hidden h-full w-[400px] shrink-0 py-3 ps-3 pe-1 md:block">
					<div className="flex h-full flex-col rounded-2xl border bg-secondary">
						<div className="flex shrink-0 items-center gap-2 px-4 py-3">
							<span className="font-medium text-sm">
								{t("projects.previewChatTitle")}
							</span>
						</div>
						<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
							{prompt ? (
								<div className="flex justify-end">
									<div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-ee-md border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed">
										{prompt}
									</div>
								</div>
							) : null}
							<div className="flex items-start gap-2.5">
								<span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-gradient-ember">
									<Spark className="size-3 text-background" />
								</span>
								<p className="pt-0.5 text-sm leading-relaxed">
									{t("projects.previewAssistant")}
								</p>
							</div>
						</div>
						<div className="shrink-0 p-3">
							<div className="rounded-xl border bg-background p-2 opacity-60">
								<Textarea
									disabled
									rows={2}
									placeholder={t("projects.previewComposerPlaceholder")}
									className="min-h-0 resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0"
								/>
								<div className="flex justify-end">
									<Button
										size="icon-sm"
										disabled
										aria-label={t("projects.previewComposerPlaceholder")}
									>
										<ArrowUp className="size-4" />
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Main card — real tab bar on top, Coming Soon takeover below. */}
				<div className="h-full min-w-0 flex-1 py-3 ps-3 pe-3 md:ps-1">
					<div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-secondary">
						<div className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b px-3.5">
							<PreviewTabs />
						</div>
						<div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
							<div
								aria-hidden
								className="pointer-events-none absolute inset-0 bg-dots"
							/>
							<div className="relative flex size-14 items-center justify-center rounded-2xl border bg-card shadow-xs">
								<Spark className="size-6 text-primary" />
							</div>
							<h1 className="relative mt-5 font-display font-semibold text-2xl tracking-tight md:text-3xl">
								{t("projects.promptSoonTitle")}
							</h1>
							<p className="relative mt-2 max-w-md text-balance text-muted-foreground text-sm md:text-base">
								{t("projects.promptSoonBody")}
							</p>
							<Button asChild variant="outline" className="relative mt-6">
								<Link to="/dashboard">{t("workspace.backToDashboard")}</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
