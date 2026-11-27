#!/usr/bin/env python3
"""HyMeta logo kit: draws the logo files from the site's own mark, font and colors.

Run from the app's top folder:
    python3 brand/tools/make_kit.py brand/tools/fonts/Grandstander-Black.ttf
then:
    node brand/tools/render_kit.cjs        (PNG files, banners, profile picture, share image)

The lettering is Grandstander Black (the site's display font, weight 900, SIL Open Font License), turned into shapes here,
so the SVG files need no font. Only Python's standard library is used: a small TrueType reader below.
"""
import os, struct, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "brand", "hymeta")

# The site's own colors (src/app.html): gold tile, dark backpack, ink for the name in each theme.
GOLD, GOLD_DEEP, PACK, POCKET = "#f2b94b", "#a8771a", "#1d1503", "#7a5200"
DARK = {"ground": "#0e1223", "ink": "#eef1fb"}
LIGHT = {"ground": "#d9e3ef", "ink": "#121930"}


# ---------- a minimal TrueType reader (cmap format 4, hmtx, glyf, kern) ----------
class Font:
    def __init__(self, path):
        self.b = open(path, "rb").read()
        n = struct.unpack(">H", self.b[4:6])[0]
        self.t = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack(">4sIII", self.b[12 + 16 * i:28 + 16 * i])
            self.t[tag.decode()] = (off, ln)
        o = self.t["head"][0]
        self.upm = struct.unpack(">H", self.b[o + 18:o + 20])[0]
        self.locfmt = struct.unpack(">h", self.b[o + 50:o + 52])[0]
        o = self.t["hhea"][0]
        self.asc, self.desc = struct.unpack(">hh", self.b[o + 4:o + 8])
        self.nhm = struct.unpack(">H", self.b[o + 34:o + 36])[0]
        o = self.t["maxp"][0]
        self.nglyphs = struct.unpack(">H", self.b[o + 4:o + 6])[0]
        self.cmap = self._cmap()
        self.kern = self._kern()

    def _cmap(self):
        o = self.t["cmap"][0]
        n = struct.unpack(">H", self.b[o + 2:o + 4])[0]
        for i in range(n):
            pid, eid, off = struct.unpack(">HHI", self.b[o + 4 + 8 * i:o + 12 + 8 * i])
            s = o + off
            if struct.unpack(">H", self.b[s:s + 2])[0] == 4 and pid in (0, 3):
                segx2 = struct.unpack(">H", self.b[s + 6:s + 8])[0]; seg = segx2 // 2
                ends = struct.unpack(">%dH" % seg, self.b[s + 14:s + 14 + segx2])
                starts = struct.unpack(">%dH" % seg, self.b[s + 16 + segx2:s + 16 + 2 * segx2])
                deltas = struct.unpack(">%dh" % seg, self.b[s + 16 + 2 * segx2:s + 16 + 3 * segx2])
                ro = s + 16 + 3 * segx2
                ranges = struct.unpack(">%dH" % seg, self.b[ro:ro + segx2])
                m = {}
                for k in range(seg):
                    for c in range(starts[k], ends[k] + 1):
                        if c == 0xFFFF: continue
                        if ranges[k] == 0: g = (c + deltas[k]) & 0xFFFF
                        else:
                            a = ro + 2 * k + ranges[k] + 2 * (c - starts[k])
                            g = struct.unpack(">H", self.b[a:a + 2])[0]
                            if g: g = (g + deltas[k]) & 0xFFFF
                        m[c] = g
                return m
        raise SystemExit("no usable character map in the font")

    def _kern(self):
        if "kern" not in self.t: return {}
        o = self.t["kern"][0]; pairs = {}
        n = struct.unpack(">H", self.b[o + 2:o + 4])[0]; s = o + 4
        for _ in range(n):
            ln, cov = struct.unpack(">HH", self.b[s + 2:s + 6])
            if cov >> 8 == 0:
                np_ = struct.unpack(">H", self.b[s + 6:s + 8])[0]
                for i in range(np_):
                    l, r, v = struct.unpack(">HHh", self.b[s + 14 + 6 * i:s + 20 + 6 * i]); pairs[(l, r)] = v
            s += ln
        return pairs

    def xmax(self, g):
        a, b = self._loca(g)
        if a == b: return 0
        s = self.t["glyf"][0] + a
        return struct.unpack(">h", self.b[s + 6:s + 8])[0]

    def advance(self, g):
        o = self.t["hmtx"][0]; i = min(g, self.nhm - 1)
        return struct.unpack(">H", self.b[o + 4 * i:o + 4 * i + 2])[0]

    def _loca(self, g):
        o = self.t["loca"][0]
        if self.locfmt == 0: a, b = struct.unpack(">HH", self.b[o + 2 * g:o + 2 * g + 4]); return a * 2, b * 2
        return struct.unpack(">II", self.b[o + 4 * g:o + 4 * g + 8])

    def contours(self, g):
        """Glyph outline as a list of contours, each a list of (x, y, on_curve). Handles composite glyphs."""
        a, b = self._loca(g)
        if a == b: return []
        s = self.t["glyf"][0] + a
        nc = struct.unpack(">h", self.b[s:s + 2])[0]
        if nc < 0: return self._composite(s + 10)
        ends = struct.unpack(">%dH" % nc, self.b[s + 10:s + 10 + 2 * nc]); npts = ends[-1] + 1
        p = s + 10 + 2 * nc; il = struct.unpack(">H", self.b[p:p + 2])[0]; p += 2 + il
        flags = []
        while len(flags) < npts:
            f = self.b[p]; p += 1; flags.append(f)
            if f & 8:
                r = self.b[p]; p += 1; flags.extend([f] * r)
        def coords(short, same):
            v = 0; out = []
            nonlocal p
            for f in flags:
                if f & short:
                    d = self.b[p]; p += 1; v += d if f & same else -d
                elif not f & same:
                    v += struct.unpack(">h", self.b[p:p + 2])[0]; p += 2
                out.append(v)
            return out
        xs = coords(2, 16); ys = coords(4, 32)
        res, st = [], 0
        for e in ends:
            res.append([(xs[i], ys[i], bool(flags[i] & 1)) for i in range(st, e + 1)]); st = e + 1
        return res

    def _composite(self, p):
        res = []
        while True:
            fl, gi = struct.unpack(">HH", self.b[p:p + 4]); p += 4
            if fl & 1: dx, dy = struct.unpack(">hh", self.b[p:p + 4]); p += 4
            else: dx, dy = struct.unpack(">bb", self.b[p:p + 2]); p += 2
            sx = sy = 1.0; r01 = r10 = 0.0
            if fl & 8: sx = sy = struct.unpack(">h", self.b[p:p + 2])[0] / 16384; p += 2
            elif fl & 0x40: sx, sy = [v / 16384 for v in struct.unpack(">hh", self.b[p:p + 4])]; p += 4
            elif fl & 0x80: sx, r01, r10, sy = [v / 16384 for v in struct.unpack(">hhhh", self.b[p:p + 8])]; p += 8
            for c in self.contours(gi):
                res.append([(x * sx + y * r10 + dx, x * r01 + y * sy + dy, on) for x, y, on in c])
            if not fl & 0x20: break
        return res


