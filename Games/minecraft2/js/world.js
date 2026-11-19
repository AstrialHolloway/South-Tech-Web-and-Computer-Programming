// 3. VOXEL WORLD, LIGHTING & CHUNK MESHER
// =========================================================================
class VoxelWorld {
    constructor(scene, noise, atlas) {
        this.scene = scene;
        this.noise = noise;
        this.atlas = atlas;
        this.chunks = new Map();
        this.chunkPool = [];
        this.villages = [];
        this.daylightFactor = 1.0;
        this.dimension = 'overworld';
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this.liquidQueue = new Set();
        this.waterTickAccum = 0;
        this.lavaTickAccum = 0;

        this.opaqueMat = new THREE.MeshLambertMaterial({
            map: atlas.tex,
            vertexColors: true
        });
        this.transMat = new THREE.MeshLambertMaterial({
            map: atlas.tex,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
    }

    key(cx, cz) { return `${cx},${cz}`; }

    packCoord(x, y, z) {
        return ((x + 32768) & 0xFFFF) * 4294967296 + ((z + 32768) & 0xFFFF) * 65536 + (y & 0xFF);
    }

    unpackCoord(packed) {
        const y = packed & 0xFF;
        const z = ((Math.floor(packed / 65536)) & 0xFFFF) - 32768;
        const x = ((Math.floor(packed / 4294967296)) & 0xFFFF) - 32768;
        return [x, y, z];
    }

    // Frustum + distance culling for chunks each frame
    updateVisibilityAndUnload(camera, playerX, playerZ) {
        camera.updateMatrixWorld();
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        const pcx = Math.floor(playerX / CHUNK_SIZE);
        const pcz = Math.floor(playerZ / CHUNK_SIZE);
        const unloadDist = RENDER_DIST + 2;

        for (const [k, chunk] of this.chunks.entries()) {
            const dx = Math.abs(chunk.cx - pcx);
            const dz = Math.abs(chunk.cz - pcz);
            if (dx > unloadDist || dz > unloadDist) {
                if (chunk.opaqueMesh) {
                    this.scene.remove(chunk.opaqueMesh);
                    chunk.opaqueMesh.geometry.dispose();
                    chunk.opaqueMesh = null;
                }
                if (chunk.transMesh) {
                    this.scene.remove(chunk.transMesh);
                    chunk.transMesh.geometry.dispose();
                    chunk.transMesh = null;
                }
                if (this.chunkPool.length < 48) {
                    this.chunkPool.push({
                        data: chunk.data,
                        skyLight: chunk.skyLight,
                        blockLight: chunk.blockLight,
                        liquidLevel: chunk.liquidLevel
                    });
                }
                this.chunks.delete(k);
                continue;
            }

            const visible = dx <= RENDER_DIST && dz <= RENDER_DIST && this.frustum.intersectsBox(chunk.boundingBox);
            if (chunk.opaqueMesh) chunk.opaqueMesh.visible = visible;
            if (chunk.transMesh) chunk.transMesh.visible = visible;
        }
    }

    hash2(wx, wz) {
        const value = Math.sin(wx * 127.1 + wz * 311.7 + this.noise.seed * 0.01) * 43758.5453123;
        return value - Math.floor(value);
    }

    getBiome(wx, wz) {
        if (this.dimension === 'nether') return '🔥 Crimson Nether Wastes';
        const temp = this.noise.noise2D(wx * 0.0075, wz * 0.0075);
        const humid = this.noise.noise2D(wx * 0.0075 + 90, wz * 0.0075 - 40);
        const distFromSpawn = Math.hypot(wx - 6, wz - 6);
        const distFromVillage = Math.hypot(wx - 28, wz - 24);
        const distToVistaRange = Math.hypot(wx + 76, wz + 72);
        if (distFromSpawn > 28 && distFromVillage > 36 && (temp < -0.33 || distToVistaRange < 24)) return '🏔️ Jagged Snow Mountains';
        if (temp > 0.24) return '🏜️ Solar Desert Dunes';
        if (humid > 0.18) return '🌸 Cherry Blossom Grove';
        return '🌿 Lush Sky Meadow';
    }

    getTerrainHeight(wx, wz) {
        if (this.dimension === 'nether') {
            const n = this.noise.fbm(wx * 0.025, wz * 0.025, 3);
            return Math.max(34, Math.min(54, Math.floor(42 + n * 12)));
        }
        const base = this.noise.fbm(wx * 0.014, wz * 0.014, 3);
        const detail = this.noise.noise2D(wx * 0.055, wz * 0.055) * 0.25;
        let h = 57 + (base + detail) * 10;
        const distFromSpawn = Math.hypot(wx - 6, wz - 6);
        const distFromVillage = Math.hypot(wx - 28, wz - 24);
        const temp = this.noise.noise2D(wx * 0.0075, wz * 0.0075);
        const distToVistaRange = Math.hypot(wx + 76, wz + 72);
        const climateFactor = Math.max(0, (-0.33 - temp) / 0.22);
        const vistaFactor = Math.max(0, 1 - distToVistaRange / 26);
        const mountainFactor = (distFromSpawn > 24 && distFromVillage > 32)
            ? Math.min(1.25, Math.max(climateFactor, vistaFactor))
            : 0;
        if (mountainFactor > 0) {
            const ridge1 = 1 - Math.abs(this.noise.noise2D(wx * 0.022 + 17, wz * 0.022 - 29)) * 2.1;
            const ridge2 = Math.abs(this.noise.fbm(wx * 0.045 - 60, wz * 0.045 + 42, 3));
            h += Math.pow(mountainFactor, 1.15) * (15 + Math.max(0, ridge1) * 14 + ridge2 * 9);
        }
        return Math.max(38, Math.min(89, Math.floor(h)));
    }

    ensureChunk(cx, cz) {
        const k = this.key(cx, cz);
        if (this.chunks.has(k)) return this.chunks.get(k);

        const baseX = cx * CHUNK_SIZE;
        const baseZ = cz * CHUNK_SIZE;
        const pooled = this.chunkPool.pop();
        const chunk = pooled ? {
            cx,
            cz,
            data: pooled.data,
            liquidLevel: pooled.liquidLevel,
            skyLight: pooled.skyLight,
            blockLight: pooled.blockLight,
            boundingBox: new THREE.Box3(
                new THREE.Vector3(baseX, 0, baseZ),
                new THREE.Vector3(baseX + CHUNK_SIZE, CHUNK_HEIGHT, baseZ + CHUNK_SIZE)
            ),
            opaqueMesh: null,
            transMesh: null,
            dirty: true,
            lightDirty: true
        } : {
            cx,
            cz,
            data: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
            liquidLevel: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
            skyLight: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
            blockLight: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
            boundingBox: new THREE.Box3(
                new THREE.Vector3(baseX, 0, baseZ),
                new THREE.Vector3(baseX + CHUNK_SIZE, CHUNK_HEIGHT, baseZ + CHUNK_SIZE)
            ),
            opaqueMesh: null,
            transMesh: null,
            dirty: true,
            lightDirty: true
        };

        if (pooled) {
            chunk.data.fill(0);
            chunk.liquidLevel.fill(0);
            chunk.skyLight.fill(0);
            chunk.blockLight.fill(0);
        }

        this.generateChunkTerrain(chunk);
        this.chunks.set(k, chunk);
        return chunk;
    }

    generateChunkTerrain(chunk) {
        const { cx, cz, data, liquidLevel } = chunk;
        const baseX = cx * CHUNK_SIZE;
        const baseZ = cz * CHUNK_SIZE;
        const idx = (lx, y, lz) => y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;

        if (this.dimension === 'nether') {
            const NETHER_LAVA_LEVEL = 37;
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    const wx = baseX + lx;
                    const wz = baseZ + lz;
                    const floorH = this.getTerrainHeight(wx, wz);
                    const ceilH = Math.floor(72 + this.noise.noise2D(wx * 0.03 + 50, wz * 0.03 - 30) * 9);
                    const soulPatch = this.noise.noise2D(wx * 0.05 - 20, wz * 0.05 + 40) > 0.22;

                    for (let y = 0; y < CHUNK_HEIGHT; y++) {
                        let block = BLOCKS.AIR;
                        let liq = 0;
                        if (y <= 2 || y >= CHUNK_HEIGHT - 3) {
                            block = BLOCKS.BEDROCK;
                        } else if (y <= floorH) {
                            const qNoise = this.noise.noise2D(wx * 0.22 + y * 0.35, wz * 0.22 - y * 0.31);
                            if (y === floorH && soulPatch && floorH <= NETHER_LAVA_LEVEL + 2) {
                                block = BLOCKS.SOUL_SAND;
                            } else if (qNoise > 0.34) {
                                block = BLOCKS.NETHER_QUARTZ_ORE;
                            } else {
                                block = BLOCKS.NETHERRACK;
                            }
                        } else if (y <= NETHER_LAVA_LEVEL) {
                            block = BLOCKS.LAVA;
                            liq = 7;
                        } else if (y >= ceilH) {
                            const glowNoise = this.noise.noise2D(wx * 0.16 + y * 0.25, wz * 0.16 - y * 0.25);
                            if (y <= ceilH + 2 && glowNoise > 0.31) {
                                block = BLOCKS.GLOWSTONE;
                            } else {
                                block = BLOCKS.NETHERRACK;
                            }
                        }
                        const cell = idx(lx, y, lz);
                        data[cell] = block;
                        liquidLevel[cell] = liq;
                    }
                }
            }
            return;
        }

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = baseX + lx;
                const wz = baseZ + lz;
                const biome = this.getBiome(wx, wz);
                const isMountain = biome.includes('Mountain');
                const h = this.getTerrainHeight(wx, wz);
                const gravelPatch = this.noise.noise2D(wx * 0.07 + 33, wz * 0.07 - 19) > 0.24;
                // Regional cave density gate so caves are moderately common rather than everywhere
                const caveRegion = this.noise.noise2D(wx * 0.018 - 110, wz * 0.018 + 85);
                // Large deep lava pool basin noise near bottom of the Overworld
                const deepLavaBasin = this.noise.fbm(wx * 0.032 + 140, wz * 0.032 - 95, 2);

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let block = BLOCKS.AIR;
                    let liq = 0;
                    if (y === 0 || (y <= 2 && Math.sin(wx * 31.7 + wz * 17.3 + y * 53.1) > 0.15)) {
                        block = BLOCKS.BEDROCK;
                    } else if (y < h - 3) {
                        const deepslateTop = Math.max(22, h - 44);
                        const cavePrimary = Math.abs(this.noise.noise2D(wx * 0.052 + y * 0.085, wz * 0.052 - y * 0.085));
                        const caveTunnel = Math.abs(this.noise.noise2D(wx * 0.044 - y * 0.072 + 75, wz * 0.044 + y * 0.08 - 55));

                        // Large caverns only form near the deepslate level (y <= 26); upper caves stay narrower & less common
                        const isDeepZone = y <= 26;
                        const isLargeDeepCavern = isDeepZone && y > 3 && (cavePrimary < 0.078 || (cavePrimary < 0.135 && caveTunnel < 0.11));
                        const isUpperCave = !isDeepZone && y < h - 6 && caveRegion > 0.04 && (cavePrimary < 0.036 && caveTunnel < 0.058);
                        // Large lava pools near the bottom of the Overworld (y = 4..13)
                        const isDeepLavaLake = y >= 4 && y <= 13 && deepLavaBasin > 0.14;
                        const isCavern = isLargeDeepCavern || isUpperCave || isDeepLavaLake;

                        const oreNoise = this.noise.noise2D(wx * 0.23 + y * 0.41, wz * 0.23 - y * 0.37);
                        const oreGrain = Math.sin(wx * 12.9898 + y * 78.233 + wz * 37.719 + this.noise.seed * 0.01) * 43758.5453;
                        const grainFrac = oreGrain - Math.floor(oreGrain);

                        if (isCavern) {
                            if (y <= 10 && (isDeepLavaLake || isLargeDeepCavern)) {
                                block = BLOCKS.LAVA;
                                liq = 7;
                            } else {
                                block = BLOCKS.AIR;
                            }
                        } else if (y <= deepslateTop) {
                            if (y <= 11 && oreNoise > 0.36 && grainFrac > 0.56) {
                                block = BLOCKS.DEEPSLATE_CRYSTAL_ORE;
                            } else if (y <= 18 && oreNoise < -0.34 && grainFrac > 0.52) {
                                block = BLOCKS.DIAMOND_ORE;
                            } else if (oreNoise > 0.34 && grainFrac > 0.52) {
                                block = BLOCKS.IRON_ORE;
                            } else {
                                block = BLOCKS.DEEPSLATE;
                            }
                        } else {
                            if (isMountain && y >= 40 && oreNoise > 0.32 && grainFrac > 0.52) {
                                block = BLOCKS.EMERALD_ORE;
                            } else if (y <= deepslateTop + 6 && oreNoise < -0.39 && grainFrac > 0.68) {
                                block = BLOCKS.STONE_DIAMOND_ORE;
                            } else if (oreNoise > 0.33 && grainFrac > 0.48) {
                                block = BLOCKS.STONE_IRON_ORE;
                            } else if (oreNoise < -0.35 && grainFrac > 0.55) {
                                block = BLOCKS.GRAVEL;
                            } else {
                                block = BLOCKS.STONE;
                            }
                        }
                    } else if (y < h) {
                        if (biome.includes('Desert')) {
                            block = BLOCKS.SAND;
                        } else if (isMountain && h >= 63) {
                            block = (y === h - 1 && h >= 68) ? BLOCKS.SNOW : BLOCKS.STONE;
                        } else {
                            block = (gravelPatch && h <= WATER_LEVEL + 2) ? BLOCKS.GRAVEL : BLOCKS.DIRT;
                        }
                    } else if (y === h) {
                        if (h <= WATER_LEVEL + 1) {
                            block = gravelPatch ? BLOCKS.GRAVEL : BLOCKS.SAND;
                        } else if (biome.includes('Desert')) {
                            block = BLOCKS.SAND;
                        } else if (isMountain && h >= 66) {
                            block = BLOCKS.SNOW;
                        } else if (isMountain && h >= 63) {
                            block = gravelPatch ? BLOCKS.PACKED_ICE : BLOCKS.STONE;
                        } else {
                            block = BLOCKS.GRASS;
                        }
                    } else if (y <= WATER_LEVEL) {
                        block = BLOCKS.WATER;
                        liq = 7;
                    }

                    const nearMountain = isMountain || h >= 62 ||
                        this.getBiome(wx + 14, wz).includes('Mountain') ||
                        this.getBiome(wx - 14, wz).includes('Mountain') ||
                        this.getBiome(wx, wz + 14).includes('Mountain') ||
                        this.getBiome(wx, wz - 14).includes('Mountain');
                    const skyVal = this.noise.noise2D(wx * 0.032 + 210, wz * 0.032 - 140);
                    if (!nearMountain && skyVal > 0.27) {
                        const thickness = Math.floor((skyVal - 0.27) * 26);
                        const islandTop = 98;
                        if (y === islandTop) { block = BLOCKS.GRASS; liq = 0; }
                        else if (y >= islandTop - 2 && y < islandTop) { block = BLOCKS.DIRT; liq = 0; }
                        else if (y >= islandTop - 2 - thickness && y < islandTop - 2) {
                            block = (y === islandTop - 2 - thickness && skyVal > 0.34) ? BLOCKS.CRYSTAL : BLOCKS.STONE;
                            liq = 0;
                        }
                    }

                    const cell = idx(lx, y, lz);
                    data[cell] = block;
                    liquidLevel[cell] = liq;
                }


            }
        }

        // Complete symmetric trees: the canopy is centered on the exact integer trunk
        // position and can extend across chunk boundaries.
        if (this.dimension === 'overworld') {
            const neighborRemesh = new Set();

            const putWorldBlock = (wx, wy, wz, block) => {
                if (wy <= 0 || wy >= CHUNK_HEIGHT) return;
                const targetCx = Math.floor(wx / CHUNK_SIZE);
                const targetCz = Math.floor(wz / CHUNK_SIZE);
                const targetLx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                const targetLz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

                if (targetCx === cx && targetCz === cz) {
                    const targetIdx = wy * CHUNK_SIZE * CHUNK_SIZE + targetLz * CHUNK_SIZE + targetLx;
                    if (data[targetIdx] === BLOCKS.AIR) data[targetIdx] = block;
                    return;
                }

                const targetChunk = this.chunks.get(this.key(targetCx, targetCz));
                if (targetChunk) {
                    const targetIdx = wy * CHUNK_SIZE * CHUNK_SIZE + targetLz * CHUNK_SIZE + targetLx;
                    if (targetChunk.data[targetIdx] === BLOCKS.AIR) {
                        targetChunk.data[targetIdx] = block;
                        targetChunk.dirty = true;
                        targetChunk.lightDirty = true;
                        neighborRemesh.add(this.key(targetCx, targetCz));
                    }
                }
            };

            for (let lx = -3; lx < CHUNK_SIZE + 3; lx++) {
                for (let lz = -3; lz < CHUNK_SIZE + 3; lz++) {
                    const wx = baseX + lx;
                    const wz = baseZ + lz;
                    const h = this.getTerrainHeight(wx, wz);
                    const biome = this.getBiome(wx, wz);
                    if (biome.includes('Desert') || h <= WATER_LEVEL + 1) continue;

                    const roll = this.hash2(wx * 1.73, wz * 2.31);
                    if (roll <= 0.974) continue;

                    const leafType = biome.includes('Cherry') ? BLOCKS.CHERRY_LEAVES : BLOCKS.LEAVES;
                    const trunkH = 5 + (Math.floor(roll * 100) % 2);

                    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                        if (data[idx(lx, h, lz)] !== BLOCKS.GRASS) continue;
                        for (let ty = 1; ty <= trunkH; ty++) {
                            if (h + ty < CHUNK_HEIGHT - 4) {
                                data[idx(lx, h + ty, lz)] = BLOCKS.OAK_LOG;
                            }
                        }
                    }

                    for (let dy = trunkH - 1; dy <= trunkH + 2; dy++) {
                        const wy = h + dy;
                        if (wy <= 0 || wy >= CHUNK_HEIGHT) continue;
                        const radius = dy === trunkH + 2 ? 1 : 2;
                        for (let dx = -radius; dx <= radius; dx++) {
                            for (let dz = -radius; dz <= radius; dz++) {
                                if (dx === 0 && dz === 0 && dy <= trunkH) continue;
                                if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy !== trunkH) continue;
                                putWorldBlock(wx + dx, wy, wz + dz, leafType);
                            }
                        }
                    }
                }
            }

            neighborRemesh.forEach(key => {
                const neighbor = this.chunks.get(key);
                if (neighbor) this.buildChunkMesh(neighbor);
            });
        }
    }

    getBlock(wx, wy, wz) {
        const x = Math.floor(wx);
        const y = Math.floor(wy);
        const z = Math.floor(wz);
        if (y < 0 || y >= CHUNK_HEIGHT) return BLOCKS.AIR;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.key(cx, cz));
        if (!chunk) return BLOCKS.AIR;
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.data[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
    }

    getLiquidLevel(wx, wy, wz) {
        const x = Math.floor(wx);
        const y = Math.floor(wy);
        const z = Math.floor(wz);
        if (y < 0 || y >= CHUNK_HEIGHT) return 0;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.key(cx, cz));
        if (!chunk) return 0;
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.liquidLevel[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
    }

    scheduleLiquidUpdate(x, y, z) {
        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);
        if (by < 1 || by >= CHUNK_HEIGHT - 1 || this.liquidQueue.size >= 4096) return;
        this.liquidQueue.add(this.packCoord(bx, by, bz));
    }

    wakeNeighborLiquids(x, y, z) {
        const dirs = [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        for (const [dx, dy, dz] of dirs) {
            const nx = x + dx, ny = y + dy, nz = z + dz;
            const id = this.getBlock(nx, ny, nz);
            if (id === BLOCKS.WATER || id === BLOCKS.LAVA) {
                this.scheduleLiquidUpdate(nx, ny, nz);
            }
        }
    }

    setBlock(wx, wy, wz, id, rebuildNow = true, customLiquidLevel = null) {
        const x = Math.floor(wx);
        const y = Math.floor(wy);
        const z = Math.floor(wz);
        if (y < 1 || y >= CHUNK_HEIGHT - 1) return;

        const prevId = this.getBlock(x, y, z);
        let liqLevel = 0;

        if (id === BLOCKS.LAVA || id === BLOCKS.WATER) {
            liqLevel = customLiquidLevel !== null ? customLiquidLevel : 7;
            const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
            for (const [dx, dy, dz] of neighbors) {
                const nid = this.getBlock(x + dx, y + dy, z + dz);
                if ((id === BLOCKS.LAVA && nid === BLOCKS.WATER) || (id === BLOCKS.WATER && nid === BLOCKS.LAVA)) {
                    id = liqLevel === 7 ? BLOCKS.OBSIDIAN : BLOCKS.COBBLESTONE;
                    liqLevel = 0;
                    break;
                }
            }
        }

        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.ensureChunk(cx, cz);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const cellIdx = y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
        chunk.data[cellIdx] = id;
        chunk.liquidLevel[cellIdx] = liqLevel;
        chunk.dirty = true;
        chunk.lightDirty = true;

        if (id === BLOCKS.WATER || id === BLOCKS.LAVA) {
            this.scheduleLiquidUpdate(x, y, z);
        }
        this.wakeNeighborLiquids(x, y, z);

        // If an Obsidian block was broken/replaced, extinguish any adjacent Nether Portal blocks
        if (prevId === BLOCKS.OBSIDIAN && id !== BLOCKS.OBSIDIAN) {
            this.shatterAdjacentPortals(x, y, z);
        }

        if (rebuildNow) {
            this.computeChunkLight(chunk);
            this.buildChunkMesh(chunk);
            if (lx === 0) this.rebuildIfExists(cx - 1, cz, true);
            if (lx === CHUNK_SIZE - 1) this.rebuildIfExists(cx + 1, cz, true);
            if (lz === 0) this.rebuildIfExists(cx, cz - 1, true);
            if (lz === CHUNK_SIZE - 1) this.rebuildIfExists(cx, cz + 1, true);
        }
    }

    canLiquidFlowInto(blockId) {
        return blockId === BLOCKS.AIR || blockId === BLOCKS.WHEAT;
    }

    // 7-level cellular fluid simulation (7 = source, 1 = edge where flow stops)


    // Flood-fill removal of connected Nether Portal blocks when their Obsidian frame is broken
    shatterAdjacentPortals(ox, oy, oz) {
        const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        const queue = [];
        const visited = new Set();

        for (const [dx, dy, dz] of dirs) {
            const nx = ox + dx, ny = oy + dy, nz = oz + dz;
            if (this.getBlock(nx, ny, nz) === BLOCKS.PORTAL) {
                const k = `${nx},${ny},${nz}`;
                visited.add(k);
                queue.push([nx, ny, nz]);
            }
        }

        if (queue.length === 0) return false;

        while (queue.length > 0) {
            const [px, py, pz] = queue.shift();
            const cx = Math.floor(px / CHUNK_SIZE);
            const cz = Math.floor(pz / CHUNK_SIZE);
            const chunk = this.chunks.get(this.key(cx, cz));
            if (chunk) {
                const lx = ((px % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                const lz = ((pz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
                chunk.data[py * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = BLOCKS.AIR;
                chunk.dirty = true;
                chunk.lightDirty = true;
            }
            for (const [dx, dy, dz] of dirs) {
                const nx = px + dx, ny = py + dy, nz = pz + dz;
                const k = `${nx},${ny},${nz}`;
                if (!visited.has(k) && this.getBlock(nx, ny, nz) === BLOCKS.PORTAL) {
                    visited.add(k);
                    queue.push([nx, ny, nz]);
                }
            }
        }

        for (const c of this.chunks.values()) {
            if (c.dirty) {
                this.computeChunkLight(c);
                this.buildChunkMesh(c);
            }
        }
        return true;
    }

    rebuildIfExists(cx, cz, relight = false) {
        const c = this.chunks.get(this.key(cx, cz));
        if (c) {
            if (relight) this.computeChunkLight(c);
            this.buildChunkMesh(c);
        }
    }

    computeChunkLight(chunk) {
        chunk.lightDirty = false;
        const { cx, cz, data, skyLight, blockLight } = chunk;
        skyLight.fill(0);
        blockLight.fill(0);

        const idx = (lx, y, lz) => y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
        const queue = [];

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                let sun = 15;
                for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                    const i = idx(lx, y, lz);
                    const id = data[i];
                    const def = BLOCK_DEFS[id];
                    if (id !== BLOCKS.AIR) {
                        if (def && !def.transparent) {
                            sun = 0;
                        } else if (id === BLOCKS.WATER) {
                            sun = Math.max(0, sun - 2);
                        }
                    }
                    if (sun > 0) {
                        skyLight[i] = sun;
                        queue.push(lx, y, lz, 0);
                    }
                    if (def && def.light) {
                        blockLight[i] = def.light;
                        queue.push(lx, y, lz, 1);
                    }
                }
            }
        }

        const pullEdge = (ncx, ncz, ourX, ourZ, theirX, theirZ) => {
            const nc = this.chunks.get(this.key(ncx, ncz));
            if (!nc || nc.lightDirty) return;
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                const iOur = idx(ourX, y, ourZ);
                const iTheir = idx(theirX, y, theirZ);
                const ourId = data[iOur];
                const ourDef = BLOCK_DEFS[ourId];
                if (ourId !== BLOCKS.AIR && ourDef && !ourDef.transparent) continue;

                const ns = nc.skyLight[iTheir] - 1;
                if (ns > skyLight[iOur]) {
                    skyLight[iOur] = ns;
                    queue.push(ourX, y, ourZ, 0);
                }
                const nb = nc.blockLight[iTheir] - 1;
                if (nb > blockLight[iOur]) {
                    blockLight[iOur] = nb;
                    queue.push(ourX, y, ourZ, 1);
                }
            }
        };

        for (let z = 0; z < CHUNK_SIZE; z++) {
            pullEdge(cx - 1, cz, 0, z, CHUNK_SIZE - 1, z);
            pullEdge(cx + 1, cz, CHUNK_SIZE - 1, z, 0, z);
        }
        for (let x = 0; x < CHUNK_SIZE; x++) {
            pullEdge(cx, cz - 1, x, 0, x, CHUNK_SIZE - 1);
            pullEdge(cx, cz + 1, x, CHUNK_SIZE - 1, x, 0);
        }

        const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        let head = 0;
        while (head < queue.length) {
            const lx = queue[head++];
            const y = queue[head++];
            const lz = queue[head++];
            const ch = queue[head++];
            const arr = ch === 0 ? skyLight : blockLight;
            const cur = arr[idx(lx, y, lz)];
            if (cur <= 1) continue;

            for (let d = 0; d < 6; d++) {
                const nx = lx + dirs[d][0];
                const ny = y + dirs[d][1];
                const nz = lz + dirs[d][2];
                if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT) continue;
                const ni = idx(nx, ny, nz);
                const nid = data[ni];
                const ndef = BLOCK_DEFS[nid];
                if (nid !== BLOCKS.AIR && ndef && !ndef.transparent) continue;
                const next = cur - (nid === BLOCKS.WATER ? 2 : 1);
                if (next > arr[ni]) {
                    arr[ni] = next;
                    queue.push(nx, ny, nz, ch);
                }
            }
        }
    }

    getLightAt(wx, wy, wz) {
        const x = Math.floor(wx);
        const y = Math.floor(wy);
        const z = Math.floor(wz);
        if (y >= CHUNK_HEIGHT) return { sky: 15, block: 0, combined: Math.round(15 * this.daylightFactor) };
        if (y < 0) return { sky: 0, block: 0, combined: 0 };
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.key(cx, cz));
        if (!chunk) return { sky: 15, block: 0, combined: Math.round(15 * this.daylightFactor) };
        if (chunk.lightDirty) this.computeChunkLight(chunk);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const i = y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
        const sky = chunk.skyLight[i];
        const block = chunk.blockLight[i];
        const effectiveSky = sky * this.daylightFactor;
        const combined = Math.min(15, Math.round(Math.max(effectiveSky, block)));
        return { sky, block, combined };
    }

    buildVillage(vx, vz, name) {
        const baseH = Math.max(WATER_LEVEL + 2, this.getTerrainHeight(vx, vz));
        const touched = new Set();

        const put = (x, y, z, id) => {
            if (y < 1 || y >= CHUNK_HEIGHT - 1) return;
            const cx = Math.floor(x / CHUNK_SIZE);
            const cz = Math.floor(z / CHUNK_SIZE);
            const chunk = this.ensureChunk(cx, cz);
            const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            chunk.data[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = id;
            chunk.dirty = true;
            chunk.lightDirty = true;
            touched.add(chunk);
        };

        for (let dx = -12; dx <= 12; dx++) {
            for (let dz = -12; dz <= 12; dz++) {
                const wx = vx + dx, wz = vz + dz;
                const dist = Math.hypot(dx, dz);
                if (dist <= 11.5) {
                    for (let y = baseH - 4; y <= baseH; y++) {
                        put(wx, y, wz, y === baseH ? BLOCKS.GRASS : BLOCKS.DIRT);
                    }
                    for (let y = baseH + 1; y <= baseH + 10; y++) {
                        put(wx, y, wz, BLOCKS.AIR);
                    }
                    if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) {
                        put(wx, baseH, wz, BLOCKS.PATH);
                    }
                }
            }
        }

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
                put(vx + dx, baseH + 1, vz + dz, edge ? BLOCKS.COBBLESTONE : BLOCKS.WATER);
                if (Math.abs(dx) === 1 && Math.abs(dz) === 1) {
                    put(vx + dx, baseH + 2, vz + dz, BLOCKS.OAK_LOG);
                    put(vx + dx, baseH + 3, vz + dz, BLOCKS.OAK_LOG);
                }
                put(vx + dx, baseH + 4, vz + dz, BLOCKS.OAK_PLANKS);
            }
        }
        put(vx, baseH + 5, vz, BLOCKS.LANTERN);

        const buildHouse = (hx, hz, doorDirZ) => {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const wall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
                    const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
                    put(hx + dx, baseH, hz + dz, BLOCKS.COBBLESTONE);
                    for (let y = 1; y <= 3; y++) {
                        if (!wall) {
                            put(hx + dx, baseH + y, hz + dz, BLOCKS.AIR);
                        } else if (dx === 0 && dz === doorDirZ && y <= 2) {
                            put(hx + dx, baseH + y, hz + dz, BLOCKS.AIR);
                        } else if (corner) {
                            put(hx + dx, baseH + y, hz + dz, BLOCKS.OAK_LOG);
                        } else if (y === 2 && (dx === 0 || dz === 0)) {
                            put(hx + dx, baseH + y, hz + dz, BLOCKS.GLASS);
                        } else {
                            put(hx + dx, baseH + y, hz + dz, BLOCKS.OAK_PLANKS);
                        }
                    }
                    put(hx + dx, baseH + 4, hz + dz, BLOCKS.OAK_PLANKS);
                }
            }
            put(hx - 1, baseH + 1, hz - doorDirZ, BLOCKS.CRAFTING);
            put(hx + 1, baseH + 1, hz - doorDirZ, BLOCKS.GOLD);
            put(hx, baseH + 3, hz, BLOCKS.LANTERN);
        };

        buildHouse(vx - 6, vz - 6, 2);
        buildHouse(vx + 6, vz + 6, -2);

        for (let dx = 4; dx <= 8; dx++) {
            for (let dz = -7; dz <= -4; dz++) {
                if (dx === 6) {
                    put(vx + dx, baseH, vz + dz, BLOCKS.WATER);
                } else {
                    put(vx + dx, baseH, vz + dz, BLOCKS.DIRT);
                    put(vx + dx, baseH + 1, vz + dz, BLOCKS.WHEAT);
                }
            }
        }

        [[-4, 4], [4, -3]].forEach(([lx, lz]) => {
            put(vx + lx, baseH + 1, vz + lz, BLOCKS.OAK_LOG);
            put(vx + lx, baseH + 2, vz + lz, BLOCKS.OAK_LOG);
            put(vx + lx, baseH + 3, vz + lz, BLOCKS.LANTERN);
        });

        for (const c of touched) {
            this.computeChunkLight(c);
            this.buildChunkMesh(c);
        }

        const villageInfo = { x: vx, y: baseH, z: vz, name };
        this.villages.push(villageInfo);
        return villageInfo;
    }

    buildChunkMesh(chunk) {
        if (chunk.lightDirty) this.computeChunkLight(chunk);
        chunk.dirty = false;
        const { cx, cz, data, liquidLevel, skyLight, blockLight } = chunk;
        const baseX = cx * CHUNK_SIZE;
        const baseZ = cz * CHUNK_SIZE;
        const dayF = this.daylightFactor;
        const idx = (lx, y, lz) => y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;

        const opaquePos = [], opaqueNorm = [], opaqueCol = [], opaqueUv = [], opaqueIdx = [];
        const transPos = [], transNorm = [], transCol = [], transUv = [], transIdx = [];

        const faces = [
            { dir: [1, 0, 0], face: 'side', shade: 0.84, corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
            { dir: [-1, 0, 0], face: 'side', shade: 0.84, corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
            { dir: [0, 1, 0], face: 'top', shade: 1.0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
            { dir: [0, -1, 0], face: 'bottom', shade: 0.58, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
            { dir: [0, 0, 1], face: 'side', shade: 0.9, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
            { dir: [0, 0, -1], face: 'side', shade: 0.9, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] }
        ];

        const cols = this.atlas.cols;
        const rows = this.atlas.rows;
        const padU = 0.002;
        const padV = 0.002;

        const fastBlock = (lx, y, lz) => {
            if (y < 0 || y >= CHUNK_HEIGHT) return BLOCKS.AIR;
            if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                return data[idx(lx, y, lz)];
            }
            return this.getBlock(baseX + lx, y, baseZ + lz);
        };

        const fastCombinedLight = (lx, y, lz) => {
            if (y >= CHUNK_HEIGHT) return Math.round(15 * dayF);
            if (y < 0) return 0;
            if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                const i = idx(lx, y, lz);
                return Math.min(15, Math.round(Math.max(skyLight[i] * dayF, blockLight[i])));
            }
            return this.getLightAt(baseX + lx, y, baseZ + lz).combined;
        };

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                    const cellIdx = idx(lx, y, lz);
                    const id = data[cellIdx];
                    if (id === BLOCKS.AIR) continue;
                    const def = BLOCK_DEFS[id];
                    if (!def || !def.tex) continue;

                    const wx = baseX + lx;
                    const wz = baseZ + lz;
                    const isTrans = !!def.transparent;

                    const posArr = isTrans ? transPos : opaquePos;
                    const normArr = isTrans ? transNorm : opaqueNorm;
                    const colArr = isTrans ? transCol : opaqueCol;
                    const uvArr = isTrans ? transUv : opaqueUv;
                    const idxArr = isTrans ? transIdx : opaqueIdx;

                    if (def.customModel === 'portal') {
                        // Thin glass-pane-style vertical Nether Portal sheet (0.18 blocks thick)
                        const xNeighbor = fastBlock(lx - 1, y, lz);
                        const xNeighbor2 = fastBlock(lx + 1, y, lz);
                        const alongX = (xNeighbor === BLOCKS.PORTAL || xNeighbor === BLOCKS.OBSIDIAN || xNeighbor2 === BLOCKS.PORTAL || xNeighbor2 === BLOCKS.OBSIDIAN);
                        const x0 = alongX ? 0.0 : 0.41;
                        const x1 = alongX ? 1.0 : 0.59;
                        const z0 = alongX ? 0.41 : 0.0;
                        const z1 = alongX ? 0.59 : 1.0;

                        const tx = 46 % cols;
                        const ty = Math.floor(46 / cols);
                        const u0 = tx / cols + padU;
                        const u1 = (tx + 1) / cols - padU;
                        const vTop = 1 - (ty / rows + padV);
                        const vBot = 1 - ((ty + 1) / rows - padV);

                        const paneFaces = [
                            { dir: [1,0,0], c: [[x1,0,z1],[x1,0,z0],[x1,1,z0],[x1,1,z1]] },
                            { dir: [-1,0,0], c: [[x0,0,z0],[x0,0,z1],[x0,1,z1],[x0,1,z0]] },
                            { dir: [0,1,0], c: [[x0,1,z1],[x1,1,z1],[x1,1,z0],[x0,1,z0]] },
                            { dir: [0,-1,0], c: [[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]] },
                            { dir: [0,0,1], c: [[x0,0,z1],[x1,0,z1],[x1,1,z1],[x0,1,z1]] },
                            { dir: [0,0,-1], c: [[x1,0,z0],[x0,0,z0],[x0,1,z0],[x1,1,z0]] }
                        ];
                        for (const pf of paneFaces) {
                            const sv = transPos.length / 3;
                            for (let c = 0; c < 4; c++) {
                                transPos.push(wx + pf.c[c][0], y + pf.c[c][1], wz + pf.c[c][2]);
                                transNorm.push(pf.dir[0], pf.dir[1], pf.dir[2]);
                                transCol.push(1.0, 0.85, 1.0);
                            }
                            transUv.push(u0, vBot, u1, vBot, u1, vTop, u0, vTop);
                            transIdx.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
                        }
                        continue;
                    }

                    if (def.customModel === 'lantern') {
                        const addSubBox = (x0, y0, z0, x1, y1, z1, tileIdx, rMul, gMul, bMul) => {
                            const tx = tileIdx % cols;
                            const ty = Math.floor(tileIdx / cols);
                            const u0 = tx / cols + padU;
                            const u1 = (tx + 1) / cols - padU;
                            const vTop = 1 - (ty / rows + padV);
                            const vBot = 1 - ((ty + 1) / rows - padV);
                            const boxFaces = [
                                { dir: [1,0,0], c: [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]] },
                                { dir: [-1,0,0], c: [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]] },
                                { dir: [0,1,0], c: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]] },
                                { dir: [0,-1,0], c: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]] },
                                { dir: [0,0,1], c: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]] },
                                { dir: [0,0,-1], c: [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]] }
                            ];
                            for (const bf of boxFaces) {
                                const sv = opaquePos.length / 3;
                                for (let c = 0; c < 4; c++) {
                                    opaquePos.push(wx + bf.c[c][0], y + bf.c[c][1], wz + bf.c[c][2]);
                                    opaqueNorm.push(bf.dir[0], bf.dir[1], bf.dir[2]);
                                    opaqueCol.push(rMul, gMul, bMul);
                                }
                                opaqueUv.push(u0, vBot, u1, vBot, u1, vTop, u0, vTop);
                                opaqueIdx.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
                            }
                        };
                        addSubBox(0.24, 0.0, 0.24, 0.76, 0.14, 0.76, 25, 0.45, 0.48, 0.55);
                        addSubBox(0.28, 0.14, 0.28, 0.72, 0.64, 0.72, 15, 1.0, 0.96, 0.85);
                        addSubBox(0.22, 0.64, 0.22, 0.78, 0.78, 0.78, 25, 0.45, 0.48, 0.55);
                        addSubBox(0.36, 0.78, 0.44, 0.64, 0.94, 0.56, 25, 0.55, 0.58, 0.65);
                        continue;
                    }


                    const cellSky = skyLight[cellIdx];
                    const cellBlock = blockLight[cellIdx];
                    const combinedHere = Math.min(15, Math.round(Math.max(cellSky * dayF, cellBlock)));
                    const baseBright = Math.max(0.12, combinedHere / 15);
                    const warmGlow = Math.min(1, cellBlock / 15) * 0.22;

                    for (let fi = 0; fi < 6; fi++) {
                        const f = faces[fi];
                        const nlx = lx + f.dir[0];
                        const ny = y + f.dir[1];
                        const nlz = lz + f.dir[2];
                        const nId = fastBlock(nlx, ny, nlz);
                        const nDef = BLOCK_DEFS[nId];

                        if (nId !== BLOCKS.AIR) {
                            if (!isTrans && nDef && !nDef.transparent) continue;
                            if (isTrans && nId === id) continue;
                        }

                        const nCombined = fastCombinedLight(nlx, ny, nlz);
                        const faceLight = def.emissive ? 1.0 : Math.max(baseBright, nCombined / 15);
                        const shade = faceLight * f.shade;
                        const rMul = Math.min(1.0, shade + warmGlow);
                        const gMul = Math.min(1.0, shade + warmGlow * 0.65);
                        const bMul = Math.min(1.0, shade);

                        const tileIdx = def.tex.all !== undefined ? def.tex.all : def.tex[f.face];
                        const tx = tileIdx % cols;
                        const ty = Math.floor(tileIdx / cols);
                        const u0 = tx / cols + padU;
                        const u1 = (tx + 1) / cols - padU;
                        const vTop = 1 - (ty / rows + padV);
                        const vBot = 1 - ((ty + 1) / rows - padV);

                        const startVert = posArr.length / 3;
                        for (let c = 0; c < 4; c++) {
                            let vy = f.corners[c][1];
                            if (id === BLOCKS.WATER || id === BLOCKS.LAVA) {
                                const aboveSame = fastBlock(lx, y + 1, lz) === id;
                                if (!aboveSame && vy === 1) {
                                    const lvl = liquidLevel[cellIdx] || 7;
                                    // Map liquid state 7 (source) -> 0.90 height down to state 1 -> 0.14 height
                                    vy = 0.08 + (lvl / 7) * 0.82;
                                }
                            }
                            posArr.push(wx + f.corners[c][0], y + vy, wz + f.corners[c][2]);
                            normArr.push(f.dir[0], f.dir[1], f.dir[2]);
                            colArr.push(rMul, gMul, bMul);
                        }
                        uvArr.push(u0, vBot, u1, vBot, u1, vTop, u0, vTop);
                        idxArr.push(startVert, startVert + 1, startVert + 2, startVert, startVert + 2, startVert + 3);
                    }
                }
            }
        }

        const applyMesh = (oldMesh, pos, norm, col, uv, idx, mat) => {
            if (oldMesh) {
                this.scene.remove(oldMesh);
                oldMesh.geometry.dispose();
            }
            if (pos.length === 0) return null;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            geo.setIndex(idx);
            const mesh = new THREE.Mesh(geo, mat);
            this.scene.add(mesh);
            return mesh;
        };

        chunk.opaqueMesh = applyMesh(chunk.opaqueMesh, opaquePos, opaqueNorm, opaqueCol, opaqueUv, opaqueIdx, this.opaqueMat);
        chunk.transMesh = applyMesh(chunk.transMesh, transPos, transNorm, transCol, transUv, transIdx, this.transMat);
    }
}

// =========================================================================
