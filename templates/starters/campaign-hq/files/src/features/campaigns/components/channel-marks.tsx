// The channels of one campaign as a row of color marks, with the names for screen readers and a hover title.
// The campaign table renders it under the campaign name, where the full names do not fit.
import { type Channel, ChannelMark } from "~/features/marketing";
import { useT } from "~/shared/i18n";

type ChannelMarksProps = {
	/** The channels of the media plan, in chart order. */
	channels: Channel[];
};

/** One mark per channel. The names join into one text for the title and for screen readers. */
export function ChannelMarks({ channels }: ChannelMarksProps) {
	const { t, locale } = useT();
	const names = new Intl.ListFormat(locale, { type: "unit" }).format(
		channels.map((channel) => t(`channels.${channel}`)),
	);
	return (
		<span className="flex items-center gap-1" title={names}>
			{channels.map((channel) => (
				<ChannelMark key={channel} channel={channel} className="size-3" />
			))}
			<span className="sr-only">{names}</span>
		</span>
	);
}