def contour_path(c, ox, oy, k):
    """SVG path for one quadratic TrueType contour, placed at (ox, oy), scaled by k, y flipped."""
    pts = [(ox + x * k, oy - y * k, on) for x, y, on in c]
    n = len(pts)
    # start on an on-curve point (or the midpoint of two off-curve points)
    start = next((i for i, p in enumerate(pts) if p[2]), None)
    if start is None:
        a, b = pts[0], pts[1]; pts.insert(1, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, True)); start = 1; n += 1
    seq = pts[start:] + pts[:start]
    f = lambda v: ("%.2f" % v).rstrip("0").rstrip(".")
    d = ["M%s %s" % (f(seq[0][0]), f(seq[0][1]))]
    i = 1; seq.append(seq[0])
    while i < len(seq):
        x, y, on = seq[i]
        if on: d.append("L%s %s" % (f(x), f(y))); i += 1; continue
        nx, ny, non = seq[i + 1] if i + 1 < len(seq) else seq[0]
        if non: d.append("Q%s %s %s %s" % (f(x), f(y), f(nx), f(ny))); i += 2
        else:
            mx, my = (x + nx) / 2, (y + ny) / 2
            d.append("Q%s %s %s %s" % (f(x), f(y), f(mx), f(my))); i += 1
    return "".join(d) + "Z"


def text_path(font, text, x, baseline, size, tracking=0.0):
    """Path data for a line of text, and the x where it ends."""
    k = size / font.upm; parts = []; prev = None
    for ch in text:
        g = font.cmap.get(ord(ch), 0)
        if prev is not None: x += font.kern.get((prev, g), 0) * k
        for c in font.contours(g): parts.append(contour_path(c, x, baseline, k))
        x += font.advance(g) * k + tracking * size; prev = g
    return "".join(parts), x - tracking * size


