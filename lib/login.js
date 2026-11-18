// The sign-in screen shown before the password is entered. Kept tiny and self-contained.
module.exports = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>HyMeta</title><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#0e1223">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
:root{--bg:#d9e3ef;--card:#fff;--fg:#121930;--muted:#3a4461;--line:#74869f;--gold:#f2b94b;--ink:#1d1503;--deep:#a8771a;--err:#a30d54;--focus:#0b5cad}
@media (prefers-color-scheme:dark){:root{--bg:#0e1223;--card:#1a2143;--fg:#eef1fb;--muted:#b9c1de;--line:#6672b8;--err:#ff8cc2;--focus:#4fe3d4;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:400 1rem/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
main{width:min(400px,100%);background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:1.6rem}p{margin:0}.muted{color:var(--muted)}label{font-weight:700}
input{font:inherit;min-height:44px;padding:8px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);color:var(--fg);width:100%}
button{min-height:48px;border:0;border-radius:12px;background:var(--gold);color:var(--ink);font:700 1.0625rem inherit;font-family:inherit;box-shadow:0 3px 0 var(--deep);cursor:pointer}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.err{color:var(--err);font-weight:700}form{display:flex;flex-direction:column;gap:10px}.small{font-size:.8125rem}
</style></head><body><main>
<h1>HyMeta</h1><p class="muted">This is a private test version. Enter the password to come in.</p>
<form id="f" novalidate><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required>
<p id="err" class="err" role="alert" hidden></p><button type="submit">Come in</button></form>
<p class="small muted">&copy; 2026 Lumina Art House, LLC</p></main>
<script>
document.getElementById("f").addEventListener("submit",function(e){e.preventDefault();var err=document.getElementById("err"),pw=document.getElementById("pw");
 fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({password:pw.value})})
 .then(function(r){if(r.ok){location.reload();return}return r.json().then(function(d){err.textContent=d.error==="notset"?"No password has been set for this site yet.":"That password is not right. Try again.";err.hidden=false;pw.focus();pw.select()})})
 .catch(function(){err.textContent="Could not reach the server. Check your connection and try again.";err.hidden=false})});
</script></body></html>`;
