/**
 * Renders the public home page for this starter.
 * The root route calls it, and TanStack Start prerenders it.
 */

import "../landing.css";

/** The program list and visit details are public so visitors can plan a trip without an account. */
export function LandingPage() {
	return (
		<div className="orchard">
			<header>
				<a href="#top">
					Orchard
					<br />
					Public Library
				</a>
				<nav aria-label="Library">
					<a href="#programs">What’s on</a>
					<a href="#visit">Plan a visit</a>
				</nav>
			</header>
			<main id="top">
				<section className="orchard-hero">
					<div>
						<h1>
							Make room
							<br />
							for curiosity.
						</h1>
						<p>
							Borrow a book. Fix a bike. Start a conversation. Your public
							library has a place for all of it.
						</p>
						<a href="#programs">See what’s on ↘</a>
					</div>
					<img
						src="/images/hero.webp"
						alt="A brick neighborhood library beside a tree-lined path"
						fetchPriority="high"
					/>
				</section>
				<section id="programs" className="orchard-programs">
					<h2>On the calendar</h2>
					<dl>
						<div>
							<dt>Tuesdays</dt>
							<dd>
								<strong>Picture book hour</strong>
								<span> Stories and rhymes for young readers.</span>
							</dd>
						</div>
						<div>
							<dt>Thursdays</dt>
							<dd>
								<strong>Open repair bench</strong>
								<span> Bring a small item and work with a volunteer.</span>
							</dd>
						</div>
						<div>
							<dt>Saturdays</dt>
							<dd>
								<strong>The reading table</strong>
								<span> An open book club for adults.</span>
							</dd>
						</div>
					</dl>
				</section>
				<section id="visit" className="orchard-visit">
					<h2>Find your place.</h2>
					<div>
						<h3>Get a library card</h3>
						<p>
							Ask at the desk about proof of address and cards for young
							readers.
						</p>
						<h3>Plan an accessible visit</h3>
						<p>
							Ask the desk about step-free access, quiet spaces, and large-print
							books.
						</p>
						<a href="mailto:desk@example.com">Contact the library desk ↗</a>
					</div>
				</section>
			</main>
		</div>
	);
}
