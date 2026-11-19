# Makes playpack artwork with fal (FLUX.2, about 1.2 cents a picture, commercial use allowed).
# Run: FAL_KEY=... python3 scripts/make-art.py crawlies factory hermit   (pictures land in the current folder)
# Add a line to JOBS for each new playpack. STYLE keeps every picture in the same blocky, glowing look.
import json, os, sys, time, urllib.request
MODEL="fal-ai/flux-2"
STYLE=("Chunky 3D voxel art, like an elaborate block-building game world rendered with soft ray-traced lighting. The whole scene is constructed from large, clearly visible cubes: "
       "the ground, trees, clouds, buildings, objects, animals and people are all stacked cube blocks with hard square stair-stepped silhouettes. Characters are blocky figures with cube heads and cube limbs. "
       "Any water is made of square blocks. Nothing is smooth, round or curved anywhere; no flat cartoon illustration, no 2D pixel art, no thin lines. "
       "Dense, richly detailed diorama with real depth, warm glowing lanterns and windows, glowing sparkles, deep saturated colours, golden cinematic light, adventurous family friendly mood. "
       "No text, no letters, no writing on signs, no logos, no watermark.")
JOBS={"crawlies":"A glowing mushroom cave crawling with friendly-looking creepy crawlies: big spiders on webs, bouncing green slimes, a long centipede, shiny beetles, glowing frogs and a fat caterpillar, a nervous hooded adventurer with a lantern peeking in from the entrance, teal and purple light.",
      "farm":"A cozy farm at golden sunset, a red barn, a field of golden wheat, rows of carrots and pumpkins, a cow and three round chickens, a scarecrow in a straw hat, a watering can, a glowing lantern on a fence post.",
      "factory":"A cozy goblin workshop factory at dusk, conveyor belts carrying crates and gems, spinning brass gears, pipes, glowing furnaces, sorting chests, a water wheel, a small green goblin engineer in goggles pulling a lever, orange and teal light.",
      "hermit":"A lone hooded survivor beside a tiny campfire outside a rough stone shelter on a snowy mountainside at night, blizzard wind, frost on pine trees, distant glowing eyes in the dark woods, a single heart-shaped lantern, cold blue with one warm fire glow.",
      "fishing":"A calm lake at sunrise, a small wooden rowboat with a cheerful hooded angler holding a bent fishing rod, a huge glowing golden fish leaping from the water, a little dock with lanterns and a crate of fish, reeds and lily pads, soft pink and teal light.",
      "knights":"A small brave knight in shiny armor holding a banner on a castle drawbridge, a big friendly green dragon curled around the castle tower breathing a small puff of warm fire, colourful flags, timber-framed houses, golden sunset light.",
      "catcafe":"The inside of a tiny cozy cafe full of cube cats, cats on shelves, on the counter and asleep in a basket, one small dog looking confused, steaming mugs, a glowing oven with pastries, hanging plants and string lights, warm amber light.",
      "miner":"A deep cavern with a dwarf-like miner in a lamp helmet swinging a pickaxe at a wall of glowing gems, minecart full of ore on a rail, wooden supports, lanterns, veins of gold and blue crystals, warm lamp light against cool cave blue.",
      "potions":"A cluttered alchemist shop at night, bubbling cauldron overflowing with glowing green foam, shelves of colourful potion bottles, mushrooms in jars, a small startled apprentice with singed hair holding a smoking flask, purple and green glow.",
      "roadtrip":"A winding road through rolling hills at golden hour, a small wooden cart car loaded with luggage and a lantern, a railway with a little minecart train alongside, a river with a sailboat, a signpost and a glowing waypoint stone, a campsite ahead.",
      "plushies":"A bedroom absolutely overflowing with cute plush toys stacked to the ceiling, shelves of plushies, framed pixel paintings, a small statue on a pedestal, a jukebox glowing in the corner, a tiny proud collector sitting on the pile, soft pastel light.",
      "archer":"A hooded archer on a forest ridge at dawn drawing a glowing bow, straw targets with arrows in the bullseye among the trees, a quiver, a crossbow resting on a log, falling leaves, shafts of golden light through the forest.",
      "garden":"A walled flower garden in full bloom at dusk, arches of roses, giant sunflowers, beehives with fat friendly cube bees, paper lanterns and string lights, a picnic table with a teapot and cakes, butterflies, pink and gold light.",
      "quests":"A busy village square with a big wooden notice board covered in blank pinned paper notes, a small adventurer with a backpack reading it, a merchant stall, a guild hall with banners, a friendly villager waving, morning light, treasure chest by the board.",
      "dinos":"A small adventurer riding a big friendly green dinosaur through a lush prehistoric jungle, giant ferns, a long-necked dinosaur by a waterfall in the distance, flying pterosaurs, a volcano glowing softly, bright warm daylight.",
      "packrat":"A storeroom crammed with treasure chests, barrels, crates and bulging backpacks stacked into teetering towers, every one labelled with a tiny sign, a small happy hoarder goblin holding one more chest, coins and trinkets spilling, warm lantern light."}
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
