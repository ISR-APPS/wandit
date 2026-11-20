/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */

import "../landing.css";

/** Each program includes a subject and instructions for checking the date before a visit. */
export function LandingPage() {
	return (
		<div className="eris">
			<header>
				<a href="#top">
					<span aria-hidden="true">✦</span> Eris Observatory
				</a>
				<nav aria-label="Observatory">
					<a href="#programs">Programs</a>
					<a href="#prepare">Prepare</a>
				</nav>
			</header>
			<main id="top">
				<section className="eris-hero">
					<div>
						<p>Public programs</p>
						<h1>
							Look
							<br />
							after dark.
						</h1>
						<p>
							Join an evening at the telescope. Learn to find the Moon, the
							planets, and objects you can see from home.
						</p>
						<a href="#programs">Find an observing program ↓</a>
					</div>
					<figure>
						<img
							src="/images/hero.webp"
							alt="A small observatory dome below a crescent moon at dusk"
							fetchPriority="high"
						/>
						<figcaption>Observatory dome at twilight</figcaption>
					</figure>
				</section>
				<section id="programs" className="eris-programs">
					<h2>Observing programs</h2>
					<table>
						<thead>
							<tr>
								<th scope="col">Program</th>
								<th scope="col">What you can see</th>
								<th scope="col">Good for</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th scope="row">First light</th>
								<td>The Moon and its craters</td>
								<td>First-time visitors</td>
							</tr>
							<tr>
								<th scope="row">Planet watch</th>
								<td>Visible planets for the season</td>
								<td>Families and small groups</td>
							</tr>
							<tr>
								<th scope="row">Deep sky</th>
								<td>Star clusters on clear nights</td>
								<td>Visitors with some experience</td>
							</tr>
						</tbody>
					</table>
				</section>
				<section id="prepare" className="eris-prepare">
					<h2>Before it gets dark.</h2>
					<ul>
						<li>Ask the observatory to confirm the date and weather policy.</li>
						<li>Bring a warm layer for time outdoors.</li>
						<li>Use a dim red light near the telescope.</li>
					</ul>
					<a href="mailto:observe@example.com">Ask about the next session ↗</a>
				</section>
			</main>
		</div>
	);
}
