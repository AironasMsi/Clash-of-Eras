// ============================================================================
// CLASH OF ERAS: ROCK-SOLID CRASH-PROOF 3D SPATIAL AUDIO ENGINE
// ============================================================================

class RTSAudioSystem {
    constructor() {
        this.ctx = null;
        this.sfxVolume = 0.15;
        this.musicVolume = 0.15;
        this.ambientVolume = 0.10;
        this.muted = false;
        this.musicPlaying = false;
        this.wasMusicPlaying = false;
        this.currentEra = 0;
        this.musicTimer = null;
        this.musicStep = 0;
        this.battleTension = 0;
        this.isAudioPaused = false;
        this.cameraX = 0;

        // Audio mazgai
        this.masterGain = null;
        this.limiter = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.ambientGain = null;
        this.duckingGain = null;

        // Timestamp pagrindu veikiantis Cooldown tracker
        this.lastPlayTime = {};

        // Garso failų biblioteka
        this.samples = {};
        this.sampleFiles = {
            'sword_0': 'sounds/sword_0.wav',
            'sword_1': 'sounds/sword_1.wav',
            'club_0': 'sounds/club_0.wav',
            'club_1': 'sounds/club_1.wav',
            'laser_0': 'sounds/laser_0.wav',
            'laser_1': 'sounds/laser_1.wav',
            'bow_0': 'sounds/bow_0.wav',
            'bow_1': 'sounds/bow_1.wav',
            'gun_0': 'sounds/gun_0.wav',
            'gun_1': 'sounds/gun_1.wav',
            'cannon': 'sounds/cannon.wav',
            'coin': 'sounds/coin.wav',
            'chop': 'sounds/chop.wav',
            'mine': 'sounds/mine.wav',
            'ui_click': 'sounds/ui_click.wav',
            'unit_queue': 'sounds/unit_queue.wav',
            'trade': 'sounds/trade.wav',
            'horn_attack': 'sounds/horn_attack.wav',
            'horn_defend': 'sounds/horn_defend.wav',
            'horn_retreat': 'sounds/horn_retreat.wav',
            'slingshot': 'sounds/slingshot.wav',
            'dino_roar': 'sounds/dino_roar.wav',
            'horse_charge': 'sounds/horse_charge.wav',
            'musket': 'sounds/musket.wav',
            'rifle_burst': 'sounds/rifle_burst.wav',
            'tank_shot': 'sounds/tank_shot.wav',
            'plasma_heavy': 'sounds/plasma_heavy.wav',
            'mech_stomp': 'sounds/mech_stomp.wav',
            'tesla_zap': 'sounds/tesla_zap.wav',
            'minigun': 'sounds/minigun.wav',
            'base_warning': 'sounds/base_warning.wav',
            'base_collapse': 'sounds/base_collapse.wav',
            'tech_upgrade': 'sounds/tech_upgrade.wav',
            'perk_select': 'sounds/perk_select.wav',
            'meteor_ultimate': 'sounds/meteor_ultimate.wav',
            'orbital_laser': 'sounds/orbital_laser.wav',
        };
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();

            // 1. Master Dynamics Compressor (Limiter)
            this.limiter = this.ctx.createDynamicsCompressor();
            this.limiter.threshold.setValueAtTime(-10, this.ctx.currentTime);
            this.limiter.knee.setValueAtTime(6, this.ctx.currentTime);
            this.limiter.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.limiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
            this.limiter.release.setValueAtTime(0.2, this.ctx.currentTime);

            // 2. Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);

            // 3. Sidechain Ducking mazgas (nutildo tik muziką/ambientą)
            this.duckingGain = this.ctx.createGain();
            this.duckingGain.gain.setValueAtTime(1, this.ctx.currentTime);

            // 4. SFX, Muzikos ir Ambiento Gain mazgai
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);

            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);

            // Maršrutizavimas: SFX jungiasi tiesiai į Limiter, o Muzika eina per Ducking
            this.sfxGain.connect(this.limiter);
            this.musicGain.connect(this.duckingGain);
            this.ambientGain.connect(this.duckingGain);

            this.duckingGain.connect(this.limiter);
            this.limiter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.loadSamples();
        } catch (e) {
            console.warn('Web Audio API klaida inicializuojant:', e);
        }
    }

    loadSamples() {
        if (!this.ctx) return;
        for (const [key, path] of Object.entries(this.sampleFiles)) {
            fetch(path)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.arrayBuffer();
                })
                .then(arr => this.ctx.decodeAudioData(arr))
                .then(buf => {
                    this.samples[key] = buf;
                })
                .catch(() => {});
        }
    }

    setCameraX(camX) {
        if (typeof camX === 'number' && Number.isFinite(camX)) {
            this.cameraX = camX;
        }
    }

    // ========================================================================
    // ERDVINĖ AKUSTIKA IR ATSTUMO SLOPINIMAS
    // ========================================================================
    getSpatialRoute(worldX = null, baseGain = 1.0) {
        if (!this.ctx) this.init();
        if (!this.ctx || !this.sfxGain) {
            return { dest: null, gain: 0, panner: null };
        }

        const safeX = (typeof worldX === 'number' && Number.isFinite(worldX)) ? worldX : null;
        if (safeX === null) {
            return {
                dest: this.sfxGain,
                gain: Math.max(0, baseGain),
                panner: null
            };
        }

        const camCenter = (typeof this.cameraX === 'number' && Number.isFinite(this.cameraX)) ? (this.cameraX + 640) : 1200;
        const offset = safeX - camCenter;
        const dist = Math.abs(offset);
        let distVol = 1.0;
        let panVal = 0;

        if (dist <= 640) {
            // Ekrane matomas veiksmas: 100% garsumas, tolygus stereo paniravimas
            distVol = 1.0;
            panVal = Math.max(-0.75, Math.min(0.75, offset / 640));
        } else {
            // Už ekrano ribų: tolygus pritylimas iki 20-30% ir aiški kryptis
            const excess = dist - 640;
            const factor = Math.min(1.0, excess / 800);
            distVol = Math.max(0.20, 1.0 - 0.78 * factor);
            panVal = offset < 0 ? -0.88 : 0.88;
        }

        if (this.ctx.createStereoPanner) {
            try {
                const panner = this.ctx.createStereoPanner();
                panner.pan.setValueAtTime(panVal, this.ctx.currentTime);
                panner.connect(this.sfxGain);
                return {
                    dest: panner,
                    gain: Math.max(0, baseGain * distVol),
                    panner: panner
                };
            } catch (e) {
                return { dest: this.sfxGain, gain: baseGain * distVol, panner: null };
            }
        }

        return {
            dest: this.sfxGain,
            gain: Math.max(0, baseGain * distVol),
            panner: null
        };
    }

    canPlayVoice(category, minIntervalMs = 45) {
        const now = performance.now();
        const last = this.lastPlayTime[category] || 0;
        if (now - last < minIntervalMs) {
            return false;
        }
        this.lastPlayTime[category] = now;
        return true;
    }

    triggerDucking(duckFactor = 0.7, duration = 0.5) {
        if (!this.ctx || !this.duckingGain) return;
        try {
            const t = this.ctx.currentTime;
            // Švelnus sidechain: niekada nenuleisti garsumo žemiau 65%, kad muzika nepradingtų
            const safeFactor = Math.max(0.65, duckFactor);
            this.duckingGain.gain.cancelScheduledValues(t);
            this.duckingGain.gain.setValueAtTime(this.duckingGain.gain.value || 1.0, t);
            this.duckingGain.gain.linearRampToValueAtTime(safeFactor, t + 0.04);
            this.duckingGain.gain.linearRampToValueAtTime(1.0, t + Math.max(0.3, duration));
        } catch (e) {
            try {
                if (this.duckingGain) this.duckingGain.gain.value = 1.0;
            } catch (err) {}
        }
    }

    playSample(name, detuneCents = 0, worldX = null, volumeMult = 1.0) {
        this.resume();
        if (!this.ctx || this.muted) return false;
        const buf = this.samples[name];
        if (!buf) return false;

        try {
            const route = this.getSpatialRoute(worldX, volumeMult);
            if (!route.dest) return false;

            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            if (detuneCents !== 0 && src.detune) {
                src.detune.setValueAtTime(detuneCents, this.ctx.currentTime);
            }

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(route.gain, this.ctx.currentTime);

            src.connect(gain);
            gain.connect(route.dest);

            src.onended = () => {
                try {
                    src.disconnect();
                    gain.disconnect();
                    if (route.panner) route.panner.disconnect();
                } catch (e) {}
            };

            src.start();
            return true;
        } catch (e) {
            return false;
        }
    }

    resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        if (this.masterGain && this.ctx && !this.muted) {
            try {
                this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
                this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
            } catch (e) {}
        }
    }

    pauseAudio() {
        this.isAudioPaused = true;
        this.wasMusicPlaying = this.musicPlaying;
        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = null;
        }
        if (this.masterGain && this.ctx) {
            try { this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime); } catch (e) {}
        }
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
        }
    }

    resumeAudio() {
        this.isAudioPaused = false;
        if (!this.ctx) this.init();
        const startOrResume = () => {
            if (this.masterGain && this.ctx) {
                try {
                    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1.0, this.ctx.currentTime);
                } catch (e) {}
            }
            if (!this.muted) {
                this.startMusic(this.currentEra);
            }
        };
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(startOrResume).catch(startOrResume);
        } else {
            this.resume();
            startOrResume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
        }
        // Muziką pratęsti TIK jeigu ji buvo aktyviai paleista mūšyje (this.musicPlaying === true)
        if (!this.muted && !this.isAudioPaused && this.musicPlaying && !this.musicTimer) {
            this.startMusic(this.currentEra);
        }
        return this.muted;
    }

    setMasterVolume(val) {
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : Math.max(0, Math.min(1, val)), this.ctx.currentTime);
        }
    }

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        }
    }

    setMusicVolume(val) {
        this.musicVolume = Math.max(0, Math.min(1, val));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        }
    }

    // ========================================================================
    // UI & VALDYMO GARSAI
    // ========================================================================
    playHover() {
        if (!this.ctx || this.muted) return;
        if (!this.canPlayVoice('ui_hover', 50)) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.exponentialRampToValueAtTime(780, t + 0.025);
            gain.gain.setValueAtTime(0.015, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.035);
        } catch (e) {}
    }

    playClick() {
        this.resume();
        if (!this.canPlayVoice('ui_click', 50)) return;
        if (this.playSample('ui_click', (Math.random() - 0.5) * 80, null, 0.40)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(820, t);
            osc.frequency.exponentialRampToValueAtTime(260, t + 0.035);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.045);
        } catch (e) {}
    }

    playPause() { this.playClick(); }
    playResume() { this.playClick(); }

    playQueueUnit(worldX = null) {
        this.resume();
        if (!this.canPlayVoice('ui_queue', 80)) return;
        if (this.playSample('unit_queue', (Math.random() - 0.5) * 80, worldX, 0.35)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.06);
            [440, 659.25].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, t + i * 0.04);
                gain.gain.setValueAtTime(route.gain, t + i * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.12);
                osc.connect(gain);
                gain.connect(route.dest);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
                osc.start(t + i * 0.04);
                osc.stop(t + i * 0.04 + 0.14);
            });
        } catch (e) {}
    }

    playBuySuccess() {
        this.resume();
        if (!this.canPlayVoice('ui_buy', 100)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t + idx * 0.035);
                gain.gain.setValueAtTime(0.18, t + idx * 0.035);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.035 + 0.22);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.035);
                osc.stop(t + idx * 0.035 + 0.25);
            });
        } catch (e) {}
    }

    // ========================================================================
    // BOKŠTŲ IR BAZĖS TOBULINIMŲ GARSAI
    // ========================================================================
    playSlotUnlock() {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.linearRampToValueAtTime(320, t + 0.07);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.22);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.26);

            [523.25, 659.25, 1046.50].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(f, t + 0.06 + i * 0.04);
                g.gain.setValueAtTime(0.15, t + 0.06 + i * 0.04);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.06 + i * 0.04 + 0.20);
                o.connect(g);
                g.connect(this.sfxGain);
                o.onended = () => { o.disconnect(); g.disconnect(); };
                o.start(t + 0.06 + i * 0.04);
                o.stop(t + 0.06 + i * 0.04 + 0.22);
            });
        } catch (e) {}
    }

    playTurretBuild(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 1.0);
            if (!route.dest) return;

            // 1. Pneumatinis slėgis
            const pneuOsc = this.ctx.createOscillator();
            const pneuGain = this.ctx.createGain();
            pneuOsc.type = 'sawtooth';
            pneuOsc.frequency.setValueAtTime(1200, t);
            pneuOsc.frequency.exponentialRampToValueAtTime(350, t + 0.08);
            pneuGain.gain.setValueAtTime(0.25 * (route.gain || 1), t);
            pneuGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            pneuOsc.connect(pneuGain);
            pneuGain.connect(route.dest);
            pneuOsc.onended = () => { pneuOsc.disconnect(); pneuGain.disconnect(); };
            pneuOsc.start(t);
            pneuOsc.stop(t + 0.10);

            // 2. Ketaus patrankos užrakinimas
            const mountOsc = this.ctx.createOscillator();
            const mountGain = this.ctx.createGain();
            mountOsc.type = 'triangle';
            mountOsc.frequency.setValueAtTime(380, t + 0.06);
            mountOsc.frequency.exponentialRampToValueAtTime(80, t + 0.20);
            mountGain.gain.setValueAtTime(0.38 * (route.gain || 1), t + 0.06);
            mountGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            mountOsc.connect(mountGain);
            mountGain.connect(route.dest);
            mountOsc.onended = () => { mountOsc.disconnect(); mountGain.disconnect(); };
            mountOsc.start(t + 0.06);
            mountOsc.stop(t + 0.24);

            // 3. Dantračio spragtelėjimas
            [1800, 2400].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = 'square';
                o.frequency.setValueAtTime(f, t + 0.14 + i * 0.04);
                g.gain.setValueAtTime(0.12 * (route.gain || 1), t + 0.14 + i * 0.04);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.14 + i * 0.04 + 0.05);
                o.connect(g);
                g.connect(route.dest);
                o.onended = () => { o.disconnect(); g.disconnect(); if (route.panner) route.panner.disconnect(); };
                o.start(t + 0.14 + i * 0.04);
                o.stop(t + 0.14 + i * 0.04 + 0.06);
            });
        } catch (e) {}
    }

    playBaseUpgrade() {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            [130.81, 164.81, 196.00, 261.63].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, t + idx * 0.05);
                gain.gain.setValueAtTime(0.22, t + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.30);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.05);
                osc.stop(t + idx * 0.05 + 0.32);
            });
        } catch (e) {}
    }

    playPopUpgrade() {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            [392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, t + idx * 0.05);
                gain.gain.setValueAtTime(0.22, t + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.28);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.05);
                osc.stop(t + idx * 0.05 + 0.30);
            });
        } catch (e) {}
    }

    playEconomyUpgrade() {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            [587.33, 880.00, 1174.66].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + idx * 0.04);
                gain.gain.setValueAtTime(0.20, t + idx * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.22);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.04);
                osc.stop(t + idx * 0.04 + 0.24);
            });
        } catch (e) {}
    }

    playTechUpgrade() {
        this.resume();
        if (this.playSample('tech_upgrade', (Math.random() - 0.5) * 50, null, 0.85)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            [440, 554.37, 659.25, 880].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, t + idx * 0.05);
                gain.gain.setValueAtTime(0.20, t + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.28);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.05);
                osc.stop(t + idx * 0.05 + 0.30);
            });
        } catch (e) {}
    }

    playPerkSelect() {
        this.resume();
        if (this.playSample('perk_select', (Math.random() - 0.5) * 40, null, 0.9)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            [329.63, 493.88, 659.25, 987.77].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + idx * 0.05);
                gain.gain.setValueAtTime(0.22, t + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.35);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.05);
                osc.stop(t + idx * 0.05 + 0.38);
            });
        } catch (e) {}
    }

    playBranchSelect() {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            this.triggerDucking(0.5, 0.8);
            [392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, t + idx * 0.06);
                gain.gain.setValueAtTime(0.26, t + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.40);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.06);
                osc.stop(t + idx * 0.06 + 0.45);
            });
        } catch (e) {}
    }

    playLevelUp(worldX = null) {
        this.resume();
        if (!this.canPlayVoice('unit_levelup', 120)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.08);
            if (!route.dest) return;
            [659.25, 880.00, 1046.50].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + idx * 0.04);
                gain.gain.setValueAtTime(route.gain, t + idx * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.16);
                osc.connect(gain);
                gain.connect(route.dest);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
                osc.start(t + idx * 0.04);
                osc.stop(t + idx * 0.04 + 0.18);
            });
        } catch (e) {}
    }

    playUpgradeSuccess() { this.playTechUpgrade(); }

    playAchievement() {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            [587.33, 739.99, 880.00, 1174.66].forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + idx * 0.06);
                gain.gain.setValueAtTime(0.22, t + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.32);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.06);
                osc.stop(t + idx * 0.06 + 0.35);
            });
        } catch (e) {}
    }

    playError() {
        this.resume();
        if (!this.canPlayVoice('ui_error', 120)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            [220, 185].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + i * 0.08);
                gain.gain.setValueAtTime(0.18, t + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.10);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + i * 0.08);
                osc.stop(t + i * 0.08 + 0.12);
            });
        } catch (e) {}
    }

    playTrade() {
        this.resume();
        if (this.playSample('trade', (Math.random() - 0.5) * 80, null, 0.75)) return;
        this.playCoin();
    }

    playHorn(stance = 'attack') {
        this.resume();
        const key = `horn_${stance}`;
        if (this.playSample(key, (Math.random() - 0.5) * 40, null, 0.9)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const freqs = stance === 'attack' ? [330, 440, 554] : (stance === 'defend' ? [392, 330, 261] : [440, 392, 330]);
            freqs.forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, t + idx * 0.08);
                gain.gain.setValueAtTime(0.20, t + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.35);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.08);
                osc.stop(t + idx * 0.08 + 0.40);
            });
        } catch (e) {}
    }

    playCoin(worldX = null) {
        this.resume();
        if (!this.canPlayVoice('coin', 70)) return;
        if (this.playSample('coin', (Math.random() - 0.5) * 120, worldX, 0.28)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.06);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, t);
            osc.frequency.setValueAtTime(2100, t + 0.04);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.16);
        } catch (e) {}
    }

    playGoldCache(worldX = null) {
        this.resume();
        this.triggerDucking(0.7, 0.5);
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.22);
            if (!route.dest) return;
            [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t + idx * 0.04);
                gain.gain.setValueAtTime(route.gain, t + idx * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.25);
                osc.connect(gain);
                gain.connect(route.dest);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
                osc.start(t + idx * 0.04);
                osc.stop(t + idx * 0.04 + 0.28);
            });
        } catch (e) {}
    }

    playChop(worldX = null) {
        this.resume();
        if (!this.canPlayVoice('chop', 100)) return;
        const detune = (Math.random() - 0.5) * 150;
        if (this.playSample('chop', detune, worldX, 0.26)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.07);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(190 + (Math.random() - 0.5) * 30, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.06);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.08);
        } catch (e) {}
    }

    playMine(worldX = null) {
        this.resume();
        if (!this.canPlayVoice('mine', 100)) return;
        const detune = (Math.random() - 0.5) * 150;
        if (this.playSample('mine', detune, worldX, 0.26)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.07);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1450 + (Math.random() - 0.5) * 200, t);
            osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.07);
        } catch (e) {}
    }

    playSpawnUnit(era = 0, unitType = 'melee', isHero = false, worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        if (isHero) {
            this.triggerDucking(0.65, 0.5);
            try {
                const heroNotes = era >= 3 ? [440, 659.25, 880, 1318.51] : [330, 440, 554.37, 659.25];
                const t = this.ctx.currentTime;
                const route = this.getSpatialRoute(worldX, 0.28);
                if (!route.dest) return;
                heroNotes.forEach((f, i) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = era >= 3 ? 'sawtooth' : 'triangle';
                    osc.frequency.setValueAtTime(f, t + i * 0.06);
                    gain.gain.setValueAtTime(route.gain, t + i * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.30);
                    osc.connect(gain);
                    gain.connect(route.dest);
                    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
                    osc.start(t + i * 0.06);
                    osc.stop(t + i * 0.06 + 0.32);
                });
            } catch (e) {}
            return;
        }

        if (unitType === 'cavalry' || (era === 1 && unitType === 'heavy')) {
            if (this.playSample('horse_charge', (Math.random() - 0.5) * 60, worldX, 0.8)) return;
        }
        if (unitType === 'dino' || (era === 0 && unitType === 'heavy')) {
            if (this.playSample('dino_roar', (Math.random() - 0.5) * 60, worldX, 0.85)) return;
        }
        if (era >= 4 && (unitType === 'heavy' || unitType === 'special')) {
            if (this.playSample('mech_stomp', (Math.random() - 0.5) * 60, worldX, 0.85)) return;
        }

        this.playQueueUnit(worldX);
    }

    playRecruit(worldX = null) {
        this.playSpawnUnit(this.currentEra, 'melee', false, worldX);
    }

    // ========================================================================
    // GINKLŲ & SMŪGIŲ GARSAI
    // ========================================================================
    playMeleeHit(era = 0, isCrit = false, unitType = 'melee', worldX = null) {
        this.resume();
        if (!this.canPlayVoice('melee_hit', 50)) return;
        const detune = (Math.random() - 0.5) * 160;

        if (era === 0) {
            if (unitType === 'heavy') {
                if (this.playSample('dino_roar', detune, worldX, 0.65)) return;
                this.synthDinoRoarAndBite(worldX);
                return;
            }
            const k = Math.random() > 0.5 ? 'club_0' : 'club_1';
            if (this.playSample(k, detune, worldX, 0.42)) return;
            this.synthClubImpact(worldX);
        } else if (era === 1) {
            if (unitType === 'cavalry' || unitType === 'heavy') {
                if (this.playSample('horse_charge', detune, worldX, 0.60)) return;
                this.synthKnightLance(worldX);
                return;
            }
            const k = Math.random() > 0.5 ? 'sword_0' : 'sword_1';
            if (this.playSample(k, detune, worldX, 0.42)) return;
            this.synthBladeSlash(worldX);
        } else if (era === 2) {
            const k = Math.random() > 0.5 ? 'sword_0' : 'sword_1';
            if (this.playSample(k, detune, worldX, 0.40)) return;
            this.synthRapierThrust(worldX);
        } else if (era === 3) {
            const k = Math.random() > 0.5 ? 'gun_0' : 'club_0';
            if (this.playSample(k, detune, worldX, 0.45)) return;
            this.synthBluntImpact(worldX);
        } else {
            if (unitType === 'heavy') {
                if (this.playSample('mech_stomp', detune, worldX, 0.65)) return;
                this.synthMechStomp(worldX);
                return;
            }
            const k = Math.random() > 0.5 ? 'laser_0' : 'laser_1';
            if (this.playSample(k, detune, worldX, 0.45)) return;
            this.synthLaserBlade(worldX);
        }
    }

    playRangedShot(type = 'stone', era = 0, worldX = null) {
        this.resume();
        if (!this.canPlayVoice('ranged_shot', 50)) return;
        const detune = (Math.random() - 0.5) * 140;

        if (type === 'stone' || type === 'boulder' || type === 'slingshot') {
            if (this.playSample('slingshot', detune, worldX, 0.40)) return;
            this.synthSlingWhoosh(worldX);
        } else if (type === 'arrow' || type === 'bolt') {
            const k = Math.random() > 0.5 ? 'bow_0' : 'bow_1';
            if (this.playSample(k, detune, worldX, 0.42)) return;
            this.synthBowRelease(worldX);
        } else if (type === 'bullet' || type === 'musket' || type === 'musket_ball') {
            if (this.playSample('musket', detune, worldX, 0.48)) return;
            if (this.playSample('gun_0', detune, worldX, 0.45)) return;
            this.synthGunshot(worldX);
        } else if (type === 'rifle' || type === 'burst' || type === 'tracer') {
            if (this.playSample('rifle_burst', detune, worldX, 0.45)) return;
            this.synthRifleBurst(worldX);
        } else if (type === 'cannonball' || type === 'cannon' || type === 'artillery') {
            if (this.playSample('cannon', detune, worldX, 0.70)) return;
            this.synthCannonBoom(worldX);
        } else if (type === 'tank_shell' || type === 'rocket') {
            if (this.playSample('tank_shot', detune, worldX, 0.70)) return;
            this.synthRocketLaunch(worldX);
        } else if (type === 'plasma' || type === 'heavy_plasma' || type === 'plasma_bomb') {
            if (this.playSample('plasma_heavy', detune, worldX, 0.65)) return;
            this.synthPlasmaBlast(worldX);
        } else if (type === 'laser' || type === 'beam' || type === 'laser_beam' || type === 'laser_bolt') {
            const k = Math.random() > 0.5 ? 'laser_0' : 'laser_1';
            if (this.playSample(k, detune, worldX, 0.45)) return;
            this.synthLaserBeam(worldX);
        } else if (type === 'tesla' || type === 'lightning') {
            if (this.playSample('tesla_zap', detune, worldX, 0.85)) return;
            this.synthTeslaZap(worldX);
        } else if (type === 'minigun' || type === 'turret_gun') {
            if (this.playSample('minigun', detune, worldX, 0.75)) return;
            this.synthRifleBurst(worldX);
        } else if (type === 'acid') {
            this.synthAcidSpray(worldX);
        } else if (type === 'frost_beam') {
            this.synthFrostBeam(worldX);
        } else {
            this.synthGunshot(worldX);
        }
    }

    playShoot(projectileType = 'stone', era = 0, worldX = null) {
        this.playRangedShot(projectileType, era, worldX);
    }

    playTurretShot(turretType = '', era = 0, worldX = null) {
        this.resume();
        if (!this.canPlayVoice('turret_shot', 50)) return;
        if (era === 0) {
            this.playRangedShot('stone', 0, worldX);
        } else if (era === 1) {
            this.playRangedShot(turretType === 'catapult' ? 'cannonball' : 'arrow', 1, worldX);
        } else if (era === 2) {
            this.playRangedShot('cannonball', 2, worldX);
        } else if (era === 3) {
            this.playRangedShot(turretType === 'rocket_turret' ? 'rocket' : 'tracer', 3, worldX);
        } else {
            this.playRangedShot(turretType === 'ion_beam_turret' ? 'laser' : 'plasma', 4, worldX);
        }
    }

    playCrit(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.28);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, t);
            osc.frequency.exponentialRampToValueAtTime(70, t + 0.14);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.18);
        } catch (e) {}
    }

    playUnitDeath(unitType = 'melee', era = 0, isHero = false, isMonster = false, worldX = null) {
        this.resume();
        if (!this.canPlayVoice('death', 80)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.14);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            if (isMonster) {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, t);
                osc.frequency.exponentialRampToValueAtTime(45, t + 0.20);
                gain.gain.setValueAtTime(route.gain * 1.3, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            } else if (era >= 4) {
                osc.type = 'square';
                osc.frequency.setValueAtTime(450, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
                gain.gain.setValueAtTime(route.gain, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            } else {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, t);
                osc.frequency.exponentialRampToValueAtTime(35, t + 0.14);
                gain.gain.setValueAtTime(route.gain, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            }

            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.22);
        } catch (e) {}
    }

    playBaseDamage(worldX = null) {
        this.resume();
        if (!this.canPlayVoice('base_damage', 300)) return;
        if (this.playSample('base_warning', 0, worldX, 0.8)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.35);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(110, t);
            osc.frequency.linearRampToValueAtTime(75, t + 0.15);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.28);
        } catch (e) {}
    }

    playBaseCollapse(worldX = null) {
        this.resume();
        this.triggerDucking(0.2, 1.8);
        if (this.playSample('base_collapse', 0, worldX, 1.0)) return;
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.45);
            if (!route.dest) return;
            for (let i = 0; i < 4; i++) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(80 - i * 15, t + i * 0.15);
                osc.frequency.exponentialRampToValueAtTime(20, t + i * 0.15 + 0.8);
                gain.gain.setValueAtTime(route.gain, t + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.9);
                osc.connect(gain);
                gain.connect(route.dest);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
                osc.start(t + i * 0.15);
                osc.stop(t + i * 0.15 + 0.95);
            }
        } catch (e) {}
    }

    // ========================================================================
    // DIDINGAS IR PUNCHY PILIES EVOLIUCIJOS GARSAS ("KIETAS BŪM & EPOCHOS FANFARA")
    // ========================================================================
    playEvolve() {
        this.resume();
        this.triggerDucking(0.20, 2.5);
        if (!this.ctx || this.muted) return;

        try {
            const t = this.ctx.currentTime;

            // 1. Įtraukiantis energijos įsiurbimas prieš smūgį (0.0 -> 0.08s)
            const sweepOsc = this.ctx.createOscillator();
            const sweepGain = this.ctx.createGain();
            sweepOsc.type = 'sawtooth';
            sweepOsc.frequency.setValueAtTime(90, t);
            sweepOsc.frequency.exponentialRampToValueAtTime(800, t + 0.08);
            sweepGain.gain.setValueAtTime(0.20, t);
            sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            sweepOsc.connect(sweepGain);
            sweepGain.connect(this.sfxGain);
            sweepOsc.onended = () => { sweepOsc.disconnect(); sweepGain.disconnect(); };
            sweepOsc.start(t);
            sweepOsc.stop(t + 0.10);

            // 2. KOLOSALUS SEISMINIS BŪM! (ties 0.08s)
            // Layer A: Sub-Bass žemės drebėjimas
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(65, t + 0.08);
            subOsc.frequency.exponentialRampToValueAtTime(18, t + 0.75);
            subGain.gain.setValueAtTime(0.55, t + 0.08);
            subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.80);
            subOsc.connect(subGain);
            subGain.connect(this.sfxGain);
            subOsc.onended = () => { subOsc.disconnect(); subGain.disconnect(); };
            subOsc.start(t + 0.08);
            subOsc.stop(t + 0.85);

            // Layer B: Kinetinis akmens mūro trenksmas
            const stoneOsc = this.ctx.createOscillator();
            const stoneGain = this.ctx.createGain();
            stoneOsc.type = 'sawtooth';
            stoneOsc.frequency.setValueAtTime(240, t + 0.08);
            stoneOsc.frequency.exponentialRampToValueAtTime(32, t + 0.40);
            stoneGain.gain.setValueAtTime(0.38, t + 0.08);
            stoneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            stoneOsc.connect(stoneGain);
            stoneGain.connect(this.sfxGain);
            stoneOsc.onended = () => { stoneOsc.disconnect(); stoneGain.disconnect(); };
            stoneOsc.start(t + 0.08);
            stoneOsc.stop(t + 0.50);

            // Layer C: Slėgio bangos sprogimas
            const blastOsc = this.ctx.createOscillator();
            const blastGain = this.ctx.createGain();
            blastOsc.type = 'square';
            blastOsc.frequency.setValueAtTime(160, t + 0.08);
            blastOsc.frequency.exponentialRampToValueAtTime(25, t + 0.25);
            blastGain.gain.setValueAtTime(0.26, t + 0.08);
            blastGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            blastOsc.connect(blastGain);
            blastGain.connect(this.sfxGain);
            blastOsc.onended = () => { blastOsc.disconnect(); blastGain.disconnect(); };
            blastOsc.start(t + 0.08);
            blastOsc.stop(t + 0.30);

            // 3. DIDINGA KARINĖ EPOCHOS FANFARA (0.16s -> 1.0s)
            const fanfareNotes = [
                { f: 261.63, d: 0.16, delay: 0.16 }, // C4
                { f: 329.63, d: 0.16, delay: 0.28 }, // E4
                { f: 392.00, d: 0.18, delay: 0.40 }, // G4
                { f: 523.25, d: 0.22, delay: 0.54 }, // C5
                { f: 783.99, d: 0.55, delay: 0.72 }  // G5 (Triumfo finalas)
            ];

            fanfareNotes.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, t + note.delay);
                gain.gain.setValueAtTime(0.28, t + note.delay);
                gain.gain.exponentialRampToValueAtTime(0.001, t + note.delay + note.d);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + note.delay);
                osc.stop(t + note.delay + note.d + 0.05);
            });

            // 4. Šventiniai epochos triumfo varpai (Cathedral Bells & Shimmer)
            const cathedralChimes = [1046.50, 1318.51, 1567.98];
            cathedralChimes.forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + 0.72 + idx * 0.08);
                gain.gain.setValueAtTime(0.18, t + 0.72 + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72 + idx * 0.08 + 0.55);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + 0.72 + idx * 0.08);
                osc.stop(t + 0.72 + idx * 0.08 + 0.60);
            });
        } catch (e) {
            console.error('playEvolve error:', e);
        }
    }

    // ========================================================================
    // DIDVYRIŲ AKTYVIŲ GEBĖJIMŲ GARSAI
    // ========================================================================
    playHeroSkill(skillId = '', worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        this.triggerDucking(0.55, 0.7);

        try {
            if (skillId === 'ancestral_heal') {
                const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
                const t = this.ctx.currentTime;
                const route = this.getSpatialRoute(worldX, 0.28);
                if (!route.dest) return;
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, t + idx * 0.05);
                    gain.gain.setValueAtTime(route.gain, t + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.40);
                    osc.connect(gain);
                    gain.connect(route.dest);
                    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
                    osc.start(t + idx * 0.05);
                    osc.stop(t + idx * 0.05 + 0.45);
                });
            } else if (skillId === 'holy_smite') {
                this.synthCathedralBell(worldX);
                this.playCrit(worldX);
            } else if (skillId === 'shadow_dash') {
                this.synthBladeSlash(worldX);
                this.synthSlingWhoosh(worldX);
            } else if (skillId === 'cannon_barrage') {
                for (let i = 0; i < 4; i++) {
                    setTimeout(() => this.playRangedShot('cannonball', 2, worldX), i * 140);
                }
            } else if (skillId === 'acid_cauldron') {
                this.synthAcidSpray(worldX);
            } else if (skillId === 'missile_barrage') {
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => this.playRangedShot('rocket', 3, worldX), i * 110);
                }
            } else if (skillId === 'emp_blast') {
                this.synthTeslaZap(worldX);
                this.triggerDucking(0.3, 0.8);
            } else if (skillId === 'ion_hyperbeam') {
                if (this.playSample('orbital_laser', 0, worldX, 1.0)) return;
                this.synthLaserBeam(worldX);
            } else if (skillId === 'swarm_frenzy') {
                if (this.playSample('dino_roar', 120, worldX, 0.9)) return;
            } else {
                this.playCrit(worldX);
            }
        } catch (e) {}
    }

    // ========================================================================
    // CINEMATIC ULTIMATES
    // ========================================================================
    playUltimate(era = 0, worldX = null) {
        this.resume();
        this.triggerDucking(0.18, 2.5);

        if (era === 0) {
            if (this.playSample('meteor_ultimate', 0, worldX, 1.0)) return;
            this.synthMeteorAtmosphere(worldX);
        } else if (era === 1) {
            this.synthArrowVolleyRoar(worldX);
        } else if (era === 2) {
            if (this.playSample('cannon', -80, worldX, 1.0)) return;
            this.synthArtilleryBarrageRoar(worldX);
        } else if (era === 3) {
            this.synthAirstrikeSiren(worldX);
        } else {
            if (this.playSample('orbital_laser', 0, worldX, 1.0)) return;
            this.synthOrbitalCharge(worldX);
        }
    }

    playUltimateImpact(era = 0, worldX = null) {
        this.resume();
        if (!this.canPlayVoice('ult_impact', 60)) return;
        const detune = (Math.random() - 0.5) * 160;

        if (era === 0) {
            if (this.playSample('cannon', detune, worldX, 0.85)) return;
            this.synthMeteorImpact(worldX);
        } else if (era === 1) {
            this.synthFireArrowImpact(worldX);
        } else if (era === 2) {
            if (this.playSample('cannon', detune, worldX, 0.85)) return;
            this.synthCannonBoom(worldX);
        } else if (era === 3) {
            if (this.playSample('tank_shot', detune, worldX, 0.9)) return;
            this.synthHeavyBombDetonate(worldX);
        } else {
            if (this.playSample('laser_0', detune, worldX, 0.8)) return;
            this.synthLaserBeam(worldX);
        }
    }

    playVictory() {
        this.resume();
        this.stopMusic();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const fanfare = [
                { f: 523.25, d: 0.2 },
                { f: 659.25, d: 0.2 },
                { f: 783.99, d: 0.25 },
                { f: 1046.50, d: 0.6 }
            ];
            let offset = 0;
            fanfare.forEach(item => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(item.f, t + offset);
                gain.gain.setValueAtTime(0.35, t + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, t + offset + item.d * 1.5);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + offset);
                osc.stop(t + offset + item.d * 1.6);
                offset += item.d;
            });
        } catch (e) {}
    }

    playDefeat() {
        this.resume();
        this.stopMusic();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const sadNotes = [440, 415.3, 392, 349.23, 329.63];
            sadNotes.forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, t + idx * 0.32);
                gain.gain.setValueAtTime(0.28, t + idx * 0.32);
                gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.32 + 0.48);
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
                osc.start(t + idx * 0.32);
                osc.stop(t + idx * 0.32 + 0.52);
            });
        } catch (e) {}
    }

    playNoise(dur = 0.2, vol = 0.4, freq = 350) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + dur);
            gain.gain.setValueAtTime(vol * 0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
            osc.start(t);
            osc.stop(t + dur + 0.05);
        } catch (e) {}
    }

    // ========================================================================
    // PROCEDŪRINIŲ EFEKTŲ SINTEZATORIAI
    // ========================================================================
    synthClubImpact(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.26);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150 + (Math.random() - 0.5) * 30, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.10);
        } catch (e) {}
    }

    synthDinoRoarAndBite(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.30);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(90, t);
            osc.frequency.linearRampToValueAtTime(160, t + 0.08);
            osc.frequency.exponentialRampToValueAtTime(35, t + 0.22);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.26);
        } catch (e) {}
    }

    synthBladeSlash(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.20);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1100 + (Math.random() - 0.5) * 200, t);
            osc.frequency.exponentialRampToValueAtTime(220, t + 0.07);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.09);
        } catch (e) {}
    }

    synthKnightLance(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.28);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(240, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.16);
        } catch (e) {}
    }

    synthBluntImpact(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.24);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140 + (Math.random() - 0.5) * 30, t);
            osc.frequency.exponentialRampToValueAtTime(35, t + 0.08);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.10);
        } catch (e) {}
    }

    synthRapierThrust(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.18);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2200 + (Math.random() - 0.5) * 300, t);
            osc.frequency.exponentialRampToValueAtTime(750, t + 0.05);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.07);
        } catch (e) {}
    }

    synthLaserBlade(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.20);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(900 + (Math.random() - 0.5) * 150, t);
            osc.frequency.exponentialRampToValueAtTime(140, t + 0.09);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.11);
        } catch (e) {}
    }

    synthMechStomp(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.35);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(95, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.22);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.28);
        } catch (e) {}
    }

    synthBowRelease(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.20);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(450 + (Math.random() - 0.5) * 50, t);
            osc.frequency.exponentialRampToValueAtTime(110, t + 0.07);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.09);
        } catch (e) {}
    }

    synthSlingWhoosh(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.18);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(260 + (Math.random() - 0.5) * 40, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.09);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.11);
        } catch (e) {}
    }

    synthGunshot(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.26);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800 + (Math.random() - 0.5) * 100, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.11);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.13);
        } catch (e) {}
    }

    synthRifleBurst(worldX = null) {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.synthGunshot(worldX), i * 65);
        }
    }

    synthCannonBoom(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.38);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160 + (Math.random() - 0.5) * 20, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.40);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.50);
        } catch (e) {}
    }

    synthRocketLaunch(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.30);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(280, t);
            osc.frequency.exponentialRampToValueAtTime(70, t + 0.25);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.30);
        } catch (e) {}
    }

    synthPlasmaBlast(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.26);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1100 + (Math.random() - 0.5) * 150, t);
            osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.20);
        } catch (e) {}
    }

    synthLaserBeam(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.24);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1800 + (Math.random() - 0.5) * 200, t);
            osc.frequency.exponentialRampToValueAtTime(220, t + 0.14);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.16);
        } catch (e) {}
    }

    synthTeslaZap(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.22);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(480 + (Math.random() - 0.5) * 100, t);
            osc.frequency.setValueAtTime(120, t + 0.04);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.14);
        } catch (e) {}
    }

    synthAcidSpray(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.20);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(650, t);
            osc.frequency.exponentialRampToValueAtTime(150, t + 0.16);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.20);
        } catch (e) {}
    }

    synthFrostBeam(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.20);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1600, t);
            osc.frequency.exponentialRampToValueAtTime(320, t + 0.16);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.20);
        } catch (e) {}
    }

    synthCathedralBell(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.30);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, t);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.65);
        } catch (e) {}
    }

    synthMeteorAtmosphere(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.38);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 1.2);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 1.5);
        } catch (e) {}
    }

    synthMeteorImpact(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.38);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110 + (Math.random() - 0.5) * 30, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.42);
        } catch (e) {}
    }

    synthArrowVolleyRoar(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.32);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(550, t);
            osc.frequency.exponentialRampToValueAtTime(180, t + 0.8);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.95);
        } catch (e) {}
    }

    synthFireArrowImpact(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.22);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(650 + (Math.random() - 0.5) * 120, t);
            osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.18);
        } catch (e) {}
    }

    synthArtilleryBarrageRoar(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.38);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(240, t);
            osc.frequency.exponentialRampToValueAtTime(35, t + 0.9);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 1.05);
        } catch (e) {}
    }

    synthAirstrikeSiren(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.32);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, t);
            osc.frequency.linearRampToValueAtTime(650, t + 0.6);
            osc.frequency.exponentialRampToValueAtTime(120, t + 1.5);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 1.7);
        } catch (e) {}
    }

    synthHeavyBombDetonate(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.42);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180 + (Math.random() - 0.5) * 30, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.45);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 0.55);
        } catch (e) {}
    }

    synthOrbitalCharge(worldX = null) {
        this.resume();
        if (!this.ctx || this.muted) return;
        try {
            const t = this.ctx.currentTime;
            const route = this.getSpatialRoute(worldX, 0.32);
            if (!route.dest) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(2400, t + 1.0);
            gain.gain.setValueAtTime(route.gain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
            osc.connect(gain);
            gain.connect(route.dest);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); if (route.panner) route.panner.disconnect(); };
            osc.start(t);
            osc.stop(t + 1.25);
        } catch (e) {}
    }

    // ========================================================================
    // MUZIKA
    // ========================================================================
    startMusic(era = 0) {
        if (typeof era === 'number' && !isNaN(era)) {
            this.currentEra = era;
        }
        this.isAudioPaused = false;
        this.musicPlaying = true;
        this.wasMusicPlaying = true;
        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = null;
        }
        if (!this.ctx) this.init();
        if (this.masterGain && this.ctx && !this.muted) {
            try {
                this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
                this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
            } catch (e) {}
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                if (this.musicPlaying && !this.isAudioPaused && !this.musicTimer) {
                    this.scheduleBeat();
                }
            }).catch(() => {
                if (this.musicPlaying && !this.isAudioPaused && !this.musicTimer) {
                    this.scheduleBeat();
                }
            });
            return;
        }
        this.scheduleBeat();
    }

    setEra(era) {
        if (typeof era === 'number' && !isNaN(era)) {
            this.currentEra = era;
            if (this.musicPlaying && !this.isAudioPaused && !this.muted) {
                // Sklandžiai atnaujiname instrumentuotę naujai epochai
                this.startMusic(era);
            }
        }
    }

    setBattleTension(val) {
        this.battleTension = Math.max(0, Math.min(1, val));
    }

    stopMusic() {
        this.musicPlaying = false;
        this.wasMusicPlaying = false;
        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = null;
        }
    }

    scheduleBeat() {
        if (!this.musicPlaying || !this.ctx || this.isAudioPaused) {
            this.musicTimer = null;
            return;
        }

        let nextDelay = 250;
        try {
            // Apsauga: atstatome master / ducking / music gain, jei po pauzės ar mūšio jie buvo prislopinti
            if (this.masterGain && !this.muted && this.masterGain.gain.value < 0.5) {
                try {
                    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
                } catch (e) {}
            }
            if (this.duckingGain && this.duckingGain.gain.value < 0.6) {
                this.duckingGain.gain.cancelScheduledValues(this.ctx.currentTime);
                this.duckingGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
            }
            if (this.musicGain && this.musicGain.gain.value < 0.1 && !this.muted) {
                this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            }

            const baseBpm = 96 + this.currentEra * 5;
            const bpm = baseBpm + (this.battleTension || 0) * 26;
            const stepDuration = 60 / bpm / 2;
            nextDelay = Math.max(60, Math.floor(stepDuration * 1000));

            if (this.muted) {
                this.musicStep = (this.musicStep + 1) % 64;
                return;
            }

            const t = this.ctx.currentTime + 0.03;
            const step = this.musicStep;

            // Harmoninės gamos kiekvienai epochai (aiškios, skambios, herojiškos)
            const eraScales = [
                [110.00, 130.81, 146.83, 164.81, 196.00, 220.00], // 0: Priešistorė (A minor pentatonic)
                [110.00, 130.81, 146.83, 164.81, 196.00, 220.00], // 1: Viduramžiai (Dorian / Castle)
                [130.81, 164.81, 196.00, 246.94, 261.63, 329.63], // 2: Renesansas (Major / Fanfare)
                [98.00, 110.00, 130.81, 146.83, 164.81, 196.00],  // 3: Modernas (Military marching)
                [130.81, 146.83, 164.81, 196.00, 261.63, 293.66]  // 4: Ateitis (Cyber electro)
            ];

            const scale = eraScales[Math.min(this.currentEra, eraScales.length - 1)];

            // --- 0 EPOCHA: AKMENS AMŽIUS (Genčių ritmas, galingas medinis būgnas + šamaninė fleita) ---
            if (this.currentEra === 0) {
                // Būgnas kas 2 žingsnius
                if (step % 2 === 0) {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    const freq = (step % 8 === 0) ? 110 : (step % 8 === 4 ? 130 : 95);
                    osc.frequency.setValueAtTime(freq, t);
                    osc.frequency.exponentialRampToValueAtTime(35, t + stepDuration * 0.9);
                    gain.gain.setValueAtTime(0.24, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.9);
                    osc.connect(gain);
                    gain.connect(this.musicGain);
                    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
                    osc.start(t);
                    osc.stop(t + stepDuration * 0.95);
                }
                // Šamaninė fleita (melodija, gerai girdima per bet kokias kolonėles!)
                if (step % 4 === 1 || step % 8 === 6) {
                    const flute = this.ctx.createOscillator();
                    const fluteGain = this.ctx.createGain();
                    flute.type = 'sine';
                    const notes = [220.00, 261.63, 293.66, 329.63, 392.00];
                    const note = notes[(Math.floor(step / 4)) % notes.length];
                    flute.frequency.setValueAtTime(note, t);
                    fluteGain.gain.setValueAtTime(0.01, t);
                    fluteGain.gain.linearRampToValueAtTime(0.12, t + 0.04);
                    fluteGain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.5);
                    flute.connect(fluteGain);
                    fluteGain.connect(this.musicGain);
                    flute.onended = () => { try { flute.disconnect(); fluteGain.disconnect(); } catch(e){} };
                    flute.start(t);
                    flute.stop(t + stepDuration * 1.6);
                }
            }
            // --- 1 EPOCHA: VIDURAMŽIAI (Pilių varpai, liutnė ir kovos būgnas) ---
            else if (this.currentEra === 1) {
                if (step % 2 === 0) {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    const noteIdx = (step % 16 < 8) ? (step % 4 === 0 ? 0 : 2) : (step % 4 === 0 ? 3 : 1);
                    osc.frequency.setValueAtTime(scale[noteIdx], t);
                    gain.gain.setValueAtTime(0.18, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.6);
                    osc.connect(gain);
                    gain.connect(this.musicGain);
                    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
                    osc.start(t);
                    osc.stop(t + stepDuration * 1.7);
                }
                if (step % 8 === 0) {
                    // Žemas pilies varpas / gongas
                    const bell = this.ctx.createOscillator();
                    const bellGain = this.ctx.createGain();
                    bell.type = 'sine';
                    bell.frequency.setValueAtTime(220.00, t);
                    bellGain.gain.setValueAtTime(0.12, t);
                    bellGain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 3.0);
                    bell.connect(bellGain);
                    bellGain.connect(this.musicGain);
                    bell.onended = () => { try { bell.disconnect(); bellGain.disconnect(); } catch(e){} };
                    bell.start(t);
                    bell.stop(t + stepDuration * 3.1);
                }
            }
            // --- 2 EPOCHA: RENESANSAS (Baroko klavesinas / fanfaros) ---
            else if (this.currentEra === 2) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = (step % 4 === 0) ? 'triangle' : 'sine';
                const note = scale[step % scale.length];
                osc.frequency.setValueAtTime(note * 1.5, t);
                gain.gain.setValueAtTime(0.14, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.1);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
                osc.start(t);
                osc.stop(t + stepDuration * 1.15);
            }
            // --- 3 EPOCHA: MODERNAS (Karinis maršas: ritmingas būgnas + trimitas) ---
            else if (this.currentEra === 3) {
                // Karinis ritmas (Snare / Kick)
                if (step % 2 === 0) {
                    const kick = this.ctx.createOscillator();
                    const kickGain = this.ctx.createGain();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime((step % 4 === 0) ? 140 : 90, t);
                    kick.frequency.exponentialRampToValueAtTime(45, t + 0.12);
                    kickGain.gain.setValueAtTime(0.22, t);
                    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
                    kick.connect(kickGain);
                    kickGain.connect(this.musicGain);
                    kick.onended = () => { try { kick.disconnect(); kickGain.disconnect(); } catch(e){} };
                    kick.start(t);
                    kick.stop(t + 0.15);
                }
                // Karinio trimito melodija kas 4 žingsnius
                if (step % 4 === 2) {
                    const brass = this.ctx.createOscillator();
                    const brassGain = this.ctx.createGain();
                    brass.type = 'sawtooth';
                    const melodyNotes = [293.66, 329.63, 392.00, 440.00];
                    const note = melodyNotes[(Math.floor(step / 4)) % melodyNotes.length];
                    brass.frequency.setValueAtTime(note, t);
                    brassGain.gain.setValueAtTime(0.01, t);
                    brassGain.gain.linearRampToValueAtTime(0.10, t + 0.03);
                    brassGain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.2);
                    brass.connect(brassGain);
                    brassGain.connect(this.musicGain);
                    brass.onended = () => { try { brass.disconnect(); brassGain.disconnect(); } catch(e){} };
                    brass.start(t);
                    brass.stop(t + stepDuration * 1.25);
                }
            }
            // --- 4 EPOCHA: ATEITIS (Kiberpankas, pulsuojantis sintezatorius) ---
            else {
                const lead = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                lead.type = (step % 4 === 0) ? 'sawtooth' : 'triangle';
                const noteIdx = [0, 2, 4, 3, 5, 4, 2, 1][step % 8];
                lead.frequency.setValueAtTime(scale[noteIdx] * 2, t);
                leadGain.gain.setValueAtTime(0.13, t);
                leadGain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 0.9);
                lead.connect(leadGain);
                leadGain.connect(this.musicGain);
                lead.onended = () => { try { lead.disconnect(); leadGain.disconnect(); } catch(e){} };
                lead.start(t);
                lead.stop(t + stepDuration * 0.95);
            }

            this.musicStep = (this.musicStep + 1) % 64;
        } catch (e) {
            console.warn('Audio scheduleBeat error safely handled:', e);
        } finally {
            // GARANTUOJAMAS CIKLO TĘSTINUMAS: Muzika niekada nebegali nutrūkti!
            if (this.musicPlaying && !this.isAudioPaused) {
                this.musicTimer = setTimeout(() => this.scheduleBeat(), nextDelay);
            }
        }
    }
}

// Globali instancija ir automatinis Web Audio atrakinimas
window.RTSAudioSystem = RTSAudioSystem;
window.rtsSoundSystem = new RTSAudioSystem();

const unlockRTSAudio = () => {
    if (window.rtsSoundSystem) {
        window.rtsSoundSystem.resume();
    }
};
['click', 'keydown', 'touchstart', 'mousedown'].forEach(ev => {
    window.addEventListener(ev, unlockRTSAudio, { passive: true });
});
