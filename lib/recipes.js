// Playpack recipes. Each playpack is a list of jobs ("crops", "animals", "cooking"), and each job is
// filled by the best-fitting mod found by live CurseForge searches. Nothing from CurseForge is stored.
//
// How a mod earns its place:
//   fit       the job's words appear in its name or description, as whole words ("pet" never matches "carpet")
//   upkeep    updated recently, and marked for the game version most mods currently support
//   trust     more downloads count for more, for the main picks
//   fairness  one mod per job, at most two mods per author, nothing that needs a pile of helper mods,
//             nothing a chosen mod says it clashes with, and nothing that plainly belongs to another playpack
// "Gem" jobs skip the most popular match and rotate weekly among good lesser-known mods.
const { search, byIds, shape, isLibrary, requiredHelpers, incompatibleWith, gameVersions, compareVersions } = require("./cf");

const DAY = 24 * 3600 * 1000;
// Add-ons that only make sense on top of some other big mod are never main picks.
const NEVER = ["integration", "compat", "addon", "add-on", "skin", "deprecated", "discontinued"];
const RESOURCE_PACKS = 10425; // texture and skin packs change looks, not how you play
const MAX_HELPERS_PER_MOD = 3, MAX_PER_AUTHOR = 2, MIN_DOWNLOADS = 500, MIN_GEM_DOWNLOADS = 500;
// Guides for new players suggest starting with 5 to 10 mods, so every playpack aims for 8 picks:
// its own jobs first, then up to three everyday extras that suit any playstyle.
const TARGET_PICKS = 8, MAX_EXTRAS = 3;
// A job marked `fresh: true` goes first to a mod published in the last two months, so new mods get
// a turn before they have had time to collect downloads. If there is none, the job is filled the usual way.
const FRESH_DAYS = 60, MIN_FRESH_DOWNLOADS = 75;
const EXTRAS = [
  { label: "Know what you are looking at", kw: ["hud", "info", "tooltip", "identif"], q: ["hud", "info"], cat: "qol", n: 1, extra: true },
  { label: "A better map", kw: ["map", "minimap"], q: ["map"], n: 1, extra: true },
  { label: "More room in your bags", kw: ["backpack", "inventory", "bag", "pouch"], q: ["backpack", "inventory"], n: 1, extra: true },
];

