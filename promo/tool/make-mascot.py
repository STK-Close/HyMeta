# Makes large pictures of an app's mascot for adverts, with no background, from one portrait of it.
# Run from the app's folder:  python3 promo/tool/make-mascot.py wave present
# It reads promo/poses.json: {"portrait": "path to the portrait", "out": "promo/mascot", "prefix": "name-",
#   "same": "words that keep the character and style the same", "poses": {"wave": "what the pose is", ...}}
# Two fal requests a pose: one draws the new pose (FLUX.2 edit), one cuts the background away (BiRefNet).
# About 2 cents a pose in all (an estimate). Show the owner every new pose before it is used in an advert.
import base64, io, json, os, sys, time, urllib.request
from PIL import Image
ROOT=os.getcwd(); cfg=json.load(open(os.path.join(ROOT,"promo","poses.json")))
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
path=os.path.join(ROOT,cfg["portrait"]); portrait=open(path,"rb").read(); kind="png" if path.lower().endswith(".png") else "jpeg"
os.makedirs(os.path.join(ROOT,cfg["out"]), exist_ok=True)
spent=0
for name in sys.argv[1:]:
    if name not in cfg["poses"]: raise SystemExit("no pose called "+name+" in promo/poses.json")
    out=run("fal-ai/flux-2/edit", {"prompt":cfg["poses"][name]+" "+cfg["same"], "image_urls":[data_uri(portrait,kind)], "image_size":{"width":1024,"height":1280}, "num_images":1}); spent+=1
    posed=urllib.request.urlopen(out["images"][0]["url"], timeout=120).read()
    cut=run("fal-ai/birefnet/v2", {"image_url":data_uri(posed,"png"), "model":"General Use (Heavy)", "operating_resolution":"2048x2048", "output_format":"png"}); spent+=1
    im=Image.open(io.BytesIO(urllib.request.urlopen(cut["image"]["url"], timeout=120).read())).convert("RGBA")
    box=im.getchannel("A").point(lambda a: 255 if a>16 else 0).getbbox()
    if box: im=im.crop(box)
    im.save(os.path.join(ROOT,cfg["out"],cfg.get("prefix","")+name+".png"), optimize=True)
    print(name, "done", im.size)
print("requests made:", spent, "| estimated cost: $%.3f" % (spent*0.012))
