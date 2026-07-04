// Header publish control reflecting deployment state: draft → ember Publish,
// publishing → spinner, published → dropdown with live URL, update & unpublish.

import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	ChevronDown,
	CloudOff,
	Copy,
	ExternalLink,
	Loader2,
	Rocket,
} from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { PUBLISHED_DOMAIN } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

export function PublishButton() {
	const { t } = useTranslation();
	const {
		state,
		statePending,
		versions,
		activeVersion,
		publish,
		unpublish,
		liveUrl,
	} = useWorkspace();
	const deployment = state?.deployment;

	if (statePending || !deployment) {
		return <Skeleton className="h-8 w-24 rounded-lg" />;
	}

	if (deployment.state === "publishing") {
		return (
			<Button size="sm" variant="secondary" disabled className="h-8 rounded-lg">
				<Loader2 className="size-3.5 animate-spin" />
				{t("workspace.publish.publishing")}
			</Button>
		);
	}

	if (deployment.state === "draft") {
		return (
			<Button
				size="sm"
				onClick={publish}
				disabled={versions.length === 0}
				className="h-8 rounded-lg px-3.5 shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--color-primary)_50%,transparent)]"
			>
				<Rocket className="size-3.5" />
				{t("workspace.publish.publish")}
			</Button>
		);
	}

	const displayUrl = `${deployment.slug}${PUBLISHED_DOMAIN}`;
	const needsUpdate =
		activeVersion &&
		deployment.publishedVersionId !== null &&
		activeVersion.id !== deployment.publishedVersionId;

	const copyLink = () => {
		if (liveUrl) {
			void navigator.clipboard.writeText(liveUrl);
			toast.success(t("workspace.publish.linkCopied"));
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant="outline"
					aria-label={t("workspace.publish.published")}
					className="h-8 gap-1.5 rounded-lg px-3"
				>
					<span
						aria-hidden
						className="size-1.5 shrink-0 rounded-full bg-success"
					/>
					<span className="hidden sm:inline">
						{t("workspace.publish.published")}
					</span>
					<ChevronDown className="size-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72">
				<div className="px-3 pt-2.5 pb-2">
					<p className="text-[10px] text-muted-foreground uppercase tracking-widest">
						{t("workspace.publish.menuLiveLabel")}
					</p>
					<div className="mt-1.5 flex items-center gap-1">
						<a
							href={liveUrl ?? "#"}
							target="_blank"
							rel="noreferrer"
							className="min-w-0 flex-1 truncate font-mono text-primary text-xs hover:underline"
						>
							{displayUrl}
						</a>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={t("workspace.publish.copyLink")}
							onClick={copyLink}
						>
							<Copy className="size-3.5" />
						</Button>
						<Button variant="ghost" size="icon-xs" asChild>
							<a
								href={liveUrl ?? "#"}
								target="_blank"
								rel="noreferrer"
								aria-label={t("workspace.publish.openLive")}
							>
								<ExternalLink className="size-3.5" />
							</a>
						</Button>
					</div>
				</div>
				{needsUpdate && activeVersion ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={publish}>
							<Rocket className="size-4" />
							{t("workspace.publish.publishUpdate", {
								n: activeVersion.number,
							})}
						</DropdownMenuItem>
					</>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onSelect={unpublish}>
					<CloudOff className="size-4" />
					{t("workspace.publish.unpublish")}
				</DropdownMenuItem>
				<p className="px-2 pt-1 pb-1.5 text-[10px] text-muted-foreground">
					{t("workspace.publish.freeNote")}
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