// job: { label, kw: words that mean a mod does this job, q: words to search for, cat: CurseForge category, n, gem, avoid }
const PACKS = {
  "cozy-farmer": {
    theme: ["farm", "crop", "harvest", "garden", "cook", "food", "livestock", "chicken", "cow", "coop", "husbandry", "cozy", "fish"],
    avoid: ["combat", "weapon", "boss", "dungeon", "gun", "skin pack"],
    jobs: [
      { label: "Crops and gardens", kw: ["crop", "farm", "harvest", "garden", "seed", "plant", "orchard"], q: ["farm", "crop"], cat: "farming", needCat: true, n: 2 },
      { label: "Farm animals", kw: ["animal", "livestock", "chicken", "cow", "sheep", "coop", "husbandry", "breed"], q: ["animal", "breeding"], n: 1 },
      { label: "Cooking", kw: ["cook", "food", "recipe", "kitchen", "culinary", "meal", "brew", "bak"], q: ["cooking", "food"], n: 1 },
      { label: "A cozy home", kw: ["decor", "furniture", "cozy", "greenhouse", "cottage", "rustic"], q: ["decor", "cozy"], cat: "furniture", n: 1, gem: true },
      { label: "Fishing and seasons", kw: ["fish", "season", "weather", "angl"], q: ["fishing", "season"], n: 1, gem: true },
    ],
  },
  "dungeon-gremlin": {
    theme: ["dungeon", "boss", "combat", "weapon", "loot", "elite", "raid", "sword", "monster", "tomb", "parr"],
    avoid: ["farm", "furniture", "decor", "skin pack"],
    jobs: [
      { label: "Dungeons to raid", kw: ["dungeon", "tomb", "crypt", "labyrinth", "raid", "catacomb"], q: ["dungeon", "tomb"], n: 2 },
      { label: "Sharper combat", kw: ["combat", "parr", "dodge", "block", "stun", "combo"], q: ["combat", "parry"], n: 1 },
      { label: "Bosses", kw: ["boss", "elite", "titan"], q: ["boss"], n: 1 },
      { label: "Weapons", kw: ["weapon", "sword", "blade", "armory", "axe", "bow"], q: ["weapon", "sword"], n: 1, gem: true },
      { label: "Loot and levels", kw: ["loot", "level", "skill", "enchant", "treasure"], q: ["loot", "enchant"], n: 1, gem: true },
    ],
  },
  "master-builder": {
    theme: ["block", "build", "furniture", "decor", "door", "window", "roof", "wall", "brick", "lamp", "construct", "blueprint"],
    avoid: ["dungeon", "combat", "boss", "weapon", "skin pack", "machine", "lucky", "automat", "furnace"],
    jobs: [
      { label: "New blocks", kw: ["block", "brick", "slab", "tile", "masonry", "plank", "path"], q: ["blocks", "brick"], cat: "blocks", needCat: true, n: 2 },
      { label: "Furniture", kw: ["furniture", "furnish", "chair", "table", "shelf", "kitchen", "bed"], q: ["furniture"], cat: "furniture", needCat: true, n: 1 },
      { label: "Doors, windows and roofs", kw: ["door", "window", "roof", "stair", "fence", "gate"], q: ["door", "window", "roof"], n: 1 },
      { label: "Building tools", kw: ["build", "builder", "scaffold", "blueprint", "schematic", "copy"], q: ["builder", "blueprint"], n: 1 },
      { label: "Finishing touches", kw: ["decor", "lamp", "light", "plush", "carpet", "painting", "banner"], q: ["decor", "lamp"], n: 1, gem: true },
    ],
  },
  "the-wanderer": {
    theme: ["map", "minimap", "waypoint", "explor", "biome", "travel", "structure", "ruin", "cave", "compass", "landmark"],
    avoid: ["skin pack"],
    jobs: [
      { label: "A better map", kw: ["map", "minimap"], q: ["map", "minimap"], n: 1 },
      { label: "Waypoints", kw: ["waypoint", "teleport", "recall", "marker", "trail"], q: ["waypoint"], n: 1 },
      { label: "New places", kw: ["biome", "world gen", "worldgen", "landscape", "terrain", "dimension", "realm", "island"], q: ["biome", "dimension"], cat: "worldgen", needCat: true, n: 2 },
      { label: "Things to find", kw: ["structure", "ruin", "village", "tower", "landmark", "temple"], q: ["structure", "ruin"], cat: "prefab", n: 1, gem: true },
      { label: "Getting around", kw: ["glider", "boat", "vehicle", "backpack", "camp", "travel"], q: ["glider", "backpack", "travel"], n: 1, gem: true },
    ],
  },
  // Creepy crawlies: every sort of bug, slime and small monster that crawls, hops or scuttles.
  "too-many-legs": {
    theme: ["spider", "arachn", "cocoon", "slime", "critter", "insect", "bug", "frog", "crawl", "swarm", "scorpion", "beetle", "brood"],
    avoid: ["skin", "spider-man", "spiderman", "begone", "arachnophob", "remove", "disable", "no spiders", "horror", "nightmare", "gore", "blood", "fix", "fixes", "debug", "wormhole", "fullbright"], // children use HyMeta: creepy is fine, horror is not
    jobs: [
      { label: "Spiders", kw: ["spider", "arachn", "cocoon", "broodmother"], q: ["spider", "cocoon"], n: 2 },
      { label: "Slimes", kw: ["slime", "ooze", "blob", "goo"], q: ["slime"], n: 1 },
      { label: "Bugs and critters", kw: ["critter", "insect", "beetle", "caterpillar", "worm", "centipede", "scorpion", "swarm", "larva"], q: ["critter", "insect", "swarm", "scorpion"], n: 1 },
      { label: "Things that hop and slither", kw: ["frog", "toad", "lizard", "snake", "serpent"], q: ["frog", "snake"], n: 1 },
      { label: "Caves to find them in", kw: ["cave", "caves", "cavern", "underground", "burrow", "nest"], q: ["cave", "underground"], n: 1 },
      { label: "Bigger things that crawl", kw: ["monster", "creature", "mob", "beast"], q: ["monster", "creature"], cat: "mobs", needCat: true, n: 1, gem: true },
    ],
  },
  "wizard-dropout": {
    theme: ["magic", "spell", "wand", "staff", "arcan", "mana", "rune", "wizard", "mage", "potion", "alchem", "sorcer"],
    avoid: ["builder", "building", "merchant", "skin pack"],
    jobs: [
      { label: "Spells", kw: ["spell", "magic", "arcan", "sorcer"], q: ["spell", "magic"], n: 2 },
      { label: "Wands and staffs", kw: ["wand", "staff", "stave", "scepter"], q: ["staff", "wand"], n: 1 },
      { label: "Potions", kw: ["potion", "alchem", "elixir", "brew"], q: ["potion", "alchemy"], n: 1 },
      { label: "Runes and enchanting", kw: ["enchant", "rune", "mana"], q: ["enchant", "rune"], n: 1, gem: true },
      { label: "Magical gear", kw: ["robe", "amulet", "artifact", "relic", "talisman", "crystal"], q: ["artifact", "relic"], n: 1, gem: true },
    ],
  },
  "beast-friend": {
    theme: ["pet", "tame", "taming", "mount", "animal", "companion", "breed", "ride", "saddle", "horse", "wildlife"],
    avoid: ["skin pack"],
    jobs: [
      { label: "Taming", kw: ["tame", "taming", "tameable"], q: ["tame", "taming"], n: 1 },
      { label: "Pets", kw: ["pet", "companion", "cat", "dog"], q: ["pet", "companion"], n: 2 },
      { label: "Mounts", kw: ["mount", "ride", "saddle", "horse", "dino"], q: ["mount"], n: 1 },
      { label: "New creatures", kw: ["creature", "animal", "wildlife", "fauna", "bird"], q: ["creature", "wildlife"], n: 1, gem: true },
      { label: "Care and breeding", kw: ["breed", "feed", "treat", "baby", "egg"], q: ["breeding", "feed"], n: 1, gem: true },
    ],
  },
  "factory-goblin": {
    theme: ["automat", "machine", "conveyor", "pipe", "factory", "sort", "power", "energy", "tech", "industrial", "hopper", "quarry"],
    avoid: ["gambling", "backpack", "skin pack"],
    jobs: [
      { label: "Machines", kw: ["automat", "machine", "factory", "industrial", "tech"], q: ["automation", "machine", "factory"], n: 2 },
      { label: "Moving items", kw: ["pipe", "hopper", "conveyor", "transport", "logistic"], q: ["pipe", "hopper", "conveyor"], n: 1 },
      { label: "Storage that sorts itself", kw: ["storage", "sort", "warehouse", "drawer", "chest"], q: ["storage", "sort"], n: 1 },
      { label: "Smarter crafting", kw: ["craft", "workbench", "furnace", "smelt", "anvil"], q: ["crafting", "workbench", "furnace"], n: 1 },
      { label: "Power and mining", kw: ["generator", "electric", "miner", "quarry", "drill", "ore"], q: ["generator", "miner", "quarry"], n: 1, gem: true },
    ],
  },
  "hard-mode-hermit": {
    theme: ["hardcore", "permadeath", "survival", "hunger", "thirst", "temperature", "difficult", "harsh", "realistic"],
    avoid: ["skin pack", "creative"],
    jobs: [
      { label: "One life", kw: ["hardcore", "permadeath", "yolo"], q: ["hardcore", "permadeath"], n: 1 },
      { label: "Hunger and thirst", kw: ["hunger", "thirst", "hungry"], q: ["hunger", "thirst"], n: 1 },
      { label: "Cold and heat", kw: ["temperature", "cold", "heat", "season", "weather"], q: ["temperature", "season"], n: 1 },
      { label: "Tougher world", kw: ["difficult", "harder", "tougher", "challenge", "scaling"], q: ["difficulty", "harder"], n: 1 },
      { label: "Survival gear", kw: ["survival", "camp", "shelter", "torch", "bandage", "injur"], q: ["survival", "camp"], n: 1, gem: true },
    ],
  },
  "whole-circus": {
    theme: [], avoid: ["skin pack"], sharesFreely: true,
    jobs: [
      { label: "Everyday helpers", kw: ["hud", "info", "tooltip", "sort", "quality", "inventory"], q: ["hud", "inventory"], cat: "qol", n: 2 },
      { label: "A bit of combat", kw: ["combat", "weapon", "parr"], q: ["combat"], n: 1 },
      { label: "A bit of farming", kw: ["farm", "crop", "animal"], q: ["farm"], cat: "farming", n: 1 },
      { label: "A bit of magic", kw: ["magic", "spell", "arcan"], q: ["magic"], n: 1 },
      { label: "A bit of exploring", kw: ["biome", "structure", "dungeon", "map"], q: ["biome"], cat: "worldgen", n: 1 },
      { label: "A bit of building", kw: ["furniture", "block", "decor"], q: ["furniture"], n: 1, gem: true },
    ],
  },
  // ---- the weekly playpacks: one makes its debut each week (see ROTA below) ----
  "gone-fishing": {
    theme: ["fish", "angl", "boat", "sail", "underwater", "diving", "ocean", "maritime", "tide"],
    avoid: ["skin pack", "weapon", "boss", "dungeon"],
    jobs: [
      { label: "Fishing", kw: ["fish", "angl"], q: ["fishing"], n: 2 },
      { label: "Boats", kw: ["boat", "sail", "raft", "canoe", "maritime"], q: ["boat"], n: 1 },
      { label: "Under the water", kw: ["underwater", "diving", "dive", "ocean", "sunken", "oxygen", "breath"], q: ["underwater", "ocean"], n: 1 },
      { label: "Cook the catch", kw: ["cook", "food", "meal", "kitchen", "recipe"], q: ["cooking"], n: 1 },
      { label: "A fire by the shore", kw: ["campfire", "camp", "tent", "bonfire"], q: ["campfire", "camp"], n: 1, gem: true },
    ],
  },
  "knights-and-dragons": {
    theme: ["dragon", "knight", "medieval", "castle", "kingdom", "banner", "wyvern"],
    avoid: ["skin pack", "farm", "furniture set", "painting", "halloween", "endgame"],
    jobs: [
      { label: "Dragons", kw: ["dragon", "wyvern", "drake"], q: ["dragon"], n: 2 },
      { label: "Knightly armor", kw: ["knight", "paladin", "plate"], q: ["knight"], n: 1 },
      { label: "A proper castle", kw: ["medieval", "castle", "keep", "fortress", "timber"], q: ["medieval", "castle"], n: 2 },
      { label: "Banners and flags", kw: ["banner", "flag", "heraldry"], q: ["banner", "flag"], n: 1, gem: true },
    ],
  },
  "cat-cafe": {
    theme: ["cat", "kitten", "dog", "puppy", "cafe", "coffee", "tavern", "plush", "kitchen", "bakery"],
    avoid: ["skin pack", "weapon", "boss", "dungeon", "catalog", "catacomb", "category", "catapult", "catwalk", "armor", "slayer", "sword", "beer", "ale"],
    jobs: [
      { label: "Cats", kw: ["cat", "cats", "kitten", "feline"], q: ["cat", "cats"], n: 2 },
      { label: "Dogs, to keep it fair", kw: ["dog", "dogs", "puppy"], q: ["dog"], n: 1 },
      { label: "The kitchen", kw: ["kitchen", "bakery", "oven", "cook"], q: ["kitchen"], n: 1 },
      { label: "Something warm to drink", kw: ["coffee", "cafe", "teapot", "latte", "tavern", "steep"], q: ["coffee", "tavern", "brewing"], n: 1 },
      { label: "Soft things on shelves", kw: ["plush", "plushie", "cushion", "pillow"], q: ["plush"], n: 1, gem: true },
    ],
  },
  "deep-miner": {
    theme: ["mine", "mining", "miner", "ore", "vein", "pickaxe", "drill", "excavat", "gem", "quarry"],
    avoid: ["skin pack", "farm", "furniture", "husbandry", "crossbow", "dungeon"],
    jobs: [
      { label: "Faster digging", kw: ["mining", "vein", "excavat", "pickaxe", "drill", "hammer", "quarry"], q: ["mining", "pickaxe"], n: 2 },
      { label: "More to dig up", kw: ["ore", "ores", "mineral", "metal", "ingot"], q: ["ore"], n: 1 },
      { label: "Shiny things", kw: ["gem", "gemstone", "crystal", "jewel"], q: ["gem", "crystal"], n: 1 },
      { label: "A light in the dark", kw: ["helmet", "lantern", "torch", "headlamp"], q: ["lantern", "torch"], n: 1 },
      { label: "Somewhere to put it all", kw: ["storage", "chest", "crate", "sort"], q: ["storage"], n: 1, gem: true },
    ],
  },
  "potion-problem": {
    theme: ["potion", "alchemy", "brew", "elixir", "cauldron", "herb", "mushroom", "tonic"],
    avoid: ["skin pack", "dungeon", "boss", "beer", "ale"],
    jobs: [
      { label: "Potions", kw: ["potion", "elixir", "tonic", "flask"], q: ["potion"], n: 2 },
      { label: "Alchemy", kw: ["alchemy", "alchemist", "cauldron", "transmut"], q: ["alchemy"], n: 1 },
      { label: "Ingredients", kw: ["herb", "mushroom", "fungi", "flower", "botan"], q: ["mushroom", "herb"], n: 1 },
      { label: "A shop to sell them in", kw: ["trader", "shop", "merchant", "barter"], q: ["trader"], n: 1 },
      { label: "Brews and steeps", kw: ["brew", "brews", "steep", "teapot", "cauldron"], q: ["brewing", "brew"], n: 1, gem: true },
    ],
  },
  "road-trip": {
    theme: ["vehicle", "boat", "rail", "minecart", "glider", "waypoint", "teleport", "travel", "journey", "caravan"],
    avoid: ["skin pack", "dungeon", "boss", "training"],
    jobs: [
      { label: "Things with wheels", kw: ["vehicle", "car", "cart", "wagon", "bike"], q: ["vehicle"], n: 1 },
      { label: "Things that float", kw: ["boat", "sail", "raft", "ship"], q: ["boat"], n: 1 },
      { label: "Rails", kw: ["rail", "rails", "minecart", "track"], q: ["rail", "minecart"], n: 1 },
      { label: "Waypoints", kw: ["waypoint", "waypoints", "marker"], q: ["waypoint"], n: 1 },
      { label: "Shortcuts home", kw: ["teleport", "teleporter", "recall", "homes"], q: ["teleport"], n: 1 },
      { label: "A place to stop for the night", kw: ["campfire", "camp", "tent", "bedroll"], q: ["campfire", "tent"], n: 1, gem: true },
    ],
  },
  "plushie-hoarder": {
    theme: ["plush", "plushie", "painting", "statue", "trophy", "music", "jukebox", "collect", "toy", "figurine"],
    avoid: ["skin pack", "dungeon", "boss", "protection", "weapon"],
    jobs: [
      { label: "Plushies", kw: ["plush", "plushie", "plushies"], q: ["plush"], n: 2 },
      { label: "Paintings", kw: ["painting", "paintings", "poster", "pixelart", "frame"], q: ["painting"], n: 1 },
      { label: "Statues", kw: ["statue", "statues", "sculpture", "figurine"], q: ["statue"], n: 1 },
      { label: "Music for the room", kw: ["music", "jukebox", "radio", "record"], q: ["music"], n: 1 },
      { label: "Shelves for all of it", kw: ["shelf", "shelves", "display", "cabinet", "furniture"], q: ["shelf", "display"], n: 1, gem: true },
    ],
  },
  "sharpshooter": {
    theme: ["bow", "crossbow", "archery", "arrow", "quiver", "ranged", "marksman"],
    avoid: ["skin pack", "farm", "furniture", "elbow", "rainbow", "bowl"],
    jobs: [
      { label: "Bows", kw: ["bow", "bows", "longbow", "archery", "archer"], q: ["bow", "archery"], n: 2 },
      { label: "Crossbows", kw: ["crossbow", "crossbows"], q: ["crossbow"], n: 1 },
      { label: "Arrows", kw: ["arrow", "arrows", "quiver"], q: ["arrow", "quiver"], n: 1 },
      { label: "Something to aim at", kw: ["dummy", "target", "training"], q: ["dummy", "target"], n: 1 },
      { label: "Lighter armor", kw: ["leather", "ranger", "hunter", "cloak", "hood"], q: ["ranger", "hunter"], n: 1, gem: true },
    ],
  },
  "garden-party": {
    theme: ["flower", "garden", "bee", "botanical", "blossom", "sakura", "bloom", "greenhouse", "hedge"],
    avoid: ["skin pack", "dungeon", "boss", "weapon", "beer", "guardian", "spider"],
    jobs: [
      { label: "Flowers", kw: ["flower", "flowers", "blossom", "bloom", "sakura", "botanical"], q: ["flower", "botanical"], n: 2 },
      { label: "A garden to put them in", kw: ["garden", "hedge", "greenhouse", "planter", "prun"], q: ["garden"], n: 1 },
      { label: "Bees", kw: ["bee", "bees", "hive", "honey", "skep"], q: ["bee", "honey"], n: 1 },
      { label: "Lights for the evening", kw: ["lantern", "lamp", "fairy light", "string light"], q: ["lantern", "lamp"], n: 1 },
      { label: "Somewhere to sit", kw: ["bench", "outdoor", "patio", "picnic", "gazebo"], q: ["bench", "outdoor"], n: 1, gem: true },
    ],
  },
  "side-quest": {
    theme: ["quest", "bounty", "rpg", "skill tree", "class", "party", "level", "guild", "reputation"],
    avoid: ["skin pack", "furniture", "farm"],
    jobs: [
      { label: "Quests", kw: ["quest", "quests", "bounty", "contract", "mission"], q: ["quest", "bounty"], n: 2 },
      { label: "Skills and levels", kw: ["skill", "skills", "level", "leveling", "rpg", "class"], q: ["rpg", "skills"], n: 2 },
      { label: "People to work for", kw: ["npc", "npcs", "villager", "guild", "faction"], q: ["npc"], n: 1 },
      { label: "Friends to bring", kw: ["party", "group", "team"], q: ["party"], n: 1, gem: true },
    ],
  },
  "dino-rider": {
    theme: ["dinosaur", "dino", "saurian", "jurassic", "raptor", "primeval", "prehistoric", "fossil", "mount", "rideable"],
    avoid: ["skin pack", "dungeon", "boss", "mountain", "wall mount", "economy"],
    jobs: [
      { label: "Dinosaurs", kw: ["dinosaur", "dinosaurs", "dino", "dinos", "saurian", "jurassic", "raptor"], q: ["dinosaur", "dino"], n: 2 },
      { label: "Things to ride", kw: ["mount", "mounts", "rideable", "mountable"], q: ["mount"], n: 2 },
      { label: "Somewhere wild", kw: ["primeval", "prehistoric", "jungle", "swamp", "ice age"], q: ["primeval", "jungle", "swamp"], n: 1 },
      { label: "Making friends with it", kw: ["tame", "taming", "tameable", "tameability"], q: ["taming"], n: 1, gem: true },
    ],
  },
  "pack-rat": {
    theme: ["storage", "chest", "backpack", "sort", "organiz", "crate", "barrel", "label", "stack"],
    avoid: ["skin pack", "dungeon", "boss", "weapon", "loot"],
    jobs: [
      { label: "Bigger storage", kw: ["storage", "warehouse", "crate", "barrel", "drawer"], q: ["storage"], n: 2 },
      { label: "Better chests", kw: ["chest", "chests"], q: ["chest"], n: 1 },
      { label: "Backpacks", kw: ["backpack", "backpacks", "bag", "pouch", "satchel"], q: ["backpack"], n: 1 },
      { label: "Sorting", kw: ["sort", "sorting", "organiz", "autosort", "tidy"], q: ["sort", "organizer"], n: 1 },
      { label: "Labels, for the truly lost", kw: ["label", "labels", "sign", "tag"], q: ["label", "sign"], n: 1, gem: true },
    ],
  },
  "scenic-route": {
    theme: ["waterfall", "wave", "aurora", "season", "weather", "leaves", "ambient", "scenic", "sunset", "northern lights"],
    avoid: ["skin pack", "dungeon", "boss", "weapon", "raid", "zombie", "pvp", "arena", "horde", "comet", "translation", "removal", "begone", "no fog", "cushion", "sapling", "bench tiers", "workbench", "sickle", "harvest"],
    jobs: [
      { label: "Water that moves", kw: ["waterfall", "waterfalls", "waves", "river", "tide", "foam"], q: ["waterfall", "waves"], n: 1, fresh: true },
      { label: "A sky worth looking at", kw: ["aurora", "northern lights", "stars", "sunset", "sky"], q: ["aurora", "stars"], n: 1, fresh: true },
      { label: "Seasons and weather", kw: ["season", "seasons", "weather"], q: ["season", "weather"], n: 1 },
      { label: "Small things drifting past", kw: ["falling leaves", "leaves", "ambient", "meadow", "whales", "dolphins", "butterfly", "firefly"], q: ["ambient", "leaves", "visual"], n: 1, fresh: true },
      { label: "Lights for after dark", kw: ["lantern", "lamp", "lighting", "light"], q: ["lantern", "lighting"], n: 1 },
      { label: "Somewhere to sit and look", kw: ["tent", "campfire", "balloon", "picnic", "hammock"], q: ["tent", "campfire"], n: 1, fresh: true },
    ],
  },
  "middle-of-the-world": {
    theme: ["cave", "cavern", "underground", "subterran", "rope", "climb", "ladder", "chalk", "grappl"],
    avoid: ["skin pack", "horror", "nightmare", "beer", "weapon", "sword", "translation", "bunker", "rpg", "skill tree", "boots", "broom", "protect", "pets", "ore", "ores", "dinosaur", "spider", "salt", "variants"],
    jobs: [
      { label: "The world under the world", kw: ["center of", "centre of", "underground dimension", "underground world", "custom world", "custom portal"], q: ["center", "underground", "cavern"], n: 2, fresh: true },
      { label: "A way down", kw: ["rope", "ropes", "piton", "pitons", "climb", "climbing", "climbers", "ladder", "ladders", "grappler", "grapple"], q: ["rope", "climb", "ladder", "grapple"], n: 2, fresh: true },
      { label: "A light that comes with you", kw: ["dynamic light", "lantern", "lanterns", "helmet", "headlamp", "flashlight"], q: ["dynamic light", "lantern", "helmet"], n: 1 },
      { label: "Marks to find the way back", kw: ["chalk", "trail", "trails", "route", "routes", "way home", "way back"], q: ["chalk", "trail"], n: 1, fresh: true },
    ],
  },
};

