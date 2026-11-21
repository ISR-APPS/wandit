// The icon of each ticket channel. The ticket list tile, the thread header, and the channel donut legend use it.
// The word of the channel always shows next to the icon, so the icon is never the only mark.
import {
	ChatCircleDotsIcon,
	EnvelopeSimpleIcon,
	type Icon,
	NotePencilIcon,
	PhoneIcon,
} from "@phosphor-icons/react";
import type { TicketChannel } from "./ticket-rules";

/** One Phosphor icon per channel. Labels: `tickets.channels.<channel>`. */
export const CHANNEL_ICON = {
	email: EnvelopeSimpleIcon,
	chat: ChatCircleDotsIcon,
	web_form: NotePencilIcon,
	phone: PhoneIcon,
} satisfies Record<TicketChannel, Icon>;
