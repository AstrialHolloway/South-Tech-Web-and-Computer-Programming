// 1. SEEDED NOISE & WORLD CONSTANTS
// =========================================================================
class SeededNoise {
    constructor(seed = Math.floor(Math.random() * 2147483647)) {
        this.seed = seed >>> 0;
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        let s = this.seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 1664525 + 1013904223) >>> 0;
            const j = s % (i + 1);
            const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    }
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = this.fade(xf);
        const v = this.fade(yf);
        const aa = this.perm[this.perm[X] + Y];
        const ab = this.perm[this.perm[X] + Y + 1];
        const ba = this.perm[this.perm[X + 1] + Y];
        const bb = this.perm[this.perm[X + 1] + Y + 1];
        return this.lerp(
            this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u),
            this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u),
            v
        ) * 0.45;
    }
    fbm(x, y, octaves = 3) {
        let val = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < octaves; i++) {
            val += this.noise2D(x * freq, y * freq) * amp;
            freq *= 2.02;
            amp *= 0.5;
        }
        return val;
    }
}

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 112;
const WATER_LEVEL = 53;
const RENDER_DIST = 3;

const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    OAK_LOG: 4,
    OAK_PLANKS: 5,
    LEAVES: 6,
    CHERRY_LEAVES: 7,
    SAND: 8,
    WATER: 9,
    COBBLESTONE: 10,
    GLASS: 11,
    CRAFTING: 12,
    PATH: 13,
    LANTERN: 14,
    GOLD: 15,
    CRYSTAL: 16,
    TNT: 17,
    WHEAT: 18,
    BEDROCK: 19,
    DEEPSLATE: 20,
    IRON_ORE: 21,
    DIAMOND_ORE: 22,
    WOOD_SWORD: 23,
    STONE_SWORD: 24,
    IRON_SWORD: 25,
    DIAMOND_SWORD: 26,
    AETHER_SWORD: 27,
    WOOD_PICKAXE: 28,
    STONE_PICKAXE: 29,
    IRON_PICKAXE: 30,
    DIAMOND_PICKAXE: 31,
    AETHER_PICKAXE: 32,
    STICK: 33,
    APPLE: 34,
    BREAD: 35,
    STONE_IRON_ORE: 36,
    STONE_DIAMOND_ORE: 37,
    DEEPSLATE_CRYSTAL_ORE: 38,
    FARMLAND: 39,
    WOOD_AXE: 40,
    STONE_AXE: 41,
    IRON_AXE: 42,
    DIAMOND_AXE: 43,
    AETHER_AXE: 44,
    WOOD_SHOVEL: 45,
    STONE_SHOVEL: 46,
    IRON_SHOVEL: 47,
    DIAMOND_SHOVEL: 48,
    AETHER_SHOVEL: 49,
    WOOD_HOE: 50,
    STONE_HOE: 51,
    IRON_HOE: 52,
    DIAMOND_HOE: 53,
    AETHER_HOE: 54,
    GRAVEL: 55,
    FLINT: 56,
    FLINT_AND_STEEL: 57,
    OBSIDIAN: 58,
    LAVA: 59,
    NETHERRACK: 60,
    GLOWSTONE: 61,
    SOUL_SAND: 62,
    NETHER_QUARTZ_ORE: 63,
    PORTAL: 64,
    EMERALD_ORE: 65,
    EMERALD: 66,
    SNOW: 67,
    PACKED_ICE: 68,
    EMERALD_BLOCK: 69
};