// ---- matching words -------------------------------------------------------------------------
const patterns = new Map();
// A word matches at the start of a word and may run on: "farm" matches "farming", "pet" does not match "carpet".
function pattern(word) {
  if (!patterns.has(word)) patterns.set(word, new RegExp("(^|[^a-z0-9])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ -]?") + "[a-z]*", "i"));
  return patterns.get(word);
}
// "BetterMap" is read as "Better Map", so run-together names still match
const spaced = (text) => String(text).replace(/([a-z])([A-Z])/g, "$1 $2");
const hits = (text, words) => { const t = spaced(text); return words.filter((w) => pattern(w).test(t)).length; };
// needCat: the mod must also sit in the job's CurseForge category
function fit(m, words, cat, needCat) {
  const inName = hits(m.name, words), inBlurb = hits(m.summary || "", words);
  const inCat = !!cat && (m.categories || []).some((c) => c.id === cat);
  // capped, so a name stuffed with keywords does not outrank a better mod
  return { score: 3 * Math.min(inName, 2) + Math.min(inBlurb, 2) + (inCat ? 2 : 0), named: inName > 0, ok: needCat ? inCat && inName + inBlurb > 0 : inName > 0 || (inBlurb > 0 && inCat) || inBlurb >= 2 };
}
const themeFit = (m, pack) => 3 * hits(m.name, pack.theme) + Math.min(hits(m.summary || "", pack.theme), 3);
const avoided = (m, words) => !!words && hits(m.name + " " + (m.summary || ""), words) > 0;

