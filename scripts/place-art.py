# Puts a picture made by make-art.py into the site: the full picture and its small version.
# Run in the folder where make-art.py left new-<name>.png:   python3 scripts/place-art.py scenic
import glob, os, sys
from PIL import Image
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "images")
for name in sys.argv[1:]:
    found = glob.glob("new-" + name + ".*")
    if not found: raise SystemExit("no picture called new-" + name + " in this folder")
    im = Image.open(found[0]).convert("RGB"); w, h = im.size
    th = round(w * 789 / 1200); top = (h - th) // 2; im = im.crop((0, top, w, top + th))
    im.resize((1200, 789), Image.LANCZOS).save(os.path.join(out, "pack-%s.jpg" % name), quality=84, optimize=True, progressive=True)
    im.resize((480, 316), Image.LANCZOS).save(os.path.join(out, "thumb-pack-%s.jpg" % name), quality=80, optimize=True, progressive=True)
    print("placed pack-%s.jpg and thumb-pack-%s.jpg" % (name, name))
