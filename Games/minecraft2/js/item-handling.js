// Inventory, hotbar, XP, and crafting-grid handling
Minecraft2Game.prototype.giveItem = function (id, count = 1) {
                if (!id || count <= 0) return;
                const def = BLOCK_DEFS[id];
                const maxStack = (def?.tool && !def?.food && id !== BLOCKS.STICK) ? 1 : 64;
                for (let i = 0; i < 36 && count > 0; i++) {
                    const s = this.player.inventory[i];
                    if (s && s.id === id && s.count < maxStack) {
                        const add = Math.min(maxStack - s.count, count);
                        s.count += add;
                        count -= add;
                    }
                }
                for (let i = 0; i < 36 && count > 0; i++) {
                    if (!this.player.inventory[i]) {
                        const add = Math.min(maxStack, count);
                        this.player.inventory[i] = { id, count: add };
                        count -= add;
                    }
                }
                this.initHotbarUI();
                this.buildHeldItemMesh();
            
};

Minecraft2Game.prototype.addXP = function (amount) {
                this.player.xpProgress += amount / (20 + this.player.xpLevel * 10);
                while (this.player.xpProgress >= 1) {
                    this.player.xpProgress -= 1;
                    this.player.xpLevel += 1;
                    this.showToast(`✨ Level Up! You reached Level ${this.player.xpLevel}!`);
                }
                this.updateStatusBars();
            
};

Minecraft2Game.prototype.initHotbarUI = function () {
                const hb = document.getElementById('hotbar');
                if (!hb) return;
                hb.innerHTML = '';
                for (let i = 0; i < 9; i++) {
                    const stack = this.player.inventory[i];
                    const slot = document.createElement('div');
                    slot.className = `hotbar-slot flex items-center justify-center ${i === this.player.slot ? 'active' : ''}`;
                    slot.innerHTML = `<span class="absolute top-0.5 left-1.5 text-[10px] font-bold text-slate-400">${i + 1}</span>`;
                    if (stack) {
                        const def = BLOCK_DEFS[stack.id];
                        const iconUrl = getItemIconURL(this.atlas, def);
                        if (iconUrl) {
                            slot.innerHTML += `<img src="${iconUrl}" class="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none" style="image-rendering: pixelated;" />`;
                        }
                        if (stack.count > 1) {
                            slot.innerHTML += `<span class="absolute bottom-0.5 right-1.5 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${stack.count}</span>`;
                        }
                    }
                    slot.onclick = () => this.selectSlot(i);
                    hb.appendChild(slot);
                }
                const cur = this.player.inventory[this.player.slot];
                const nameEl = document.getElementById('held-item-name');
                if (nameEl) nameEl.textContent = cur ? (BLOCK_DEFS[cur.id]?.name || 'Item') : 'Empty Hand';
            
};