const BLOCK_DEFS = {
    [BLOCKS.AIR]: { name: 'Empty Hand', solid: false, transparent: true },
    [BLOCKS.GRASS]: { name: 'Sky Meadow Grass', solid: true, transparent: false, hardness: 0.75, bestTool: 'shovel', tex: { top: 0, side: 1, bottom: 2 }, color: '#4ade80', dropItem: BLOCKS.DIRT },
    [BLOCKS.DIRT]: { name: 'Rich Soil', solid: true, transparent: false, hardness: 0.65, bestTool: 'shovel', tex: { all: 2 }, color: '#92400e', dropItem: BLOCKS.DIRT },
    [BLOCKS.FARMLAND]: { name: 'Tilled Farmland', solid: true, transparent: false, hardness: 0.65, bestTool: 'shovel', tex: { top: 31, side: 2, bottom: 2 }, color: '#78350f', dropItem: BLOCKS.DIRT },
    [BLOCKS.STONE]: { name: 'Aether Stone', solid: true, transparent: false, hardness: 2.0, bestTool: 'pickaxe', tex: { all: 3 }, color: '#94a3b8', dropItem: BLOCKS.COBBLESTONE, minTier: 1 },
    [BLOCKS.OAK_LOG]: { name: 'Sky-Oak Log', solid: true, transparent: false, hardness: 1.6, bestTool: 'axe', tex: { top: 5, side: 4, bottom: 5 }, color: '#78350f', dropItem: BLOCKS.OAK_LOG },
    [BLOCKS.OAK_PLANKS]: { name: 'Oak Planks', solid: true, transparent: false, hardness: 1.3, bestTool: 'axe', tex: { all: 6 }, color: '#d97706', dropItem: BLOCKS.OAK_PLANKS },
    [BLOCKS.LEAVES]: { name: 'Meadow Leaves', solid: true, transparent: true, hardness: 0.3, bestTool: 'hoe', tex: { all: 7 }, color: '#22c55e' },
    [BLOCKS.CHERRY_LEAVES]: { name: 'Blossom Leaves', solid: true, transparent: true, hardness: 0.3, bestTool: 'hoe', tex: { all: 8 }, color: '#f472b6' },
    [BLOCKS.SAND]: { name: 'Solar Sand', solid: true, transparent: false, gravity: true, hardness: 0.6, bestTool: 'shovel', tex: { all: 9 }, color: '#fde047', dropItem: BLOCKS.SAND },
    [BLOCKS.WATER]: { name: 'Crystal Water', solid: false, transparent: true, liquid: true, tex: { all: 10 }, color: '#38bdf8' },
    [BLOCKS.COBBLESTONE]: { name: 'Cobblestone', solid: true, transparent: false, hardness: 2.3, bestTool: 'pickaxe', tex: { all: 11 }, color: '#64748b', dropItem: BLOCKS.COBBLESTONE, minTier: 1 },
    [BLOCKS.GLASS]: { name: 'Tempered Glass', solid: true, transparent: true, hardness: 0.45, tex: { all: 12 }, color: '#bae6fd' },
    [BLOCKS.CRAFTING]: { name: 'Crafting Table', solid: true, transparent: false, hardness: 1.5, bestTool: 'axe', tex: { all: 13 }, color: '#b45309', dropItem: BLOCKS.CRAFTING },
    [BLOCKS.PATH]: { name: 'Village Dirt Path', solid: true, transparent: false, hardness: 0.7, bestTool: 'shovel', tex: { top: 14, side: 2, bottom: 2 }, color: '#ca8a04', dropItem: BLOCKS.DIRT },
    [BLOCKS.LANTERN]: { name: 'Starlight Lantern', solid: true, transparent: true, hardness: 0.8, bestTool: 'pickaxe', customModel: 'lantern', emissive: true, light: 15, heldLight: { color: 0xffd166, intensity: 1.85, distance: 16 }, tex: { all: 15 }, color: '#fbbf24', dropItem: BLOCKS.LANTERN },
    [BLOCKS.GOLD]: { name: 'Solar Gold Block', solid: true, transparent: false, hardness: 3.2, bestTool: 'pickaxe', tex: { all: 16 }, color: '#facc15', dropItem: BLOCKS.GOLD, minTier: 3 },
    [BLOCKS.CRYSTAL]: { name: 'Aether Crystal Ore', solid: true, transparent: false, hardness: 4.2, bestTool: 'pickaxe', emissive: true, light: 12, heldLight: { color: 0x22d3ee, intensity: 1.5, distance: 14 }, tex: { all: 17 }, color: '#22d3ee', dropItem: BLOCKS.CRYSTAL, minTier: 4 },
    [BLOCKS.DEEPSLATE_CRYSTAL_ORE]: { name: 'Deepslate Aether Crystal Ore', solid: true, transparent: false, hardness: 5.8, bestTool: 'pickaxe', emissive: true, light: 12, heldLight: { color: 0x22d3ee, intensity: 1.5, distance: 14 }, tex: { all: 34 }, color: '#06b6d4', dropItem: BLOCKS.CRYSTAL, minTier: 4 },
    [BLOCKS.TNT]: { name: 'Super TNT [F]', solid: true, transparent: false, hardness: 0.25, tex: { top: 19, side: 18, bottom: 19 }, color: '#ef4444', dropItem: BLOCKS.TNT },
    [BLOCKS.WHEAT]: { name: 'Golden Wheat', solid: false, transparent: true, hardness: 0.15, bestTool: 'hoe', tex: { all: 20 }, color: '#eab308', dropItem: BLOCKS.WHEAT },
    [BLOCKS.BEDROCK]: { name: 'Unbreakable Bedrock', solid: true, transparent: false, unbreakable: true, tex: { all: 24 }, color: '#090d16' },
    [BLOCKS.DEEPSLATE]: { name: 'Deepslate', solid: true, transparent: false, hardness: 3.6, bestTool: 'pickaxe', tex: { all: 25 }, color: '#1e293b', dropItem: BLOCKS.DEEPSLATE, minTier: 1 },
    [BLOCKS.STONE_IRON_ORE]: { name: 'Iron Ore', solid: true, transparent: false, hardness: 2.8, bestTool: 'pickaxe', tex: { all: 32 }, color: '#fdba74', dropItem: BLOCKS.IRON_ORE, minTier: 2 },
    [BLOCKS.IRON_ORE]: { name: 'Deepslate Iron Ore', solid: true, transparent: false, hardness: 4.0, bestTool: 'pickaxe', tex: { all: 26 }, color: '#fdba74', dropItem: BLOCKS.IRON_ORE, minTier: 2 },
    [BLOCKS.STONE_DIAMOND_ORE]: { name: 'Diamond Ore', solid: true, transparent: false, hardness: 3.4, bestTool: 'pickaxe', tex: { all: 33 }, color: '#38bdf8', dropItem: BLOCKS.DIAMOND_ORE, minTier: 3 },
    [BLOCKS.DIAMOND_ORE]: { name: 'Deepslate Diamond Ore', solid: true, transparent: false, hardness: 4.8, bestTool: 'pickaxe', tex: { all: 27 }, color: '#38bdf8', dropItem: BLOCKS.DIAMOND_ORE, minTier: 3 },
    [BLOCKS.STICK]: { name: 'Wooden Stick', itemOnly: true, tool: true, tex: { all: 28 }, color: '#92400e' },
    [BLOCKS.APPLE]: { name: 'Sky Apple (+4 Hunger)', itemOnly: true, tool: true, food: 4, tex: { all: 29 }, color: '#ef4444' },
    [BLOCKS.BREAD]: { name: 'Golden Bread (+6 Hunger)', itemOnly: true, tool: true, food: 6, tex: { all: 30 }, color: '#d97706' },
    [BLOCKS.WOOD_SWORD]: { name: 'Wooden Sword (4 DMG)', itemOnly: true, tool: true, toolKind: 'sword', damage: 4, tier: 1, hiltColor: 0x78350f, bladeColor: 0xb45309, bladeGlow: 0x000000, iconTint: ['#d97706', '#b45309'], tex: { all: 21 }, color: '#b45309' },
    [BLOCKS.STONE_SWORD]: { name: 'Stone Sword (5 DMG)', itemOnly: true, tool: true, toolKind: 'sword', damage: 5, tier: 2, hiltColor: 0x78350f, bladeColor: 0x94a3b8, bladeGlow: 0x000000, iconTint: ['#cbd5e1', '#64748b'], tex: { all: 21 }, color: '#94a3b8' },
    [BLOCKS.IRON_SWORD]: { name: 'Iron Sword (7 DMG)', itemOnly: true, tool: true, toolKind: 'sword', damage: 7, tier: 3, hiltColor: 0x92400e, bladeColor: 0xf1f5f9, bladeGlow: 0x334155, iconTint: ['#ffffff', '#cbd5e1'], tex: { all: 21 }, color: '#f1f5f9' },
    [BLOCKS.DIAMOND_SWORD]: { name: 'Diamond Sword (9 DMG)', itemOnly: true, tool: true, toolKind: 'sword', damage: 9, tier: 4, hiltColor: 0x78350f, bladeColor: 0x38bdf8, bladeGlow: 0x0284c7, iconTint: ['#7dd3fc', '#0284c7'], tex: { all: 21 }, color: '#38bdf8' },
    [BLOCKS.AETHER_SWORD]: { name: 'Aether Crystal Sword (12 DMG)', itemOnly: true, tool: true, toolKind: 'sword', damage: 12, tier: 5, hiltColor: 0xf59e0b, bladeColor: 0x22d3ee, bladeGlow: 0x06b6d4, heldLight: { color: 0x38bdf8, intensity: 0.9, distance: 10 }, iconTint: ['#a5f3fc', '#06b6d4'], tex: { all: 21 }, color: '#22d3ee' },
    [BLOCKS.WOOD_PICKAXE]: { name: 'Wooden Pickaxe (Tier 1)', itemOnly: true, tool: true, toolKind: 'pickaxe', pickTier: 1, toolSpeed: 2.2, damage: 3, headColor: 0xb45309, tipColor: 0xd97706, iconTint: ['#d97706', '#b45309'], tex: { all: 22 }, color: '#b45309' },
    [BLOCKS.STONE_PICKAXE]: { name: 'Stone Pickaxe (Tier 2)', itemOnly: true, tool: true, toolKind: 'pickaxe', pickTier: 2, toolSpeed: 3.4, damage: 4, headColor: 0x64748b, tipColor: 0x94a3b8, iconTint: ['#cbd5e1', '#64748b'], tex: { all: 22 }, color: '#94a3b8' },
    [BLOCKS.IRON_PICKAXE]: { name: 'Iron Pickaxe (Tier 3)', itemOnly: true, tool: true, toolKind: 'pickaxe', pickTier: 3, toolSpeed: 5.0, damage: 5, headColor: 0xe2e8f0, tipColor: 0xffffff, iconTint: ['#ffffff', '#cbd5e1'], tex: { all: 22 }, color: '#f1f5f9' },
    [BLOCKS.DIAMOND_PICKAXE]: { name: 'Diamond Pickaxe (Tier 4)', itemOnly: true, tool: true, toolKind: 'pickaxe', pickTier: 4, toolSpeed: 7.0, damage: 6, headColor: 0x0284c7, tipColor: 0x38bdf8, iconTint: ['#7dd3fc', '#0284c7'], tex: { all: 22 }, color: '#38bdf8' },
    [BLOCKS.AETHER_PICKAXE]: { name: 'Aether Pickaxe (Tier 5)', itemOnly: true, tool: true, toolKind: 'pickaxe', pickTier: 5, toolSpeed: 9.5, damage: 7, headColor: 0x06b6d4, tipColor: 0xa5f3fc, heldLight: { color: 0x22d3ee, intensity: 0.7, distance: 8 }, iconTint: ['#a5f3fc', '#06b6d4'], tex: { all: 22 }, color: '#22d3ee' },
    [BLOCKS.WOOD_AXE]: { name: 'Wooden Axe (Tier 1)', itemOnly: true, tool: true, toolKind: 'axe', axeTier: 1, toolSpeed: 2.2, damage: 4, headColor: 0xb45309, iconTint: ['#d97706', '#b45309'], tex: { all: 23 }, color: '#b45309' },
    [BLOCKS.STONE_AXE]: { name: 'Stone Axe (Tier 2)', itemOnly: true, tool: true, toolKind: 'axe', axeTier: 2, toolSpeed: 3.4, damage: 5, headColor: 0x64748b, iconTint: ['#cbd5e1', '#64748b'], tex: { all: 23 }, color: '#94a3b8' },
    [BLOCKS.IRON_AXE]: { name: 'Iron Axe (Tier 3)', itemOnly: true, tool: true, toolKind: 'axe', axeTier: 3, toolSpeed: 5.0, damage: 6, headColor: 0xe2e8f0, iconTint: ['#ffffff', '#cbd5e1'], tex: { all: 23 }, color: '#f1f5f9' },
    [BLOCKS.DIAMOND_AXE]: { name: 'Diamond Axe (Tier 4)', itemOnly: true, tool: true, toolKind: 'axe', axeTier: 4, toolSpeed: 7.0, damage: 8, headColor: 0x0284c7, iconTint: ['#7dd3fc', '#0284c7'], tex: { all: 23 }, color: '#38bdf8' },
    [BLOCKS.AETHER_AXE]: { name: 'Aether Axe (Tier 5)', itemOnly: true, tool: true, toolKind: 'axe', axeTier: 5, toolSpeed: 9.5, damage: 10, headColor: 0x06b6d4, heldLight: { color: 0x22d3ee, intensity: 0.7, distance: 8 }, iconTint: ['#a5f3fc', '#06b6d4'], tex: { all: 23 }, color: '#22d3ee' },
    [BLOCKS.WOOD_SHOVEL]: { name: 'Wooden Shovel (Tier 1)', itemOnly: true, tool: true, toolKind: 'shovel', shovelTier: 1, toolSpeed: 2.4, damage: 2, headColor: 0xb45309, iconTint: ['#d97706', '#b45309'], tex: { all: 35 }, color: '#b45309' },
    [BLOCKS.STONE_SHOVEL]: { name: 'Stone Shovel (Tier 2)', itemOnly: true, tool: true, toolKind: 'shovel', shovelTier: 2, toolSpeed: 3.6, damage: 3, headColor: 0x64748b, iconTint: ['#cbd5e1', '#64748b'], tex: { all: 35 }, color: '#94a3b8' },
    [BLOCKS.IRON_SHOVEL]: { name: 'Iron Shovel (Tier 3)', itemOnly: true, tool: true, toolKind: 'shovel', shovelTier: 3, toolSpeed: 5.2, damage: 4, headColor: 0xe2e8f0, iconTint: ['#ffffff', '#cbd5e1'], tex: { all: 35 }, color: '#f1f5f9' },
    [BLOCKS.DIAMOND_SHOVEL]: { name: 'Diamond Shovel (Tier 4)', itemOnly: true, tool: true, toolKind: 'shovel', shovelTier: 4, toolSpeed: 7.2, damage: 5, headColor: 0x0284c7, iconTint: ['#7dd3fc', '#0284c7'], tex: { all: 35 }, color: '#38bdf8' },
    [BLOCKS.AETHER_SHOVEL]: { name: 'Aether Shovel (Tier 5)', itemOnly: true, tool: true, toolKind: 'shovel', shovelTier: 5, toolSpeed: 9.8, damage: 6, headColor: 0x06b6d4, heldLight: { color: 0x22d3ee, intensity: 0.7, distance: 8 }, iconTint: ['#a5f3fc', '#06b6d4'], tex: { all: 35 }, color: '#22d3ee' },
    [BLOCKS.WOOD_HOE]: { name: 'Wooden Hoe (Tier 1)', itemOnly: true, tool: true, toolKind: 'hoe', hoeTier: 1, toolSpeed: 2.2, damage: 2, headColor: 0xb45309, iconTint: ['#d97706', '#b45309'], tex: { all: 36 }, color: '#b45309' },
    [BLOCKS.STONE_HOE]: { name: 'Stone Hoe (Tier 2)', itemOnly: true, tool: true, toolKind: 'hoe', hoeTier: 2, toolSpeed: 3.4, damage: 3, headColor: 0x64748b, iconTint: ['#cbd5e1', '#64748b'], tex: { all: 36 }, color: '#94a3b8' },
    [BLOCKS.IRON_HOE]: { name: 'Iron Hoe (Tier 3)', itemOnly: true, tool: true, toolKind: 'hoe', hoeTier: 3, toolSpeed: 5.0, damage: 4, headColor: 0xe2e8f0, iconTint: ['#ffffff', '#cbd5e1'], tex: { all: 36 }, color: '#f1f5f9' },
    [BLOCKS.DIAMOND_HOE]: { name: 'Diamond Hoe (Tier 4)', itemOnly: true, tool: true, toolKind: 'hoe', hoeTier: 4, toolSpeed: 7.0, damage: 5, headColor: 0x0284c7, iconTint: ['#7dd3fc', '#0284c7'], tex: { all: 36 }, color: '#38bdf8' },
    [BLOCKS.AETHER_HOE]: { name: 'Aether Hoe (Tier 5)', itemOnly: true, tool: true, toolKind: 'hoe', hoeTier: 5, toolSpeed: 9.5, damage: 6, headColor: 0x06b6d4, heldLight: { color: 0x22d3ee, intensity: 0.7, distance: 8 }, iconTint: ['#a5f3fc', '#06b6d4'], tex: { all: 36 }, color: '#22d3ee' },
    [BLOCKS.GRAVEL]: { name: 'Gravel', solid: true, transparent: false, gravity: true, hardness: 0.65, bestTool: 'shovel', tex: { all: 37 }, color: '#64748b', dropItem: BLOCKS.GRAVEL },
    [BLOCKS.FLINT]: { name: 'Sharp Flint', itemOnly: true, tool: true, tex: { all: 38 }, color: '#1e293b' },
    [BLOCKS.FLINT_AND_STEEL]: { name: 'Flint & Steel', itemOnly: true, tool: true, tex: { all: 39 }, color: '#cbd5e1' },
    [BLOCKS.OBSIDIAN]: { name: 'Crying Obsidian', solid: true, transparent: false, hardness: 14.0, bestTool: 'pickaxe', minTier: 4, tex: { all: 40 }, color: '#1e1b4b', dropItem: BLOCKS.OBSIDIAN },
    [BLOCKS.LAVA]: { name: 'Molten Lava', solid: false, transparent: true, liquid: true, emissive: true, light: 15, tex: { all: 41 }, color: '#f97316' },
    [BLOCKS.NETHERRACK]: { name: 'Netherrack', solid: true, transparent: false, hardness: 0.7, bestTool: 'pickaxe', minTier: 1, tex: { all: 42 }, color: '#7f1d1d', dropItem: BLOCKS.NETHERRACK },
    [BLOCKS.GLOWSTONE]: { name: 'Glowstone', solid: true, transparent: false, hardness: 0.5, emissive: true, light: 15, heldLight: { color: 0xfde047, intensity: 1.7, distance: 15 }, tex: { all: 43 }, color: '#facc15', dropItem: BLOCKS.GLOWSTONE },
    [BLOCKS.SOUL_SAND]: { name: 'Soul Sand', solid: true, transparent: false, hardness: 0.6, bestTool: 'shovel', tex: { all: 44 }, color: '#451a03', dropItem: BLOCKS.SOUL_SAND },
    [BLOCKS.NETHER_QUARTZ_ORE]: { name: 'Nether Quartz Ore', solid: true, transparent: false, hardness: 2.6, bestTool: 'pickaxe', minTier: 1, tex: { all: 45 }, color: '#fda4af', dropItem: BLOCKS.NETHER_QUARTZ_ORE },
    [BLOCKS.PORTAL]: { name: 'Nether Portal', solid: false, transparent: true, emissive: true, light: 12, unbreakable: true, customModel: 'portal', tex: { all: 46 }, color: '#a855f7' },
    [BLOCKS.EMERALD_ORE]: { name: 'Emerald Ore', solid: true, transparent: false, hardness: 3.2, bestTool: 'pickaxe', minTier: 3, tex: { all: 47 }, color: '#10b981', dropItem: BLOCKS.EMERALD },
    [BLOCKS.EMERALD]: { name: 'Emerald Gem', itemOnly: true, tool: true, tex: { all: 48 }, color: '#10b981' },
    [BLOCKS.SNOW]: { name: 'Snow Block', solid: true, transparent: false, hardness: 0.45, bestTool: 'shovel', tex: { all: 49 }, color: '#f8fafc', dropItem: BLOCKS.SNOW },
    [BLOCKS.PACKED_ICE]: { name: 'Packed Ice', solid: true, transparent: true, hardness: 0.7, bestTool: 'pickaxe', tex: { all: 50 }, color: '#bae6fd', dropItem: BLOCKS.PACKED_ICE },
    [BLOCKS.EMERALD_BLOCK]: { name: 'Emerald Block', solid: true, transparent: false, hardness: 2.5, bestTool: 'pickaxe', minTier: 3, tex: { all: 51 }, color: '#059669', dropItem: BLOCKS.EMERALD_BLOCK }
};

