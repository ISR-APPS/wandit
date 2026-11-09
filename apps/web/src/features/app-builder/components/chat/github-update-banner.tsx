/**
 * Strip above the composer that tells the user GitHub has commits that the
 * project did not pull, with an Update button. Its frame copies the
 * out-of-credits strip. Rendered by chat-pane.tsx as a sibling above the
 * composer. The page owns the status query and the pull mutation.
 */

import { GithubLogoIcon } from "@phosphor-icons/react/GithubLogo";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";

/** Props from chat-pane.tsx. */
export type GithubUpdateBannerProps = {
	/** True while a turn sends, the chat loads, or the pull runs. The API answers 409 to a pull during a turn. */
	isDisabled: boolean;
	/** Starts the pull. The page sends the head of the last status answer. */
	onUpdate: () => void;
	className?: string;
};

/** One status line and the Update button. */
export function GithubUpdateBanner({
	isDisabled,
	onUpdate,
	className,
}: GithubUpdateBannerProps) {
	const { t } = useTranslation();
	return (
		<div className={cn("rounded-[1.25rem] bg-primary/10 p-1 pt-0", className)}>
			<div
				role="status"
				className="flex min-h-9 items-center gap-2 py-1 ps-4 pe-1"
			>
				<GithubLogoIcon
					weight="fill"
					className="size-3.5 shrink-0 text-primary"
					aria-hidden
				/>
				<p className="min-w-0 flex-1 font-medium text-xs">
					{t("appBuilder.github.banner.text")}
				</p>
				<Button
					type="button"
					size="sm"
					className="h-7 shrink-0 rounded-full px-3 text-xs"
					disabled={isDisabled}
					onClick={onUpdate}
				>
					{t("appBuilder.github.banner.update")}
				</Button>
			</div>
		</div>
	);
}
