# Makes playpack artwork with fal (FLUX.2, about 1.2 cents a picture, commercial use allowed).
# Run: FAL_KEY=... python3 scripts/make-art.py spiders factory hermit   (pictures land in the current folder)
# Add a line to JOBS for each new playpack. STYLE keeps every picture in the same blocky, glowing look.
import json, os, sys, time, urllib.request
MODEL="fal-ai/flux-2"
STYLE=("Voxel art illustration, a world built from small chunky cubes, vibrant saturated colours, warm glowing light sources, soft painterly shading, "
       "cinematic wide composition, rich detail, cheerful adventurous mood, family friendly, no text, no letters, no logos, no watermark.")
JOBS={"spiders":"A dim crystal cave draped in huge glowing spider webs, three big friendly-looking cube spiders with shiny eyes on the webs, silk cocoons, a small hooded adventurer holding a lantern peeking in nervously, teal and purple light.",
      "factory":"A cozy goblin workshop factory at dusk, conveyor belts carrying crates and gems, spinning brass gears, pipes, glowing furnaces, sorting chests, a water wheel, a small green goblin engineer in goggles pulling a lever, orange and teal light.",
      "hermit":"A lone hooded survivor beside a tiny campfire outside a rough stone shelter on a snowy mountainside at night, blizzard wind, frost on pine trees, distant glowing eyes in the dark woods, a single heart-shaped lantern, cold blue with one warm fire glow."}
def call(url, body=None):
    req=urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type":"application/json","Authorization":"Key "+os.environ.get("FAL_KEY","proxy-injected")}, method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(req, timeout=60))
spent=0
for name in sys.argv[1:]:
    r=call("https://queue.fal.run/"+MODEL, {"prompt":JOBS[name]+" "+STYLE, "image_size":{"width":1200,"height":800}, "num_images":1})
    spent+=1
    for _ in range(60):
        st=call(r["status_url"])
        if st.get("status")=="COMPLETED": break
        if st.get("status") in ("FAILED","ERROR"): raise SystemExit("failed: "+json.dumps(st)[:300])
        time.sleep(2)
    out=call(r["response_url"]); img=out["images"][0]
    urllib.request.urlretrieve(img["url"], f"new-{name}.jpg" if img["url"].lower().endswith((".jpg",".jpeg")) else f"new-{name}.png")
    print(name, "done", img.get("width"), "x", img.get("height"), img["url"].rsplit(".",1)[-1])
print("requests made:", spent, "| estimated cost: $%.3f" % (spent*0.012))
