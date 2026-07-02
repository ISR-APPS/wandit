// Mock AI-generated landing pages: "Desert Ember AJ-1" — English streetwear sneaker drop (Algiers),
// two iterations of the same identity: base drop page, then + countdown / stock meter / gallery.

import type { MockPage } from "./shared";

export const SNEAKERS_PAGES: Record<string, MockPage> = {
	"sneakers-1": {
		title: "Desert Ember AJ-1 — Drop 001",
		lang: "en",
		html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Desert Ember AJ-1 — Drop 001</title>
<style>
:root{
	--bg:#0a0908;
	--panel:#141210;
	--line:#2a241f;
	--ink:#f5efe8;
	--muted:#a2988c;
	--ember:#ff5a1f;
	--ember-hot:#ff7a3d;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);color:var(--ink);line-height:1.55;padding-bottom:86px;
}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
h1,h2,h3{text-transform:uppercase;letter-spacing:-.02em;line-height:1.02;font-weight:800}
.eyebrow{
	display:inline-block;font-size:12px;font-weight:800;letter-spacing:.3em;
	text-transform:uppercase;color:var(--ember);margin-bottom:16px;
}
section{padding:64px 0}
.btn{
	display:inline-block;background:var(--ember);color:#0a0908;text-decoration:none;
	font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:15px;
	padding:16px 34px;border:none;border-radius:8px;cursor:pointer;
	box-shadow:0 10px 30px -8px rgba(255,90,31,.55);
	transition:transform .12s ease,background .12s ease;
}
.btn:hover{transform:translateY(-2px);background:var(--ember-hot)}
/* Header */
header{border-bottom:1px solid var(--line);padding:18px 0}
header .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;text-transform:uppercase;letter-spacing:.14em;font-size:15px}
.brand em{color:var(--ember);font-style:normal}
.drop-tag{
	font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;
	border:1px solid var(--ember);color:var(--ember);padding:6px 12px;border-radius:4px;
}
/* Hero */
.hero{padding:56px 0;background:
	radial-gradient(60% 50% at 80% 0%,rgba(255,90,31,.16) 0%,transparent 70%),
	var(--bg);}
.hero .wrap{display:grid;gap:36px;align-items:center}
.hero h1{font-size:clamp(52px,12vw,110px);margin-bottom:18px}
.hero h1 span{color:var(--ember)}
.hero .sub{color:var(--muted);font-size:17px;max-width:44ch;margin-bottom:28px}
.hero .sub b{color:var(--ink)}
.shoe-stage{
	position:relative;border-radius:18px;overflow:hidden;
	background:linear-gradient(150deg,#1f150d 0%,#3a1c0a 45%,#7a2f08 100%);
	border:1px solid var(--line);min-height:280px;
	display:flex;align-items:center;justify-content:center;
}
.shoe-stage .shoe{font-size:150px;filter:drop-shadow(0 24px 24px rgba(0,0,0,.55));transform:rotate(-14deg)}
.shoe-stage .tag{
	position:absolute;top:16px;left:16px;font-size:11px;font-weight:800;
	letter-spacing:.22em;text-transform:uppercase;color:var(--ink);
	background:rgba(10,9,8,.65);padding:6px 12px;border-radius:4px;border:1px solid var(--line);
}
.trust{
	display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:30px;
	padding:14px 18px;border:1px solid var(--line);border-radius:12px;
	background:var(--panel);font-size:13px;color:var(--muted);
}
.trust b{color:var(--ink);font-weight:600}
/* Story */
.story{border-top:1px solid var(--line)}
.story .wrap{display:grid;gap:28px}
.story h2{font-size:34px;margin-bottom:14px}
.story h2 span{color:var(--ember)}
.story p{color:var(--muted);font-size:16px;margin-bottom:14px}
.story p b{color:var(--ink)}
.spec-list{list-style:none;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.spec-list li{
	display:flex;justify-content:space-between;gap:16px;padding:14px 18px;
	font-size:14px;border-bottom:1px solid var(--line);background:var(--panel);
}
.spec-list li:last-child{border-bottom:none}
.spec-list .k{color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}
/* Offer + form */
.offer{border-top:1px solid var(--line);background:
	radial-gradient(50% 40% at 50% 0%,rgba(255,90,31,.12) 0%,transparent 70%),var(--bg);}
.offer-grid{display:grid;gap:28px;max-width:640px;margin:0 auto}
.price-card{
	background:var(--panel);border:1px solid var(--line);border-radius:16px;
	padding:30px 26px;text-align:center;
}
.price-card h2{font-size:26px;margin-bottom:16px}
.price-row{display:flex;justify-content:center;align-items:baseline;gap:14px;margin-bottom:10px}
.price{font-size:46px;font-weight:800;letter-spacing:-.02em;color:var(--ember)}
.compare{font-size:18px;color:var(--muted);text-decoration:line-through}
.save-chip{
	display:inline-block;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
	color:var(--ember);border:1px solid var(--ember);padding:6px 14px;border-radius:999px;
}
form{
	background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px 24px;
}
form h3{font-size:20px;margin-bottom:4px}
form .sub{font-size:13px;color:var(--muted);margin-bottom:22px}
.field{margin-bottom:16px}
.field label,.group-label{
	display:block;font-size:11px;font-weight:800;letter-spacing:.16em;
	text-transform:uppercase;color:var(--muted);margin-bottom:8px;
}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:10px;
	border:1px solid var(--line);background:#0e0c0a;color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--ember);border-color:var(--ember)}
.pills{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
.pills input{position:absolute;opacity:0;pointer-events:none}
.pills label{
	padding:11px 18px;border:1px solid var(--line);border-radius:999px;cursor:pointer;
	font-size:14px;font-weight:700;color:var(--muted);transition:all .12s ease;
}
.pills label:hover{border-color:var(--ember);color:var(--ink)}
.pills input:checked + label{background:var(--ember);border-color:var(--ember);color:#0a0908}
form .btn{width:100%}
.form-note{font-size:12px;color:var(--muted);text-align:center;margin-top:12px}
.success{text-align:center;padding:26px 6px}
.success h3{font-size:24px;margin-bottom:8px}
.success p{color:var(--muted)}
/* Footer */
footer{border-top:1px solid var(--line);padding:34px 0 46px;text-align:center}
footer .brand{margin-bottom:8px;display:block}
footer p{font-size:13px;color:var(--muted)}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(10,9,8,.92);backdrop-filter:blur(8px);
	border-top:1px solid var(--line);
}
.sticky-cta .p{font-size:20px;font-weight:800;color:var(--ember)}
.sticky-cta .c{font-size:12px;color:var(--muted);text-decoration:line-through}
.sticky-cta .btn{padding:12px 22px;font-size:13px}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero .wrap{grid-template-columns:1.05fr .95fr}
	.story .wrap{grid-template-columns:1.1fr .9fr;align-items:start}
	section{padding:88px 0}
	.shoe-stage{min-height:380px}
	.shoe-stage .shoe{font-size:210px}
}
</style>
</head>
<body>

<header>
	<div class="wrap">
		<div class="brand">Desert <em>Ember</em></div>
		<div class="drop-tag">Drop 001</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<div>
			<span class="eyebrow">Drop 001 — Algiers</span>
			<h1>Desert <span>Ember</span> AJ-1</h1>
			<p class="sub"><b>60 pairs. One city. No restock.</b> Sand-dyed suede, ember-stitched panels and a gum sole built for Algiers concrete. When they're gone, they're gone.</p>
			<a class="btn" href="#commander">Cop the pair — Cash on delivery</a>
			<div class="trust">
				<span>🚚 <b>Delivery — 58 wilayas</b></span>
				<span>💵 <b>Cash on delivery</b></span>
				<span>↩️ <b>Easy returns</b></span>
			</div>
		</div>
		<div class="shoe-stage">
			<span class="tag">Limited — 60 pairs</span>
			<div class="shoe">👟</div>
		</div>
	</div>
</section>

<section class="story">
	<div class="wrap">
		<div>
			<span class="eyebrow">The story</span>
			<h2>Born in the <span>dust</span>, laced in the city</h2>
			<p>The Desert Ember AJ-1 was sketched between Bab El Oued rooftops and the dunes south of Biskra. Every panel carries the palette of an Algerian sunset — burnt sand, ash black, one strike of ember.</p>
			<p><b>Numbered tongue tags from 001 to 060.</b> Each pair ships with a drop certificate and spare ember laces. This is not a shelf shoe — it's a statement you walk in.</p>
			<p>Made for the streets that raised us. Sizes run true — if you're between sizes, go up.</p>
		</div>
		<ul class="spec-list">
			<li><span class="k">Upper</span><span>Sand-dyed suede + mesh</span></li>
			<li><span class="k">Sole</span><span>Gum rubber, cupsole</span></li>
			<li><span class="k">Stitching</span><span>Ember contrast, double-locked</span></li>
			<li><span class="k">Extras</span><span>Numbered tag + spare laces</span></li>
			<li><span class="k">Run</span><span>60 pairs — no restock</span></li>
		</ul>
	</div>
</section>

<section class="offer">
	<div class="wrap">
		<div class="offer-grid">
			<div class="price-card">
				<span class="eyebrow">Drop price</span>
				<h2>Desert Ember AJ-1</h2>
				<div class="price-row">
					<span class="price">18 500 DA</span>
					<span class="compare">24 000 DA</span>
				</div>
				<span class="save-chip">Save 5 500 DA</span>
			</div>
			<form id="commander">
				<h3>Lock your pair</h3>
				<p class="sub">Pay cash when it lands at your door. We call to confirm every order.</p>
				<span class="group-label">Select your size (EU)</span>
				<div class="pills">
					<input type="radio" id="size-40" name="size" value="EU 40">
					<label for="size-40">EU 40</label>
					<input type="radio" id="size-41" name="size" value="EU 41">
					<label for="size-41">EU 41</label>
					<input type="radio" id="size-42" name="size" value="EU 42" checked>
					<label for="size-42">EU 42</label>
					<input type="radio" id="size-43" name="size" value="EU 43">
					<label for="size-43">EU 43</label>
					<input type="radio" id="size-44" name="size" value="EU 44">
					<label for="size-44">EU 44</label>
					<input type="radio" id="size-45" name="size" value="EU 45">
					<label for="size-45">EU 45</label>
				</div>
				<div class="field">
					<label for="f-name">Full name</label>
					<input type="text" id="f-name" name="fullname" placeholder="Your full name" required>
				</div>
				<div class="field">
					<label for="f-phone">Phone</label>
					<input type="tel" id="f-phone" name="phone" placeholder="05 XX XX XX XX" required>
				</div>
				<div class="field">
					<label for="f-wilaya">Wilaya</label>
					<select id="f-wilaya" name="wilaya" required>
						<option value="" disabled selected>Select your wilaya</option>
						<option value="16">16 — Alger</option>
						<option value="31">31 — Oran</option>
						<option value="25">25 — Constantine</option>
						<option value="19">19 — Sétif</option>
						<option value="05">05 — Batna</option>
						<option value="09">09 — Blida</option>
						<option value="23">23 — Annaba</option>
						<option value="13">13 — Tlemcen</option>
						<option value="15">15 — Tizi Ouzou</option>
						<option value="06">06 — Béjaïa</option>
						<option value="07">07 — Biskra</option>
						<option value="17">17 — Djelfa</option>
						<option value="27">27 — Mostaganem</option>
						<option value="48">48 — Relizane</option>
						<option value="30">30 — Ouargla</option>
						<option value="10">10 — Bouira</option>
					</select>
				</div>
				<div class="field">
					<label for="f-commune">Commune</label>
					<input type="text" id="f-commune" name="commune" placeholder="Your commune" required>
				</div>
				<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<button class="btn" type="submit">Order now — Cash on delivery</button>
				<p class="form-note">No prepayment. No card. You pay the courier when the box is in your hands.</p>
			</form>
		</div>
	</div>
</section>

<footer>
	<div class="wrap">
		<span class="brand">Desert <em>Ember</em></span>
		<p>Drop 001 — Algiers · Delivery across 58 wilayas · @desertember.dz</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">18 500 DA</div>
		<div class="c">24 000 DA</div>
	</div>
	<a class="btn" href="#commander">Cop now</a>
</div>

<script>
(function(){
	var form = document.getElementById("commander");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = "<div class='success'><h3>Order received ✅</h3><p>We'll call you to confirm.</p></div>";
	});
})();
</script>

</body>
</html>`,
	},
	"sneakers-2": {
		title: "Desert Ember AJ-1 — Drop 001 (final hours)",
		lang: "en",
		html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Desert Ember AJ-1 — Drop 001 · Final hours</title>
<style>
:root{
	--bg:#0a0908;
	--panel:#141210;
	--line:#2a241f;
	--ink:#f5efe8;
	--muted:#a2988c;
	--ember:#ff5a1f;
	--ember-hot:#ff7a3d;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
	font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
	background:var(--bg);color:var(--ink);line-height:1.55;padding-bottom:86px;
}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
h1,h2,h3{text-transform:uppercase;letter-spacing:-.02em;line-height:1.02;font-weight:800}
.eyebrow{
	display:inline-block;font-size:12px;font-weight:800;letter-spacing:.3em;
	text-transform:uppercase;color:var(--ember);margin-bottom:16px;
}
section{padding:64px 0}
.btn{
	display:inline-block;background:var(--ember);color:#0a0908;text-decoration:none;
	font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:15px;
	padding:16px 34px;border:none;border-radius:8px;cursor:pointer;
	box-shadow:0 10px 30px -8px rgba(255,90,31,.55);
	transition:transform .12s ease,background .12s ease;
}
.btn:hover{transform:translateY(-2px);background:var(--ember-hot)}
/* Countdown banner */
.count-bar{
	background:var(--ember);color:#0a0908;text-align:center;
	padding:10px 16px;font-size:13px;font-weight:800;
	text-transform:uppercase;letter-spacing:.12em;
}
.count-bar b{font-variant-numeric:tabular-nums;font-size:15px}
/* Header */
header{border-bottom:1px solid var(--line);padding:18px 0}
header .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;text-transform:uppercase;letter-spacing:.14em;font-size:15px}
.brand em{color:var(--ember);font-style:normal}
.drop-tag{
	font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;
	border:1px solid var(--ember);color:var(--ember);padding:6px 12px;border-radius:4px;
}
/* Hero */
.hero{padding:56px 0;background:
	radial-gradient(60% 50% at 80% 0%,rgba(255,90,31,.16) 0%,transparent 70%),
	var(--bg);}
.hero .wrap{display:grid;gap:36px;align-items:center}
.hero h1{font-size:clamp(52px,12vw,110px);margin-bottom:18px}
.hero h1 span{color:var(--ember)}
.hero .sub{color:var(--muted);font-size:17px;max-width:44ch;margin-bottom:28px}
.hero .sub b{color:var(--ink)}
.shoe-stage{
	position:relative;border-radius:18px;overflow:hidden;
	background:linear-gradient(150deg,#1f150d 0%,#3a1c0a 45%,#7a2f08 100%);
	border:1px solid var(--line);min-height:280px;
	display:flex;align-items:center;justify-content:center;
}
.shoe-stage .shoe{font-size:150px;filter:drop-shadow(0 24px 24px rgba(0,0,0,.55));transform:rotate(-14deg)}
.shoe-stage .tag{
	position:absolute;top:16px;left:16px;font-size:11px;font-weight:800;
	letter-spacing:.22em;text-transform:uppercase;color:var(--ink);
	background:rgba(10,9,8,.65);padding:6px 12px;border-radius:4px;border:1px solid var(--line);
}
.trust{
	display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:30px;
	padding:14px 18px;border:1px solid var(--line);border-radius:12px;
	background:var(--panel);font-size:13px;color:var(--muted);
}
.trust b{color:var(--ink);font-weight:600}
/* Stock meter */
.stock{
	margin-top:22px;background:var(--panel);border:1px solid var(--line);
	border-radius:12px;padding:16px 18px;
}
.stock .row{display:flex;justify-content:space-between;font-size:12px;font-weight:800;
	text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px}
.stock .row span:last-child{color:var(--ember)}
.meter{height:10px;border-radius:999px;background:#241e18;overflow:hidden}
.meter i{
	display:block;height:100%;width:28%;border-radius:999px;
	background:linear-gradient(90deg,var(--ember-hot),var(--ember));
}
/* Gallery */
.gallery{border-top:1px solid var(--line)}
.gallery h2{font-size:34px;text-align:center;margin-bottom:8px}
.gallery .lead{text-align:center;color:var(--muted);margin-bottom:36px}
.g-grid{display:grid;gap:18px}
.g-card{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--panel)}
.g-visual{
	height:190px;display:flex;align-items:center;justify-content:center;font-size:96px;
}
.g-visual .e{filter:drop-shadow(0 16px 16px rgba(0,0,0,.5));transform:rotate(-12deg)}
.g-1{background:linear-gradient(150deg,#2a160a 0%,#8a3608 60%,#ff5a1f 130%)}
.g-2{background:linear-gradient(150deg,#0d1024 0%,#232a63 60%,#4551c4 130%)}
.g-3{background:linear-gradient(150deg,#241d0d 0%,#6b5518 60%,#d3a437 130%)}
.g-meta{padding:16px 18px;display:flex;justify-content:space-between;align-items:center}
.g-meta h3{font-size:15px}
.g-meta span{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.g-meta .soon{color:var(--ember)}
/* Story */
.story{border-top:1px solid var(--line)}
.story .wrap{display:grid;gap:28px}
.story h2{font-size:34px;margin-bottom:14px}
.story h2 span{color:var(--ember)}
.story p{color:var(--muted);font-size:16px;margin-bottom:14px}
.story p b{color:var(--ink)}
.spec-list{list-style:none;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.spec-list li{
	display:flex;justify-content:space-between;gap:16px;padding:14px 18px;
	font-size:14px;border-bottom:1px solid var(--line);background:var(--panel);
}
.spec-list li:last-child{border-bottom:none}
.spec-list .k{color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}
/* Offer + form */
.offer{border-top:1px solid var(--line);background:
	radial-gradient(50% 40% at 50% 0%,rgba(255,90,31,.12) 0%,transparent 70%),var(--bg);}
.offer-grid{display:grid;gap:28px;max-width:640px;margin:0 auto}
.price-card{
	background:var(--panel);border:1px solid var(--line);border-radius:16px;
	padding:30px 26px;text-align:center;
}
.price-card h2{font-size:26px;margin-bottom:16px}
.price-row{display:flex;justify-content:center;align-items:baseline;gap:14px;margin-bottom:10px}
.price{font-size:46px;font-weight:800;letter-spacing:-.02em;color:var(--ember)}
.compare{font-size:18px;color:var(--muted);text-decoration:line-through}
.save-chip{
	display:inline-block;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
	color:var(--ember);border:1px solid var(--ember);padding:6px 14px;border-radius:999px;
}
form{
	background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px 24px;
}
form h3{font-size:20px;margin-bottom:4px}
form .sub{font-size:13px;color:var(--muted);margin-bottom:22px}
.field{margin-bottom:16px}
.field label,.group-label{
	display:block;font-size:11px;font-weight:800;letter-spacing:.16em;
	text-transform:uppercase;color:var(--muted);margin-bottom:8px;
}
.field input,.field select{
	width:100%;padding:14px 16px;font-size:15px;border-radius:10px;
	border:1px solid var(--line);background:#0e0c0a;color:var(--ink);font-family:inherit;
}
.field input:focus,.field select:focus{outline:2px solid var(--ember);border-color:var(--ember)}
.pills{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
.pills input{position:absolute;opacity:0;pointer-events:none}
.pills label{
	padding:11px 18px;border:1px solid var(--line);border-radius:999px;cursor:pointer;
	font-size:14px;font-weight:700;color:var(--muted);transition:all .12s ease;
}
.pills label:hover{border-color:var(--ember);color:var(--ink)}
.pills input:checked + label{background:var(--ember);border-color:var(--ember);color:#0a0908}
form .btn{width:100%}
.form-note{font-size:12px;color:var(--muted);text-align:center;margin-top:12px}
.success{text-align:center;padding:26px 6px}
.success h3{font-size:24px;margin-bottom:8px}
.success p{color:var(--muted)}
/* Footer */
footer{border-top:1px solid var(--line);padding:34px 0 46px;text-align:center}
footer .brand{margin-bottom:8px;display:block}
footer p{font-size:13px;color:var(--muted)}
/* Sticky CTA */
.sticky-cta{
	position:fixed;left:0;right:0;bottom:0;z-index:60;
	display:flex;align-items:center;justify-content:space-between;gap:14px;
	padding:12px 18px;background:rgba(10,9,8,.92);backdrop-filter:blur(8px);
	border-top:1px solid var(--line);
}
.sticky-cta .p{font-size:20px;font-weight:800;color:var(--ember)}
.sticky-cta .c{font-size:12px;color:var(--muted);text-decoration:line-through}
.sticky-cta .btn{padding:12px 22px;font-size:13px}
@media(min-width:768px){
	body{padding-bottom:0}
	.sticky-cta{display:none}
	.hero .wrap{grid-template-columns:1.05fr .95fr}
	.story .wrap{grid-template-columns:1.1fr .9fr;align-items:start}
	.g-grid{grid-template-columns:repeat(3,1fr)}
	section{padding:88px 0}
	.shoe-stage{min-height:380px}
	.shoe-stage .shoe{font-size:210px}
}
</style>
</head>
<body>

<div class="count-bar">Drop ends in <b id="countdown">--:--:--</b> — last pairs</div>

<header>
	<div class="wrap">
		<div class="brand">Desert <em>Ember</em></div>
		<div class="drop-tag">Drop 001 · Final hours</div>
	</div>
</header>

<section class="hero">
	<div class="wrap">
		<div>
			<span class="eyebrow">Drop 001 — Algiers</span>
			<h1>Desert <span>Ember</span> AJ-1</h1>
			<p class="sub"><b>60 pairs. One city. No restock.</b> Sand-dyed suede, ember-stitched panels and a gum sole built for Algiers concrete. The drop closes at midnight — after that, resale is your only door.</p>
			<a class="btn" href="#commander">Cop the pair — Cash on delivery</a>
			<div class="stock">
				<div class="row"><span>Stock left</span><span>17 / 60 pairs</span></div>
				<div class="meter"><i></i></div>
			</div>
			<div class="trust">
				<span>🚚 <b>Delivery — 58 wilayas</b></span>
				<span>💵 <b>Cash on delivery</b></span>
				<span>↩️ <b>Easy returns</b></span>
			</div>
		</div>
		<div class="shoe-stage">
			<span class="tag">17 pairs left</span>
			<div class="shoe">👟</div>
		</div>
	</div>
</section>

<section class="gallery">
	<div class="wrap">
		<span class="eyebrow" style="display:block;text-align:center">Colorways</span>
		<h2>One silhouette, three moods</h2>
		<p class="lead">Drop 001 ships in Ember Dust. Two colorways follow — if this drop sells through.</p>
		<div class="g-grid">
			<div class="g-card">
				<div class="g-visual g-1"><span class="e">👟</span></div>
				<div class="g-meta">
					<h3>Ember Dust</h3>
					<span class="soon">This drop</span>
				</div>
			</div>
			<div class="g-card">
				<div class="g-visual g-2"><span class="e">👟</span></div>
				<div class="g-meta">
					<h3>Midnight Oasis</h3>
					<span>Drop 002</span>
				</div>
			</div>
			<div class="g-card">
				<div class="g-visual g-3"><span class="e">👟</span></div>
				<div class="g-meta">
					<h3>Sahara Fade</h3>
					<span>Drop 003</span>
				</div>
			</div>
		</div>
	</div>
</section>

<section class="story">
	<div class="wrap">
		<div>
			<span class="eyebrow">The story</span>
			<h2>Born in the <span>dust</span>, laced in the city</h2>
			<p>The Desert Ember AJ-1 was sketched between Bab El Oued rooftops and the dunes south of Biskra. Every panel carries the palette of an Algerian sunset — burnt sand, ash black, one strike of ember.</p>
			<p><b>Numbered tongue tags from 001 to 060.</b> Each pair ships with a drop certificate and spare ember laces. This is not a shelf shoe — it's a statement you walk in.</p>
			<p>Made for the streets that raised us. Sizes run true — if you're between sizes, go up.</p>
		</div>
		<ul class="spec-list">
			<li><span class="k">Upper</span><span>Sand-dyed suede + mesh</span></li>
			<li><span class="k">Sole</span><span>Gum rubber, cupsole</span></li>
			<li><span class="k">Stitching</span><span>Ember contrast, double-locked</span></li>
			<li><span class="k">Extras</span><span>Numbered tag + spare laces</span></li>
			<li><span class="k">Run</span><span>60 pairs — 17 left</span></li>
		</ul>
	</div>
</section>

<section class="offer">
	<div class="wrap">
		<div class="offer-grid">
			<div class="price-card">
				<span class="eyebrow">Drop price</span>
				<h2>Desert Ember AJ-1</h2>
				<div class="price-row">
					<span class="price">18 500 DA</span>
					<span class="compare">24 000 DA</span>
				</div>
				<span class="save-chip">Save 5 500 DA — until midnight</span>
			</div>
			<form id="commander">
				<h3>Lock your pair</h3>
				<p class="sub">Pay cash when it lands at your door. We call to confirm every order.</p>
				<span class="group-label">Select your size (EU)</span>
				<div class="pills">
					<input type="radio" id="size-40" name="size" value="EU 40">
					<label for="size-40">EU 40</label>
					<input type="radio" id="size-41" name="size" value="EU 41">
					<label for="size-41">EU 41</label>
					<input type="radio" id="size-42" name="size" value="EU 42" checked>
					<label for="size-42">EU 42</label>
					<input type="radio" id="size-43" name="size" value="EU 43">
					<label for="size-43">EU 43</label>
					<input type="radio" id="size-44" name="size" value="EU 44">
					<label for="size-44">EU 44</label>
					<input type="radio" id="size-45" name="size" value="EU 45">
					<label for="size-45">EU 45</label>
				</div>
				<div class="field">
					<label for="f-name">Full name</label>
					<input type="text" id="f-name" name="fullname" placeholder="Your full name" required>
				</div>
				<div class="field">
					<label for="f-phone">Phone</label>
					<input type="tel" id="f-phone" name="phone" placeholder="05 XX XX XX XX" required>
				</div>
				<div class="field">
					<label for="f-wilaya">Wilaya</label>
					<select id="f-wilaya" name="wilaya" required>
						<option value="" disabled selected>Select your wilaya</option>
						<option value="16">16 — Alger</option>
						<option value="31">31 — Oran</option>
						<option value="25">25 — Constantine</option>
						<option value="19">19 — Sétif</option>
						<option value="05">05 — Batna</option>
						<option value="09">09 — Blida</option>
						<option value="23">23 — Annaba</option>
						<option value="13">13 — Tlemcen</option>
						<option value="15">15 — Tizi Ouzou</option>
						<option value="06">06 — Béjaïa</option>
						<option value="07">07 — Biskra</option>
						<option value="17">17 — Djelfa</option>
						<option value="27">27 — Mostaganem</option>
						<option value="48">48 — Relizane</option>
						<option value="30">30 — Ouargla</option>
						<option value="10">10 — Bouira</option>
					</select>
				</div>
				<div class="field">
					<label for="f-commune">Commune</label>
					<input type="text" id="f-commune" name="commune" placeholder="Your commune" required>
				</div>
				<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
				<button class="btn" type="submit">Order now — Cash on delivery</button>
				<p class="form-note">No prepayment. No card. You pay the courier when the box is in your hands.</p>
			</form>
		</div>
	</div>
</section>

<footer>
	<div class="wrap">
		<span class="brand">Desert <em>Ember</em></span>
		<p>Drop 001 — Algiers · Delivery across 58 wilayas · @desertember.dz</p>
	</div>
</footer>

<div class="sticky-cta">
	<div>
		<div class="p">18 500 DA</div>
		<div class="c">24 000 DA</div>
	</div>
	<a class="btn" href="#commander">Cop now</a>
</div>

<script>
(function(){
	var el = document.getElementById("countdown");
	function pad(n){ return (n < 10 ? "0" : "") + n; }
	function tick(){
		var now = new Date();
		var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
		var diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
		var h = Math.floor(diff / 3600);
		var m = Math.floor((diff % 3600) / 60);
		var s = diff % 60;
		if(el){ el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s); }
	}
	tick();
	setInterval(tick, 1000);

	var form = document.getElementById("commander");
	if(!form){ return; }
	form.addEventListener("submit", function(e){
		e.preventDefault();
		var hp = form.querySelector('input[name="website"]');
		if(hp && hp.value){ return; }
		form.innerHTML = "<div class='success'><h3>Order received ✅</h3><p>We'll call you to confirm.</p></div>";
	});
})();
</script>

</body>
</html>`,
	},
};