const GRID_RECIPES = [
    { w: 1, h: 1, pattern: [BLOCKS.OAK_LOG], out: { id: BLOCKS.OAK_PLANKS, count: 4 } },
    { w: 1, h: 2, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS], out: { id: BLOCKS.STICK, count: 4 } },
    { w: 2, h: 2, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS], out: { id: BLOCKS.CRAFTING, count: 1 } },
    { w: 3, h: 1, pattern: [BLOCKS.WHEAT, BLOCKS.WHEAT, BLOCKS.WHEAT], out: { id: BLOCKS.BREAD, count: 1 } },
    { w: 2, h: 2, pattern: [BLOCKS.SAND, BLOCKS.SAND, BLOCKS.SAND, BLOCKS.SAND], out: { id: BLOCKS.GLASS, count: 4 } },
    { w: 1, h: 3, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.IRON_ORE, BLOCKS.OAK_PLANKS], out: { id: BLOCKS.LANTERN, count: 2 } },
    { w: 2, h: 2, pattern: [BLOCKS.SAND, BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, BLOCKS.SAND], out: { id: BLOCKS.TNT, count: 1 } },
    { w: 2, h: 2, pattern: [BLOCKS.IRON_ORE, 0, 0, BLOCKS.FLINT], out: { id: BLOCKS.FLINT_AND_STEEL, count: 1 } },
    { w: 2, h: 1, pattern: [BLOCKS.IRON_ORE, BLOCKS.FLINT], out: { id: BLOCKS.FLINT_AND_STEEL, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.STICK], out: { id: BLOCKS.WOOD_SWORD, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.STICK], out: { id: BLOCKS.STONE_SWORD, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, BLOCKS.STICK], out: { id: BLOCKS.IRON_SWORD, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.DIAMOND_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.STICK], out: { id: BLOCKS.DIAMOND_SWORD, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.CRYSTAL, BLOCKS.CRYSTAL, BLOCKS.STICK], out: { id: BLOCKS.AETHER_SWORD, count: 1 } },
    { w: 3, h: 3, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, 0, BLOCKS.STICK, 0, 0, BLOCKS.STICK, 0], out: { id: BLOCKS.WOOD_PICKAXE, count: 1 } },
    { w: 3, h: 3, pattern: [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, 0, BLOCKS.STICK, 0, 0, BLOCKS.STICK, 0], out: { id: BLOCKS.STONE_PICKAXE, count: 1 } },
    { w: 3, h: 3, pattern: [BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, 0, BLOCKS.STICK, 0, 0, BLOCKS.STICK, 0], out: { id: BLOCKS.IRON_PICKAXE, count: 1 } },
    { w: 3, h: 3, pattern: [BLOCKS.DIAMOND_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.DIAMOND_ORE, 0, BLOCKS.STICK, 0, 0, BLOCKS.STICK, 0], out: { id: BLOCKS.DIAMOND_PICKAXE, count: 1 } },
    { w: 3, h: 3, pattern: [BLOCKS.CRYSTAL, BLOCKS.CRYSTAL, BLOCKS.CRYSTAL, 0, BLOCKS.STICK, 0, 0, BLOCKS.STICK, 0], out: { id: BLOCKS.AETHER_PICKAXE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.WOOD_AXE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.STONE_AXE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.IRON_AXE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.DIAMOND_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.DIAMOND_AXE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.CRYSTAL, BLOCKS.CRYSTAL, BLOCKS.CRYSTAL, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.AETHER_AXE, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.STICK, BLOCKS.STICK], out: { id: BLOCKS.WOOD_SHOVEL, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.COBBLESTONE, BLOCKS.STICK, BLOCKS.STICK], out: { id: BLOCKS.STONE_SHOVEL, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.IRON_ORE, BLOCKS.STICK, BLOCKS.STICK], out: { id: BLOCKS.IRON_SHOVEL, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.DIAMOND_ORE, BLOCKS.STICK, BLOCKS.STICK], out: { id: BLOCKS.DIAMOND_SHOVEL, count: 1 } },
    { w: 1, h: 3, pattern: [BLOCKS.CRYSTAL, BLOCKS.STICK, BLOCKS.STICK], out: { id: BLOCKS.AETHER_SHOVEL, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, 0, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.WOOD_HOE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, 0, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.STONE_HOE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.IRON_ORE, BLOCKS.IRON_ORE, 0, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.IRON_HOE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.DIAMOND_ORE, BLOCKS.DIAMOND_ORE, 0, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.DIAMOND_HOE, count: 1 } },
    { w: 2, h: 3, pattern: [BLOCKS.CRYSTAL, BLOCKS.CRYSTAL, 0, BLOCKS.STICK, 0, BLOCKS.STICK], out: { id: BLOCKS.AETHER_HOE, count: 1 } }
];

// =========================================================================
