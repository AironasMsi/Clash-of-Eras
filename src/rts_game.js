// ============================================================================
// CLASH OF ERAS - COMPLETE ENHANCED RTS GAME ENGINE
// ============================================================================

class RTSGame {
    constructor() {
        this.canvas = document.getElementById('rtsCanvas');
        this.renderer = new RTSRenderer(this.canvas);
        this.sound = window.rtsSoundSystem || (window.RTSAudioSystem ? new window.RTSAudioSystem() : null);

        this.state = 'MENU';
        this.isPaused = false;
        this.difficulty = 'easy';
        this.gameMode = 'standard'; // 'standard', 'endless', 'challenge', 'sandbox'
        this.currentChallenge = null;
        this.aiPersonality = 'aggressive';
        this.isUnlimitedMode = false;
        this.gameSpeed = 1;
        this.gameTime = 0;
        this.scaleFactor = 1;

        // Karių gamybos eilė (Training Queue - praplėsta iki 9)
        this.spawnQueue = [];
        this.maxQueueSize = 9;

        // Ultimate gebėjimų panaudojimo skaitikliai (didėjantis cooldown)
        this.playerUltimateCasts = 0;
        this.enemyUltimateCasts = 0;

        // Išlikimo režimo (Endless) bangos
        this.survivalWave = 1;
        this.survivalWaveTimer = 12.0;
        this.survivalWaveActive = false;

        // Populiacijos laikmačiai
        this.popSpawnInterval = RTS_DATA.BASE_POP_SPAWN_INTERVAL;
        this.popTimer = 0;
        this.enemyPopTimer = 0;
        this.gatherAmount = RTS_DATA.BASE_GATHER_AMOUNT;

        // Žaidėjo resursai ir progresas
        this.playerEra = 0;
        this.playerGold = RTS_DATA.STARTING_GOLD;
        this.playerXp = 0;
        this.playerResources = { ...RTS_DATA.STARTING_RESOURCES };
        this.playerBase = { hp: 600, maxHp: 600 };
        this.playerWorkers = [];
        this.playerTurrets = [null, null, null, null];
        this.playerUnlockedSlots = 1;
        this.playerUltimateCooldown = 0;

        // Priešo resursai ir progresas
        this.enemyEra = 0;
        this.enemyGold = RTS_DATA.STARTING_GOLD;
        this.enemyXp = 0;
        this.enemyResources = { ...RTS_DATA.STARTING_RESOURCES };
        this.enemyBase = { hp: 600, maxHp: 600 };
        this.enemyWorkers = [];
        this.enemyTurrets = [null, null, null, null];
        this.enemyUnlockedSlots = 1;
        this.enemyUltimateCooldown = 0;

        // Mūšio objektai ir Telkiniai (Object Pooling)
        this.soldiers = [];
        this.projectiles = [];
        this.initPools();
        this.activeUltimates = [];

        // Mūšio statistika (End-game Summary & MVP)
        this.stats = {
            kills: 0,
            losses: 0,
            damageDealt: 0,
            damageTaken: 0,
            resourcesGathered: 0,
            goldEarned: 0,
            ultimatesCast: 0,
            wavesCleared: 0,
            unitsKilledByType: {},
            playerUnitsSpawned: {}
        };

        this.tacticalStance = 'attack';
        this.autoTrainIndex = -1;
        this.currentWeather = 'clear';
        this.targetWeather = 'clear';
        this.weatherWeights = { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 };
        this.weatherTimer = 45.0;
        this.playerWorkers = [];
        this.enemyWorkers = [];
        this.smartWorkerTimer = 0;
        this.autoMilitaryTimer = 0;
        this.autoTradeTimer = 0;
        this.passiveIncomeTimer = 0;
        this.baseCollapsePending = null;
        this.autoSaveTimer = 0;
        this.battleFinished = false;
        this.hasUsedReviveAd = false;
        this.hasShownVictoryAd = false;

        // Išsaugoti duomenys (LocalStorage)
        this.loadSavedData();

        // AI Valdiklis
        this.ai = new RTSOpponentAI(this, this.difficulty, this.aiPersonality);

        // Kameros valdymas
        this.isDragging = false;
        this.dragStartX = 0;
        this.cameraStartX = 0;
        this.lastFrameTime = performance.now();

        this.cacheDOM();
        this.initEventListeners();
    }

    cacheDOM() {
        this.ui = {
            playerGold: document.getElementById('playerGold'),
            playerXp: document.getElementById('playerXp'),
            resFood: document.getElementById('resFood'),
            resWood: document.getElementById('resWood'),
            resStone: document.getElementById('resStone'),
            resPop: document.getElementById('resPop'),
            popTimerText: document.getElementById('popTimerText'),
            upgradePopBtn: document.getElementById('upgradePopBtn'),
            upgradeToolsBtn: document.getElementById('upgradeToolsBtn'),
            playerEraName: document.getElementById('playerEraName'),
            enemyEraName: document.getElementById('enemyEraName'),
            evolveBtn: document.getElementById('rtsEvolveBtn'),
            ultBtn: document.getElementById('rtsUltimateBtn'),
            ultBtnName: document.getElementById('rtsUltBtnName'),
            ultBtnStatus: document.getElementById('rtsUltBtnStatus'),
            pauseBtn: document.getElementById('rtsPauseBtn'),
            pauseOverlay: document.getElementById('rtsPauseOverlay'),
            spawnQueueContainer: document.getElementById('spawnQueueContainer'),
            modeBadgeBtn: document.getElementById('modeBadgeBtn'),
            diffBadgeBtn: document.getElementById('diffBadgeBtn'),
            matchTimerBadge: document.getElementById('matchTimerBadge'),
            unitBtns: [0, 1, 2].map(i => ({
                btn: document.getElementById(`rtsUnitBtn_${i}`),
                name: document.getElementById(`rtsUnitName_${i}`),
                cost: document.getElementById(`rtsUnitCost_${i}`)
            })),
            hubGold: document.getElementById('hubModalGold'),
            hubWood: document.getElementById('hubModalWood'),
            hubStone: document.getElementById('hubModalStone'),
            hubFood: document.getElementById('hubModalFood')
        };
    }

    loadSavedData() {
        try {
            this.unlockedAchievements = JSON.parse(localStorage.getItem('aow_achievements') || '{}');
            this.highScores = JSON.parse(localStorage.getItem('aow_highscores') || '{"endlessWave":0,"victories":0,"totalKills":0}');
            this.settings = JSON.parse(localStorage.getItem('aow_settings') || '{}');
        } catch (e) {
            this.unlockedAchievements = {};
            this.highScores = { endlessWave: 0, victories: 0, totalKills: 0 };
            this.settings = {};
        }

        // Kalba: numatytoji (default) kalba yra anglų ('en'), saugoma ir keičiama
        if (!this.settings.language) {
            const savedLang = localStorage.getItem('aow_language');
            this.settings.language = (savedLang === 'lt' || savedLang === 'en') ? savedLang : 'en';
        }
        if (window.RTS_I18N) {
            window.RTS_I18N.setLanguage(this.settings.language);
        }

        if (this.settings.sfxVolume === undefined) this.settings.sfxVolume = 0.15;
        if (this.settings.musicVolume === undefined) this.settings.musicVolume = 0.15;
        if (this.settings.gameSpeed === undefined) this.settings.gameSpeed = 1;
        if (!this.settings.graphicsQuality) this.settings.graphicsQuality = 'medium';
        const isLow = (this.settings.graphicsQuality === 'low');
        if (this.settings.windEffects === undefined) this.settings.windEffects = !isLow;
        if (this.settings.uiGlow === undefined) this.settings.uiGlow = !isLow;
        // Pagal atsiųstą vartotojo nuotrauką - plaukiojantys tekstai pagal nutylėjimą IŠJUNGTI (false)
        if (this.settings.baseFloatingTexts === undefined) this.settings.baseFloatingTexts = false;
        if (this.settings.showFloatingTexts === undefined) this.settings.showFloatingTexts = false;
        if (this.settings.castleEvoBeam === undefined) this.settings.castleEvoBeam = !isLow;
        if (this.settings.baseInWorldUI === undefined) this.settings.baseInWorldUI = !isLow;
        // Pilies ratukas ir populiacija visada įjungti (always ON)
        this.settings.popSpawnWheel = true;
        if (this.settings.bgClouds === undefined) this.settings.bgClouds = !isLow;
        if (this.settings.combatParticles === undefined) this.settings.combatParticles = !isLow;
        this.applySettings();
    }

    saveData() {
        try {
            localStorage.setItem('aow_achievements', JSON.stringify(this.unlockedAchievements));
            localStorage.setItem('aow_highscores', JSON.stringify(this.highScores));
            localStorage.setItem('aow_settings', JSON.stringify(this.settings));
            if (this.settings && this.settings.language) {
                localStorage.setItem('aow_language', this.settings.language);
            }
        } catch (e) {
            console.warn('LocalStorage save error:', e);
        }
    }

    saveGameState() {
        if (this.state === 'VICTORY' || this.state === 'DEFEAT' || !this.playerBase || this.playerBase.hp <= 0 || this.gameTime < 1) {
            return;
        }
        if (this.gameMode !== 'endless' && this.gameMode !== 'monsters' && this.enemyBase && this.enemyBase.hp <= 0) {
            return;
        }

        try {
            const battleData = {
                version: 2,
                savedAt: Date.now(),
                gameMode: this.gameMode,
                difficulty: this.difficulty,
                aiPersonality: this.aiPersonality,
                challengeId: this.currentChallenge ? this.currentChallenge.id : null,
                isUnlimitedMode: this.isUnlimitedMode,
                gameTime: this.gameTime,
                gatherAmount: this.gatherAmount,
                passiveIncomeTimer: this.passiveIncomeTimer,
                
                // Žaidėjo progresas
                playerEra: this.playerEra,
                playerGold: this.playerGold,
                playerXp: this.playerXp,
                playerResources: { ...this.playerResources },
                playerBase: { hp: this.playerBase.hp, maxHp: this.playerBase.maxHp },
                playerUpgrades: { ...this.playerUpgrades },
                playerWall: { ...this.playerWall },
                playerTurrets: this.playerTurrets.map((t, idx) => (t && t.data) ? { slotIndex: idx, turretId: t.data.id, era: t.era || 0 } : null),
                playerUnlockedSlots: this.playerUnlockedSlots,
                playerUltimateCooldown: this.playerUltimateCooldown,
                playerUltimateCasts: this.playerUltimateCasts,
                activePerks: [...this.activePerks],
                chosenBranches: { ...this.chosenBranches },
                playerBranch: this.playerBranch,
                
                // Priešo progresas
                enemyEra: this.enemyEra,
                enemyGold: this.enemyGold,
                enemyXp: this.enemyXp,
                enemyResources: { ...this.enemyResources },
                enemyBase: { hp: this.enemyBase.hp, maxHp: this.enemyBase.maxHp },
                enemyUpgrades: { ...this.enemyUpgrades },
                enemyWall: { ...this.enemyWall },
                enemyTurrets: this.enemyTurrets.map((t, idx) => (t && t.data) ? { slotIndex: idx, turretId: t.data.id, era: t.era || 0 } : null),
                enemyUnlockedSlots: this.enemyUnlockedSlots,
                enemyUltimateCooldown: this.enemyUltimateCooldown,
                enemyUltimateCasts: this.enemyUltimateCasts,
                
                // Bangų režimų būsena
                survivalWave: this.survivalWave,
                survivalWaveTimer: this.survivalWaveTimer,
                survivalWaveActive: this.survivalWaveActive,
                monsterWave: this.monsterWave,
                monsterWaveTimer: this.monsterWaveTimer,
                monsterWaveActive: this.monsterWaveActive,

                // Automatizacijos konfigūracijos
                autoGatherConfig: { ...this.autoGatherConfig },
                autoMilitaryConfig: { ...this.autoMilitaryConfig },
                autoTradeConfig: { ...this.autoTradeConfig },

                // Statistika
                stats: { ...this.stats },

                // Taktika ir orai
                tacticalStance: this.tacticalStance || 'attack',
                autoTrainIndex: this.autoTrainIndex !== undefined ? this.autoTrainIndex : -1,
                currentWeather: this.currentWeather || 'clear',
                targetWeather: this.targetWeather || 'clear',
                weatherWeights: this.weatherWeights ? { ...this.weatherWeights } : { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 },
                weatherTimer: typeof this.weatherTimer === 'number' ? this.weatherTimer : 45.0,

                // Gyvi kariai mūšio lauke
                soldiers: (this.soldiers || []).filter(s => s.state !== 'DYING' && s.hp > 0).map(s => ({
                    isPlayer: s.isPlayer,
                    era: s.era || 0,
                    x: s.x,
                    hp: s.hp,
                    maxHp: s.maxHp,
                    damage: s.damage,
                    unitId: s.data ? s.data.id : '',
                    unitName: s.data ? s.data.name : '',
                    isHero: !!s.isHero,
                    isMonster: !!s.isMonster,
                    monsterType: s.monsterType || null,
                    isGiant: !!s.isGiant
                })),

                // Aktyvūs darbininkai kasyklose
                playerWorkers: (this.playerWorkers || []).filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').map(w => ({
                    role: w.role,
                    x: Math.round(w.x),
                    carryingAmount: w.carryingAmount || 0,
                    gatherAmount: w.gatherAmount || 10,
                    state: w.state
                }))
            };

            localStorage.setItem('aow_saved_battle', JSON.stringify(battleData));
        } catch (e) {
            console.warn('LocalStorage battle save error:', e);
        }
    }

    clearSavedGame() {
        try {
            localStorage.removeItem('aow_saved_battle');
        } catch (e) {}
    }

    hasSavedGame() {
        try {
            const raw = localStorage.getItem('aow_saved_battle');
            if (!raw) return false;
            const d = JSON.parse(raw);
            return !!(d && d.playerBase && d.playerBase.hp > 0 && d.gameTime > 1);
        } catch (e) {
            return false;
        }
    }

    getSavedGameInfo() {
        try {
            const raw = localStorage.getItem('aow_saved_battle');
            if (!raw) return null;
            const d = JSON.parse(raw);
            if (!d) return null;
            const eraName = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getAgeName(d.playerEra) : (RTS_DATA.AGES[d.playerEra] ? RTS_DATA.AGES[d.playerEra].name : 'Epocha');
            const totalSecs = Math.max(0, Math.floor(d.gameTime || 0));
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            return {
                eraName,
                timeStr,
                gameMode: d.gameMode,
                difficulty: d.difficulty,
                wave: d.monsterWave || d.survivalWave || 1
            };
        } catch (e) {
            return null;
        }
    }

    loadGameState() {
        const raw = localStorage.getItem('aow_saved_battle');
        if (!raw) return false;

        try {
            const d = JSON.parse(raw);
            if (!d || !d.playerBase || d.playerBase.hp <= 0) return false;

            this.gameMode = d.gameMode || 'standard';
            this.difficulty = d.difficulty || 'normal';
            this.aiPersonality = d.aiPersonality || 'aggressive';
            this.isUnlimitedMode = !!d.isUnlimitedMode || (this.difficulty === 'unlimited') || (this.gameMode === 'sandbox');
            this.gameTime = d.gameTime || 0;
            this.gatherAmount = d.gatherAmount || RTS_DATA.BASE_GATHER_AMOUNT;
            this.passiveIncomeTimer = d.passiveIncomeTimer || 0;
            this.popTimer = 0;
            this.enemyPopTimer = 0;
            this.popSpawnInterval = RTS_DATA.BASE_POP_SPAWN_INTERVAL;
            this.playerWorkers = [];
            this.enemyWorkers = [];
            this.smartWorkerTimer = 0;
            this.autoMilitaryTimer = 0;
            this.autoTradeTimer = 0;
            this.baseCollapsePending = null;
            this.currentChallenge = d.challengeId ? (RTS_DATA.CHALLENGES.find(c => c.id === d.challengeId) || null) : null;
            this.tacticalStance = d.tacticalStance || 'attack';
            this.autoTrainIndex = d.autoTrainIndex !== undefined ? d.autoTrainIndex : -1;
            this.currentWeather = d.currentWeather || 'clear';
            this.targetWeather = d.targetWeather || 'clear';
            this.weatherWeights = d.weatherWeights || { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 };
            this.weatherTimer = typeof d.weatherTimer === 'number' ? d.weatherTimer : 45.0;

            this.playerEra = d.playerEra || 0;
            this.playerGold = d.playerGold || 200;
            this.playerXp = d.playerXp || 0;
            this.playerResources = d.playerResources || { ...RTS_DATA.STARTING_RESOURCES };
            if (this.isUnlimitedMode) {
                this.playerBase = { hp: 9999999, maxHp: 9999999 };
                this.enemyBase = { hp: 9999999, maxHp: 9999999 };
            } else {
                this.playerBase = d.playerBase || { hp: 600, maxHp: 600 };
            }
            this.playerUpgrades = d.playerUpgrades || { base_wall: 0, workers_ai: 0, military_academy: 0, trade_economy: 0 };
            this.playerUnlockedSlots = d.playerUnlockedSlots || 1;
            this.playerWall = d.playerWall || { active: false, x: RTS_DATA.PLAYER_BASE_X + 255, width: 26, height: 160, hp: 450, maxHp: 450, rebuildTimer: 0, maxRebuildTimer: 20 };
            this.playerWall.x = RTS_DATA.PLAYER_BASE_X + 255; // Užtikriname erdvią poziciją (595px), kad siena neužgožtų turgelio ir dekoracijų
            this.playerUltimateCooldown = d.playerUltimateCooldown || 0;
            this.playerUltimateCasts = d.playerUltimateCasts || 0;
            this.activePerks = d.activePerks || [];
            this.chosenBranches = d.chosenBranches || {};
            this.playerBranch = d.playerBranch || null;

            this.enemyEra = d.enemyEra || 0;
            this.enemyGold = d.enemyGold || 200;
            this.enemyXp = d.enemyXp || 0;
            this.enemyResources = d.enemyResources || { ...RTS_DATA.STARTING_RESOURCES };
            if (!this.isUnlimitedMode) {
                const enemyBaseHp = (this.gameMode === 'endless' || this.gameMode === 'monsters') ? 9999999 : (d.enemyBase ? d.enemyBase.maxHp : 600);
                this.enemyBase = d.enemyBase || { hp: enemyBaseHp, maxHp: enemyBaseHp };
            }
            this.enemyUpgrades = d.enemyUpgrades || { base_wall: 0, workers_ai: 0, military_academy: 0, trade_economy: 0 };
            this.enemyWall = d.enemyWall || { active: false, x: RTS_DATA.ENEMY_BASE_X - 50, width: 26, height: 160, hp: 450, maxHp: 450, rebuildTimer: 0, maxRebuildTimer: 20 };
            this.enemyUnlockedSlots = d.enemyUnlockedSlots || 1;
            this.enemyUltimateCooldown = d.enemyUltimateCooldown || 0;
            this.enemyUltimateCasts = d.enemyUltimateCasts || 0;

            this.survivalWave = d.survivalWave || 1;
            this.survivalWaveTimer = d.survivalWaveTimer || 10.0;
            this.survivalWaveActive = !!d.survivalWaveActive;
            this.monsterWave = d.monsterWave || 1;
            this.monsterWaveTimer = d.monsterWaveTimer || 6.0;
            this.monsterWaveActive = !!d.monsterWaveActive;

            if (d.autoGatherConfig) this.autoGatherConfig = { ...this.autoGatherConfig, ...d.autoGatherConfig };
            if (d.autoMilitaryConfig) this.autoMilitaryConfig = { ...this.autoMilitaryConfig, ...d.autoMilitaryConfig };
            if (d.autoTradeConfig) this.autoTradeConfig = { ...this.autoTradeConfig, ...d.autoTradeConfig };
            if (d.stats) this.stats = { ...d.stats };

            // Pagalbinė bokštelio specifikacijos paieškos funkcija
            const findTurretSpec = (turretId) => {
                if (!turretId) return null;
                for (let e = 0; e < RTS_DATA.AGES.length; e++) {
                    const tList = RTS_DATA.AGES[e].turrets || [];
                    const found = tList.find(t => t.id === turretId);
                    if (found) return found;
                }
                return null;
            };

            this.playerTurrets = [null, null, null, null];
            if (Array.isArray(d.playerTurrets)) {
                d.playerTurrets.forEach(tData => {
                    if (tData && tData.turretId) {
                        const spec = findTurretSpec(tData.turretId);
                        if (spec) {
                            this.playerTurrets[tData.slotIndex] = new RTSTurret(tData.slotIndex, spec, true, tData.era);
                        }
                    }
                });
            }

            this.enemyTurrets = [null, null, null, null];
            if (Array.isArray(d.enemyTurrets)) {
                d.enemyTurrets.forEach(tData => {
                    if (tData && tData.turretId) {
                        const spec = findTurretSpec(tData.turretId);
                        if (spec) {
                            this.enemyTurrets[tData.slotIndex] = new RTSTurret(tData.slotIndex, spec, false, tData.era);
                        }
                    }
                });
            }

            this.soldiers = [];
            if (Array.isArray(d.soldiers)) {
                d.soldiers.forEach(sData => {
                    let uData = null;
                    if (sData.isMonster && sData.monsterType && RTS_DATA.MONSTERS[sData.monsterType]) {
                        uData = RTS_DATA.MONSTERS[sData.monsterType];
                    } else if (sData.isHero) {
                        uData = (RTS_DATA.HEROES && RTS_DATA.HEROES[sData.era]) ? RTS_DATA.HEROES[sData.era] : null;
                    } else {
                        const era = sData.era || 0;
                        const eraUnits = (RTS_DATA.AGES[era] && RTS_DATA.AGES[era].units) ? RTS_DATA.AGES[era].units : RTS_DATA.AGES[0].units;
                        uData = eraUnits.find(u => (sData.unitId && u.id === sData.unitId) || u.name === sData.unitName) || eraUnits[0];
                    }
                    if (uData) {
                        const s = new RTSSoldier(sData.isPlayer, uData, sData.era || 0, sData.x);
                        s.hp = sData.hp;
                        s.maxHp = sData.maxHp || sData.hp;
                        if (sData.damage) s.damage = sData.damage;
                        if (sData.isMonster) {
                            s.isMonster = true;
                            s.monsterType = sData.monsterType;
                            if (sData.isGiant) s.isGiant = true;
                        }
                        if (sData.isHero) {
                            s.isHero = true;
                            s.heroSpec = uData;
                        }
                        this.soldiers.push(s);
                    }
                });
            }

            this.projectiles = [];
            this.resetPools();
            this.activeUltimates = [];
            this.spawnQueue = [];

            if (this.ai) {
                this.ai.setDifficulty(this.difficulty);
                this.ai.setPersonality(this.aiPersonality);
            }

            // Atstatome kasyklose buvusius darbininkus tiesiogiai į playerWorkers
            this.playerWorkers = [];
            if (Array.isArray(d.playerWorkers) && d.playerWorkers.length > 0) {
                d.playerWorkers.forEach(wData => {
                    if (wData && wData.role) {
                        const w = new RTSWorker(true, wData.role, wData.x, wData.gatherAmount || this.gatherAmount, this.playerEra);
                        w.state = wData.state || 'WALKING_TO_NODE';
                        w.carryingAmount = wData.carryingAmount || 0;
                        this.playerWorkers.push(w);
                    }
                });
            }

            if (d.autoMilitaryConfig) {
                this.autoMilitaryConfig = { ...this.autoMilitaryConfig, ...d.autoMilitaryConfig };
            }

            // Griežtas populiacijos suderinimas be jokio netikro pertekliaus:
            const curLiving = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
            const curWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
            const maxIdle = Math.max(0, this.playerResources.maxPop - (curLiving + curWorkers));
            this.playerResources.idlePop = Math.min(maxIdle, Math.max(0, this.playerResources.idlePop || 0));

            if (this.sound) {
                this.sound.setEra(this.playerEra);
            }

            this.updateTopBarBadges();
            this.updateUI();
            return true;
        } catch (e) {
            console.error('Klaida įkeliant išsaugotą mūšį:', e);
            return false;
        }
    }

    resumeBattle() {
        if (!this.battleFinished && this.state !== 'VICTORY' && this.state !== 'DEFEAT' && this.gameTime > 1 && this.playerBase && this.playerBase.hp > 0 && this.soldiers) {
            // Gyvas mūšis jau atmintyje
        } else {
            const loaded = !this.battleFinished && this.loadGameState();
            if (!loaded) {
                this.startNewGame();
                return;
            }
        }

        // Paslėpti visus galimus atvirus modalus ir persidengimus
        const allModalsToHide = [
            'rtsStartModal',
            'rtsPauseOverlay',
            'rtsGameOverModal',
            'modalAutomationHub',
            'rtsBaseHubModal',
            'rtsSettingsModal',
            'rtsHelpModal',
            'rtsAchievementsModal',
            'rtsChallengesModal',
            'quickTradeModal',
            'rtsEvolutionModal'
        ];
        allModalsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        document.querySelectorAll('.modal-overlay, .pause-overlay').forEach(m => m.classList.add('hidden'));

        const gameCont = document.getElementById('rtsGameContainer');
        if (gameCont) gameCont.classList.remove('game-paused');

        this.battleFinished = false;
        this.state = 'PLAYING';
        this.isPaused = false;
        this.isModalPaused = false;
        this.lastFrameTime = performance.now();

        if (this.sound) {
            this.sound.isAudioPaused = false;
            this.sound.resume();
            if (this.sound.resumeAudio) this.sound.resumeAudio();
            if (this.sound.masterGain && this.sound.ctx && !this.sound.muted) {
                try {
                    this.sound.masterGain.gain.cancelScheduledValues(this.sound.ctx.currentTime);
                    this.sound.masterGain.gain.setValueAtTime(1.0, this.sound.ctx.currentTime);
                } catch(e) {}
            }
            this.sound.startMusic(this.playerEra);
        }

        if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';
        if (this.ui && this.ui.pauseOverlay) this.ui.pauseOverlay.classList.add('hidden');

        this.updateSpawnQueueUI();
        if (window.renderActiveDeckPanel) window.renderActiveDeckPanel();

        const contMsg = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en') ? '⚔️ BATTLE RESUMED!' : '⚔️ MŪŠIS TĘSIAMAS!';
        this.floatingTexts.push({
            text: contMsg,
            x: RTS_DATA.WORLD_WIDTH * 0.5,
            y: RTS_DATA.GROUND_Y - 180,
            color: '#38bdf8',
            life: 2.0,
            maxLife: 2.0
        });

        this.updateUI();
    }

    updateResumeButtonUI() {
        const resumeGameBtn = document.getElementById('rtsResumeGameBtn');
        if (!resumeGameBtn) return;
        const hasLiveBattle = !this.battleFinished && this.state !== 'VICTORY' && this.state !== 'DEFEAT' && this.gameTime > 1 && this.playerBase && this.playerBase.hp > 0;
        const hasBattle = hasLiveBattle || (!this.battleFinished && this.hasSavedGame());
        resumeGameBtn.classList.toggle('hidden', !hasBattle);
        if (hasBattle) {
            const sub = resumeGameBtn.querySelector('.nav-sub-text');
            if (sub) {
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                const info = (this.gameTime > 1 && this.playerBase) ? {
                    eraName: (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getAgeName(this.playerEra) : (RTS_DATA.AGES[this.playerEra] ? RTS_DATA.AGES[this.playerEra].name : 'Epocha'),
                    timeStr: `${Math.floor(this.gameTime / 60)}:${Math.floor(this.gameTime % 60) < 10 ? '0' : ''}${Math.floor(this.gameTime % 60)}`
                } : this.getSavedGameInfo();
                if (info) {
                    sub.textContent = `${info.eraName} • ${isEn ? 'Duration' : 'Trukmė'}: ${info.timeStr}`;
                }
            }
        }
    }

    updateTopBarBadges() {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const modeNames = isEn ? {
            standard: '⚔️ Classic',
            endless: '🌊 Endless',
            monsters: '👾 Monster Invasion',
            sandbox: '🛠️ Sandbox',
            challenge: '🎯 Challenge'
        } : {
            standard: '⚔️ Klasikinis',
            endless: '🌊 Begalinis',
            monsters: '👾 Monstrų invazija',
            sandbox: '🛠️ Smėliadėžė',
            challenge: '🎯 Iššūkis'
        };
        const diffLabels = isEn ? {
            easy: { text: '🟢 Easy', color: '#10b981' },
            normal: { text: '🟡 Normal', color: '#f59e0b' },
            hard: { text: '🔴 Hard', color: '#ef4444' },
            nightmare: { text: '💀 Nightmare', color: '#8b5cf6' },
            unlimited: { text: '♾️ Endless', color: '#c084fc' }
        } : {
            easy: { text: '🟢 Lengvas', color: '#10b981' },
            normal: { text: '🟡 Normalus', color: '#f59e0b' },
            hard: { text: '🔴 Sunkus', color: '#ef4444' },
            nightmare: { text: '💀 Košmaras', color: '#8b5cf6' },
            unlimited: { text: '♾️ Begalinis', color: '#c084fc' }
        };
        const mBadge = document.getElementById('modeBadgeBtn');
        if (mBadge) {
            mBadge.innerText = modeNames[this.gameMode] || (isEn ? '⚔️ Classic' : '⚔️ Klasikinis');
        }
        const dBadge = document.getElementById('diffBadgeBtn');
        if (dBadge) {
            const dl = diffLabels[this.difficulty] || diffLabels.normal;
            dBadge.innerText = dl.text;
            dBadge.style.color = dl.color;
            dBadge.style.borderColor = `${dl.color}88`;
        }
    }

    applySettings() {
        if (this.sound) {
            this.sound.setSfxVolume(this.settings.sfxVolume !== undefined ? this.settings.sfxVolume : 0.15);
            this.sound.setMusicVolume(this.settings.musicVolume !== undefined ? this.settings.musicVolume : 0.15);
        }
        this.gameSpeed = this.settings.gameSpeed || 1;
        this.applyGlowClass();
        this.updateGraphicsUI();
    }

    applyGlowClass() {
        const hasGlow = (this.settings && this.settings.uiGlow !== false);
        const container = document.getElementById('rtsGameContainer');
        if (container) {
            if (hasGlow) container.classList.remove('no-ui-glow');
            else container.classList.add('no-ui-glow');
        }
        if (document.body) {
            if (hasGlow) document.body.classList.remove('no-ui-glow');
            else document.body.classList.add('no-ui-glow');
        }
    }

    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'lt') return;
        this.settings.language = lang;
        if (window.RTS_I18N) {
            window.RTS_I18N.setLanguage(lang);
        }
        this.saveData();
        this.updateGraphicsUI();
        if (window.renderDeckAchievements) window.renderDeckAchievements();
        if (window.updateDeckUI) window.updateDeckUI();
        if (this.updateUI) this.updateUI();
        if (typeof window !== 'undefined' && window.updateMenuTrophies) window.updateMenuTrophies();
    }

    setGraphicsQuality(quality) {
        this.settings.graphicsQuality = (quality === 'low' || quality === 'medium' || quality === 'high') ? quality : 'custom';
        if (quality === 'high') {
            this.settings.windEffects = true;
            this.settings.uiGlow = true;
            this.settings.baseFloatingTexts = true;
            this.settings.showFloatingTexts = true;
            this.settings.castleEvoBeam = true;
            this.settings.bgClouds = true;
            this.settings.combatParticles = true;
        } else if (quality === 'medium') {
            this.settings.windEffects = true;
            this.settings.uiGlow = true;
            this.settings.baseFloatingTexts = false;
            this.settings.showFloatingTexts = false;
            this.settings.castleEvoBeam = true;
            this.settings.bgClouds = true;
            this.settings.combatParticles = true;
            if (this.floatingTextPool) {
                for (let i = 0; i < this.maxFloatingTexts; i++) {
                    this.floatingTextPool[i].active = false;
                }
            }
        } else if (quality === 'low') {
            this.settings.windEffects = false;
            this.settings.uiGlow = false;
            this.settings.baseFloatingTexts = false;
            this.settings.showFloatingTexts = false;
            this.settings.castleEvoBeam = false;
            this.settings.bgClouds = false;
            this.settings.combatParticles = false;
            if (this.floatingTextPool) {
                for (let i = 0; i < this.maxFloatingTexts; i++) {
                    this.floatingTextPool[i].active = false;
                }
            }
        }
        this.settings.popSpawnWheel = true;
        this.saveData();
        this.applyGlowClass();
        this.updateGraphicsUI();
    }

    setGraphicsOption(key, value) {
        this.settings[key] = !!value;
        if (key === 'baseFloatingTexts' || key === 'showFloatingTexts') {
            this.settings.baseFloatingTexts = !!value;
            this.settings.showFloatingTexts = !!value;
            if (!value && this.floatingTextPool) {
                for (let i = 0; i < this.maxFloatingTexts; i++) {
                    this.floatingTextPool[i].active = false;
                }
            }
        }
        const s = this.settings;
        const isHigh = s.windEffects && s.uiGlow && s.baseFloatingTexts && s.castleEvoBeam && s.bgClouds && s.combatParticles;
        const isMed = s.windEffects && s.uiGlow && !s.baseFloatingTexts && s.castleEvoBeam && s.bgClouds && s.combatParticles;
        const isLow = !s.windEffects && !s.uiGlow && !s.baseFloatingTexts && !s.castleEvoBeam && !s.bgClouds && !s.combatParticles;
        this.settings.graphicsQuality = isHigh ? 'high' : (isMed ? 'medium' : (isLow ? 'low' : 'custom'));
        this.settings.popSpawnWheel = true;
        this.saveData();
        this.applyGlowClass();
        this.updateGraphicsUI();
    }

    toggleGraphicsQuality() {
        const order = ['low', 'medium', 'high'];
        const curIdx = order.indexOf(this.settings.graphicsQuality || 'medium');
        const next = order[(curIdx + 1) % order.length];
        this.setGraphicsQuality(next);
    }

    switchSettingsTab(tabName, isModal = false) {
        const prefix = isModal ? 'modal' : 'deck';
        const tabAudio = document.getElementById(`${prefix}TabBtnAudio`);
        const tabGfx = document.getElementById(`${prefix}TabBtnGraphics`);
        const paneAudio = document.getElementById(`${prefix}PaneAudio`);
        const paneGfx = document.getElementById(`${prefix}PaneGraphics`);

        if (tabName === 'audio') {
            if (tabAudio) tabAudio.classList.add('active');
            if (tabGfx) tabGfx.classList.remove('active');
            if (paneAudio) paneAudio.classList.remove('hidden');
            if (paneGfx) paneGfx.classList.add('hidden');
        } else {
            if (tabAudio) tabAudio.classList.remove('active');
            if (tabGfx) tabGfx.classList.add('active');
            if (paneAudio) paneAudio.classList.add('hidden');
            if (paneGfx) paneGfx.classList.remove('hidden');
        }
    }

    updateGraphicsUI() {
        if (!this.settings) return;
        const q = this.settings.graphicsQuality || 'medium';
        const isLt = (this.settings.language === 'lt' || (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt'));
        let qLabel = '';
        if (q === 'low') qLabel = isLt ? '⚡ Žema (FPS)' : '⚡ Low (FPS)';
        else if (q === 'medium') qLabel = isLt ? '⚖️ Vidutinė' : '⚖️ Medium';
        else if (q === 'high') qLabel = isLt ? '💎 Aukšta' : '💎 High';
        else qLabel = isLt ? '🛠️ Pasirinktinis' : '🛠️ Custom';

        const sLabel = document.getElementById('settingsGfxLabel');
        if (sLabel) sLabel.textContent = qLabel;
        const dLabel = document.getElementById('deckGfxLabel');
        if (dLabel) dLabel.textContent = qLabel;

        ['settingsGfx', 'deckGfx'].forEach(prefix => {
            const btnHigh = document.getElementById(`${prefix}HighBtn`);
            const btnMed = document.getElementById(`${prefix}MedBtn`);
            const btnLow = document.getElementById(`${prefix}LowBtn`);
            if (btnHigh) btnHigh.className = 'rts-btn' + (q === 'high' ? ' active' : '');
            if (btnMed) btnMed.className = 'rts-btn' + (q === 'medium' ? ' active' : '');
            if (btnLow) btnLow.className = 'rts-btn' + (q === 'low' ? ' active' : '');
        });

        // Sinchronizuojame visus išsamius jungiklius abiejuose pultuose (Modal & Deck)
        const opts = [
            { key: 'windEffects', ids: ['deckOptWind', 'modalOptWind'] },
            { key: 'uiGlow', ids: ['deckOptGlow', 'modalOptGlow'] },
            { key: 'baseFloatingTexts', ids: ['deckOptTexts', 'modalOptTexts', 'settingsResourceTextsCheck', 'deckResourceTextsCheck'] },
            { key: 'castleEvoBeam', ids: ['deckOptCastleEvo', 'modalOptCastleEvo'] },
            { key: 'bgClouds', ids: ['deckOptClouds', 'modalOptClouds'] },
            { key: 'combatParticles', ids: ['deckOptCombat', 'modalOptCombat'] }
        ];

        opts.forEach(opt => {
            const val = (this.settings[opt.key] !== false);
            opt.ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.checked = val;
            });
        });
    }

    unlockAchievement(id) {
        if (this.unlockedAchievements[id]) return;
        const ach = RTS_DATA.ACHIEVEMENTS.find(a => a.id === id);
        if (!ach) return;

        this.unlockedAchievements[id] = { date: new Date().toLocaleDateString('lt-LT') };
        this.saveData();
        if (typeof window !== 'undefined' && window.updateMenuTrophies) window.updateMenuTrophies();

        if (this.sound) this.sound.playAchievement();
        this.showAchievementToast(ach);
    }

    showAchievementToast(ach) {
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const aTitle = (isEn && RTS_I18N.getAchievementTitle(ach.id)) ? RTS_I18N.getAchievementTitle(ach.id) : ach.title;
        const aDesc = (isEn && RTS_I18N.getAchievementDesc(ach.id)) ? RTS_I18N.getAchievementDesc(ach.id) : ach.desc;
        const toastHeader = isEn ? '🏆 Achievement Unlocked!' : '🏆 Pasiekimas Atrakintas!';
        toast.innerHTML = `
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-info">
                <div class="ach-title">${toastHeader}</div>
                <div class="ach-desc">${aTitle}: ${aDesc}</div>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    startNewGame(difficulty = 'easy', mode = 'standard', challengeId = null, personality = 'aggressive') {
        this.difficulty = difficulty;
        this.gameMode = mode;
        this.aiPersonality = personality;
        this.isUnlimitedMode = (difficulty === 'unlimited' || mode === 'sandbox');
        this.state = 'PLAYING';
        this.isPaused = false;
        this.battleFinished = false;
        if (window.AdManager && window.AdManager.gameplayStart) window.AdManager.gameplayStart();
        this.gameTime = 0;
        this.popTimer = 0;
        this.enemyPopTimer = 0;
        this.gatherAmount = RTS_DATA.BASE_GATHER_AMOUNT;
        this.spawnQueue = [];
        this.delayedSpawns = [];
        this.playerUltimateCasts = 0;
        this.enemyUltimateCasts = 0;
        this.activePerks = [];
        this.chosenBranches = {};
        this.playerBranch = null;

        this.clearSavedGame();
        this.updateResumeButtonUI();
        this.updateTopBarBadges();

        // 4 Pagrindinės tobulinimų kryptys (po 5 lygius)
        this.playerUpgrades = { base_wall: 0, workers_ai: 0, military_academy: 0, trade_economy: 0 };
        this.enemyUpgrades = { base_wall: 0, workers_ai: 0, military_academy: 0, trade_economy: 0 };
        this.playerWall = { active: false, x: RTS_DATA.PLAYER_BASE_X + 255, width: 26, height: 160, hp: 450, maxHp: 450, rebuildTimer: 0, maxRebuildTimer: 20 };
        this.enemyWall = { active: false, x: RTS_DATA.ENEMY_BASE_X - 50, width: 26, height: 160, hp: 450, maxHp: 450, rebuildTimer: 0, maxRebuildTimer: 20 };
        this.passiveIncomeTimer = 0;
        this.smartWorkerTimer = 0;
        this.autoMilitaryTimer = 0;
        this.autoTradeTimer = 0;

        // Išmaniosios MAX Automatizacijos konfigūracijos (Valdymo langams)
        this.autoGatherConfig = {
            enabled: true,
            woodLimit: 1,
            stoneLimit: 1,
            foodLimit: 1,
            centerGold: true,
            minReservedPop: 2
        };
        this.autoMilitaryConfig = {
            enabled: false,
            mode: 'balanced', // 'balanced', 'melee', 'ranged', 'heavy'
            minReserveGold: 200,
            autoHero: true,
            maxSoldiers: 12
        };
        this.autoTradeConfig = {
            enabled: false,
            woodThreshold: 250,
            stoneThreshold: 250,
            foodThreshold: 150
        };

        this.stats = {
            kills: 0,
            losses: 0,
            damageDealt: 0,
            damageTaken: 0,
            resourcesGathered: 0,
            goldEarned: 0,
            ultimatesCast: 0,
            wavesCleared: 0,
            unitsKilledByType: {},
            playerUnitsSpawned: {}
        };

        this.currentChallenge = null;
        if (mode === 'challenge' && challengeId) {
            this.currentChallenge = RTS_DATA.CHALLENGES.find(c => c.id === challengeId) || RTS_DATA.CHALLENGES[0];
        }

        this.playerEra = (this.currentChallenge && this.currentChallenge.initialEra !== undefined) ? this.currentChallenge.initialEra : 0;
        this.playerXp = 0;

        if (mode === 'sandbox') {
            this.playerGold = 999999;
            this.playerResources = { wood: 99999, stone: 99999, food: 99999, idlePop: 25, maxPop: 60 };
            this.playerXp = 99999;
            this.gatherAmount = 50;
        } else if (this.currentChallenge) {
            this.playerGold = this.currentChallenge.playerGold !== undefined ? this.currentChallenge.playerGold : 200;
            this.playerResources = this.currentChallenge.playerResources ? { ...this.currentChallenge.playerResources } : { ...RTS_DATA.STARTING_RESOURCES };
        } else if (difficulty === 'unlimited') {
            this.playerGold = 500;
            this.playerResources = { wood: 100, stone: 80, food: 100, idlePop: 8, maxPop: 16 };
        } else if (difficulty === 'easy') {
            this.playerGold = 250;
            this.playerResources = { wood: 70, stone: 40, food: 70, idlePop: 5, maxPop: 10 };
        } else if (difficulty === 'hard') {
            this.playerGold = 130;
            this.playerResources = { wood: 40, stone: 25, food: 40, idlePop: 3, maxPop: 8 };
        } else {
            this.playerGold = 175;
            this.playerResources = { ...RTS_DATA.STARTING_RESOURCES };
        }

        const baseHp = this.isUnlimitedMode ? 9999999 : (RTS_DATA.BASE_STATS[this.playerEra] ? RTS_DATA.BASE_STATS[this.playerEra].maxHp : 600);
        this.playerBase = { hp: baseHp, maxHp: baseHp, shieldTimer: 0 };
        this.playerWorkers = [];
        this.playerTurrets = [null, null, null, null];
        this.playerUnlockedSlots = (this.currentChallenge && this.currentChallenge.freeTurretSlots) ? this.currentChallenge.freeTurretSlots : 1;
        this.playerUltimateCooldown = 0;

        this.hasUsedReviveAd = false;
        this.hasShownVictoryAd = false;

        // Apply bonus starting gold if player claimed Main Menu ad gift
        const bonusGold = parseInt(localStorage.getItem('aow_ad_bonus_gold') || '0', 10);
        if (bonusGold > 0) {
            this.playerGold += bonusGold;
            localStorage.removeItem('aow_ad_bonus_gold');
            setTimeout(() => {
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                if (this.floatingTexts) {
                    this.floatingTexts.push({
                        text: isEn ? `🎁 Bonus +${bonusGold} 💰 Applied!` : `🎁 Premija +${bonusGold} 💰 Pritaikyta!`,
                        x: RTS_DATA.PLAYER_BASE_X + 60,
                        y: RTS_DATA.GROUND_Y - 140,
                        color: '#f59e0b',
                        life: 2.5,
                        maxLife: 2.5
                    });
                }
            }, 500);
        }

        this.enemyEra = this.playerEra;
        this.enemyGold = (this.currentChallenge && this.currentChallenge.enemyGold !== undefined) ? this.currentChallenge.enemyGold : (this.isUnlimitedMode ? 500 : RTS_DATA.STARTING_GOLD);
        this.enemyXp = 0;
        this.enemyResources = { ...RTS_DATA.STARTING_RESOURCES };
        const enemyBaseHp = (mode === 'endless' || mode === 'monsters') ? 9999999 : baseHp;
        this.enemyBase = { hp: enemyBaseHp, maxHp: enemyBaseHp };
        this.enemyWorkers = [];
        this.enemyTurrets = [null, null, null, null];
        this.enemyUnlockedSlots = 1;
        this.enemyUltimateCooldown = 0;

        this.survivalWave = 1;
        this.survivalWaveTimer = 10.0;
        this.survivalWaveActive = false;

        this.monsterWave = 1;
        this.monsterWaveTimer = 6.0;
        this.monsterWaveActive = false;

        this.soldiers = [];
        this.projectiles = [];
        this.resetPools();
        this.activeUltimates = [];

        this.ai.setDifficulty(difficulty || 'normal');
        this.ai.setPersonality(personality);

        this.tacticalStance = 'attack'; // 'attack', 'defend', 'retreat'
        this.autoTrainIndex = -1; // -1 = išjungta, 0/1/2 = vieneto indeksas
        this.currentWeather = 'clear'; // 'clear', 'rain', 'night', 'ash'
        this.targetWeather = 'clear';
        this.weatherWeights = { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 };
        this.weatherTimer = 45.0;

        this.renderer.setCamera(0);

        this.state = 'PLAYING';
        this.isPaused = false;
        this.isModalPaused = false;
        this.isDragging = false;

        const gameCont = document.getElementById('rtsGameContainer');
        if (gameCont) gameCont.classList.remove('game-paused');

        // Paslėpti visus galimus atvirus modalus ir persidengimus
        const allModalsToHide = [
            'rtsStartModal',
            'rtsPauseOverlay',
            'rtsGameOverModal',
            'modalAutomationHub',
            'rtsBaseHubModal',
            'rtsSettingsModal',
            'rtsHelpModal',
            'rtsAchievementsModal',
            'rtsChallengesModal',
            'quickTradeModal',
            'rtsEvolutionModal',
            'rtsGoldAdModal'
        ];
        allModalsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (this.sound) {
            this.sound.isAudioPaused = false;
            this.sound.resume();
            if (this.sound.resumeAudio) this.sound.resumeAudio();
            if (this.sound.masterGain && this.sound.ctx && !this.sound.muted) {
                try {
                    this.sound.masterGain.gain.cancelScheduledValues(this.sound.ctx.currentTime);
                    this.sound.masterGain.gain.setValueAtTime(1.0, this.sound.ctx.currentTime);
                } catch(e) {}
            }
            this.sound.startMusic(this.playerEra);
        }

        if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';
        if (this.ui && this.ui.pauseOverlay) this.ui.pauseOverlay.classList.add('hidden');

        this.updateSpawnQueueUI();
        this.updateUI();
    }

    panCameraToBase() {
        if (this.renderer && this.renderer.panCameraTo) {
            this.renderer.panCameraTo(0);
        } else if (this.renderer && this.renderer.setCamera) {
            this.renderer.setCamera(0);
        }
    }

    setTacticalStance(stance) {
        if (!['attack', 'defend', 'retreat'].includes(stance)) return;
        this.tacticalStance = stance;
        const sInfo = RTS_DATA.TACTICAL_STANCES[stance];
        const sName = (window.RTS_I18N) ? window.RTS_I18N.getStanceName(stance) : sInfo.name;
        const tacticLabel = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en') ? 'Tactics' : 'Taktika';
        this.floatingTexts.push({
            text: `${sInfo.icon} ${tacticLabel}: ${sName}!`,
            x: RTS_DATA.PLAYER_BASE_X + 120,
            y: RTS_DATA.GROUND_Y - 110,
            color: stance === 'defend' ? '#38bdf8' : (stance === 'retreat' ? '#f59e0b' : '#ef4444'),
            life: 1.6,
            maxLife: 1.6
        });
        if (this.sound && this.sound.playHorn) this.sound.playHorn(stance); else if (this.sound) this.sound.playClick();
        this.updateUI();
    }

    toggleAutoTrain(idx) {
        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        if (this.autoTrainIndex === idx) {
            this.autoTrainIndex = -1;
            this.floatingTexts.push({
                text: isLt ? `⚡ Auto-Samdymas IŠJUNGTAS` : `⚡ Auto-Train OFF`,
                x: RTS_DATA.PLAYER_BASE_X + 120,
                y: RTS_DATA.GROUND_Y - 95,
                color: '#94a3b8',
                life: 1.4,
                maxLife: 1.4
            });
        } else {
            this.autoTrainIndex = idx;
            const heroText = isLt ? '👑 Didvyrį' : '👑 Hero';
            const soldierText = isLt ? 'Karį' : 'Soldier';
            const uObj = (idx !== 99 && RTS_DATA.AGES[this.playerEra].units[idx]) ? RTS_DATA.AGES[this.playerEra].units[idx] : null;
            const uName = idx === 99 ? heroText : (uObj ? (window.RTS_I18N ? window.RTS_I18N.getUnitName(uObj.id) : uObj.name) : soldierText);
            this.floatingTexts.push({
                text: isLt ? `⚡ Auto-Samdymas ĮJUNGTAS: ${uName}!` : `⚡ Auto-Train ON: ${uName}!`,
                x: RTS_DATA.PLAYER_BASE_X + 120,
                y: RTS_DATA.GROUND_Y - 95,
                color: '#00f2fe',
                life: 1.6,
                maxLife: 1.6
            });
        }
        if (this.sound) this.sound.playClick();
        this.updateUI();
    }

    pauseGame(isModal = false) {
        if (this.state !== 'PLAYING') return;
        this.isPaused = true;
        this.state = 'PAUSED';
        if (window.AdManager && window.AdManager.gameplayStop) window.AdManager.gameplayStop();
        this.hoveredEvoBranch = null;
        if (this.canvas) this.canvas.style.cursor = 'default';
        if (isModal) this.isModalPaused = true;
        this.saveGameState();

        if (this.sound) {
            this.sound.playPause();
            if (this.sound.pauseAudio) this.sound.pauseAudio();
        }
        if (this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.resume') : '▶️ Tęsti';
        const gameCont = document.getElementById('rtsGameContainer');
        if (gameCont) gameCont.classList.add('game-paused');
        if (!isModal && this.ui.pauseOverlay) {
            this.ui.pauseOverlay.classList.remove('hidden');
        }
    }

    resumeGame(isModal = false) {
        if (this.state !== 'PAUSED') return;
        this.isPaused = false;
        this.isModalPaused = false;
        this.state = 'PLAYING';
        if (window.AdManager && window.AdManager.gameplayStart) window.AdManager.gameplayStart();

        if (this.sound) {
            this.sound.isAudioPaused = false;
            this.sound.resume();
            if (this.sound.resumeAudio) this.sound.resumeAudio();
            this.sound.playResume();
            if (this.sound.musicPlaying || this.sound.wasMusicPlaying) {
                this.sound.startMusic(this.playerEra);
            }
        }
        if (this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';
        const gameCont = document.getElementById('rtsGameContainer');
        if (gameCont) gameCont.classList.remove('game-paused');
        if (this.ui.pauseOverlay) {
            this.ui.pauseOverlay.classList.add('hidden');
        }
        this.lastFrameTime = performance.now();
    }

    togglePause() {
        if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
        if (this.isPaused) {
            this.resumeGame(false);
        } else {
            this.pauseGame(false);
        }
    }

    loop(currentTime) {
        try {
            if (!this.lastFrameTime) this.lastFrameTime = currentTime || performance.now();
            const rawDt = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;
            const validDt = (typeof rawDt === 'number' && Number.isFinite(rawDt) && rawDt > 0) ? rawDt : 0.016;
            const dt = Math.min(0.05, Math.max(0.001, validDt)) * (this.gameSpeed || 1);

            if (this.state === 'PLAYING') {
                this.update(dt);
            } else if (this.state === 'VICTORY' || this.state === 'DEFEAT') {
                this.updateEndGameState(dt);
            }

            const isPaused = (this.state === 'PAUSED' || this.isPaused);
            const renderDt = isPaused ? 0 : dt;

            if (this.sound && this.renderer) {
                this.sound.setCameraX(this.renderer.cameraX);
            }

            this.renderer.render(this, renderDt);
        } catch (e) {
            console.error('Game loop exception caught safely:', e);
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.gameTime += dt;

        // Atnaujiname bazės apsauginio skydo laikmatį (jei aktyvuotas po atgimimo)
        if (this.playerBase && this.playerBase.shieldTimer > 0) {
            this.playerBase.shieldTimer = Math.max(0, this.playerBase.shieldTimer - dt);
        }

        // Vėluojančių / taktinio būrio karių šaukimo apdorojimas (reaguoja į pauzę ir greitį)
        if (this.delayedSpawns && this.delayedSpawns.length > 0) {
            this.delayedSpawns = this.delayedSpawns.filter(ds => {
                ds.timer -= dt;
                if (ds.timer <= 0) {
                    if (this.state === 'PLAYING') {
                        const s = new RTSSoldier(ds.isPlayer, ds.unitData, ds.era, ds.x);
                        this.soldiers.push(s);
                    }
                    return false;
                }
                return true;
            });
        }

        // Garso ir muzikos sargybinis (Audio Watchdog): užtikrina, kad mūšio metu garsas ir muzika niekada nepradingtų
        this.musicWatchdogTimer = (this.musicWatchdogTimer || 0) + dt;
        if (this.musicWatchdogTimer >= 1.5) {
            this.musicWatchdogTimer = 0;
            if (this.sound && !this.sound.muted && !this.isPaused && this.state === 'PLAYING') {
                this.sound.isAudioPaused = false;
                if (this.sound.masterGain && this.sound.ctx && this.sound.masterGain.gain.value < 0.5) {
                    try {
                        this.sound.masterGain.gain.cancelScheduledValues(this.sound.ctx.currentTime);
                        this.sound.masterGain.gain.setValueAtTime(1.0, this.sound.ctx.currentTime);
                    } catch(e) {}
                }
                if (!this.sound.musicPlaying || !this.sound.musicTimer) {
                    this.sound.startMusic(this.playerEra);
                }
            }
        }

        // --------------------------------------------------------------------
        // NATŪRALI IR ESTETIŠKA BAZĖS GRIŪTIES SEKA PRIEŠ GAME OVER LANGĄ
        // --------------------------------------------------------------------
        if (this.baseCollapsePending) {
            this.baseCollapsePending.timer += dt;
            const targetX = this.baseCollapsePending.isPlayer ? (RTS_DATA.PLAYER_BASE_X + 65) : (RTS_DATA.ENEMY_BASE_X + 65);
            const era = this.baseCollapsePending.isPlayer ? this.playerEra : this.enemyEra;
            
            // Subtilios dulkių ir byrančių akmenų/statybinių medžiagų dalelės
            if (Math.random() < 0.4) {
                this.particles.push({
                    x: targetX + (Math.random() - 0.5) * 80,
                    y: RTS_DATA.GROUND_Y - 10 - Math.random() * 40,
                    vx: (Math.random() - 0.5) * 45,
                    vy: -20 - Math.random() * 35,
                    size: 8 + Math.random() * 12,
                    color: 'rgba(148, 163, 184, 0.45)', // Minkštas dulkių debesis
                    life: 1.2,
                    maxLife: 1.2
                });
            }

            // Keletas krentančių nuolaužų
            if (Math.random() < 0.3) {
                const eraColors = era === 4 
                    ? ['#00f2fe', '#38bdf8', '#334155']
                    : (era === 3 
                        ? ['#475569', '#334155', '#64748b']
                        : ['#78350f', '#475569', '#334155']);

                this.particles.push({
                    x: targetX + (Math.random() - 0.5) * 70,
                    y: RTS_DATA.GROUND_Y - 30 - Math.random() * 50,
                    vx: (Math.random() - 0.5) * 60,
                    vy: -30 - Math.random() * 40,
                    size: 4 + Math.random() * 5,
                    color: eraColors[Math.floor(Math.random() * eraColors.length)],
                    life: 1.0,
                    maxLife: 1.0,
                    gravity: 360,
                    bounce: true
                });
            }

            if (this.baseCollapsePending.timer >= this.baseCollapsePending.duration) {
                const isVic = !this.baseCollapsePending.isPlayer;
                const msg = this.baseCollapsePending.message;
                this.baseCollapsePending = null;
                this.endGame(isVic, msg);
                return;
            }
        }




        // 1. Populiacijos ciklas ir pasyvus tyrimų XP prieaugis (REIKALAUJA 15 MAISTO)
        this.playerXp += dt * 4;
        const foodCostPerCitizen = RTS_DATA.FOOD_PER_CITIZEN || 15;
        const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
        const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
        const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
        const employed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;

        // Griežta populiacijos lubų kontrolė (bendrai kariai + darbininkai + laisvi NIEKADA neviršija maxPop):
        const maxAllowedIdlePlayer = Math.max(0, this.playerResources.maxPop - employed);
        if ((this.playerResources.idlePop || 0) > maxAllowedIdlePlayer) {
            this.playerResources.idlePop = maxAllowedIdlePlayer;
        }
        const totalPlayerPop = (this.playerResources.idlePop || 0) + employed;

        if (totalPlayerPop < this.playerResources.maxPop) {
            if (this.gameMode === 'sandbox' || this.playerResources.food >= foodCostPerCitizen) {
                this.popTimer += dt;
                if (this.popTimer >= this.popSpawnInterval) {
                    this.popTimer = 0;
                    if (this.gameMode !== 'sandbox') {
                        this.playerResources.food -= foodCostPerCitizen;
                    }
                    this.playerResources.idlePop = Math.min(maxAllowedIdlePlayer, (this.playerResources.idlePop || 0) + 1);
                    const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                    this.floatingTexts.push({
                        text: isEn ? `+1 👥 Citizen (-${foodCostPerCitizen}🌾)!` : `+1 👥 Gyventojas (-${foodCostPerCitizen}🌾)!`,
                        x: RTS_DATA.PLAYER_BASE_X + 40,
                        y: RTS_DATA.GROUND_Y - 90,
                        color: '#38bdf8',
                        life: 1.4,
                        maxLife: 1.4
                    });
                    if (this.sound && this.sound.playSpawnUnit) this.sound.playSpawnUnit(this.playerEra, 'worker', false);
                    else if (this.sound) this.sound.playRecruit();
                }
            } else if (totalPlayerPop === 0 && this.state === 'PLAYING') {
                // Apsauga nuo aklavietės: Jei visi mirė ir maisto 0, kas 2 sekundes atsiranda 1 nemokamas išgyventojas
                this.popTimer += dt;
                if (this.popTimer >= 2.0) {
                    this.popTimer = 0;
                    this.playerResources.idlePop = 1;
                    const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                    this.floatingTexts.push({
                        text: isEn ? `🆘 Survivor returned to base (+1 👥)!` : `🆘 Išgyventojas sugrįžo į bazę (+1 👥)!`,
                        x: RTS_DATA.PLAYER_BASE_X + 60,
                        y: RTS_DATA.GROUND_Y - 100,
                        color: '#22c55e',
                        life: 2.0,
                        maxLife: 2.0
                    });
                    if (this.sound && this.sound.playRecruit) this.sound.playRecruit();
                }
            } else {
                this.popTimer = 0; // Negimsta be maisto!
            }
        } else {
            // Kai populiacija PILNA (60/60) – ratuko laikmatis visada nustatomas į 0!
            // Todėl mirus kariui ratukas suksis visą pilną laiką (3-4s), o ne atsiras per milisekundę!
            this.popTimer = 0;
        }

        const livingEnemySoldiers = this.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
        const activeEnemyWorkers = this.enemyWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
        const totalEnemyPop = (this.enemyResources.idlePop || 0) + activeEnemyWorkers + livingEnemySoldiers;

        const maxAllowedIdleEnemy = Math.max(0, this.enemyResources.maxPop - (activeEnemyWorkers + livingEnemySoldiers));
        if (this.enemyResources.idlePop > maxAllowedIdleEnemy) {
            this.enemyResources.idlePop = maxAllowedIdleEnemy;
        }

        if (totalEnemyPop < this.enemyResources.maxPop) {
            const hasFood = (this.gameMode === 'sandbox' || this.isUnlimitedMode || this.difficulty === 'unlimited' || this.enemyResources.food >= foodCostPerCitizen);
            if (hasFood) {
                this.enemyPopTimer += dt;
                if (this.enemyPopTimer >= this.popSpawnInterval) {
                    this.enemyPopTimer = 0;
                    if (this.gameMode !== 'sandbox' && !this.isUnlimitedMode && this.difficulty !== 'unlimited') {
                        this.enemyResources.food -= foodCostPerCitizen;
                    }
                    this.enemyResources.idlePop++;
                }
            }
        } else {
            this.enemyPopTimer = 0;
        }

        // Auto-Train procesorius
        if (this.autoTrainIndex >= 0 && this.spawnQueue.length < 2) {
            if ((this.playerResources.idlePop || 0) > 0 || this.gameMode === 'sandbox') {
                if (this.autoTrainIndex === 99) {
                    this.summonHero();
                } else {
                    this.trainSoldier(this.autoTrainIndex);
                }
            }
        }

        // Švelni ir lėta orų / klimato kaita (Slow, cinematic crossfade)
        if (!this.weatherWeights) this.weatherWeights = { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 };
        if (!this.targetWeather) this.targetWeather = 'clear';
        if (!this.currentWeather) this.currentWeather = 'clear';
        if (typeof this.weatherTimer !== 'number') this.weatherTimer = 45.0;

        this.weatherTimer -= dt;
        if (this.weatherTimer <= 0) {
            this.weatherTimer = 90.0 + Math.random() * 30;
            const weathers = ['clear', 'rain', 'night', 'clear', 'ash'];
            const curIdx = weathers.indexOf(this.targetWeather);
            this.targetWeather = weathers[(curIdx + 1) % weathers.length];
            const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
            const weatherHints = isEn ? {
                clear: '☀️ The sky is slowly clearing...',
                rain: '🌧️ Gentle rain begins to fall...',
                night: '🌙 The sun sets, moonlight rises...',
                ash: '🌋 Distant volcano embers drift in the air...'
            } : {
                clear: '☀️ Dangus pamažu giedrėja...',
                rain: '🌧️ Telkiasi ramus lietus...',
                night: '🌙 Leidžiasi saulė, kyla mėnulis...',
                ash: '🌋 Pasirodo tolimos ugnikalnio kibirkštys...'
            };
            this.floatingTexts.push({
                text: `${weatherHints[this.targetWeather] || (isEn ? '🌦️ The climate is slowly shifting...' : '🌦️ Klimatas pamažu keičiasi...')}`,
                x: RTS_DATA.WORLD_WIDTH * 0.5,
                y: RTS_DATA.GROUND_Y - 200,
                color: '#67e8f9',
                life: 4.5,
                maxLife: 4.5
            });
        }

        // Labai tolygi ir lėta interpoliacija tarp orų būsenų (~12-14s perėjimas)
        const transitionRate = dt * 0.08;
        for (const wKey in this.weatherWeights) {
            if (wKey === this.targetWeather) {
                this.weatherWeights[wKey] = Math.min(1.0, this.weatherWeights[wKey] + transitionRate);
            } else {
                this.weatherWeights[wKey] = Math.max(0.0, this.weatherWeights[wKey] - transitionRate);
            }
        }
        if (this.weatherWeights[this.targetWeather] >= 0.7) {
            this.currentWeather = this.targetWeather;
        }

        // 2. Cooldowns & Gamybos Eilė
        if (this.playerUltimateCooldown > 0) this.playerUltimateCooldown -= dt;
        if (this.enemyUltimateCooldown > 0) this.enemyUltimateCooldown -= dt;

        this.updateSpawnQueue(dt);

        // 3. Darbininkai
        for (const w of this.playerWorkers) {
            try { w.update(dt, this); } catch (e) { console.error('Player worker error:', e); w.state = 'FINISHED'; }
        }
        for (const ew of this.enemyWorkers) {
            try { ew.update(dt, this); } catch (e) { console.error('Enemy worker error:', e); ew.state = 'FINISHED'; }
        }

        this.playerWorkers = this.playerWorkers.filter(w => w.state !== 'FINISHED' && w.state !== 'DEAD');
        this.enemyWorkers = this.enemyWorkers.filter(w => w.state !== 'FINISHED' && w.state !== 'DEAD');

        // 4. Bokšteliai
        this.updateTurrets(dt);

        // 5. Kariai
        this.updateSoldiers(dt);

        // 6. Sviediniai
        this.updateProjectiles(dt);

        // 7. Ultimates & Tobulinimai/Sienos
        this.updateUltimates(dt);
        this.updateUpgradesAndWalls(dt);

        // 8. Dalelės ir tekstai
        this.updateParticles(dt);
        this.updateFloatingTexts(dt);

        // 9. AI & Režimai
        if (this.gameMode === 'sandbox') {
            this.playerGold = 999999;
            this.playerResources.wood = 99999;
            this.playerResources.stone = 99999;
            this.playerResources.food = 99999;
            this.playerResources.maxPop = 60;
            // Smėlio dėžėje patogiam testavimui greitai papildome laisvus gyventojus, bet NIEKADA neviršijant 60 ribos:
            const living = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
            const queued = this.spawnQueue.filter(item => item.isPlayer !== false).length;
            const workers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
            const freeSlots = Math.max(0, 60 - (living + queued + workers));
            if ((this.playerResources.idlePop || 0) < Math.min(freeSlots, 10)) {
                this.playerResources.idlePop = Math.min(freeSlots, 10);
            } else if ((this.playerResources.idlePop || 0) > freeSlots) {
                this.playerResources.idlePop = freeSlots;
            }
            this.playerXp = Math.max(99999, this.playerXp);
            this.ai.update(dt);
        } else if (this.gameMode === 'endless') {
            this.updateEndlessMode(dt);
        } else if (this.gameMode === 'monsters') {
            this.updateMonsterInvasionMode(dt);
        } else {
            this.ai.update(dt);
        }

        if (this.isUnlimitedMode || this.difficulty === 'unlimited' || this.gameMode === 'sandbox') {
            this.isUnlimitedMode = true;
            if (this.playerBase) {
                this.playerBase.hp = 9999999;
                this.playerBase.maxHp = 9999999;
            }
            if (this.enemyBase) {
                this.enemyBase.hp = 9999999;
                this.enemyBase.maxHp = 9999999;
            }
        }

        // 10. Dinaminis mūšio garsas (įtampa didėja priešams artėjant)
        if (this.sound) {
            let maxTension = 0;
            for (const s of this.soldiers) {
                if (!s.isPlayer && s.x < 1100) {
                    const t = Math.max(0, (1100 - s.x) / 700);
                    if (t > maxTension) maxTension = t;
                }
            }
            this.sound.setBattleTension(maxTension);
        }

        // 11. Tikrinti pabaigą ir pasiekimus
        this.checkGameOver();
        this.checkLiveAchievements();

        // 12. Periodinis automatinis išsaugojimas (kas 5 sek.)
        this.autoSaveTimer = (this.autoSaveTimer || 0) + dt;
        if (this.autoSaveTimer >= 5.0) {
            this.autoSaveTimer = 0;
            this.saveGameState();
        }

        // 13. UI (Periodinis atnaujinimas kas 80ms sumažina DOM reflow krūvį, mygtukai reaguoja iškart)
        this.uiUpdateTimer = (this.uiUpdateTimer || 0) + dt;
        if (this.uiUpdateTimer >= 0.08) {
            this.uiUpdateTimer = 0;
            this.updateUI();
        }
    }

    // ========================================================================
    // KARIŲ GAMYBOS EILĖ (SPAWN QUEUE)
    // ========================================================================
    trainSoldier(unitIndex) {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        if (this.currentChallenge && this.currentChallenge.disableUnits) {
            this.floatingTexts.push({
                text: isEn ? `❌ Units are forbidden in this challenge!` : `❌ Šiame iššūkyje kariai uždrausti!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.4,
                maxLife: 1.4
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        const eraData = RTS_DATA.AGES[this.playerEra];
        const u = eraData.units[unitIndex];
        if (!u) return false;

        // Iššūkio apribojimai pagal tipą
        if (this.currentChallenge && this.currentChallenge.allowedUnitTypes && this.currentChallenge.allowedUnitTypes.length > 0) {
            if (!this.currentChallenge.allowedUnitTypes.includes(u.type)) {
                this.floatingTexts.push({
                    text: isEn ? `❌ This unit type is forbidden in this challenge!` : `❌ Šio tipo kariai šiame iššūkyje negalimi!`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 80,
                    color: '#ef4444',
                    life: 1.4,
                    maxLife: 1.4
                });
                if (this.sound) this.sound.playError();
                return false;
            }
        }

        if (this.spawnQueue.length >= this.maxQueueSize) {
            this.floatingTexts.push({
                text: isEn ? `❌ Production queue full (${this.maxQueueSize}/${this.maxQueueSize})!` : `❌ Gamybos eilė pilna (${this.maxQueueSize}/${this.maxQueueSize})!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.3,
                maxLife: 1.3
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (this.gameMode !== 'sandbox' && this.playerGold < u.costGold) {
            const missingGold = u.costGold - this.playerGold;
            this.floatingTexts.push({
                text: isEn ? `❌ Need ${missingGold}💰 Gold!` : `❌ Trūksta ${missingGold}💰 Aukso!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.4,
                maxLife: 1.4
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
        const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
        const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
        const currentEmployed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;
        const totalPlayerPop = (this.playerResources.idlePop || 0) + currentEmployed;

        // Populiacijos kontrolė galioja visada (įskaitant Sandbox, kad populiacija nedvigubėtų ir nebūtų 70/60):
        if ((this.playerResources.idlePop || 0) <= 0) {
            this.floatingTexts.push({
                text: isEn ? `❌ No idle citizens! Wait for castle to spawn a citizen.` : `❌ Nėra laisvų gyventojų! Palaukite, kol pilies ratukas pagimdys naują pilietį.`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.6,
                maxLife: 1.6
            });
            if (this.sound) this.sound.playError();
            return false;
        }
        if (currentEmployed >= this.playerResources.maxPop || totalPlayerPop > this.playerResources.maxPop) {
            this.floatingTexts.push({
                text: isEn ? `❌ Maximum population reached (${this.playerResources.maxPop}/${this.playerResources.maxPop}👥)!` : `❌ Pasiekta maksimali populiacija (${this.playerResources.maxPop}/${this.playerResources.maxPop}👥)!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.6,
                maxLife: 1.6
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (this.gameMode !== 'sandbox') {
            this.playerGold -= u.costGold;
        }
        this.playerResources.idlePop--;

        const recruitXp = Math.round(u.costGold * 0.6);
        this.playerXp += recruitXp;

        const trainDuration = this.gameMode === 'sandbox' ? 0.2 : (u.trainTime || (2.0 + unitIndex * 1.5));
        this.spawnQueue.push({
            unitIndex: unitIndex,
            data: u,
            era: this.playerEra,
            duration: trainDuration,
            elapsed: 0
        });

        this.stats.playerUnitsSpawned[u.id] = (this.stats.playerUnitsSpawned[u.id] || 0) + 1;

        if (this.sound) this.sound.playClick();
        this.renderSpawnQueueStructure();
        if (this.ui.playerGold) this.ui.playerGold.textContent = this.formatResource(this.playerGold);
        if (this.ui.playerXp) this.ui.playerXp.textContent = Math.floor(this.playerXp);
        return true;
    }

    canSummonHero(isPlayer = true) {
        const era = isPlayer ? this.playerEra : this.enemyEra;
        const heroSpec = RTS_DATA.HEROES ? RTS_DATA.HEROES[era] : null;
        if (!heroSpec) return false;
        const existingHero = this.soldiers.find(s => s.isPlayer === isPlayer && s.isHero && s.state !== 'DYING');
        if (existingHero) return false;

        if (isPlayer) {
            const inQueue = this.spawnQueue.some(item => item.isHero);
            if (inQueue) return false;
            if (this.spawnQueue.length >= this.maxQueueSize) return false;
            if (this.gameMode === 'sandbox') return true;
            const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
            const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
            const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
            const currentEmployed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;
            const totalEmployedPop = (this.playerResources.idlePop || 0) + currentEmployed;
            if (currentEmployed >= this.playerResources.maxPop) return false;
            if (totalEmployedPop >= this.playerResources.maxPop && (this.playerResources.idlePop || 0) <= 0) return false;
            return (this.playerGold >= heroSpec.costGold && this.playerResources.food >= heroSpec.costFood);
        } else {
            return (this.enemyGold >= heroSpec.costGold && (this.enemyResources.food >= (heroSpec.costFood || 0)));
        }
    }

    summonHero(isPlayer = true) {
        const era = isPlayer ? this.playerEra : this.enemyEra;
        const heroSpec = RTS_DATA.HEROES ? RTS_DATA.HEROES[era] : null;
        if (!heroSpec) return false;

        if (!isPlayer) {
            const existingHero = this.soldiers.find(s => !s.isPlayer && s.isHero && s.state !== 'DYING');
            if (existingHero) return false;
            if (this.enemyGold >= heroSpec.costGold) {
                this.enemyGold -= heroSpec.costGold;
                if (heroSpec.costFood && this.enemyResources.food >= heroSpec.costFood) {
                    this.enemyResources.food -= heroSpec.costFood;
                }
                const heroUnit = new RTSSoldier(false, { ...heroSpec, isHero: true, icon: heroSpec.icon || '👑' }, era, RTS_DATA.ENEMY_BASE_X + 20);
                heroUnit.isHero = true;
                heroUnit.heroSpec = heroSpec;
                this.soldiers.push(heroUnit);
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                const hName = (isEn && window.RTS_I18N) ? window.RTS_I18N.t(`hero.${this.enemyEra}.name`) : heroSpec.name;
                this.floatingTexts.push({
                    text: isEn ? `⚠️ Enemy summoned Hero: ${hName}! 👑` : `⚠️ Priešas pasitelkė Didvyrį: ${heroSpec.name}! 👑`,
                    x: RTS_DATA.ENEMY_BASE_X - 60,
                    y: RTS_DATA.GROUND_Y - 140,
                    color: '#ef4444',
                    life: 2.5,
                    maxLife: 2.5
                });
                return true;
            }
            return false;
        }

        const existingHero = this.soldiers.find(s => s.isPlayer && s.isHero && s.state !== 'DYING');
        if (existingHero) {
            return this.triggerHeroSkill(isPlayer);
        }

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';

        const inQueue = this.spawnQueue.some(item => item.isHero);
        if (inQueue) {
            this.floatingTexts.push({
                text: isEn ? `❌ Hero is already training in queue!` : `❌ Didvyris jau ruošiasi gamybos eilėje!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.4,
                maxLife: 1.4
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (this.gameMode !== 'sandbox') {
            if (this.playerGold < heroSpec.costGold) {
                this.floatingTexts.push({
                    text: isEn ? `❌ Need ${heroSpec.costGold - this.playerGold}💰 Gold!` : `❌ Trūksta ${heroSpec.costGold - this.playerGold}💰 Aukso!`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 80,
                    color: '#ef4444',
                    life: 1.4,
                    maxLife: 1.4
                });
                if (this.sound) this.sound.playError();
                return false;
            }
            if (this.playerResources.food < heroSpec.costFood) {
                this.floatingTexts.push({
                    text: isEn ? `❌ Need ${heroSpec.costFood - this.playerResources.food}🌾 Food!` : `❌ Trūksta ${heroSpec.costFood - this.playerResources.food}🌾 Maisto!`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 80,
                    color: '#ef4444',
                    life: 1.4,
                    maxLife: 1.4
                });
                if (this.sound) this.sound.playError();
                return false;
            }
        }

        const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
        const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
        const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
        const currentEmployed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;
        const totalEmployedPop = (this.playerResources.idlePop || 0) + currentEmployed;

        if ((this.playerResources.idlePop || 0) <= 0) {
            this.floatingTexts.push({
                text: isEn ? `❌ No idle citizens to summon Hero! Wait for a new citizen.` : `❌ Nėra laisvų gyventojų Didvyrio pašaukimui! Palaukite naujo piliečio.`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.6,
                maxLife: 1.6
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (currentEmployed >= this.playerResources.maxPop || totalEmployedPop > this.playerResources.maxPop) {
            this.floatingTexts.push({
                text: isEn ? `❌ Maximum population reached (${this.playerResources.maxPop}/${this.playerResources.maxPop}👥)!` : `❌ Pasiekta maksimali populiacija (${this.playerResources.maxPop}/${this.playerResources.maxPop}👥)!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 80,
                color: '#ef4444',
                life: 1.6,
                maxLife: 1.6
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (this.gameMode !== 'sandbox') {
            this.playerGold -= heroSpec.costGold;
            this.playerResources.food -= heroSpec.costFood;
        }
        this.playerResources.idlePop--;

        this.spawnQueue.push({
            unitIndex: 99,
            isHero: true,
            data: { ...heroSpec, icon: '👑' },
            era: this.playerEra,
            duration: this.gameMode === 'sandbox' ? 0.2 : (heroSpec.trainTime || 5.0),
            elapsed: 0
        });

        this.unlockAchievement('hero_summon');
        if (this.sound) this.sound.playClick();
        this.renderSpawnQueueStructure();
        this.updateUI();
        return true;
    }

    cancelQueueItem(idx) {
        if (idx < 0 || idx >= this.spawnQueue.length) return;
        const item = this.spawnQueue[idx];
        if (this.gameMode !== 'sandbox') {
            this.playerGold += item.data.costGold || 0;
            if (item.data.costFood) this.playerResources.food += item.data.costFood;
            if (item.data.costWood) this.playerResources.wood += item.data.costWood;
            this.playerResources.idlePop = Math.min(this.playerResources.maxPop, (this.playerResources.idlePop || 0) + 1);
        }
        this.spawnQueue.splice(idx, 1);

        const cancelMsg = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en') ? `↩️ Cancelled: +${item.data.costGold || 0}💰 (+1👥)` : `↩️ Atšaukta: +${item.data.costGold || 0}💰 (+1👥)`;
        this.floatingTexts.push({
            text: cancelMsg,
            x: RTS_DATA.PLAYER_BASE_X + 60,
            y: RTS_DATA.GROUND_Y - 60,
            color: '#f59e0b',
            life: 1.2,
            maxLife: 1.2
        });

        if (this.sound) this.sound.playClick();
        this.renderSpawnQueueStructure();
        this.updateUI();
    }

    updateSpawnQueue(dt) {
        if (this.spawnQueue.length === 0) {
            if (this.ui.spawnQueueContainer && this.ui.spawnQueueContainer.children.length > 1) {
                this.renderSpawnQueueStructure();
            }
            return;
        }

        const current = this.spawnQueue[0];
        const queueSpeed = (this.activePerks && this.activePerks.includes('auto_conveyor')) ? 1.45 : 1.0;
        current.elapsed += dt * queueSpeed;

        if (current.elapsed >= current.duration) {
            // Mokymai baigti – šaukti karį į mūšio lauką tiesiai pro bazės vartus!
            const spawnX = RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH - 20;
            const s = new RTSSoldier(true, current.data, current.era, spawnX);

            // Perkai: Geležinė valia (+25% HP)
            if (this.activePerks && this.activePerks.includes('iron_will')) {
                s.hp = Math.round(s.hp * 1.25);
                s.maxHp = s.hp;
            }

            // Perkai: Snaiperio akis (+35% Range šauliams)
            if (this.activePerks && this.activePerks.includes('sniper_eye') && (s.type === 'ranged' || s.range > 80)) {
                s.range = Math.round(s.range * 1.35);
            }

            this.soldiers.push(s);

            const showSoldierReady = (!this.settings || (this.settings.baseFloatingTexts !== false && this.settings.soldierSpawnTexts !== false));
            if (showSoldierReady) {
                const isHero = current.isHero;
                const uName = (window.RTS_I18N) ? (isHero ? window.RTS_I18N.getHeroName(current.era) : (current.data.id ? window.RTS_I18N.getUnitName(current.data.id) : current.data.name)) : current.data.name;
                const readyMsg = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en') ? `⚔️ ${uName} ready!` : `⚔️ ${uName} paruoštas!`;
                this.floatingTexts.push({
                    text: readyMsg,
                    x: spawnX,
                    y: RTS_DATA.GROUND_Y - 70,
                    color: '#10b981',
                    life: 1.4,
                    maxLife: 1.4
                });
            }

            if (this.sound && this.sound.playSpawnUnit) this.sound.playSpawnUnit(this.playerEra, 'worker', false);
            else if (this.sound) this.sound.playRecruit();
            this.spawnQueue.shift();
            this.renderSpawnQueueStructure();
        } else {
            this.updateSpawnQueueUI();
        }
    }

    queueDelayedSpawn(isPlayer, unitData, delaySeconds, x) {
        if (!this.delayedSpawns) this.delayedSpawns = [];
        this.delayedSpawns.push({
            isPlayer,
            unitData,
            era: isPlayer ? this.playerEra : this.enemyEra,
            x: (x !== undefined) ? x : (isPlayer ? (RTS_DATA.PLAYER_BASE_X + 40) : (RTS_DATA.ENEMY_BASE_X + 30)),
            timer: delaySeconds
        });
    }

    renderSpawnQueueStructure() {
        const container = this.ui.spawnQueueContainer;
        if (!container) return;

        this.cachedQueueLength = this.spawnQueue.length;
        container.innerHTML = '';
        if (this.spawnQueue.length === 0) {
            this.cachedFirstSlotBg = null;
            this.cachedFirstSlotLine = null;
            const emptyLabel = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en') ? 'Training queue empty [1][2][3]' : 'Gamybos eilė tuščia [1][2][3]';
            container.innerHTML = `<span style="color:#64748b; font-size:10px; font-style:italic;">${emptyLabel}</span>`;
            return;
        }

        const isEn = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en');
        this.spawnQueue.forEach((item, idx) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'queue-slot-item' + (idx === 0 ? ' active' : '');
            itemEl.setAttribute('data-queue-idx', idx);
            const isHero = item.isHero;
            const itemName = (window.RTS_I18N) ? (isHero ? window.RTS_I18N.getHeroName(item.era) : (item.data.id ? window.RTS_I18N.getUnitName(item.data.id) : (item.data.name || ''))) : (item.data.name || '');
            itemEl.title = isEn ? `Click to cancel: ${itemName} (+${item.data.costGold || 0}💰, +1👥)` : `Spustelėkite atšaukti: ${itemName} (+${item.data.costGold || 0}💰, +1👥)`;

            const percent = idx === 0 ? Math.min(100, Math.max(0, (item.elapsed / item.duration) * 100)) : 0;
            itemEl.innerHTML = `
                ${idx === 0 ? `
                <div class="queue-fill-bg" style="width:${percent.toFixed(1)}%;"></div>
                <div class="queue-fill-line" style="width:${percent.toFixed(1)}%;"></div>` : ''}
                <div class="queue-icon">${item.data.icon || '⚔️'}</div>
                <div class="queue-cancel-x" title="${isEn ? 'Cancel training' : 'Atšaukti gamybą'}">✕</div>
            `;
            itemEl.onpointerdown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.cancelQueueItem(idx);
            };
            itemEl.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.cancelQueueItem(idx);
            };
            container.appendChild(itemEl);
        });

        this.cachedFirstSlotBg = container.querySelector('.queue-fill-bg');
        this.cachedFirstSlotLine = container.querySelector('.queue-fill-line');
    }

    updateSpawnQueueUI() {
        if (this.spawnQueue.length === 0) return;
        if (this.cachedQueueLength !== this.spawnQueue.length) {
            this.renderSpawnQueueStructure();
            return;
        }

        // Sklandus pirmojo kario progreso atnaujinimas be jokių DOM paieškų
        const current = this.spawnQueue[0];
        const percent = Math.min(100, Math.max(0, (current.elapsed / current.duration) * 100));
        if (this.cachedFirstSlotBg) this.cachedFirstSlotBg.style.width = `${percent.toFixed(1)}%`;
        if (this.cachedFirstSlotLine) this.cachedFirstSlotLine.style.width = `${percent.toFixed(1)}%`;
    }

    // ========================================================================
    // IŠLIKIMO REŽIMAS (ENDLESS HORDE MODE WAVES)
    // ========================================================================
    updateEndlessMode(dt) {
        const enemiesAlive = this.soldiers.filter(s => !s.isPlayer).length;

        if (enemiesAlive === 0 && !this.survivalWaveActive) {
            this.survivalWaveTimer -= dt;
            if (this.survivalWaveTimer <= 0) {
                this.spawnSurvivalWave();
            }
        }
    }

    spawnSurvivalWave() {
        this.survivalWaveActive = true;
        const wave = this.survivalWave;

        // Sunkumo koeficientai Išlikimo (Endless) režimui:
        let diffScale = 1.0;
        let countMult = 1.0;
        let restTime = 14.0;
        if (this.difficulty === 'easy') {
            diffScale = 0.75;
            countMult = 0.75;
            restTime = 18.0;
        } else if (this.difficulty === 'hard') {
            diffScale = 1.30;
            countMult = 1.30;
            restTime = 11.0;
        } else if (this.difficulty === 'unlimited') {
            diffScale = 1.50;
            countMult = 1.50;
            restTime = 9.0;
        }
        this.survivalWaveTimer = restTime;

        // Epochos parinkimas pagal bangą
        const waveEra = Math.min(4, Math.floor((wave - 1) / 3));
        const eraData = RTS_DATA.AGES[waveEra];
        const unitCount = Math.max(3, Math.round((3 + wave * 2) * countMult));

        for (let i = 0; i < unitCount; i++) {
            setTimeout(() => {
                if (this.state !== 'PLAYING') return;
                const uIdx = (i % 3 === 2) ? 2 : (i % 2 === 1 ? 1 : 0);
                const u = eraData.units[uIdx];
                const s = new RTSSoldier(false, u, waveEra, RTS_DATA.ENEMY_BASE_X + 15);
                // Bangos stiprinimas pagal bangą ir sunkumą
                s.hp = Math.round(s.hp * (1 + wave * 0.1) * diffScale);
                s.damage = Math.round(s.damage * (1 + wave * 0.08) * diffScale);
                this.soldiers.push(s);
            }, i * 350);
        }

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        this.floatingTexts.push({
            text: isEn ? `🌊 WAVE #${wave}! (${unitCount} enemies)` : `🌊 BANGA #${wave}! (${unitCount} priešai)`,
            x: RTS_DATA.WORLD_WIDTH * 0.5,
            y: RTS_DATA.GROUND_Y - 180,
            color: '#ef4444',
            life: 3.0,
            maxLife: 3.0
        });

        this.survivalWave++;
        this.stats.wavesCleared = wave;
        this.survivalWaveActive = false;
    }

    // ========================================================================
    // MONSTRŲ INVAZIJOS REŽIMAS (MONSTER HORDE SIEGE WAVES)
    // ========================================================================
    updateMonsterInvasionMode(dt) {
        // Apsauga nuo portale užstrigusių monstrų (Watchdog Failsafe):
        for (const s of this.soldiers) {
            if (!s.isPlayer && (s.isMonster || this.gameMode === 'monsters') && s.state !== 'DYING') {
                if (s.x > RTS_DATA.ENEMY_BASE_X - 10) {
                    s.portalStuckTimer = (s.portalStuckTimer || 0) + dt;
                    if (s.portalStuckTimer > 2.5) {
                        // Nustumti monstrą tiesiai į arenos kovos lauką
                        s.x = RTS_DATA.ENEMY_BASE_X - 45;
                        s.portalStuckTimer = 0;
                    }
                } else {
                    s.portalStuckTimer = 0;
                }
            }
        }

        const monstersAlive = this.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING').length;

        if (monstersAlive === 0 && !this.monsterWaveActive) {
            this.monsterWaveTimer -= dt;
            if (this.monsterWaveTimer <= 0) {
                this.spawnMonsterWave();
            }
        }
    }

    spawnMonsterWave() {
        this.monsterWaveActive = true;
        const wave = this.monsterWave;
        const mData = RTS_DATA.MONSTERS;
        const playerEra = this.playerEra || 0;

        // Sunkumo koeficientai Monstrų Invazijos režimui:
        let diffScale = 1.0;
        let countMult = 1.0;
        let restTime = 16.0;
        if (this.difficulty === 'easy') {
            diffScale = 0.75;
            countMult = 0.75;
            restTime = 20.0;
        } else if (this.difficulty === 'hard') {
            diffScale = 1.35;
            countMult = 1.35;
            restTime = 12.0;
        } else if (this.difficulty === 'unlimited') {
            diffScale = 1.50;
            countMult = 1.50;
            restTime = 10.0;
        }
        this.monsterWaveTimer = restTime;

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        let waveEnemies = [];
        let bossTitle = '';

        // BOSŲ BANGOS (Kas 5 bangas ir specialios titanų bangos):
        if (wave === 5) {
            bossTitle = isEn ? ' 🔥 [BOSS: FIRE DRAGON!] 🔥' : ' 🔥 [BOSAS: UGNIES DRAKONAS!] 🔥';
            waveEnemies = ['ogre_brute', 'lava_golem', 'dragon_boss', 'lava_golem', 'ogre_brute', 'shadow_gargoyle', 'shadow_gargoyle'];
        } else if (wave === 7) {
            bossTitle = isEn ? ' 🗿 [GIANT: ANCIENT TITAN!] 🗿' : ' 🗿 [GIGANTAS: SENOVINIS TITANAS!] 🗿';
            waveEnemies = ['ogre_brute', 'ancient_colossus_titan', 'lava_golem', 'plasma_hydra', 'acid_spitter'];
        } else if (wave === 10) {
            bossTitle = isEn ? ' ⚡ [BOSSES: PLASMA HYDRA & VOID COLOSSUS!] ⚡' : ' ⚡ [BOSAI: PLAZMINĖ HIDRA & BEDUGNĖS KOLOSAS!] ⚡';
            waveEnemies = ['void_colossus', 'plasma_hydra', 'dragon_boss', 'ancient_colossus_titan', 'void_colossus', 'cyber_mutant', 'undead_necromancer'];
        } else if (wave === 12) {
            bossTitle = isEn ? ' 🗿 [TITAN ASSAULT: TWO GIANTS!] 🗿' : ' 🗿 [TITANŲ ŠTURMAS: DU MILŽINAI!] 🗿';
            waveEnemies = ['ancient_colossus_titan', 'lava_golem', 'ancient_colossus_titan', 'cyber_mutant', 'frost_wyrm'];
        } else if (wave === 15) {
            bossTitle = isEn ? ' 🤖 [MEGA BOSS: CYBER-TITAN & GIANT!] 🤖' : ' 🤖 [MEGA BOSAS: KIBER-TITANAS & MILŽINAS!] 🤖';
            waveEnemies = ['void_colossus', 'frost_wyrm', 'mecha_titan_boss', 'ancient_colossus_titan', 'frost_wyrm', 'cyber_mutant', 'lava_golem'];
        } else if (wave % 10 === 0) {
            bossTitle = isEn ? ' 👑 [FINAL BOSS: DARK OVERLORD & TITAN LEGION!] 👑' : ' 👑 [GALUTINIS BOSAS: TAMSOS VALDOVAS IR TITANŲ LEGIJONAS!] 👑';
            waveEnemies = ['abyssal_overlord', 'ancient_colossus_titan', 'mecha_titan_boss', 'frost_wyrm', 'frost_wyrm', 'void_colossus', 'cyber_mutant', 'plasma_hydra'];
        } else if (wave % 5 === 0) {
            bossTitle = isEn ? ' ⚔️ [ELITE BOSS & TITAN HORDE!] ⚔️' : ' ⚔️ [ELITINĖ BOSŲ IR TITANŲ ORDA!] ⚔️';
            waveEnemies = ['mecha_titan_boss', 'dragon_boss', 'ancient_colossus_titan', 'frost_wyrm', 'void_colossus', 'cyber_mutant', 'plasma_hydra'];
        }
        // ĮPRASTOS BANGOS PAGAL LYGĮ:
        else if (wave === 1) {
            waveEnemies = ['goblin_scout', 'goblin_scout', 'goblin_scout', 'goblin_scout', 'goblin_scout'];
        } else if (wave === 2) {
            waveEnemies = ['goblin_scout', 'goblin_scout', 'acid_spitter', 'goblin_scout', 'acid_spitter', 'goblin_scout'];
        } else if (wave === 3) {
            waveEnemies = ['goblin_scout', 'goblin_scout', 'acid_spitter', 'ogre_brute', 'acid_spitter', 'goblin_scout', 'goblin_scout'];
        } else if (wave === 4) {
            waveEnemies = ['shadow_gargoyle', 'ogre_brute', 'acid_spitter', 'shadow_gargoyle', 'ogre_brute', 'acid_spitter', 'ogre_brute'];
        } else if (wave <= 7) {
            waveEnemies = ['lava_golem', 'plasma_hydra', 'undead_necromancer', 'ogre_brute', 'shadow_gargoyle', 'plasma_hydra', 'acid_spitter'];
        } else if (wave <= 9) {
            waveEnemies = ['void_colossus', 'cyber_mutant', 'plasma_hydra', 'cyber_mutant', 'undead_necromancer', 'lava_golem', 'frost_wyrm'];
        } else if (wave <= 14) {
            const count = Math.min(18, 7 + wave);
            const pool = ['cyber_mutant', 'frost_wyrm', 'void_colossus', 'plasma_hydra', 'undead_necromancer', 'lava_golem'];
            for (let i = 0; i < count; i++) {
                waveEnemies.push(pool[i % pool.length]);
            }
        } else {
            const count = Math.min(24, 10 + wave);
            const highPool = ['ancient_colossus_titan', 'mecha_titan_boss', 'frost_wyrm', 'void_colossus', 'cyber_mutant', 'plasma_hydra', 'undead_necromancer', 'dragon_boss'];
            for (let i = 0; i < count; i++) {
                waveEnemies.push(highPool[i % highPool.length]);
            }
        }

        // Monstrų kiekio koregavimas pagal sunkumo lygį:
        if (countMult < 1.0) {
            const targetCount = Math.max(3, Math.round(waveEnemies.length * countMult));
            waveEnemies = waveEnemies.slice(0, targetCount);
        } else if (countMult > 1.0) {
            const extraCount = Math.round(waveEnemies.length * (countMult - 1.0));
            for (let e = 0; e < extraCount; e++) {
                waveEnemies.push(waveEnemies[e % waveEnemies.length]);
            }
        }

        // ADAPTYVUS MASTELIS PAGAL ŽAIDĖJO EPOCHĄ:
        const eraMultipliers = [1.0, 1.65, 2.75, 4.6, 8.0];
        const eraScale = eraMultipliers[playerEra] || 1.0;
        const waveScale = 1 + (wave - 1) * 0.14;
        const totalScale = eraScale * waveScale;

        const isBossWave = (wave % 5 === 0 || wave === 7 || wave === 12);

        waveEnemies.forEach((mKey, i) => {
            setTimeout(() => {
                if (this.state !== 'PLAYING') return;
                const mSpec = (mData && mData[mKey]) ? mData[mKey] : mData.goblin_scout;

                // Monstrai žengia tiesiai iš Tamsos Portalo burnos į mūšio lauką
                const spawnX = RTS_DATA.ENEMY_BASE_X + 15 - (i % 3) * 10;
                const s = new RTSSoldier(false, mSpec, 0, spawnX);
                s.isMonster = true;
                s.monsterType = mKey;
                if (mSpec.isGiant || mKey === 'ancient_colossus_titan') {
                    s.isGiant = true;
                    if (this.renderer && this.renderer.addShake) {
                        this.renderer.addShake(8);
                    }
                }
                if (mSpec.isFlying) {
                    s.laneOffsetY = -35;
                }

                // Skalavimas pagal bangą, žaidėjo epochą ir pasirinktą sunkumo lygį
                s.hp = Math.round(s.hp * totalScale * diffScale);
                s.maxHp = s.hp;
                s.damage = Math.round(s.damage * (1 + (wave - 1) * 0.09 + playerEra * 0.35) * diffScale);
                this.soldiers.push(s);
            }, i * 400);
        });

        this.floatingTexts.push({
            text: isEn ? `👾 MONSTER WAVE #${wave}! (${waveEnemies.length} beasts)${bossTitle}` : `👾 MONSTRŲ BANGA #${wave}! (${waveEnemies.length} pabaisos)${bossTitle}`,
            x: RTS_DATA.WORLD_WIDTH * 0.5,
            y: RTS_DATA.GROUND_Y - 180,
            color: isBossWave ? '#ef4444' : '#a855f7',
            life: 3.8,
            maxLife: 3.8
        });

        // Bangos pergalės apdovanojimai
        const waveGoldReward = 150 + wave * 60 + playerEra * 100;
        const waveXpReward = 200 + wave * 100 + playerEra * 150;
        this.playerGold += waveGoldReward;
        this.playerXp += waveXpReward;

        this.monsterWave++;
        this.stats.wavesCleared = wave;
        this.monsterWaveActive = false;

        if (wave >= 5) this.unlockAchievement('monster_wave_5');
    }

    // ========================================================================
    // RESURSŲ GAVYBOS MISIJOS (GATHERING MISSIONS)
    // ========================================================================
    gatherResource(type) {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        if ((this.playerResources.idlePop || 0) <= 0) {
            const locX = (type === 'center_gold') ? RTS_DATA.NEUTRAL_CACHE_X : (RTS_DATA.PLAYER_BASE_X + 60);
            const locY = (type === 'center_gold') ? (RTS_DATA.GROUND_Y - 140) : (RTS_DATA.GROUND_Y - 80);
            this.floatingTexts.push({
                text: isEn ? `❌ No idle citizens! (In base: 0👥)` : `❌ Nėra laisvų gyventojų! (Bazėje: 0👥)`,
                x: locX,
                y: locY,
                color: '#ef4444',
                life: 1.8,
                maxLife: 1.8,
                isError: true
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        this.playerResources.idlePop--;

        let targetX = 75;
        let icon = '🌲';
        if (type === 'wood') { 
            const idx = Math.floor(Math.random() * 4);
            targetX = 35 + idx * 26 + (Math.random() * 16 - 8); 
            icon = '🌲'; 
        } else if (type === 'stone') { 
            const idx = Math.floor(Math.random() * 3);
            targetX = 145 + idx * 24 + (Math.random() * 16 - 8); 
            icon = '🪨'; 
        } else if (type === 'food') { 
            const idx = Math.floor(Math.random() * 3);
            targetX = 250 + idx * 22 + (Math.random() * 16 - 8); 
            icon = '🌾'; 
        } else if (type === 'center_gold') { 
            targetX = RTS_DATA.NEUTRAL_CACHE_X - 32 + (Math.random() * 20 - 10); 
            icon = '💎'; 
        }

        const worker = new RTSWorker(true, type, targetX, this.gatherAmount, this.playerEra);
        worker.manualOrder = true; // Žaidėjo tiesioginė rankinė komanda - eiti tiesiai prie kasyklos
        this.playerWorkers.push(worker);

        const isCenterGold = (type === 'center_gold');
        if (isCenterGold || !this.settings || (this.settings.baseFloatingTexts !== false && this.settings.workerDispatchTexts !== false)) {
            const msg = isCenterGold 
                ? (isEn ? `💎 Worker dispatched to mine gold!` : `💎 Darbininkas pasiųstas kasti aukso!`)
                : (isEn ? `${icon} Citizen dispatched to gather!` : `${icon} Gyventojas išsiųstas į gavybą!`);
            this.floatingTexts.push({
                text: msg,
                x: isCenterGold ? RTS_DATA.NEUTRAL_CACHE_X : (RTS_DATA.PLAYER_BASE_X + 60),
                y: isCenterGold ? (RTS_DATA.GROUND_Y - 140) : (RTS_DATA.GROUND_Y - 60),
                color: '#38bdf8',
                life: 1.5,
                maxLife: 1.5,
                isAlert: isCenterGold
            });
        }

        if (this.sound) this.sound.playClick();
        this.updateUI();
        return true;
    }

    // Tylusis automatinis darbininko išsiuntimas (be pranešimų srauto)
    gatherResourceSilent(type) {
        // Reikalauja esamo laisvo gyventojo bazėje
        if ((this.playerResources.idlePop || 0) <= 0) return false;
        this.playerResources.idlePop--;

        let targetX = 75;
        if (type === 'wood') { 
            const idx = Math.floor(Math.random() * 4);
            targetX = 35 + idx * 26 + (Math.random() * 16 - 8); 
        } else if (type === 'stone') { 
            const idx = Math.floor(Math.random() * 3);
            targetX = 145 + idx * 24 + (Math.random() * 16 - 8); 
        } else if (type === 'food') { 
            const idx = Math.floor(Math.random() * 3);
            targetX = 250 + idx * 22 + (Math.random() * 16 - 8); 
        } else if (type === 'center_gold') { 
            targetX = RTS_DATA.NEUTRAL_CACHE_X - 32 + (Math.random() * 20 - 10); 
        }

        const worker = new RTSWorker(true, type, targetX, this.gatherAmount, this.playerEra);
        this.playerWorkers.push(worker);
        this.updateUI();
        return true;
    }

    // Automatinės kasybos įjungimas / išjungimas
    toggleAutoGather() {
        this.autoGatherEnabled = !(this.autoGatherEnabled !== false);
        if (this.autoGatherConfig) {
            this.autoGatherConfig.enabled = this.autoGatherEnabled;
        }
        const chkW = document.getElementById('cfgWorkerEnabled');
        if (chkW) chkW.checked = this.autoGatherEnabled;

        const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
        const stateStr = this.autoGatherEnabled 
            ? (isEn ? 'ENABLED (Mining continuously)' : 'ĮJUNGTA (Kasa nuolat)') 
            : (isEn ? 'DISABLED' : 'IŠJUNGTA');
        this.floatingTexts.push({
            text: isEn ? `⛏️ Auto-Gather: ${stateStr}` : `⛏️ Auto-Kasyba: ${stateStr}`,
            x: RTS_DATA.PLAYER_BASE_X + 90,
            y: RTS_DATA.GROUND_Y - 90,
            color: this.autoGatherEnabled ? '#10b981' : '#ef4444',
            life: 1.8,
            maxLife: 1.8
        });
        if (this.sound) this.sound.playClick();
        this.updateUI();
    }

    // Prekyba (Parduoti 10 medžiagų už auksą)
    sellMaterial(type) {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const rate = RTS_DATA.MARKET_RATES[type];
        const icon = type === 'wood' ? '🪵' : type === 'stone' ? '🪨' : '🌾';
        const typeName = isEn ? (type === 'wood' ? 'Wood' : type === 'stone' ? 'Stone' : 'Food') : (type === 'wood' ? 'Medienos' : type === 'stone' ? 'Akmens' : 'Maisto');
        const currentStock = Math.floor(this.playerResources[type] || 0);

        if (!rate || currentStock < rate.amount) {
            const missing = rate ? (rate.amount - currentStock) : 0;
            this.floatingTexts.push({
                text: isEn ? `❌ Cannot trade: Need ${missing} ${icon} ${typeName}! (Have: ${currentStock})` : `❌ Negalima: Trūksta ${missing} ${icon} ${typeName}! (Turite: ${currentStock})`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 70,
                color: '#ef4444',
                life: 1.4,
                maxLife: 1.4
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        this.playerResources[type] -= rate.amount;
        this.playerGold += rate.gold;

        this.floatingTexts.push({
            text: isEn ? `✅ Sold 10 ${icon} ➔ +${rate.gold}💰 Gold!` : `✅ Parduota 10 ${icon} ➔ +${rate.gold}💰 Auksas!`,
            x: RTS_DATA.PLAYER_BASE_X + 50,
            y: RTS_DATA.GROUND_Y - 60,
            color: '#f59e0b',
            life: 1.4,
            maxLife: 1.4
        });

        if (this.sound) this.sound.playBuySuccess();
        this.updateUI();
        return true;
    }

    // Lankstus bet kokio kiekio pardavimas
    sellResourceAmount(type, amount, isAuto = false) {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        amount = Math.floor(Math.max(0, amount));
        const current = Math.floor(this.playerResources[type] || 0);
        const icon = type === 'wood' ? '🪵' : type === 'stone' ? '🪨' : '🌾';
        const typeName = isEn ? (type === 'wood' ? 'Wood' : type === 'stone' ? 'Stone' : 'Food') : (type === 'wood' ? 'Medienos' : type === 'stone' ? 'Akmens' : 'Maisto');

        if (amount <= 0 || current < amount) {
            if (!isAuto) {
                this.floatingTexts.push({
                    text: isEn ? `❌ Cannot trade: Need ${amount - current} ${icon} ${typeName}! (Have: ${current})` : `❌ Negalima: Trūksta ${amount - current} ${icon} ${typeName}! (Turite: ${current})`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 70,
                    color: '#ef4444',
                    life: 1.4,
                    maxLife: 1.4
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        let ratePerUnit = 2.0;
        if (type === 'stone') ratePerUnit = 2.5;
        else if (type === 'food') ratePerUnit = 1.5;

        const goldEarned = Math.floor(amount * ratePerUnit);
        this.playerResources[type] -= amount;
        this.playerGold += goldEarned;

        if (!isAuto) {
            this.floatingTexts.push({
                text: isEn ? `✅ Sold ${amount}${icon} ➔ +${goldEarned}💰 Gold!` : `✅ Parduota ${amount}${icon} ➔ +${goldEarned}💰 Auksas!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 65,
                color: '#f59e0b',
                life: 1.5,
                maxLife: 1.5
            });
            if (this.sound) this.sound.playBuySuccess();
        }
        this.updateUI();
        return true;
    }

    // Resursų pirkimas už Auksą
    buyResourceAmount(type, amount) {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        amount = Math.floor(Math.max(0, amount));
        if (amount <= 0) return false;

        let costPerUnit = 2.5;
        if (type === 'stone') costPerUnit = 3.0;
        else if (type === 'food') costPerUnit = 2.0;

        const goldCost = Math.ceil(amount * costPerUnit);
        const icon = type === 'wood' ? '🪵' : type === 'stone' ? '🪨' : '🌾';

        if (this.playerGold < goldCost) {
            const missingGold = goldCost - this.playerGold;
            this.floatingTexts.push({
                text: isEn ? `❌ Cannot buy: Need ${missingGold}💰 Gold! (Cost: ${goldCost}💰)` : `❌ Negalima: Trūksta ${missingGold}💰 Aukso! (Kaina: ${goldCost}💰)`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 70,
                color: '#ef4444',
                life: 1.5,
                maxLife: 1.5
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        this.playerGold -= goldCost;
        this.playerResources[type] = (this.playerResources[type] || 0) + amount;

        this.floatingTexts.push({
            text: isEn ? `✅ Purchased +${amount}${icon}! (-${goldCost}💰)` : `✅ Nupirkta +${amount}${icon}! (-${goldCost}💰)`,
            x: RTS_DATA.PLAYER_BASE_X + 60,
            y: RTS_DATA.GROUND_Y - 65,
            color: '#10b981',
            life: 1.5,
            maxLife: 1.5
        });

        if (this.sound) this.sound.playBuySuccess();
        this.updateUI();
        return true;
    }

    // Parduoti visą perteklių virš evoliucijos poreikio (arba visas medžiagas pasiekus maksimalią epochą)
    sellSurplusResources() {
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const isMaxEra = this.playerEra >= 4;
        const currentEra = this.playerEra;
        const eraData = (RTS_DATA.AGES && RTS_DATA.AGES[currentEra]) ? RTS_DATA.AGES[currentEra] : null;
        const evoCost = (!isMaxEra && eraData && eraData.evolveCost) ? eraData.evolveCost : { wood: 0, stone: 0, food: 0 };
        const res = this.playerResources;

        const reqWood = isMaxEra ? 0 : (evoCost.wood || 0);
        const reqStone = isMaxEra ? 0 : (evoCost.stone || 0);
        const reqFood = isMaxEra ? 0 : (evoCost.food || 0);

        const surplusWood = Math.max(0, Math.floor(res.wood - reqWood));
        const surplusStone = Math.max(0, Math.floor(res.stone - reqStone));
        const surplusFood = Math.max(0, Math.floor(res.food - reqFood));

        let totalSoldGold = 0;
        if (surplusWood > 0) {
            res.wood -= surplusWood;
            totalSoldGold += Math.floor(surplusWood * 2.0);
        }
        if (surplusStone > 0) {
            res.stone -= surplusStone;
            totalSoldGold += Math.floor(surplusStone * 2.5);
        }
        if (surplusFood > 0) {
            res.food -= surplusFood;
            totalSoldGold += Math.floor(surplusFood * 1.5);
        }

        if (totalSoldGold > 0) {
            this.playerGold += totalSoldGold;
            const msg = isMaxEra
                ? (isEn ? `✅ Sold all materials (Max Age): +${totalSoldGold}💰!` : `✅ Parduotos visos medžiagos (Maksimali Epocha): +${totalSoldGold}💰!`)
                : (isEn ? `✅ Sold surplus: +${totalSoldGold}💰!` : `✅ Parduotas perteklius: +${totalSoldGold}💰!`);
            this.floatingTexts.push({
                text: msg,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 70,
                color: '#f59e0b',
                life: 1.8,
                maxLife: 1.8
            });
            if (this.sound) this.sound.playBuySuccess();
            this.updateUI();
            return true;
        } else {
            const msg = isMaxEra
                ? (isEn ? `ℹ️ No materials to sell!` : `ℹ️ Neturite medžiagų pardavimui!`)
                : (isEn ? `ℹ️ No surplus – all materials needed for evolution!` : `ℹ️ Nėra pertekliaus – visos medžiagos reikalingos evoliucijai!`);
            this.floatingTexts.push({
                text: msg,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 70,
                color: '#38bdf8',
                life: 1.5,
                maxLife: 1.5
            });
            if (this.sound) this.sound.playClick();
            return false;
        }
    }

    // ========================================================================
    // 4 TOBULINIMŲ KRYPČIŲ METODAI (BASE_WALL, WORKERS_AI, MILITARY, TRADE)
    // ========================================================================
    getUpgradeLevel(trackId, isPlayer = true) {
        const upg = isPlayer ? this.playerUpgrades : this.enemyUpgrades;
        return (upg && upg[trackId] !== undefined) ? upg[trackId] : 0;
    }

    isUpgradeMaxed(trackId, isPlayer = true) {
        return this.getUpgradeLevel(trackId, isPlayer) >= 5;
    }

    getUpgradeCost(trackId, targetLevel) {
        const track = RTS_DATA.UPGRADES && RTS_DATA.UPGRADES[trackId];
        if (!track || !track.levels || !track.levels[targetLevel - 1]) return null;
        return track.levels[targetLevel - 1].cost;
    }

    buyUpgrade(trackId, isPlayer = true) {
        const track = RTS_DATA.UPGRADES && RTS_DATA.UPGRADES[trackId];
        if (!track) return false;

        const currentLvl = this.getUpgradeLevel(trackId, isPlayer);
        const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
        if (currentLvl >= 5) {
            if (isPlayer) {
                const trkName = (window.RTS_I18N && isEn) ? RTS_I18N.getUpgradeName(trackId) : track.name;
                this.floatingTexts.push({
                    text: isEn ? `🏆 Maximum ${trkName} level reached!` : `🏆 Pasiektas maksimalus ${track.name} lygis!`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 110,
                    color: '#fbbf24',
                    life: 1.6,
                    maxLife: 1.6
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        const nextLvl = currentLvl + 1;
        const levelData = track.levels[nextLvl - 1];
        const cost = levelData.cost;

        const gold = isPlayer ? this.playerGold : this.enemyGold;
        const res = isPlayer ? this.playerResources : this.enemyResources;

        // Sandėlių / Turgavietės pirkimo nuolaida
        const econLvl = this.getUpgradeLevel('trade_economy', isPlayer);
        const discount = (econLvl >= 3) ? (RTS_DATA.UPGRADES.trade_economy.levels[econLvl - 1].buyDiscount || 0) : 0;
        const finalCostGold = Math.floor((cost.gold || 0) * (1 - discount));

        if (this.gameMode !== 'sandbox' && isPlayer) {
            if (gold < finalCostGold || (cost.wood && res.wood < cost.wood) || (cost.stone && res.stone < cost.stone) || (cost.food && res.food < cost.food)) {
                const missing = [];
                if (gold < finalCostGold) missing.push(`${finalCostGold - gold}💰`);
                if (cost.wood && res.wood < cost.wood) missing.push(`${cost.wood - Math.floor(res.wood)}🪵`);
                if (cost.stone && res.stone < cost.stone) missing.push(`${cost.stone - Math.floor(res.stone)}🪨`);
                if (cost.food && res.food < cost.food) missing.push(`${cost.food - Math.floor(res.food)}🌾`);
                this.floatingTexts.push({
                    text: isEn ? `❌ Not enough for upgrade: ${missing.join(', ')}` : `❌ Trūksta patobulinimui: ${missing.join(', ')}`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 110,
                    color: '#ef4444',
                    life: 1.5,
                    maxLife: 1.5
                });
                if (this.sound) this.sound.playError();
                return false;
            }
        }

        if (this.gameMode !== 'sandbox') {
            if (isPlayer) {
                this.playerGold -= finalCostGold;
                if (cost.wood) this.playerResources.wood -= cost.wood;
                if (cost.stone) this.playerResources.stone -= cost.stone;
                if (cost.food) this.playerResources.food -= cost.food;
            } else {
                this.enemyGold -= finalCostGold;
                if (cost.wood) this.enemyResources.wood -= cost.wood;
                if (cost.stone) this.enemyResources.stone -= cost.stone;
                if (cost.food) this.enemyResources.food -= cost.food;
            }
        }

        // Taikome patobulinimą
        if (isPlayer) {
            this.playerUpgrades[trackId] = nextLvl;
            if (nextLvl >= 5) {
                this.maxUpgradeCooldowns = this.maxUpgradeCooldowns || {};
                this.maxUpgradeCooldowns[trackId] = Date.now() + 500;
            }
        } else {
            this.enemyUpgrades[trackId] = nextLvl;
        }

        // Papildoma speciali logika pagal kryptį
        if (trackId === 'base_wall') {
            if (levelData.popBoost) {
                res.maxPop += levelData.popBoost;
                res.idlePop = (res.idlePop || 0) + 1;
            }
            if (levelData.baseHpBoost) {
                const base = isPlayer ? this.playerBase : this.enemyBase;
                base.maxHp += levelData.baseHpBoost;
                base.hp += levelData.baseHpBoost;
            }
            if (levelData.hasWall) {
                const wall = isPlayer ? this.playerWall : this.enemyWall;
                const era = isPlayer ? this.playerEra : this.enemyEra;
                const eraWallHp = (RTS_DATA.ERA_WALL_HP && RTS_DATA.ERA_WALL_HP[era]) ? RTS_DATA.ERA_WALL_HP[era] : (levelData.wallHp || 450);
                wall.active = true;
                wall.maxHp = eraWallHp;
                wall.hp = wall.maxHp;
                wall.rebuildTimer = 0;
            }
        } else if (trackId === 'workers_ai') {
            if (levelData.capacity) {
                this.gatherAmount = levelData.capacity;
            }
            if (nextLvl === 5 && isPlayer) {
                const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
                this.floatingTexts.push({
                    text: isEn ? `🤖 Smart AI Activated! All workers gather automatically non-stop!` : `🤖 Išmanusis AI Aktyvuotas! Visi darbininkai kasa automatiškai be sustojimo!`,
                    x: RTS_DATA.PLAYER_BASE_X + 80,
                    y: RTS_DATA.GROUND_Y - 180,
                    color: '#10b981',
                    life: 3.0,
                    maxLife: 3.0
                });
            }
        }

        if (isPlayer) {
            const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
            const trkName = (window.RTS_I18N && isEn) ? RTS_I18N.getUpgradeName(trackId) : track.name;
            const lvlName = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelName(trackId, nextLvl) : levelData.name;
            this.floatingTexts.push({
                text: isEn ? `✨ ${trkName} ⭐Level ${nextLvl}! (${lvlName})` : `✨ ${trkName} ⭐${nextLvl} lygis! (${lvlName})`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 150,
                color: '#38bdf8',
                life: 2.2,
                maxLife: 2.2
            });
            if (this.sound) this.sound.playTechUpgrade();
        }

        this.updateUI();
        if (window.renderDeckUpgrades) window.renderDeckUpgrades();
        return true;
    }

    // Suderinamumo palaikymas seniems iškvietimams
    isMaxPopMaxed() { return this.isUpgradeMaxed('base_wall'); }
    isGatheringMaxed() { return this.isUpgradeMaxed('workers_ai'); }
    isFortArmorMaxed() { return this.isUpgradeMaxed('military_academy'); }
    upgradeMaxPop() { return this.buyUpgrade('base_wall', true); }
    upgradeGathering() { return this.buyUpgrade('workers_ai', true); }
    upgradeFortArmor() { return this.buyUpgrade('military_academy', true); }

    // Greitas medžiagų pardavimas realiu laiku iš apatinio HUD skydelio
    sellMaterialQuick(type, amount = 10) {
        const rates = {
            wood: { amount: 10, gold: 20 },
            stone: { amount: 10, gold: 25 },
            food: { amount: 10, gold: 15 }
        };
        const r = rates[type] || { amount: 10, gold: 20 };
        const goldGain = Math.round((amount / r.amount) * r.gold);

        if (this.gameMode !== 'sandbox' && (this.playerResources[type] || 0) < amount) {
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            const resName = isEn 
                ? (type === 'wood' ? 'wood 🪵' : (type === 'stone' ? 'stone 🪨' : 'food 🌾'))
                : (type === 'wood' ? 'medienos 🪵' : (type === 'stone' ? 'akmens 🪨' : 'maisto 🌾'));
            this.floatingTexts.push({
                text: isEn ? `❌ Need ${resName}!` : `❌ Trūksta ${resName}!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 110,
                color: '#ef4444',
                life: 1.2,
                maxLife: 1.2
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (this.gameMode !== 'sandbox') {
            this.playerResources[type] -= amount;
        }
        this.playerGold += goldGain;

        const icon = type === 'wood' ? '🪵' : (type === 'stone' ? '🪨' : '🌾');
        this.floatingTexts.push({
            text: `+${goldGain}💰 (-${amount}${icon})`,
            x: RTS_DATA.PLAYER_BASE_X + 60,
            y: RTS_DATA.GROUND_Y - 130,
            color: '#10b981',
            life: 1.4,
            maxLife: 1.4
        });

        if (this.sound) this.sound.playCoin();
        this.updateUI();
        return true;
    }

    // Greitas medžiagų pirkimas už auksą realiu laiku iš apatinio HUD skydelio
    buyMaterialQuick(type, amount = 10) {
        const buyRates = {
            wood: { amount: 10, costGold: 25 },
            stone: { amount: 10, costGold: 30 },
            food: { amount: 10, costGold: 20 }
        };
        const r = buyRates[type] || { amount: 10, costGold: 25 };
        const goldCost = Math.round((amount / r.amount) * r.costGold);

        if (this.gameMode !== 'sandbox' && this.playerGold < goldCost) {
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            this.floatingTexts.push({
                text: isEn ? `❌ Need gold 💰 (${goldCost - this.playerGold} missing)!` : `❌ Trūksta aukso 💰 (${goldCost - this.playerGold} trūksta)!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 110,
                color: '#ef4444',
                life: 1.2,
                maxLife: 1.2
            });
            if (this.sound) this.sound.playError();
            return false;
        }

        if (this.gameMode !== 'sandbox') {
            this.playerGold -= goldCost;
        }
        this.playerResources[type] = (this.playerResources[type] || 0) + amount;

        const icon = type === 'wood' ? '🪵' : (type === 'stone' ? '🪨' : '🌾');
        this.floatingTexts.push({
            text: `+${amount}${icon} (-${goldCost}💰)`,
            x: RTS_DATA.PLAYER_BASE_X + 60,
            y: RTS_DATA.GROUND_Y - 130,
            color: '#38bdf8',
            life: 1.4,
            maxLife: 1.4
        });

        if (this.sound) this.sound.playCoin();
        this.updateUI();
        return true;
    }

    // ========================================================================
    // BOKŠTELIAI
    // ========================================================================
    buyTurretSlot(isPlayer) {
        const slots = isPlayer ? this.playerUnlockedSlots : this.enemyUnlockedSlots;
        if (slots >= 4) return false;

        const cost = RTS_DATA.SLOT_COSTS[slots];
        const gold = isPlayer ? this.playerGold : this.enemyGold;
        const res = isPlayer ? this.playerResources : this.enemyResources;

        if (this.gameMode !== 'sandbox' && (gold < cost.gold || (res.wood || 0) < cost.wood || (res.stone || 0) < cost.stone)) {
            if (isPlayer) {
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                const missing = [];
                if (gold < cost.gold) missing.push(`${cost.gold - gold}💰`);
                if ((res.wood || 0) < cost.wood) missing.push(`${cost.wood - Math.floor(res.wood || 0)}🪵`);
                if ((res.stone || 0) < cost.stone) missing.push(`${cost.stone - Math.floor(res.stone || 0)}🪨`);
                this.floatingTexts.push({
                    text: isEn ? `❌ Cannot unlock: Need for slot: ${missing.join(', ')}` : `❌ Negalima: Trūksta lizdui: ${missing.join(', ')}`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 110,
                    color: '#ef4444',
                    life: 1.5,
                    maxLife: 1.5
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        if (isPlayer) {
            if (this.gameMode !== 'sandbox') {
                this.playerGold -= cost.gold;
                this.playerResources.wood -= cost.wood;
                this.playerResources.stone -= cost.stone;
            }
            this.playerUnlockedSlots++;

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            this.floatingTexts.push({
                text: isEn ? `✅ Unlocked new turret slot #${this.playerUnlockedSlots}!` : `✅ Atrakintas naujas bokštelio lizdas #${this.playerUnlockedSlots}!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 130,
                color: '#38bdf8',
                life: 1.8,
                maxLife: 1.8
            });

            if (this.sound) this.sound.playSlotUnlock();
        } else {
            this.enemyGold -= cost.gold;
            this.enemyResources.wood -= cost.wood;
            this.enemyResources.stone -= cost.stone;
            this.enemyUnlockedSlots++;
        }
        return true;
    }

    buildTurret(isPlayer, slotIndex, turretId) {
        const unlocked = isPlayer ? this.playerUnlockedSlots : this.enemyUnlockedSlots;
        if (slotIndex < 0 || slotIndex >= unlocked) return false;

        const era = isPlayer ? this.playerEra : this.enemyEra;
        const eraData = RTS_DATA.AGES[era];
        const tData = eraData.turrets.find(t => t.id === turretId);
        if (!tData) return false;

        const gold = isPlayer ? this.playerGold : this.enemyGold;
        const res = isPlayer ? this.playerResources : this.enemyResources;
        const costGold = tData.cost.gold || 0;
        const costWood = tData.cost.wood || 0;
        const costStone = tData.cost.stone || 0;

        if (this.gameMode !== 'sandbox' && (gold < costGold || (res.wood || 0) < costWood || (res.stone || 0) < costStone)) {
            if (isPlayer) {
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                const missing = [];
                if (gold < costGold) missing.push(`${costGold - gold}💰`);
                if ((res.wood || 0) < costWood) missing.push(`${costWood - Math.floor(res.wood || 0)}🪵`);
                if ((res.stone || 0) < costStone) missing.push(`${costStone - Math.floor(res.stone || 0)}🪨`);
                this.floatingTexts.push({
                    text: isEn ? `❌ Cannot build: Need for turret: ${missing.join(', ')}` : `❌ Negalima: Trūksta bokšteliui: ${missing.join(', ')}`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 110,
                    color: '#ef4444',
                    life: 1.5,
                    maxLife: 1.5
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        if (isPlayer) {
            if (this.gameMode !== 'sandbox') {
                this.playerGold -= costGold;
                if (costWood > 0) this.playerResources.wood -= costWood;
                if (costStone > 0) this.playerResources.stone -= costStone;
            }
            this.playerTurrets[slotIndex] = new RTSTurret(slotIndex, tData, true);

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            const tName = (isEn && window.RTS_I18N) ? window.RTS_I18N.getTurretName(tData.id) : tData.name;
            this.floatingTexts.push({
                text: isEn ? `✅ Built turret: ${tName}!` : `✅ Pastatytas bokštelis: ${tData.name}!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 140,
                color: '#10b981',
                life: 1.8,
                maxLife: 1.8
            });

            if (this.sound) this.sound.playTurretBuild();
        } else {
            this.enemyGold -= costGold;
            if (costWood > 0) this.enemyResources.wood -= costWood;
            if (costStone > 0) this.enemyResources.stone -= costStone;
            this.enemyTurrets[slotIndex] = new RTSTurret(slotIndex, tData, false);
        }
        return true;
    }

    sellTurret(isPlayer, slotIndex) {
        const turrets = isPlayer ? this.playerTurrets : this.enemyTurrets;
        const turret = turrets[slotIndex];
        if (!turret) return false;

        const refundGold = Math.floor(turret.data.cost.gold * 0.6);
        if (isPlayer) {
            this.playerGold += refundGold;
            turrets[slotIndex] = null;

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            this.floatingTexts.push({
                text: isEn ? `✅ Sold turret: +${refundGold}💰!` : `✅ Parduotas bokštelis: +${refundGold}💰!`,
                x: RTS_DATA.PLAYER_BASE_X + 60,
                y: RTS_DATA.GROUND_Y - 120,
                color: '#f59e0b',
                life: 1.5,
                maxLife: 1.5
            });

            if (this.sound) this.sound.playBuySuccess();
        } else {
            this.enemyGold += refundGold;
            turrets[slotIndex] = null;
        }
        return true;
    }

    updateTurrets(dt) {
        for (let idx = 0; idx < 4; idx++) {
            const pt = this.playerTurrets[idx];
            if (pt) {
                const pos = RTS_DATA.getTurretSlotPosition(true, idx);
                pt.update(dt, this, pos);
            }
            const et = this.enemyTurrets[idx];
            if (et) {
                const pos = RTS_DATA.getTurretSlotPosition(false, idx);
                et.update(dt, this, pos);
            }
        }
    }

    // ========================================================================
    // KOVOS LOGIKA IR SVIEDINIAI
    // ========================================================================
    updateSoldiers(dt) {
        for (const s of this.soldiers) {
            s.update(dt, this);
        }

        this.soldiers = this.soldiers.filter(s => {
            if (s.hp <= 0) {
                this.spawnExplosion(s.x, RTS_DATA.GROUND_Y - 20);
                if (this.sound && this.sound.playUnitDeath) {
                    this.sound.playUnitDeath(s.type || (s.data ? s.data.type : 'melee'), s.era || 0, s.isHero, !!s.isMonster, s.x);
                }
                if (s.isPlayer) {
                    this.stats.losses++;
                    this.enemyGold += (s.data && s.data.bountyGold) ? s.data.bountyGold : 22;
                    this.enemyXp += (s.data && s.data.bountyXp) ? s.data.bountyXp : 45;
                    
                    // Užtikriname, kad mirus kariui gimimo ratuko laikmatis visada startuotų nuo 0.0s
                    this.popTimer = 0;
                } else {
                    this.stats.kills++;
                    const gGain = (s.data && s.data.bountyGold) ? s.data.bountyGold : 22;
                    const xpGain = (s.data && s.data.bountyXp) ? s.data.bountyXp : 45;
                    this.playerGold += gGain;
                    this.playerXp += xpGain;

                    this.floatingTexts.push({
                        text: `+${gGain}💰 +${xpGain}XP`,
                        x: s.x,
                        y: RTS_DATA.GROUND_Y - 45,
                        color: '#f59e0b',
                        life: 1.2,
                        maxLife: 1.2
                    });
                }
                return false;
            }
            return true;
        });
    }

    updateProjectiles(dt) {
        this.projectiles = this.projectiles.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.gravity) p.vy += p.gravity * dt;

            if (p.y >= RTS_DATA.GROUND_Y) {
                this.detonateProjectile(p);
                return false;
            }

            // 1. Pataikymas į karius
            for (const s of this.soldiers) {
                if (s.isPlayer === p.isPlayer) continue;
                const hitW = s.width * 0.5 + 14;
                const hitH = s.height * 0.5 + 16;
                if (Math.abs(p.x - s.x) < hitW && Math.abs(p.y - (RTS_DATA.GROUND_Y - s.height * 0.5)) < hitH) {
                    this.detonateProjectile(p, s);
                    return false;
                }
            }

            // 2. Pataikymas į darbininkus / kasėjus
            const targetWorkers = p.isPlayer ? this.enemyWorkers : this.playerWorkers;
            for (const w of targetWorkers) {
                if (w.state === 'DEAD' || w.state === 'FINISHED' || w.state === 'DYING') continue;
                const hitW = w.width * 0.5 + 12;
                const hitH = w.height * 0.5 + 16;
                if (Math.abs(p.x - w.x) < hitW && Math.abs(p.y - (RTS_DATA.GROUND_Y - w.height * 0.5)) < hitH) {
                    this.detonateProjectile(p, null, false, w);
                    return false;
                }
            }

            // Sienos smūgio patikra
            if (p.isPlayer && this.enemyWall && this.enemyWall.active && this.enemyWall.hp > 0) {
                if (p.x >= this.enemyWall.x - 10 && p.x <= this.enemyWall.x + this.enemyWall.width + 10) {
                    this.detonateProjectile(p, null, false, null, this.enemyWall);
                    return false;
                }
            } else if (!p.isPlayer && this.playerWall && this.playerWall.active && this.playerWall.hp > 0) {
                if (p.x <= this.playerWall.x + this.playerWall.width + 10 && p.x >= this.playerWall.x - 10) {
                    this.detonateProjectile(p, null, false, null, this.playerWall);
                    return false;
                }
            }

            if (p.isPlayer && p.x >= RTS_DATA.ENEMY_BASE_X - 10) {
                this.detonateProjectile(p, null, true);
                return false;
            } else if (!p.isPlayer && p.x <= RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 10) {
                this.detonateProjectile(p, null, true);
                return false;
            }

            return p.x > 0 && p.x < RTS_DATA.WORLD_WIDTH;
        });
    }

    detonateProjectile(p, directHitSoldier = null, isBaseHit = false, directHitWorker = null, directHitWall = null) {
        if (directHitWall) {
            this.applyDamage({ type: 'wall', target: directHitWall }, p.damage, p.isPlayer);
            return;
        }

        if (p.splash > 0) {
            if (this.sound) this.sound.playNoise(0.2, 0.4, 350);
            this.spawnExplosion(p.x, p.y);
            this.renderer.addShake(4);

            let hitAny = false;
            // Plotinė žala kariams
            for (const s of this.soldiers) {
                if (s.isPlayer === p.isPlayer) continue;
                const dist = Math.abs(s.x - p.x);
                if (dist <= p.splash) {
                    hitAny = true;
                    const dmg = Math.round(p.damage * (1 - (dist / p.splash) * 0.4));
                    this.applyDamage({ type: 'soldier', target: s }, dmg, p.isPlayer, p.shooter);
                }
            }

            // Plotinė žala darbininkams
            const targetWorkers = p.isPlayer ? this.enemyWorkers : this.playerWorkers;
            for (const w of targetWorkers) {
                if (w.state === 'DEAD' || w.state === 'FINISHED' || w.state === 'DYING') continue;
                const dist = Math.abs(w.x - p.x);
                if (dist <= p.splash) {
                    hitAny = true;
                    const dmg = Math.round(p.damage * (1 - (dist / p.splash) * 0.4));
                    this.applyDamage({ type: 'worker', target: w }, dmg, p.isPlayer);
                }
            }

            if (isBaseHit || (!hitAny && (p.isPlayer ? p.x >= RTS_DATA.ENEMY_BASE_X - 25 : p.x <= RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 25))) {
                const targetBase = p.isPlayer ? this.enemyBase : this.playerBase;
                this.applyDamage({ type: 'base', target: targetBase }, p.damage, p.isPlayer);
            }
        } else if (directHitWorker) {
            this.applyDamage({ type: 'worker', target: directHitWorker }, p.damage, p.isPlayer);
        } else if (directHitSoldier) {
            this.applyDamage({ type: 'soldier', target: directHitSoldier }, p.damage, p.isPlayer, p.shooter);
        } else if (isBaseHit) {
            const targetBase = p.isPlayer ? this.enemyBase : this.playerBase;
            this.applyDamage({ type: 'base', target: targetBase }, p.damage, p.isPlayer);
        } else {
            // Sviedinys palietė žemę prie pat priešo kojų (tolerancija 28px)
            let nearestEntity = null;
            let nearestDist = 28;

            for (const s of this.soldiers) {
                if (s.isPlayer === p.isPlayer) continue;
                const dist = Math.abs(s.x - p.x);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEntity = { type: 'soldier', target: s };
                }
            }

            const targetWorkers = p.isPlayer ? this.enemyWorkers : this.playerWorkers;
            for (const w of targetWorkers) {
                if (w.state === 'DEAD' || w.state === 'FINISHED' || w.state === 'DYING') continue;
                const dist = Math.abs(w.x - p.x);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEntity = { type: 'worker', target: w };
                }
            }

            if (nearestEntity) {
                this.applyDamage(nearestEntity, p.damage, p.isPlayer);
            }
        }
    }

    applyDamage(targetObj, damage, fromPlayer, attackerSoldier = null) {
        let isCrit = Math.random() < 0.16;
        let isBlocked = !isCrit && Math.random() < 0.10;

        // Taktinė gynyba ir didvyrių auros
        let armorMod = 0;
        if (!fromPlayer) {
            // Priešas atakuoja žaidėją: tikriname žaidėjo gynybos taktiką ir herojų auras
            if (this.tacticalStance === 'defend') armorMod += 0.35;
            else if (this.tacticalStance === 'retreat') armorMod += 0.15;

            // Ar šalia yra Paladinas arba Kiber-Titanas su skydais
            const targetX = (targetObj.target && targetObj.target.x) ? targetObj.target.x : RTS_DATA.PLAYER_BASE_X;
            for (const s of this.soldiers) {
                if (s.isPlayer && s.isHero && Math.abs(s.x - targetX) <= s.auraRadius) {
                    if (s.aura === 'shield' || s.aura === 'plasma_barrier') armorMod += s.auraValue;
                    if (s.aura === 'smoke') armorMod += 0.30;
                }
            }
        } else {
            // Žaidėjas atakuoja priešą: tikriname ar žaidėjas turi Mūšio Generolą (daugiau kritų)
            const attackerX = (targetObj.target && targetObj.target.x) ? targetObj.target.x : RTS_DATA.ENEMY_BASE_X;
            for (const s of this.soldiers) {
                if (s.isPlayer && s.isHero && s.aura === 'volley' && Math.abs(s.x - attackerX) <= s.auraRadius) {
                    isCrit = Math.random() < 0.38; // Dvigubai daugiau kritų!
                }
            }
        }

        const effectiveDmg = Math.round(damage * Math.max(0.3, 1 - armorMod));
        let finalDmg = isCrit ? Math.round(effectiveDmg * 1.6) : (isBlocked ? Math.round(effectiveDmg * 0.5) : effectiveDmg);

        if (fromPlayer && this.activePerks && this.activePerks.includes('critical_fury') && Math.random() < 0.25) {
            isCrit = true;
            finalDmg = Math.round(effectiveDmg * 2.5);
            this.renderer.addShake(4);
        }

        if (fromPlayer) {
            this.stats.damageDealt += finalDmg;
            if (isCrit && this.sound) {
                const hitX = targetObj.target ? (targetObj.target.x !== undefined ? targetObj.target.x : RTS_DATA.ENEMY_BASE_X) : RTS_DATA.ENEMY_BASE_X;
                this.sound.playCrit(hitX);
            }

            // Vampyrizmas: dalis žalos atstatoma kaip gyvybės
            if (this.activePerks && this.activePerks.includes('vampirism')) {
                const woundedFriendly = this.soldiers.filter(s => s.isPlayer && s.hp < s.maxHp);
                if (woundedFriendly.length > 0) {
                    const healUnit = woundedFriendly[0];
                    const healAmount = Math.round(finalDmg * 0.20);
                    healUnit.hp = Math.min(healUnit.maxHp, healUnit.hp + healAmount);
                }
            }
        } else {
            this.stats.damageTaken += finalDmg;
        }

        if (targetObj.type === 'soldier') {
            const s = targetObj.target;
            if (!s) return;
            s.hp -= finalDmg;
            s.hitFlash = 1.0;

            let textContent = `${finalDmg}`;
            let textColor = fromPlayer ? '#ffffff' : '#ff7675';
            if (isCrit) {
                textContent = `CRIT! ⚔️ ${finalDmg}`;
                textColor = '#fbbf24';
            } else if (isBlocked) {
                textContent = `BLOCKED 🛡️ ${finalDmg}`;
                textColor = '#38bdf8';
            }

            this.floatingTexts.push({
                text: textContent,
                x: s.x,
                y: RTS_DATA.GROUND_Y - s.height - 22,
                color: textColor,
                isCrit: isCrit,
                life: 0.9,
                maxLife: 0.9
            });

            if (s.hp <= 0 && attackerSoldier && attackerSoldier.registerKill) {
                attackerSoldier.registerKill(this);
            }

            if (fromPlayer) this.playerXp += Math.round(finalDmg * 0.4);
            else this.enemyXp += Math.round(finalDmg * 0.4);
        } else if (targetObj.type === 'worker') {
            const w = targetObj.target;
            if (!w) return;
            w.takeDamage(finalDmg, fromPlayer, this);
            if (fromPlayer) this.playerXp += Math.round(finalDmg * 0.3);
        } else if (targetObj.type === 'base') {
            const b = targetObj.target;
            if (!b) return;

            // Invulnerability shield check (Revive Ad reward)
            if (!fromPlayer && this.playerBase && this.playerBase.shieldTimer > 0) {
                this.floatingTexts.push({
                    text: `🛡️ SHIELDED!`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 140,
                    color: '#38bdf8',
                    life: 0.8,
                    maxLife: 0.8
                });
                return;
            }

            if (this.gameMode === 'monsters' && fromPlayer) {
                this.floatingTexts.push({
                    text: `🌌 -${finalDmg}`,
                    x: RTS_DATA.ENEMY_BASE_X + 70 + (Math.random() - 0.5) * 35,
                    y: RTS_DATA.GROUND_Y - 145,
                    color: '#c084fc',
                    life: 0.9,
                    maxLife: 0.9
                });
                this.playerXp += Math.round(finalDmg * 0.3);
                this.renderer.addShake(2);
                return;
            }

            // BEGALYBĖS / SMĖLIO DĖŽĖS REŽIME IR ŽAIDĖJO, IR PRIEŠO BAZĖ YRA 100% NEMIRTINGOS!
            if (this.isUnlimitedMode || this.gameMode === 'endless' || this.gameMode === 'sandbox') {
                const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
                this.floatingTexts.push({
                    text: isEn ? `🛡️ ∞ IMMORTAL!` : `🛡️ ∞ NEMIRTINGA!`, vx: (Math.random() - 0.5) * 20,
                    x: fromPlayer ? RTS_DATA.ENEMY_BASE_X + 50 : RTS_DATA.PLAYER_BASE_X + 50,
                    y: RTS_DATA.GROUND_Y - 140,
                    color: '#a855f7',
                    life: 1.0,
                    maxLife: 1.0
                });
                if (fromPlayer) this.playerXp += Math.round(finalDmg * 0.3);
                return;
            }

            b.hp = Math.max(0, b.hp - finalDmg);
            if (b.hp <= 0.01) {
                b.hp = 0;
                this.checkGameOver();
            }
            this.renderer.addShake(3);
            if (this.sound && this.sound.playBaseDamage) {
                this.sound.playBaseDamage(fromPlayer ? RTS_DATA.ENEMY_BASE_X : RTS_DATA.PLAYER_BASE_X);
            }

            this.floatingTexts.push({
                text: `-${finalDmg}`,
                x: fromPlayer ? RTS_DATA.ENEMY_BASE_X + 50 : RTS_DATA.PLAYER_BASE_X + 50,
                y: RTS_DATA.GROUND_Y - 140,
                color: '#e74c3c',
                life: 1.0,
                maxLife: 1.0
            });

            if (fromPlayer) this.playerXp += Math.round(finalDmg * 0.3);
            else this.enemyXp += Math.round(finalDmg * 0.3);
        } else if (targetObj.type === 'wall') {
            const wall = targetObj.target;
            if (!wall || !wall.active) return;
            wall.hp = Math.max(0, wall.hp - finalDmg);
            this.renderer.addShake(2);
            if (fromPlayer) this.playerXp += Math.round(finalDmg * 0.3);
            else this.enemyXp += Math.round(finalDmg * 0.3);

            this.floatingTexts.push({
                text: `🧱 -${finalDmg}`,
                x: wall.x + (Math.random() - 0.5) * 20,
                y: RTS_DATA.GROUND_Y - 120,
                color: '#e2e8f0',
                life: 0.8,
                maxLife: 0.8
            });

            if (wall.hp <= 0) {
                wall.active = false;
                wall.rebuildTimer = wall.maxRebuildTimer || 20;
                this.spawnExplosion(wall.x, RTS_DATA.GROUND_Y - 40);
                this.renderer.addShake(8);
                if (this.sound) this.sound.playNoise(0.4, 0.6, 120);
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                this.floatingTexts.push({
                    text: isEn ? `💥 WALL DESTROYED!` : `💥 SIENA NUGRIŪVA!`,
                    x: wall.x,
                    y: RTS_DATA.GROUND_Y - 160,
                    color: '#ef4444',
                    life: 2.0,
                    maxLife: 2.0
                });
            }
        }
    }

    updateUpgradesAndWalls(dt) {
        // 1. Bazės ir Sienos gijimas / auto-repair
        const baseLvl = this.getUpgradeLevel('base_wall', true);
        if (baseLvl >= 2 && this.playerBase.hp > 0.01 && this.playerBase.hp < this.playerBase.maxHp && !this.baseCollapsePending) {
            const regenRate = RTS_DATA.UPGRADES.base_wall.levels[baseLvl - 1].hpRegen || 2;
            this.playerBase.hp = Math.min(this.playerBase.maxHp, this.playerBase.hp + regenRate * dt);
        }

        // Žaidėjo siena
        if (this.playerWall) {
            if (this.playerWall.active) {
                if (this.playerWall.hp < this.playerWall.maxHp) {
                    this.playerWall.hp = Math.min(this.playerWall.maxHp, this.playerWall.hp + 12 * dt);
                }
            } else if (baseLvl >= 5 && this.playerWall.rebuildTimer > 0) {
                this.playerWall.rebuildTimer -= dt;
                if (this.playerWall.rebuildTimer <= 0) {
                    this.playerWall.active = true;
                    const eraHp = (RTS_DATA.ERA_WALL_HP && RTS_DATA.ERA_WALL_HP[this.playerEra]) ? RTS_DATA.ERA_WALL_HP[this.playerEra] : 450;
                    this.playerWall.maxHp = eraHp;
                    this.playerWall.hp = eraHp;
                    const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                    this.floatingTexts.push({
                        text: isEn ? `🛡️ Defensive wall rebuilt (${eraHp} HP)!` : `🛡️ Gynybinė siena atstatyta (${eraHp} HP)!`,
                        x: this.playerWall.x,
                        y: RTS_DATA.GROUND_Y - 160,
                        color: '#10b981',
                        life: 2.0,
                        maxLife: 2.0
                    });
                    if (this.sound) this.sound.playSlotUnlock();
                }
            }
        }

        // Priešo siena
        const enemyBaseLvl = this.getUpgradeLevel('base_wall', false);
        if (this.enemyWall) {
            if (this.enemyWall.active) {
                if (this.enemyWall.hp < this.enemyWall.maxHp) {
                    this.enemyWall.hp = Math.min(this.enemyWall.maxHp, this.enemyWall.hp + 12 * dt);
                }
            } else if (enemyBaseLvl >= 5 && this.enemyWall.rebuildTimer > 0) {
                this.enemyWall.rebuildTimer -= dt;
                if (this.enemyWall.rebuildTimer <= 0) {
                    this.enemyWall.active = true;
                    const eraHp = (RTS_DATA.ERA_WALL_HP && RTS_DATA.ERA_WALL_HP[this.enemyEra]) ? RTS_DATA.ERA_WALL_HP[this.enemyEra] : 450;
                    this.enemyWall.maxHp = eraHp;
                    this.enemyWall.hp = eraHp;
                }
            }
        }

        // 2. Pasyvios prekybos pajamos (Trade Economy)
        const tradeLvl = this.getUpgradeLevel('trade_economy', true);
        if (tradeLvl >= 2) {
            this.passiveIncomeTimer = (this.passiveIncomeTimer || 0) + dt;
            const interval = (tradeLvl >= 5) ? 3.0 : 4.0;
            if (this.passiveIncomeTimer >= interval) {
                this.passiveIncomeTimer = 0;
                const levelData = RTS_DATA.UPGRADES.trade_economy.levels[tradeLvl - 1];
                const goldYield = levelData.passiveGold || 12;
                this.playerGold += goldYield;

                if (tradeLvl >= 5) {
                    this.playerResources.wood += 5;
                    this.playerResources.stone += 5;
                    this.playerResources.food += 5;
                }

                if (Math.random() < 0.25) {
                    const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                    const incomeWord = isEn ? 'Income' : 'Pajamos';
                    this.floatingTexts.push({
                        text: tradeLvl >= 5 ? `🌟 +${goldYield}💰 +5🪵🪨🌾` : `💰 +${goldYield} ${incomeWord}`,
                        x: RTS_DATA.PLAYER_BASE_X - 40,
                        y: RTS_DATA.GROUND_Y - 50,
                        color: '#fbbf24',
                        life: 1.2,
                        maxLife: 1.2
                    });
                }
            }
        }

        // Priešo pasyvios prekybos pajamos (Trade Economy)
        const enemyTradeLvl = this.getUpgradeLevel('trade_economy', false);
        if (enemyTradeLvl >= 2) {
            this.enemyPassiveIncomeTimer = (this.enemyPassiveIncomeTimer || 0) + dt;
            const enemyInterval = (enemyTradeLvl >= 5) ? 3.0 : 4.0;
            if (this.enemyPassiveIncomeTimer >= enemyInterval) {
                this.enemyPassiveIncomeTimer = 0;
                const levelData = RTS_DATA.UPGRADES.trade_economy.levels[enemyTradeLvl - 1];
                const goldYield = levelData.passiveGold || 12;
                this.enemyGold += goldYield;

                if (enemyTradeLvl >= 5) {
                    this.enemyResources.wood += 5;
                    this.enemyResources.stone += 5;
                    this.enemyResources.food += 5;
                }
            }
        }

        // 3. Išmanusis darbininkų AI & Kasybos Valdymas (TIK KAI workers_ai >= 5)
        const workerLvl = this.getUpgradeLevel('workers_ai', true);
        const gatherCfg = this.autoGatherConfig || { enabled: true, woodLimit: 1, stoneLimit: 1, foodLimit: 1, goldLimit: 1, centerGold: true, centerGoldSafe: true, minReservedPop: 3 };
        const isAutoGatherActive = (workerLvl >= 5) && (gatherCfg.enabled !== false) && (this.autoGatherEnabled !== false);

        if (isAutoGatherActive) {
            this.smartWorkerTimer = (this.smartWorkerTimer || 0) + dt;
            if (this.smartWorkerTimer >= 0.4) {
                this.smartWorkerTimer = 0;

                const minReserved = Math.max(0, gatherCfg.minReservedPop !== undefined ? gatherCfg.minReservedPop : 2);
                let dispatchedCount = 0;

                // Leidžiame siųsti iki 2 darbininkų per ciklą, kad tolygiai ir sklandžiai užpildytų žaidėjo nustatytas darbo vietas
                while (dispatchedCount < 2) {
                    const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED');
                    const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
                    const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
                    const currentEmployed = activePlayerWorkers.length + livingPlayerSoldiers + queuedPlayerSoldiers;
                    const totalPlayerPop = (this.playerResources.idlePop || 0) + currentEmployed;

                    // Vartotojo rezervacijos taisyklė: minReserved yra bendra kariuomenės kvota.
                    // Jei jau yra kariai lauke, bazėje kariuomenei neliečiami lieka tik trūkstami iki kvotos (pvz. jei kvota 30, o karių 24 -> bazėje neliečiami tik 6):
                    const militaryQuota = minReserved;
                    const neededForMilitaryInBase = Math.max(0, militaryQuota - (livingPlayerSoldiers + queuedPlayerSoldiers));
                    const maxAllowedWorkers = Math.max(0, this.playerResources.maxPop - Math.max(militaryQuota, livingPlayerSoldiers + queuedPlayerSoldiers));

                    // Griežtas saugiklis: Jei bazėje laisvų gyventojų liko tik tiek, kiek reikia kariuomenei, arba darbininkų kiekis pasiekė leistiną limitą
                    if ((this.playerResources.idlePop || 0) <= neededForMilitaryInBase || activePlayerWorkers.length >= maxAllowedWorkers) {
                        break;
                    }

                    const woodActive = activePlayerWorkers.filter(w => w.role === 'wood').length;
                    const stoneActive = activePlayerWorkers.filter(w => w.role === 'stone').length;
                    const foodActive = activePlayerWorkers.filter(w => w.role === 'food').length;
                    const goldActive = activePlayerWorkers.filter(w => w.role === 'center_gold').length;

                    // Limitas pagal vartotojo nustatytas reikšmes (iki visų laisvų gyventojų)
                    const woodLimitTarget = Math.max(0, gatherCfg.woodLimit !== undefined ? gatherCfg.woodLimit : 1);
                    const stoneLimitTarget = Math.max(0, gatherCfg.stoneLimit !== undefined ? gatherCfg.stoneLimit : 1);
                    const foodLimitTarget = Math.max(0, gatherCfg.foodLimit !== undefined ? gatherCfg.foodLimit : 1);
                    const goldTargetLimit = Math.max(0, (gatherCfg.goldLimit !== undefined ? gatherCfg.goldLimit : (gatherCfg.centerGold ? 1 : 0)));

                    const enemySoldiersNearCenter = this.soldiers.some(s => !s.isPlayer && s.state !== 'DYING' && Math.abs(s.x - RTS_DATA.NEUTRAL_CACHE_X) <= 380);
                    const friendlySoldiersNearCenter = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && Math.abs(s.x - RTS_DATA.NEUTRAL_CACHE_X) <= 350).length;
                    const enemyCountNearCenter = this.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING' && Math.abs(s.x - RTS_DATA.NEUTRAL_CACHE_X) <= 380).length;

                    const isCenterSafe = (gatherCfg.centerGoldSafe === false) || (!enemySoldiersNearCenter) || (friendlySoldiersNearCenter >= enemyCountNearCenter);

                    const canWood = woodActive < woodLimitTarget;
                    const canStone = stoneActive < stoneLimitTarget;
                    const canFood = foodActive < foodLimitTarget;
                    const canGold = (goldTargetLimit > 0) && isCenterSafe && (goldActive < goldTargetLimit);

                    if (!canWood && !canStone && !canFood && !canGold) {
                        break;
                    }

                    // Parenkame tą resursą, kuriam labiausiai trūksta darbininkų iki nustatyto limito
                    let targetType = null;
                    const candidates = [];
                    if (canWood) candidates.push({ type: 'wood', deficit: woodLimitTarget - woodActive, amount: this.playerResources.wood || 0 });
                    if (canStone) candidates.push({ type: 'stone', deficit: stoneLimitTarget - stoneActive, amount: this.playerResources.stone || 0 });
                    if (canFood) candidates.push({ type: 'food', deficit: foodLimitTarget - foodActive, amount: this.playerResources.food || 0 });
                    if (canGold) candidates.push({ type: 'center_gold', deficit: goldTargetLimit - goldActive, amount: this.playerGold || 0 });

                    if (candidates.length > 0) {
                        candidates.sort((a, b) => (b.deficit - a.deficit) || (a.amount - b.amount));
                        targetType = candidates[0].type;
                    }

                    if (targetType) {
                        const ok = this.gatherResourceSilent(targetType);
                        if (!ok) break;
                        dispatchedCount++;
                    } else {
                        break;
                    }
                }
            }
        }

        // 4. Išmanioji Karo Taktika (TIK KAI military_academy >= 5)
        const militaryLvl = this.getUpgradeLevel('military_academy', true);
        const milCfg = this.autoMilitaryConfig || { enabled: false, mode: 'balanced', minReserveGold: 200, autoHero: true, maxSoldiers: 12 };

        if (militaryLvl >= 5 && milCfg.enabled) {
            this.autoMilitaryTimer = (this.autoMilitaryTimer || 0) + dt;
            if (this.autoMilitaryTimer >= 1.0) {
                this.autoMilitaryTimer = 0;

                const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
                const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
                const currentArmy = livingPlayerSoldiers + queuedPlayerSoldiers;

                // 1. Tikrinti nustatytą karių limitą (kad nebūtų samdoma be sustojimo):
                const maxSoldiersLimit = (milCfg.maxSoldiers !== undefined) ? milCfg.maxSoldiers : 12;
                if (currentArmy >= maxSoldiersLimit) {
                    return; // Pasiektas nustatytas karių skaičius – sustoti!
                }

                // 2. Tikrinti ar yra laisvas pilietis:
                if ((this.playerResources.idlePop || 0) <= 0) {
                    return; // Nėra laisvo piliečio – laukti, kol ratukas pagimdys naują gyventoją!
                }

                // 3. Tikrinti ar bendras užimtų žmonių skaičius (kariai + darbininkai) neviršija maksimalios populiacijos ribos:
                const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;
                if (currentArmy + activePlayerWorkers >= this.playerResources.maxPop) {
                    return;
                }

                const minGold = (milCfg.minReserveGold !== undefined) ? milCfg.minReserveGold : 0;
                const isQueueAvailable = this.spawnQueue.length < this.maxQueueSize;

                if (isQueueAvailable) {
                    const heroSpec = RTS_DATA.HEROES ? RTS_DATA.HEROES[this.playerEra] : null;
                    if (milCfg.autoHero && this.canSummonHero && this.canSummonHero() && (this.playerGold - (heroSpec ? heroSpec.costGold : 0) >= minGold)) {
                        this.summonHero();
                    } else {
                        const eraData = RTS_DATA.AGES[this.playerEra];
                        if (eraData && eraData.units) {
                            let targetUnitIdx = 0;
                            if (milCfg.mode === 'balanced') {
                                const heavyCount = this.soldiers.filter(s => s.isPlayer && s.type === 'heavy' && s.state !== 'DYING').length;
                                const rangedCount = this.soldiers.filter(s => s.isPlayer && s.type === 'ranged' && s.state !== 'DYING').length;
                                if (heavyCount === 0 && eraData.units[2] && (this.playerGold - eraData.units[2].costGold >= minGold)) {
                                    targetUnitIdx = 2;
                                } else if (rangedCount < 2 && eraData.units[1] && (this.playerGold - eraData.units[1].costGold >= minGold)) {
                                    targetUnitIdx = 1;
                                } else if (eraData.units[0] && (this.playerGold - eraData.units[0].costGold >= minGold)) {
                                    targetUnitIdx = 0;
                                } else if (eraData.units[1] && (this.playerGold - eraData.units[1].costGold >= minGold)) {
                                    targetUnitIdx = 1;
                                } else if (eraData.units[2] && (this.playerGold - eraData.units[2].costGold >= minGold)) {
                                    targetUnitIdx = 2;
                                }
                            } else if (milCfg.mode === 'melee') {
                                targetUnitIdx = 0;
                            } else if (milCfg.mode === 'ranged') {
                                targetUnitIdx = 1;
                            } else if (milCfg.mode === 'heavy') {
                                targetUnitIdx = 2;
                            }

                            const uData = eraData.units[targetUnitIdx];
                            if (uData && (this.playerGold - uData.costGold >= minGold)) {
                                this.trainSoldier(targetUnitIdx);
                            }
                        }
                    }
                }
            }
        }

        // 5. Išmanusis Auto-Turgus (TIK KAI trade_economy >= 5)
        const tradeCfg = this.autoTradeConfig || { enabled: false, woodThreshold: 250, stoneThreshold: 250, foodThreshold: 150 };

        if (tradeLvl >= 5 && tradeCfg.enabled) {
            this.autoTradeTimer = (this.autoTradeTimer || 0) + dt;
            if (this.autoTradeTimer >= 0.7) {
                this.autoTradeTimer = 0;
                const limits = {
                    wood: tradeCfg.woodThreshold || 250,
                    stone: tradeCfg.stoneThreshold || 250,
                    food: tradeCfg.foodThreshold || 150
                };

                ['wood', 'stone', 'food'].forEach(resType => {
                    const current = Math.floor(this.playerResources[resType] || 0);
                    const thresh = limits[resType];
                    if (current > thresh + 5) {
                        const excess = Math.min(75, current - thresh);
                        this.sellResourceAmount(resType, excess, true);
                    }
                });
            }
        }
    }

    // ========================================================================
    // ULTIMATES (RELIABLE CINEMATIC FIELD STRIKES)
    // ========================================================================
    triggerUltimate(isPlayer) {
        const era = isPlayer ? this.playerEra : this.enemyEra;
        const eraData = RTS_DATA.AGES[era];
        const ult = eraData.ultimate;

        const cd = isPlayer ? this.playerUltimateCooldown : this.enemyUltimateCooldown;
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        if (cd > 0) {
            if (isPlayer) {
                this.floatingTexts.push({
                    text: isEn ? `❌ Ultimate charging (${Math.ceil(cd)}s left)!` : `❌ Ultimate kraunasi (liko ${Math.ceil(cd)}s)!`,
                    x: RTS_DATA.PLAYER_BASE_X + 80,
                    y: RTS_DATA.GROUND_Y - 140,
                    color: '#ef4444',
                    life: 1.4,
                    maxLife: 1.4
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        const penaltyPerCast = 15; // Kiekvienas sekantis panaudojimas pailgina atvėsimą +15s
        if (isPlayer) {
            const casts = this.playerUltimateCasts || 0;
            this.playerUltimateCooldown = ult.cooldown + casts * penaltyPerCast;
            this.playerUltimateCasts = casts + 1;
            this.stats.ultimatesCast++;
        } else {
            const casts = this.enemyUltimateCasts || 0;
            this.enemyUltimateCooldown = ult.cooldown + casts * penaltyPerCast;
            this.enemyUltimateCasts = casts + 1;
        }

        if (this.sound) this.sound.playUltimate(era);
        this.renderer.addShake(15);

        const ultObj = {
            era: era,
            isPlayer: isPlayer,
            time: 0,
            duration: (era === 3) ? 4.5 : 4.0,
            damage: ult.damage,
            items: [],
            planeX: isPlayer ? -180 : RTS_DATA.WORLD_WIDTH + 180,
            laserX: isPlayer ? 500 : RTS_DATA.WORLD_WIDTH - 500
        };

        if (era === 3) {
            // Era 3: Bombonešis atskrenda pirmas, o bombos/raketos paleidžiamos tiesiai iš lėktuvo skrydžio metu!
            ultObj.planeSpeed = 740;
            ultObj.bombTimer = 0;
            ultObj.bombsDropped = 0;
            ultObj.maxBombs = 10;
        } else {
            const targetSoldiers = this.soldiers.filter(s => s.isPlayer !== isPlayer);
            const count = ult.meteorCount || 16;

            for (let i = 0; i < count; i++) {
                let targetX;
                if (targetSoldiers.length > 0 && i < targetSoldiers.length * 2) {
                    const s = targetSoldiers[i % targetSoldiers.length];
                    targetX = s.x + (Math.random() - 0.5) * 70;
                } else {
                    targetX = isPlayer
                        ? 550 + Math.random() * (RTS_DATA.ENEMY_BASE_X - 600)
                        : RTS_DATA.PLAYER_BASE_X + 150 + Math.random() * (1800 - RTS_DATA.PLAYER_BASE_X);
                }

                const startX = targetX - (isPlayer ? 220 : -220);
                const startY = -150 - Math.random() * 160;
                const angle = Math.atan2(RTS_DATA.GROUND_Y - startY, targetX - startX);

                ultObj.items.push({
                    x: startX,
                    y: startY,
                    startX: startX,
                    startY: startY,
                    targetX: targetX,
                    targetY: RTS_DATA.GROUND_Y - 5,
                    angle: angle,
                    speed: 680 + Math.random() * 200,
                    radius: 12 + Math.random() * 16,
                    hit: false,
                    delay: i * 0.12
                });
            }
        }

        this.activeUltimates.push(ultObj);

        const ultDisplayName = (isEn && window.RTS_I18N) ? (window.RTS_I18N.getUltimateName(era) || ult.name) : ult.name;
        this.floatingTexts.push({
            text: `⚡ ${ultDisplayName.toUpperCase()}!`,
            x: isPlayer ? RTS_DATA.PLAYER_BASE_X + 80 : RTS_DATA.ENEMY_BASE_X + 40,
            y: RTS_DATA.GROUND_Y - 200,
            color: '#f43f5e',
            life: 2.2,
            maxLife: 2.2
        });

        this.updateUI();
        return true;
    }

    updateUltimates(dt) {
        this.activeUltimates = this.activeUltimates.filter(ult => {
            ult.time += dt;

            // Era 3: Bombonešis (praskrenda ir meta bombas po savimi)
            if (ult.era === 3) {
                const dir = ult.isPlayer ? 1 : -1;
                ult.planeX += dir * (ult.planeSpeed || 740) * dt;

                const inBombZone = ult.isPlayer 
                    ? (ult.planeX >= 360 && ult.planeX <= RTS_DATA.ENEMY_BASE_X + 50)
                    : (ult.planeX <= RTS_DATA.WORLD_WIDTH - 360 && ult.planeX >= RTS_DATA.PLAYER_BASE_X - 50);

                if (inBombZone && (ult.bombsDropped || 0) < (ult.maxBombs || 10)) {
                    ult.bombTimer = (ult.bombTimer || 0) + dt;
                    if (ult.bombTimer >= 0.17) {
                        ult.bombTimer = 0;
                        ult.bombsDropped = (ult.bombsDropped || 0) + 1;

                        const dropX = ult.planeX;
                        const dropY = 82; // tiesiai po lėktuvo sparnais
                        const forwardLead = dir * (100 + Math.random() * 60);
                        const targetX = dropX + forwardLead;
                        const targetY = RTS_DATA.GROUND_Y - 5;
                        const angle = Math.atan2(targetY - dropY, targetX - dropX);

                        ult.items.push({
                            x: dropX,
                            y: dropY,
                            startX: dropX,
                            startY: dropY,
                            targetX: targetX,
                            targetY: targetY,
                            angle: angle,
                            speed: 540 + Math.random() * 60,
                            radius: 14,
                            hit: false,
                            delay: ult.time
                        });
                    }
                }
            }
            // Era 4: Palydovo Lazeris
            else if (ult.era === 4) {
                ult.laserX += (ult.isPlayer ? 1 : -1) * 420 * dt;
                for (const s of this.soldiers) {
                    if (s.isPlayer === ult.isPlayer) continue;
                    if (Math.abs(s.x - ult.laserX) < 90) {
                        this.applyDamage({ type: 'soldier', target: s }, ult.damage * dt * 2.5, ult.isPlayer);
                    }
                }
            }

            // Sviediniai (Meteorai, Strėlės, Bombos)
            for (const item of ult.items) {
                if (ult.time < item.delay || item.hit) continue;

                item.x += Math.cos(item.angle) * item.speed * dt;
                item.y += Math.sin(item.angle) * item.speed * dt;

                if (item.y >= item.targetY) {
                    item.hit = true;
                    this.spawnExplosion(item.x, RTS_DATA.GROUND_Y - 15);
                    this.renderer.addShake(6);
                    if (this.sound && this.sound.playUltimateImpact) {
                        this.sound.playUltimateImpact(ult.era, item.x);
                    }

                    for (const s of this.soldiers) {
                        if (s.isPlayer === ult.isPlayer) continue;
                        if (Math.abs(s.x - item.x) < 140) {
                            this.applyDamage({ type: 'soldier', target: s }, ult.damage, ult.isPlayer);
                        }
                    }
                }
            }

            return ult.time < ult.duration;
        });
    }

    // ========================================================================
    // EVOLIUCIJA & ŠAKOTOJI CIVILIZACIJA + RELIKVIJŲ DRAFTING
    // ========================================================================
    evolveEra(isPlayer = true) {
        const currentEra = isPlayer ? this.playerEra : this.enemyEra;
        const maxAllowedEra = (this.currentChallenge && this.currentChallenge.maxEra !== undefined) ? this.currentChallenge.maxEra : 4;
        if (currentEra >= maxAllowedEra) return false;

        const eraData = RTS_DATA.AGES[currentEra];
        const cost = eraData.evolveCost;
        const xp = isPlayer ? this.playerXp : this.enemyXp;
        const res = isPlayer ? this.playerResources : this.enemyResources;

        const isHardOrHigher = (this.difficulty === 'hard' || this.difficulty === 'nightmare' || this.difficulty === 'insane' || this.difficulty === 'extreme' || this.difficulty === 'Ekstremalus');
        const bypassEnemyCost = !isPlayer;
        if (this.gameMode !== 'sandbox' && !bypassEnemyCost && (xp < cost.xp || res.wood < cost.wood || res.stone < cost.stone || res.food < cost.food)) {
            if (isPlayer) {
                const missing = [];
                if (xp < cost.xp) missing.push(`${cost.xp - Math.floor(xp)}⭐XP`);
                if (res.wood < cost.wood) missing.push(`${cost.wood - Math.floor(res.wood)}🪵`);
                if (res.stone < cost.stone) missing.push(`${cost.stone - Math.floor(res.stone)}🪨`);
                if (res.food < cost.food) missing.push(`${cost.food - Math.floor(res.food)}🌾`);
                const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                this.floatingTexts.push({
                    text: isEn ? `❌ Cannot evolve: Need for evolution: ${missing.join(', ')}` : `❌ Negalima: Trūksta evoliucijai: ${missing.join(', ')}`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 90,
                    color: '#ef4444',
                    life: 1.6,
                    maxLife: 1.6
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        const nextEra = currentEra + 1;
        const nextBaseStats = RTS_DATA.BASE_STATS[nextEra];

        if (isPlayer) {
            // Atidarome didingą epochos ir civilizacijos šakų pasirinkimo modalą
            const branches = (RTS_DATA.BRANCHES && RTS_DATA.BRANCHES[nextEra]) ? RTS_DATA.BRANCHES[nextEra] : [];
            if (branches.length > 0) {
                this.openEvolutionModal(nextEra, cost);
            } else {
                this.confirmPlayerEvolution(nextEra, null, null, cost);
            }
            return true;
        } else {
            // Priešo AI automatiškai atsitiktinai pasirenka vieną iš šakų
            const enemyBranches = (RTS_DATA.BRANCHES && RTS_DATA.BRANCHES[nextEra]) ? RTS_DATA.BRANCHES[nextEra] : [];
            const enemyBranch = enemyBranches.length > 0 ? enemyBranches[Math.floor(Math.random() * enemyBranches.length)] : null;

            this.enemyResources.wood = Math.max(0, this.enemyResources.wood - cost.wood);
            this.enemyResources.stone = Math.max(0, this.enemyResources.stone - cost.stone);
            this.enemyResources.food = Math.max(0, this.enemyResources.food - cost.food);
            this.enemyEra = nextEra;

            if (this.isUnlimitedMode || this.difficulty === 'unlimited' || this.gameMode === 'sandbox' || isHardOrHigher) {
                this.enemyGold += 350 + nextEra * 200;
                this.enemyResources.wood += 60 + nextEra * 30;
                this.enemyResources.stone += 50 + nextEra * 25;
                this.enemyResources.food += 60 + nextEra * 30;
            } else {
                this.enemyGold += 150 + nextEra * 75;
                this.enemyResources.wood += 40 + nextEra * 20;
                this.enemyResources.stone += 35 + nextEra * 20;
                this.enemyResources.food += 40 + nextEra * 20;
            }

            // Kiekvienos epochos natūralus populiacijos prieaugis
            const prevBasePop = (RTS_DATA.ERA_BASE_MAX_POP && RTS_DATA.ERA_BASE_MAX_POP[nextEra - 1]) ? RTS_DATA.ERA_BASE_MAX_POP[nextEra - 1] : 8;
            const newBasePop = (RTS_DATA.ERA_BASE_MAX_POP && RTS_DATA.ERA_BASE_MAX_POP[nextEra]) ? RTS_DATA.ERA_BASE_MAX_POP[nextEra] : (8 + nextEra * 6);
            const eraPopBoost = Math.max(4, newBasePop - prevBasePop);
            this.enemyResources.maxPop += eraPopBoost;
            this.enemyResources.idlePop += Math.floor(eraPopBoost * 0.5);

            if (this.gameMode === 'endless' || this.gameMode === 'sandbox' || this.gameMode === 'monsters' || this.isUnlimitedMode) {
                this.enemyBase.maxHp = 9999999;
                this.enemyBase.hp = 9999999;
            } else {
                this.enemyBase.maxHp = nextBaseStats.maxHp;
                this.enemyBase.hp = nextBaseStats.maxHp;
            }

            // Priešo sienos sustiprinimas naujai epochai
            if (this.enemyWall && this.enemyWall.active) {
                const newWallHp = (RTS_DATA.ERA_WALL_HP && RTS_DATA.ERA_WALL_HP[nextEra]) ? RTS_DATA.ERA_WALL_HP[nextEra] : (450 + nextEra * 2000);
                const ratio = this.enemyWall.maxHp > 0 ? (this.enemyWall.hp / this.enemyWall.maxHp) : 1;
                this.enemyWall.maxHp = newWallHp;
                this.enemyWall.hp = Math.round(newWallHp * Math.max(0.6, ratio));
            }

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            const eraName = (isEn && window.RTS_I18N) ? window.RTS_I18N.getEraName(nextEra) : RTS_DATA.AGES[nextEra].name;
            const branchDisplayName = enemyBranch ? (isEn && enemyBranch.nameEn ? enemyBranch.nameEn : enemyBranch.name) : '';
            const branchName = branchDisplayName ? ` [${branchDisplayName}]` : '';
            this.floatingTexts.push({
                text: isEn ? `⚠️ Enemy evolved to: ${eraName}${branchName}!` : `⚠️ Priešas evoliucionavo į: ${RTS_DATA.AGES[nextEra].name}${branchName}!`,
                x: RTS_DATA.ENEMY_BASE_X + 40,
                y: RTS_DATA.GROUND_Y - 220,
                color: '#ef4444',
                life: 2.5,
                maxLife: 2.5
            });
            this.updateUI();
            return true;
        }
    }

    openEvolutionModal(nextEra, cost) {
        const modal = document.getElementById('rtsEvolutionModal');
        if (!modal) {
            this.confirmPlayerEvolution(nextEra, null, null, cost);
            return;
        }

        // Fone TIKRAI sustabdome žaidimo logiką ir karius (game loop state = PAUSED)
        this.wasPausedBeforeEvolution = (this.state === 'PAUSED');
        this.state = 'PAUSED';
        this.isPaused = true;
        if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.resume') : '▶️ Tęsti';

        this.pendingEvolution = { nextEra, cost, selectedBranch: null, selectedPerk: null };
        const branchesGrid = document.getElementById('evolutionBranchesGrid');
        const perksGrid = document.getElementById('evolutionPerksGrid');
        const confirmBtn = document.getElementById('confirmEvolutionBtn');

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const branches = RTS_DATA.BRANCHES[nextEra] || [];
        branchesGrid.innerHTML = '';
        branches.forEach((b, idx) => {
            const card = document.createElement('div');
            card.className = 'evolution-branch-card';
            if (idx === 0) {
                card.classList.add('selected');
                this.pendingEvolution.selectedBranch = b.id;
            }

            const branchName = (isEn && RTS_I18N.getBranchName(b.id)) ? RTS_I18N.getBranchName(b.id) : b.name;
            const branchSubtitle = (isEn && RTS_I18N.getBranchSubtitle(b.id)) ? RTS_I18N.getBranchSubtitle(b.id) : b.subtitle;
            const branchCastle = (isEn && RTS_I18N.getBranchCastleTitle(b.id)) ? RTS_I18N.getBranchCastleTitle(b.id) : b.castleTitle;
            const branchBadgesList = (isEn && RTS_I18N.getBranchBadges(b.id) && RTS_I18N.getBranchBadges(b.id).length) ? RTS_I18N.getBranchBadges(b.id) : (b.badges || []);
            const heroName = b.hero ? ((isEn && RTS_I18N.getBranchHeroName(b.id)) ? RTS_I18N.getBranchHeroName(b.id) : b.hero.name) : '';
            const heroAura = b.hero ? ((isEn && RTS_I18N.getBranchHeroAura(b.id)) ? RTS_I18N.getBranchHeroAura(b.id) : b.hero.aura) : '';

            const badgesHtml = branchBadgesList.map(badge => `<span class="branch-badge">${badge}</span>`).join('');
            const unitsHtml = (b.units || []).map(u => {
                const uName = isEn ? RTS_I18N.getBranchUnitName(u.name) : u.name;
                return `<div class="branch-unit-pill"><span class="u-icon">${u.icon}</span> <span class="u-name">${uName}</span></div>`;
            }).join('');
            const heroHtml = b.hero ? `
                <div class="branch-hero-box">
                    <div class="hero-header"><span class="hero-ico">${b.hero.icon}</span> <span>${heroName}</span></div>
                    <div class="hero-aura">${heroAura}</div>
                </div>
            ` : '';

            card.innerHTML = `
                <div class="branch-card-header" style="background: ${b.bannerGrad || 'rgba(30,41,59,0.8)'};">
                    <div class="branch-head-left">
                        <span class="branch-head-ico">${b.icon}</span>
                        <div>
                            <div class="branch-title" style="color: ${b.themeColor || '#fff'}">${branchName}</div>
                            <div class="branch-subtitle">${branchSubtitle}</div>
                        </div>
                    </div>
                </div>
                <div class="branch-card-body">
                    <div class="branch-badges-row">${badgesHtml}</div>

                    <div class="branch-castle-box">
                        <span style="font-size:13px;">🏛️</span>
                        <div class="castle-title">${branchCastle}</div>
                    </div>

                    <div class="units-grid-preview">${unitsHtml}</div>

                    ${heroHtml}
                </div>
            `;

            card.onclick = () => {
                branchesGrid.querySelectorAll('.evolution-branch-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.pendingEvolution.selectedBranch = b.id;
                this.checkEvolutionConfirmReady();
                if (this.sound) this.sound.playBranchSelect();
            };
            branchesGrid.appendChild(card);
        });

        // 3 atsitiktiniai perkai, kurie dar nebuvo aktyvuoti
        const availablePerks = (RTS_DATA.EVOLUTION_PERKS || []).filter(p => !this.activePerks.includes(p.id));
        const shuffled = [...availablePerks].sort(() => 0.5 - Math.random());
        const draftPerks = shuffled.slice(0, 3);

        perksGrid.innerHTML = '';
        draftPerks.forEach((p, idx) => {
            const card = document.createElement('div');
            card.className = 'evolution-perk-card';
            if (idx === 0) {
                card.classList.add('selected');
                this.pendingEvolution.selectedPerk = p.id;
            }
            const pName = (isEn && RTS_I18N.getPerkName(p.id)) ? RTS_I18N.getPerkName(p.id) : p.name;
            const pTag = (isEn && RTS_I18N.getPerkTag(p.id)) ? RTS_I18N.getPerkTag(p.id) : p.tag;
            const pDesc = (isEn && RTS_I18N.getPerkDesc(p.id)) ? RTS_I18N.getPerkDesc(p.id) : p.desc;
            card.innerHTML = `
                <div class="perk-icon">${p.icon}</div>
                <div class="perk-name">${pName}</div>
                <div class="perk-tag">${pTag}</div>
                <div class="perk-desc">${pDesc}</div>
            `;
            card.onclick = () => {
                perksGrid.querySelectorAll('.evolution-perk-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.pendingEvolution.selectedPerk = p.id;
                this.checkEvolutionConfirmReady();
                if (this.sound) this.sound.playPerkSelect();
            };
            perksGrid.appendChild(card);
        });

        confirmBtn.disabled = false;
        confirmBtn.onclick = () => {
            modal.classList.add('hidden');
            this.confirmPlayerEvolution(
                this.pendingEvolution.nextEra,
                this.pendingEvolution.selectedBranch,
                this.pendingEvolution.selectedPerk,
                this.pendingEvolution.cost
            );
        };

        const closeBtn = document.getElementById('closeEvolutionModalBtn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeEvolutionModal();
        }

        modal.classList.remove('hidden');
        if (this.sound) this.sound.playUpgradeSuccess();
    }

    closeEvolutionModal() {
        const modal = document.getElementById('rtsEvolutionModal');
        if (modal) modal.classList.add('hidden');
        if (!this.wasPausedBeforeEvolution) {
            this.state = 'PLAYING';
            this.isPaused = false;
            if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';
            this.lastFrameTime = performance.now();
        }
        if (this.sound) this.sound.playClick();
    }

    checkEvolutionConfirmReady() {
        const confirmBtn = document.getElementById('confirmEvolutionBtn');
        if (confirmBtn && this.pendingEvolution) {
            confirmBtn.disabled = !(this.pendingEvolution.selectedBranch && this.pendingEvolution.selectedPerk);
        }
    }

    confirmPlayerEvolution(nextEra, branchId, perkId, cost) {
        if (!this.wasPausedBeforeEvolution) {
            this.state = 'PLAYING';
            this.isPaused = false;
            if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';
            this.lastFrameTime = performance.now();
        }

        if (this.gameMode !== 'sandbox' && cost) {
            this.playerResources.wood -= cost.wood;
            this.playerResources.stone -= cost.stone;
            this.playerResources.food -= cost.food;
        }

        this.playerEra = nextEra;
        if (window.AdManager) {
            if (window.AdManager.happyTime) window.AdManager.happyTime();
            if (window.AdManager.reportProgress) window.AdManager.reportProgress((nextEra + 1) * 20);
        }
        const nextBaseStats = RTS_DATA.BASE_STATS[nextEra];

        // Kiekvienos epochos natūralus populiacijos prieaugis
        const prevBasePop = (RTS_DATA.ERA_BASE_MAX_POP && RTS_DATA.ERA_BASE_MAX_POP[nextEra - 1]) ? RTS_DATA.ERA_BASE_MAX_POP[nextEra - 1] : 8;
        const newBasePop = (RTS_DATA.ERA_BASE_MAX_POP && RTS_DATA.ERA_BASE_MAX_POP[nextEra]) ? RTS_DATA.ERA_BASE_MAX_POP[nextEra] : (8 + nextEra * 6);
        const eraPopBoost = Math.max(4, newBasePop - prevBasePop);
        this.playerResources.maxPop += eraPopBoost;
        this.playerResources.idlePop += Math.floor(eraPopBoost * 0.5);

        if (this.isUnlimitedMode || this.difficulty === 'unlimited' || this.gameMode === 'sandbox') {
            this.isUnlimitedMode = true;
            this.playerBase.maxHp = 9999999;
            this.playerBase.hp = 9999999;
        } else {
            let bonusHp = 0;
            if (this.activePerks.includes('granite_fort')) bonusHp += 500;
            this.playerBase.maxHp = nextBaseStats.maxHp + bonusHp;
            this.playerBase.hp = this.playerBase.maxHp;
        }

        // Sienos sustiprinimas naujai epochai
        if (this.playerWall && this.playerWall.active) {
            const newWallHp = (RTS_DATA.ERA_WALL_HP && RTS_DATA.ERA_WALL_HP[nextEra]) ? RTS_DATA.ERA_WALL_HP[nextEra] : (450 + nextEra * 2000);
            const ratio = this.playerWall.maxHp > 0 ? (this.playerWall.hp / this.playerWall.maxHp) : 1;
            this.playerWall.maxHp = newWallHp;
            this.playerWall.hp = Math.round(newWallHp * Math.max(0.6, ratio));
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            this.floatingTexts.push({
                text: isEn ? `🛡️ Wall reinforced to ${newWallHp} HP!` : `🛡️ Siena sustiprinta iki ${newWallHp} HP!`,
                x: this.playerWall.x,
                y: RTS_DATA.GROUND_Y - 140,
                color: '#38bdf8',
                life: 2.2,
                maxLife: 2.2
            });
        }

        // Aktyvuojame civilizacijos šaką
        if (branchId) {
            this.playerBranch = branchId;
            this.chosenBranches[nextEra] = branchId;
            const branchData = (RTS_DATA.BRANCHES[nextEra] || []).find(b => b.id === branchId);
            if (branchData && branchData.heroId && RTS_DATA.HEROES[branchData.heroId]) {
                RTS_DATA.HEROES[nextEra] = RTS_DATA.HEROES[branchData.heroId];
            }
        }

        // Aktyvuojame relikviją
        if (perkId && !this.activePerks.includes(perkId)) {
            this.activePerks.push(perkId);
            if (perkId === 'granite_fort') {
                this.playerBase.maxHp += 500;
                this.playerBase.hp = this.playerBase.maxHp;
            }
        }

        if (this.sound) {
            this.sound.playEvolve();
            this.sound.startMusic(nextEra);
        }

        this.renderer.addShake(22);
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const eraName = (isEn && window.RTS_I18N) ? window.RTS_I18N.getEraName(nextEra) : RTS_DATA.AGES[nextEra].name;
        this.floatingTexts.push({
            text: isEn ? `🌟 EVOLVED TO ${eraName.toUpperCase()}!` : `🌟 EVOLIUCIJA Į ${RTS_DATA.AGES[nextEra].name.toUpperCase()}!`,
            x: RTS_DATA.PLAYER_BASE_X + 80,
            y: RTS_DATA.GROUND_Y - 220,
            color: '#fbbf24',
            life: 3.5,
            maxLife: 3.5
        });

        this.checkLiveAchievements();
        this.saveGameState();
        this.updateUI();
    }

    // ========================================================================
    // OBJEKTŲ TELKINIAI (OBJECT POOLING - ZERO GARBAGE COLLECTION STUTTERS)
    // ========================================================================
    initPools() {
        this.maxParticles = 220;
        this.particlePool = [];
        this.particlePoolIndex = 0;
        for (let i = 0; i < this.maxParticles; i++) {
            this.particlePool.push({
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                radius: 4,
                color: '#ffffff',
                life: 0,
                maxLife: 1
            });
        }
        this.particles = this.particlePool;
        const self = this;
        this.particles.push = function(cfg) {
            return self.spawnParticle(cfg);
        };

        this.maxFloatingTexts = 45;
        this.floatingTextPool = [];
        this.floatingTextPoolIndex = 0;
        for (let i = 0; i < this.maxFloatingTexts; i++) {
            this.floatingTextPool.push({
                active: false,
                text: '',
                x: 0,
                y: 0,
                vx: 0,
                color: '#ffffff',
                isCrit: false,
                life: 0,
                maxLife: 1
            });
        }
        this.floatingTexts = this.floatingTextPool;
        this.floatingTexts.push = function(cfg) {
            return self.spawnFloatingText(cfg);
        };
    }

    resetPools() {
        if (!this.particlePool) {
            this.initPools();
            return;
        }
        for (let i = 0; i < this.maxParticles; i++) {
            this.particlePool[i].active = false;
        }
        this.particlePoolIndex = 0;
        for (let i = 0; i < this.maxFloatingTexts; i++) {
            this.floatingTextPool[i].active = false;
        }
        this.floatingTextPoolIndex = 0;
    }

    spawnParticle(cfg) {
        if (!this.particlePool) this.initPools();
        const p = this.particlePool[this.particlePoolIndex];
        this.particlePoolIndex = (this.particlePoolIndex + 1) % this.maxParticles;
        p.active = true;
        p.x = cfg.x || 0;
        p.y = cfg.y || 0;
        p.vx = cfg.vx || 0;
        p.vy = cfg.vy || 0;
        p.radius = cfg.radius || cfg.size || 4;
        p.color = cfg.color || '#f97316';
        p.life = cfg.life || 0.5;
        p.maxLife = cfg.maxLife || p.life;
        return p;
    }

    spawnFloatingText(cfg) {
        const isCritical = cfg.isError || cfg.isAlert || cfg.color === '#ef4444' || (cfg.text && (cfg.text.includes('❌') || cfg.text.includes('⚠️') || cfg.text.includes('💎')));
        if (!isCritical && this.settings && (this.settings.showFloatingTexts === false || this.settings.baseFloatingTexts === false)) {
            return { active: false };
        }
        if (!this.floatingTextPool) this.initPools();
        const t = this.floatingTextPool[this.floatingTextPoolIndex];
        this.floatingTextPoolIndex = (this.floatingTextPoolIndex + 1) % this.maxFloatingTexts;
        t.active = true;
        t.text = cfg.text || '';
        t.x = cfg.x || 0;
        t.y = cfg.y || 0;
        t.vx = cfg.vx || 0;
        t.color = cfg.color || '#ffffff';
        t.isCrit = !!cfg.isCrit;
        t.isError = !!cfg.isError;
        t.isAlert = !!cfg.isAlert;
        t.life = cfg.life || 0.9;
        t.maxLife = cfg.maxLife || t.life;
        return t;
    }

    spawnExplosion(x, y) {
        // Optimizuotas sprogimas su 11 ryškių dalelių vietoje 18 – nulis persidengimo stabdymo
        for (let i = 0; i < 11; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 30 + Math.random() * 140;
            this.spawnParticle({
                x: x,
                y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 20,
                radius: 3 + Math.random() * 5,
                color: Math.random() < 0.6 ? '#f39c12' : '#e74c3c',
                life: 0.35 + Math.random() * 0.25,
                maxLife: 0.6
            });
        }
    }

    updateParticles(dt) {
        if (!this.particlePool) return;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particlePool[i];
            if (!p.active) continue;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
            }
        }
    }

    updateFloatingTexts(dt) {
        if (!this.floatingTextPool) return;
        const suppressNormal = this.settings && (this.settings.showFloatingTexts === false || this.settings.baseFloatingTexts === false);
        for (let i = 0; i < this.maxFloatingTexts; i++) {
            const t = this.floatingTextPool[i];
            if (!t.active) continue;
            if (suppressNormal && !t.isError && !t.isAlert && !(t.text && (t.text.includes('❌') || t.text.includes('💎')))) {
                t.active = false;
                continue;
            }
            t.y -= 32 * dt;
            if (t.vx) t.x += t.vx * dt;
            t.life -= dt;
            if (t.life <= 0) {
                t.active = false;
            }
        }
    }

    // ========================================================================
    // PASIEKIMŲ TIKRINIMAS REALIU LAIKU
    // ========================================================================
    checkLiveAchievements() {
        if (this.stats.kills >= 1) this.unlockAchievement('first_blood');
        if (this.stats.kills >= 25) this.unlockAchievement('slayer_25');
        if (this.stats.kills >= 100) this.unlockAchievement('slayer_100');
        if (this.playerEra >= 1) this.unlockAchievement('first_evolve');
        if (this.playerEra >= 4) this.unlockAchievement('future_ascension');
        if (this.stats.ultimatesCast >= 1) this.unlockAchievement('meteor_strike');
        if (this.stats.ultimatesCast >= 5) this.unlockAchievement('ult_master');
        if (this.playerTurrets.filter(Boolean).length >= 4) this.unlockAchievement('turret_master');
        if (this.playerGold >= 3000) this.unlockAchievement('rich_hoarder');
        if (this.playerResources.maxPop >= 14) this.unlockAchievement('pop_boom');
        if (this.stats.playerUnitsSpawned['dino_rider'] >= 5) this.unlockAchievement('dino_fury');
        if (this.stats.playerUnitsSpawned['tank'] >= 5) this.unlockAchievement('tank_rush');
        if (this.stats.playerUnitsSpawned['titan_mech'] >= 1) this.unlockAchievement('titan_mech_spawn');
        if (this.gameMode === 'endless') {
            if (this.survivalWave >= 5) this.unlockAchievement('endless_wave_5');
            if (this.survivalWave >= 15) this.unlockAchievement('endless_wave_15');
        }
    }

    // ========================================================================
    // ŽAIDIMO PABAIGA IR STATISTIKOS APDOROJIMAS
    // ========================================================================
    // ========================================================================
    // DIDVYRIŲ AKTYVIOS GALIOS (HERO ACTIVE SKILLS WITH COOLDOWNS & VFX)
    // ========================================================================
    triggerHeroSkill(isPlayer = true) {
        if (this.state !== 'PLAYING') return false;

        const hero = this.soldiers.find(s => s.isPlayer === isPlayer && s.isHero && s.state !== 'DYING');
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        if (!hero) {
            if (isPlayer) {
                this.floatingTexts.push({
                    text: isEn ? `⚠️ Hero is not on battlefield! Train your hero.` : `⚠️ Didvyrio nėra mūšio lauke! Pasamdykite didvyrį.`,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 90,
                    color: '#ef4444',
                    life: 1.6,
                    maxLife: 1.6
                });
                if (this.sound) this.sound.playError();
            }
            return false;
        }

        if (hero.heroSkillCooldown > 0) {
            if (isPlayer) {
                this.floatingTexts.push({
                    text: isEn ? `⏳ Hero ability cooldown: ${Math.ceil(hero.heroSkillCooldown)}s` : `⏳ Didvyrio galia atsistato: ${Math.ceil(hero.heroSkillCooldown)}s`,
                    x: hero.x,
                    y: RTS_DATA.GROUND_Y - hero.height - 24,
                    color: '#f59e0b',
                    life: 1.2,
                    maxLife: 1.2
                });
                if (this.sound) this.sound.playClick();
            }
            return false;
        }

        const hData = hero.data;
        const skill = hData.activeSkill || { id: 'generic_smite', name: 'Super Smūgis', cooldown: 15, damage: 300 };

        // Paleidžiame garsą ir ekrano drebėjimą
        if (this.sound) this.sound.playHeroSkill(skill.id, hero.x);
        this.renderer.addShake(14);

        // Skirtingų didvyrių unikalios mechanikos
        if (skill.id === 'ancestral_heal') {
            // 🌿 Šamanas: AOE gydymas + priešų atstūmimas
            for (const ally of this.soldiers) {
                if (ally.isPlayer === isPlayer && Math.abs(ally.x - hero.x) <= skill.radius) {
                    ally.hp = Math.min(ally.maxHp, ally.hp + skill.healAmount);
                }
            }
            for (const enemy of this.soldiers) {
                if (enemy.isPlayer !== isPlayer && Math.abs(enemy.x - hero.x) <= skill.radius) {
                    enemy.x += (isPlayer ? 1 : -1) * skill.knockback;
                    this.applyDamage({ type: 'soldier', target: enemy }, 95, isPlayer, hero);
                }
            }
            // Gydymo dalelės
            for (let i = 0; i < 20; i++) {
                this.particles.push({
                    x: hero.x + (Math.random() - 0.5) * skill.radius * 1.5,
                    y: RTS_DATA.GROUND_Y - Math.random() * 60,
                    vx: (Math.random() - 0.5) * 40,
                    vy: -40 - Math.random() * 40,
                    size: 4 + Math.random() * 4,
                    color: '#34d399',
                    life: 1.2,
                    maxLife: 1.2
                });
            }
        } else if (skill.id === 'holy_smite') {
            // ⚔️ Paladinas: Šventasis skydas + kirtis
            hero.heroInvulnerableTime = skill.shieldDuration || 4.5;
            for (const enemy of this.soldiers) {
                if (enemy.isPlayer !== isPlayer && Math.abs(enemy.x - hero.x) <= skill.radius) {
                    this.applyDamage({ type: 'soldier', target: enemy }, skill.damage, isPlayer, hero);
                }
            }
            // Šviesos sprogimas
            for (let i = 0; i < 25; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 60 + Math.random() * 120;
                this.particles.push({
                    x: hero.x,
                    y: RTS_DATA.GROUND_Y - hero.height * 0.5,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    size: 5 + Math.random() * 4,
                    color: '#fbbf24',
                    life: 1.0,
                    maxLife: 1.0
                });
            }
        } else if (skill.id === 'shadow_dash') {
            // 🌪️ Kensėjus: Šešėlių šuolis per priešus
            const oldX = hero.x;
            const newX = isPlayer ? Math.min(RTS_DATA.ENEMY_BASE_X - 40, hero.x + skill.dashDist) : Math.max(RTS_DATA.PLAYER_BASE_X + 160, hero.x - skill.dashDist);
            hero.x = newX;
            for (const enemy of this.soldiers) {
                if (enemy.isPlayer !== isPlayer) {
                    const minX = Math.min(oldX, newX) - 20;
                    const maxX = Math.max(oldX, newX) + 20;
                    if (enemy.x >= minX && enemy.x <= maxX) {
                        enemy.bleedTimer = skill.bleedDuration || 4.0;
                        enemy.bleedDps = 40;
                        this.applyDamage({ type: 'soldier', target: enemy }, skill.damage, isPlayer, hero);
                    }
                }
            }
            for (let i = 0; i < 30; i++) {
                this.particles.push({
                    x: oldX + (newX - oldX) * (i / 30),
                    y: RTS_DATA.GROUND_Y - 20 + (Math.random() - 0.5) * 30,
                    vx: (Math.random() - 0.5) * 30,
                    vy: (Math.random() - 0.5) * 30,
                    size: 4 + Math.random() * 3,
                    color: '#ef4444',
                    life: 0.8,
                    maxLife: 0.8
                });
            }
        } else if (skill.id === 'cannon_barrage') {
            // 💣 Generolas: 4 artilerijos bombų salva
            for (let k = 0; k < skill.count; k++) {
                const targetX = hero.x + (isPlayer ? 1 : -1) * (110 + k * 70);
                setTimeout(() => {
                    if (this.state !== 'PLAYING') return;
                    for (const enemy of this.soldiers) {
                        if (enemy.isPlayer !== isPlayer && Math.abs(enemy.x - targetX) <= skill.splash) {
                            this.applyDamage({ type: 'soldier', target: enemy }, skill.damage, isPlayer, hero);
                        }
                    }
                    this.spawnExplosion(targetX, RTS_DATA.GROUND_Y - 20);
                    this.renderer.addShake(6);
                }, k * 140);
            }
        } else if (skill.id === 'acid_cauldron') {
            // 🧪 Alchemikas: Nuodų katilas
            const splashX = hero.x + (isPlayer ? 1 : -1) * 140;
            for (let k = 0; k < 6; k++) {
                setTimeout(() => {
                    if (this.state !== 'PLAYING') return;
                    for (const enemy of this.soldiers) {
                        if (enemy.isPlayer !== isPlayer && Math.abs(enemy.x - splashX) <= skill.radius) {
                            this.applyDamage({ type: 'soldier', target: enemy }, Math.round(skill.dps * 0.9), isPlayer, hero);
                        }
                    }
                    for (let i = 0; i < 8; i++) {
                        this.particles.push({
                            x: splashX + (Math.random() - 0.5) * skill.radius,
                            y: RTS_DATA.GROUND_Y - Math.random() * 25,
                            vx: (Math.random() - 0.5) * 20,
                            vy: -20 - Math.random() * 25,
                            size: 4 + Math.random() * 4,
                            color: '#10b981',
                            life: 0.7,
                            maxLife: 0.7
                        });
                    }
                }, k * 250);
            }
        } else if (skill.id === 'missile_barrage') {
            // 🚀 Komandosas: 5 mikro-raketos
            for (let k = 0; k < skill.count; k++) {
                setTimeout(() => {
                    if (this.state !== 'PLAYING') return;
                    const enemies = this.soldiers.filter(s => s.isPlayer !== isPlayer && s.state !== 'DYING');
                    const targetX = enemies.length > 0 ? enemies[Math.min(k, enemies.length - 1)].x : (isPlayer ? RTS_DATA.ENEMY_BASE_X : RTS_DATA.PLAYER_BASE_X);
                    const p = new RTSProjectile(
                        isPlayer,
                        hero.x,
                        RTS_DATA.GROUND_Y - 45,
                        targetX,
                        RTS_DATA.GROUND_Y - 30,
                        skill.damage,
                        'rocket',
                        680,
                        skill.splash
                    );
                    this.projectiles.push(p);
                }, k * 100);
            }
        } else if (skill.id === 'emp_blast') {
            // ⚡ Dronai: EMP Impulsas ir paralyžius
            for (const enemy of this.soldiers) {
                if (enemy.isPlayer !== isPlayer && Math.abs(enemy.x - hero.x) <= skill.radius) {
                    enemy.isStunned = skill.stunDuration || 3.5;
                    this.applyDamage({ type: 'soldier', target: enemy }, skill.damage, isPlayer, hero);
                }
            }
            for (let i = 0; i < 35; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 70 + Math.random() * 140;
                this.particles.push({
                    x: hero.x,
                    y: RTS_DATA.GROUND_Y - hero.height * 0.5,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    size: 4 + Math.random() * 4,
                    color: '#00ffff',
                    life: 0.9,
                    maxLife: 0.9
                });
            }
        } else if (skill.id === 'ion_hyperbeam') {
            // 🦾 Mechas: Kiaurai skrodžiantis Jonų Hiper-Spindulys
            const beamEndX = isPlayer ? hero.x + skill.beamLength : hero.x - skill.beamLength;
            for (const enemy of this.soldiers) {
                if (enemy.isPlayer !== isPlayer) {
                    const minX = Math.min(hero.x, beamEndX);
                    const maxX = Math.max(hero.x, beamEndX);
                    if (enemy.x >= minX && enemy.x <= maxX) {
                        this.applyDamage({ type: 'soldier', target: enemy }, skill.damage, isPlayer, hero);
                    }
                }
            }
            // Lazerio dalelės
            for (let i = 0; i < 45; i++) {
                this.particles.push({
                    x: hero.x + (beamEndX - hero.x) * (i / 45),
                    y: RTS_DATA.GROUND_Y - 45 + (Math.random() - 0.5) * 20,
                    vx: (isPlayer ? 1 : -1) * (150 + Math.random() * 100),
                    vy: (Math.random() - 0.5) * 35,
                    size: 5 + Math.random() * 5,
                    color: '#00ffff',
                    life: 0.7,
                    maxLife: 0.7
                });
            }
        } else if (skill.id === 'swarm_frenzy') {
            // 🧬 Bio: 3 rūgštiniai parazitai + haste
            for (const ally of this.soldiers) {
                if (ally.isPlayer === isPlayer && Math.abs(ally.x - hero.x) <= 300) {
                    ally.attackSpeed = Math.max(0.4, ally.attackSpeed * (1 - skill.hasteBonus));
                }
            }
            for (let i = 0; i < skill.broodlings; i++) {
                const broodData = { id: 'broodling', name: 'Parazitas', hp: 280, damage: 45, attackSpeed: 0.7, speed: 65, range: 40, type: 'melee' };
                const brood = new RTSSoldier(isPlayer, broodData, hero.era, hero.x + (isPlayer ? 1 : -1) * (20 + i * 18));
                this.soldiers.push(brood);
            }
        }

        // Būsena ir atvėsimas
        hero.heroSkillCooldown = skill.cooldown || 15.0;

        const skillDisplayName = (isEn && window.RTS_I18N && typeof hero.era !== 'undefined') ? (window.RTS_I18N.getHeroSkillName(hero.era) || skill.name) : skill.name;
        this.floatingTexts.push({
            text: `👑 ${skillDisplayName.toUpperCase()}!`,
            x: hero.x,
            y: RTS_DATA.GROUND_Y - hero.height - 30,
            color: '#00f2fe',
            life: 2.2,
            maxLife: 2.2
        });

        this.updateUI();
        return true;
    }

    // ========================================================================
    // BAZĖS FIZINĖS GRIŪTIES EFEKTAS (DESTRUCTION DEBRIS FX)
    // ========================================================================
    triggerBaseCollapseFX(isPlayer) {
        const targetX = isPlayer ? (RTS_DATA.PLAYER_BASE_X + 65) : (RTS_DATA.ENEMY_BASE_X + 65);
        if (this.sound && this.sound.playBaseCollapse) this.sound.playBaseCollapse(targetX);
        this.renderer.addShake(6);

        // 50+ krintančių ir besisukančių nuolaužų dalelių
        for (let i = 0; i < 55; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 220;
            const colors = ['#475569', '#334155', '#1e293b', '#78350f', '#94a3b8', '#dc2626', '#f59e0b'];
            this.particles.push({
                x: targetX + (Math.random() - 0.5) * 80,
                y: RTS_DATA.GROUND_Y - 40 - Math.random() * 120,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 80,
                size: 5 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.8 + Math.random() * 1.0,
                maxLife: 2.8,
                gravity: 380,
                bounce: true
            });
        }
    }

    checkGameOver() {
        if (this.state !== 'PLAYING') return;

        // Challenge condition check
        if (this.gameMode === 'challenge' && this.currentChallenge) {
            const c = this.currentChallenge;
            if (c.surviveTime && this.gameTime >= c.surviveTime) {
                this.endGame(true, `Išgyvenote ${c.surviveTime}s! Iššūkis įveiktas!`);
                return;
            }
            if (c.targetEra && this.playerEra >= c.targetEra) {
                this.endGame(true, `Pasiekėte ${c.targetEra + 1} epochą per ${Math.floor(this.gameTime)}s!`);
                return;
            }
            if (c.timeLimit && this.gameTime >= c.timeLimit) {
                this.endGame(false, `Baigėsi laikas! Iššūkis neįveiktas.`);
                return;
            }
        }

        if (this.playerBase.hp <= 0.01 && !this.baseCollapsePending) {
            this.playerBase.hp = 0;
            this.baseCollapsePending = { isPlayer: true, timer: 0, duration: 1.1, message: 'Jūsų bazė buvo sunaikinta!' };
            this.triggerBaseCollapseFX(true);
            this.renderer.setCamera(0);
        } else if (this.enemyBase.hp <= 0.01 && !this.baseCollapsePending && this.gameMode !== 'endless' && this.gameMode !== 'monsters') {
            this.enemyBase.hp = 0;
            this.baseCollapsePending = { isPlayer: false, timer: 0, duration: 1.1, message: 'Priešo bazė buvo sunaikinta!' };
            this.triggerBaseCollapseFX(false);
            this.renderer.setCamera(RTS_DATA.WORLD_WIDTH - 1280);
        }
    }

    updateEndGameState(dt) {
        // Leisti dalelėms, dūmams ir skraidantiems tekstams pabaigti savo animaciją po pergalės / pralaimėjimo
        this.updateParticles(dt);
        this.updateFloatingTexts(dt);
    }

    endGame(isVictory, message) {
        this.state = isVictory ? 'VICTORY' : 'DEFEAT';
        this.battleFinished = true;
        if (window.AdManager && window.AdManager.gameplayStop) window.AdManager.gameplayStop();
        if (isVictory && window.AdManager) {
            if (window.AdManager.happyTime) window.AdManager.happyTime();
            if (window.AdManager.reportProgress) window.AdManager.reportProgress(100);
        }
        this.isPaused = false;
        this.clearSavedGame();
        this.updateResumeButtonUI();

        // Game Over metu kovos muzika visiškai nutyla
        if (this.sound) {
            this.sound.stopMusic();
            this.sound.setBattleTension(0);
        }

        // Paslėpti visus galimus atvirus modalus, kad nesidubliuotų ir nepersidengtų
        if (this.ui && this.ui.pauseOverlay) this.ui.pauseOverlay.classList.add('hidden');
        if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';
        const baseHubModal = document.getElementById('rtsBaseHubModal');
        if (baseHubModal) baseHubModal.classList.add('hidden');
        const settingsModal = document.getElementById('rtsSettingsModal');
        if (settingsModal) settingsModal.classList.add('hidden');
        const helpModal = document.getElementById('rtsHelpModal');
        if (helpModal) helpModal.classList.add('hidden');

        if (isVictory) {
            this.highScores.victories = (this.highScores.victories || 0) + 1;
            if (this.playerBase.hp / this.playerBase.maxHp < 0.15) this.unlockAchievement('clutch_victory');
            if (this.gameTime <= 300) this.unlockAchievement('speed_demon');
            if (this.playerBase.hp / this.playerBase.maxHp >= 0.90) this.unlockAchievement('flawless_defense');
            if (this.gameMode === 'challenge') this.unlockAchievement('challenge_first');
            if (this.sound && this.sound.playVictory) this.sound.playVictory();
            else if (this.sound) this.sound.playLevelUp();
        } else {
            if (this.sound && this.sound.playDefeat) this.sound.playDefeat();
            else if (this.sound) this.sound.playError();
        }

        if (this.gameMode === 'endless') {
            if (this.survivalWave > (this.highScores.endlessWave || 0)) {
                this.highScores.endlessWave = this.survivalWave;
            }
        }

        if (this.gameMode === 'monsters') {
            if (this.monsterWave > (this.highScores.monsterWave || 0)) {
                this.highScores.monsterWave = this.monsterWave;
            }
        }

        this.highScores.totalKills = (this.highScores.totalKills || 0) + this.stats.kills;
        this.saveData();

        this.renderGameOverModal(isVictory, message);
    }

    renderGameOverModal(isVictory, message) {
        const modal = document.getElementById('rtsGameOverModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        const titleEl = document.getElementById('rtsGameOverTitle');
        const descEl = document.getElementById('rtsGameOverDesc');
        const statsEl = document.getElementById('rtsGameOverStatsGrid');

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';

        if (titleEl) {
            titleEl.innerText = isVictory ? (isEn ? '🏆 VICTORY!' : '🏆 PERGALĖ!') : (isEn ? '💀 DEFEAT' : '💀 PRALAIMĖJIMAS');
            titleEl.className = isVictory ? 'victory-title' : 'defeat-title';
            titleEl.style.color = isVictory ? '#2ecc71' : '#ef4444';
        }

        let customDesc = message || (isVictory ? (isEn ? 'Enemy base was completely destroyed!' : 'Priešo bazė buvo visiškai sunaikinta!') : (isEn ? 'Your castle base was destroyed!' : 'Jūsų bazė buvo sunaikinta!'));
        if (this.gameMode === 'monsters') {
            const wavesSurvived = Math.max(0, this.monsterWave - 1);
            customDesc = isEn ? `👾 Monster waves survived: ${wavesSurvived}! ${message || ''}` : `👾 Atlaikyta monstrų bangų: ${wavesSurvived}! ${message || ''}`;
        } else if (this.gameMode === 'endless') {
            const wavesSurvived = Math.max(0, this.survivalWave - 1);
            customDesc = isEn ? `🌊 Endless waves survived: ${wavesSurvived}! ${message || ''}` : `🌊 Atlaikyta begalinių bangų: ${wavesSurvived}! ${message || ''}`;
        }
        if (descEl) descEl.innerText = customDesc;

        // MVP būrio suradimas pagal pavadinimą
        let mvpName = isEn ? 'None' : 'Nėra';
        let maxSpawn = 0;
        for (const [id, count] of Object.entries(this.stats.playerUnitsSpawned)) {
            if (count > maxSpawn) {
                maxSpawn = count;
                let foundName = id;
                for (const age of RTS_DATA.AGES) {
                    const unitSpec = age.units.find(u => u.id === id);
                    if (unitSpec) {
                        foundName = (isEn && RTS_I18N.getUnitName(id)) ? RTS_I18N.getUnitName(id) : unitSpec.name;
                        break;
                    }
                }
                mvpName = foundName;
            }
        }

        const eraName = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getAgeName(this.playerEra) : ((RTS_DATA.AGES[this.playerEra] && RTS_DATA.AGES[this.playerEra].name) ? RTS_DATA.AGES[this.playerEra].name : 'Akmens amžius');
        const earnedGold = this.stats.goldEarned || (this.stats.kills * 25 + Math.round(this.gameTime * 2));

        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-box"><span class="lbl">⚔️ ${isEn ? 'Enemies Defeated:' : 'Nukauta priešų:'}</span> <b>${this.stats.kills}</b></div>
                <div class="stat-box"><span class="lbl">💀 ${isEn ? 'Friendly Losses:' : 'Prarasta savų:'}</span> <b>${this.stats.losses}</b></div>
                <div class="stat-box"><span class="lbl">💥 ${isEn ? 'Damage Dealt:' : 'Padaryta žala:'}</span> <b>${this.stats.damageDealt}</b></div>
                <div class="stat-box"><span class="lbl">⏱️ ${isEn ? 'Battle Duration:' : 'Mūšio trukmė:'}</span> <b>${Math.floor(this.gameTime / 60)}m ${Math.floor(this.gameTime % 60)}s</b></div>
                <div class="stat-box"><span class="lbl">💰 ${isEn ? 'Gold Earned:' : 'Uždirbta aukso:'}</span> <b>${earnedGold}</b></div>
                <div class="stat-box"><span class="lbl">🏰 ${isEn ? 'Era Reached:' : 'Pasiekta epocha:'}</span> <b style="color:#38bdf8;">${eraName}</b></div>
                <div class="stat-box full"><span class="lbl">⭐ ${isEn ? 'Most Valuable Unit (MVP):' : 'Naudingiausias būrys (MVP):'}</span> <b style="color:#00f2fe;">${mvpName} (${maxSpawn} ${isEn ? 'units' : 'vnt.'})</b></div>
            `;
        }

        // Victory Interstitial Ad (Trigger 1s after Victory modal shown)
        if (isVictory) {
            if (!this.hasShownVictoryAd && window.AdManager) {
                this.hasShownVictoryAd = true;
                setTimeout(() => {
                    if (this.state === 'VICTORY') {
                        window.AdManager.showInterstitialAd();
                    }
                }, 1000);
            }
        }

        // Defeat Revive Ad Button (Active if player hasn't revived yet in this battle)
        const reviveBtn = document.getElementById('rtsReviveAdBtn');
        if (reviveBtn) {
            if (!isVictory && !this.hasUsedReviveAd) {
                reviveBtn.classList.remove('hidden');
                reviveBtn.onclick = () => this.watchReviveAd();
            } else {
                reviveBtn.classList.add('hidden');
            }
        }
    }

    getEraGoldReward() {
        const eraRewards = [150, 350, 800, 1800, 3500];
        const idx = Math.min(this.playerEra || 0, eraRewards.length - 1);
        return eraRewards[idx];
    }

    openGoldAdModal() {
        if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
        const modal = document.getElementById('rtsGoldAdModal');
        if (!modal) return;

        const reward = this.getEraGoldReward();
        const badge = document.getElementById('goldAdRewardBadge');
        if (badge) badge.textContent = `+${reward} 💰`;

        const desc = document.getElementById('goldAdModalDesc');
        if (desc) {
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            desc.textContent = isEn 
                ? `Watch a quick sponsor video and immediately receive +${reward} Gold for your civilization!`
                : `Pažiūrėkite trumpą rėmėjo vaizdo įrašą ir iškart gaukite +${reward} Aukso savo civilizacijai!`;
        }

        const watchBtn = document.getElementById('btnConfirmWatchGoldAd');
        if (watchBtn) {
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            watchBtn.textContent = isEn ? `🎬 Watch Ad (+${reward} 💰)` : `🎬 Žiūrėti reklamą (+${reward} 💰)`;
            watchBtn.onclick = () => this.watchGoldRewardAd();
        }

        const closeBtn = document.getElementById('btnCloseGoldAdModal');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeGoldAdModal();
        }

        this.pauseGame(true);
        modal.classList.remove('hidden');
        if (window.rtsSoundSystem) window.rtsSoundSystem.playClick();
    }

    closeGoldAdModal() {
        const modal = document.getElementById('rtsGoldAdModal');
        if (modal) modal.classList.add('hidden');
        this.resumeGame(true);
    }

    watchGoldRewardAd() {
        if (!window.AdManager) return;
        const reward = this.getEraGoldReward();
        const modal = document.getElementById('rtsGoldAdModal');

        window.AdManager.showRewardedAd(() => {
            if (modal) modal.classList.add('hidden');
            this.playerGold += reward;
            this.updateUI();

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            const msg = isEn ? `💰 +${reward} Gold Received!` : `💰 Gauta +${reward} Aukso!`;
            if (this.floatingTexts) {
                this.floatingTexts.push({
                    text: msg,
                    x: RTS_DATA.PLAYER_BASE_X + 60,
                    y: RTS_DATA.GROUND_Y - 120,
                    color: '#fbbf24',
                    life: 2.0,
                    maxLife: 2.0
                });
            }
            if (this.sound && this.sound.playCoin) this.sound.playCoin();
            this.resumeGame(true);
        }, null, `+${reward} Gold`);
    }

    watchReviveAd() {
        if (this.hasUsedReviveAd || !window.AdManager) return;
        window.AdManager.showRewardedAd(() => {
            this.hasUsedReviveAd = true;
            const modal = document.getElementById('rtsGameOverModal');
            if (modal) modal.classList.add('hidden');

            // Restore base HP to 35%
            if (this.playerBase) {
                this.playerBase.hp = Math.round(this.playerBase.maxHp * 0.35);
                this.playerBase.shieldTimer = 4.0; // 4 seconds invulnerability shield
            }

            // Knock back enemies near the base
            if (this.soldiers && this.soldiers.length > 0) {
                this.soldiers.forEach(s => {
                    if (!s.isPlayer && s.x < RTS_DATA.PLAYER_BASE_X + 220) {
                        s.x += 140; // Push enemy back
                    }
                });
            }

            this.state = 'PLAYING';
            this.isPaused = false;
            this.isModalPaused = false;
            this.battleFinished = false;

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            const toastMsg = isEn ? '🛡️ Base Revived! 35% HP + Shield Activated!' : '🛡️ Bazė atgaivinta! 35% Gyvybių + Aktyvuotas skydas!';
            if (this.floatingTexts) {
                this.floatingTexts.push({
                    text: toastMsg,
                    x: RTS_DATA.PLAYER_BASE_X + 80,
                    y: RTS_DATA.GROUND_Y - 140,
                    color: '#22c55e',
                    life: 2.5,
                    maxLife: 2.5
                });
            }
            if (this.sound) {
                if (this.sound.playUpgrade) this.sound.playUpgrade();
                this.sound.startMusic(this.playerEra);
            }
            this.updateUI();
        }, null, 'Revive Base');
    }

    watchMainMenuGiftAd() {
        if (!window.AdManager) return;
        window.AdManager.showRewardedAd(() => {
            const currentBonus = parseInt(localStorage.getItem('aow_ad_bonus_gold') || '0', 10);
            const newBonus = currentBonus + 300;
            localStorage.setItem('aow_ad_bonus_gold', newBonus.toString());

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            const toastMsg = isEn ? `+300 Starting Gold added! (Total Bonus: +${newBonus} 💰)` : `+300 Pradinio aukso pridėta! (Iš viso: +${newBonus} 💰)`;
            const toastHeader = isEn ? '🎁 Reward Claimed!' : '🎁 Premija Gauta!';

            // Gražus skraidantis pranešimas
            const toast = document.createElement('div');
            toast.className = 'achievement-toast';
            toast.innerHTML = `
                <div class="ach-icon">🎁</div>
                <div class="ach-info">
                    <div class="ach-title" style="color: #fde047;">${toastHeader}</div>
                    <div class="ach-desc">${toastMsg}</div>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 50);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            }, 3500);

            // Vizualus mygtuko atnaujinimas
            const giftBtn = document.getElementById('mainMenuGiftAdBtn');
            if (giftBtn) {
                giftBtn.textContent = isEn ? `✅ Bonus: +${newBonus} 💰` : `✅ Premija: +${newBonus} 💰`;
                giftBtn.style.borderColor = '#22c55e';
                giftBtn.style.color = '#86efac';
            }

            if (window.rtsSoundSystem && window.rtsSoundSystem.playAchievement) {
                window.rtsSoundSystem.playAchievement();
            }
        }, null, 'Free Gift +300 Gold');
    }

    goToMainMenu() {
        if (!this.battleFinished && this.state !== 'VICTORY' && this.state !== 'DEFEAT' && this.gameTime > 1 && this.playerBase && this.playerBase.hp > 0) {
            this.saveGameState();
        }
        if (this.battleFinished || this.state === 'VICTORY' || this.state === 'DEFEAT') {
            this.clearSavedGame();
            this.playerBase = null;
            this.enemyBase = null;
            this.gameTime = 0;
            this.soldiers = [];
            this.playerWorkers = [];
            this.enemyWorkers = [];
            this.projectiles = [];
        }
        this.state = 'MENU';
        if (window.AdManager && window.AdManager.gameplayStop) window.AdManager.gameplayStop();
        this.isPaused = false;
        this.isModalPaused = false;
        this.isDragging = false;

        if (window.selectDifficulty && this.difficulty) {
            window.selectDifficulty(this.difficulty);
        }
        if (window.selectGameMode && this.gameMode) {
            window.selectGameMode(this.gameMode);
        }

        const gameCont = document.getElementById('rtsGameContainer');
        if (gameCont) gameCont.classList.remove('game-paused');

        if (this.sound) {
            this.sound.isAudioPaused = false;
            this.sound.stopMusic();
            this.sound.setBattleTension(0);
            this.sound.setEra(0);
            if (this.sound.masterGain && this.sound.ctx && !this.sound.muted) {
                try {
                    this.sound.masterGain.gain.cancelScheduledValues(this.sound.ctx.currentTime);
                    this.sound.masterGain.gain.setValueAtTime(1.0, this.sound.ctx.currentTime);
                } catch (e) {}
            }
        }

        if (window.syncAllMuteButtons) {
            window.syncAllMuteButtons();
        }

        const allModalsToHide = [
            'rtsGameOverModal',
            'rtsPauseOverlay',
            'modalAutomationHub',
            'rtsBaseHubModal',
            'rtsSettingsModal',
            'rtsHelpModal',
            'rtsAchievementsModal',
            'rtsChallengesModal',
            'quickTradeModal',
            'rtsEvolutionModal'
        ];
        allModalsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (this.ui && this.ui.pauseBtn) this.ui.pauseBtn.innerHTML = (window.RTS_I18N) ? window.RTS_I18N.t('top.pause') : '⏸️ Pauzė';

        const startModal = document.getElementById('rtsStartModal');
        const closeStartBtn = document.getElementById('closeStartModalBtn');
        if (startModal) startModal.classList.remove('hidden');
        if (closeStartBtn) closeStartBtn.classList.add('hidden');
        
        // Atnaujinti trofėjų suvestinę viršuje (pagal esamą kalbą)
        if (typeof window !== 'undefined' && typeof window.updateMenuTrophies === 'function') {
            window.updateMenuTrophies();
        } else {
            const totalAch = (RTS_DATA.ACHIEVEMENTS && RTS_DATA.ACHIEVEMENTS.length) || 25;
            const unlockedCount = Object.keys(this.unlockedAchievements || {}).length;
            const trophySummary = document.getElementById('menuTrophiesSummary');
            if (trophySummary) {
                if (window.RTS_I18N && typeof window.RTS_I18N.t === 'function') {
                    trophySummary.textContent = window.RTS_I18N.t('ach.summary', { current: unlockedCount, total: totalAch });
                } else {
                    const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en') ||
                                 (this.settings && this.settings.language === 'en') ||
                                 (localStorage.getItem('aow_language') === 'en');
                    const prefix = isEn ? '🏆 Achievements:' : '🏆 Pasiekimai:';
                    trophySummary.textContent = `${prefix} ${unlockedCount}/${totalAch}`;
                }
            }
        }

        // Jeigu žaidimas buvo pradėtas arba yra išsaugotas LocalStorage, rodome "TĘSTI MŪŠĮ"
        this.updateResumeButtonUI();

        // Grįžus į pagrindinį meniu, kairysis meniu lieka stabilus kairėje, o dešinė pusė lieka švari, kol nepaspaustas mygtukas
        const sideDecks = document.querySelectorAll('.main-menu-deck-card');
        sideDecks.forEach(d => d.classList.add('hidden'));
        const navBtns = document.querySelectorAll('.menu-nav-btn');
        navBtns.forEach(b => b.classList.remove('active'));

        if (window.startMenuParticles) {
            window.startMenuParticles();
        }
    }

    // ========================================================================
    // SĄVEIKA SU MINIMAPU (CLICK / DRAG TO CAMERA)
    // ========================================================================
    initMinimapInteraction() {
        const miniCanvas = document.getElementById('rtsMinimapCanvas');
        if (!miniCanvas) return;

        const updateCamFromMinimap = (clientX) => {
            const rect = miniCanvas.getBoundingClientRect();
            const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const targetWorldX = (relX / rect.width) * RTS_DATA.WORLD_WIDTH;
            const scale = this.renderer ? this.renderer.getEffectiveScale() : (this.canvas.height / RTS_DATA.WORLD_HEIGHT || 1);
            const viewWidth = this.canvas.width / scale;
            this.renderer.setCamera(targetWorldX - viewWidth * 0.5);
        };

        let miniDragging = false;
        miniCanvas.addEventListener('mousedown', (e) => {
            miniDragging = true;
            updateCamFromMinimap(e.clientX);
        });
        window.addEventListener('mousemove', (e) => {
            if (miniDragging) updateCamFromMinimap(e.clientX);
        });
        window.addEventListener('mouseup', () => { miniDragging = false; });

        miniCanvas.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0]) updateCamFromMinimap(e.touches[0].clientX);
        }, { passive: true });
        miniCanvas.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) updateCamFromMinimap(e.touches[0].clientX);
        }, { passive: true });
    }

    // ========================================================================
    // VARTOTOJO ĮVESTIS IR KARŠTIEJI KLAVIŠAI (HOTKEYS)
    // ========================================================================
    initEventListeners() {
        this.initMinimapInteraction();

        const getX = (e) => (e.touches && e.touches.length > 0) ? e.touches[0].clientX : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : e.clientX);
        const getY = (e) => (e.touches && e.touches.length > 0) ? e.touches[0].clientY : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientY : e.clientY);

        let clickStartX = 0;
        let clickStartY = 0;

        const onStart = (e) => {
            this.isDragging = true;
            this.dragStartX = getX(e);
            this.cameraStartX = this.renderer.cameraX;
            clickStartX = getX(e);
            clickStartY = getY(e);
        };

        const onMove = (e) => {
            if (this.state !== 'PLAYING' || this.isPaused) {
                if (this.hoveredEvoBranch !== null) {
                    this.hoveredEvoBranch = null;
                    if (this.canvas) this.canvas.style.cursor = 'default';
                }
                return;
            }

            const curX = getX(e);
            const curY = getY(e);
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = (rect.width / this.canvas.width) || this.scaleFactor || 1;
            
            // Sekame pelės / piršto koordinates žaidimo pasaulyje (su pritaikytu kameros masteliu)
            const coords = this.renderer ? this.renderer.screenToWorld(curX, curY) : { x: (curX - rect.left) / scaleX + this.renderer.cameraX, y: (curY - rect.top) / scaleX };
            const mouseWorldX = coords.x;
            const mouseWorldY = coords.y;
            this.mouseWorldX = mouseWorldX;
            this.mouseWorldY = mouseWorldY;

            const nextEra = this.playerEra + 1;
            const cost = (this.playerEra < 4 && RTS_DATA.AGES[this.playerEra]) ? RTS_DATA.AGES[this.playerEra].evolveCost : null;
            const canEvolve = cost && (this.gameMode === 'sandbox' || (this.playerXp >= cost.xp && this.playerResources.wood >= cost.wood && this.playerResources.stone >= cost.stone && this.playerResources.food >= cost.food));
            const branches = (canEvolve && RTS_DATA.BRANCHES && RTS_DATA.BRANCHES[nextEra]) ? RTS_DATA.BRANCHES[nextEra] : [];

            let hovered = null;
            if (canEvolve && branches.length >= 2 && mouseWorldY >= 16 && mouseWorldY <= 200) {
                const isMob = (typeof document !== 'undefined') && (document.body.classList.contains('mobile-mode') || (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches));
                const hit0Min = isMob ? 215 : 230;
                const hit0Max = isMob ? 405 : 390;
                const hit1Min = isMob ? 405 : 395;
                const hit1Max = isMob ? 595 : 555;
                if (mouseWorldX >= hit0Min && mouseWorldX <= hit0Max) hovered = 0;
                else if (mouseWorldX >= hit1Min && mouseWorldX <= hit1Max) hovered = 1;
            }
            this.hoveredEvoBranch = hovered;

            this.canvas.style.cursor = (hovered !== null) ? 'pointer' : 'default';

            if (!this.isDragging) return;
            if (e.cancelable) e.preventDefault();
            const effScale = this.renderer ? this.renderer.getEffectiveScale() : 1;
            const deltaX = (curX - this.dragStartX) / (scaleX * effScale);
            this.renderer.setCamera(this.cameraStartX - deltaX);
        };

        const onEnd = (e) => {
            const endX = getX(e);
            const endY = getY(e);
            const movedDist = Math.abs(endX - clickStartX) + Math.abs(endY - clickStartY);
            this.isDragging = false;

            // Didesnė tolerancija (40px) pirštų paspaudimams liečiamuosiuose ekranuose, 15px pelei
            const isTouch = (e.type && e.type.startsWith('touch')) || (e.touches && e.touches.length > 0) || (e.changedTouches && e.changedTouches.length > 0);
            const maxMoved = isTouch ? 40 : 15;
            if (movedDist < maxMoved && (this.state === 'PLAYING' && !this.isPaused)) {
                const coords = this.renderer ? this.renderer.screenToWorld(endX, endY) : { x: endX, y: endY };
                const canvasClickX = coords.x;
                const canvasClickY = coords.y;

                // 1. Resursų rinkimas (Spustelėjus ant medžių, akmenų ar maisto)
                if (canvasClickY > RTS_DATA.GROUND_Y - 140 && canvasClickY < RTS_DATA.GROUND_Y + 30) {
                    if (canvasClickX >= 10 && canvasClickX <= 135) {
                        this.gatherResource('wood');
                        return;
                    } else if (canvasClickX > 135 && canvasClickX <= 220) {
                        this.gatherResource('stone');
                        return;
                    } else if (canvasClickX > 220 && canvasClickX <= 325) {
                        this.gatherResource('food');
                        return;
                    }
                }

                // Centrinis didysis aukso luitas / kasykla (X: 1090-1310, Y: 260-460, apima kristalus, badge ir nuggets)
                if (canvasClickX >= 1090 && canvasClickX <= 1310 && 
                    canvasClickY >= RTS_DATA.GROUND_Y - 160 && canvasClickY <= RTS_DATA.GROUND_Y + 40) {
                    this.gatherResource('center_gold');
                    return;
                }

                // 1.5 In-World Evoliucijos herbų paspaudimas virš pilies
                const nextEra = this.playerEra + 1;
                const cost = (this.playerEra < 4 && RTS_DATA.AGES[this.playerEra]) ? RTS_DATA.AGES[this.playerEra].evolveCost : null;
                const canEvolve = cost && (this.gameMode === 'sandbox' || (this.playerXp >= cost.xp && this.playerResources.wood >= cost.wood && this.playerResources.stone >= cost.stone && this.playerResources.food >= cost.food));
                const branches = (canEvolve && RTS_DATA.BRANCHES && RTS_DATA.BRANCHES[nextEra]) ? RTS_DATA.BRANCHES[nextEra] : [];

                if (canEvolve && branches.length >= 2 && canvasClickY >= 16 && canvasClickY <= 200) {
                    const isMob = (typeof document !== 'undefined') && (document.body.classList.contains('mobile-mode') || (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches));
                    const hit0Min = isMob ? 215 : 230;
                    const hit0Max = isMob ? 405 : 390;
                    const hit1Min = isMob ? 405 : 395;
                    const hit1Max = isMob ? 595 : 555;

                    if (canvasClickX >= hit0Min && canvasClickX <= hit0Max) {
                        // Kairysis herbas (Šaka 0)
                        this.confirmPlayerEvolution(nextEra, branches[0].id, null, cost);
                        return;
                    } else if (canvasClickX >= hit1Min && canvasClickX <= hit1Max) {
                        // Dešinysis herbas (Šaka 1)
                        this.confirmPlayerEvolution(nextEra, branches[1].id, null, cost);
                        return;
                    }
                }

                // 2. Paspaudimas ant žaidėjo forto/bazės (X: 310-505)
                // 1-as paspaudimas: nuveda į patrankų/bokštelių tabą ('turrets')
                // 2-as paspaudimas: atidaro turgaus langą ('trade')
                const isEvoVisible = canEvolve && branches.length >= 2;
                const baseYMin = isEvoVisible ? 201 : 140;
                const baseYMax = RTS_DATA.GROUND_Y + 40;
                const baseXMin = 310;
                const baseXMax = 505;

                if (canvasClickX >= baseXMin && canvasClickX <= baseXMax && 
                    canvasClickY >= baseYMin && canvasClickY <= baseYMax) {
                    const curTab = (typeof window.activeDeckTab !== 'undefined') ? window.activeDeckTab : 'army';
                    const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
                    if (curTab === 'turrets') {
                        // 2-as paspaudimas: atidarome Turgų / Prekyvietės langą!
                        this.openAutomationHub('trade');
                        if (this.sound) this.sound.playClick();
                        this.floatingTexts.push({
                            text: isEn ? `⚖️ Market!` : `⚖️ Turgus!`,
                            x: RTS_DATA.PLAYER_BASE_X + 65,
                            y: RTS_DATA.GROUND_Y - 180,
                            color: '#f59e0b',
                            life: 1.5,
                            maxLife: 1.5
                        });
                    } else {
                        // 1-as paspaudimas: perjungiame į Forto Ginklus (patrankų tabą)
                        if (window.setDeckTab) {
                            window.setDeckTab('turrets');
                            if (this.sound) this.sound.playClick();
                            this.floatingTexts.push({
                                text: isEn ? `🛡️ Fort Weapons! (Click again ➔ Market ⚖️)` : `🛡️ Forto ginklai! (Spauskite dar kartą ➔ Turgus ⚖️)`,
                                x: RTS_DATA.PLAYER_BASE_X + 65,
                                y: RTS_DATA.GROUND_Y - 180,
                                color: '#38bdf8',
                                life: 1.5,
                                maxLife: 1.5
                            });
                        }
                    }
                    return;
                }
            }
        };

        this.canvas.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        this.canvas.addEventListener('touchstart', onStart, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd, { passive: false });

        // Klaviatūra (Pilnas Hotkeys palaikymas)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = [
                    'modalAutomationHub',
                    'rtsEvolutionModal',
                    'rtsSettingsModal',
                    'rtsHelpModal',
                    'rtsAchievementsModal',
                    'rtsChallengesModal',
                    'quickTradeModal'
                ];
                for (const mId of openModals) {
                    const mEl = document.getElementById(mId);
                    if (mEl && !mEl.classList.contains('hidden')) {
                        mEl.classList.add('hidden');
                        if (this.isModalPaused) this.resumeGame(true);
                        return;
                    }
                }
                if (this.state === 'PLAYING' || this.state === 'PAUSED') {
                    this.togglePause();
                }
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
                return;
            }

            if (this.state !== 'PLAYING') return;

            if (e.key === '1') { if (window.setDeckTab) window.setDeckTab('army'); this.trainSoldier(0); }
            if (e.key === '2') { if (window.setDeckTab) window.setDeckTab('army'); this.trainSoldier(1); }
            if (e.key === '3') { if (window.setDeckTab) window.setDeckTab('army'); this.trainSoldier(2); }
            if (e.key === '4' || e.key.toLowerCase() === 'h') { if (window.setDeckTab) window.setDeckTab('army'); this.summonHero(); }
            if (e.key.toLowerCase() === 'f') this.setTacticalStance('attack');
            if (e.key.toLowerCase() === 'g') this.setTacticalStance('defend');
            if (e.key.toLowerCase() === 'r') this.setTacticalStance('retreat');
            if (e.key.toLowerCase() === 'u') this.triggerUltimate(true);
            
            // In-Game Evoliucijos spartieji klavišai [Q] ir [E]
            const nextEra = this.playerEra + 1;
            const cost = (this.playerEra < 4 && RTS_DATA.AGES[this.playerEra]) ? RTS_DATA.AGES[this.playerEra].evolveCost : null;
            const canEvolve = cost && (this.gameMode === 'sandbox' || (this.playerXp >= cost.xp && this.playerResources.wood >= cost.wood && this.playerResources.stone >= cost.stone && this.playerResources.food >= cost.food));
            const branches = (canEvolve && RTS_DATA.BRANCHES && RTS_DATA.BRANCHES[nextEra]) ? RTS_DATA.BRANCHES[nextEra] : [];

            if (canEvolve && branches.length >= 2) {
                if (e.key.toLowerCase() === 'q') {
                    this.confirmPlayerEvolution(nextEra, branches[0].id, null, cost);
                    return;
                }
                if (e.key.toLowerCase() === 'e') {
                    this.confirmPlayerEvolution(nextEra, branches[1].id, null, cost);
                    return;
                }
            } else if (e.key.toLowerCase() === 'e') {
                this.panCameraToBase();
            }
            if (e.key.toLowerCase() === 't') {
                if (window.setDeckTab) window.setDeckTab('turrets');
            }
            if (e.key.toLowerCase() === 'm') {
                if (window.setDeckTab) window.setDeckTab('market');
            }

            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
                this.renderer.setCamera(this.renderer.cameraX - 150);
            }
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
                this.renderer.setCamera(this.renderer.cameraX + 150);
            }
        });

                // Game Over mygtukų pajungimas
        const rBtn = document.getElementById('rtsRestartBtn');
        if (rBtn) {
            rBtn.onclick = () => {
                const modal = document.getElementById('rtsGameOverModal');
                if (modal) modal.classList.add('hidden');
                this.startNewGame(this.difficulty || 'normal', this.gameMode || 'standard', this.challengeId || null, this.aiPersonality || 'aggressive');
            };
        }
        const mBtn = document.getElementById('rtsBackToMenuBtn');
        if (mBtn) {
            mBtn.onclick = () => {
                const modal = document.getElementById('rtsGameOverModal');
                if (modal) modal.classList.add('hidden');
                this.goToMainMenu();
            };
        }

        // Reklamų (Ads) mygtukų pajungimas
        const goldAdBtn = document.getElementById('btnRewardGoldAd');
        if (goldAdBtn) {
            goldAdBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                this.openGoldAdModal();
            };
        }

        const closeGoldAdBtn = document.getElementById('btnCloseGoldAdModal');
        if (closeGoldAdBtn) {
            closeGoldAdBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                this.closeGoldAdModal();
            };
        }

        const confirmGoldAdBtn = document.getElementById('btnConfirmWatchGoldAd');
        if (confirmGoldAdBtn) {
            confirmGoldAdBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                this.watchGoldRewardAd();
            };
        }

        const giftBtn = document.getElementById('mainMenuGiftAdBtn');
        if (giftBtn) {
            giftBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                this.watchMainMenuGiftAd();
            };
        }

        const reviveBtn = document.getElementById('rtsReviveAdBtn');
        if (reviveBtn) {
            reviveBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                this.watchReviveAd();
            };
        }

                // Greitojo pertekliaus pardavimo mygtuko pajungimas
        const qSellBtn = document.getElementById('quickSellSurplusBtn');
        if (qSellBtn) {
            qSellBtn.onclick = (e) => {
                e.stopPropagation();
                this.sellSurplusResources();
            };
        }
        const mSellBtn = document.getElementById('sellSurplusBtn');
        if (mSellBtn) {
            mSellBtn.onclick = (e) => {
                e.stopPropagation();
                this.sellSurplusResources();
            };
        }

        // Tiesioginis evoliucijos mygtuko pajungimas (visada nuveda kamerą iki bazės, kur rodomos evoliucijos kortelės)
        if (this.ui.evolveBtn) {
            this.ui.evolveBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                this.panCameraToBase();
            };
        }

        const eraPill = document.getElementById('eraPillBtn');
        if (eraPill) {
            eraPill.onclick = (e) => {
                if (e) e.stopPropagation();
                this.panCameraToBase();
            };
        }

        this.setupUnitTooltips();
    }

    positionTooltip(targetEl, mouseEvent = null) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const container = document.getElementById('rtsGameContainer') || document.getElementById('gameContainer') || document.body;
        const cRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const scale = (window.game && window.game.scaleFactor && window.game.scaleFactor > 0)
            ? window.game.scaleFactor
            : (container && container.offsetWidth > 0 ? (cRect.width / container.offsetWidth) : 1);

        const tooltipW = tooltip.offsetWidth || 240;
        const tooltipH = tooltip.offsetHeight || 190;
        const pad = 12;

        let left, top;

        if (targetEl) {
            const tRect = targetEl.getBoundingClientRect();
            // Convert target element bounding rect to unscaled container coords (1280 x 720)
            const elemLeft = (tRect.left - cRect.left) / scale;
            const elemTop = (tRect.top - cRect.top) / scale;
            const elemWidth = tRect.width / scale;
            const elemHeight = tRect.height / scale;

            // Center horizontally over the target button
            left = elemLeft + (elemWidth - tooltipW) * 0.5;

            // If target element is in the top bar (e.g. top < 110px), show BELOW it
            if (elemTop < 110) {
                top = elemTop + elemHeight + 10;
            } else {
                // Otherwise (bottom dock buttons): ALWAYS stably ABOVE the button!
                // Guaranteed safe margin so it never overlaps the button
                top = elemTop - tooltipH - 12;
            }
        } else if (mouseEvent && mouseEvent.clientX !== undefined) {
            // Fallback for raw mouse events
            const mx = (mouseEvent.clientX - cRect.left) / scale;
            const my = (mouseEvent.clientY - cRect.top) / scale;
            left = mx - tooltipW * 0.5;
            top = my - tooltipH - 14;
            if (top < pad) {
                top = Math.max(pad, my - tooltipH * 0.5);
                left = (mx + tooltipW + 20 < 1280) ? (mx + 20) : (mx - tooltipW - 20);
            }
        } else {
            return;
        }

        const maxW = (container && container.offsetWidth > 0) ? container.offsetWidth : 1280;
        const maxH = (container && container.offsetHeight > 0) ? container.offsetHeight : 720;

        if (left < pad) left = pad;
        if (left + tooltipW > maxW - pad) left = maxW - tooltipW - pad;
        if (top < pad) top = pad;
        if (top + tooltipH > maxH - pad) top = maxH - tooltipH - pad;

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    showUnitTooltip(u, targetEl, isHero = false, mouseEvent = null) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip || !u) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const typeNames = {
            melee: isLt ? '⚔️ Artimoji kova' : '⚔️ Melee',
            ranged: isLt ? '🏹 Šaulys (Nuotolis)' : '🏹 Ranged',
            cavalry: isLt ? '🐎 Raitelija (Greitas)' : '🐎 Cavalry',
            siege: isLt ? '💣 Sunkioji technika' : '💣 Siege'
        };
        const typeLabel = isHero ? (isLt ? '👑 Didvyris' : '👑 Hero') : (typeNames[u.type] || (isLt ? '⚔️ Karys' : '⚔️ Soldier'));
        const uName = (window.RTS_I18N) ? (isHero ? window.RTS_I18N.getHeroName(this.playerEra) : window.RTS_I18N.getUnitName(u.id)) : u.name;
        const uDesc = (window.RTS_I18N) ? (isHero ? (window.RTS_I18N.getHeroSkillDesc(this.playerEra) || u.desc) : window.RTS_I18N.getUnitDesc(u.id)) : u.desc;
        const hpLabel = isLt ? '❤️ HP' : '❤️ HP';
        const dmgLabel = isLt ? '⚔️ Žala' : '⚔️ Damage';
        const rngLabel = isLt ? '🎯 Nuotolis' : '🎯 Range';
        const spdLabel = isLt ? '⚡ Greitis' : '⚡ Speed';
        const costLabel = isLt ? '💰 Kaina' : '💰 Cost';
        const trainLabel = isLt ? '⏱️ Gamyba' : '⏱️ Train';
        const hintText = isLt ? '💡 Spustelėkite samdymui • Dešiniu pelės klavišu AUTO' : '💡 Click to recruit • Right-click for AUTO';

        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">${u.icon || (isHero ? '👑' : '⚔️')}</span>
                <div>
                    <div class="tooltip-title">${uName}</div>
                    <span class="tooltip-type-badge">${typeLabel}</span>
                </div>
            </div>
            <div class="tooltip-stats-grid">
                <div class="tooltip-stat-pill hp">${hpLabel}: <b>${u.hp}</b></div>
                <div class="tooltip-stat-pill dmg">${dmgLabel}: <b>${u.damage}</b></div>
                <div class="tooltip-stat-pill rng">${rngLabel}: <b>${u.range || 40}</b></div>
                <div class="tooltip-stat-pill spd">${spdLabel}: <b>${u.speed || 50}</b></div>
                <div class="tooltip-stat-pill cost">${costLabel}: <b>${u.costGold}G</b></div>
                <div class="tooltip-stat-pill train">${trainLabel}: <b>${u.trainTime || 3}s</b></div>
            </div>
            ${u.auraTitle ? `<div style="font-size:10px; color:#fbbf24; font-weight:800; margin-bottom:6px;">🌟 Aura: ${u.auraTitle}</div>` : ''}
            <div class="tooltip-desc">${uDesc || (isLt ? 'Ištikimas jūsų kariuomenės karys mūšio lauke.' : 'Loyal warrior fighting for your civilization.')}</div>
            <div class="tooltip-hint">${hintText}</div>
        `;

        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl, mouseEvent);
    }

    showTurretTooltip(t, targetEl, mouseEvent = null) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip || !t) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const tName = (window.RTS_I18N) ? window.RTS_I18N.getTurretName(t.id) : t.name;
        const tDesc = (window.RTS_I18N) ? window.RTS_I18N.getTurretDesc(t.id) : t.desc;
        const badgeLabel = isLt ? '🛡️ Forto Gynybinis Bokštelis' : '🛡️ Defense Turret';
        const splashHtml = t.splash ? `<div class="tooltip-stat-pill dmg" style="color:#f59e0b;">💥 ${isLt ? 'Plotas' : 'Area'}: <b>${t.splash}px</b></div>` : '';
        const sellGold = t.sellGold || Math.floor(((t.cost ? t.cost.gold : 100)) * 0.6);
        const dmgLabel = isLt ? '⚔️ Žala' : '⚔️ Damage';
        const rngLabel = isLt ? '🎯 Nuotolis' : '🎯 Range';
        const spdLabel = isLt ? '⏱️ Greitis' : '⏱️ Rate';
        const costLabel = isLt ? '💰 Kaina' : '💰 Cost';
        const sellLabel = isLt ? '🛡️ Parduoti' : '🛡️ Sell';
        const hintText = isLt ? '💡 Spustelėkite statybai šiame lizde' : '💡 Click to build in this slot';

        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">${t.icon || '🛡️'}</span>
                <div>
                    <div class="tooltip-title">${tName}</div>
                    <span class="tooltip-type-badge">${badgeLabel}</span>
                </div>
            </div>
            <div class="tooltip-stats-grid">
                <div class="tooltip-stat-pill dmg">${dmgLabel}: <b>${t.damage} DMG</b></div>
                <div class="tooltip-stat-pill rng">${rngLabel}: <b>${t.range} Rng</b></div>
                <div class="tooltip-stat-pill spd">${spdLabel}: <b>${t.attackSpeed}s</b></div>
                ${splashHtml}
                <div class="tooltip-stat-pill cost">${costLabel}: <b>${t.cost ? t.cost.gold : 0}G</b></div>
                <div class="tooltip-stat-pill train">${sellLabel}: <b>+${sellGold}G</b></div>
            </div>
            <div class="tooltip-desc">${tDesc || (isLt ? 'Galingas gynybinis bokštelis, saugantis jūsų bazę nuo priešų antpuolio.' : 'Powerful defensive tower protecting your base against enemy assault.')}</div>
            <div class="tooltip-hint">${hintText}</div>
        `;

        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl, mouseEvent);
    }

    showMarketTooltip(resKey, targetEl, mouseEvent = null) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const info = {
            wood: {
                name: isLt ? 'Mediena' : 'Wood',
                icon: '🪵',
                sellRate: 20,
                buyRate: 25,
                unitSell: 2.0,
                unitBuy: 2.5,
                desc: isLt ? 'Statybinė medžiaga forto bokšteliams, būstams ir įrankių tobulinimui.' : 'Building material for castle turrets, housing, and tool upgrades.'
            },
            stone: {
                name: isLt ? 'Akmuo' : 'Stone',
                icon: '🪨',
                sellRate: 25,
                buyRate: 30,
                unitSell: 2.5,
                unitBuy: 3.0,
                desc: isLt ? 'Tvirta uoliena forto sienos stiprinimui, galingiems pabūklams ir technologijoms.' : 'Sturdy stone for fortress walls, heavy artillery, and technologies.'
            },
            food: {
                name: isLt ? 'Maistas' : 'Food',
                icon: '🌾',
                sellRate: 15,
                buyRate: 20,
                unitSell: 1.5,
                unitBuy: 2.0,
                desc: isLt ? 'Būtinas gyventojų maistas ir kariuomenės aprūpinimas mūšio metu.' : 'Essential sustenance for citizens and maintaining your active army.'
            }
        }[resKey] || {
            name: isLt ? 'Resursas' : 'Resource',
            icon: '📦',
            sellRate: 20,
            buyRate: 25,
            unitSell: 2.0,
            unitBuy: 2.5,
            desc: isLt ? 'Žaliava prekybai ir statyboms.' : 'Raw materials for trade and construction.'
        };

        const stock = Math.floor((this.playerResources && this.playerResources[resKey]) || 0);
        const maxGold = Math.floor(stock * info.unitSell);

        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">${info.icon}</span>
                <div>
                    <div class="tooltip-title">${info.name} — ${isLt ? 'Prekybvietė' : 'Marketplace'}</div>
                    <span class="tooltip-type-badge">${isLt ? '⚖️ Kainos & Valiutos Kursas' : '⚖️ Exchange Rates'}</span>
                </div>
            </div>
            <div class="tooltip-stats-grid">
                <div class="tooltip-stat-pill cost" style="color:#4ade80;">💰 ${isLt ? 'Parduoti 10:' : 'Sell 10:'} <b>+${info.sellRate} 💰</b></div>
                <div class="tooltip-stat-pill cost" style="color:#38bdf8;">🛒 ${isLt ? 'Pirkti 10:' : 'Buy 10:'} <b>${info.buyRate} 💰</b></div>
                <div class="tooltip-stat-pill hp">📦 ${isLt ? 'Turite:' : 'Stock:'} <b>${stock} ${info.icon}</b></div>
                <div class="tooltip-stat-pill train" style="color:#fbbf24;">⚡ ${isLt ? 'Viso vertė:' : 'Total Value:'} <b>+${maxGold} 💰</b></div>
            </div>
            <div class="tooltip-desc">${info.desc}</div>
            <div class="tooltip-hint">${isLt ? '💡 Naudokite kortelės mygtukus pirkimui arba pardavimui' : '💡 Use the card buttons to buy or sell'}</div>
        `;

        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl, mouseEvent);
    }

    showUpgradeTooltip(trackId, targetEl, mouseEvent = null) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const track = RTS_DATA.UPGRADES ? RTS_DATA.UPGRADES[trackId] : null;
        if (!track) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const curLvl = this.getUpgradeLevel ? this.getUpgradeLevel(trackId, true) : 0;
        const isMax = curLvl >= 5;
        const nextLvl = Math.min(5, curLvl + 1);

        const econLvl = this.getUpgradeLevel ? this.getUpgradeLevel('trade_economy', true) : 0;
        const discount = (econLvl >= 3) ? (RTS_DATA.UPGRADES.trade_economy.levels[econLvl - 1].buyDiscount || 0) : 0;

        let badgeHtml = isMax ? (isLt ? '🏆 MAX Pasiekta' : '🏆 MAX Reached') : (isLt ? `⭐ ${curLvl} / 5 Lygis` : `⭐ Level ${curLvl} / 5`);

        const trName = (window.RTS_I18N && !isLt) ? RTS_I18N.getUpgradeName(trackId) : track.name;
        const trDesc = (window.RTS_I18N && !isLt) ? RTS_I18N.getUpgradeDesc(trackId) : track.desc;

        let bodyHtml = '';
        if (!isMax) {
            const nextData = track.levels[nextLvl - 1];
            const finalGold = Math.floor((nextData.cost.gold || 0) * (1 - discount));

            const costParts = [];
            if (finalGold > 0) costParts.push(`<span style="color:#fbbf24;">💰 ${finalGold}</span>`);
            if (nextData.cost.wood > 0) costParts.push(`<span style="color:#4ade80;">🪵 ${nextData.cost.wood}</span>`);
            if (nextData.cost.stone > 0) costParts.push(`<span style="color:#cbd5e1;">🪨 ${nextData.cost.stone}</span>`);
            if (nextData.cost.food > 0) costParts.push(`<span style="color:#f59e0b;">🌾 ${nextData.cost.food}</span>`);

            let curBonusHtml = '';
            if (curLvl > 0) {
                const curData = track.levels[curLvl - 1];
                const curName = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelName(trackId, curLvl) : curData.name;
                const curDesc = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelDesc(trackId, curLvl) : curData.desc;
                curBonusHtml = `
                    <div style="font-size:10.5px; color:#94a3b8; margin: 4px 0 6px; padding: 4px 6px; background: rgba(15, 23, 42, 0.6); border-radius: 4px; border-left: 2px solid #10b981;">
                        <b style="color:#10b981;">${isLt ? 'Dabartinis' : 'Current'} (Lv.${curLvl} ${curName}):</b><br>
                        <span style="color:#e2e8f0;">${curDesc}</span>
                    </div>
                `;
            }

            const nextName = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelName(trackId, nextLvl) : nextData.name;
            const nextDesc = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelDesc(trackId, nextLvl) : nextData.desc;

            bodyHtml = `
                <div style="font-size:12px; font-weight:800; color:#38bdf8; margin-bottom:4px;">
                    ⚡ ${isLt ? 'Kitas lygis' : 'Next level'}: Lv.${nextLvl} — ${nextName}
                </div>
                <div class="tooltip-desc" style="color:#f8fafc; font-size:11.5px; line-height:1.35; margin-bottom:6px;">
                    ${nextDesc}
                </div>
                ${curBonusHtml}
                <div class="tooltip-stats-grid" style="grid-template-columns:1fr; margin-bottom:4px;">
                    <div class="tooltip-stat-pill cost" style="font-size:11px;">
                        ${isLt ? 'Kaina:' : 'Cost:'} <b>${costParts.join(' &nbsp;•&nbsp; ')}</b>
                    </div>
                </div>
                <div class="tooltip-hint">${isLt ? '💡 Spustelėkite mygtuką tobulinimui pirkti' : '💡 Click button to buy upgrade'}</div>
            `;
        } else {
            const maxData = track.levels[4];
            const maxName = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelName(trackId, 5) : maxData.name;
            const maxDesc = (window.RTS_I18N) ? RTS_I18N.getUpgradeLevelDesc(trackId, 5) : maxData.desc;
            const hasConfig = (trackId !== 'base_wall');
            bodyHtml = `
                <div style="font-size:12px; font-weight:800; color:#fbbf24; margin-bottom:4px;">
                    👑 Lv.5 — ${maxName}
                </div>
                <div class="tooltip-desc" style="color:#f8fafc; font-size:11.5px; line-height:1.35; margin-bottom:6px;">
                    ${maxDesc}
                </div>
                <div style="font-size:11px; color:#4ade80; font-weight:bold; margin-bottom:6px;">
                    ✅ ${isLt ? 'Maksimalus tobulinimo lygis pasiektas! Visi bonusai aktyvūs.' : 'Maximum upgrade level reached! All bonuses active.'}
                </div>
                <div class="tooltip-hint">${hasConfig ? (isLt ? '💡 Spustelėkite „⚙️ Valdyti“, norėdami keisti nustatymus' : '💡 Click "⚙️ Manage" to adjust settings') : (isLt ? '💡 Maksimali gynyba' : '💡 Maximum defense')}</div>
            `;
        }

        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">${track.icon}</span>
                <div>
                    <div class="tooltip-title">${trName}</div>
                    <span class="tooltip-type-badge">${badgeHtml}</span>
                </div>
            </div>
            ${bodyHtml}
        `;

        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl, mouseEvent);
    }

    showStanceTooltip(stance, targetEl) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const stances = {
            aggressive: {
                icon: '⚔️',
                title: isLt ? 'Agresyvi Rikiuotė' : 'Aggressive Formation',
                badge: isLt ? '⚔️ Puolimo Elgsena' : '⚔️ Offensive Posture',
                stats: [
                    { label: isLt ? '⚡ Judėjimas' : '⚡ Movement', val: isLt ? '+15% Greičiau' : '+15% Faster' },
                    { label: isLt ? '🎯 Taikinys' : '🎯 Target', val: isLt ? 'Visi Priešai' : 'All Enemies' }
                ],
                desc: isLt ? 'Kariai aktyviai žygiuoja į priekį ir puola kiekvieną sutiktą priešą bei jų bazę.' : 'Soldiers aggressively march forward and attack any enemy in sight and their castle base.',
                hint: isLt ? '💡 Spustelėkite perjungti kariuomenės rikiuotę' : '💡 Click to toggle army stance'
            },
            balanced: {
                icon: '⚖️',
                title: isLt ? 'Subalansuota Rikiuotė' : 'Balanced Formation',
                badge: isLt ? '⚖️ Standartinė Elgsena' : '⚖️ Standard Posture',
                stats: [
                    { label: isLt ? '🛡️ Gynyba' : '🛡️ Defense', val: isLt ? 'Subalansuota' : 'Balanced' },
                    { label: isLt ? '⚔️ Puolimas' : '⚔️ Attack', val: isLt ? 'Pagal Rikiuotę' : 'In Formation' }
                ],
                desc: isLt ? 'Standartinis taktinis elgesys. Kariai palaiko formuotę, ginasi ir puola tolygiai.' : 'Standard tactical behavior. Troops hold line, defend, and engage enemies steadily.',
                hint: isLt ? '💡 Spustelėkite perjungti kariuomenės rikiuotę' : '💡 Click to toggle army stance'
            },
            defensive: {
                icon: '🛡️',
                title: isLt ? 'Gynybinė Rikiuotė' : 'Defensive Formation',
                badge: isLt ? '🛡️ Bazės Sauga' : '🛡️ Base Protection',
                stats: [
                    { label: isLt ? '🛡️ Ištvermė' : '🛡️ Armor', val: isLt ? '+15% Šarvai' : '+15% Armor' },
                    { label: isLt ? '📍 Pozicija' : '📍 Position', val: isLt ? 'Prie Bazės' : 'Near Castle' }
                ],
                desc: isLt ? 'Kariai laikosi arčiau forto bokštelių ir saugo jūsų bazę nuo priešų puolimo bangų.' : 'Troops stay close to castle turrets and defend your base from incoming enemy attack waves.',
                hint: isLt ? '💡 Spustelėkite perjungti kariuomenės rikiuotę' : '💡 Click to toggle army stance'
            }
        };

        const data = stances[stance] || stances.balanced;
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">${data.icon}</span>
                <div>
                    <div class="tooltip-title">${data.title}</div>
                    <span class="tooltip-type-badge">${data.badge}</span>
                </div>
            </div>
            <div class="tooltip-stats-grid">
                <div class="tooltip-stat-pill spd">${data.stats[0].label}: <b>${data.stats[0].val}</b></div>
                <div class="tooltip-stat-pill dmg">${data.stats[1].label}: <b>${data.stats[1].val}</b></div>
            </div>
            <div class="tooltip-desc">${data.desc}</div>
            <div class="tooltip-hint">${data.hint}</div>
        `;
        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl);
    }

    showUltimateTooltip(targetEl) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const eraData = RTS_DATA.AGES[this.playerEra];
        const cd = this.playerUltimateCooldown || 0;
        const isReady = cd <= 0;

        const ultName = (window.RTS_I18N && !isLt) ? RTS_I18N.getUltimateName(this.playerEra) : (eraData && eraData.ultimate ? eraData.ultimate.name : 'Super Galia');
        const ultDesc = (window.RTS_I18N && !isLt) ? RTS_I18N.getUltimateDesc(this.playerEra) : (eraData && eraData.ultimate ? eraData.ultimate.desc : 'Galingas meteorų ar strėlių antpuolis per visą mūšio lauką.');
        const cdText = isReady ? (isLt ? '🟢 PARUOŠTA' : '🟢 READY') : (isLt ? `⏳ Kraunasi (${Math.ceil(cd)}s)` : `⏳ Charging (${Math.ceil(cd)}s)`);

        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">⚡</span>
                <div>
                    <div class="tooltip-title">${ultName}</div>
                    <span class="tooltip-type-badge">${isLt ? '⚡ Epochos Ultimate Gebėjimas' : '⚡ Era Ultimate Ability'}</span>
                </div>
            </div>
            <div class="tooltip-stats-grid">
                <div class="tooltip-stat-pill spd">⏱️ ${isLt ? 'Būsena' : 'Status'}: <b>${cdText}</b></div>
                <div class="tooltip-stat-pill dmg">💥 ${isLt ? 'Poveikis' : 'Effect'}: <b>${isLt ? 'Masinė žala' : 'Massive AoE DMG'}</b></div>
            </div>
            <div class="tooltip-desc">${ultDesc}</div>
            <div class="tooltip-hint">${isLt ? '💡 Spustelėkite norėdami paleisti antpuolį į priešą' : '💡 Click to unleash ultimate strike'}</div>
        `;
        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl);
    }

    showEvolveTooltip(targetEl) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const nextEra = this.playerEra + 1;
        const isMaxEra = this.playerEra >= 4;

        if (isMaxEra) {
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <span class="tooltip-icon">🏛️</span>
                    <div>
                        <div class="tooltip-title">${isLt ? 'Aukščiausioji Epocha' : 'Supreme Era'}</div>
                        <span class="tooltip-type-badge">${isLt ? '🏆 MAX Pasiekta' : '🏆 MAX Reached'}</span>
                    </div>
                </div>
                <div class="tooltip-desc">${isLt ? 'Pasiekėte aukščiausią technologijų lygį! Visi šios epochos ginklai ir kariai aktyvūs.' : 'You have reached the pinnacle of civilization! All weapons and units are fully unlocked.'}</div>
                <div class="tooltip-hint">${isLt ? '💡 Sunaikinkite priešo forto bazę pergalei!' : '💡 Destroy the enemy base to achieve victory!'}</div>
            `;
        } else {
            const cost = (RTS_DATA.AGES[this.playerEra]) ? RTS_DATA.AGES[this.playerEra].evolveCost : null;
            const nextName = (window.RTS_I18N && !isLt) ? RTS_I18N.getAgeName(nextEra) : ((RTS_DATA.AGES[nextEra]) ? RTS_DATA.AGES[nextEra].name : `Epocha ${nextEra + 1}`);
            const canAfford = cost && (this.gameMode === 'sandbox' || (
                this.playerXp >= cost.xp &&
                this.playerResources.wood >= cost.wood &&
                this.playerResources.stone >= cost.stone &&
                this.playerResources.food >= cost.food
            ));

            const xpColor = this.playerXp >= (cost ? cost.xp : 0) ? '#10b981' : '#ef4444';
            const wColor = this.playerResources.wood >= (cost ? cost.wood : 0) ? '#10b981' : '#ef4444';
            const sColor = this.playerResources.stone >= (cost ? cost.stone : 0) ? '#10b981' : '#ef4444';
            const fColor = this.playerResources.food >= (cost ? cost.food : 0) ? '#10b981' : '#ef4444';

            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <span class="tooltip-icon">🏛️</span>
                    <div>
                        <div class="tooltip-title">${isLt ? `Evoliucija: ${nextName}` : `Evolution: ${nextName}`}</div>
                        <span class="tooltip-type-badge">${isLt ? '🌟 Nauja Civilizacija' : '🌟 New Civilization'}</span>
                    </div>
                </div>
                <div class="tooltip-stats-grid">
                    <div class="tooltip-stat-pill xp" style="color:${xpColor};">⚡ XP: <b>${Math.floor(this.playerXp)} / ${cost ? cost.xp : 0}</b></div>
                    <div class="tooltip-stat-pill cost" style="color:${wColor};">🪵 ${isLt ? 'Medis' : 'Wood'}: <b>${Math.floor(this.playerResources.wood)} / ${cost ? cost.wood : 0}</b></div>
                    <div class="tooltip-stat-pill cost" style="color:${sColor};">🪨 ${isLt ? 'Akmuo' : 'Stone'}: <b>${Math.floor(this.playerResources.stone)} / ${cost ? cost.stone : 0}</b></div>
                    <div class="tooltip-stat-pill cost" style="color:${fColor};">🌾 ${isLt ? 'Maistas' : 'Food'}: <b>${Math.floor(this.playerResources.food)} / ${cost ? cost.food : 0}</b></div>
                </div>
                <div class="tooltip-desc">${isLt ? 'Pereikite į naują civilizacijos erą. Atrakinsite naujus karius, forto bokštelius ir technologijas.' : 'Advance into a new civilization era. Unlocks powerful units, castle turrets, and technologies.'}</div>
                <div class="tooltip-hint">${canAfford ? (isLt ? '✨ Spustelėkite norėdami EVOLIUCIONUOTI!' : '✨ Click to EVOLVE!') : (isLt ? '⏳ Rinkite XP mūšiuose ir resursus kasyboje' : '⏳ Earn XP in combat and gather resources')}</div>
            `;
        }
        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl);
    }

    showSurplusTooltip(targetEl) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const res = this.playerResources;
        const isMaxEra = this.playerEra >= 4;
        const eraData = (RTS_DATA.AGES && RTS_DATA.AGES[this.playerEra]) ? RTS_DATA.AGES[this.playerEra] : null;
        const evoCost = (!isMaxEra && eraData && eraData.evolveCost) ? eraData.evolveCost : { wood: 0, stone: 0, food: 0 };

        const reqWood = isMaxEra ? 0 : (evoCost.wood || 0);
        const reqStone = isMaxEra ? 0 : (evoCost.stone || 0);
        const reqFood = isMaxEra ? 0 : (evoCost.food || 0);

        const woodSurplus = Math.max(0, Math.floor(res.wood - reqWood));
        const stoneSurplus = Math.max(0, Math.floor(res.stone - reqStone));
        const foodSurplus = Math.max(0, Math.floor(res.food - reqFood));
        const estGold = Math.floor(woodSurplus * 2.0 + stoneSurplus * 2.5 + foodSurplus * 1.5);

        const woodLabel = isMaxEra 
            ? `🪵 ${isLt ? 'Medis' : 'Wood'}: <b>${Math.floor(res.wood)}</b>`
            : `🪵 ${isLt ? 'Medis' : 'Wood'} >${reqWood}: <b>+${woodSurplus}</b>`;
        const stoneLabel = isMaxEra 
            ? `🪨 ${isLt ? 'Akmuo' : 'Stone'}: <b>${Math.floor(res.stone)}</b>`
            : `🪨 ${isLt ? 'Akmuo' : 'Stone'} >${reqStone}: <b>+${stoneSurplus}</b>`;
        const foodLabel = isMaxEra 
            ? `🌾 ${isLt ? 'Maistas' : 'Food'}: <b>${Math.floor(res.food)}</b>`
            : `🌾 ${isLt ? 'Maistas' : 'Food'} >${reqFood}: <b>+${foodSurplus}</b>`;

        const desc = isMaxEra
            ? (isLt ? 'Maksimali epocha! Parduoda visas turimas medžiagas į auksą tiesioginėmis rinkos kainomis.' : 'Maximum era reached! Sells all remaining materials for gold at current market rates.')
            : (isLt ? 'Automatiškai parduoda tik medžiagų perteklių virš bazės evoliucijai reikalingo kiekio, išsaugodamas evoliucijos resursus.' : 'Automatically sells only surplus materials exceeding base evolution requirements, keeping all materials needed to evolve.');

        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">💰</span>
                <div>
                    <div class="tooltip-title">${isLt ? 'Parduoti Perteklių' : 'Sell Surplus'}</div>
                    <span class="tooltip-type-badge">${isLt ? '⚖️ Greitas Turgus' : '⚖️ Quick Market'}</span>
                </div>
            </div>
            <div class="tooltip-stats-grid">
                <div class="tooltip-stat-pill cost">${woodLabel}</div>
                <div class="tooltip-stat-pill cost">${stoneLabel}</div>
                <div class="tooltip-stat-pill cost">${foodLabel}</div>
                <div class="tooltip-stat-pill train" style="color:#fbbf24;">💰 ${isLt ? 'Numatomas Auksas' : 'Estimated Gold'}: <b>+${estGold}G</b></div>
            </div>
            <div class="tooltip-desc">${desc}</div>
            <div class="tooltip-hint">${isLt ? '💡 Spustelėkite greitam pertekliaus pardavimui' : '💡 Click to quickly sell surplus resources'}</div>
        `;
        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl);
    }

    showAutoGatherTooltip(targetEl) {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (!tooltip) return;

        const isLt = (window.RTS_I18N && window.RTS_I18N.currentLang === 'lt');
        const autoActive = this.autoGatherWorkers;
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-icon">⛏️</span>
                <div>
                    <div class="tooltip-title">${isLt ? 'Darbininkų Automatinė Kasyba' : 'Worker Auto-Gathering'}</div>
                    <span class="tooltip-type-badge">${autoActive ? (isLt ? '🟢 Įjungta' : '🟢 Enabled') : (isLt ? '⚪ Išjungta' : '⚪ Disabled')}</span>
                </div>
            </div>
            <div class="tooltip-desc">${isLt ? 'Kai ši funkcija įjungta, laisvi forto darbininkai automatiškai kerta medžius, kasa akmenis ir renka maisto resursus.' : 'When enabled, idle workers automatically harvest trees, mine stone deposits, and gather food.'}</div>
            <div class="tooltip-hint">${isLt ? '💡 Spustelėkite norėdami įjungti arba išjungti automatinį rinkimą' : '💡 Click to toggle automated worker gathering'}</div>
        `;
        tooltip.classList.remove('hidden');
        this.positionTooltip(targetEl);
    }

    hideUnitTooltip() {
        const tooltip = document.getElementById('rtsUnitTooltip');
        if (tooltip) tooltip.classList.add('hidden');
    }

    setupUnitTooltips() {
        // 1. PC PELEI: Užvedimas (Hover) ant karių ir didvyrio mygtukų (PC veikia 100% identiškai)
        const unitsContainer = document.querySelector('.units-container');
        if (unitsContainer) {
            unitsContainer.addEventListener('mouseover', (e) => {
                const btn = e.target.closest('.rts-unit-btn');
                if (!btn) return;

                if (btn.id === 'rtsHeroBtn') {
                    const heroSpec = RTS_DATA.HEROES ? RTS_DATA.HEROES[this.playerEra] : null;
                    if (heroSpec) {
                        this.showUnitTooltip(heroSpec, btn, true, e);
                    }
                } else if (btn.id && btn.id.startsWith('rtsUnitBtn_')) {
                    const idx = parseInt(btn.id.replace('rtsUnitBtn_', ''));
                    const eraData = RTS_DATA.AGES[this.playerEra];
                    if (eraData && eraData.units && eraData.units[idx]) {
                        this.showUnitTooltip(eraData.units[idx], btn, false, e);
                    }
                }
            });

            unitsContainer.addEventListener('mousemove', (e) => {
                const btn = e.target.closest('.rts-unit-btn');
                if (btn) {
                    this.positionTooltip(btn, e);
                }
            });

            unitsContainer.addEventListener('mouseout', (e) => {
                const btn = e.target.closest('.rts-unit-btn');
                if (btn && (!e.relatedTarget || !e.relatedTarget.closest('.rts-unit-btn'))) {
                    this.hideUnitTooltip();
                }
            });
        }

        // PC PELEI: Užvedimas ant kitų apatinio doko elementų
        const bottomDock = document.getElementById('rtsBottomDock');
        if (bottomDock) {
            bottomDock.addEventListener('mouseover', (e) => {
                const stanceBtn = e.target.closest('.stance-btn');
                if (stanceBtn) {
                    const stance = stanceBtn.getAttribute('data-stance') || (stanceBtn.textContent.includes('Agresyvus') ? 'aggressive' : stanceBtn.textContent.includes('Gynybinis') ? 'defensive' : 'balanced');
                    this.showStanceTooltip(stance, stanceBtn);
                    return;
                }
                const ultBtn = e.target.closest('#rtsUltimateBtn, .ult-btn');
                if (ultBtn) {
                    this.showUltimateTooltip(ultBtn);
                    return;
                }
                const surplusBtn = e.target.closest('#quickSellSurplusBtn, .surplus-quick');
                if (surplusBtn) {
                    this.showSurplusTooltip(surplusBtn);
                    return;
                }
                const evolveBtn = e.target.closest('#rtsEvolveBtn, .special-btn.evolve');
                if (evolveBtn) {
                    this.showEvolveTooltip(evolveBtn);
                    return;
                }
            });

            bottomDock.addEventListener('mouseout', (e) => {
                const interactive = e.target.closest('.stance-btn, #rtsUltimateBtn, .ult-btn, #quickSellSurplusBtn, .surplus-quick, #rtsEvolveBtn, .special-btn.evolve');
                if (interactive && (!e.relatedTarget || !e.relatedTarget.closest('.stance-btn, #rtsUltimateBtn, .ult-btn, #quickSellSurplusBtn, .surplus-quick, #rtsEvolveBtn, .special-btn.evolve'))) {
                    this.hideUnitTooltip();
                }
            });
        }

        const topBar = document.getElementById('rtsTopBar');
        if (topBar) {
            const eraPill = topBar.querySelector('#eraPillBtn, .era-header-pill');
            if (eraPill) {
                eraPill.addEventListener('mouseenter', (e) => {
                    this.showEvolveTooltip(eraPill);
                });
                eraPill.addEventListener('mouseleave', () => {
                    this.hideUnitTooltip();
                });
            }
        }

        // ========================================================================
        // 2. MOBILIEJI ĮRENGINIAI: UNIVERSALI ILGO PASPAUDIMO (LONG PRESS >280ms) SISTEMA
        //    Greitas paspaudimas (<280ms) = Veiksmas / Pirkimas
        //    Ilgas paspaudimas (>280ms) = INFO / Tooltip (Pirkimas ar veiksmas NEĮVYKSTA!)
        // ========================================================================
        let touchLongTimer = null;
        let didLongPress = false;
        let touchStartX = 0;
        let touchStartY = 0;
        let activeTouchTarget = null;

        const triggerElementInfo = (target) => {
            if (!target) return false;

            // Karys arba didvyris
            const unitBtn = target.closest('.rts-unit-btn');
            if (unitBtn) {
                if (unitBtn.id === 'rtsHeroBtn') {
                    const heroSpec = RTS_DATA.HEROES ? RTS_DATA.HEROES[this.playerEra] : null;
                    if (heroSpec) { this.showUnitTooltip(heroSpec, unitBtn, true); return true; }
                } else if (unitBtn.id && unitBtn.id.startsWith('rtsUnitBtn_')) {
                    const idx = parseInt(unitBtn.id.replace('rtsUnitBtn_', ''));
                    const eraData = RTS_DATA.AGES[this.playerEra];
                    if (eraData && eraData.units && eraData.units[idx]) {
                        this.showUnitTooltip(eraData.units[idx], unitBtn, false);
                        return true;
                    }
                }
            }

            // Rikiuotė / Stance
            const stanceBtn = target.closest('.stance-btn');
            if (stanceBtn) {
                const stance = stanceBtn.getAttribute('data-stance') || (stanceBtn.textContent.includes('Agresyvus') ? 'aggressive' : stanceBtn.textContent.includes('Gynybinis') ? 'defensive' : 'balanced');
                this.showStanceTooltip(stance, stanceBtn);
                return true;
            }

            // Bokštelių parinktys (.deck-t-opt-btn)
            const turretOptBtn = target.closest('.deck-t-opt-btn');
            if (turretOptBtn) {
                const tid = turretOptBtn.getAttribute('data-tid');
                const eraData = RTS_DATA.AGES[this.playerEra];
                if (eraData && eraData.turrets) {
                    const tObj = eraData.turrets.find(t => t.id === tid);
                    if (tObj) {
                        this.showTurretTooltip(tObj, turretOptBtn);
                        return true;
                    }
                }
            }

            // Pastatytas bokštelis
            const turretCard = target.closest('.deck-t-card');
            if (turretCard && !turretOptBtn) {
                const parent = turretCard.parentNode;
                if (parent) {
                    const cardIdx = Array.from(parent.children).indexOf(turretCard);
                    if (cardIdx >= 0 && this.playerTurrets && this.playerTurrets[cardIdx]) {
                        this.showTurretTooltip(this.playerTurrets[cardIdx].data, turretCard);
                        return true;
                    }
                }
            }

            // Miesto tobulinimo kortelė (.deck-upg-card)
            const upgCard = target.closest('.deck-upg-card');
            if (upgCard) {
                const trackId = upgCard.id.replace('deckUpgCard_', '');
                if (trackId && RTS_DATA.UPGRADES && RTS_DATA.UPGRADES[trackId]) {
                    this.showUpgradeTooltip(trackId, upgCard);
                    return true;
                }
            }

            // Prekyvietės kortelė (.deck-mkt-card)
            const mktCard = target.closest('.deck-mkt-card');
            if (mktCard) {
                const resKey = mktCard.id.replace('deckMktCard_', '');
                if (resKey) {
                    this.showMarketTooltip(resKey, mktCard);
                    return true;
                }
            }

            // Ultimate mygtukas
            const ultBtn = target.closest('#rtsUltimateBtn, .ult-btn');
            if (ultBtn) {
                this.showUltimateTooltip(ultBtn);
                return true;
            }

            // Pertekliaus išpardavimas
            const surplusBtn = target.closest('#quickSellSurplusBtn, .surplus-quick');
            if (surplusBtn) {
                this.showSurplusTooltip(surplusBtn);
                return true;
            }

            // Evoliucionavimas
            const evolveBtn = target.closest('#rtsEvolveBtn, .special-btn.evolve, #eraPillBtn');
            if (evolveBtn) {
                this.showEvolveTooltip(evolveBtn);
                return true;
            }

            // Populiacijos juosta
            const popGroup = target.closest('#rtsPopRibbonGroup');
            if (popGroup) {
                this.showAutoGatherTooltip(popGroup);
                return true;
            }

            return false;
        };

        const handleTouchStart = (e) => {
            const touchable = e.target.closest(
                '.rts-unit-btn, .stance-btn, .deck-t-opt-btn, .deck-t-card, .deck-upg-card, .deck-mkt-card, #rtsUltimateBtn, .ult-btn, #quickSellSurplusBtn, .surplus-quick, #rtsEvolveBtn, .special-btn.evolve, #eraPillBtn, #rtsPopRibbonGroup'
            );
            if (!touchable) return;

            // Jei tiesiogiai paspausta kario ikonėlė .unit-interactive-icon: info rodoma akimirksniu
            if (e.target.closest('.unit-interactive-icon')) {
                triggerElementInfo(touchable);
                didLongPress = true;
                return;
            }

            didLongPress = false;
            activeTouchTarget = touchable;
            if (e.touches && e.touches[0]) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }

            clearTimeout(touchLongTimer);
            touchLongTimer = setTimeout(() => {
                if (triggerElementInfo(activeTouchTarget)) {
                    didLongPress = true;
                    if (navigator.vibrate) {
                        try { navigator.vibrate(35); } catch(err) {}
                    }
                }
            }, 280);
        };

        const handleTouchMove = (e) => {
            if (e.touches && e.touches[0]) {
                const dist = Math.abs(e.touches[0].clientX - touchStartX) + Math.abs(e.touches[0].clientY - touchStartY);
                if (dist > 12) {
                    clearTimeout(touchLongTimer);
                }
            }
        };

        const handleTouchEnd = (e) => {
            clearTimeout(touchLongTimer);
            if (didLongPress) {
                if (e.cancelable) e.preventDefault();
            }
        };

        const handleTouchCancel = () => {
            clearTimeout(touchLongTimer);
        };

        // Paspaudimo blokavimas (Capture fazė): jei buvo ilgas paspaudimas (Long Press), pirkimas neįvyksta!
        window.addEventListener('click', (e) => {
            const icon = e.target.closest('.unit-interactive-icon');
            if (icon) {
                e.stopPropagation();
                e.preventDefault();
                const btn = icon.closest('.rts-unit-btn');
                if (btn) triggerElementInfo(btn);
                return;
            }

            if (didLongPress) {
                e.stopPropagation();
                e.preventDefault();
                didLongPress = false;
            }
        }, true);

        if (bottomDock) {
            bottomDock.addEventListener('touchstart', handleTouchStart, { passive: true });
            bottomDock.addEventListener('touchmove', handleTouchMove, { passive: true });
            bottomDock.addEventListener('touchend', handleTouchEnd);
            bottomDock.addEventListener('touchcancel', handleTouchCancel);
        }

        if (topBar) {
            topBar.addEventListener('touchstart', handleTouchStart, { passive: true });
            topBar.addEventListener('touchmove', handleTouchMove, { passive: true });
            topBar.addEventListener('touchend', handleTouchEnd);
            topBar.addEventListener('touchcancel', handleTouchCancel);
        }

        // Paslėpti tooltipą paspaudus kitur ekrane
        window.addEventListener('touchstart', (e) => {
            if (!e.target.closest('.rts-unit-btn, .deck-t-opt-btn, .deck-t-icon-hover, .deck-upg-card, .deck-mkt-card, .stance-btn, #rtsUltimateBtn, .ult-btn, #quickSellSurplusBtn, .surplus-quick, #rtsEvolveBtn, .special-btn.evolve, #eraPillBtn, #rtsPopRibbonGroup, #rtsUnitTooltip')) {
                this.hideUnitTooltip();
            }
        }, { passive: true });

        // Populiacijos juostos paspaudimas (Automatinės kasybos įjungimas / išjungimas)
        const popGroup = document.getElementById('rtsPopRibbonGroup');
        if (popGroup) {
            popGroup.style.cursor = 'pointer';
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            popGroup.title = isEn ? 'Click to toggle automatic worker gathering' : 'Spustelėkite, norėdami perjungti automatinę darbininkų kasybą';
            popGroup.addEventListener('click', () => {
                this.toggleAutoGather();
            });
        }
    }

    // ========================================================================
    // UI ATNAUJINIMAS
    // ========================================================================
        formatResource(val) {
        if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.0', '') + 'M';
        if (val >= 100000) return Math.floor(val / 1000) + 'k';
        return Math.floor(val).toString();
    }

    updateUI() {
        if (!this.ui) return;
        const res = this.playerResources;
        const eraData = RTS_DATA.AGES[this.playerEra];
        const eEraData = RTS_DATA.AGES[this.enemyEra];

        if (this.ui.playerGold) this.ui.playerGold.textContent = this.formatResource(this.playerGold);
        
        // Bendras Mūšio Laikmatis (niekada nesisinulina pereinant per epochas)
        if (this.ui.matchTimerBadge) {
            const totalSecs = Math.max(0, Math.floor(this.gameTime || 0));
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const hrs = Math.floor(mins / 60);
            if (hrs > 0) {
                const remainMins = mins % 60;
                this.ui.matchTimerBadge.textContent = `⏱️ ${hrs}:${remainMins < 10 ? '0' : ''}${remainMins}:${secs < 10 ? '0' : ''}${secs}`;
            } else {
                this.ui.matchTimerBadge.textContent = `⏱️ ${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
        }
        
        // Atnaujiname centrinį populiacijos ir armijos bloką resursų juostoje
        const ribbonPopEl = document.getElementById('popRibbonText');
        const isEn = (window.RTS_I18N && window.RTS_I18N.currentLang === 'en');
        if (ribbonPopEl) {
            const idle = res.idlePop || 0;
            const max = res.maxPop || 10;
            const livingSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
            const activeWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
            const total = idle + livingSoldiers + activeWorkers;
            const isFull = total >= max;
            const fullTag = isEn ? '<span style="color:#ef4444; font-weight:900;">(🔒 FULL)</span> ' : '<span style="color:#ef4444; font-weight:900;">(🔒 PILNA)</span> ';
            const baseTag = isEn ? '🏛️ Base:' : '🏛️ Bazėje:';
            
            if (isFull) {
                ribbonPopEl.innerHTML = `<b>${total}/${max}</b> ${fullTag}<span class="pop-pill-breakdown">(⚔️ ${livingSoldiers} • ⛏️ ${activeWorkers} • ${baseTag} ${idle})</span>`;
            } else {
                ribbonPopEl.innerHTML = `<b>${total}/${max}</b> <span class="pop-pill-breakdown">(⚔️ ${livingSoldiers} • ⛏️ ${activeWorkers} • ${baseTag} ${idle})</span>`;
            }
        }
        if (this.ui.playerXp) this.ui.playerXp.textContent = Math.floor(this.playerXp);
        if (this.ui.resFood) this.ui.resFood.textContent = this.formatResource(res.food);
        if (this.ui.resWood) this.ui.resWood.textContent = this.formatResource(res.wood);
        if (this.ui.resStone) this.ui.resStone.textContent = this.formatResource(res.stone);
        const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
        const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
        const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
        const totalPop = res.idlePop + activePlayerWorkers + livingPlayerSoldiers + queuedPlayerSoldiers;

        if (this.ui.resPop) this.ui.resPop.textContent = isEn ? `${res.idlePop} free / ${res.maxPop} (Total: ${totalPop})` : `${res.idlePop} laisvi / ${res.maxPop} (Viso: ${totalPop})`;

        // Realaus laiko atnaujinimas Valdymo Centre (jei langas atidarytas)
        const hubModal = document.getElementById('modalAutomationHub');
        if (hubModal && !hubModal.classList.contains('hidden')) {
            const popFreeEl = document.getElementById('hubPopFree');
            const popWorkersEl = document.getElementById('hubPopWorkers');
            const popSoldiersEl = document.getElementById('hubPopSoldiers');
            const popMaxEl = document.getElementById('hubPopMax');
            if (popFreeEl) popFreeEl.textContent = res.idlePop || 0;
            if (popWorkersEl) popWorkersEl.textContent = activePlayerWorkers;
            if (popSoldiersEl) popSoldiersEl.textContent = livingPlayerSoldiers + queuedPlayerSoldiers;
            if (popMaxEl) popMaxEl.textContent = `${totalPop}/${res.maxPop}`;
            this.updateHubTradeCalculations();
        }

        if (this.ui.hubGold) this.ui.hubGold.textContent = Math.floor(this.playerGold);
        if (this.ui.hubWood) this.ui.hubWood.textContent = Math.floor(res.wood);
        if (this.ui.hubStone) this.ui.hubStone.textContent = Math.floor(res.stone);
        if (this.ui.hubFood) this.ui.hubFood.textContent = Math.floor(res.food);

        // Būstų tobulinimo mygtukas
        const popCostGold = res.maxPop * 25;
        const popCostWood = res.maxPop * 15;
        const popCostStone = res.maxPop * 10;
        const canAffordPop = this.playerGold >= popCostGold && res.wood >= popCostWood && res.stone >= popCostStone;
        if (this.ui.upgradePopBtn) {
            this.ui.upgradePopBtn.classList.toggle('unaffordable', !canAffordPop);
            this.ui.upgradePopBtn.innerHTML = isEn
                ? `🏠 +4 Housing (${res.maxPop}👥)<br><small style="color:#f1c40f;">${popCostGold}💰 ${popCostWood}🪵 ${popCostStone}🪨</small>`
                : `🏠 +4 Būstai (${res.maxPop}👥)<br><small style="color:#f1c40f;">${popCostGold}💰 ${popCostWood}🪵 ${popCostStone}🪨</small>`;
        }

        // Gavybos įrankių tobulinimo mygtukas
        const toolCostGold = 60 + this.gatherAmount * 5;
        const toolCostWood = 40 + this.gatherAmount * 4;
        const canAffordTools = this.playerGold >= toolCostGold && res.wood >= toolCostWood;
        if (this.ui.upgradeToolsBtn) {
            this.ui.upgradeToolsBtn.classList.toggle('unaffordable', !canAffordTools);
            this.ui.upgradeToolsBtn.innerHTML = isEn
                ? `⛏️ +5 Gathering (+${this.gatherAmount})<br><small style="color:#f1c40f;">${toolCostGold}💰 ${toolCostWood}🪵</small>`
                : `⛏️ +5 Gavyba (+${this.gatherAmount})<br><small style="color:#f1c40f;">${toolCostGold}💰 ${toolCostWood}🪵</small>`;
        }

        if (totalPop < res.maxPop) {
            const timeLeft = Math.max(0, this.popSpawnInterval - this.popTimer);
            if (this.ui.popTimerText) this.ui.popTimerText.textContent = isEn ? `👶 New: ${timeLeft.toFixed(1)}s (-15🌾)` : `👶 Naujas: ${timeLeft.toFixed(1)}s (-15🌾)`;
        } else {
            if (this.ui.popTimerText) this.ui.popTimerText.textContent = isEn ? `👥 Max reached (${totalPop}/${res.maxPop})` : `👥 Maks. pasiektas (${totalPop}/${res.maxPop})`;
        }

        const cost = eraData ? eraData.evolveCost : null;
        const canEvolve = cost && (this.playerEra < 4) && (this.gameMode === 'sandbox' || (this.playerXp >= cost.xp && res.wood >= cost.wood && res.stone >= cost.stone && res.food >= cost.food));
        const eraPill = document.getElementById('eraPillBtn');
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V'];
        const shortEraNames = isEn ? ['Stone', 'Castle', 'Renaiss.', 'Modern', 'Future'] : ['Akmuo', 'Pilys', 'Renesans.', 'Modernas', 'Ateitis'];

        const pLvlEl = document.getElementById('playerEraLvl');
        const eLvlEl = document.getElementById('enemyEraLvl');
        const eIconEl = document.getElementById('enemyEraIcon');

        if (pLvlEl) pLvlEl.textContent = romanNumerals[this.playerEra] || `${this.playerEra + 1}`;

        if (canEvolve) {
            if (eraPill) {
                eraPill.classList.add('era-ready-pulse');
                eraPill.title = isEn ? '⚡ Evolution ready! Click to pan to base and choose civilization branch.' : '⚡ Evoliucija paruošta! Spustelėkite peršokti į bazę ir pasirinkti civilizacijos kelią.';
            }
            if (this.ui.playerEraName) {
                this.ui.playerEraName.innerHTML = `<span style="color:#fbbf24; font-weight:900;">${isEn ? 'Ready! ⚡' : 'Paruošta! ⚡'}</span>`;
            }
        } else {
            if (eraPill) {
                eraPill.classList.remove('era-ready-pulse');
                const curName = (window.RTS_I18N) ? window.RTS_I18N.getAgeName(this.playerEra) : (eraData ? eraData.name : 'Era');
                if (eraData && cost && this.playerEra < 4) {
                    const xpLeft = Math.max(0, cost.xp - this.playerXp);
                    const wLeft = Math.max(0, cost.wood - res.wood);
                    const sLeft = Math.max(0, cost.stone - res.stone);
                    const fLeft = Math.max(0, cost.food - res.food);
                    const missingParts = [];
                    if (xpLeft > 0) missingParts.push(`${xpLeft} ⭐XP`);
                    if (wLeft > 0) missingParts.push(`${wLeft} 🪵`);
                    if (sLeft > 0) missingParts.push(`${sLeft} 🪨`);
                    if (fLeft > 0) missingParts.push(`${fLeft} 🌾`);
                    eraPill.title = isEn ? `Current era: ${curName}. Missing for next: ${missingParts.join(', ')}. Click to pan to base.` : `Dabartinė epocha: ${curName}. Iki kitos trūksta: ${missingParts.join(', ')}. Spustelėkite peršokti į bazę.`;
                } else {
                    eraPill.title = isEn ? `Current era: ${curName}. Click to pan to base.` : `Dabartinė epocha: ${curName}. Spustelėkite peršokti į bazę.`;
                }
            }
            if (this.ui.playerEraName) {
                this.ui.playerEraName.textContent = shortEraNames[this.playerEra] || (isEn ? 'Stone' : 'Akmuo');
            }
        }

        if (this.ui.enemyEraName) {
            if (this.gameMode === 'monsters') {
                this.ui.enemyEraName.textContent = isEn ? `Wave #${this.monsterWave || 1}` : `Banga #${this.monsterWave || 1}`;
                if (eLvlEl) eLvlEl.style.display = 'none';
                if (eIconEl) eIconEl.textContent = '👾';
            } else if (this.gameMode === 'endless') {
                this.ui.enemyEraName.textContent = isEn ? `Wave #${this.survivalWave || 1}` : `Banga #${this.survivalWave || 1}`;
                if (eLvlEl) eLvlEl.style.display = 'none';
                if (eIconEl) eIconEl.textContent = '🌊';
            } else {
                this.ui.enemyEraName.textContent = shortEraNames[this.enemyEra] || (isEn ? 'Stone' : 'Akmuo');
                if (eLvlEl) {
                    eLvlEl.style.display = '';
                    eLvlEl.textContent = romanNumerals[this.enemyEra] || `${this.enemyEra + 1}`;
                }
                if (eIconEl) eIconEl.textContent = '💀';
            }
        }

        // Ultimate mygtukas
        if (eraData) {
            const ult = eraData.ultimate;
            const ultName = (window.RTS_I18N) ? window.RTS_I18N.getUltimateName(this.playerEra) : ult.name;
            const readyStr = isEn ? 'Ready!' : 'Paruošta!';
            if (this.ui.ultBtn) {
                const casts = this.playerUltimateCasts || 0;
                const nextDuration = ult.cooldown + casts * 15;
                if (this.playerUltimateCooldown <= 0) {
                    this.ui.ultBtn.classList.add('ready');
                    this.ui.ultBtn.classList.remove('unaffordable');
                    if (this.ui.ultBtnName) this.ui.ultBtnName.textContent = `⚡ ${ultName}`;
                    if (this.ui.ultBtnStatus) this.ui.ultBtnStatus.innerHTML = casts > 0 ? `<span class="hotkey-tag">[U] </span>${readyStr} (${nextDuration}s)` : `<span class="hotkey-tag">[U] </span>${readyStr}`;
                } else {
                    this.ui.ultBtn.classList.remove('ready');
                    this.ui.ultBtn.classList.add('unaffordable');
                    if (this.ui.ultBtnName) this.ui.ultBtnName.textContent = `⏳ ${ultName}`;
                    if (this.ui.ultBtnStatus) this.ui.ultBtnStatus.textContent = `${Math.ceil(this.playerUltimateCooldown)}s`;
                }
            }

            // Evoliucionuoti mygtukas (Epochos informacijos ir patobulinimo skydelis)
            const cost = eraData.evolveCost;
            if (this.ui.evolveBtn) {
                const curEraName = (window.RTS_I18N) ? window.RTS_I18N.getAgeName(this.playerEra) : (eraData ? eraData.name : 'Era');
                if (this.playerEra < 4) {
                    const nextEraData = RTS_DATA.AGES[this.playerEra + 1];
                    const nextEraName = (window.RTS_I18N) ? window.RTS_I18N.getAgeName(this.playerEra + 1) : (nextEraData ? nextEraData.name : 'Next Era');

                    const canEvolve = this.gameMode === 'sandbox' || (
                        this.playerXp >= cost.xp && 
                        res.wood >= cost.wood && 
                        res.stone >= cost.stone && 
                        res.food >= cost.food
                    );
                    const xpPct = Math.min(100, Math.max(0, Math.round((this.playerXp / cost.xp) * 100)));
                    this.ui.evolveBtn.disabled = false;
                    this.ui.evolveBtn.classList.toggle('unaffordable', !canEvolve);

                    if (canEvolve) {
                        this.ui.evolveBtn.classList.add('ready-evolve');
                        this.ui.evolveBtn.title = isEn ? `🌟 Era ready! Click to pan to base and choose branch above castle` : `🌟 Epocha paruošta! Spustelėkite peršokti į bazę ir pasirinkti šaką virš pilies`;
                        this.ui.evolveBtn.innerHTML = `
                            <div class="evolve-title-row" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:0 4px; white-space:nowrap; overflow:hidden;">
                                <span class="evolve-main-title" style="font-size:12.5px; font-weight:900; color:#ffffff; text-shadow:0 0 8px rgba(34,197,94,0.95); white-space:nowrap;">
                                    ${isEn ? '🌟 EVOLVE:' : '🌟 EVOLIUCIONUOTI:'} ${nextEraName.toUpperCase()}
                                </span>
                                <span style="font-size:11.5px; font-weight:900; color:#fef08a; text-shadow:0 0 6px rgba(254,240,138,0.6); white-space:nowrap;">
                                    ⭐ 100% (${this.formatResource(cost.xp)} XP)
                                </span>
                            </div>
                            <div class="evolve-xp-track" style="height:5px; margin:2px 0; min-height:5px;">
                                <div class="evolve-xp-fill" style="width: 100%;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-around; width:100%; font-size:10.5px; font-weight:900; padding:0 4px; white-space:nowrap;">
                                <span style="color:#4ade80;">🪵 ${this.formatResource(res.wood)}/${cost.wood}</span>
                                <span style="color:#4ade80;">🪨 ${this.formatResource(res.stone)}/${cost.stone}</span>
                                <span style="color:#4ade80;">🌾 ${this.formatResource(res.food)}/${cost.food}</span>
                            </div>
                        `;
                    } else {
                        this.ui.evolveBtn.classList.remove('ready-evolve');
                        this.ui.evolveBtn.title = isEn ? `Click to pan camera to base` : `Spustelėkite, kad kamera peršoktų į bazę`;

                        const xpColor = this.playerXp >= cost.xp ? '#4ade80' : '#fbbf24';
                        const woodColor = res.wood >= cost.wood ? '#4ade80' : '#f87171';
                        const stoneColor = res.stone >= cost.stone ? '#4ade80' : '#f87171';
                        const foodColor = res.food >= cost.food ? '#4ade80' : '#f87171';

                        this.ui.evolveBtn.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-weight:900; font-size:11.5px; line-height:1.15; padding:0 4px; white-space:nowrap; overflow:hidden;">
                                <div style="display:flex; align-items:center; gap:5px; white-space:nowrap;">
                                    <span style="color:#38bdf8; text-shadow:0 0 6px rgba(56,189,248,0.4);">🏛️ ${curEraName}</span>
                                    <span style="font-size:10px; color:#64748b; font-weight:800;">➔</span>
                                    <span style="font-size:11px; color:#cbd5e1; font-weight:700;">${nextEraName}</span>
                                </div>
                                <span style="color:${xpColor}; font-weight:900; font-size:11px; white-space:nowrap;">
                                    ⭐ XP: ${xpPct}% (${this.formatResource(this.playerXp)} / ${cost.xp})
                                </span>
                            </div>
                            <div class="evolve-xp-track" style="height:5px; margin:2px 0; min-height:5px;">
                                <div class="evolve-xp-fill" style="width: ${xpPct}%;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-around; width:100%; font-size:10.5px; font-weight:800; padding:0 4px; white-space:nowrap;">
                                <span style="color:${woodColor};">🪵 ${this.formatResource(res.wood)}/${cost.wood}</span>
                                <span style="color:${stoneColor};">🪨 ${this.formatResource(res.stone)}/${cost.stone}</span>
                                <span style="color:${foodColor};">🌾 ${this.formatResource(res.food)}/${cost.food}</span>
                            </div>
                        `;
                    }
                } else {
                    this.ui.evolveBtn.disabled = true;
                    this.ui.evolveBtn.classList.remove('ready-evolve');
                    this.ui.evolveBtn.classList.remove('unaffordable');
                    this.ui.evolveBtn.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-weight:900; font-size:13px; padding: 0 6px;">
                            <span style="color:#00f2fe; text-shadow: 0 0 10px rgba(0, 242, 254, 0.5);">${isEn ? '👑 MAX ERA — ' : '👑 MAKSIMALI EPOCHA — '}${curEraName}</span>
                            <span style="color:#c084fc;">⭐ ${this.formatResource(this.playerXp)} XP</span>
                        </div>
                        <div class="evolve-xp-track">
                            <div class="evolve-xp-fill" style="width: 100%; background: linear-gradient(90deg, #a855f7, #00f2fe);"></div>
                        </div>
                        <div style="font-size:11px; font-weight:700; color:#94a3b8; text-align:center;">
                            ${isEn ? '🏆 Highest pinnacle of civilization reached!' : '🏆 Pasiekta aukščiausia technologinės civilizacijos viršūnė!'}
                        </div>
                    `;
                }
            }

            // Greitas pertekliaus pardavimo mygtukas ir Prekyvietės mygtukas
            const isMaxEra = this.playerEra >= 4;
            const surplusCost = (!isMaxEra && eraData && eraData.evolveCost) ? eraData.evolveCost : { wood: 0, stone: 0, food: 0 };
            const surplusWood = Math.max(0, Math.floor(res.wood - (surplusCost ? surplusCost.wood : 0)));
            const surplusStone = Math.max(0, Math.floor(res.stone - (surplusCost ? surplusCost.stone : 0)));
            const surplusFood = Math.max(0, Math.floor(res.food - (surplusCost ? surplusCost.food : 0)));
            const hasSurplus = (surplusWood + surplusStone + surplusFood) > 0;

            const quickSellBtn = document.getElementById('quickSellSurplusBtn');
            if (quickSellBtn) {
                quickSellBtn.classList.toggle('unaffordable', !hasSurplus);
                quickSellBtn.title = isMaxEra
                    ? (isEn ? "Sell all materials for gold (max era reached)" : "Parduoti visas medžiagas į auksą (pasiekta maks. epocha)")
                    : (isEn ? "Sell surplus materials above evolution requirement" : "Parduoti medžiagų perteklių virš evoliucijos poreikio");
            }

            const modalSellSurplusBtn = document.getElementById('sellSurplusBtn');
            if (modalSellSurplusBtn) {
                modalSellSurplusBtn.classList.toggle('unaffordable', !hasSurplus);
                modalSellSurplusBtn.innerHTML = isMaxEra
                    ? (isEn ? `✨ SELL ALL MATERIALS (Max Era ➔ Gold 💰)` : `✨ PARDUOTI VISAS MEDŽIAGAS (Maksimali Epocha ➔ Auksas 💰)`)
                    : (isEn ? `✨ SELL ALL SURPLUS (Convert excess materials to gold 💰)` : `✨ PARDUOTI VISĄ PERTEKLIŲ (Paversti viršytas medžiagas į auksą 💰)`);
            }

            // Taktinės komandos (Stances)
            ['attack', 'defend', 'retreat'].forEach(st => {
                const btn = document.getElementById(`btnStance${st.charAt(0).toUpperCase() + st.slice(1)}`);
                if (btn) btn.classList.toggle('active', this.tacticalStance === st);
            });

            // Didvyrio mygtukas ir Aktyvi Galia su realaus laiko Stamina juosta
            const heroSpec = RTS_DATA.HEROES ? RTS_DATA.HEROES[this.playerEra] : null;
            const heroBtn = document.getElementById('rtsHeroBtn');
            const heroName = document.getElementById('rtsHeroName');
            const heroCost = document.getElementById('rtsHeroCost');
            const existingHero = this.soldiers.find(s => s.isPlayer && s.isHero && s.state !== 'DYING');
            const heroInQueue = this.spawnQueue.some(item => item.isHero);

            if (heroBtn && heroSpec) {
                if (existingHero) {
                    // Didvyris gyvas mūšyje -> mygtukas rodo jo gyvybes, staminą ir leidžia paleisti [H]
                    const skill = heroSpec.activeSkill || { name: 'Galia', cooldown: 14 };
                    const cd = existingHero.heroSkillCooldown || 0;
                    const maxCd = skill.cooldown || 14.0;
                    const staminaPct = Math.min(100, Math.max(0, Math.round((1 - (cd / maxCd)) * 100)));

                    heroBtn.disabled = false;
                    heroBtn.classList.remove('unaffordable');
                    heroBtn.classList.add('active-hero');

                    const hName = (window.RTS_I18N) ? window.RTS_I18N.getHeroName(this.playerEra) : heroSpec.name;
                    if (cd > 0) {
                        heroBtn.classList.remove('hero-skill-ready');
                        heroBtn.classList.add('hero-skill-cooldown');
                        if (heroName) {
                            heroName.innerHTML = `👑 ${hName} <span style="color:#f59e0b; font-size:8px; font-weight:bold;">(⏳${Math.ceil(cd)}s)</span>`;
                        }
                        if (heroCost) {
                            heroCost.innerHTML = `
                                <div style="display:flex; justify-content:space-between; width:100%; font-size:8.5px; padding:0 1px;">
                                    <span style="color:#4ade80; font-weight:bold;">❤️ ${Math.round(existingHero.hp)}</span>
                                    <span style="color:#00ffff; font-weight:bold;">⚡ ${staminaPct}%</span>
                                </div>
                                <div class="hero-stamina-track"><div class="hero-stamina-fill" style="width:${staminaPct}%;"></div></div>
                            `;
                        }
                    } else {
                        heroBtn.classList.add('hero-skill-ready');
                        heroBtn.classList.remove('hero-skill-cooldown');
                        if (heroName) {
                            heroName.innerHTML = `👑 ${hName} <span class="hotkey-tag hotkey-pill" style="color:#00ffff; font-size:8.5px; font-weight:900;">[4]</span>`;
                        }
                        if (heroCost) {
                            const readyLabel = isEn ? '⚡ READY!' : '⚡ PARUOŠTA!';
                            heroCost.innerHTML = `
                                <div style="display:flex; justify-content:space-between; width:100%; font-size:8.5px; padding:0 1px;">
                                    <span style="color:#4ade80; font-weight:bold;">❤️ ${Math.round(existingHero.hp)}</span>
                                    <span style="color:#fbbf24; font-weight:900;">${readyLabel}</span>
                                </div>
                                <div class="hero-stamina-track"><div class="hero-stamina-fill ready" style="width:100%;"></div></div>
                            `;
                        }
                    }
                } else {
                    // Didvyris dar nepasamdytas
                    const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
                    const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
                    const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
                    const currentEmployed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;
                    const hasFreePop = (res.idlePop || 0) > 0;
                    const isPopBlocked = !hasFreePop || (currentEmployed >= res.maxPop);

                    const canAffordHero = (this.gameMode === 'sandbox' || (this.playerGold >= heroSpec.costGold && res.food >= heroSpec.costFood)) && !isPopBlocked;
                    const isHeroDisabled = heroInQueue || !canAffordHero;
                    heroBtn.classList.toggle('unaffordable', isHeroDisabled);
                    heroBtn.classList.remove('active-hero', 'hero-skill-ready', 'hero-skill-cooldown');

                    const hName = (window.RTS_I18N) ? window.RTS_I18N.getHeroName(this.playerEra) : heroSpec.name;
                    if (heroName) {
                        heroName.innerHTML = `👑 ${hName} <span class="hotkey-tag hotkey-pill">[4]</span>`;
                    }
                    if (heroCost) {
                        const hPopLabel = isPopBlocked ? '<small style="color:#ef4444; font-weight:800;">(🔒 1👥)</small>' : '<small style="color:#38bdf8;">(1👥)</small>';
                        heroCost.innerHTML = `<span>💰 ${heroSpec.costGold} 🌾${heroSpec.costFood} ${hPopLabel}</span>`;
                    }
                }
            }

            // Karių mygtukai (Aktyvūs kol yra laisvų gyventojų bazėje!)
            const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
            const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
            const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
            const currentEmployed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;
            const hasFreePop = (res.idlePop || 0) > 0;
            const isPopBlocked = !hasFreePop || (currentEmployed >= res.maxPop);

            eraData.units.forEach((u, idx) => {
                const uUi = this.ui.unitBtns[idx];
                if (uUi && uUi.btn) {
                    const isQueueFull = this.spawnQueue.length >= this.maxQueueSize;
                    const isUnitForbidden = (this.currentChallenge && this.currentChallenge.disableUnits) ||
                        (this.currentChallenge && this.currentChallenge.allowedUnitTypes && !this.currentChallenge.allowedUnitTypes.includes(u.type));
                    const canAfford = (this.gameMode === 'sandbox' || this.playerGold >= u.costGold) && !isPopBlocked && !isQueueFull && !isUnitForbidden;
                    const isAuto = this.autoTrainIndex === idx;

                    uUi.btn.disabled = false;
                    uUi.btn.classList.toggle('unaffordable', !canAfford);
                    uUi.btn.classList.toggle('auto-active', isAuto);

                    const autoBadge = isAuto ? `<span class="auto-badge">⚡AUTO</span>` : '';
                    const uName = (window.RTS_I18N) ? window.RTS_I18N.getUnitName(u.id) : u.name;
                    const tipText = isEn ? 'Show unit info' : 'Rodyti kario info';
                    if (uUi.name) uUi.name.innerHTML = `<span class="unit-interactive-icon" data-unit-idx="${idx}" title="${tipText}">${u.icon}</span> ${uName} ${autoBadge} <span class="hotkey-tag hotkey-pill">[${idx + 1}]</span>`;
                    const popLabel = isPopBlocked ? '<small style="color:#ef4444; font-weight:800;">(🔒 1👥)</small>' : '<small style="color:#38bdf8;">(1👥)</small>';
                    if (uUi.cost) uUi.cost.innerHTML = `<span>💰 ${u.costGold} ${popLabel}</span>`;
                }
            });
        }

        if (window.updateDeckUI) window.updateDeckUI();
    }

    // ========================================================================
    // VIENINGAS MIESTO VALDYMO CENTRAS (UNIFIED AUTOMATION HUB WITH TABS)
    // ========================================================================
    openAutomationHub(targetTab) {
        const modal = document.getElementById('modalAutomationHub');
        if (!modal) return;

        const wLvl = this.getUpgradeLevel ? this.getUpgradeLevel('workers_ai', true) : 0;
        const mLvl = this.getUpgradeLevel ? this.getUpgradeLevel('military_academy', true) : 0;
        const tLvl = this.getUpgradeLevel ? this.getUpgradeLevel('trade_economy', true) : 0;

        // Tabų rodymas pagal atrakintus MAX lygius
        const tabBtnW = document.getElementById('hubTabBtn_workers');
        const tabBtnM = document.getElementById('hubTabBtn_military');
        const tabBtnAutoT = document.getElementById('hubTabBtn_auto_trade');
        const tabBtnT = document.getElementById('hubTabBtn_trade');
        const tabsContainer = document.getElementById('hubTabsContainer');

        if (tabBtnW) tabBtnW.style.display = (wLvl >= 5) ? 'block' : 'none';
        if (tabBtnM) tabBtnM.style.display = (mLvl >= 5) ? 'block' : 'none';
        if (tabBtnAutoT) tabBtnAutoT.style.display = (tLvl >= 5) ? 'block' : 'none'; // Auto Turgus TIK kai 5 lygis!
        if (tabBtnT) tabBtnT.style.display = 'block'; // Rankinis Turgus visada pasiekiamas Bazės lange!

        // Jei nėra MAX patobulinimų, paslepiame tabų juostą ir rodome pagrindinį Turgaus langą
        const hasSpecialTabs = (wLvl >= 5 || mLvl >= 5 || tLvl >= 5);
        if (tabsContainer) {
            tabsContainer.style.display = hasSpecialTabs ? 'flex' : 'none';
        }

        // Parinkti pradinį aktyvų tabą
        let activeTab = targetTab || 'trade';
        if (activeTab === 'workers' && wLvl < 5) activeTab = 'trade';
        if (activeTab === 'military' && mLvl < 5) activeTab = 'trade';
        if (activeTab === 'auto_trade' && tLvl < 5) activeTab = 'trade';

        // Užpildome 1 Tabo (Darbininkai) reikšmes
        const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
        const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
        const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
        const totalEmployed = livingPlayerSoldiers + queuedPlayerSoldiers + activePlayerWorkers;

        const maxPop = (this.playerResources && this.playerResources.maxPop) || 20;
        const freePop = Math.max(0, (this.playerResources && this.playerResources.idlePop) || 0);
        const popFreeEl = document.getElementById('hubPopFree');
        const popWorkersEl = document.getElementById('hubPopWorkers');
        const popSoldiersEl = document.getElementById('hubPopSoldiers');
        const popMaxEl = document.getElementById('hubPopMax');
        if (popFreeEl) popFreeEl.textContent = freePop;
        if (popWorkersEl) popWorkersEl.textContent = activePlayerWorkers;
        if (popSoldiersEl) popSoldiersEl.textContent = livingPlayerSoldiers + queuedPlayerSoldiers;
        if (popMaxEl) popMaxEl.textContent = `${totalEmployed + freePop}/${maxPop}`;

        const wCfg = this.autoGatherConfig || {};
        const chkW = document.getElementById('cfgWorkerEnabled');
        const sldWood = document.getElementById('cfgWorkerWoodSlider');
        const sldStone = document.getElementById('cfgWorkerStoneSlider');
        const sldFood = document.getElementById('cfgWorkerFoodSlider');
        const sldGold = document.getElementById('cfgWorkerGoldSlider');
        const sldReserve = document.getElementById('cfgWorkerReserveSlider');
        const chkGoldSafe = document.getElementById('cfgWorkerGoldSafe');
        const summaryEl = document.getElementById('valWorkerAllocationSummary');

        if (chkW) chkW.checked = (wCfg.enabled !== false);
        if (chkGoldSafe) chkGoldSafe.checked = (wCfg.centerGoldSafe !== false);

        if (sldReserve) {
            sldReserve.min = 0;
            sldReserve.max = Math.min(30, maxPop);
            sldReserve.value = Math.min(30, Math.max(0, wCfg.minReservedPop !== undefined ? wCfg.minReservedPop : 3));
        }

        if (!this.hubWorkerBaseline) {
            this.hubWorkerBaseline = {
                w: wCfg.woodLimit !== undefined ? wCfg.woodLimit : 1,
                s: wCfg.stoneLimit !== undefined ? wCfg.stoneLimit : 1,
                f: wCfg.foodLimit !== undefined ? wCfg.foodLimit : 1,
                g: wCfg.goldLimit !== undefined ? wCfg.goldLimit : (wCfg.centerGold !== false ? 1 : 0)
            };
        }

        const initialW = wCfg.woodLimit !== undefined ? wCfg.woodLimit : 1;
        const initialS = wCfg.stoneLimit !== undefined ? wCfg.stoneLimit : 1;
        const initialF = wCfg.foodLimit !== undefined ? wCfg.foodLimit : 1;
        const initialG = wCfg.goldLimit !== undefined ? wCfg.goldLimit : (wCfg.centerGold !== false ? 1 : 0);

        let currentValues = {
            w: initialW,
            s: initialS,
            f: initialF,
            g: initialG
        };
        if (sldWood) sldWood.value = initialW;
        if (sldStone) sldStone.value = initialS;
        if (sldFood) sldFood.value = initialF;
        if (sldGold) sldGold.value = initialG;

        const syncSliders = (source) => {
            const maxPop = (this.playerResources && this.playerResources.maxPop) || 60;
            const curReserve = sldReserve ? Math.max(0, Math.min(maxPop, parseInt(sldReserve.value) || 0)) : 2;
            const sldMilSoldiers = document.getElementById('cfgMilMaxSoldiersSlider');
            const targetArmy = (sldMilSoldiers && parseInt(sldMilSoldiers.value)) ? parseInt(sldMilSoldiers.value) : (mCfg.maxSoldiers || 12);

            // Gyvos populiacijos reikšmės (be senų closure reikšmių)
            const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
            const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
            const currentSoldiers = livingPlayerSoldiers + queuedPlayerSoldiers;
            const activeWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED');
            const activePlayerWorkers = activeWorkers.length;
            const freePop = Math.max(0, (this.playerResources && this.playerResources.idlePop) || 0);

            // STABILI IR TEISINGA MAKSIMALI DARBININKŲ TALPA:
            // Rezervas skirtas kariuomenei. Kariai samdomi iš šio rezervo.
            const soldierReservation = Math.max(curReserve, currentSoldiers);
            const maxWorkerCapacity = Math.max(0, maxPop - soldierReservation);

            // Atnaujiname viršutinę populiacijos eilutę
            const popFreeEl = document.getElementById('hubPopFree');
            const popWorkersEl = document.getElementById('hubPopWorkers');
            const popSoldiersEl = document.getElementById('hubPopSoldiers');
            const popReserveStatEl = document.getElementById('hubPopReserveStat');
            const popMaxEl = document.getElementById('hubPopMax');
            if (popFreeEl) popFreeEl.textContent = freePop;
            if (popWorkersEl) popWorkersEl.textContent = activePlayerWorkers;
            if (popSoldiersEl) popSoldiersEl.textContent = currentSoldiers;
            if (popReserveStatEl) popReserveStatEl.textContent = curReserve;
            if (popMaxEl) popMaxEl.textContent = `${currentSoldiers + activePlayerWorkers + freePop}/${maxPop}`;

            let w = currentValues.w;
            let s = currentValues.s;
            let f = currentValues.f;
            let g = currentValues.g;
            let totalAssigned = w + s + f + g;

            if (source && (source === sldWood || source === sldStone || source === sldFood || source === sldGold)) {
                // Vartotojas keičia vieną iš 4 resursų slankiklių (tempdamas arba mygtukais +/-)
                const keyMap = new Map([
                    [sldWood, 'w'], [sldStone, 's'], [sldFood, 'f'], [sldGold, 'g']
                ]);
                const key = keyMap.get(source);
                const requestedVal = Math.max(0, Math.min(maxWorkerCapacity, parseInt(source.value) || 0));
                const oldVal = currentValues[key];
                const delta = requestedVal - oldVal;

                if (delta > 0) {
                    const totalNow = currentValues.w + currentValues.s + currentValues.f + currentValues.g;
                    const freeSpace = Math.max(0, maxWorkerCapacity - totalNow);
                    const fromFree = Math.min(delta, freeSpace);
                    const borrowNeeded = delta - fromFree;
                    const otherKeys = ['w', 's', 'f', 'g'].filter(k => k !== key);
                    const otherSum = otherKeys.reduce((sum, k) => sum + currentValues[k], 0);

                    if (borrowNeeded > 0 && otherSum > 0) {
                        const actualBorrow = Math.min(borrowNeeded, otherSum);
                        let allocatedDeduct = 0;
                        for (let i = 0; i < otherKeys.length; i++) {
                            const ok = otherKeys[i];
                            let deduct;
                            if (i === otherKeys.length - 1) {
                                deduct = actualBorrow - allocatedDeduct;
                            } else {
                                deduct = Math.round(currentValues[ok] * (actualBorrow / otherSum));
                                deduct = Math.min(currentValues[ok], deduct);
                                allocatedDeduct += deduct;
                            }
                            currentValues[ok] -= deduct;
                        }
                        currentValues[key] = oldVal + fromFree + actualBorrow;
                    } else {
                        currentValues[key] = oldVal + fromFree;
                    }
                } else {
                    currentValues[key] = Math.max(0, requestedVal);
                }

                w = currentValues.w;
                s = currentValues.s;
                f = currentValues.f;
                g = currentValues.g;
                if (sldWood) sldWood.value = w;
                if (sldStone) sldStone.value = s;
                if (sldFood) sldFood.value = f;
                if (sldGold) sldGold.value = g;
                totalAssigned = w + s + f + g;
            } else {
                // Keičiant rezervą, karių limitą arba atidarius langą:
                if (source === sldReserve) {
                    const prevReserve = (this.lastHubReserveVal !== undefined) ? this.lastHubReserveVal : curReserve;
                    const deltaReserve = curReserve - prevReserve;

                    if (deltaReserve > 0) {
                        // Vartotojas DIDINA rezervą -> jei viršijama sumažėjusi talpa, kiti slankikliai proporcingai MAŽĖJA!
                        if (totalAssigned > maxWorkerCapacity) {
                            if (maxWorkerCapacity === 0) {
                                w = 0; s = 0; f = 0; g = 0;
                            } else if (totalAssigned > 0) {
                                const ratio = maxWorkerCapacity / totalAssigned;
                                w = Math.floor(w * ratio);
                                s = Math.floor(s * ratio);
                                f = Math.floor(f * ratio);
                                g = Math.max(0, maxWorkerCapacity - (w + s + f));
                            }
                        }
                    }
                    // Kai vartotojas MAŽINA rezervą (deltaReserve < 0):
                    // Talpa padidėja ("daugiau vietos"), todėl kiti slankikliai GALI didėti pagal žaidėjo norą (padidėja jų max riba ir laisvos darbo vietos).
                    // Slankikliai dirbtinai patys neišsipučia į vieną resursą!
                    currentValues.w = w;
                    currentValues.s = s;
                    currentValues.f = f;
                    currentValues.g = g;
                    if (sldWood) sldWood.value = w;
                    if (sldStone) sldStone.value = s;
                    if (sldFood) sldFood.value = f;
                    if (sldGold) sldGold.value = g;
                    totalAssigned = w + s + f + g;
                    this.lastHubReserveVal = curReserve;
                } else {
                    this.lastHubReserveVal = curReserve;
                    if (totalAssigned > maxWorkerCapacity) {
                        if (maxWorkerCapacity === 0) {
                            w = 0; s = 0; f = 0; g = 0;
                        } else if (totalAssigned > 0) {
                            const ratio = maxWorkerCapacity / totalAssigned;
                            w = Math.floor(w * ratio);
                            s = Math.floor(s * ratio);
                            f = Math.floor(f * ratio);
                            g = Math.max(0, maxWorkerCapacity - (w + s + f));
                        }
                        currentValues.w = w;
                        currentValues.s = s;
                        currentValues.f = f;
                        currentValues.g = g;
                        if (sldWood) sldWood.value = w;
                        if (sldStone) sldStone.value = s;
                        if (sldFood) sldFood.value = f;
                        if (sldGold) sldGold.value = g;
                        totalAssigned = w + s + f + g;
                    }
                }
            }

            if (totalAssigned > 0) {
                this.hubWorkerBaseline = { w, s, f, g };
            }

            // Kiekvienas slankiklis gali siekti maksimalią darbininkų talpą
            if (sldWood) sldWood.max = maxWorkerCapacity;
            if (sldStone) sldStone.max = maxWorkerCapacity;
            if (sldFood) sldFood.max = maxWorkerCapacity;
            if (sldGold) sldGold.max = maxWorkerCapacity;
            if (sldReserve) sldReserve.max = Math.min(30, maxPop);

            const bWood = document.getElementById('valWorkerWood');
            const bStone = document.getElementById('valWorkerStone');
            const bFood = document.getElementById('valWorkerFood');
            const bGold = document.getElementById('valWorkerGold');
            const bReserve = document.getElementById('valWorkerReserve');

            const woodActive = activeWorkers.filter(wk => wk.role === 'wood').length;
            const stoneActive = activeWorkers.filter(wk => wk.role === 'stone').length;
            const foodActive = activeWorkers.filter(wk => wk.role === 'food').length;
            const goldActive = activeWorkers.filter(wk => wk.role === 'center_gold').length;

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            if (bWood) bWood.innerHTML = isEn
                ? `${w} wrk. <small style="color:${woodActive >= w && w > 0 ? '#4ade80' : '#67e8f9'}; font-weight:normal;">(${woodActive} working)</small>`
                : `${w} darb. <small style="color:${woodActive >= w && w > 0 ? '#4ade80' : '#67e8f9'}; font-weight:normal;">(${woodActive} dirba)</small>`;
            if (bStone) bStone.innerHTML = isEn
                ? `${s} wrk. <small style="color:${stoneActive >= s && s > 0 ? '#4ade80' : '#67e8f9'}; font-weight:normal;">(${stoneActive} working)</small>`
                : `${s} darb. <small style="color:${stoneActive >= s && s > 0 ? '#4ade80' : '#67e8f9'}; font-weight:normal;">(${stoneActive} dirba)</small>`;
            if (bFood) bFood.innerHTML = isEn
                ? `${f} wrk. <small style="color:${foodActive >= f && f > 0 ? '#4ade80' : '#67e8f9'}; font-weight:normal;">(${foodActive} working)</small>`
                : `${f} darb. <small style="color:${foodActive >= f && f > 0 ? '#4ade80' : '#67e8f9'}; font-weight:normal;">(${foodActive} dirba)</small>`;
            if (bGold) bGold.innerHTML = isEn
                ? `${g} wrk. <small style="color:${goldActive >= g && g > 0 ? '#4ade80' : '#fbbf24'}; font-weight:normal;">(${goldActive} working)</small>`
                : `${g} darb. <small style="color:${goldActive >= g && g > 0 ? '#4ade80' : '#fbbf24'}; font-weight:normal;">(${goldActive} dirba)</small>`;
            const neededForMil = Math.max(0, curReserve - currentSoldiers);
            if (bReserve) bReserve.innerHTML = isEn
                ? `${curReserve} soldier quota <small style="color:#67e8f9; font-weight:normal;">(${neededForMil} in base 👥)</small>`
                : `${curReserve} karių kvota <small style="color:#67e8f9; font-weight:normal;">(${neededForMil} bazėje 👥)</small>`;

            if (summaryEl) {
                const freeToAssign = Math.max(0, maxWorkerCapacity - totalAssigned);
                summaryEl.innerHTML = isEn
                    ? `Assigned: <b style="color:${totalAssigned >= maxWorkerCapacity ? '#f59e0b' : '#38bdf8'};">${totalAssigned}</b> / <b>${maxWorkerCapacity}</b> <span style="color:#94a3b8; font-weight:normal;">(Open slots: <b style="color:#4ade80;">${freeToAssign}</b>)</span>`
                    : `Paskirstyta: <b style="color:${totalAssigned >= maxWorkerCapacity ? '#f59e0b' : '#38bdf8'};">${totalAssigned}</b> / <b>${maxWorkerCapacity}</b> <span style="color:#94a3b8; font-weight:normal;">(Laisvų darbo vietų: <b style="color:#4ade80;">${freeToAssign}</b>)</span>`;
            }

            const limitInfoEl = document.getElementById('valWorkerLimitInfo');
            if (limitInfoEl) {
                limitInfoEl.innerHTML = isEn
                    ? `Max workers: <b style="color:#f59e0b;">${maxWorkerCapacity}</b>👥`
                    : `Maks. darbininkams: <b style="color:#f59e0b;">${maxWorkerCapacity}</b>👥`;
            }

            // Auto Trade gyva būsena
            const stWood = document.getElementById('autoTradeStockWood');
            const stStone = document.getElementById('autoTradeStockStone');
            const stFood = document.getElementById('autoTradeStockFood');
            const stGold = document.getElementById('autoTradeStockGold');
            if (stWood && this.playerResources) stWood.textContent = Math.floor(this.playerResources.wood || 0);
            if (stStone && this.playerResources) stStone.textContent = Math.floor(this.playerResources.stone || 0);
            if (stFood && this.playerResources) stFood.textContent = Math.floor(this.playerResources.food || 0);
            if (stGold && this.playerResources) stGold.textContent = Math.floor(this.playerResources.gold || 0);

            // Atnaujiname konfigūraciją realiu laiku
            if (this.autoGatherConfig) {
                this.autoGatherConfig.woodLimit = w;
                this.autoGatherConfig.stoneLimit = s;
                this.autoGatherConfig.foodLimit = f;
                this.autoGatherConfig.goldLimit = g;
                this.autoGatherConfig.minReservedPop = curReserve;
            }
        };

        const endDrag = () => {
            const curW = sldWood ? (parseInt(sldWood.value) || 0) : 0;
            const curS = sldStone ? (parseInt(sldStone.value) || 0) : 0;
            const curF = sldFood ? (parseInt(sldFood.value) || 0) : 0;
            const curG = sldGold ? (parseInt(sldGold.value) || 0) : 0;
            if (curW + curS + curF + curG > 0) {
                this.hubWorkerBaseline = { w: curW, s: curS, f: curF, g: curG };
            }
        };

        [sldWood, sldStone, sldFood, sldGold].forEach(el => {
            if (el) {
                el.addEventListener('change', endDrag);
                el.addEventListener('pointerup', endDrag);
                el.addEventListener('touchend', endDrag);
            }
        });

        if (sldWood) {
            sldWood.value = wCfg.woodLimit !== undefined ? wCfg.woodLimit : 1;
            sldWood.oninput = () => syncSliders(sldWood);
        }
        if (sldStone) {
            sldStone.value = wCfg.stoneLimit !== undefined ? wCfg.stoneLimit : 1;
            sldStone.oninput = () => syncSliders(sldStone);
        }
        if (sldFood) {
            sldFood.value = wCfg.foodLimit !== undefined ? wCfg.foodLimit : 1;
            sldFood.oninput = () => syncSliders(sldFood);
        }
        if (sldGold) {
            sldGold.value = wCfg.goldLimit !== undefined ? wCfg.goldLimit : (wCfg.centerGold !== false ? 1 : 0);
            sldGold.oninput = () => syncSliders(sldGold);
        }
        if (sldReserve) {
            sldReserve.oninput = () => syncSliders(sldReserve);
        }

        // Pirminis subalansavimas atidarius langą
        syncSliders(null);

        // Užpildome 2 Tabo (Karo Taktika) reikšmes
        const mCfg = this.autoMilitaryConfig || {};
        const chkM = document.getElementById('cfgMilEnabled');
        const chkHero = document.getElementById('cfgMilHero');
        const sldMilGold = document.getElementById('cfgMilGoldSlider');
        const sldMilSoldiers = document.getElementById('cfgMilMaxSoldiersSlider');

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const pcsText = isEn ? 'pcs' : 'vnt.';
        const soldiersText = isEn ? 'soldiers' : 'karių';

        if (chkM) chkM.checked = !!mCfg.enabled;
        if (chkHero) chkHero.checked = (mCfg.autoHero !== false);
        if (sldMilSoldiers) {
            sldMilSoldiers.max = maxPop;
            sldMilSoldiers.value = mCfg.maxSoldiers !== undefined ? Math.min(maxPop, Math.max(1, mCfg.maxSoldiers)) : 12;
            const bSoldiers = document.getElementById('valMilMaxSoldiers');
            if (bSoldiers) bSoldiers.textContent = `${sldMilSoldiers.value} ${soldiersText}`;
            sldMilSoldiers.oninput = (e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                if (bSoldiers) bSoldiers.textContent = `${val} ${soldiersText}`;
                mCfg.maxSoldiers = val;
                this.autoMilitaryConfig.maxSoldiers = val;
                // Kai mažiname karių skaičių, gražiai atsilaisvina ir didėja darbininkų slankiklis!
                syncSliders(sldMilSoldiers);
            };
        }
        if (sldMilGold) {
            sldMilGold.value = mCfg.minReserveGold || 200;
            const b = document.getElementById('valMilGold');
            if (b) b.textContent = `${sldMilGold.value} 💰`;
            sldMilGold.oninput = (e) => { if (b) b.textContent = `${e.target.value} 💰`; };
        }
        this.selectMilMode(mCfg.mode || 'balanced', false);

        // Užpildome 3 Tabo (Auto Rinka) reikšmes (TIK KAI tLvl >= 5)
        const tCfg = this.autoTradeConfig || {};
        const chkT = document.getElementById('cfgTradeEnabled');
        const sldTrWood = document.getElementById('cfgTradeWoodSlider');
        const sldTrStone = document.getElementById('cfgTradeStoneSlider');
        const sldTrFood = document.getElementById('cfgTradeFoodSlider');

        if (chkT) chkT.checked = !!tCfg.enabled;
        if (sldTrWood) {
            sldTrWood.value = tCfg.woodThreshold !== undefined ? tCfg.woodThreshold : 250;
            const b = document.getElementById('valTradeWood');
            if (b) b.textContent = `${sldTrWood.value} ${pcsText}`;
            sldTrWood.oninput = (e) => { if (b) b.textContent = `${e.target.value} ${pcsText}`; };
        }
        if (sldTrStone) {
            sldTrStone.value = tCfg.stoneThreshold !== undefined ? tCfg.stoneThreshold : 250;
            const b = document.getElementById('valTradeStone');
            if (b) b.textContent = `${sldTrStone.value} ${pcsText}`;
            sldTrStone.oninput = (e) => { if (b) b.textContent = `${e.target.value} ${pcsText}`; };
        }
        if (sldTrFood) {
            sldTrFood.value = tCfg.foodThreshold !== undefined ? tCfg.foodThreshold : 150;
            const b = document.getElementById('valTradeFood');
            if (b) b.textContent = `${sldTrFood.value} ${pcsText}`;
            sldTrFood.oninput = (e) => { if (b) b.textContent = `${e.target.value} ${pcsText}`; };
        }

        // Pajungiame lanksčios rankinės prekybos įvestis Bazės lange (4 Tabas)
        const hubTradeInput = document.getElementById('hubTradeAmountInput');
        const hubTradeSlider = document.getElementById('hubTradeAmountSlider');
        if (hubTradeInput) hubTradeInput.oninput = () => this.updateHubTradeCalculations();
        if (hubTradeSlider) {
            hubTradeSlider.oninput = () => {
                if (hubTradeInput) hubTradeInput.value = hubTradeSlider.value;
                this.updateHubTradeCalculations();
            };
        }
        this.selectHubTradeResource(this.currentHubTradeResource || 'wood');

        this.switchHubTab(activeTab);

        // Automatinis nustatymų išsaugojimas realiu laiku (Live Sync be mygtuko)
        modal.oninput = (e) => {
            if (e && e.target && e.target.id && (e.target.id.startsWith('hubTradeAmount') || e.target.id.startsWith('hubTradeCurrent'))) return;
            this.saveHubConfig(false);
        };
        modal.onchange = (e) => {
            if (e && e.target && e.target.id && (e.target.id.startsWith('hubTradeAmount') || e.target.id.startsWith('hubTradeCurrent'))) return;
            this.saveHubConfig(false);
        };

        if (this.hubLiveInterval) clearInterval(this.hubLiveInterval);
        this.hubLiveInterval = setInterval(() => {
            const m = document.getElementById('modalAutomationHub');
            if (m && !m.classList.contains('hidden')) {
                syncSliders(null);
            } else {
                clearInterval(this.hubLiveInterval);
                this.hubLiveInterval = null;
            }
        }, 300);

        modal.classList.remove('hidden');
    }

    switchHubTab(tab) {
        const tabs = ['workers', 'military', 'auto_trade', 'trade'];
        tabs.forEach(t => {
            const btn = document.getElementById(`hubTabBtn_${t}`);
            const panel = document.getElementById(`hubPanel_${t}`);
            const isActive = (t === tab);

            if (btn) {
                btn.classList.toggle('active', isActive);
                if (isActive) {
                    if (t === 'workers') {
                        btn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
                        btn.style.borderColor = '#38bdf8';
                        btn.style.color = '#fff';
                    } else if (t === 'military') {
                        btn.style.background = 'linear-gradient(135deg, #dc2626, #991b1b)';
                        btn.style.borderColor = '#f87171';
                    } else if (t === 'auto_trade') {
                        btn.style.background = 'linear-gradient(135deg, #d97706, #b45309)';
                        btn.style.borderColor = '#fbbf24';
                        btn.style.color = '#fff';
                    } else if (t === 'trade') {
                        btn.style.background = 'linear-gradient(135deg, #059669, #047857)';
                        btn.style.borderColor = '#34d399';
                        btn.style.color = '#fff';
                    }
                } else {
                    btn.style.background = 'transparent';
                    btn.style.borderColor = 'transparent';
                    btn.style.color = '#94a3b8';
                }
            }
            if (panel) {
                panel.classList.toggle('hidden', !isActive);
            }
        });

        const badge = document.getElementById('hubModalBadge');
        if (badge) {
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            if (tab === 'trade') {
                badge.textContent = isEn ? '⚖️ MARKET' : '⚖️ TURGUS';
                badge.style.background = '#d97706';
            } else if (tab === 'workers') {
                badge.textContent = isEn ? '⛏️ WORKERS' : '⛏️ DARBININKAI';
                badge.style.background = '#0284c7';
            } else if (tab === 'military') {
                badge.textContent = isEn ? '⚔️ TACTICS' : '⚔️ KARO TAKTIKA';
                badge.style.background = '#dc2626';
            } else if (tab === 'auto_trade') {
                badge.textContent = isEn ? '🤖 AUTO MARKET' : '🤖 AUTO RINKA';
                badge.style.background = '#d97706';
            }
        }
    }

    selectMilMode(mode, playSound = true) {
        this.selectedMilMode = mode;
        const cards = ['balanced', 'melee', 'ranged', 'heavy'];
        cards.forEach(m => {
            const card = document.getElementById(`milCard_${m}`);
            if (card) {
                const isActive = (m === mode);
                card.classList.toggle('active', isActive);
                if (isActive) {
                    card.style.borderColor = '#ef4444';
                    card.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
                    card.style.background = 'rgba(239, 68, 68, 0.15)';
                } else {
                    card.style.borderColor = '#334155';
                    card.style.boxShadow = 'none';
                    card.style.background = '#0f172a';
                }
            }
        });
        this.saveHubConfig(false);
        if (playSound && this.sound) this.sound.playClick();
    }

    // ========================================================================
    // BAZĖS VALDYMO CENTRO TURGUS & PREKYBA (HUB TRADE & CUSTOM AMOUNTS)
    // ========================================================================
    selectHubTradeResource(resType) {
        this.currentHubTradeResource = resType;
        const res = this.playerResources || {};
        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const pcsText = isEn ? 'pcs' : 'vnt.';
        ['wood', 'stone', 'food'].forEach(r => {
            const btn = document.getElementById(`hubResBtn_${r}`);
            const stockEl = document.getElementById(`hubResCardStock_${r}`);
            if (stockEl) {
                stockEl.textContent = `${Math.floor(res[r] || 0)} ${pcsText}`;
            }
            if (btn) {
                const isSel = (r === resType);
                btn.style.borderColor = isSel ? '#f59e0b' : '#334155';
                btn.style.boxShadow = isSel ? '0 0 14px rgba(245, 158, 11, 0.45)' : 'none';
            }
        });
        this.updateHubTradeCalculations();
        if (this.sound) this.sound.playClick();
    }

    updateHubTradeCalculations() {
        const type = this.currentHubTradeResource || 'wood';
        const res = this.playerResources || {};
        const stock = Math.floor(res[type] || 0);
        const gold = Math.floor(this.playerGold || 0);

        const rates = {
            wood: { icon: '🪵', sell: 2.0, buy: 2.5 },
            stone: { icon: '🪨', sell: 2.5, buy: 3.0 },
            food: { icon: '🌾', sell: 1.5, buy: 2.0 }
        };
        const r = rates[type] || rates.wood;

        const inp = document.getElementById('hubTradeAmountInput');
        const slider = document.getElementById('hubTradeAmountSlider');
        let amt = parseInt(inp ? inp.value : 10) || 0;
        if (amt < 1) amt = 1;

        if (slider && document.activeElement !== slider) {
            slider.value = amt;
        }

        const stockEl = document.getElementById('hubTradeCurrentStock');
        const goldEl = document.getElementById('hubTradeCurrentGold');
        const rateBadge = document.getElementById('hubTradeRateBadge');

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
        const pcsText = isEn ? 'pcs' : 'vnt.';

        ['wood', 'stone', 'food'].forEach(k => {
            const el = document.getElementById(`hubResCardStock_${k}`);
            if (el) el.textContent = `${Math.floor(res[k] || 0)} ${pcsText}`;
        });

        if (stockEl) stockEl.textContent = `${stock} ${r.icon}`;
        if (goldEl) goldEl.textContent = `${gold} 💰`;
        if (rateBadge) rateBadge.textContent = isEn
            ? `Sell: +${Math.round(10 * r.sell)}💰 | Buy: ${Math.round(10 * r.buy)}💰`
            : `Parduoti: +${Math.round(10 * r.sell)}💰 | Pirkti: ${Math.round(10 * r.buy)}💰`;

        const sellGold = Math.floor(amt * r.sell);
        const buyGold = Math.ceil(amt * r.buy);

        const canSell = stock >= amt && amt > 0;
        const canBuy = (this.gameMode === 'sandbox') || (gold >= buyGold && amt > 0);

        const sellBtn = document.getElementById('hubTradeExecuteSellBtn');
        if (sellBtn) {
            sellBtn.innerHTML = isEn
                ? `💰 Sell ${amt} ${r.icon} (+${sellGold} 💰)`
                : `💰 Parduoti ${amt} ${r.icon} (+${sellGold} 💰)`;
            sellBtn.classList.toggle('unaffordable', !canSell);
        }

        const buyBtn = document.getElementById('hubTradeExecuteBuyBtn');
        if (buyBtn) {
            buyBtn.innerHTML = isEn
                ? `🛒 Buy ${amt} ${r.icon} (-${buyGold} 💰)`
                : `🛒 Pirkti ${amt} ${r.icon} (-${buyGold} 💰)`;
            buyBtn.classList.toggle('unaffordable', !canBuy);
        }
    }

    adjustHubTradeAmount(delta) {
        const inp = document.getElementById('hubTradeAmountInput');
        const slider = document.getElementById('hubTradeAmountSlider');
        let cur = parseInt(inp ? inp.value : 10) || 10;
        cur = Math.max(1, cur + delta);
        if (inp) inp.value = cur;
        if (slider) slider.value = cur;
        this.updateHubTradeCalculations();
    }

    setHubTradeMaxStock() {
        const type = this.currentHubTradeResource || 'wood';
        const stock = Math.floor((this.playerResources && this.playerResources[type]) || 0);
        const inp = document.getElementById('hubTradeAmountInput');
        const slider = document.getElementById('hubTradeAmountSlider');
        const val = Math.max(1, stock);
        if (inp) inp.value = val;
        if (slider) slider.value = val;
        this.updateHubTradeCalculations();
    }

    setHubTradeMaxGold() {
        const type = this.currentHubTradeResource || 'wood';
        const rates = { wood: 2.5, stone: 3.0, food: 2.0 };
        const rate = rates[type] || 2.5;
        const gold = Math.floor(this.playerGold || 0);
        const maxAffordable = Math.floor(gold / rate);
        const inp = document.getElementById('hubTradeAmountInput');
        const slider = document.getElementById('hubTradeAmountSlider');
        const val = Math.max(1, maxAffordable);
        if (inp) inp.value = val;
        if (slider) slider.value = val;
        this.updateHubTradeCalculations();
    }

    executeHubTradeSell() {
        const type = this.currentHubTradeResource || 'wood';
        const inp = document.getElementById('hubTradeAmountInput');
        const amt = parseInt(inp ? inp.value : 10) || 0;
        if (amt > 0 && this.sellResourceAmount(type, amt)) {
            this.updateHubTradeCalculations();
            if (window.updateDeckUI) window.updateDeckUI();
        }
    }

    executeHubTradeBuy() {
        const type = this.currentHubTradeResource || 'wood';
        const inp = document.getElementById('hubTradeAmountInput');
        const amt = parseInt(inp ? inp.value : 10) || 0;
        if (amt > 0 && this.buyResourceAmount(type, amt)) {
            this.updateHubTradeCalculations();
            if (window.updateDeckUI) window.updateDeckUI();
        }
    }

    saveHubConfig(showNotification = false) {
        // 1. Darbininkai
        const chkW = document.getElementById('cfgWorkerEnabled');
        const sldWood = document.getElementById('cfgWorkerWoodSlider');
        const sldStone = document.getElementById('cfgWorkerStoneSlider');
        const sldFood = document.getElementById('cfgWorkerFoodSlider');
        const sldGold = document.getElementById('cfgWorkerGoldSlider');
        const sldReserve = document.getElementById('cfgWorkerReserveSlider');
        const chkGoldSafe = document.getElementById('cfgWorkerGoldSafe');

        const maxPop = (this.playerResources && this.playerResources.maxPop) || 60;
        const curReserve = sldReserve ? Math.max(0, Math.min(maxPop, parseInt(sldReserve.value) || 0)) : 2;
        const livingPlayerSoldiers = this.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
        const queuedPlayerSoldiers = this.spawnQueue.filter(item => item.isPlayer !== false).length;
        const activePlayerWorkers = this.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED').length;
        const freePop = Math.max(0, (this.playerResources && this.playerResources.idlePop) || 0);

        const soldierReservation = Math.max(curReserve, livingPlayerSoldiers + queuedPlayerSoldiers);
        const maxWorkerCapacity = Math.max(0, maxPop - soldierReservation);

        let w = sldWood ? Math.max(0, Math.min(maxWorkerCapacity, parseInt(sldWood.value) || 0)) : ((this.autoGatherConfig && this.autoGatherConfig.woodLimit !== undefined) ? this.autoGatherConfig.woodLimit : 1);
        let s = sldStone ? Math.max(0, Math.min(maxWorkerCapacity, parseInt(sldStone.value) || 0)) : ((this.autoGatherConfig && this.autoGatherConfig.stoneLimit !== undefined) ? this.autoGatherConfig.stoneLimit : 1);
        let f = sldFood ? Math.max(0, Math.min(maxWorkerCapacity, parseInt(sldFood.value) || 0)) : ((this.autoGatherConfig && this.autoGatherConfig.foodLimit !== undefined) ? this.autoGatherConfig.foodLimit : 1);
        let g = sldGold ? Math.max(0, Math.min(maxWorkerCapacity, parseInt(sldGold.value) || 0)) : ((this.autoGatherConfig && this.autoGatherConfig.goldLimit !== undefined) ? this.autoGatherConfig.goldLimit : 1);

        if (w + s + f + g > maxWorkerCapacity) {
            if (maxWorkerCapacity === 0) {
                w = 0; s = 0; f = 0; g = 0;
            } else {
                const ratio = maxWorkerCapacity / (w + s + f + g);
                w = Math.floor(w * ratio);
                s = Math.floor(s * ratio);
                f = Math.floor(f * ratio);
                g = Math.max(0, maxWorkerCapacity - (w + s + f));
            }
        }

        this.autoGatherConfig = {
            enabled: chkW ? chkW.checked : true,
            woodLimit: w,
            stoneLimit: s,
            foodLimit: f,
            goldLimit: g,
            centerGoldSafe: chkGoldSafe ? chkGoldSafe.checked : true,
            centerGold: g > 0,
            minReservedPop: curReserve
        };
        this.autoGatherEnabled = this.autoGatherConfig.enabled;
        this.hubWorkerBaseline = { w, s, f, g };

        // 2. Karo Taktika
        const chkM = document.getElementById('cfgMilEnabled');
        const chkHero = document.getElementById('cfgMilHero');
        const sldMilGold = document.getElementById('cfgMilGoldSlider');
        const sldMilSoldiers = document.getElementById('cfgMilMaxSoldiersSlider');

        this.autoMilitaryConfig = {
            enabled: chkM ? chkM.checked : false,
            mode: this.selectedMilMode || 'balanced',
            minReserveGold: sldMilGold ? Math.max(0, parseInt(sldMilGold.value) || 0) : 200,
            autoHero: chkHero ? chkHero.checked : true,
            maxSoldiers: sldMilSoldiers ? Math.max(1, parseInt(sldMilSoldiers.value) || 12) : 12
        };

        // 3. Turgus
        const chkT = document.getElementById('cfgTradeEnabled');
        const sldTrWood = document.getElementById('cfgTradeWoodSlider');
        const sldTrStone = document.getElementById('cfgTradeStoneSlider');
        const sldTrFood = document.getElementById('cfgTradeFoodSlider');

        this.autoTradeConfig = {
            enabled: chkT ? chkT.checked : false,
            woodThreshold: sldTrWood ? Math.max(50, parseInt(sldTrWood.value) || 250) : 250,
            stoneThreshold: sldTrStone ? Math.max(50, parseInt(sldTrStone.value) || 250) : 250,
            foodThreshold: sldTrFood ? Math.max(50, parseInt(sldTrFood.value) || 150) : 150
        };

        if (showNotification) {
            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            this.floatingTexts.push({
                text: isEn ? `🏛️ Settings Saved!` : `🏛️ Nustatymai Išsaugoti!`,
                x: RTS_DATA.PLAYER_BASE_X + 90,
                y: RTS_DATA.GROUND_Y - 140,
                color: '#38bdf8',
                life: 1.8,
                maxLife: 1.8
            });
            if (this.sound) this.sound.playClick();
        }

        this.saveGameState();
        this.updateUI();
    }

    closeHubModal() {
        if (this.hubLiveInterval) {
            clearInterval(this.hubLiveInterval);
            this.hubLiveInterval = null;
        }
        this.saveHubConfig(false);
        const modal = document.getElementById('modalAutomationHub');
        if (modal) modal.classList.add('hidden');
    }

    adjustWorkerSlider(res, delta) {
        const sliderMap = {
            wood: 'cfgWorkerWoodSlider',
            stone: 'cfgWorkerStoneSlider',
            food: 'cfgWorkerFoodSlider',
            gold: 'cfgWorkerGoldSlider',
            reserve: 'cfgWorkerReserveSlider'
        };
        const sld = document.getElementById(sliderMap[res]);
        if (sld) {
            const cur = parseInt(sld.value) || 0;
            const min = parseInt(sld.min) || 0;
            const max = parseInt(sld.max) || 60;
            const nextVal = Math.max(min, Math.min(max, cur + delta));
            if (nextVal !== cur) {
                sld.value = nextVal;
                sld.dispatchEvent(new Event('input'));
                sld.dispatchEvent(new Event('change'));
                if (this.sound && this.sound.playClick) this.sound.playClick();
            }
        }
    }

    adjustMilitarySlider(type, delta) {
        if (type === 'soldiers') {
            const sld = document.getElementById('cfgMilMaxSoldiersSlider');
            if (sld) {
                const cur = parseInt(sld.value) || 12;
                const min = parseInt(sld.min) || 1;
                const max = parseInt(sld.max) || 60;
                const nextVal = Math.max(min, Math.min(max, cur + delta));
                if (nextVal !== cur) {
                    sld.value = nextVal;
                    sld.dispatchEvent(new Event('input'));
                    sld.dispatchEvent(new Event('change'));
                    if (this.sound && this.sound.playClick) this.sound.playClick();
                }
            }
        } else if (type === 'gold') {
            const sld = document.getElementById('cfgMilGoldSlider');
            if (sld) {
                const cur = parseInt(sld.value) || 200;
                const min = parseInt(sld.min) || 0;
                const max = parseInt(sld.max) || 800;
                const nextVal = Math.max(min, Math.min(max, cur + delta));
                if (nextVal !== cur) {
                    sld.value = nextVal;
                    sld.dispatchEvent(new Event('input'));
                    sld.dispatchEvent(new Event('change'));
                    if (this.sound && this.sound.playClick) this.sound.playClick();
                }
            }
        }
    }

    adjustTradeThreshold(res, delta) {
        const sliderMap = {
            wood: 'cfgTradeWoodSlider',
            stone: 'cfgTradeStoneSlider',
            food: 'cfgTradeFoodSlider'
        };
        const sld = document.getElementById(sliderMap[res]);
        if (sld) {
            const cur = parseInt(sld.value) || 250;
            const min = parseInt(sld.min) || 50;
            const max = parseInt(sld.max) || 1000;
            const nextVal = Math.max(min, Math.min(max, cur + delta));
            if (nextVal !== cur) {
                sld.value = nextVal;
                sld.dispatchEvent(new Event('input'));
                sld.dispatchEvent(new Event('change'));
                if (this.sound && this.sound.playClick) this.sound.playClick();
            }
        }
    }

    // Suderinamumo metodai
    openConfigModal(type) {
        const tabMap = { workers_ai: 'workers', military_academy: 'military', trade_economy: 'auto_trade' };
        this.openAutomationHub(tabMap[type] || 'workers');
    }

    saveConfigModal() {
        this.saveHubConfig();
    }

    closeConfigModal() {
        this.closeHubModal();
    }
}

window.RTSGame = RTSGame;
