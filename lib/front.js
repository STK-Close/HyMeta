// The front door: the first page a stranger sees. While the site is private it carries the
// password box. Once the site is opened (SITE_OPEN=1 in the host's settings) it carries a
// "Come in" button instead. Everything on it is HyMeta's own words and artwork.
const STYLES = [["combat", "Combat"], ["building", "Building"], ["survival", "Survival"], ["creatures", "Creatures and farming"], ["magic", "Magic"], ["exploration", "Exploration"], ["everything", "A bit of everything"]];

module.exports = (open) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>HyMeta</title><meta name="description" content="Playpacks for Hytale: about eight mods picked to work together, for every way you like to play.">
<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#0e1223">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:title" content="HyMeta"><meta property="og:description" content="Pick a playstyle. Play it tonight."><meta property="og:image" content="/og.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grandstander:wght@500;700;900&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
:root{--bg:#d9e3ef;--bg2:#fff;--bg3:#edf2f8;--line:#74869f;--soft:#c0ccdb;--fg:#121930;--muted:#3a4461;--gold:#f2b94b;--ink:#1d1503;--deep:#a8771a;--err:#a30d54;--focus:#0b5cad;--edge:#b0bfd1;
  --hazard:#ffd93b;--hazard-ink:#221a00;--display:"Grandstander","Trebuchet MS",system-ui,sans-serif;--body:"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0e1223;--bg2:#1a2143;--bg3:#252d5a;--line:#6672b8;--soft:#343d70;--fg:#eef1fb;--muted:#b9c1de;--err:#ff8cc2;--focus:#4fe3d4;--edge:#06080f;color-scheme:dark}}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--fg);font:400 1rem/1.5 var(--body)}
h1,h2,h3,p,ol{margin:0}h1,h2,h3{font-family:var(--display);line-height:1.12;text-wrap:balance}
h2{font-size:1.5rem;font-weight:700}h3{font-size:1.1rem;font-weight:700}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px;border-radius:4px}
.small{font-size:.8125rem}.muted{color:var(--muted)}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.app{max-width:1080px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:40px}
.top{display:flex;align-items:center;gap:10px;min-height:60px;font:900 1.375rem var(--display)}
.top img{width:32px;height:32px;border-radius:8px}
.hero{position:relative;border-radius:18px;overflow:hidden;border:1.5px solid var(--line);background:#1b2140;color:#fffdf2;box-shadow:0 3px 0 var(--edge)}
.hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(9,11,24,.25),rgba(9,11,24,.9) 62%)}
.hero-in{position:relative;z-index:1;padding:clamp(120px,22vw,220px) clamp(18px,4vw,40px) clamp(20px,4vw,36px);display:flex;flex-direction:column;gap:14px;max-width:640px}
.hero h1{font-size:clamp(2.1rem,7.5vw,3.6rem);font-weight:900;text-shadow:0 2px 0 rgba(9,11,24,.7)}
.hero p{font-size:1.125rem}
.enter{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
.enter .field{display:flex;flex-direction:column;gap:4px;flex:1 1 200px;max-width:280px}
label{font-weight:700}
input{font:inherit;min-height:48px;padding:8px 12px;border-radius:12px;border:1.5px solid #9aa6c8;background:#fffdf2;color:#121930;width:100%}
.btn{min-height:48px;padding:10px 22px;border:0;border-radius:12px;background:var(--gold);color:var(--ink);font:700 1.125rem var(--display);box-shadow:0 3px 0 var(--deep);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.btn-ghost{background:var(--bg2);color:var(--fg);border:1.5px solid var(--line);box-shadow:none}
.err{color:#ffb3d6;font-weight:700}
.sec{display:flex;flex-direction:column;gap:14px}
.steps{list-style:none;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));counter-reset:s}
.steps li,.box{background:var(--bg2);border:1.5px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 2px 0 var(--edge);display:flex;flex-direction:column;gap:6px}
.steps li{counter-increment:s}.steps li::before{content:counter(s);font:900 1.6rem/1 var(--display);color:var(--deep)}
@media (prefers-color-scheme:dark){.steps li::before{color:var(--gold)}}
.styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.style{position:relative;min-height:92px;border-radius:12px;overflow:hidden;border:1.5px solid var(--line);background:#1b2140;color:#fffdf2;display:flex;align-items:flex-end}
.style img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.style span{position:relative;width:100%;padding:24px 12px 8px;background:linear-gradient(to bottom,rgba(9,11,24,0),rgba(9,11,24,.92) 60%);font:700 1.0625rem var(--display)}
.style:last-child{grid-column:span 2}
.two{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.box ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px}
.price{font:900 1.5rem var(--display)}
.warn{background:var(--hazard);color:var(--hazard-ink);padding:10px 12px;border-radius:6px;border-left:8px solid var(--hazard-ink)}
.warn strong{font-family:var(--display)}
.free{display:grid;gap:0;border:1.5px solid var(--line);border-radius:14px;overflow:hidden;background:var(--bg2);box-shadow:0 2px 0 var(--edge)}
.free img{width:100%;height:100%;min-height:180px;object-fit:cover;display:block}
.free div{padding:16px;display:flex;flex-direction:column;gap:10px}
.meet{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:center;background:var(--bg2);border:1.5px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 2px 0 var(--edge)}
.hexpic{padding:0;border:1.5px solid var(--line);border-radius:14px;overflow:hidden;background:#1b2140;cursor:pointer;display:block;width:min(220px,60vw);aspect-ratio:1}
.hexpic img{width:100%;height:100%;object-fit:cover;display:block}
.hexpic:active{transform:scale(.98)}
@media (min-width:640px){.meet{grid-template-columns:220px minmax(0,1fr);padding:20px}}
#quiz{display:flex;flex-direction:column;gap:18px}
.quiz .q{display:flex;flex-direction:column;gap:8px}
.quiz .opts{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.quiz button.opt{min-height:48px;text-align:left;padding:10px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg2);color:var(--fg);font:400 1rem var(--body);cursor:pointer}
.quiz button.opt[aria-pressed="true"]{background:var(--fg);color:var(--bg2);font-weight:700}
.result{background:var(--bg3);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;border:1.5px dashed var(--line)}
.hexline{font:500 1.125rem/1.4 var(--display)}
footer{border-top:1px solid var(--soft);padding-top:16px}
@media (min-width:720px){.styles{grid-template-columns:repeat(4,minmax(0,1fr))}.free{grid-template-columns:1.1fr 1fr}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<main class="app">
  <div class="top"><img src="/icon.svg" alt="">HyMeta</div>
  <section class="hero" aria-labelledby="h-main">
    <img src="/images/hymeta-hero.jpg" alt="">
    <div class="hero-in">
      <h1 id="h-main">Pick a playstyle. Play it tonight.</h1>
      <p>HyMeta picks about eight Hytale mods that work together, for every way you like to play. No digging through thousands of mods.</p>
      ${open
        ? `<div class="enter"><a class="btn" id="come-in" href="/">Come in</a></div><p class="small">Free to look around. No account needed.</p>`
        : `<form id="f" class="enter" novalidate><div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required></div><button type="submit" class="btn">Come in</button></form>
      <p id="err" class="err" role="alert" hidden></p><p class="small">HyMeta is in private testing. Ask Lumina Art House for the password.</p>`}
    </div>
  </section>

  <section class="sec" aria-labelledby="h-how"><h2 id="h-how">How it works</h2>
    <ol class="steps">
      <li><h3>Pick a playstyle</h3><p class="muted">Farming, dungeons, building, pets, magic. Whatever you fancy this week.</p></li>
      <li><h3>See the playpack</h3><p class="muted">About eight mods, each picked for one job, with the helper mods they need already found.</p></li>
      <li><h3>Install and play</h3><p class="muted">One tap per mod on your computer, through the free CurseForge app. Browse on your phone, play on your computer.</p></li>
    </ol>
  </section>

  <section class="sec" aria-labelledby="h-styles"><h2 id="h-styles">Seven ways to play</h2>
    <div class="styles">${STYLES.map((s) => `<div class="style"><img src="/images/thumb-pack-${s[0]}.jpg" alt="" loading="lazy"><span>${s[1]}</span></div>`).join("")}</div>
  </section>

  <section class="sec quiz" aria-labelledby="h-quiz">
    <div class="meet">
      <button type="button" class="hexpic" id="hex-pic"><img src="/images/hex.jpg" alt="Hex, a small green troll with wild pink hair, tiny tusks and a huge grin, holding a lantern and a treasure map"><span class="sr">Tap Hex to hear her say something else</span></button>
      <div class="sec">
        <h2 id="h-quiz">Meet Hex. She will pick for you.</h2>
        <p>Hex is HyMeta's resident troll. She digs through thousands of Hytale mods so you do not have to, then dares you to try what she found. She is friendly. Mostly.</p>
        <p class="hexline" id="hex-say" role="status">Go on. Three questions. What is the worst that could happen?</p>
        <p class="small muted">Tap her picture. She has opinions.</p>
      </div>
    </div>
    <h3>Not sure what to play? Answer three questions.</h3>
    <div id="quiz"></div>
    <div class="result" id="result" role="status" hidden></div>
  </section>

  <section class="sec" aria-labelledby="h-free"><h2 id="h-free">Free this week</h2>
    <div class="free"><img src="/images/pack-farm.jpg" alt="" loading="lazy"><div>
      <h3>The cozy farmer</h3><p>Plant things. Pet things. Watch the rain. Nothing bad happens.</p>
      <p class="warn"><strong>Hex's warning.</strong> May cause you to name every chicken. One of them is plotting something.</p>
      <p class="small muted">A new free playpack arrives every week.</p></div></div>
  </section>

  <section class="sec" aria-labelledby="h-cost"><h2 id="h-cost">What it costs</h2>
    <div class="two">
      <div class="box"><h3>Free</h3><p class="price">$0</p><ul><li>One full playpack every week</li><li>A look at the others</li><li>Every mod links to its CurseForge page</li></ul></div>
      <div class="box"><h3>Member</h3><p class="price">$24.99 a year</p><p class="small muted">Or $3.99 a month. Cancel any time.</p><ul><li>Every playpack, every week</li><li>Save favorite playpacks and mods</li><li>Build your own and share them</li></ul></div>
    </div>
    <p class="small muted">The mods themselves are always free and always downloaded from CurseForge. Membership pays for the picking.</p>
  </section>

  <footer class="small muted"><p>&copy; 2026 Lumina Art House, LLC. HyMeta is an unofficial fan site. It is not affiliated with Hytale, Hypixel Studios, CurseForge or Overwolf. Every mod belongs to its creator. Accounts are for ages 13 and up.</p></footer>
</main>
<script>
(function(){
  var OPEN = ${open ? "true" : "false"}, target = "/";
  var Q = [
    ["Pick a perfect evening.", [["Tea, rain and something growing", "cozy-farmer"], ["Hitting things until treasure falls out", "dungeon-gremlin"], ["Rearranging furniture for six hours", "master-builder"], ["Walking until the map runs out", "the-wanderer"]]],
    ["Something rustles in the dark. You:", [["Offer it a snack", "beast-friend"], ["Draw a sword", "dungeon-gremlin"], ["Light a lantern and take notes", "wizard-dropout"], ["Build a wall. A tasteful one.", "master-builder"]]],
    ["How much trouble would you like?", [["None, thank you", "cozy-farmer"], ["A sensible amount", "wizard-dropout"], ["Machines should do it for me", "factory-goblin"], ["All of it", "hard-mode-hermit"]]]
  ];
  var R = { "cozy-farmer":["The cozy farmer", "Soft soil and round chickens. You will be fine. Probably."], "dungeon-gremlin":["Dungeon gremlin", "The loot is at the bottom. The stairs back up are your problem."],
    "master-builder":["Master builder", "One more window, you said. See you in six hours."], "the-wanderer":["The wanderer", "It is just over that hill. So is the next thing."],
    "beast-friend":["Beast friend", "It followed you home. So did the other nine."], "wizard-dropout":["Wizard school dropout", "Point the wand away from your face. The other end."],
    "factory-goblin":["Factory goblin", "It starts with one conveyor belt. It ends with a flowchart."], "hard-mode-hermit":["Hard mode hermit", "One life. Use it wisely. Or in the first four minutes." ] };
  var picks = [], box = document.getElementById("quiz"), out = document.getElementById("result");
  function draw(){
    box.innerHTML = Q.map(function(q, i){ return '<div class="q" role="group" aria-label="' + q[0] + '"><h3>' + (i + 1) + ". " + q[0] + '</h3><div class="opts">' + q[1].map(function(o, j){
      return '<button type="button" class="opt" data-q="' + i + '" data-a="' + j + '" aria-pressed="' + (picks[i] === j) + '">' + o[0] + "</button>"; }).join("") + "</div></div>"; }).join("");
  }
  box.addEventListener("click", function(e){
    var b = e.target.closest(".opt"); if (!b) return;
    var qi = +b.getAttribute("data-q"); picks[qi] = +b.getAttribute("data-a"); draw();
    var again = box.querySelector('[data-q="' + qi + '"][data-a="' + picks[qi] + '"]'); if (again) again.focus();
    if (picks.filter(function(x){ return x != null; }).length < Q.length) return;
    var score = {}, best = null; picks.forEach(function(a, i){ var id = Q[i][1][a][1]; score[id] = (score[id] || 0) + 1; if (!best || score[id] > score[best]) best = id; });
    target = "/#pack-" + best;
    out.innerHTML = '<h3>Hex says: ' + R[best][0] + '</h3><p class="hexline">' + R[best][1] + '</p><div>' +
      (OPEN ? '<a class="btn" id="take-me" href="' + target + '">Take me there</a>' : '<a class="btn btn-ghost" id="take-me" href="#h-main">Enter the password above to see it</a>') + "</div>";
    out.hidden = false;
  });
  draw();
  var LINES = ["Go on. Three questions. What is the worst that could happen?", "I have read every mod description. All of them. I have not slept.", "I picked the spider one myself. You are welcome.",
    "The chickens told me things. I cannot repeat them.", "I am not a goblin. Goblins are shorter and worse at maps.", "Pick the hard one. I will watch. Supportively."], said = 0;
  document.getElementById("hex-pic").addEventListener("click", function(){ said = (said + 1) % LINES.length; document.getElementById("hex-say").textContent = LINES[said]; });
  function enter(){ try { document.cookie = "hymeta_in=1; Path=/; Max-Age=31536000; SameSite=Lax"; } catch (e) {} }
  // going in: remember the visitor has chosen to enter, then load the app (a full reload, since only the part after # may differ)
  document.addEventListener("click", function(e){ var a = e.target.closest("#come-in, #take-me"); if (!a || !OPEN) return; e.preventDefault(); enter(); location.href = target; if (target.indexOf("#") > -1) location.reload(); });
  var f = document.getElementById("f"); if (!f) return;
  f.addEventListener("submit", function(e){ e.preventDefault(); var err = document.getElementById("err"), pw = document.getElementById("pw");
    fetch("/api/login", { method:"POST", headers:{ "Content-Type":"application/json" }, credentials:"same-origin", body:JSON.stringify({ password:pw.value }) })
    .then(function(r){ if (r.ok){ location.href = target; if (target.indexOf("#") > -1) location.reload(); return; } return r.json().then(function(d){ err.textContent = d.error === "notset" ? "No password has been set for this site yet." : "That password is not right. Try again."; err.hidden = false; pw.focus(); pw.select(); }); })
    .catch(function(){ err.textContent = "Could not reach the server. Check your connection and try again."; err.hidden = false; }); });
})();
</script></body></html>`;
