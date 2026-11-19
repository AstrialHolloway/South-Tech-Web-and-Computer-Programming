// 7-level cellular water/lava fluid simulation
VoxelWorld.prototype.updateLiquids = function (dt, playerX, playerZ, sfx) {
                if (this.liquidQueue.size === 0) return;

                this.waterTickAccum += dt;
                this.lavaTickAccum += dt;

                const waterInterval = 0.12;
                const lavaInterval = this.dimension === 'nether' ? 0.18 : 0.68;
                const stepWater = this.waterTickAccum >= waterInterval;
                const stepLava = this.lavaTickAccum >= lavaInterval;
                if (!stepWater && !stepLava) return;

                if (stepWater) this.waterTickAccum = 0;
                if (stepLava) this.lavaTickAccum = 0;

                const pending = Array.from(this.liquidQueue);
                this.liquidQueue.clear();

                const dirtyChunks = new Set();
                let playedFizz = false;
                let processed = 0;

                const markDirtyAt = (bx, bz) => {
                    const cx = Math.floor(bx / CHUNK_SIZE);
                    const cz = Math.floor(bz / CHUNK_SIZE);
                    const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                    const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                    const c = this.chunks.get(this.key(cx, cz));
                    if (c) { c.dirty = true; c.lightDirty = true; dirtyChunks.add(c); }
                    if (lx === 0) { const nc = this.chunks.get(this.key(cx - 1, cz)); if (nc) { nc.dirty = true; dirtyChunks.add(nc); } }
                    if (lx === CHUNK_SIZE - 1) { const nc = this.chunks.get(this.key(cx + 1, cz)); if (nc) { nc.dirty = true; dirtyChunks.add(nc); } }
                    if (lz === 0) { const nc = this.chunks.get(this.key(cx, cz - 1)); if (nc) { nc.dirty = true; dirtyChunks.add(nc); } }
                    if (lz === CHUNK_SIZE - 1) { const nc = this.chunks.get(this.key(cx, cz + 1)); if (nc) { nc.dirty = true; dirtyChunks.add(nc); } }
                };

                const writeLiquidCell = (bx, by, bz, blockId, lvl) => {
                    const cx = Math.floor(bx / CHUNK_SIZE);
                    const cz = Math.floor(bz / CHUNK_SIZE);
                    const c = this.chunks.get(this.key(cx, cz));
                    if (!c) return;
                    const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                    const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                    const cell = by * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
                    c.data[cell] = blockId;
                    c.liquidLevel[cell] = lvl;
                    markDirtyAt(bx, bz);
                };

                for (const packedKey of pending) {
                    const [x, y, z] = this.unpackCoord(packedKey);

                    if (Math.abs(x - playerX) > 48 || Math.abs(z - playerZ) > 48) continue;
                    const id = this.getBlock(x, y, z);
                    if (id !== BLOCKS.WATER && id !== BLOCKS.LAVA) continue;

                    if ((id === BLOCKS.WATER && !stepWater) || (id === BLOCKS.LAVA && !stepLava)) {
                        if (this.liquidQueue.size < 4096) this.liquidQueue.add(packedKey);
                        continue;
                    }

                    if (processed++ > 160) {
                        if (this.liquidQueue.size < 4096) this.liquidQueue.add(packedKey);
                        continue;
                    }

                    if (id === BLOCKS.WATER && this.dimension === 'nether') {
                        writeLiquidCell(x, y, z, BLOCKS.AIR, 0);
                        if (!playedFizz && sfx) { sfx.playFizz(); playedFizz = true; }
                        continue;
                    }

                    let level = this.getLiquidLevel(x, y, z);
                    if (level <= 0 || level > 7) level = 7;
                    const oppositeLiquid = id === BLOCKS.WATER ? BLOCKS.LAVA : BLOCKS.WATER;
                    const horiz = [[1,0],[-1,0],[0,1],[0,-1]];

                    if (level < 7) {
                        const aboveId = this.getBlock(x, y + 1, z);
                        let maxSupported = 0;
                        if (aboveId === id) {
                            maxSupported = 6;
                        }
                        for (const [dx, dz] of horiz) {
                            if (this.getBlock(x + dx, y, z + dz) === id) {
                                const nLvl = this.getLiquidLevel(x + dx, y, z + dz) || 7;
                                if (nLvl - 1 > maxSupported) maxSupported = nLvl - 1;
                            }
                        }

                        if (maxSupported <= 0) {
                            writeLiquidCell(x, y, z, BLOCKS.AIR, 0);
                            this.wakeNeighborLiquids(x, y, z);
                            continue;
                        } else if (maxSupported !== level) {
                            level = maxSupported;
                            writeLiquidCell(x, y, z, id, level);
                            this.wakeNeighborLiquids(x, y, z);
                        }
                    }

                    const belowId = this.getBlock(x, y - 1, z);
                    const canFlowDown = y > 1 && (
                        belowId === oppositeLiquid ||
                        this.canLiquidFlowInto(belowId) ||
                        (belowId === id && (this.getLiquidLevel(x, y - 1, z) || 7) < 6)
                    );

                    if (canFlowDown) {
                        if (belowId === oppositeLiquid) {
                            const bLvl = this.getLiquidLevel(x, y - 1, z) || 7;
                            writeLiquidCell(x, y - 1, z, bLvl === 7 ? BLOCKS.OBSIDIAN : BLOCKS.COBBLESTONE, 0);
                            if (!playedFizz && sfx) { sfx.playFizz(); playedFizz = true; }
                        } else {
                            writeLiquidCell(x, y - 1, z, id, 6);
                            this.scheduleLiquidUpdate(x, y - 1, z);
                        }
                        if (level < 7) continue;
                    }

                    const isGrounded = y <= 1 || (!this.canLiquidFlowInto(belowId) && belowId !== id);
                    if (level > 1 && (level === 7 || isGrounded)) {
                        const nextLevel = level - 1;
                        for (const [dx, dz] of horiz) {
                            const nx = x + dx;
                            const nz = z + dz;
                            const nId = this.getBlock(nx, y, nz);
                            if (nId === oppositeLiquid) {
                                const nLvl = this.getLiquidLevel(nx, y, nz) || 7;
                                writeLiquidCell(nx, y, nz, nLvl === 7 ? BLOCKS.OBSIDIAN : BLOCKS.COBBLESTONE, 0);
                                if (!playedFizz && sfx) { sfx.playFizz(); playedFizz = true; }
                            } else if (this.canLiquidFlowInto(nId)) {
                                writeLiquidCell(nx, y, nz, id, nextLevel);
                                this.scheduleLiquidUpdate(nx, y, nz);
                            } else if (nId === id) {
                                const curNLvl = this.getLiquidLevel(nx, y, nz) || 7;
                                if (curNLvl < nextLevel) {
                                    writeLiquidCell(nx, y, nz, id, nextLevel);
                                    this.scheduleLiquidUpdate(nx, y, nz);
                                }
                            }
                        }
                    }
                }

                for (const c of dirtyChunks) {
                    if (c.lightDirty) this.computeChunkLight(c);
                    this.buildChunkMesh(c);
                }
            
};