Minecraft2Game.prototype.updateCursorHeldUI = function () {
                const cursorEl = document.getElementById('cursor-held-item');
                if (!cursorEl) return;
                if (!this.heldCursorStack) {
                    cursorEl.classList.add('hidden');
                    cursorEl.innerHTML = '';
                    return;
                }
                const def = BLOCK_DEFS[this.heldCursorStack.id];
                const iconUrl = getItemIconURL(this.atlas, def);
                cursorEl.innerHTML = `
                    <div class="relative w-10 h-10 flex items-center justify-center">
                        ${iconUrl ? `<img src="${iconUrl}" class="w-8 h-8 object-contain" style="image-rendering: pixelated;" />` : ''}
                        ${this.heldCursorStack.count > 1 ? `<span class="absolute bottom-0 right-0.5 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${this.heldCursorStack.count}</span>` : ''}
                    </div>
                `;
                cursorEl.classList.remove('hidden');
            
};

Minecraft2Game.prototype.recalculateLeftSplitDistribution = function () {
                if (!this.isLeftSplitDragging || this.splitVisitedSlots.size === 0) return;
                const countSlots = this.splitVisitedSlots.size;
                const perSlot = Math.floor(this.splitOriginalCount / countSlots);
                if (perSlot < 1) return;

                let used = 0;
                for (const [key, entry] of this.splitVisitedSlots.entries()) {
                    const [area, idxStr] = key.split(':');
                    const idx = Number(idxStr);
                    const targetArr = area === 'inv' ? this.player.inventory : this.craftSlots;
                    const newCount = entry.baseCount + perSlot;
                    targetArr[idx] = { id: entry.id, count: newCount };
                    used += perSlot;
                }
                const leftOver = this.splitOriginalCount - used;
                if (leftOver > 0 && this.heldCursorStack) {
                    this.heldCursorStack.count = leftOver;
                } else {
                    this.heldCursorStack = null;
                }
                this.updateCursorHeldUI();
                this.renderInventoryAndCrafting();
            
};

Minecraft2Game.prototype.evaluateCraftingMatch = function () {
                const size = this.craftGridSize;
                let minR = 3, maxR = -1, minC = 3, maxC = -1;
                for (let r = 0; r < size; r++) {
                    for (let c = 0; c < size; c++) {
                        const item = this.craftSlots[r * 3 + c];
                        if (item && item.count > 0) {
                            minR = Math.min(minR, r);
                            maxR = Math.max(maxR, r);
                            minC = Math.min(minC, c);
                            maxC = Math.max(maxC, c);
                        }
                    }
                }
                if (maxR < minR) return null;
                const w = maxC - minC + 1;
                const h = maxR - minR + 1;
                const pat = [];
                for (let r = minR; r <= maxR; r++) {
                    for (let c = minC; c <= maxC; c++) {
                        const item = this.craftSlots[r * 3 + c];
                        pat.push(item ? item.id : 0);
                    }
                }
                for (const rec of GRID_RECIPES) {
                    if (rec.w === w && rec.h === h && rec.pattern.length === pat.length) {
                        let match = true;
                        for (let i = 0; i < pat.length; i++) {
                            if (rec.pattern[i] !== pat[i]) { match = false; break; }
                        }
                        if (match) return rec;
                    }
                }
                return null;
            
};

Minecraft2Game.prototype.renderInventoryAndCrafting = function () {
                const size = this.craftGridSize;
                const gridEl = document.getElementById('craft-grid');
                gridEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
                gridEl.innerHTML = '';

                const buildSlotElement = (area, idx, stack) => {
                    const slotEl = document.createElement('div');
                    slotEl.className = 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800/90 border-2 border-slate-600 hover:border-sky-400 flex items-center justify-center relative cursor-pointer select-none';
                    if (stack) {
                        const def = BLOCK_DEFS[stack.id];
                        const iconUrl = getItemIconURL(this.atlas, def);
                        slotEl.title = def?.name || '';
                        slotEl.innerHTML = `
                            ${iconUrl ? `<img src="${iconUrl}" class="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none" style="image-rendering: pixelated;" />` : ''}
                            ${stack.count > 1 ? `<span class="absolute bottom-0.5 right-1.5 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${stack.count}</span>` : ''}
                        `;
                    }

                    const targetArr = area === 'inv' ? this.player.inventory : this.craftSlots;

                    const handlePrimaryPress = (clientX, clientY) => {
                        const cur = targetArr[idx];
                        if (!this.heldCursorStack && cur) {
                            this.heldCursorStack = { ...cur };
                            targetArr[idx] = null;
                        } else if (this.heldCursorStack) {
                            if (!cur || cur.id === this.heldCursorStack.id) {
                                this.isLeftSplitDragging = true;
                                this.splitVisitedSlots.clear();
                                this.splitOriginalCount = this.heldCursorStack.count;
                                this.splitVisitedSlots.set(`${area}:${idx}`, {
                                    id: this.heldCursorStack.id,
                                    baseCount: cur ? cur.count : 0
                                });
                                this.recalculateLeftSplitDistribution();
                                if (typeof clientX === 'number') {
                                    const cursorEl = document.getElementById('cursor-held-item');
                                    if (cursorEl) {
                                        cursorEl.style.left = `${clientX}px`;
                                        cursorEl.style.top = `${clientY}px`;
                                    }
                                }
                                return;
                            } else {
                                targetArr[idx] = { ...this.heldCursorStack };
                                this.heldCursorStack = { ...cur };
                            }
                        }
                        if (typeof clientX === 'number') {
                            const cursorEl = document.getElementById('cursor-held-item');
                            if (cursorEl) {
                                cursorEl.style.left = `${clientX}px`;
                                cursorEl.style.top = `${clientY}px`;
                            }
                        }
                        this.updateCursorHeldUI();
                        this.renderInventoryAndCrafting();
                    };

                    const handleSweepOver = () => {
                        if (!this.isLeftSplitDragging || !this.heldCursorStack) return;
                        const key = `${area}:${idx}`;
                        if (this.splitVisitedSlots.has(key)) return;
                        const cur = targetArr[idx];
                        if (!cur || cur.id === this.heldCursorStack.id) {
                            if (this.splitOriginalCount >= this.splitVisitedSlots.size + 1) {
                                this.splitVisitedSlots.set(key, {
                                    id: this.heldCursorStack.id,
                                    baseCount: cur ? cur.count : 0
                                });
                                this.recalculateLeftSplitDistribution();
                            }
                        }
                    };

                    slotEl.dataset.slotArea = area;
                    slotEl.dataset.slotIdx = String(idx);
                    slotEl._handleSweepOver = handleSweepOver;

                    slotEl.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const cur = targetArr[idx];
                        if (e.button === 0) {
                            handlePrimaryPress(e.clientX, e.clientY);
                        } else if (e.button === 2) {
                            if (!this.heldCursorStack && cur) {
                                const half = Math.ceil(cur.count / 2);
                                this.heldCursorStack = { id: cur.id, count: half };
                                cur.count -= half;
                                if (cur.count <= 0) targetArr[idx] = null;
                            } else if (this.heldCursorStack) {
                                if (!cur) {
                                    targetArr[idx] = { id: this.heldCursorStack.id, count: 1 };
                                    this.heldCursorStack.count -= 1;
                                    if (this.heldCursorStack.count <= 0) this.heldCursorStack = null;
                                } else if (cur.id === this.heldCursorStack.id) {
                                    cur.count += 1;
                                    this.heldCursorStack.count -= 1;
                                    if (this.heldCursorStack.count <= 0) this.heldCursorStack = null;
                                }
                            }
                            this.updateCursorHeldUI();
                            this.renderInventoryAndCrafting();
                        }
                    });

                    slotEl.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        const t = e.touches[0];
                        handlePrimaryPress(t ? t.clientX : undefined, t ? t.clientY : undefined);
                    }, { passive: false });

                    slotEl.addEventListener('mouseenter', handleSweepOver);
                    slotEl.addEventListener('contextmenu', (e) => e.preventDefault());
                    return slotEl;
                };

                for (let r = 0; r < size; r++) {
                    for (let c = 0; c < size; c++) {
                        const slotIdx = r * 3 + c;
                        gridEl.appendChild(buildSlotElement('craft', slotIdx, this.craftSlots[slotIdx]));
                    }
                }

                const matched = this.evaluateCraftingMatch();
                const outEl = document.getElementById('craft-output-slot');
                outEl.innerHTML = '';
                if (matched) {
                    const outDef = BLOCK_DEFS[matched.out.id];
                    const iconUrl = getItemIconURL(this.atlas, outDef);
                    outEl.title = `Craft ${outDef?.name || ''} (x${matched.out.count})`;
                    outEl.innerHTML = `
                        ${iconUrl ? `<img src="${iconUrl}" class="w-8 h-8 object-contain pointer-events-none" style="image-rendering: pixelated;" />` : ''}
                        ${matched.out.count > 1 ? `<span class="absolute bottom-0.5 right-1.5 text-[11px] font-extrabold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">${matched.out.count}</span>` : ''}
                    `;
                    outEl.onclick = () => {
                        const currentMatch = this.evaluateCraftingMatch();
                        if (!currentMatch) return;
                        for (let i = 0; i < 9; i++) {
                            if (this.craftSlots[i]) {
                                this.craftSlots[i].count -= 1;
                                if (this.craftSlots[i].count <= 0) this.craftSlots[i] = null;
                            }
                        }
                        if (!this.heldCursorStack) {
                            this.heldCursorStack = { id: currentMatch.out.id, count: currentMatch.out.count };
                        } else if (this.heldCursorStack.id === currentMatch.out.id) {
                            this.heldCursorStack.count += currentMatch.out.count;
                        } else {
                            this.giveItem(currentMatch.out.id, currentMatch.out.count);
                        }
                        this.addXP(8);
                        this.updateCursorHeldUI();
                        this.renderInventoryAndCrafting();
                    };
                } else {
                    outEl.onclick = null;
                    outEl.title = 'Place ingredients in grid to craft';
                }

                const bpEl = document.getElementById('inv-backpack-grid');
                bpEl.innerHTML = '';
                for (let i = 9; i < 36; i++) {
                    bpEl.appendChild(buildSlotElement('inv', i, this.player.inventory[i]));
                }

                const hbEl = document.getElementById('inv-hotbar-grid');
                hbEl.innerHTML = '';
                for (let i = 0; i < 9; i++) {
                    hbEl.appendChild(buildSlotElement('inv', i, this.player.inventory[i]));
                }
            
};
