// Shows what a playpack's recipe picks from CurseForge right now. Prints only, saves nothing.
//   NODE_USE_ENV_PROXY=1 CURSEFORGE_API_KEY=... node scripts/try-pack.js gone-fishing [more ids]
// Add HYMETA_EXPLAIN=1 to see the runners-up for each job. Exit code 1 if any playpack has under 7 mods.
const { resolve } = require("../lib/recipes");
(async () => { let thin = false;
  for (const id of process.argv.slice(2)) {
    const p = await resolve(id); if (!p) { console.log(id + ": no such recipe"); thin = true; continue; }
    const all = p.core.concat(p.spice, p.extras), flagged = all.filter((m) => m.caution).length;
    console.log("\n== " + id + ": " + all.length + " mods, " + flagged + " flagged as older, " + p.helpers.length + " helper mods");
    all.forEach((m) => console.log("  " + String(m.role || "").slice(0, 28).padEnd(29) + String(m.name).slice(0, 46).padEnd(47) + (m.caution ? " (older)" : "")));
    if (all.length < 7) thin = true;
  }
  process.exit(thin ? 1 : 0);
})().catch((e) => { console.error("Could not reach CurseForge:", e.message); process.exit(1); });
