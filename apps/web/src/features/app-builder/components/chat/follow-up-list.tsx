/**
 * The follow-up ideas under the last reply: a small "Follow-ups" label and
 * one row per idea, with hairlines between them. A click sends the idea as
 * the next user message. chat-message.tsx renders it from the
 * `data-follow-ups` part; chat-pane.tsx decides when the list can send.
 */

import { ArrowBendDownLeftIcon } from "@phosphor-icons/react/ArrowBendDownLeft";

import { useTranslation } from "@/lib/i18n";

/** The label and one full-width button per idea. */
export function FollowUpList({
	followUps,
	onSend,
}: {
	/** The prompts of the last `suggest_follow_ups` call, 2 or 3, no repeats. */
	followUps: string[];
	/** Sends one prompt through the composer send path of chat-pane.tsx. */
	onSend: (text: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col">
			<p className="font-grotesk font-medium text-[12px] text-night/45 dark:text-foreground/45">
				{t("appBuilder.chat.followUps")}
			</p>
			<ul className="mt-1 flex flex-col">
				{followUps.map((followUp) => (
					<li
						key={followUp}
						className="border-night/[0.08] border-b dark:border-white/[0.08]"
					>
						<button
							type="button"
							onClick={() => onSend(followUp)}
							className="group flex w-full items-start gap-2.5 rounded-[8px] py-2 text-start font-sans text-[14px] text-night/75 leading-snug outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/75 dark:hover:text-foreground"
						>
							{/* The return-key glyph of the design. It mirrors in RTL, like the reading direction. */}
							<ArrowBendDownLeftIcon
								weight="bold"
								className="mt-[3px] size-3.5 shrink-0 text-night/35 transition-colors group-hover:text-ember rtl:-scale-x-100 dark:text-foreground/35 dark:group-hover:text-spark"
								aria-hidden
							/>
							<span dir="auto" className="min-w-0">
								{followUp}
							</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
