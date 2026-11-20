// A plain, readable page in HyMeta's colors, for pages that stand outside the app:
// the legal pages anyone may read, and the pages reached from an email link.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DARK = "--bg:#0e1223;--bg2:#1a2143;--line:#6672b8;--soft:#343d70;--fg:#eef1fb;--muted:#b9c1de;--err:#ff8cc2;--focus:#4fe3d4;--edge:#06080f;--link:#9fd0ff;color-scheme:dark";

function shell(title, body, script, head) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} | HyMeta</title><meta name="robots" content="noindex, nofollow">${head || ""}<meta name="theme-color" content="#0e1223">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grandstander:wght@500;700;900&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
:root{--bg:#d9e3ef;--bg2:#fff;--line:#74869f;--soft:#c0ccdb;--fg:#121930;--muted:#3a4461;--gold:#f2b94b;--ink:#1d1503;--deep:#a8771a;--err:#a30d54;--focus:#0b5cad;--edge:#b0bfd1;--link:#0b4f96;
  --display:"Grandstander","Trebuchet MS",system-ui,sans-serif;--body:"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}
:root[data-theme="dark"]{${DARK}}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--fg);font:400 1rem/1.6 var(--body)}
h1,h2,h3,p,ul{margin:0}h1,h2,h3{font-family:var(--display);line-height:1.15;text-wrap:balance}h1{font-size:1.75rem;font-weight:900}h3{font-size:1.125rem;font-weight:700;margin-top:8px}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px;border-radius:4px}
.small{font-size:.8125rem}.muted{color:var(--muted)}
.app{max-width:720px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:20px}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:60px}
.brand{display:inline-flex;align-items:center;gap:10px;min-height:44px;font:900 1.375rem var(--display);color:var(--fg);text-decoration:none}.brand img{width:32px;height:32px;border-radius:8px}
.plain{background:none;border:1.5px solid var(--line);border-radius:12px;color:var(--fg);font:700 .875rem var(--body);min-height:44px;padding:0 14px;cursor:pointer}
.card{background:var(--bg2);border:1.5px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 2px 0 var(--edge);display:flex;flex-direction:column;gap:12px}
.doc{display:flex;flex-direction:column;gap:10px}.doc ul,.perks{padding-left:22px;display:flex;flex-direction:column;gap:6px}
nav ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:4px 18px}
a{color:var(--link);font-weight:700}nav a,.back{display:inline-flex;align-items:center;min-height:44px}
nav a[aria-current="page"]{color:var(--fg);text-decoration:none}
.field{display:flex;flex-direction:column;gap:4px;max-width:340px}label{font-weight:700}
input[type="password"],input[type="text"]{font:inherit;min-height:48px;padding:8px 12px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--fg);width:100%}
.check{display:inline-flex;align-items:center;gap:8px;min-height:44px;cursor:pointer}.check input{width:20px;height:20px}
.btn{min-height:48px;padding:10px 22px;border:0;border-radius:12px;background:var(--gold);color:var(--ink);font:700 1.125rem var(--display);box-shadow:0 3px 0 var(--deep);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;align-self:flex-start}
.btn[disabled]{opacity:.6}.err{color:var(--err);font-weight:700}
.hexline{font:500 1.125rem/1.4 var(--display)}
.pic{width:100%;height:auto;border-radius:12px;display:block;border:1.5px solid var(--line);background:#1b2140}
.hexbox{display:grid;grid-template-columns:56px minmax(0,1fr);gap:10px;align-items:start}
.hexbox img{width:56px;height:56px;border-radius:14px;border:1.5px solid var(--line);display:block}
.hexbox .say{background:var(--bg3,var(--bg));border:1.5px solid var(--line);border-radius:4px 14px 14px 14px;padding:8px 12px;display:flex;flex-direction:column;gap:6px}
.hexbox .who{font-size:.8125rem;font-weight:700;color:var(--muted)}.hexbox .say p:not(.who){font:500 1.0625rem/1.4 var(--display)}
.tag{align-self:flex-start;background:var(--gold);color:var(--ink);font-weight:700;font-size:.875rem;padding:4px 12px;border-radius:999px}
footer{border-top:1px solid var(--soft);padding-top:16px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<div class="app">
  <div class="top"><a class="brand" href="/"><img src="/icon.svg" alt="">HyMeta</a><button type="button" class="plain" id="theme-switch">Dark</button></div>
  <main class="card">${body}</main>
  <footer class="small muted"><p>&copy; 2026 Lumina Art House, LLC. HyMeta is an unofficial fan site. It is not affiliated with Hytale, Hypixel Studios, CurseForge or Overwolf.</p></footer>
</div>
<script>
(function(){
  var root = document.documentElement, b = document.getElementById("theme-switch"), saved = null;
  try { saved = localStorage.getItem("hymeta-page-theme"); } catch (e) {}
  function dark(){ var t = root.getAttribute("data-theme"); return t ? t === "dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
  function label(){ b.textContent = dark() ? "Switch to light" : "Switch to dark"; }
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  label();
  b.addEventListener("click", function(){ var next = dark() ? "light" : "dark"; root.setAttribute("data-theme", next); try { localStorage.setItem("hymeta-page-theme", next); } catch (e) {} label(); });
})();
${script || ""}
</script></body></html>`;
}
module.exports = { shell, esc };
