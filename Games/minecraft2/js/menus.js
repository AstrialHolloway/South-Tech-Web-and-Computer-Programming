// Creative, crafting, trading, HUD, and toast menus
Minecraft2Game.prototype.openCreativeModal = function () {
                document.getElementById('creative-modal').classList.remove('hidden');
                if (document.pointerLockElement) document.exitPointerLock();
                this.renderCreativeModal();
            
};

Minecraft2Game.prototype.closeCreativeModal = function () {
                document.getElementById('creative-modal').classList.add('hidden');
                if (this.heldCursorStack) {
                    this.heldCursorStack = null;
                    this.updateCursorHeldUI();
                }
                this.initHotbarUI();
                this.buildHeldItemMesh();
            
};

Minecraft2Game.prototype.renderCreativeModal = function () {
                const tabs = [
                    { id: 'all', label: '🌟 All' },
                    { id: 'blocks', label: '🧱 Blocks' },
                    { id: 'ores', label: '💎 Ores & Sky' },
                    { id: 'tools', label: '⚔️ Tools & Combat' },
                    { id: 'nature', label: '🌿 Nature & Food' }
                ];
                const tabsEl = document.getElementById('creative-tabs');
                tabsEl.innerHTML = '';
                tabs.forEach(t => {
                    const btn = document.createElement('button');
                    const active = this.creativeCategory === t.id;
                    btn.className = `px-2.5 py-1 rounded-lg text-xs font-bold border ${active ? 'bg-amber-500/30 border-amber-400 text-amber-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`;
                    btn.textContent = t.label;
                    btn.onclick = () => {
                        this.creativeCategory = t.id;
                        this.renderCreativeModal();
                    };
                    tabsEl.appendChild(btn);
                });

                const categoryMap = {
                    blocks: [BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.FARMLAND, BLOCKS.STONE, BLOCKS.DEEPSLATE, BLOCKS.COBBLESTONE, BLOCKS.SNOW, BLOCKS.PACKED_ICE, BLOCKS.EMERALD_BLOCK, BLOCKS.OBSIDIAN, BLOCKS.NETHERRACK, BLOCKS.SOUL_SAND, BLOCKS.OAK_LOG, BLOCKS.OAK_PLANKS, BLOCKS.GLASS, BLOCKS.CRAFTING, BLOCKS.PATH, BLOCKS.BEDROCK],
                    ores: [BLOCKS.STONE_IRON_ORE, BLOCKS.IRON_ORE, BLOCKS.STONE_DIAMOND_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.EMERALD_ORE, BLOCKS.EMERALD, BLOCKS.CRYSTAL, BLOCKS.DEEPSLATE_CRYSTAL_ORE, BLOCKS.NETHER_QUARTZ_ORE, BLOCKS.GOLD, BLOCKS.GLOWSTONE, BLOCKS.LANTERN, BLOCKS.TNT, BLOCKS.FLINT_AND_STEEL, BLOCKS.FLINT],
                    tools: [
                        BLOCKS.WOOD_SWORD, BLOCKS.STONE_SWORD, BLOCKS.IRON_SWORD, BLOCKS.DIAMOND_SWORD, BLOCKS.AETHER_SWORD,
                        BLOCKS.WOOD_PICKAXE, BLOCKS.STONE_PICKAXE, BLOCKS.IRON_PICKAXE, BLOCKS.DIAMOND_PICKAXE, BLOCKS.AETHER_PICKAXE,
                        BLOCKS.WOOD_AXE, BLOCKS.STONE_AXE, BLOCKS.IRON_AXE, BLOCKS.DIAMOND_AXE, BLOCKS.AETHER_AXE,
                        BLOCKS.WOOD_SHOVEL, BLOCKS.STONE_SHOVEL, BLOCKS.IRON_SHOVEL, BLOCKS.DIAMOND_SHOVEL, BLOCKS.AETHER_SHOVEL,
                        BLOCKS.WOOD_HOE, BLOCKS.STONE_HOE, BLOCKS.IRON_HOE, BLOCKS.DIAMOND_HOE, BLOCKS.AETHER_HOE,
                        BLOCKS.STICK
                    ],
                    nature: [BLOCKS.LEAVES, BLOCKS.CHERRY_LEAVES, BLOCKS.SAND, BLOCKS.GRAVEL, BLOCKS.WATER, BLOCKS.LAVA, BLOCKS.WHEAT, BLOCKS.APPLE, BLOCKS.BREAD]
                };

                const allItems = Object.keys(BLOCK_DEFS).map(Number).filter(id => id !== BLOCKS.AIR);
                const pool = this.creativeCategory === 'all' ? allItems : (categoryMap[this.creativeCategory] || allItems);
                const q = this.creativeSearchQuery.trim().toLowerCase();
                const filtered = q ? pool.filter(id => BLOCK_DEFS[id].name.toLowerCase().includes(q)) : pool;

                const catGrid = document.getElementById('creative-catalog-grid');
                catGrid.innerHTML = '';
                filtered.forEach(id => {
                    const def = BLOCK_DEFS[id];
                    const iconUrl = getItemIconURL(this.atlas, def);
                    const cell = document.createElement('div');
                    cell.className = 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800/90 border-2 border-slate-600 hover:border-amber-400 flex items-center justify-center cursor-pointer transition-transform hover:scale-105';
                    cell.title = `${def.name} (Click: Grab 64 | Shift-Click: Add to Hotbar)`;
                    cell.innerHTML = iconUrl ? `<img src="${iconUrl}" class="w-8 h-8 object-contain pointer-events-none" style="image-rendering: pixelated;" />` : '';
                    cell.onclick = (e) => {
                        const stackSize = def.tool && !def.food && id !== BLOCKS.STICK ? 1 : 64;
                        if (e.shiftKey) {
                            this.giveItem(id, stackSize);
                            this.renderCreativeModal();
                        } else {
                            this.heldCursorStack = { id, count: stackSize };
                            this.updateCursorHeldUI();
                        }
                    };
                    catGrid.appendChild(cell);
                });

                const hbGrid = document.getElementById('creative-hotbar-grid');
                hbGrid.innerHTML = '';
                for (let i = 0; i < 9; i++) {
                    const stack = this.player.inventory[i];
                    const slotEl = document.createElement('div');
                    slotEl.className = 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800/90 border-2 border-slate-600 hover:border-amber-400 flex items-center justify-center relative cursor-pointer select-none';
                    if (stack) {
                        const def = BLOCK_DEFS[stack.id];
                        const iconUrl = getItemIconURL(this.atlas, def);
                        slotEl.title = def?.name || '';
                        slotEl.innerHTML = `
                            ${iconUrl ? `<img src="${iconUrl}" class="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none" style="image-rendering: pixelated;" />` : ''}
                            ${stack.count > 1 ? `<span class="absolute bottom-0.5 right-1.5 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${stack.count}</span>` : ''}
                        `;
                    }

                    const placeOrPickupHotbar = (clientX, clientY) => {
                        if (this.heldCursorStack) {
                            this.player.inventory[i] = { ...this.heldCursorStack };
                            this.heldCursorStack = null;
                            this.updateCursorHeldUI();
                        } else if (stack) {
                            this.heldCursorStack = { ...stack };
                            this.player.inventory[i] = null;
                            if (typeof clientX === 'number') {
                                const cursorEl = document.getElementById('cursor-held-item');
                                if (cursorEl) {
                                    cursorEl.style.left = `${clientX}px`;
                                    cursorEl.style.top = `${clientY}px`;
                                }
                            }
                            this.updateCursorHeldUI();
                        }
                        this.initHotbarUI();
                        this.buildHeldItemMesh();
                        this.renderCreativeModal();
                    };

                    slotEl.onmousedown = (e) => {
                        e.preventDefault();
                        if (e.button === 2) {
                            this.player.inventory[i] = null;
                            this.initHotbarUI();
                            this.buildHeldItemMesh();
                            this.renderCreativeModal();
                        } else {
                            placeOrPickupHotbar(e.clientX, e.clientY);
                        }
                    };
                    slotEl.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        const t = e.touches[0];
                        placeOrPickupHotbar(t ? t.clientX : undefined, t ? t.clientY : undefined);
                    }, { passive: false });
                    slotEl.oncontextmenu = (e) => e.preventDefault();
                    hbGrid.appendChild(slotEl);
                }
            
};

Minecraft2Game.prototype.openCraftModal = function (gridSize = 2) {
                this.craftGridSize = gridSize;
                document.getElementById('craft-modal-title').textContent = gridSize === 3
                    ? '🔨 Crafting Table (3x3)'
                    : '🎒 Inventory & Crafting (2x2)';
                document.getElementById('craft-modal').classList.remove('hidden');
                if (document.pointerLockElement) document.exitPointerLock();
                this.renderInventoryAndCrafting();
            
};

Minecraft2Game.prototype.closeCraftModal = function () {
                if (this.heldCursorStack) {
                    this.giveItem(this.heldCursorStack.id, this.heldCursorStack.count);
                    this.heldCursorStack = null;
                    this.updateCursorHeldUI();
                }
                for (let i = 0; i < 9; i++) {
                    if (this.craftSlots[i]) {
                        this.giveItem(this.craftSlots[i].id, this.craftSlots[i].count);
                        this.craftSlots[i] = null;
                    }
                }
                document.getElementById('craft-modal').classList.add('hidden');
                this.initHotbarUI();
                this.buildHeldItemMesh();
            
};

Minecraft2Game.prototype.showToast = function (msg) {
                const el = document.getElementById('toast-banner');
                if (!el) return;
                el.textContent = msg;
                el.classList.remove('hidden');
                clearTimeout(this.toastTimeout);
                this.toastTimeout = setTimeout(() => el.classList.add('hidden'), 2600);
            
};

Minecraft2Game.prototype.updateStatusBars = function () {
                const heartsEl = document.getElementById('hud-hearts');
                const hungerEl = document.getElementById('hud-hunger');
                const xpLvlEl = document.getElementById('hud-xp-level');
                const xpFillEl = document.getElementById('hud-xp-fill');
                if (!heartsEl || !hungerEl) return;

                if (this.player.creative || this.player.spectator) {
                    heartsEl.innerHTML = '<span class="text-xs font-bold text-amber-300">∞ Invulnerable</span>';
                    hungerEl.innerHTML = '<span class="text-xs font-bold text-sky-300">✨ Flight Ready</span>';
                } else {
                    let hHtml = '';
                    for (let i = 0; i < 10; i++) {
                        const full = this.player.hp >= (i + 1) * 2;
                        const half = !full && this.player.hp >= i * 2 + 1;
                        hHtml += `<span class="text-[10px] sm:text-sm leading-none ${full ? 'text-rose-500' : (half ? 'text-rose-400 opacity-75' : 'text-slate-600')}">❤️</span>`;
                    }
                    heartsEl.innerHTML = hHtml;

                    let fHtml = '';
                    for (let i = 0; i < 10; i++) {
                        const full = this.player.hunger >= (i + 1) * 2;
                        fHtml += `<span class="text-[10px] sm:text-sm leading-none ${full ? 'text-amber-500' : 'text-slate-600 opacity-55'}">🍖</span>`;
                    }
                    hungerEl.innerHTML = fHtml;
                }

                if (xpLvlEl) xpLvlEl.textContent = String(this.player.xpLevel);
                if (xpFillEl) xpFillEl.style.width = `${Math.min(100, Math.round(this.player.xpProgress * 100))}%`;
                const emEl = document.getElementById('hud-emeralds');
                if (emEl) emEl.textContent = String(this.player.emeralds);
            
};

Minecraft2Game.prototype.openTradeModal = function (villager) {
                this.activeVillager = villager;
                if (document.pointerLockElement) document.exitPointerLock();
                document.getElementById('trade-villager-name').textContent = villager.name || 'Village Merchant';
                const offers = [
                    { cost: 1, item: BLOCKS.BREAD, count: 4, label: 'Golden Bread', color: '#d97706' },
                    { cost: 2, item: BLOCKS.LANTERN, count: 4, label: 'Starlight Lantern', color: '#fbbf24' },
                    { cost: 3, item: BLOCKS.IRON_PICKAXE, count: 1, label: 'Iron Pickaxe', color: '#f1f5f9' },
                    { cost: 4, item: BLOCKS.DIAMOND_ORE, count: 1, label: 'Diamond Ore', color: '#38bdf8' },
                    { cost: 6, item: BLOCKS.AETHER_SWORD, count: 1, label: 'Aether Sword', color: '#22d3ee' }
                ];
                let selectedOffer = offers[0];

                const refreshEmeraldDisplay = () => {
                    const total = this.getTotalEmeraldCount();
                    document.getElementById('trade-emerald-count').textContent =
                        `${total} Emerald${total === 1 ? '' : 's'}`;
                };
                const selectOffer = (offer, button) => {
                    selectedOffer = offer;
                    Array.from(list.children).forEach(el => {
                        el.classList.remove('bg-[#6b8e55]', 'border-[#ffffff]', 'text-white');
                        el.classList.add('bg-[#b8b8b8]', 'border-[#555555]', 'text-[#1f1f1f]');
                    });
                    button.classList.remove('bg-[#b8b8b8]', 'border-[#555555]', 'text-[#1f1f1f]');
                    button.classList.add('bg-[#6b8e55]', 'border-[#ffffff]', 'text-white');
                    document.getElementById('trade-cost-qty').textContent = String(offer.cost);
                    document.getElementById('trade-result-qty').textContent = String(offer.count);
                    document.getElementById('trade-result-name').textContent = offer.label;
                    document.getElementById('trade-result-swatch').style.backgroundColor = offer.color;
                };

                const list = document.getElementById('trade-offers');
                list.innerHTML = '';
                offers.forEach((offer, index) => {
                    const button = document.createElement('button');
                    button.className = 'w-full flex items-center justify-between px-2.5 py-2 bg-[#b8b8b8] hover:bg-[#c8c8c8] border-2 border-[#555555] text-xs font-extrabold text-[#1f1f1f] transition';
                    button.innerHTML = `
                        <span class="flex items-center gap-1.5">
                            <span class="text-emerald-600">💚</span><span>${offer.cost}</span>
                            <span class="opacity-70">➔</span>
                            <span class="inline-block w-3.5 h-3.5 rounded-sm border border-black/40" style="background:${offer.color}"></span>
                            <span>${offer.count}x ${offer.label}</span>
                        </span>`;
                    button.onclick = () => selectOffer(offer, button);
                    list.appendChild(button);
                    if (index === 0) selectOffer(offer, button);
                });

                document.getElementById('btn-execute-trade').onclick = () => {
                    if (this.getTotalEmeraldCount() < selectedOffer.cost) {
                        this.showToast(`❌ Need ${selectedOffer.cost} Emerald(s)!`);
                        return;
                    }
                    this.consumeEmeralds(selectedOffer.cost);
                    this.giveItem(selectedOffer.item, selectedOffer.count);
                    this.updateStatusBars();
                    refreshEmeraldDisplay();
                    this.showToast(`✅ Traded ${selectedOffer.cost} Emerald(s) for ${selectedOffer.count}x ${selectedOffer.label}!`);
                };

                refreshEmeraldDisplay();
                document.getElementById('trade-modal').classList.remove('hidden');
            
};

Minecraft2Game.prototype.closeTradeModal = function () {
                this.activeVillager = null;
                document.getElementById('trade-modal').classList.add('hidden');
            
};
