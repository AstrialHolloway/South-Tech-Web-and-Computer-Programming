class SoundFX {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.noiseBuffer = null;
        this.muted = false;
        this.lastMineHitTime = 0;
    }

    unlock() {
        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                this.ctx = new AudioCtx();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted ? 0 : 0.45;
                this.master.connect(this.ctx.destination);

                // Pre-generate 2-second white noise buffer for footsteps, sand, glass, hiss & crunches
                const sampleRate = this.ctx.sampleRate;
                const length = sampleRate * 2;
                this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
                const data = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < length; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (_) {}
    }

    setMuted(mute) {
        this.muted = !!mute;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime, 0.02);
        }
        return this.muted;
    }

    ready() {
        if (this.muted) return false;
        if (!this.ctx) this.unlock();
        return !!(this.ctx && this.ctx.state === 'running');
    }

    // Walking / Footstep Sound tuned to block material underfoot
    playFootstep(blockId, sprinting = false) {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        const pitchJitter = 0.92 + Math.random() * 0.18;
        const vol = sprinting ? 0.22 : 0.14;

        let filterFreq = 850;
        let toneFreq = 120;
        let q = 1.4;

        if (blockId === BLOCKS.SNOW) {
            filterFreq = 2200 + Math.random() * 550;
            toneFreq = 210;
            q = 1.6;
        } else if (blockId === BLOCKS.PACKED_ICE || blockId === BLOCKS.GLASS || blockId === BLOCKS.EMERALD_BLOCK) {
            filterFreq = 1150 + Math.random() * 350;
            toneFreq = 180;
            q = 2.2;
        } else if (blockId === BLOCKS.STONE || blockId === BLOCKS.COBBLESTONE || blockId === BLOCKS.DEEPSLATE || blockId === BLOCKS.OBSIDIAN || blockId === BLOCKS.BEDROCK || blockId === BLOCKS.EMERALD_ORE) {
            filterFreq = 1650;
            toneFreq = 210;
            q = 3.2;
        } else if (blockId === BLOCKS.SAND || blockId === BLOCKS.GRAVEL || blockId === BLOCKS.SOUL_SAND) {
            filterFreq = 2400;
            toneFreq = 95;
            q = 0.9;
        } else if (blockId === BLOCKS.OAK_PLANKS || blockId === BLOCKS.OAK_LOG || blockId === BLOCKS.CRAFTING) {
            filterFreq = 1100;
            toneFreq = 165;
            q = 2.8;
        } else if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.CHERRY_LEAVES || blockId === BLOCKS.WHEAT) {
            filterFreq = 3200;
            toneFreq = 140;
            q = 1.0;
        }

        // Filtered noise scuff
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(filterFreq * pitchJitter, now);
        filter.Q.value = q;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        noise.start(now, Math.random() * 1.2, 0.1);

        // Subtle low heel thump
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(toneFreq * pitchJitter, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.06);
        const oGain = this.ctx.createGain();
        oGain.gain.setValueAtTime(vol * 0.75, now);
        oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc.connect(oGain);
        oGain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.07);
    }

    // Periodic mining thud while chipping a block
    playMineHit(blockId) {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        if (now - this.lastMineHitTime < 0.21) return;
        this.lastMineHitTime = now;

        const jitter = 0.9 + Math.random() * 0.22;
        let baseFreq = 155;
        if (blockId === BLOCKS.STONE || blockId === BLOCKS.COBBLESTONE || blockId === BLOCKS.DEEPSLATE || blockId === BLOCKS.IRON_ORE || blockId === BLOCKS.DIAMOND_ORE) {
            baseFreq = 260;
        } else if (blockId === BLOCKS.OAK_LOG || blockId === BLOCKS.OAK_PLANKS) {
            baseFreq = 195;
        } else if (blockId === BLOCKS.SAND || blockId === BLOCKS.GRAVEL || blockId === BLOCKS.DIRT || blockId === BLOCKS.GRASS) {
            baseFreq = 115;
        }

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(baseFreq * jitter, now);
        osc.frequency.exponentialRampToValueAtTime(62, now + 0.055);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 950;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.07);
    }

    // Crisp block break / shatter + pop when block finishes breaking
    playBlockBreak(blockId) {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        const jitter = 0.94 + Math.random() * 0.14;

        if (blockId === BLOCKS.GLASS || blockId === BLOCKS.CRYSTAL || blockId === BLOCKS.DEEPSLATE_CRYSTAL_ORE || blockId === BLOCKS.LANTERN) {
            // Crystalline / Glass high-frequency chime shatter
            [1650, 2320, 3180].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq * jitter, now + idx * 0.015);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.14 + idx * 0.02);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.18, now + idx * 0.015);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.16 + idx * 0.02);
                osc.connect(g);
                g.connect(this.master);
                osc.start(now + idx * 0.015);
                osc.stop(now + 0.18 + idx * 0.02);
            });
        }

        // Textured crunch burst
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        const isStone = blockId === BLOCKS.STONE || blockId === BLOCKS.COBBLESTONE || blockId === BLOCKS.DEEPSLATE || blockId === BLOCKS.OBSIDIAN;
        const isWood = blockId === BLOCKS.OAK_LOG || blockId === BLOCKS.OAK_PLANKS || blockId === BLOCKS.CRAFTING;
        filter.frequency.setValueAtTime((isStone ? 1750 : (isWood ? 980 : 1250)) * jitter, now);
        filter.Q.value = isStone ? 2.4 : 1.3;

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.32, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.master);
        noise.start(now, Math.random() * 1.0, 0.17);

        // Satisfying pop tone
        const pop = this.ctx.createOscillator();
        pop.type = 'sine';
        pop.frequency.setValueAtTime((isStone ? 280 : (isWood ? 210 : 175)) * jitter, now);
        pop.frequency.exponentialRampToValueAtTime(420 * jitter, now + 0.075);
        const pGain = this.ctx.createGain();
        pGain.gain.setValueAtTime(0.24, now);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        pop.connect(pGain);
        pGain.connect(this.master);
        pop.start(now);
        pop.stop(now + 0.095);
    }

    // Block place thud
    playBlockPlace() {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.24, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(g);
        g.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.095);
    }

    // Passive Animals & Hostile Mobs ambient calls with distance attenuation
    playMobAmbient(type, distance = 5) {
        if (!this.ready()) return;
        const atten = Math.max(0.05, Math.min(1, 1 - distance / 24));
        if (atten <= 0.05) return;
        const now = this.ctx.currentTime;

        if (type === 'sheep') {
            // Vibrato bleat ("Baa!")
            const osc = this.ctx.createOscillator();
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(310, now);
            osc.frequency.linearRampToValueAtTime(265, now + 0.42);
            lfo.frequency.value = 18;
            lfoGain.gain.value = 16;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 820;
            filter.Q.value = 2.5;

            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.001, now);
            g.gain.linearRampToValueAtTime(0.22 * atten, now + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(filter);
            filter.connect(g);
            g.connect(this.master);
            osc.start(now);
            lfo.start(now);
            osc.stop(now + 0.46);
            lfo.stop(now + 0.46);
        } else if (type === 'cow') {
            // Deep resonant "Moo"
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(112, now);
            osc.frequency.linearRampToValueAtTime(132, now + 0.18);
            osc.frequency.linearRampToValueAtTime(98, now + 0.65);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(380, now);
            filter.Q.value = 3.5;

            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.001, now);
            g.gain.linearRampToValueAtTime(0.28 * atten, now + 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

            osc.connect(filter);
            filter.connect(g);
            g.connect(this.master);
            osc.start(now);
            osc.stop(now + 0.7);
        } else if (type === 'fox') {
            // High-pitched playful fox chirp/yip
            [0, 0.11].forEach((offset, idx) => {
                const osc = this.ctx.createOscillator();
                osc.type = 'triangle';
                const startF = idx === 0 ? 740 : 880;
                osc.frequency.setValueAtTime(startF, now + offset);
                osc.frequency.exponentialRampToValueAtTime(startF * 1.45, now + offset + 0.04);
                osc.frequency.exponentialRampToValueAtTime(startF * 0.75, now + offset + 0.09);

                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.001, now + offset);
                g.gain.linearRampToValueAtTime(0.18 * atten, now + offset + 0.015);
                g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.095);

                osc.connect(g);
                g.connect(this.master);
                osc.start(now + offset);
                osc.stop(now + offset + 0.1);
            });
        } else if (type === 'villager') {
            // Classic warm nasal "Hrmm"
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(175, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.24);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 540;
            filter.Q.value = 4.0;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.001, now);
            g.gain.linearRampToValueAtTime(0.2 * atten, now + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
            osc.connect(filter);
            filter.connect(g);
            g.connect(this.master);
            osc.start(now);
            osc.stop(now + 0.28);
        } else if (type === 'zombie') {
            // Low raspy zombie groan
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(84, now);
            osc.frequency.linearRampToValueAtTime(64, now + 0.55);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 310;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.001, now);
            g.gain.linearRampToValueAtTime(0.28 * atten, now + 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
            osc.connect(filter);
            filter.connect(g);
            g.connect(this.master);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'skeleton') {
            // Dry bone clatter clicks
            [0, 0.065, 0.14].forEach((offset, idx) => {
                const osc = this.ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(980 + idx * 240, now + offset);
                osc.frequency.exponentialRampToValueAtTime(340, now + offset + 0.04);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.15 * atten, now + offset);
                g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);
                osc.connect(g);
                g.connect(this.master);
                osc.start(now + offset);
                osc.stop(now + offset + 0.05);
            });
        } else if (type === 'creeper') {
            // Creeper fuse hiss ("Ssssss!")
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(2200, now);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.02, now);
            g.gain.linearRampToValueAtTime(0.32 * atten, now + 0.45);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
            noise.connect(filter);
            filter.connect(g);
            g.connect(this.master);
            noise.start(now, 0, 0.66);
        }
    }

    // Striking a mob (sword/fist slash + impact thud + optional defeat chime)
    playMobHit(killed = false, isSword = false) {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;

        // Heavy body impact punch
        const punch = this.ctx.createOscillator();
        punch.type = 'sine';
        punch.frequency.setValueAtTime(165, now);
        punch.frequency.exponentialRampToValueAtTime(44, now + 0.14);
        const pGain = this.ctx.createGain();
        pGain.gain.setValueAtTime(0.38, now);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        punch.connect(pGain);
        pGain.connect(this.master);
        punch.start(now);
        punch.stop(now + 0.16);

        // Sharp slash transient
        const slash = this.ctx.createBufferSource();
        slash.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isSword ? 2600 : 1200, now);
        filter.Q.value = isSword ? 2.5 : 1.2;
        const sGain = this.ctx.createGain();
        sGain.gain.setValueAtTime(0.28, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        slash.connect(filter);
        filter.connect(sGain);
        sGain.connect(this.master);
        slash.start(now, 0.2, 0.12);

        if (killed) {
            const chime = this.ctx.createOscillator();
            chime.type = 'triangle';
            chime.frequency.setValueAtTime(520, now + 0.06);
            chime.frequency.exponentialRampToValueAtTime(780, now + 0.22);
            const cGain = this.ctx.createGain();
            cGain.gain.setValueAtTime(0.22, now + 0.06);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
            chime.connect(cGain);
            cGain.connect(this.master);
            chime.start(now + 0.06);
            chime.stop(now + 0.25);
        }
    }

    // Taking Fall Damage (bone crunch + heavy ground thump)
    playFallDamage(damage = 2) {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        const intensity = Math.min(1.3, 0.7 + damage * 0.08);

        // Sub-bass ground thud
        const thud = this.ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(110, now);
        thud.frequency.exponentialRampToValueAtTime(28, now + 0.24);
        const tGain = this.ctx.createGain();
        tGain.gain.setValueAtTime(0.45 * intensity, now);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        thud.connect(tGain);
        tGain.connect(this.master);
        thud.start(now);
        thud.stop(now + 0.27);

        // Sharp ankle/bone crack transient
        const crack = this.ctx.createBufferSource();
        crack.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1450, now);
        filter.Q.value = 2.0;
        const cGain = this.ctx.createGain();
        cGain.gain.setValueAtTime(0.36 * intensity, now);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        crack.connect(filter);
        filter.connect(cGain);
        cGain.connect(this.master);
        crack.start(now, 0.4, 0.15);
    }

    // Explosion boom for TNT & Creepers
    playExplosion() {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, now);
        filter.frequency.exponentialRampToValueAtTime(65, now + 0.75);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.55, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        noise.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        noise.start(now, 0, 0.82);
    }

    // Steam fizz when water evaporates in the Nether or meets lava
    playFizz() {
        if (!this.ready()) return;
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2800, now);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.28, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        noise.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        noise.start(now, Math.random() * 0.5, 0.44);
    }
}

// =========================================================================
