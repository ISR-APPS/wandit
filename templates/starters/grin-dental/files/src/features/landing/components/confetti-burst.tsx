// One burst of 16 sticker stars that fly out of Chompy and fall. ChompyStage renders one for each poke.
// landing.css gives each star its color, its end point, and its spin (.gd-confetti). Decorative only.

/** The star count. landing.css has one end point for each of the 16 stars. */
const STAR_COUNT = 16;
const STARS = Array.from({ length: STAR_COUNT }, (_, index) => index);

/** Calls `onDone` when the last star ends its flight, so the parent can remove the burst. */
export function ConfettiBurst({ onDone }: { onDone: () => void }) {
	return (
		<div
			aria-hidden="true"
			className="gd-confetti pointer-events-none absolute inset-0 z-10"
			onAnimationEnd={(event) => {
				if (event.target === event.currentTarget.lastElementChild) {
					onDone();
				}
			}}
		>
			{STARS.map((star) => (
				<span key={star} className="gd-star">
					<svg
						viewBox="0 0 20 20"
						aria-hidden="true"
						className="size-full"
						focusable="false"
					>
						<path
							d="M10 1l2.4 6.2L19 9l-6.6 1.8L10 17l-2.4-6.2L1 9l6.6-1.8z"
							strokeWidth="1.4"
							strokeLinejoin="round"
							className="fill-current stroke-foreground"
						/>
					</svg>
				</span>
			))}
		</div>
	);
}
