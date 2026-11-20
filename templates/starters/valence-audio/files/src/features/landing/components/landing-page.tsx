/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */

import "../landing.css";

/** The equipment links lead to the matching notes in the room guide. */
export function LandingPage() {
	return (
		<div className="valence">
			<header>
				<a href="#top">
					valence<span> audio</span>
				</a>
				<nav aria-label="Catalog">
					<a href="#range">Equipment</a>
					<a href="#guide">Room guide</a>
					<a href="mailto:listening@example.com">Contact</a>
				</nav>
			</header>
			<main id="top">
				<section className="valence-hero">
					<div>
						<p>Series One · Home listening</p>
						<h1>
							Turn up
							<br />
							the detail.
						</h1>
						<p>
							A compact stereo system with real controls and room for your
							favorite records.
						</p>
						<a href="#range">Explore the system →</a>
					</div>
					<figure>
						<img
							src="/images/hero.webp"
							alt="A silver amplifier and speakers with orange fabric grilles"
							fetchPriority="high"
						/>
						<figcaption>Series One · Stereo set</figcaption>
					</figure>
				</section>
				<section id="range" className="valence-range">
					<h2>Build your set.</h2>
					<div>
						<article>
							<h3>01 / Field speakers</h3>
							<p>A pair of compact passive speakers for a shelf or stand.</p>
							<a href="#pairing">See pairing notes ↘</a>
						</article>
						<article>
							<h3>02 / Dial amplifier</h3>
							<p>A two-channel unit with an input for a turntable.</p>
							<a href="#pairing">See pairing notes ↘</a>
						</article>
					</div>
				</section>
				<section id="guide" className="valence-guide">
					<h2>Start with your room.</h2>
					<div id="pairing">
						<h3>Give each speaker space.</h3>
						<p>
							Place the speakers an equal distance from your seat. Leave a gap
							behind them and try small changes as you listen.
						</p>
						<a href="mailto:listening@example.com?subject=Listening%20session">
							Ask about a listening session ↗
						</a>
					</div>
				</section>
			</main>
		</div>
	);
}
