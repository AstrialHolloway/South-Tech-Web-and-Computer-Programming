// 5. MAIN GAME CONTROLLER
// =========================================================================
class Minecraft2Game {
    constructor() {
        this.sfx = new SoundFX();

        this.canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.isSwitchingDimension = false;

        this.scene = new THREE.Scene();
        this.skyColor = new THREE.Color('#7dd3fc');
        this.scene.background = this.skyColor.clone();
        this.scene.fog = new THREE.Fog(this.skyColor.clone(), 28, 66);

        this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 140);
        this.camera.up.set(0, 1, 0);
        this.camera.rotation.order = 'YXZ';

        this.hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 0.72);
        this.scene.add(this.hemiLight);
        this.sunLight = new THREE.DirectionalLight(0xfffbeb, 0.78);
        this.sunLight.position.set(35, 65, 25);
        this.scene.add(this.sunLight);

        this.heldPointLight = new THREE.PointLight(0xffd166, 0, 16);
        this.scene.add(this.heldPointLight);
        this.worldPointLight = new THREE.PointLight(0xf97316, 0, 20);
        this.scene.add(this.worldPointLight);
        this.explosionLightTimer = 0;

        const seed = Math.floor(100000 + Math.random() * 899999);
        document.getElementById('hud-seed').textContent = `Seed: ${seed}`;
        this.noise = new SeededNoise(seed);
        this.atlas = createTextureAtlas();
        this.world = new VoxelWorld(this.scene, this.noise, this.atlas);

        this.isPlaying = false;
        this.timeOfDay = 0.25;
        this.weather = 0;
        this.discoveredVillages = new Set();
        this.activeVillager = null;

        this.player = {
            pos: new THREE.Vector3(0.5, 66, 0.5),
            vel: new THREE.Vector3(),
            yaw: 0,
            pitch: 0,
            targetYaw: 0,
            targetPitch: 0,
            onGround: false,
            spectator: false,
            creative: false,
            flying: false,
            highestY: 66,
            lastSpaceTap: 0,
            hp: 20,
            maxHp: 20,
            hunger: 20,
            maxHunger: 20,
            hungerDrainTimer: 0,
            regenTimer: 0,
            lavaBurnTimer: 0,
            portalCooldown: 0,
            xpLevel: 0,
            xpProgress: 0,
            hurtCooldown: 0,
            emeralds: 0,
            slot: 0,
            inventory: Array.from({ length: 36 }, () => null),
            swingTimer: 0,
            bobTimer: 0,
            stepDistance: 0
        };

        this.craftGridSize = 2;
        this.craftSlots = Array.from({ length: 9 }, () => null);
        this.dragSource = null;
        this.heldCursorStack = null;
        this.creativeCategory = 'all';
        this.creativeSearchQuery = '';
        this.miningState = null;

        const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
        this.targetOutline = new THREE.LineSegments(
            boxGeo,
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })
        );
        this.targetOutline.visible = false;
        this.scene.add(this.targetOutline);

        this.breakOverlay = new THREE.Mesh(
            new THREE.BoxGeometry(1.015, 1.015, 1.015),
            new THREE.MeshBasicMaterial({ color: 0x090d16, transparent: true, opacity: 0.0, depthWrite: false })
        );
        this.breakOverlay.visible = false;
        this.scene.add(this.breakOverlay);

        this.initHotbarUI();
        this.buildHeldItemMesh();
        document.getElementById('craft-modal').classList.add('hidden');

        // Apply tiled pixelated Dirt texture to the main menu & world loading screen
        const dirtUrl = getTileDataURL(this.atlas, 2);
        const titleOverlay = document.getElementById('title-overlay');
        const loadingOverlay = document.getElementById('world-loading-overlay');
        if (titleOverlay) titleOverlay.style.backgroundImage = `url(${dirtUrl})`;
        if (loadingOverlay) loadingOverlay.style.backgroundImage = `url(${dirtUrl})`;
    }









    setGameMode(mode) {
        this.player.spectator = mode === 'spectator';
        this.player.creative = mode === 'creative';
        if (this.player.spectator) {
            this.player.flying = true;
        } else if (!this.player.creative) {
            this.player.flying = false;
        }
        const modeEl = document.getElementById('hud-mode');
        if (modeEl) {
            if (this.player.spectator) {
                modeEl.textContent = '👻 Spectator';
                modeEl.className = 'text-purple-300 font-bold';
            } else if (this.player.creative) {
                modeEl.textContent = '✨ Creative';
                modeEl.className = 'text-amber-300 font-bold';
            } else {
                modeEl.textContent = '🧭 Survival';
                modeEl.className = 'text-cyan-300 font-bold';
            }
        }
        this.updateStatusBars();
        this.showToast(`Switched to ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`);
    }





















    selectSlot(idx) {
        this.player.slot = ((idx % 9) + 9) % 9;
        this.initHotbarUI();
        this.buildHeldItemMesh();
    }

    buildHeldItemMesh() {
        if (this.heldPivot) {
            this.camera.remove(this.heldPivot);
        }
        this.heldPivot = new THREE.Group();
        this.heldPivot.position.set(0.36, -0.32, -0.52);
        this.heldPivot.rotation.set(0.15, -0.35, 0.08);

        const stack = this.player.inventory[this.player.slot];
        const id = stack ? stack.id : BLOCKS.AIR;
        const def = BLOCK_DEFS[id];

        if (!stack || id === BLOCKS.AIR) {
            const hand = new THREE.Mesh(
                new THREE.BoxGeometry(0.14, 0.14, 0.34),
                new THREE.MeshLambertMaterial({ color: 0xeab676 })
            );
            this.heldPivot.add(hand);
        } else if (id === BLOCKS.LANTERN) {
            const ironMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), ironMat);
            base.position.y = -0.11;
            const top = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.04, 0.19), ironMat);
            top.position.y = 0.09;
            const core = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), coreMat);
            core.position.y = -0.01;
            this.heldPivot.add(base, top, core);
            [[-0.075, -0.075], [0.075, -0.075], [-0.075, 0.075], [0.075, 0.075]].forEach(([px, pz]) => {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.18, 0.022), ironMat);
                post.position.set(px, -0.01, pz);
                this.heldPivot.add(post);
            });
            const ring = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), ironMat);
            ring.position.y = 0.135;
            this.heldPivot.add(ring);
        } else if (def && def.toolKind === 'sword') {
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), new THREE.MeshLambertMaterial({ color: def.hiltColor || 0x78350f }));
            grip.position.y = -0.12;
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.05), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
            guard.position.y = -0.04;
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.34, 0.022), new THREE.MeshLambertMaterial({ color: def.bladeColor || 0x38bdf8, emissive: def.bladeGlow || 0x000000 }));
            blade.position.y = 0.14;
            this.heldPivot.add(grip, guard, blade);
        } else if (def && def.toolKind === 'pickaxe') {
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.035), new THREE.MeshLambertMaterial({ color: 0x78350f }));
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.045), new THREE.MeshLambertMaterial({ color: def.headColor || 0x94a3b8 }));
            head.position.y = 0.16;
            this.heldPivot.add(shaft, head);
        } else if (def && def.toolKind === 'axe') {
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.035), new THREE.MeshLambertMaterial({ color: 0x78350f }));
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.045), new THREE.MeshLambertMaterial({ color: def.headColor || 0x94a3b8 }));
            blade.position.set(-0.06, 0.12, 0);
            this.heldPivot.add(shaft, blade);
        } else if (def && def.toolKind === 'shovel') {
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.035), new THREE.MeshLambertMaterial({ color: 0x78350f }));
            shaft.position.y = -0.04;
            const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.035), new THREE.MeshLambertMaterial({ color: def.headColor || 0x94a3b8 }));
            scoop.position.y = 0.18;
            this.heldPivot.add(shaft, scoop);
        } else if (def && def.toolKind === 'hoe') {
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.035), new THREE.MeshLambertMaterial({ color: 0x78350f }));
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.04), new THREE.MeshLambertMaterial({ color: def.headColor || 0x94a3b8 }));
            blade.position.set(-0.06, 0.16, 0);
            this.heldPivot.add(shaft, blade);
        } else {
            const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
            const cols = this.atlas.cols;
            const rows = this.atlas.rows;
            const tileIdx = def?.tex ? (def.tex.all !== undefined ? def.tex.all : def.tex.side) : 0;
            const tx = tileIdx % cols;
            const ty = Math.floor(tileIdx / cols);
            const u0 = tx / cols + 0.002;
            const u1 = (tx + 1) / cols - 0.002;
            const vTop = 1 - (ty / rows + 0.002);
            const vBot = 1 - ((ty + 1) / rows - 0.002);
            const uvAttr = geo.attributes.uv;
            for (let i = 0; i < uvAttr.count; i += 4) {
                uvAttr.setXY(i, u0, vTop);
                uvAttr.setXY(i + 1, u1, vTop);
                uvAttr.setXY(i + 2, u0, vBot);
                uvAttr.setXY(i + 3, u1, vBot);
            }
            const blockMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.atlas.tex }));
            this.heldPivot.add(blockMesh);
        }

        this.camera.add(this.heldPivot);
    }

    syncCameraTransform() {
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.player.yaw;
        this.camera.rotation.x = this.player.pitch;
        this.camera.rotation.z = 0;
    }

    initWorldAndVillages(onProgress = null, onComplete = null) {
        this.mobs = [];
        this.drops = [];
        this.fallingBlocks = [];

        const tasks = [];
        for (let cx = -RENDER_DIST; cx <= RENDER_DIST; cx++) {
            for (let cz = -RENDER_DIST; cz <= RENDER_DIST; cz++) {
                tasks.push({ type: 'chunk', cx, cz });
            }
        }
        tasks.push({ type: 'villages' });
        tasks.push({ type: 'light' });
        tasks.push({ type: 'mesh' });
        tasks.push({ type: 'mobs' });

        let idx = 0;
        const total = tasks.length;

        const step = () => {
            const batchEnd = Math.min(total, idx + 4);
            while (idx < batchEnd) {
                const t = tasks[idx++];
                if (t.type === 'chunk') {
                    this.world.ensureChunk(t.cx, t.cz);
                } else if (t.type === 'villages') {
                    this.world.buildVillage(16, 16, 'Skyhaven Village');
                    this.world.buildVillage(-26, 22, 'Suncrest Hamlet');
                } else if (t.type === 'light') {
                    for (const c of this.world.chunks.values()) {
                        this.world.computeChunkLight(c);
                    }
                } else if (t.type === 'mesh') {
                    for (const c of this.world.chunks.values()) {
                        this.world.buildChunkMesh(c);
                    }
                } else if (t.type === 'mobs') {
                    this.spawnInitialMobs();
                }
            }

            const pct = Math.min(100, Math.round((idx / total) * 100));
            const statusMsg = idx < total - 3
                ? `Carving terrain & deep caves (${pct}%)...`
                : (idx < total ? 'Calculating sunlight & villages...' : 'World ready!');
            if (onProgress) onProgress(pct, statusMsg);

            if (idx < total) {
                requestAnimationFrame(step);
            } else if (onComplete) {
                onComplete();
            }
        };

        requestAnimationFrame(step);
    }

    spawnInitialMobs() {
        this.world.villages.forEach(v => {
            this.mobs.push(new MobEntity(this.scene, 'villager', v.x + 2.5, v.y + 1.01, v.z + 2.5, `${v.name} Trader`));
            this.mobs.push(new MobEntity(this.scene, 'villager', v.x - 2.5, v.y + 1.01, v.z - 2.5, `${v.name} Artisan`));
        });

        const passiveTypes = ['sheep', 'cow', 'fox'];
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
            const dist = 10 + Math.random() * 28;
            const mx = Math.floor(Math.cos(angle) * dist) + 0.5;
            const mz = Math.floor(Math.sin(angle) * dist) + 0.5;
            const my = this.world.getTerrainHeight(mx, mz);
            if (my > WATER_LEVEL) {
                const type = passiveTypes[i % passiveTypes.length];
                this.mobs.push(new MobEntity(this.scene, type, mx, my + 1.01, mz));
            }
        }
    }

    spawnPlayerSafely(preferX = 0, preferZ = 0) {
        const startX = Math.floor(preferX);
        const startZ = Math.floor(preferZ);

        const isSafeStandSpot = (bx, bz) => {
            this.world.ensureChunk(Math.floor(bx / CHUNK_SIZE), Math.floor(bz / CHUNK_SIZE));
            const maxY = this.world.dimension === 'nether' ? 68 : CHUNK_HEIGHT - 3;
            for (let y = maxY; y >= 2; y--) {
                const floorId = this.world.getBlock(bx, y, bz);
                if (floorId === BLOCKS.WATER || floorId === BLOCKS.LAVA) return null;
                const floorDef = BLOCK_DEFS[floorId];
                if (floorId !== BLOCKS.AIR && floorDef && floorDef.solid) {
                    const head1 = this.world.getBlock(bx, y + 1, bz);
                    const head2 = this.world.getBlock(bx, y + 2, bz);
                    if (head1 === BLOCKS.AIR && head2 === BLOCKS.AIR) {
                        return y + 1.01;
                    }
                    return null;
                }
            }
            return null;
        };

        for (let radius = 0; radius <= 36; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
                    const bx = startX + dx;
                    const bz = startZ + dz;
                    const safeY = isSafeStandSpot(bx, bz);
                    if (safeY !== null) {
                        this.player.pos.set(bx + 0.5, safeY, bz + 0.5);
                        this.player.vel.set(0, 0, 0);
                        this.player.highestY = safeY;
                        this.player.onGround = true;
                        return;
                    }
                }
            }
        }

        const fallbackY = this.world.getTerrainHeight(startX, startZ) + 2.01;
        this.player.pos.set(startX + 0.5, fallbackY, startZ + 0.5);
        this.player.vel.set(0, 0, 0);
        this.player.highestY = fallbackY;
    }

    collidesAt(x, y, z) {
        if (this.player.spectator) return false;
        const r = 0.28;
        const h = 1.72;
        const minX = Math.floor(x - r), maxX = Math.floor(x + r);
        const minY = Math.floor(y + 0.02), maxY = Math.floor(y + h);
        const minZ = Math.floor(z - r), maxZ = Math.floor(z + r);

        for (let bx = minX; bx <= maxX; bx++) {
            for (let by = minY; by <= maxY; by++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    const id = this.world.getBlock(bx, by, bz);
                    if (id !== BLOCKS.AIR && BLOCK_DEFS[id]?.solid) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    raycast(maxDist = 5.5) {
        const origin = this.camera.position.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
        const step = 0.04;
        let prevX = Math.floor(origin.x);
        let prevY = Math.floor(origin.y);
        let prevZ = Math.floor(origin.z);

        for (let d = 0; d <= maxDist; d += step) {
            const px = origin.x + dir.x * d;
            const py = origin.y + dir.y * d;
            const pz = origin.z + dir.z * d;
            const bx = Math.floor(px);
            const by = Math.floor(py);
            const bz = Math.floor(pz);
            const id = this.world.getBlock(bx, by, bz);
            if (id !== BLOCKS.AIR && id !== BLOCKS.WATER && id !== BLOCKS.LAVA) {
                return {
                    x: bx, y: by, z: bz, id,
                    nx: prevX - bx,
                    ny: prevY - by,
                    nz: prevZ - bz
                };
            }
            prevX = bx; prevY = by; prevZ = bz;
        }
        return null;
    }

    raycastMob(maxDist = 4.2) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        raycaster.far = maxDist;
        const meshes = [];
        this.mobs.forEach(m => m.parts.forEach(p => meshes.push(p.mesh)));
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0 && hits[0].object.userData.mob) {
            return hits[0].object.userData.mob;
        }
        return null;
    }

    primaryAction() {
        this.player.swingTimer = 0.28;
        const mob = this.raycastMob(4.2);
        if (mob) {
            const held = this.player.inventory[this.player.slot];
            const def = held ? BLOCK_DEFS[held.id] : null;
            const dmg = def?.damage || 2;
            mob.hp -= dmg;
            mob.hurtTimer = 0.25;
            const push = mob.pos.clone().sub(this.player.pos).setY(0).normalize();
            mob.vel.x = push.x * 5.5;
            mob.vel.z = push.z * 5.5;
            mob.vel.y = 4.2;

            const killed = mob.hp <= 0;
            this.sfx.playMobHit(killed, def?.toolKind === 'sword');
            if (killed) {
                this.spawnDrop(mob.pos.x, mob.pos.y + 0.6, mob.pos.z, mob.hostile ? 'emerald' : 'apple');
                this.addXP(mob.hostile ? 12 : 5);
                mob.destroy();
                this.mobs = this.mobs.filter(m => m !== mob);
            }
            return;
        }

        const hit = this.raycast(5.5);
        if (!hit) return;
        const def = BLOCK_DEFS[hit.id];
        if (!def || def.unbreakable) return;

        if (this.player.creative) {
            this.sfx.playBlockBreak(hit.id);
            this.world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR, true);
            this.triggerGravityAbove(hit.x, hit.y, hit.z);
        }
    }

    secondaryAction() {
        this.player.swingTimer = 0.24;
        const mob = this.raycastMob(4.2);
        if (mob && mob.type === 'villager') {
            this.sfx.playMobAmbient('villager', 2);
            this.openTradeModal(mob);
            return;
        }

        const held = this.player.inventory[this.player.slot];
        const heldDef = held ? BLOCK_DEFS[held.id] : null;

        if (heldDef?.food && !this.player.creative && this.player.hunger < this.player.maxHunger) {
            this.player.hunger = Math.min(this.player.maxHunger, this.player.hunger + heldDef.food);
            held.count -= 1;
            if (held.count <= 0) this.player.inventory[this.player.slot] = null;
            this.initHotbarUI();
            this.buildHeldItemMesh();
            this.updateStatusBars();
            this.showToast(`😋 Ate ${heldDef.name.split(' (')[0]}!`);
            return;
        }

        const hit = this.raycast(5.5);
        if (!hit) return;

        if (hit.id === BLOCKS.CRAFTING) {
            this.openCraftModal(3);
            return;
        }
        if (hit.id === BLOCKS.TNT) {
            this.world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR, true);
            this.detonateTNT(hit.x, hit.y, hit.z);
            return;
        }
        if (held && held.id === BLOCKS.FLINT_AND_STEEL) {
            if (hit.id === BLOCKS.OBSIDIAN) {
                if (this.tryIgniteNetherPortal(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz)) {
                    this.showToast('🌀 Nether Portal Ignited! Step inside to travel.');
                    return;
                }
            }
            if (hit.id === BLOCKS.TNT) {
                this.world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR, true);
                this.detonateTNT(hit.x, hit.y, hit.z);
                return;
            }
        }

        if (heldDef?.toolKind === 'hoe' && (hit.id === BLOCKS.GRASS || hit.id === BLOCKS.DIRT)) {
            this.sfx.playBlockPlace();
            this.world.setBlock(hit.x, hit.y, hit.z, BLOCKS.FARMLAND, true);
            return;
        }

        if (!held || !heldDef || heldDef.itemOnly) return;

        const px = hit.x + hit.nx;
        const py = hit.y + hit.ny;
        const pz = hit.z + hit.nz;
        const existing = this.world.getBlock(px, py, pz);
        if (existing !== BLOCKS.AIR && existing !== BLOCKS.WATER && existing !== BLOCKS.LAVA) return;

        const playerMinX = this.player.pos.x - 0.28, playerMaxX = this.player.pos.x + 0.28;
        const playerMinY = this.player.pos.y, playerMaxY = this.player.pos.y + 1.72;
        const playerMinZ = this.player.pos.z - 0.28, playerMaxZ = this.player.pos.z + 0.28;
        const overlapsPlayer = !this.player.spectator && heldDef.solid &&
            px + 1 > playerMinX && px < playerMaxX &&
            py + 1 > playerMinY && py < playerMaxY &&
            pz + 1 > playerMinZ && pz < playerMaxZ;
        if (overlapsPlayer) return;

        this.sfx.playBlockPlace();
        this.world.setBlock(px, py, pz, held.id, true);
        if (heldDef.gravity) {
            this.checkSingleGravityBlock(px, py, pz);
        }

        if (!this.player.creative) {
            held.count -= 1;
            if (held.count <= 0) this.player.inventory[this.player.slot] = null;
            this.initHotbarUI();
            this.buildHeldItemMesh();
        }
    }

    updateMining(dt, hit) {
        const wrap = document.getElementById('mining-progress-wrap');
        const fill = document.getElementById('mining-progress-fill');
        const label = document.getElementById('mining-progress-label');

        if (hit) {
            this.targetOutline.visible = true;
            this.targetOutline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        } else {
            this.targetOutline.visible = false;
        }

        if (!this.isPrimaryHeld || !hit || this.player.creative || this.player.spectator) {
            this.miningState = null;
            this.breakOverlay.visible = false;
            if (wrap) wrap.classList.add('hidden');
            return;
        }

        const def = BLOCK_DEFS[hit.id];
        if (!def || def.unbreakable) {
            this.miningState = null;
            this.breakOverlay.visible = false;
            if (wrap) wrap.classList.add('hidden');
            return;
        }

        if (!this.miningState || this.miningState.x !== hit.x || this.miningState.y !== hit.y || this.miningState.z !== hit.z) {
            this.miningState = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
        }

        const held = this.player.inventory[this.player.slot];
        const heldDef = held ? BLOCK_DEFS[held.id] : null;
        let speed = 1.0;
        if (heldDef && def.bestTool && heldDef.toolKind === def.bestTool) {
            speed = heldDef.toolSpeed || 2.0;
        } else if (def.minTier && (!heldDef || heldDef.toolKind !== 'pickaxe')) {
            speed = 0.25;
        }

        const hardness = Math.max(0.2, def.hardness || 1.0);
        this.miningState.progress += (dt * speed) / hardness;
        this.player.swingTimer = 0.22;
        this.sfx.playMineHit(hit.id);

        const pct = Math.min(1, this.miningState.progress);
        this.breakOverlay.visible = true;
        this.breakOverlay.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        this.breakOverlay.material.opacity = pct * 0.62;

        if (wrap && fill && label) {
            wrap.classList.remove('hidden');
            fill.style.width = `${Math.round(pct * 100)}%`;
            label.textContent = `${Math.round(pct * 100)}%`;
        }

        if (this.miningState.progress >= 1.0) {
            this.sfx.playBlockBreak(hit.id);
            const dropId = def.dropItem !== undefined ? def.dropItem : hit.id;
            const toolTier = heldDef?.pickTier || 0;
            const canHarvest = !def.minTier || toolTier >= def.minTier;

            this.world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR, true);
            this.triggerGravityAbove(hit.x, hit.y, hit.z);

            if (hit.id === BLOCKS.EMERALD_ORE && canHarvest) {
                this.spawnDroppedStack(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, BLOCKS.EMERALD, 1);
                this.showToast('💎 Mined Emerald Ore!');
            } else if (canHarvest && dropId && dropId !== BLOCKS.AIR) {
                const actualDrop = (hit.id === BLOCKS.GRAVEL && Math.random() < 0.22) ? BLOCKS.FLINT : dropId;
                this.spawnDroppedStack(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, actualDrop, 1);
            }
            this.addXP(2);
            this.miningState = null;
            this.breakOverlay.visible = false;
            if (wrap) wrap.classList.add('hidden');
        }
    }

    tryIgniteNetherPortal(x, y, z) {
        const buildPortalAlongAxis = (alongX) => {
            const frame = [];
            const interior = [];
            for (let dx = -1; dx <= 2; dx++) {
                for (let dy = -1; dy <= 3; dy++) {
                    const bx = alongX ? x + dx : x;
                    const by = y + dy;
                    const bz = alongX ? z : z + dx;
                    const isBorder = dx === -1 || dx === 2 || dy === -1 || dy === 3;
                    const isCorner = (dx === -1 || dx === 2) && (dy === -1 || dy === 3);
                    if (isBorder && !isCorner) {
                        frame.push([bx, by, bz]);
                    } else if (!isBorder) {
                        interior.push([bx, by, bz]);
                    }
                }
            }
            const frameValid = frame.every(([fx, fy, fz]) => this.world.getBlock(fx, fy, fz) === BLOCKS.OBSIDIAN);
            const interiorEmpty = interior.every(([ix, iy, iz]) => this.world.getBlock(ix, iy, iz) === BLOCKS.AIR);
            if (frameValid && interiorEmpty) {
                interior.forEach(([ix, iy, iz]) => this.world.setBlock(ix, iy, iz, BLOCKS.PORTAL, false));
                for (const c of this.world.chunks.values()) {
                    if (c.dirty) {
                        this.world.computeChunkLight(c);
                        this.world.buildChunkMesh(c);
                    }
                }
                return true;
            }
            return false;
        };
        return buildPortalAlongAxis(true) || buildPortalAlongAxis(false);
    }

    switchDimension() {
        if (this.isSwitchingDimension) return;
        this.isSwitchingDimension = true;
        this.player.portalCooldown = 4.0;

        const nextDim = this.world.dimension === 'overworld' ? 'nether' : 'overworld';
        const overlay = document.getElementById('portal-loading-overlay');
        const titleEl = document.getElementById('portal-loading-title');
        const subEl = document.getElementById('portal-loading-sub');
        if (overlay) {
            overlay.style.backgroundImage = `url(${getTileDataURL(this.atlas, 46)})`;
            overlay.classList.remove('hidden');
        }
        if (titleEl) {
            titleEl.textContent = nextDim === 'nether' ? '🌀 ENTERING THE NETHER...' : '🌿 RETURNING TO OVERWORLD...';
        }
        if (subEl) {
            subEl.textContent = 'Generating dimension terrain & lighting...';
        }

        setTimeout(() => {
            for (const c of this.world.chunks.values()) {
                if (c.opaqueMesh) { this.scene.remove(c.opaqueMesh); c.opaqueMesh.geometry.dispose(); }
                if (c.transMesh) { this.scene.remove(c.transMesh); c.transMesh.geometry.dispose(); }
            }
            this.world.chunks.clear();
            this.world.liquidQueue.clear();
            this.mobs.forEach(m => m.destroy());
            this.mobs = [];

            this.world.dimension = nextDim;
            const destX = nextDim === 'nether' ? Math.floor(this.player.pos.x / 4) : Math.floor(this.player.pos.x * 4);
            const destZ = nextDim === 'nether' ? Math.floor(this.player.pos.z / 4) : Math.floor(this.player.pos.z * 4);
            const pcx = Math.floor(destX / CHUNK_SIZE);
            const pcz = Math.floor(destZ / CHUNK_SIZE);

            for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
                for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
                    this.world.ensureChunk(pcx + dx, pcz + dz);
                }
            }

            this.spawnPlayerSafely(destX, destZ);
            const px = Math.floor(this.player.pos.x) + 2;
            const py = Math.floor(this.player.pos.y) - 1;
            const pz = Math.floor(this.player.pos.z);

            for (let dx = -1; dx <= 2; dx++) {
                for (let dy = 0; dy <= 4; dy++) {
                    const isBorder = dx === -1 || dx === 2 || dy === 0 || dy === 4;
                    this.world.setBlock(px + dx, py + dy, pz, isBorder ? BLOCKS.OBSIDIAN : BLOCKS.PORTAL, false);
                }
            }

            for (const c of this.world.chunks.values()) {
                this.world.computeChunkLight(c);
                this.world.buildChunkMesh(c);
            }

            if (overlay) overlay.classList.add('hidden');
            this.isSwitchingDimension = false;
            this.showToast(nextDim === 'nether' ? '🔥 Arrived in the Crimson Nether!' : '🌿 Returned to the Skybound Overworld!');
        }, 120);
    }

    detonateTNT(cx, cy, cz) {
        this.sfx.playExplosion();
        this.worldPointLight.position.set(cx + 0.5, cy + 0.5, cz + 0.5);
        this.explosionLightTimer = 0.65;
        const radius = 3.6;
        const rCeil = Math.ceil(radius);
        for (let dx = -rCeil; dx <= rCeil; dx++) {
            for (let dy = -rCeil; dy <= rCeil; dy++) {
                for (let dz = -rCeil; dz <= rCeil; dz++) {
                    if (Math.hypot(dx, dy, dz) <= radius) {
                        const bx = cx + dx, by = cy + dy, bz = cz + dz;
                        const id = this.world.getBlock(bx, by, bz);
                        if (id !== BLOCKS.AIR && !BLOCK_DEFS[id]?.unbreakable) {
                            this.world.setBlock(bx, by, bz, BLOCKS.AIR, false);
                        }
                    }
                }
            }
        }
        for (const c of this.world.chunks.values()) {
            if (c.dirty) {
                this.world.computeChunkLight(c);
                this.world.buildChunkMesh(c);
            }
        }
    }

    checkSingleGravityBlock(x, y, z) {
        const id = this.world.getBlock(x, y, z);
        if (!BLOCK_DEFS[id]?.gravity) return;
        const below = this.world.getBlock(x, y - 1, z);
        if (below === BLOCKS.AIR || below === BLOCKS.WATER || below === BLOCKS.LAVA) {
            this.world.setBlock(x, y, z, BLOCKS.AIR, true);
            const def = BLOCK_DEFS[id];
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.98, 0.98, 0.98),
                new THREE.MeshLambertMaterial({ color: def.color || '#fde047' })
            );
            mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
            this.scene.add(mesh);
            this.fallingBlocks.push({ mesh, id, x: x + 0.5, y: y + 0.5, z: z + 0.5, vy: 0 });
            this.triggerGravityAbove(x, y, z);
        }
    }

    triggerGravityAbove(x, y, z) {
        for (let checkY = y + 1; checkY < CHUNK_HEIGHT - 1; checkY++) {
            const id = this.world.getBlock(x, checkY, z);
            if (BLOCK_DEFS[id]?.gravity) {
                this.checkSingleGravityBlock(x, checkY, z);
            } else {
                break;
            }
        }
    }

    updateFallingBlocks(dt) {
        for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
            const fb = this.fallingBlocks[i];
            fb.vy = Math.max(-26, fb.vy - 24 * dt);
            fb.y += fb.vy * dt;
            fb.mesh.position.y = fb.y;
            const belowId = this.world.getBlock(fb.x, fb.y - 0.52, fb.z);
            if (belowId !== BLOCKS.AIR && belowId !== BLOCKS.WATER && belowId !== BLOCKS.LAVA) {
                const landY = Math.floor(fb.y - 0.52) + 1;
                this.world.setBlock(Math.floor(fb.x), landY, Math.floor(fb.z), fb.id, true);
                this.scene.remove(fb.mesh);
                fb.mesh.geometry.dispose();
                fb.mesh.material.dispose();
                this.fallingBlocks.splice(i, 1);
            }
        }
    }

    dropSelectedItem(dropFullStack = false) {
        const stack = this.player.inventory[this.player.slot];
        if (!stack) return;
        const dropCount = dropFullStack ? stack.count : 1;
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
        this.spawnDroppedStack(
            this.camera.position.x + dir.x * 0.6,
            this.camera.position.y - 0.2,
            this.camera.position.z + dir.z * 0.6,
            stack.id,
            dropCount,
            dir
        );
        stack.count -= dropCount;
        if (stack.count <= 0) this.player.inventory[this.player.slot] = null;
        this.initHotbarUI();
        this.buildHeldItemMesh();
    }

    spawnDroppedStack(x, y, z, itemId, count = 1, throwDir = null) {
        const def = BLOCK_DEFS[itemId];
        let mesh;
        if (!def || def.itemOnly) {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.28, 0.28, 0.08),
                new THREE.MeshLambertMaterial({ color: def?.color || '#38bdf8' })
            );
        } else {
            const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
            const cols = this.atlas.cols;
            const rows = this.atlas.rows;
            const tileIdx = def.tex ? (def.tex.all !== undefined ? def.tex.all : def.tex.side) : 0;
            const tx = tileIdx % cols;
            const ty = Math.floor(tileIdx / cols);
            const u0 = tx / cols + 0.002;
            const u1 = (tx + 1) / cols - 0.002;
            const vTop = 1 - (ty / rows + 0.002);
            const vBot = 1 - ((ty + 1) / rows - 0.002);
            const uvAttr = geo.attributes.uv;
            for (let i = 0; i < uvAttr.count; i += 4) {
                uvAttr.setXY(i, u0, vTop);
                uvAttr.setXY(i + 1, u1, vTop);
                uvAttr.setXY(i + 2, u0, vBot);
                uvAttr.setXY(i + 3, u1, vBot);
            }
            mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.atlas.tex }));
        }
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        const vel = throwDir
            ? new THREE.Vector3(throwDir.x * 5.2, Math.max(1.8, throwDir.y * 4.5 + 2.2), throwDir.z * 5.2)
            : new THREE.Vector3(0, 2.2, 0);
        this.drops.push({
            mesh,
            kind: 'item',
            itemId,
            count,
            vel,
            pickupDelay: 0.65,
            age: 0
        });
    }

    spawnDrop(x, y, z, kind) {
        const color = kind === 'emerald' ? 0x10b981 : 0xf43f5e;
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.28, 0.28),
            new THREE.MeshBasicMaterial({ color })
        );
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        this.drops.push({ mesh, kind, age: 0 });
    }

    getTotalEmeraldCount() {
        let inventoryCount = 0;
        for (const stack of this.player.inventory) {
            if (stack && stack.id === BLOCKS.EMERALD) inventoryCount += stack.count;
        }
        return this.player.emeralds + inventoryCount;
    }

    consumeEmeralds(cost) {
        let remaining = cost;
        for (let i = 0; i < this.player.inventory.length && remaining > 0; i++) {
            const stack = this.player.inventory[i];
            if (!stack || stack.id !== BLOCKS.EMERALD) continue;
            const take = Math.min(stack.count, remaining);
            stack.count -= take;
            remaining -= take;
            if (stack.count <= 0) this.player.inventory[i] = null;
        }
        if (remaining > 0) {
            this.player.emeralds = Math.max(0, this.player.emeralds - remaining);
        }
        this.initHotbarUI();
        this.buildHeldItemMesh();
    }





    requestSafePointerLock() {
        if (this.lastPointerLockExit && performance.now() - this.lastPointerLockExit < 1300) return;
        try {
            const p = this.canvas.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {}
    }

    setupInputs() {
        this.keys = {};
        this.isPrimaryHeld = false;
        this.isLeftSplitDragging = false;
        this.splitVisitedSlots = new Map();
        this.splitOriginalCount = 0;
        this.isDraggingLook = false;
        this.lastPointerLockExit = 0;
        let touchLookId = null;
        let lastTouchX = 0;
        let lastTouchY = 0;

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement !== this.canvas) {
                this.lastPointerLockExit = performance.now();
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.sfx.unlock();
            if (!this.isPlaying) return;
            if (document.pointerLockElement !== this.canvas) {
                this.requestSafePointerLock();
            }
            if (e.button === 0) {
                this.isPrimaryHeld = true;
                this.isDraggingLook = true;
                this.primaryAction();
            } else if (e.button === 2) {
                this.secondaryAction();
            }
        });

        window.addEventListener('mousemove', (e) => {
            const cursorEl = document.getElementById('cursor-held-item');
            if (cursorEl && !cursorEl.classList.contains('hidden')) {
                cursorEl.style.left = `${e.clientX}px`;
                cursorEl.style.top = `${e.clientY}px`;
            }
            if (!this.isPlaying) return;
            if (document.pointerLockElement === this.canvas || this.isDraggingLook) {
                this.player.targetYaw -= e.movementX * 0.0024;
                this.player.targetPitch -= e.movementY * 0.0024;
                this.player.targetPitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.player.targetPitch));
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isPrimaryHeld = false;
            this.isLeftSplitDragging = false;
            this.isDraggingLook = false;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            this.sfx.unlock();
            if (!this.isPlaying) return;
            if (touchLookId === null && e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                touchLookId = t.identifier;
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            this.isLeftSplitDragging = false;
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isPlaying || touchLookId === null) return;
            for (const t of e.changedTouches) {
                if (t.identifier === touchLookId) {
                    const dx = t.clientX - lastTouchX;
                    const dy = t.clientY - lastTouchY;
                    lastTouchX = t.clientX;
                    lastTouchY = t.clientY;
                    this.player.targetYaw -= dx * 0.005;
                    this.player.targetPitch -= dy * 0.005;
                    this.player.targetPitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.player.targetPitch));
                }
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === touchLookId) touchLookId = null;
            }
        }, { passive: true });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('wheel', (e) => {
            if (!this.isPlaying) return;
            this.selectSlot(this.player.slot + (e.deltaY > 0 ? 1 : -1));
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            this.sfx.unlock();
            const code = e.code;
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            this.keys[code] = true;

            if (!this.isPlaying) return;

            if (code.startsWith('Digit')) {
                const num = parseInt(code.replace('Digit', ''), 10);
                if (num >= 1 && num <= 9) this.selectSlot(num - 1);
            } else if (code === 'KeyE') {
                const creativeOpen = !document.getElementById('creative-modal').classList.contains('hidden');
                const craftOpen = !document.getElementById('craft-modal').classList.contains('hidden');
                if (creativeOpen) this.closeCreativeModal();
                else if (craftOpen) this.closeCraftModal();
                else if (this.player.creative) this.openCreativeModal();
                else this.openCraftModal(2);
            } else if (code === 'KeyC') {
                this.setGameMode(this.player.creative ? 'survival' : 'creative');
            } else if (code === 'KeyG') {
                this.setGameMode(this.player.spectator ? 'survival' : 'spectator');
            } else if (code === 'KeyQ') {
                this.dropSelectedItem(e.ctrlKey || e.metaKey);
            } else if (code === 'KeyT') {
                this.timeOfDay = (this.timeOfDay + 0.5) % 1.0;
                this.showToast(this.timeOfDay > 0.2 && this.timeOfDay < 0.75 ? '☀️ Daytime' : '🌙 Nighttime');
            } else if (code === 'KeyV') {
                this.weather = (this.weather + 1) % 3;
                const wNames = ['🌤️ Clear', '🌧️ Aether Rain', '🌠 Starfall'];
                document.getElementById('hud-weather').textContent = wNames[this.weather];
                this.showToast(`Weather: ${wNames[this.weather]}`);
            } else if (code === 'KeyR') {
                this.spawnPlayerSafely(this.player.pos.x, this.player.pos.z);
                this.showToast('🧭 Teleported to Safe Land');
            } else if (code === 'Space') {
                const now = performance.now();
                if ((this.player.creative || this.player.spectator) && now - this.player.lastSpaceTap < 280) {
                    this.player.flying = !this.player.flying;
                    this.player.vel.y = 0;
                }
                this.player.lastSpaceTap = now;
                if (!this.player.flying && this.player.onGround) {
                    this.player.vel.y = 8.4;
                    this.player.onGround = false;
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // UI Buttons
        document.getElementById('btn-play').onclick = () => {
            this.sfx.unlock();
            document.getElementById('title-overlay').classList.add('hidden');
            const loadOverlay = document.getElementById('world-loading-overlay');
            const loadBar = document.getElementById('world-loading-bar');
            const loadStatus = document.getElementById('world-loading-status');
            if (loadOverlay) loadOverlay.classList.remove('hidden');

            this.initWorldAndVillages(
                (pct, msg) => {
                    if (loadBar) loadBar.style.width = `${pct}%`;
                    if (loadStatus) loadStatus.textContent = msg;
                },
                () => {
                    this.spawnPlayerSafely(0, 0);
                    this.syncCameraTransform();
                    this.initHotbarUI();
                    this.updateStatusBars();

                    if (loadOverlay) loadOverlay.classList.add('hidden');
                    this.isPlaying = true;
                    document.getElementById('hud-top')?.classList.remove('hidden');
                    document.getElementById('hud-bottom')?.classList.remove('hidden');
                    document.getElementById('crosshair')?.classList.remove('hidden');
                    const mobileControls = document.getElementById('mobile-controls');
                    mobileControls?.classList.remove('hidden');
                    const disclaimerBadge = document.getElementById('ai-disclaimer-badge');
                    if (disclaimerBadge && mobileControls) {
                        const mobileEnabled = !mobileControls.classList.contains('hidden') && window.getComputedStyle(mobileControls).display !== 'none';
                        disclaimerBadge.classList.toggle('hidden', mobileEnabled);
                        disclaimerBadge.classList.toggle('md:block', !mobileEnabled);
                    }
                    this.requestSafePointerLock();
                }
            );
        };

        document.getElementById('btn-safe-land').onclick = () => {
            this.sfx.unlock();
            this.spawnPlayerSafely(this.player.pos.x, this.player.pos.z);
            this.showToast('🧭 Teleported to Safe Land');
        };

        document.getElementById('btn-mute-audio').onclick = (e) => {
            this.sfx.unlock();
            const isMuted = this.sfx.setMuted(!this.sfx.muted);
            e.currentTarget.textContent = isMuted ? '🔇' : '🔊';
            this.showToast(isMuted ? '🔇 Sound Effects Muted' : '🔊 Sound Effects Enabled');
        };

        document.getElementById('btn-close-craft').onclick = () => this.closeCraftModal();
        document.getElementById('btn-close-creative').onclick = () => this.closeCreativeModal();
        document.getElementById('btn-clear-inv').onclick = () => {
            for (let i = 0; i < 9; i++) this.player.inventory[i] = null;
            this.initHotbarUI();
            this.buildHeldItemMesh();
            this.renderCreativeModal();
        };
        document.getElementById('creative-search').oninput = (e) => {
            this.creativeSearchQuery = e.target.value;
            this.renderCreativeModal();
        };
        document.getElementById('btn-close-trade').onclick = () => this.closeTradeModal();

        const bindHold = (id, keyCode) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.sfx.unlock(); this.keys[keyCode] = true; });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.keys[keyCode] = false; });
        };
        bindHold('btn-m-fwd', 'KeyW');
        bindHold('btn-m-back', 'KeyS');
        bindHold('btn-m-left', 'KeyA');
        bindHold('btn-m-right', 'KeyD');
        bindHold('btn-m-jump', 'Space');

        const mMine = document.getElementById('btn-m-mine');
        if (mMine) {
            mMine.addEventListener('touchstart', (e) => { e.preventDefault(); this.sfx.unlock(); this.isPrimaryHeld = true; this.primaryAction(); });
            mMine.addEventListener('touchend', (e) => { e.preventDefault(); this.isPrimaryHeld = false; });
        }
        const mPlace = document.getElementById('btn-m-place');
        if (mPlace) {
            mPlace.addEventListener('touchstart', (e) => { e.preventDefault(); this.sfx.unlock(); this.secondaryAction(); });
        }
        const mDrop = document.getElementById('btn-m-drop');
        if (mDrop) {
            mDrop.addEventListener('touchstart', (e) => { e.preventDefault(); this.sfx.unlock(); this.dropSelectedItem(false); });
        }
        const mCraft = document.getElementById('btn-m-craft');
        if (mCraft) {
            mCraft.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.sfx.unlock();
                if (this.player.creative) this.openCreativeModal();
                else this.openCraftModal(2);
            });
        }

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            const mobileControls = document.getElementById('mobile-controls');
            const disclaimerBadge = document.getElementById('ai-disclaimer-badge');
            if (disclaimerBadge && mobileControls) {
                const mobileEnabled = !mobileControls.classList.contains('hidden') && window.getComputedStyle(mobileControls).display !== 'none';
                disclaimerBadge.classList.toggle('hidden', mobileEnabled);
                disclaimerBadge.classList.toggle('md:block', !mobileEnabled);
            }
        });
    }

    updateDayNightAndLighting(dt) {
        if (this.world.dimension === 'nether') {
            this.world.daylightFactor = 0.25;
            this.skyColor.setRGB(0.24, 0.04, 0.04);
            this.scene.background.copy(this.skyColor);
            this.scene.fog.color.copy(this.skyColor);
            this.scene.fog.near = 14;
            this.scene.fog.far = 48;
            this.hemiLight.intensity = 0.55;
            this.hemiLight.color.setRGB(0.95, 0.35, 0.25);
            this.sunLight.intensity = 0.35;
        } else {
            this.timeOfDay = (this.timeOfDay + dt * 0.004) % 1.0;
            const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
            const sunHeight = Math.cos(sunAngle);
            const rawDay = Math.max(0.14, Math.min(1.0, (sunHeight + 0.35) / 1.15));

            if (Math.abs(rawDay - this.world.daylightFactor) > 0.04) {
                this.world.daylightFactor = rawDay;
                for (const chunk of this.world.chunks.values()) {
                    this.world.buildChunkMesh(chunk);
                }
            }

            const dayCol = new THREE.Color('#7dd3fc');
            const nightCol = new THREE.Color('#090d16');
            this.skyColor.copy(nightCol).lerp(dayCol, rawDay);
            this.scene.background.copy(this.skyColor);
            this.scene.fog.color.copy(this.skyColor);
            this.scene.fog.near = 28;
            this.scene.fog.far = 66;
            this.hemiLight.intensity = 0.28 + rawDay * 0.52;
            this.hemiLight.color.setRGB(0.94, 0.98, 1.0);
            this.sunLight.intensity = 0.12 + rawDay * 0.72;
        }

        const held = this.player.inventory[this.player.slot];
        const heldDef = held ? BLOCK_DEFS[held.id] : null;
        if (heldDef?.heldLight) {
            this.heldPointLight.position.copy(this.camera.position);
            this.heldPointLight.color.setHex(heldDef.heldLight.color);
            this.heldPointLight.intensity = heldDef.heldLight.intensity;
            this.heldPointLight.distance = heldDef.heldLight.distance;
        } else {
            this.heldPointLight.intensity = 0;
        }

        if (this.explosionLightTimer > 0) {
            this.explosionLightTimer -= dt;
            this.worldPointLight.intensity = Math.max(0, this.explosionLightTimer * 7.5);
        }

        const pLight = this.world.getLightAt(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z);
        const lightEl = document.getElementById('hud-light');
        if (lightEl) lightEl.textContent = `☀️ Light: ${pLight.combined}/15`;
    }

    updatePlayer(dt) {
        const lerpFactor = 1 - Math.exp(-38 * dt);
        this.player.yaw += (this.player.targetYaw - this.player.yaw) * lerpFactor;
        this.player.pitch += (this.player.targetPitch - this.player.pitch) * lerpFactor;

        const forward = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
        const right = new THREE.Vector3(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw));
        const move = new THREE.Vector3();

        if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(forward);
        if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(forward);
        if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
        if (move.lengthSq() > 0) move.normalize();

        const sprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const speed = (this.player.spectator ? 12 : (this.player.flying ? 9.5 : (sprinting ? 6.8 : 4.6)));

        const feetBlock = this.world.getBlock(this.player.pos.x, this.player.pos.y + 0.2, this.player.pos.z);
        const inWater = feetBlock === BLOCKS.WATER;
        const inLava = feetBlock === BLOCKS.LAVA;
        const inPortal = feetBlock === BLOCKS.PORTAL || this.world.getBlock(this.player.pos.x, this.player.pos.y + 1.0, this.player.pos.z) === BLOCKS.PORTAL;

        if (this.player.portalCooldown > 0) {
            this.player.portalCooldown -= dt;
        } else if (inPortal) {
            this.switchDimension();
            return;
        }

        if (inLava && !this.player.creative && !this.player.spectator) {
            this.player.lavaBurnTimer += dt;
            if (this.player.lavaBurnTimer >= 0.45) {
                this.player.lavaBurnTimer = 0;
                this.player.hp = Math.max(0, this.player.hp - 4);
                this.updateStatusBars();
                this.showToast('🔥 Burning in Molten Lava!');
                if (this.player.hp <= 0) {
                    this.player.hp = this.player.maxHp;
                    this.player.hunger = this.player.maxHunger;
                    this.spawnPlayerSafely(0, 0);
                    this.updateStatusBars();
                    this.showToast('💀 You melted in lava! Respawned safely.');
                }
            }
        } else {
            this.player.lavaBurnTimer = 0;
        }

        this.player.vel.x = move.x * speed;
        this.player.vel.z = move.z * speed;

        if (this.player.flying) {
            this.player.vel.y = 0;
            if (this.keys['Space']) this.player.vel.y = 7.5;
            if (this.keys['ControlLeft'] || this.keys['KeyX']) this.player.vel.y = -7.5;
        } else if (inWater) {
            this.player.vel.y = Math.max(-2.5, this.player.vel.y - 10 * dt);
            if (this.keys['Space']) this.player.vel.y = 4.4;
        } else {
            this.player.vel.y = Math.max(-32, this.player.vel.y - 24 * dt);
        }

        const nx = this.player.pos.x + this.player.vel.x * dt;
        if (!this.collidesAt(nx, this.player.pos.y, this.player.pos.z)) {
            this.player.pos.x = nx;
        }

        const nz = this.player.pos.z + this.player.vel.z * dt;
        if (!this.collidesAt(this.player.pos.x, this.player.pos.y, nz)) {
            this.player.pos.z = nz;
        }

        const ny = this.player.pos.y + this.player.vel.y * dt;
        if (!this.collidesAt(this.player.pos.x, ny, this.player.pos.z)) {
            this.player.pos.y = ny;
            this.player.onGround = false;
            if (this.player.pos.y > this.player.highestY) {
                this.player.highestY = this.player.pos.y;
            }
        } else {
            if (this.player.vel.y < 0) {
                const fallDist = this.player.highestY - this.player.pos.y;
                if (fallDist > 3.6 && !inWater && !this.player.creative && !this.player.spectator) {
                    const dmg = Math.floor(fallDist - 3);
                    if (dmg > 0) {
                        this.player.hp = Math.max(0, this.player.hp - dmg);
                        this.sfx.playFallDamage(dmg);
                        this.updateStatusBars();
                        if (this.player.hp <= 0) {
                            this.player.hp = this.player.maxHp;
                            this.player.hunger = this.player.maxHunger;
                            this.spawnPlayerSafely(0, 0);
                            this.updateStatusBars();
                            this.showToast('💀 You fell from a high place! Respawned safely.');
                        }
                    }
                }
                this.player.onGround = true;
                this.player.highestY = this.player.pos.y;
            }
            this.player.vel.y = 0;
        }

        // Footsteps & View Bobbing
        const horizSpeed = Math.hypot(this.player.vel.x, this.player.vel.z);
        if (this.player.onGround && horizSpeed > 0.4) {
            this.player.bobTimer += dt * horizSpeed * 1.6;
            this.player.stepDistance += horizSpeed * dt;
            const strideLength = sprinting ? 2.55 : 2.15;
            if (this.player.stepDistance >= strideLength) {
                this.player.stepDistance = 0;
                const blockBelow = this.world.getBlock(this.player.pos.x, this.player.pos.y - 0.15, this.player.pos.z);
                this.sfx.playFootstep(blockBelow, sprinting);
            }
        } else {
            this.player.bobTimer = 0;
            if (!this.player.onGround) this.player.stepDistance = 0;
        }

        const bobOffset = Math.sin(this.player.bobTimer) * 0.045;
        this.camera.position.set(this.player.pos.x, this.player.pos.y + 1.62 + bobOffset, this.player.pos.z);
        this.syncCameraTransform();

        if (this.heldPivot) {
            if (this.player.swingTimer > 0) {
                this.player.swingTimer = Math.max(0, this.player.swingTimer - dt);
                const swing = Math.sin((1 - this.player.swingTimer / 0.28) * Math.PI);
                this.heldPivot.rotation.x = 0.15 - swing * 0.95;
                this.heldPivot.position.z = -0.52 - swing * 0.14;
            } else {
                this.heldPivot.rotation.x = 0.15 + Math.cos(this.player.bobTimer) * 0.03;
                this.heldPivot.position.z = -0.52;
            }
        }

        const pcx = Math.floor(this.player.pos.x / CHUNK_SIZE);
        const pcz = Math.floor(this.player.pos.z / CHUNK_SIZE);
        const dirtyChunks = [];
        for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
            for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
                const c = this.world.ensureChunk(pcx + dx, pcz + dz);
                if (c.dirty) {
                    dirtyChunks.push({ c, distSq: dx * dx + dz * dz });
                }
            }
        }
        // Budget chunk mesh rebuilds per frame (closest first) to prevent frame spikes when exploring
        if (dirtyChunks.length > 0) {
            dirtyChunks.sort((a, b) => a.distSq - b.distSq);
            const budget = Math.min(dirtyChunks.length, 2);
            for (let i = 0; i < budget; i++) {
                const targetChunk = dirtyChunks[i].c;
                this.world.computeChunkLight(targetChunk);
                this.world.buildChunkMesh(targetChunk);
            }
        }

        const coordsEl = document.getElementById('hud-coords');
        if (coordsEl) {
            coordsEl.textContent = `XYZ: ${Math.floor(this.player.pos.x)}, ${Math.floor(this.player.pos.y)}, ${Math.floor(this.player.pos.z)}`;
        }
    }

    updateMobsAndDrops(dt) {
        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const m = this.mobs[i];
            m.aiTimer -= dt;
            m.soundTimer -= dt;
            if (m.hurtTimer > 0) m.hurtTimer -= dt;
            if (m.attackCooldown > 0) m.attackCooldown -= dt;

            const toPlayer = this.player.pos.clone().sub(m.pos);
            const dist = toPlayer.length();

            // Periodic ambient animal & monster vocalizations with distance attenuation
            if (m.soundTimer <= 0 && dist < 24) {
                this.sfx.playMobAmbient(m.type, dist);
                m.soundTimer = m.hostile ? (5.0 + Math.random() * 6.0) : (6.5 + Math.random() * 8.0);
            }

            if (m.hostile && this.world.daylightFactor > 0.72 && this.world.dimension === 'overworld') {
                const skyHere = this.world.getLightAt(m.pos.x, m.pos.y + 1, m.pos.z).sky;
                if (skyHere >= 13) {
                    m.burnTimer += dt;
                    if (m.burnTimer >= 1.2) {
                        m.burnTimer = 0;
                        m.hp -= 3;
                        m.hurtTimer = 0.25;
                        if (m.hp <= 0) {
                            this.spawnDrop(m.pos.x, m.pos.y + 0.6, m.pos.z, 'emerald');
                            m.destroy();
                            this.mobs.splice(i, 1);
                            continue;
                        }
                    }
                }
            }

            if (m.hostile && !this.player.creative && !this.player.spectator && dist < 14) {
                m.targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
                if (m.type === 'creeper' && dist < 2.8) {
                    if (!m.hissPlayed) {
                        m.hissPlayed = true;
                        this.sfx.playMobAmbient('creeper', dist);
                    }
                    m.fuseTimer += dt;
                    if (m.fuseTimer >= 1.35) {
                        this.detonateTNT(Math.floor(m.pos.x), Math.floor(m.pos.y), Math.floor(m.pos.z));
                        m.destroy();
                        this.mobs.splice(i, 1);
                        continue;
                    }
                } else {
                    m.fuseTimer = Math.max(0, m.fuseTimer - dt);
                    if (m.fuseTimer === 0) m.hissPlayed = false;
                    m.vel.x = Math.sin(m.targetYaw) * 2.5;
                    m.vel.z = Math.cos(m.targetYaw) * 2.5;
                    if (dist < 1.8 && m.attackCooldown <= 0) {
                        m.attackCooldown = 1.2;
                        this.player.hp = Math.max(0, this.player.hp - 2);
                        this.updateStatusBars();
                        if (this.player.hp <= 0) {
                            this.player.hp = this.player.maxHp;
                            this.spawnPlayerSafely(0, 0);
                            this.updateStatusBars();
                            this.showToast('💀 Defeated by a monster! Respawned safely.');
                        }
                    }
                }
            } else {
                if (m.aiTimer <= 0) {
                    m.aiTimer = 2 + Math.random() * 3.5;
                    m.targetYaw = Math.random() * Math.PI * 2;
                    const moveChance = Math.random() > 0.45 ? 1.2 : 0;
                    m.vel.x = Math.sin(m.targetYaw) * moveChance;
                    m.vel.z = Math.cos(m.targetYaw) * moveChance;
                }
            }


            m.vel.y = Math.max(-24, m.vel.y - 22 * dt);
            const nextX = m.pos.x + m.vel.x * dt;
            const nextZ = m.pos.z + m.vel.z * dt;
            const blockAhead = this.world.getBlock(nextX, m.pos.y + 0.4, nextZ);
            if (blockAhead !== BLOCKS.AIR && blockAhead !== BLOCKS.WATER) {
                m.vel.y = 6.2;
            } else {
                m.pos.x = nextX;
                m.pos.z = nextZ;
            }

            const nextY = m.pos.y + m.vel.y * dt;
            const groundId = this.world.getBlock(m.pos.x, nextY, m.pos.z);
            if (groundId !== BLOCKS.AIR && groundId !== BLOCKS.WATER) {
                m.pos.y = Math.floor(nextY) + 1.005;
                m.vel.y = 0;
            } else {
                m.pos.y = nextY;
            }

            m.group.position.copy(m.pos);
            m.group.rotation.y = m.targetYaw;
            const moveSpd = Math.hypot(m.vel.x, m.vel.z);
            if (moveSpd > 0.15) {
                m.walkCycle += dt * moveSpd * 4;
                m.limbs.forEach((limb, idx) => {
                    limb.rotation.x = Math.sin(m.walkCycle + (idx % 2 === 0 ? 0 : Math.PI)) * 0.45;
                });
            }
            m.parts.forEach(p => {
                if (m.hurtTimer > 0) p.mesh.material.color.setHex(0xef4444);
                else p.mesh.material.color.copy(p.baseColor);
            });
        }

        if (this.world.daylightFactor < 0.42 && this.mobs.filter(m => m.hostile).length < 6 && Math.random() < dt * 0.35) {
            const a = Math.random() * Math.PI * 2;
            const r = 16 + Math.random() * 14;
            const sx = Math.floor(this.player.pos.x + Math.cos(a) * r) + 0.5;
            const sz = Math.floor(this.player.pos.z + Math.sin(a) * r) + 0.5;
            const sy = this.world.getTerrainHeight(sx, sz);
            if (sy > WATER_LEVEL) {
                const hTypes = ['zombie', 'skeleton', 'creeper'];
                this.mobs.push(new MobEntity(this.scene, hTypes[Math.floor(Math.random() * hTypes.length)], sx, sy + 1.01, sz));
            }
        }

        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.age += dt;
            if (d.pickupDelay > 0) d.pickupDelay -= dt;
            d.mesh.rotation.y += dt * 2.4;

            if (d.kind === 'item' && d.vel) {
                d.vel.y = Math.max(-18, d.vel.y - 20 * dt);
                const nx = d.mesh.position.x + d.vel.x * dt;
                const nz = d.mesh.position.z + d.vel.z * dt;
                const bWall = this.world.getBlock(nx, d.mesh.position.y, nz);
                if (bWall === BLOCKS.AIR || bWall === BLOCKS.WATER) {
                    d.mesh.position.x = nx;
                    d.mesh.position.z = nz;
                } else {
                    d.vel.x *= -0.3;
                    d.vel.z *= -0.3;
                }
                const ny = d.mesh.position.y + d.vel.y * dt;
                const bFloor = this.world.getBlock(d.mesh.position.x, ny - 0.14, d.mesh.position.z);
                if (bFloor !== BLOCKS.AIR && bFloor !== BLOCKS.WATER) {
                    d.mesh.position.y = Math.floor(ny - 0.14) + 1.15;
                    d.vel.y = 0;
                    d.vel.x *= 0.72;
                    d.vel.z *= 0.72;
                } else {
                    d.mesh.position.y = ny;
                }
            } else {
                d.mesh.position.y += Math.sin(d.age * 4) * dt * 0.25;
            }

            const canPickup = !d.pickupDelay || d.pickupDelay <= 0;
            if (canPickup && d.mesh.position.distanceTo(this.player.pos) < 1.8) {
                if (d.kind === 'item') {
                    this.giveItem(d.itemId, d.count);
                    if (d.itemId === BLOCKS.EMERALD) {
                        this.showToast(`💎 Picked up +${d.count} Emerald Gem!`);
                    }
                } else if (d.kind === 'emerald') {
                    this.giveItem(BLOCKS.EMERALD, 1);
                    this.showToast('💎 Picked up +1 Emerald Gem!');
                } else {
                    this.giveItem(BLOCKS.APPLE, 1);
                    this.showToast('🍎 Collected Sky Apple!');
                }
                this.updateStatusBars();
                this.scene.remove(d.mesh);
                d.mesh.geometry.dispose();
                d.mesh.material.dispose();
                this.drops.splice(i, 1);
            }
        }
    }

    start() {
        this.setupInputs();
        this.initHotbarUI();
        this.updateStatusBars();

        let lastTime = performance.now();
        const loop = (now) => {
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            if (this.isPlaying && !this.isSwitchingDimension) {
                this.updateDayNightAndLighting(dt);
                this.updateFallingBlocks(dt);
                this.world.updateLiquids(dt, this.player.pos.x, this.player.pos.z, this.sfx);
                this.updatePlayer(dt);
                const hit = this.raycast(5.5);
                this.updateMining(dt, hit);
                this.updateMobsAndDrops(dt);
                this.world.updateVisibilityAndUnload(this.camera, this.player.pos.x, this.player.pos.z);
                this.renderer.render(this.scene, this.camera);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

window.onload = () => {
    try {
        const game = new Minecraft2Game();
        game.start();
    } catch (err) {
        console.error('Minecraft 2 startup error:', err);
    }
};