// ---- upkeep ---------------------------------------------------------------------------------
const daysSinceUpdate = (m, ctx) => (ctx.now - Date.parse(m.dateModified || 0)) / DAY;
const supportsCurrent = (m, ctx) => !!ctx.current && gameVersions(m).some((v) => compareVersions(v, ctx.current) >= 0);
function upkeep(m, ctx) {
  const days = daysSinceUpdate(m, ctx);
  const fresh = days <= 45 ? 1.5 : days <= 120 ? 0.75 : days <= 240 ? 0 : -2;
  const marked = gameVersions(m);
  const version = !ctx.current || !marked.length ? 0 : supportsCurrent(m, ctx) ? 1 : -2.5;
  // every helper mod a pick needs is one more thing that can break
  return fresh + version - 0.75 * requiredHelpers(m).length;
}
// Likely still working: marked for the current game version, or touched recently enough to trust.
// Hytale changes fast in early access, so an old mod with no current-version mark is left out.
function alive(m, ctx) {
  if (supportsCurrent(m, ctx)) return true;
  const days = daysSinceUpdate(m, ctx);
  return gameVersions(m).length ? days <= 60 : days <= 270;
}
// The game version most of the candidate mods are marked for is treated as "current".
function currentVersion(mods) {
  const tally = new Map();
  mods.forEach((m) => gameVersions(m).forEach((v) => tally.set(v, (tally.get(v) || 0) + 1)));
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || compareVersions(b[0], a[0])).map((e) => e[0])[0] || "";
}

