// Wraps src/app.html (the app, written as one page) into web/index.html, a complete web page.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/app.html"), "utf8");
const cut = src.indexOf('<div class="app">');
const headBits = src.slice(0, cut).replace(/<title>.*?<\/title>\s*/s, "").replace(/<meta name="claude:[^>]*>\s*/g, "");
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>HyMeta</title>
<meta name="description" content="Playpacks for Hytale: sets of mods picked to work together, one for every way you like to play.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0e1223">
<meta name="apple-mobile-web-app-title" content="HyMeta">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:title" content="HyMeta">
<meta property="og:description" content="Playpacks for Hytale: sets of mods picked to work together.">
<meta property="og:image" content="og.png">
<meta name="twitter:card" content="summary_large_image">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
${headBits.trim()}
</head>
<body>
${src.slice(cut).trim()}
</body>
</html>
`;
fs.writeFileSync(path.join(root, "web/index.html"), page);
console.log("Built web/index.html (" + page.length + " characters)");
