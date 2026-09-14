/**
 * Mock HTML of the generated Nadi Fitness app for the preview iframes.
 * These stand in for the sandbox preview URL until the backend lands.
 * Read by components/preview/web-preview.tsx and phone-preview.tsx as `srcDoc`.
 * Each document is self-contained: no script, no font, no external resource.
 * App content stays in English on purpose (docs/localization.md).
 */

/** The front-desk dashboard of the web app, at `/admin`. Monospace type, ember accents. */
export const MOCK_WEB_PREVIEW_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NADI · Front desk</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { display: flex; background: #121010; color: #f2ebe4; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  aside { display: flex; flex-direction: column; width: 194px; flex-shrink: 0; padding: 22px 16px; border-right: 1px solid #262120; }
  .wordmark { margin-bottom: 20px; padding: 0 8px; font-size: 13px; font-weight: 700; letter-spacing: .22em; }
  nav a { display: block; padding: 8px 10px; margin-bottom: 4px; border: 1px solid transparent; border-radius: 6px; color: #9a8f88; text-decoration: none; }
  nav a.active { border-color: rgba(255, 138, 61, .4); background: rgba(255, 138, 61, .12); color: #ffb27a; }
  .foot { margin-top: auto; padding: 0 8px; color: #6a615c; font-size: 11px; }
  main { flex: 1; min-width: 0; padding: 28px 30px; overflow: auto; }
  .micro { color: #8a7f78; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; }
  header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; }
  h1 { margin-top: 6px; font-size: 26px; font-weight: 500; letter-spacing: -.01em; }
  .btn { padding: 8px 14px; border: 0; border-radius: 6px; background: linear-gradient(135deg, #ff9a3c, #f7772f); color: #2a1206; font: inherit; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
  .card { padding: 18px; border: 1px solid #2a2523; border-radius: 10px; background: #171412; }
  .value { margin: 8px 0 4px; font-size: 26px; font-weight: 600; letter-spacing: -.02em; }
  .sub { color: #8a7f78; font-size: 11px; }
  .ember { color: #ffb27a; }
  table { width: 100%; margin-top: 8px; border: 1px solid #2a2523; border-radius: 8px; border-spacing: 0; overflow: hidden; }
  td { padding: 11px 14px; border-top: 1px solid #2a2523; }
  tr:first-child td { border-top: 0; }
  .muted { color: #9a8f88; }
  .paid { color: #6fd39a; }
  .pending { color: #f5a623; }
  /* Phone width: the sidebar becomes a top bar and the cards stack. */
  @media (max-width: 640px) {
    body { flex-direction: column; }
    aside { flex-direction: row; align-items: center; gap: 10px; width: auto; padding: 12px 14px; border-right: 0; border-bottom: 1px solid #262120; }
    .wordmark { margin: 0; padding: 0; }
    nav { display: flex; gap: 4px; overflow-x: auto; }
    nav a { margin: 0; padding: 6px 8px; white-space: nowrap; }
    .foot { display: none; }
    main { padding: 18px 16px; }
    header { flex-direction: column; align-items: flex-start; gap: 12px; }
    .stats { grid-template-columns: 1fr; }
    td { padding: 9px 10px; }
    td:nth-child(2) { display: none; }
  }
</style>
</head>
<body>
  <aside>
    <div class="wordmark">NADI</div>
    <nav>
      <a class="active" href="#">Overview</a>
      <a href="#">Members</a>
      <a href="#">Payments</a>
      <a href="#">Classes</a>
      <a href="#">Door check-in</a>
    </nav>
    <div class="foot">Front desk · Oran</div>
  </aside>
  <main>
    <header>
      <div>
        <div class="micro">Wednesday · 3 Sep</div>
        <h1>Good evening, Yacine</h1>
      </div>
      <button class="btn" type="button">+ New member</button>
    </header>
    <section class="stats">
      <div class="card"><div class="micro">Active members</div><div class="value">312</div><div class="sub ember">+18 this month</div></div>
      <div class="card"><div class="micro">Revenue · Sept</div><div class="value">780 000 DA</div><div class="sub">CIB 61% · Edahabia 39%</div></div>
      <div class="card"><div class="micro">Check-ins today</div><div class="value">84</div><div class="sub">Peak 18:00–20:00</div></div>
    </section>
    <div class="micro">Recent payments</div>
    <table>
      <tr><td>Amina Belkacem</td><td class="muted">Monthly</td><td>2 500 DA</td><td class="paid">Paid · CIB</td></tr>
      <tr><td>Karim Haddad</td><td class="muted">Quarterly</td><td>6 500 DA</td><td class="paid">Paid · Edahabia</td></tr>
      <tr><td>Sara Meziane</td><td class="muted">Monthly</td><td>2 500 DA</td><td class="pending">Pending</td></tr>
      <tr><td>Yacine Boudiaf</td><td class="muted">Day pass</td><td>500 DA</td><td class="paid">Paid · CIB</td></tr>
    </table>
  </main>
</body>
</html>`;

/** The member home screen of the mobile app, drawn for the 286 px wide phone screen. */
export const MOCK_MOBILE_PREVIEW_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NADI · Home</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { display: flex; flex-direction: column; background: #121010; color: #f2ebe4; font: 12px/1.4 system-ui, -apple-system, sans-serif; }
  .screen { flex: 1; min-height: 0; overflow: auto; padding: 4px 16px 16px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .micro { margin: 14px 0 6px; color: #8a7f78; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; }
  .hello { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .hello small { color: #9a8f88; font-size: 12px; }
  .hello strong { display: block; font-size: 20px; font-weight: 600; }
  .avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #2a2523; font-weight: 600; }
  .pass { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 14px 16px; border-radius: 14px; background: linear-gradient(135deg, #ff9a3c, #f96a1e); color: #2a1206; }
  .pass .micro { margin: 0 0 8px; color: #5a2a0c; }
  .pass b { display: block; font-size: 15px; font-weight: 600; }
  .pass span { font-size: 11px; }
  .pass .row { grid-column: 1 / -1; display: flex; justify-content: space-between; margin-top: 12px; font-size: 9px; font-weight: 600; letter-spacing: .14em; }
  .qr { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; width: 56px; height: 56px; padding: 5px; border-radius: 6px; background: #fff; }
  .qr b { background: #111; border-radius: 1px; }
  .card { padding: 12px 14px; border: 1px solid #2a2523; border-radius: 12px; background: #171412; }
  .class { display: flex; align-items: center; gap: 12px; }
  .time { padding-right: 12px; border-right: 1px solid #2a2523; text-align: center; }
  .time b { display: block; font-size: 18px; font-weight: 600; }
  .time small { color: #8a7f78; font-size: 9px; }
  .class .info { flex: 1; }
  .class .info b { display: block; font-size: 13px; font-weight: 600; }
  .class .info span { color: #9a8f88; font-size: 11px; }
  .pill { padding: 6px 12px; border: 1px solid rgba(255, 138, 61, .5); border-radius: 999px; background: transparent; color: #ffb27a; font: inherit; font-weight: 600; }
  .renew { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .bar { height: 4px; border-radius: 2px; background: #2a2523; }
  .bar i { display: block; width: 72%; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #ff9a3c, #f96a1e); }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
  .cta { flex: 1; padding: 9px 0; border: 0; border-radius: 8px; background: linear-gradient(135deg, #ff9a3c, #f7772f); color: #2a1206; font: inherit; font-weight: 600; }
  .outline { padding: 9px 12px; border: 1px solid #2a2523; border-radius: 8px; background: transparent; color: #9a8f88; font: inherit; font-size: 10px; }
  .tabs { display: flex; flex-shrink: 0; justify-content: space-around; padding: 10px 8px 6px; border-top: 1px solid #262120; }
  .tab { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #8a7f78; font-size: 10px; }
  .tab.active { color: #ffb27a; }
  .tab svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
</style>
</head>
<body>
  <div class="screen">
    <div class="hello"><div><small>Good evening</small><strong>Amina</strong></div><div class="avatar">A</div></div>
    <div class="pass">
      <div><div class="micro">NADI · Monthly pass</div><b>Amina Belkacem</b><span>Active until 12 Oct</span></div>
      <div class="qr">
        <b></b><b></b><b></b><i></i><b></b><i></i><b></b>
        <b></b><i></i><b></b><i></i><i></i><b></b><b></b>
        <b></b><b></b><b></b><i></i><b></b><i></i><i></i>
        <i></i><i></i><i></i><b></b><i></i><b></b><i></i>
        <b></b><b></b><b></b><i></i><b></b><b></b><b></b>
        <b></b><i></i><b></b><i></i><i></i><b></b><i></i>
        <b></b><b></b><b></b><i></i><b></b><i></i><b></b>
      </div>
      <div class="row mono"><span>MEMBER 0312</span><span>SHOW AT THE DOOR</span></div>
    </div>
    <div class="micro">Tonight</div>
    <div class="card class">
      <div class="time mono"><b>19:30</b><small>60 min</small></div>
      <div class="info"><b>HIIT · Studio B</b><span>Coach Amine · 6 spots left</span></div>
      <button class="pill" type="button">Book</button>
    </div>
    <div class="micro">Membership</div>
    <div class="card">
      <div class="renew"><span>Renews in 9 days</span><b class="mono">2 500 DA</b></div>
      <div class="bar"><i></i></div>
      <div class="actions"><button class="cta" type="button">Renew now</button><button class="outline" type="button">CIB · Edahabia</button></div>
    </div>
  </div>
  <nav class="tabs">
    <a class="tab active"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>Home</a>
    <a class="tab"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Classes</a>
    <a class="tab"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>Pass</a>
    <a class="tab"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Profile</a>
  </nav>
</body>
</html>`;
