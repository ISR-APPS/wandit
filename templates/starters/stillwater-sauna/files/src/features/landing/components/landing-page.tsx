/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */

import "../landing.css";

/** The session links open an email with the selected service in its subject. */
export function LandingPage() {
	return (
		<div className="stillwater">
			<header>
				<a className="stillwater-brand" href="#top">
					Stillwater<span>Lake sauna</span>
				</a>
				<nav aria-label="Visit">
					<a href="#sessions">Sessions</a>
					<a href="#visit">Your visit</a>
				</nav>
			</header>
			<main id="top">
				<section className="stillwater-hero">
					<img
						src="/images/hero.webp"
						alt="A cedar sauna on a misty lake"
						fetchPriority="high"
					/>
					<div>
						<p>Heat. Cold water. Quiet.</p>
						<h1>
							Come back
							<br />
							to still water.
						</h1>
						<a className="stillwater-link" href="#sessions">
							Find a session <span aria-hidden="true">↘</span>
						</a>
					</div>
				</section>
				<section id="sessions" className="stillwater-section">
					<aside>The sauna</aside>
					<div>
						<h2>Choose how you warm up.</h2>
						<p>
							Take a seat on the cedar bench, then cool off by the water. Leave
							time to rest between rounds.
						</p>
						<article>
							<div>
								<h3>Shared bench</h3>
								<p>Join a small group for a guided first round.</p>
							</div>
							<a href="mailto:bookings@example.com?subject=Shared%20bench">
								Ask about a seat ↗
							</a>
						</article>
						<article>
							<div>
								<h3>Private cabin</h3>
								<p>Book the cabin for your own group.</p>
							</div>
							<a href="mailto:bookings@example.com?subject=Private%20cabin">
								Ask about a cabin ↗
							</a>
						</article>
					</div>
				</section>
				<section id="visit" className="stillwater-section">
					<aside>Your visit</aside>
					<div>
						<h2>Pack light.</h2>
						<p>
							Bring water, a swimsuit, and a towel. The dock can be wet. Wear
							shoes with grip and follow your host’s instructions.
						</p>
					</div>
				</section>
			</main>
			<footer>
				Stillwater Lake Sauna{" "}
				<a href="mailto:bookings@example.com">Email the sauna</a>
			</footer>
		</div>
	);
}
