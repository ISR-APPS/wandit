/**
 * The conversation switcher at the start of the chat header. The trigger
 * shows the title of the open conversation. The menu lists every
 * conversation of the project, then the "New conversation" action.
 * Rendered by chat-pane.tsx. The page owns the list, the switch, and the
 * create call.
 */

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import type { ProjectChat } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItemBare,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";

import { formatDate, useTranslation } from "@/lib/i18n";

/** Props from chat-pane.tsx; the values come from pages/app-builder-page.tsx. */
export type ChatSwitcherProps = {
	/** Conversations of the project, the most recent activity first. From the conversation list query of the page. */
	chats: readonly ProjectChat[];
	/** Id of the open conversation, a row of `chats`. Undefined while the list loads. */
	openChatId: string | undefined;
	/** Id of the conversation that holds the project, from useBuilderThread. Its row gets the "Working" mark. Null when none holds it. */
	busyChatId: string | null;
	/** Opens one conversation. The page writes its id to `?chat=`. */
	onOpenChat: (chatId: string) => void;
	/** Creates an empty conversation and opens it. Absent for a project viewer: the menu then has no such item. */
	onCreateChat?: () => void;
};

/**
 * A text button that shrinks and cuts the title in a narrow header, and
 * its menu. The open row has a check. A pick opens that conversation.
 */
export function ChatSwitcher({
	chats,
	openChatId,
	busyChatId,
	onOpenChat,
	onCreateChat,
}: ChatSwitcherProps) {
	const { t, locale } = useTranslation();
	const newChatText = t("appBuilder.chat.conversations.new");
	const openChat = chats.find((chat) => chat.id === openChatId);
	// Before the list loads, the header shows the name of the pane.
	const title =
		openChat === undefined
			? t("appBuilder.chat.title")
			: (openChat.title ?? newChatText);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label={t("appBuilder.chat.conversations.trigger", { title })}
					// The negative margin puts the title text on the 20 px line of the message list.
					className="group/trigger -ms-2 h-8 min-w-0 shrink gap-1.5 px-2 font-grotesk font-semibold text-[15px] text-night hover:bg-night/[0.05] hover:text-night has-[>svg]:px-2 dark:text-foreground dark:hover:bg-white/[0.06] dark:hover:text-foreground"
				>
					{/* A title is user text, so its direction follows its first letter. */}
					<span dir="auto" className="min-w-0 truncate">
						{title}
					</span>
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
				{/* "" checks no row while the list loads. */}
				<DropdownMenuRadioGroup
					value={openChatId ?? ""}
					onValueChange={onOpenChat}
				>
					{chats.map((chat) => (
						<DropdownMenuRadioItemBare key={chat.id} value={chat.id}>
							<span className="min-w-0 flex-1">
								<span dir="auto" className="block truncate">
									{chat.title ?? newChatText}
								</span>
								<span className="flex items-center gap-2 font-normal font-sans text-muted-foreground text-xs">
									{/* The last activity: the newest message, else the creation. */}
									{formatDate(chat.lastMessageAt ?? chat.createdAt, locale, {
										day: "numeric",
										month: "short",
									})}
									{chat.id === busyChatId ? (
										<span className="flex items-center gap-1 font-grotesk font-medium text-ember-text">
											<span
												aria-hidden
												className="size-1.5 animate-pulse-soft rounded-full bg-ember motion-reduce:animate-none dark:bg-spark"
											/>
											{t("appBuilder.chat.conversations.working")}
										</span>
									) : null}
								</span>
							</span>
							{/* The check follows the checked state that Radix sets on the row (`group/row`). */}
							<CheckIcon
								weight="bold"
								className="size-4 shrink-0 text-primary opacity-0 group-data-[state=checked]/row:opacity-100"
								aria-hidden
							/>
						</DropdownMenuRadioItemBare>
					))}
				</DropdownMenuRadioGroup>
				{onCreateChat ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={onCreateChat}>
							<PlusIcon weight="bold" aria-hidden />
							{newChatText}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
