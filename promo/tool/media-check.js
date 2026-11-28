// Media check. Looks at every advert picture and video an app will post, frame by frame, before it can be used.
// It lives in an app at promo/tool/ (put there by promo-maker's install.js) and reads the `media` part of
// promo/promo.config.js. Needs ffmpeg and ffprobe. Nothing is sent anywhere.
//   node promo/tool/media-check.js            check everything, write the report and the contact sheets
//   node promo/tool/media-check.js --prove    make broken pictures and videos and show every one is caught
//   add --config <path to promo.config.js> to work on an app from somewhere else
//
// Videos: right size (1080 by 1920), a length inside the plan, an audio track (and real sound when the plan asks
// for it), no stretch of 3 seconds or more where the screen stands still (except the end card), and a caption on
// screen at least every 3 seconds (except the end card). Pictures: the right size for their shape, not blank, the
// small print on them (from the drawing manifest) and unchanged since they were drawn. Published copies must be
// the same file, byte for byte, as the one checked.
// Writes <report dir>/report.json, report.md and one contact sheet per file (<name>-sheet.png: one frame a second,
// left to right, top to bottom). A person or a reviewer looks at the sheets: this check catches the obvious
// failures, it does not replace looking.
const path = require("path"), fs = require("fs"), os = require("os"), crypto = require("crypto"), { execFileSync } = require("child_process");

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "pipe"], ...opts });
const sha256 = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function probe(file) {
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", file]).toString());
  const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
  return { w: v.width, h: v.height, seconds: Number((j.format || {}).duration || 0), audio: (j.streams || []).some((s) => s.codec_type === "audio") };
}
// Raw RGB frames, one a second, optionally cropped first. Returns an array of Buffers.
function frames(file, { w, h, crop, still } = {}) {
  const vf = (still ? [] : ["fps=1"]).concat(crop ? ["crop=" + [crop[2], crop[3], crop[0], crop[1]].join(":")] : []).concat(w ? ["scale=" + w + ":" + h] : []).concat(["format=rgb24"]).join(",");
  const raw = run("ffmpeg", ["-v", "error", "-i", file, "-vf", vf, "-f", "rawvideo", "-"]), size = (w || crop[2]) * (h || crop[3]) * 3, out = [];
  for (let i = 0; i + size <= raw.length; i += size) out.push(raw.subarray(i, i + size));
  return out;
}
// Share of pixels that changed between two frames (any colour channel by more than 24 of 255).
function changed(a, b) { let n = 0; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) > 24 || Math.abs(a[i + 1] - b[i + 1]) > 24 || Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n / (a.length / 3); }
// How many pixels are close to one of the caption's colours.
function inkOf(buf, colours) { const cs = colours.map(hex); let n = 0; for (let i = 0; i < buf.length; i += 3) for (const c of cs) if (Math.abs(buf[i] - c[0]) + Math.abs(buf[i + 1] - c[1]) + Math.abs(buf[i + 2] - c[2]) < 60) { n++; break; } return n; }
function volume(file) {
  const err = String(require("child_process").spawnSync("ffmpeg", ["-v", "info", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"], { maxBuffer: 1 << 26 }).stderr);
  const m = /max_volume: (-?[\d.]+|-inf) dB/.exec(err); return m ? (m[1] === "-inf" ? -Infinity : Number(m[1])) : -Infinity;
}
function sheetOf(file, out, kind) {
  if (kind === "video") run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", "fps=1,scale=270:480,tile=8x4:padding=6:color=0x202020", "-frames:v", "1", out]);
  else run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", "scale='min(900,iw)':-2", "-frames:v", "1", out]);
}

function checkVideo(v, file) {
  const problems = [], notes = [], info = probe(file), [W, H] = v.size || [1080, 1920];
  if (info.w !== W || info.h !== H) problems.push(`the video is ${info.w} by ${info.h}, not ${W} by ${H}`);
  const [lo, hi] = v.seconds || [5, 60];
  if (!(info.seconds >= lo && info.seconds <= hi)) problems.push(`the video runs ${info.seconds.toFixed(1)} seconds; the plan says ${lo} to ${hi}`);
  if (!info.audio) problems.push("the video has no audio track (some platforms refuse it)");
  else { const max = volume(file); if (v.audio === "sound" && !(max > -50)) problems.push("the video is silent, but the plan says it has sound"); if (v.audio !== "sound") notes.push(max > -50 ? "has sound" : "silent audio track, as planned"); }
  // frozen screen: a run of near-identical frames one second apart
  const small = frames(file, { w: 216, h: 384 }), still = [], end = v.endcard || 0, last = small.length - 1;
  for (let i = 1; i < small.length; i++) still.push(changed(small[i - 1], small[i]) < 0.003);
  let run0 = -1;
  for (let i = 0; i <= still.length; i++) {
    if (i < still.length && still[i]) { if (run0 < 0) run0 = i; continue; }
    if (run0 >= 0) { const from = run0, to = i; if (to - from >= 3 && from < last - end) problems.push(`the screen stands still from second ${from} to second ${to}`); run0 = -1; }
  }
  // captions: present at least every 3 seconds, outside the end card
  if (v.caption) {
    const [x, y, w, h] = v.caption.box, cut = frames(file, { crop: [x, y, w, h] }), need = v.caption.minInk || 1500, has = cut.map((b) => inkOf(b, v.caption.colours) >= need);
    let gap = 0, gapFrom = 0;
    for (let i = 0; i < has.length; i++) { const inEnd = i > last - end; if (has[i] || inEnd) { if (gap > 3) problems.push(`no caption from second ${gapFrom} to second ${gapFrom + gap}`); gap = 0; } else { if (!gap) gapFrom = i; gap++; } }
    if (gap > 3) problems.push(`no caption from second ${gapFrom} to second ${gapFrom + gap}`);
    notes.push(`caption on screen in ${has.filter(Boolean).length} of ${has.length} sampled seconds`);
  } else problems.push("the plan gives no caption area to check");
  notes.push(`${info.seconds.toFixed(1)} seconds, ${info.w} by ${info.h}, ${small.length} frames sampled`);
  return { problems, notes, seconds: info.seconds };
}

function checkPicture(rel, file, manifest, shapes) {
  const problems = [], notes = [], info = probe(file), m = manifest.pictures[rel], shape = rel.split("/")[0], want = shapes[shape];
  if (want && (info.w !== want[0] || info.h !== want[1])) problems.push(`the picture is ${info.w} by ${info.h}, not ${want[0]} by ${want[1]} for ${shape}`);
  const g = frames(file, { w: 120, h: Math.max(2, Math.round(120 * info.h / info.w)), still: true })[0]; let s = 0, s2 = 0, n = g.length;
  for (let i = 0; i < n; i++) { s += g[i]; s2 += g[i] * g[i]; } const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
  if (sd < 10) problems.push("the picture is blank or almost one flat colour");
  if (!m) problems.push("the drawing manifest has no record of this picture; draw the kit again");
  else {
    if (m.sha256 !== sha256(file)) problems.push("the picture was changed after it was drawn");
    if (manifest.fine && !(m.texts || []).includes(manifest.fine)) problems.push("the small print (" + manifest.fine + ") is not on the picture");
    if (m.problems) problems.push("the drawing step reported problems with this picture");
  }
  notes.push(`${info.w} by ${info.h}`);
  return { problems, notes };
}

function load(configPath) {
  const PROMO = path.dirname(path.resolve(configPath)), config = require(path.resolve(configPath)), ROOT = path.resolve(PROMO, config.root || "..");
  const M = config.media || {}, shapes = (config.brand && config.brand.shapes) || { wide: [1600, 900], square: [1080, 1080], tall: [1080, 1350] };
  const REPORT = path.resolve(ROOT, M.report || "promo/check");
  function all() {
    const problems = [], items = []; fs.mkdirSync(REPORT, { recursive: true });
    for (const f of fs.readdirSync(REPORT)) if (f.endsWith("-sheet.png")) fs.unlinkSync(path.join(REPORT, f));
    let manifest = { pictures: {} }; try { manifest = JSON.parse(fs.readFileSync(path.join(PROMO, "out", "manifest.json"), "utf8")); } catch (e) {}
    const add = (kind, rel, file, published, result, plan) => {
      const name = rel.replace(/[\\/]/g, "-").replace(/\.[^.]+$/, ""), sheet = name + "-sheet.png", item = { kind, file: rel, published: published || null, sha256: fs.existsSync(file) ? sha256(file) : null, ...result, sheet, plan: plan || null };
      if (published) { const pf = path.resolve(ROOT, published); if (!fs.existsSync(pf)) item.problems.push("the published copy is missing: " + published); else if (sha256(pf) !== item.sha256) item.problems.push("the published copy is not the same file as the one checked: " + published); }
      if (item.sha256) sheetOf(file, path.join(REPORT, sheet), kind);
      item.pass = !item.problems.length; items.push(item);
    };
    for (const v of M.videos || []) { const f = path.resolve(ROOT, v.file); if (!fs.existsSync(f)) { add("video", v.file, f, v.published, { problems: ["the video is missing"], notes: [] }); continue; } add("video", v.file, f, v.published, checkVideo(v, f), { captions: v.captions || [], story: v.story || "" }); }
    // every picture in promo/out is checked, whether or not the manifest knows it (an unknown one fails)
    const onDisk = Object.keys(shapes).flatMap((sh) => { const d = path.join(PROMO, "out", sh); return fs.existsSync(d) ? fs.readdirSync(d).filter((x) => /\.(jpe?g|png)$/i.test(x)).map((x) => sh + "/" + x) : []; });
    if (M.pictures !== false) for (const rel of [...new Set(onDisk.concat(Object.keys(manifest.pictures)))].sort()) { const f = path.join(PROMO, "out", rel); if (!fs.existsSync(f)) continue; add("picture", "promo/out/" + rel, f, M.picturesPublished ? path.join(M.picturesPublished, rel) : null, checkPicture(rel, f, manifest, shapes)); }
    const report = { checked: new Date().toISOString(), tool: "promo-maker media check", note: "Each file passed only if problems is empty. The poster compares a file's sha256 with this report before posting it. Contact sheets: one frame a second, left to right, top to bottom.", items };
    fs.writeFileSync(path.join(REPORT, "report.json"), JSON.stringify(report, null, 1) + "\n");
    fs.writeFileSync(path.join(REPORT, "report.md"), "# Media check\n\nChecked " + report.checked + ". " + items.filter((i) => i.pass).length + " of " + items.length + " files passed.\n\n" + items.map((i) => `- ${i.pass ? "PASS" : "FAIL"} ${i.file}: ${i.problems.concat(i.notes).join("; ")}. Contact sheet: ${i.sheet}`).join("\n") + "\n");
    if (M.publishReport) { const pub = path.resolve(ROOT, M.publishReport); fs.rmSync(pub, { recursive: true, force: true }); fs.mkdirSync(pub, { recursive: true }); for (const f of fs.readdirSync(REPORT)) fs.copyFileSync(path.join(REPORT, f), path.join(pub, f)); }
    items.forEach((i) => i.problems.forEach((p) => problems.push(i.file + ": " + p)));
    return { items, problems, dir: REPORT };
  }
  return { all, checkVideo, checkPicture, M, REPORT };
}

// Proof that each check can fail: broken pictures and videos made on the spot must all be caught.
function prove() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "media-proof-")), out = [], f = (n) => path.join(tmp, n);
  const ff = (args) => run("ffmpeg", ["-y", "-v", "error", ...args]);
  const cap = { box: [16, 1700, 1048, 200], colours: ["#DE9148"] }, plan = { seconds: [8, 30], endcard: 3, audio: "silent", caption: cap };
  // a good video: moving grey test picture (no caption colours of its own), a caption box throughout, silent audio track
  ff(["-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=12", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest", "-vf", "hue=s=0,drawbox=x=16:y=1720:w=1048:h=160:color=0xDE9148:t=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f("good.mp4")]);
  const ok = checkVideo(plan, f("good.mp4")); if (ok.problems.length) out.push("a good video was failed: " + ok.problems.join("; "));
  const expect = (what, file, p, re) => { const r = checkVideo(p, file); if (!r.problems.some((m) => re.test(m))) out.push("the check did not notice " + what); };
  ff(["-f", "lavfi", "-i", "color=c=0x131922:size=1080x1920:rate=30:duration=12", "-f", "lavfi", "-i", "anullsrc", "-shortest", "-vf", "hue=s=0,drawbox=x=16:y=1720:w=1048:h=160:color=0xDE9148:t=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f("frozen.mp4")]);
  expect("a frozen screen", f("frozen.mp4"), plan, /stands still/);
  ff(["-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=12", "-f", "lavfi", "-i", "anullsrc", "-shortest", "-vf", "hue=s=0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f("nocaption.mp4")]);
  expect("missing captions", f("nocaption.mp4"), plan, /no caption/);
  ff(["-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=12", "-f", "lavfi", "-i", "anullsrc", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", f("small.mp4")]);
  expect("the wrong size", f("small.mp4"), { ...plan, caption: { ...cap, box: [16, 1000, 600, 200] } }, /not 1080 by 1920/);
  ff(["-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=12", "-vf", "hue=s=0,drawbox=x=16:y=1720:w=1048:h=160:color=0xDE9148:t=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", f("noaudio.mp4")]);
  expect("a missing audio track", f("noaudio.mp4"), plan, /no audio track/);
  expect("silence where sound was planned", f("good.mp4"), { ...plan, audio: "sound" }, /silent/);
  expect("the wrong length", f("good.mp4"), { ...plan, seconds: [20, 30] }, /runs 12\.0 seconds/);
  // pictures
  ff(["-f", "lavfi", "-i", "color=c=0x131922:size=1080x1080", "-frames:v", "1", f("blank.jpg")]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=1080x1080", "-frames:v", "1", f("good.jpg")]);
  const man = { fine: "Small print.", pictures: { "square/good.jpg": { texts: ["Small print."], sha256: sha256(f("good.jpg")) }, "square/blank.jpg": { texts: ["Small print."], sha256: sha256(f("blank.jpg")) }, "square/nofine.jpg": { texts: [], sha256: sha256(f("good.jpg")) }, "square/changed.jpg": { texts: ["Small print."], sha256: "0" } } };
  const shp = { square: [1080, 1080], wide: [1600, 900] }, pic = (rel, file, re, what) => { const r = checkPicture(rel, file, man, shp); if (re ? !r.problems.some((m) => re.test(m)) : r.problems.length) out.push(re ? "the check did not notice " + what : "a good picture was failed: " + r.problems.join("; ")); };
  pic("square/good.jpg", f("good.jpg"), null);
  pic("square/blank.jpg", f("blank.jpg"), /blank/, "a blank picture");
  pic("square/nofine.jpg", f("good.jpg"), /small print/, "missing small print");
  pic("square/changed.jpg", f("good.jpg"), /changed after/, "a picture changed after drawing");
  pic("wide/good.jpg", f("good.jpg"), /not 1600 by 900/, "a picture of the wrong size");
  pic("square/unknown.jpg", f("good.jpg"), /no record/, "a picture the drawing manifest does not know");
  fs.rmSync(tmp, { recursive: true, force: true });
  return { problems: out, proofs: 12 };
}

module.exports = { load, prove, checkVideo, checkPicture };
if (require.main === module) {
  const args = process.argv.slice(2), ci = args.indexOf("--config"), cfg = ci > -1 ? args.splice(ci, 2)[1] : path.join(__dirname, "..", "promo.config.js");
  try {
    if (args[0] === "--prove") { const r = prove(); if (r.problems.length) { console.log("MEDIA CHECK PROOF FAILED\n" + r.problems.join("\n")); process.exit(1); } console.log("media check: " + r.proofs + " broken pictures and videos were all caught, and good ones passed"); }
    else { const r = load(cfg).all(); console.log(`media check: ${r.items.filter((i) => i.pass).length} of ${r.items.length} files passed. Report and contact sheets in ${path.relative(process.cwd(), r.dir) || "."}`); if (r.problems.length) { console.log("MEDIA PROBLEMS\n" + r.problems.join("\n")); process.exit(1); } }
  } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