# ---------- the mark: the gold tile with the pixel backpack (PACKMARK and .brand .mark in src/app.html) ----------
PACKMARK = ["...####...", "..#....#..", ".########.", "##########", "##########", "##oooooo##", "##o####o##", "##oooooo##", "##########", ".########."]
TILE = 32; PAD = 5; SHADOW = 2; RADIUS = 8      # px in the site's header

def mark(x, y, h, one_color=None, uid="m"):
    """The tile, h tall (shadow included). one_color: a single fill, with the backpack cut out of the tile."""
    s = h / (TILE + SHADOW); art = (TILE - 2 * PAD) * s / 10; ax, ay = x + PAD * s, y + PAD * s
    px = []
    for r, row in enumerate(PACKMARK):
        for c, ch in enumerate(row):
            if ch in "#o":
                px.append((ax + c * art, ay + r * art, PACK if ch == "#" else POCKET))
    rect = lambda yy, fill: '<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" rx="%.2f" fill="%s"/>' % (x, yy, TILE * s, TILE * s, RADIUS * s, fill)
    if one_color:
        cut = '<path fill="#000" d="%s"/>' % "".join("M%.2f %.2fh%.3fv%.3fh-%.3fZ" % (q[0], q[1], art, art, art) for q in px if q[2] == PACK)
        return ('<mask id="%s"><rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="#fff"/>%s</mask>' % (uid, x, y, TILE * s, h, cut) +
                '<g mask="url(#%s)">%s</g>' % (uid, rect(y, one_color)))
    # each colour's pixels as one path, so no hairline seams show between neighbouring pixels
    paths = "".join('<path fill="%s" d="%s"/>' % (f, "".join("M%.2f %.2fh%.3fv%.3fh-%.3fZ" % (a, b, art, art, art) for a, b, ff in px if ff == f)) for f in (PACK, POCKET))
    return rect(y + SHADOW * s, GOLD_DEEP) + rect(y, GOLD) + paths


def lockup(font, ink, one_color=None, uid="m"):
    """Tile beside "HyMeta", as in the site's header: 22px name, 32px tile (+2px shadow), 10px apart."""
    mark_h = 150; s = mark_h / (TILE + SHADOW)
    size = 22 * s; gap = 10 * s; cap = size * 0.6455        # Grandstander's capitals are 0.6455 of the size
    base = TILE * s / 2 + cap / 2
    p, x2 = text_path(font, "HyMeta", TILE * s + gap, base, size)
    k = size / font.upm; last = font.cmap[ord("a")]
    right = x2 - font.advance(last) * k + font.xmax(last) * k      # the ink's real right edge, not the advance
    return mark(0, 0, mark_h, one_color, uid) + '<path fill="%s" d="%s"/>' % (ink, p), max(x2, right) + 2, mark_h


def svg(body, w, h, title="HyMeta"):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%s" height="%s" role="img" aria-label="%s">'
            '<title>%s</title>%s</svg>\n') % (round(w, 2), round(h, 2), round(w, 2), round(h, 2), title, title, body)


def main():
    if len(sys.argv) < 2: raise SystemExit("usage: make_kit.py Grandstander-Black.ttf")
    font = Font(sys.argv[1])
    os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)
    logos = {"hymeta-logo-color-on-dark": lockup(font, DARK["ink"]), "hymeta-logo-color-on-light": lockup(font, LIGHT["ink"]),
             "hymeta-logo-black": lockup(font, "#000000", "#000000", "k"), "hymeta-logo-white": lockup(font, "#FFFFFF", "#FFFFFF", "w")}
    for name, (body, w, h) in logos.items():
        open(os.path.join(OUT, "svg", name + ".svg"), "w").write(svg(body, w, h))
    H = TILE + SHADOW
    for name, col, uid in (("hymeta-mark-color", None, "m"), ("hymeta-mark-black", "#000000", "k"), ("hymeta-mark-white", "#FFFFFF", "w")):
        open(os.path.join(OUT, "svg", name + ".svg"), "w").write(svg(mark(0, 0, H * 10, col, uid), TILE * 10, H * 10, "HyMeta mark"))
    print("wrote 7 SVG files to", os.path.relpath(OUT, ROOT), "| logo is", round(logos["hymeta-logo-color-on-dark"][1]), "by 150")


if __name__ == "__main__":
    main()
