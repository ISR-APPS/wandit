// The ring bell of the booking ticket, inside three gold rings.
// booking-ticket.tsx renders it with a new key for each choice, so landing.css rings it again.

/** A bell drawing. `label` is its text for screen readers. */
export function BellVisual({ label }: { label: string }) {
	return (
		<div className="sp-bell-ring relative m-1.5 size-14 shrink-0 sm:m-3 sm:size-18 md:m-5 md:size-20">
			<span className="sp-ringwave absolute inset-0" />
			<span className="sp-ringwave absolute inset-0" />
			<span className="sp-ringwave absolute inset-0" />
			<svg
				viewBox="0 0 76 76"
				role="img"
				aria-label={label}
				className="absolute inset-0 m-auto size-11"
			>
				<path
					d="M38 8c-11 0-19 8-19 19v14l-7 9v4h52v-4l-7-9V27c0-11-8-19-19-19z"
					fill="none"
					strokeWidth="4"
					strokeLinejoin="round"
					className="stroke-(color:--sp-gold)"
				/>
				<circle cx="38" cy="62" r="6" className="fill-(--sp-gold)" />
			</svg>
		</div>
	);
}
