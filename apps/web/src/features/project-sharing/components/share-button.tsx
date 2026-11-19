/**
 * The Share button of the V2 builder top bar, with the avatars of the people
 * who have a direct grant. A click opens share-dialog.tsx. Rendered by
 * WorkBar in app-builder/components/shell/top-bar.tsx before the Publish button.
 * Reads projectSharingQuery for the avatars. Hidden while sharing is off.
 */
import { UserPlusIcon } from "@phosphor-icons/react/UserPlus";
import { useQuery } from "@tanstack/react-query";
import { AvatarGroup, AvatarGroupCount } from "@wandit/ui/components/avatar";
import { Button } from "@wandit/ui/components/button";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { projectSharingQuery } from "../api/sharing.queries";
import { useSharingEnabled } from "../lib/hooks";
import { PersonAvatar, ProjectShareDialog } from "./share-dialog";

/** Avatars the stack shows before the "+n" count. */
const AVATAR_STACK_MAX = 3;

/** Props of ShareButton. The V2 top bar passes the open project. */
export type ShareButtonProps = {
	/** Id of the open V2 project. */
	projectId: string;
	/** Name of the project, for the dialog title. */
	projectName: string;
};

/** Opens the Share dialog. Hidden while `organizationsEnabled` is off. Shows avatars only when a direct grant exists. */
export function ShareButton({ projectId, projectName }: ShareButtonProps) {
	const { t } = useTranslation();
	const isSharingEnabled = useSharingEnabled();
	const [isOpen, setIsOpen] = useState(false);
	const sharing = useQuery({
		...projectSharingQuery(projectId),
		enabled: isSharingEnabled,
	});

	if (!isSharingEnabled) return null;

	// The owner alone needs no stack: the button then shows only its label.
	const people =
		sharing.data === undefined || sharing.data.members.length === 0
			? []
			: [sharing.data.owner, ...sharing.data.members];

	return (
		<>
			<Button
				variant="outline"
				aria-label={t("sharing.share.button")}
				onClick={() => setIsOpen(true)}
				// A flat white pill with a hairline, one step under the ember Publish key next to it.
				className="h-8 gap-2 rounded-full border-night/[0.12] bg-white px-2.5 font-grotesk font-medium text-[13px] text-night hover:bg-night/[0.04] hover:text-night active:translate-y-px sm:px-4 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground"
			>
				{people.length > 0 ? (
					// The stack needs room, so a phone shows only the icon.
					<AvatarGroup className="hidden md:flex">
						{people.slice(0, AVATAR_STACK_MAX).map((person) => (
							<PersonAvatar
								key={person.userId}
								person={person}
								className="size-6 text-xs"
							/>
						))}
						{people.length > AVATAR_STACK_MAX ? (
							<AvatarGroupCount className="size-6 text-xs">
								+{people.length - AVATAR_STACK_MAX}
							</AvatarGroupCount>
						) : null}
					</AvatarGroup>
				) : null}
				<UserPlusIcon
					aria-hidden
					weight="bold"
					className={people.length > 0 ? "size-4 md:hidden" : "size-4"}
				/>
				<span className="hidden sm:inline">{t("sharing.share.button")}</span>
			</Button>
			<ProjectShareDialog
				projectId={projectId}
				projectName={projectName}
				open={isOpen}
				onOpenChange={setIsOpen}
			/>
		</>
	);
}
