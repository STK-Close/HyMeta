# Makes large pictures of Hex for adverts, with no background, from her portrait (web/images/hex.jpg).
# Run: python3 scripts/make-hex.py wave present      (pictures land in promo/hex/hex-<pose>.png)
# Two fal requests a pose: one draws her in the new pose (FLUX.2 edit, about 1.2 cents, an estimate),
# one cuts the background away (BiRefNet, under a cent, an estimate). Add a line to POSES for a new pose.
import base64, io, json, os, sys, time, urllib.request
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(HERE,"..")
SAME=("Keep exactly the same character and the same chunky pixel-art cartoon style: a small cheerful green troll with big pointed ears, two little lower tusks, "
      "wild bright pink hair, big amber eyes, a patched brown long coat with a gold-buckled belt and a gold backpack. Full body, head to toes, centred, "
      "on a plain flat solid pale grey background with nothing else in the picture: no scenery, no floor objects, no shadows on a wall. "
      "Friendly and child safe. No text, no letters, no logos, no watermark.")
POSES={"present":"She stands turned a little to the side and sweeps one open hand out wide to her left, as if proudly showing something off, grinning.",
       "wave":"She waves hello with one hand high in the air, the other hand holding her glowing lantern low, with a big happy grin.",
       "smug":"She stands with her arms crossed and one eyebrow raised, with a sly, pleased-with-herself smirk.",
       "parcels":"She carries a tall wobbly stack of three wooden crates tied with gold ribbon in both arms, peeking round the side of it with a grin.",
       "peek":"She leans forward on tiptoe holding her glowing lantern up high in one hand, peering ahead with wide curious eyes and a little smile.",
       "point":"She points straight up with one finger as if she has just had a brilliant idea, eyes wide, mouth open in an excited grin."}
def call(url, body=None):
    req=urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type":"application/json","Authorization":"Key "+os.environ.get("FAL_KEY","proxy-injected")}, method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(req, timeout=120))
def run(model, body):
    r=call("https://queue.fal.run/"+model, body)
    for _ in range(90):
        st=call(r["status_url"])
        if st.get("status")=="COMPLETED": return call(r["response_url"])
        if st.get("status") in ("FAILED","ERROR"): raise SystemExit("failed: "+json.dumps(st)[:300])
        time.sleep(2)
    raise SystemExit("timed out")
def data_uri(raw, kind): return "data:image/%s;base64,%s" % (kind, base64.b64encode(raw).decode())
portrait=open(os.path.join(ROOT,"web","images","hex.jpg"),"rb").read()
spent=0
for name in sys.argv[1:]:
    out=run("fal-ai/flux-2/edit", {"prompt":POSES[name]+" "+SAME, "image_urls":[data_uri(portrait,"jpeg")], "image_size":{"width":1024,"height":1280}, "num_images":1}); spent+=1
    posed=urllib.request.urlopen(out["images"][0]["url"], timeout=120).read()
    cut=run("fal-ai/birefnet/v2", {"image_url":data_uri(posed,"png"), "model":"General Use (Heavy)", "operating_resolution":"2048x2048", "output_format":"png"}); spent+=1
    im=Image.open(io.BytesIO(urllib.request.urlopen(cut["image"]["url"], timeout=120).read())).convert("RGBA")
    box=im.getchannel("A").point(lambda a: 255 if a>16 else 0).getbbox()
    if box: im=im.crop(box)
    im.save(os.path.join(ROOT,"promo","hex","hex-%s.png" % name), optimize=True)
    print(name, "done", im.size)
print("requests made:", spent, "| estimated cost: $%.3f" % (spent*0.012))