const authorsOf = (m) => (m.authors || []).map((a) => a.name).filter(Boolean);
// A plain warning for the card when a pick may not work with the current game.
function caution(m, ctx) {
  if (supportsCurrent(m, ctx)) return "";
  if (gameVersions(m).length) return "Made for an older game version. It may not work.";
  return daysSinceUpdate(m, ctx) > 240 ? "Not updated in a long time. It may not work." : "";
}
function weekNumber(now = Date.now()) { return Math.floor(now / (7 * DAY)); }
const CAT_ID = require("./cf").CATEGORY;

// `benched` holds mods players have reported as broken ("cf123"): they are left out and the next best is picked.
async function resolve(id, now = Date.now(), benched = new Set()) {
  const pack = PACKS[id];
  if (!pack) return null;
  // 1. gather candidates with live searches (each distinct search runs once)
  const wanted = new Map();
  const jobs = pack.jobs.concat(EXTRAS);
  jobs.forEach((job) => { (job.q || []).forEach((q) => wanted.set("q:" + q, { q })); if (job.cat) wanted.set("c:" + job.cat, { cat: job.cat }); });
  const lists = await Promise.all([...wanted.values()].map((s) => search({ ...s, size: 40 })));
  const pool = new Map();
  lists.flat().forEach((m) => { if (!benched.has("cf" + m.id) && !isLibrary(m) && m.primaryCategoryId !== RESOURCE_PACKS && !avoided(m, pack.avoid) && !avoided(m, NEVER)) pool.set(m.id, m); });
  const everything = [...pool.values()];
  const ctx = { now, current: currentVersion(everything) };
  const mods = everything.filter((m) => alive(m, ctx));

  // 2. fill each job
  const used = new Set(), perAuthor = new Map(), clashes = new Set(), out = { core: [], spice: [], extras: [], helpers: [], gameVersion: ctx.current }, chosen = [];
  const picked = () => out.core.concat(out.spice, out.extras);
  const others = Object.entries(PACKS).filter(([key, p]) => key !== id && !p.sharesFreely).map(([, p]) => p);
  const filled = (job) => picked().filter((p) => p.role === job.label).length;
  const allowed = (m, job) => {
    if (used.has(m.id) || clashes.has(m.id) || incompatibleWith(m).some((x) => used.has(x))) return false;
    if (requiredHelpers(m).length > MAX_HELPERS_PER_MOD) return false;
    if (authorsOf(m).some((a) => (perAuthor.get(a) || 0) >= MAX_PER_AUTHOR)) return false;
    // one mod per job: if its name says it does a job that is already filled, it would double up
    if (jobs.some((other) => other !== job && filled(other) >= other.n && hits(m.name, other.kw) > 0)) return false;
    // leave it for the playpack it clearly belongs to
    if (!pack.sharesFreely && !job.extra) { const mine = themeFit(m, pack); if (others.some((p) => themeFit(m, p) >= mine + 4)) return false; }
    return true;
  };
  const take = (m, job, fresh) => {
    used.add(m.id); incompatibleWith(m).forEach((x) => clashes.add(x)); chosen.push(m);
    authorsOf(m).forEach((a) => perAuthor.set(a, (perAuthor.get(a) || 0) + 1));
    out[job.extra ? "extras" : job.gem ? "spice" : "core"].push({ ...shape(m), role: job.label, caution: caution(m, ctx), ...(fresh ? { fresh: true } : {}) });
  };
  // the job each mod suits best, so a furniture mod is not used up as "new blocks"
  const best = new Map();
  const bestJob = (m) => {
    if (!best.has(m.id)) best.set(m.id, pack.jobs.map((j) => ({ j, f: fit(m, j.kw, j.cat ? CAT_ID[j.cat] : 0, j.needCat) })).filter((x) => x.f.ok).sort((a, b) => b.f.score - a.f.score)[0]);
    return best.get(m.id) && best.get(m.id).j;
  };
  let extrasTaken = 0;
  jobs.forEach((job) => {
    if (job.extra && (picked().length >= TARGET_PICKS || extrasTaken >= MAX_EXTRAS)) return;
    const cat = job.cat ? CAT_ID[job.cat] : 0;
    const judge = (list) => list.map((m) => ({ m, f: fit(m, job.kw, cat, job.needCat) })).filter((x) => x.f.ok && !avoided(x.m, job.avoid));
    const fits = judge(mods);
    if (process.env.HYMETA_EXPLAIN) console.log(`  job "${job.label}": ` + fits.slice().sort((a, b) => (b.m.downloadCount || 0) - (a.m.downloadCount || 0)).slice(0, 6).map((x) => `${x.m.name.slice(0, 24)} (fit ${x.f.score}, up ${upkeep(x.m, ctx)}, ok ${allowed(x.m, job)})`).join(" | "));
    const popularity = (m) => Math.log10((m.downloadCount || 0) + 1);
    // mods that name the job in their title come first, then fit, trust and upkeep decide
    const rank = (list, minDownloads) => list.filter((x) => (x.m.downloadCount || 0) >= minDownloads)
      .map((x) => ({ m: x.m, named: x.f.named, home: bestJob(x.m) === job, s: x.f.score + 1.5 * popularity(x.m) + 1.5 * upkeep(x.m, ctx) }))
      .sort((a, b) => (b.home - a.home) || (b.named - a.named) || b.s - a.s || a.m.id - b.m.id);
    const fill = (list, upTo) => list.some((x) => { if (allowed(x.m, job)) take(x.m, job); return filled(job) >= upTo; });
    if (job.fresh) {
      const age = (m) => (ctx.now - Date.parse(m.dateCreated || 0)) / DAY;
      fits.filter((x) => age(x.m) <= FRESH_DAYS && (x.m.downloadCount || 0) >= MIN_FRESH_DOWNLOADS)
        .map((x) => ({ m: x.m, s: x.f.score + 1.5 * popularity(x.m) })).sort((a, b) => b.s - a.s || a.m.id - b.m.id)
        .some((x) => { if (allowed(x.m, job)) take(x.m, job, true); return filled(job) >= job.n; });
      if (filled(job) >= job.n) return;
    }
    if (!job.gem) {
      fill(rank(fits, MIN_DOWNLOADS), job.n);
      // nothing established does this job: accept a smaller well-kept mod, then an older one (flagged on its card)
      if (!filled(job)) fill(rank(fits, 50), 1);
      if (!filled(job) && !job.extra) fill(rank(judge(everything.filter((m) => !alive(m, ctx))), 50), 1);
      if (job.extra) extrasTaken += filled(job);
    } else {
      // skip the single most downloaded match, then rotate weekly among the best lesser-known ones
      const star = fits.slice().sort((a, b) => (b.m.downloadCount || 0) - (a.m.downloadCount || 0))[0];
      const gems = fits.filter((x) => x !== star && (x.m.downloadCount || 0) >= MIN_GEM_DOWNLOADS && allowed(x.m, job))
        .map((x) => ({ m: x.m, s: x.f.score + 1.5 * upkeep(x.m, ctx) - 0.6 * popularity(x.m) })).sort((a, b) => b.s - a.s || a.m.id - b.m.id).slice(0, 4);
      const list = gems.length ? gems : star && allowed(star.m, job) ? [{ m: star.m }] : [];
      for (let k = 0, got = 0; k < list.length && got < job.n; k++) { const pick = list[(weekNumber(now) + k) % list.length].m; if (allowed(pick, job)) { take(pick, job); got++; } }
    }
  });

  // 3. add the helper mods the picks cannot run without
  const need = [...new Set(chosen.flatMap(requiredHelpers))].filter((n) => !used.has(n)).slice(0, 12);
  if (need.length) out.helpers = (await byIds(need)).map(shape);
  return out;
}

// One lesser-known, well-kept mod a week, taken from well past the top of the popularity list.
async function spotlight(now = Date.now()) {
  const list = (await search({ size: 40, index: 80 + (weekNumber(now) % 10) * 40 })).filter((m) => !isLibrary(m) && m.logo && m.summary);
  if (!list.length) return null;
  const ctx = { now, current: currentVersion(list) };
  const best = list.map((m) => ({ m, s: upkeep(m, ctx) })).sort((a, b) => b.s - a.s || a.m.id - b.m.id).slice(0, 5);
  return shape(best[weekNumber(now) % best.length].m);
}

// Every word the recipes search for (used by the pretend CurseForge in tests).
const searchWords = () => [...new Set(Object.values(PACKS).flatMap((p) => p.jobs).concat(EXTRAS).flatMap((j) => j.q || []))];
module.exports = { PACKS, EXTRAS, TARGET_PICKS, resolve, spotlight, weekNumber, searchWords };
