// ============================================================================
// CLASH OF ERAS - SMART ADAPTIVE OPPONENT AI (COUNTER-UNITS & PERSONALITIES)
// ============================================================================

class RTSOpponentAI {
    constructor(game, difficulty = 'easy', personality = 'aggressive') {
        this.game = game;
        this.difficulty = difficulty;
        this.personality = personality; // 'aggressive', 'economist', 'defensive'
        this.timer = 0;
        this.spawnTimer = 0;
        this.peaceTimer = 0;
        this.waveGatherTimer = 0;
        this.stagedUnits = [];

        this.setDifficulty(difficulty);
        this.setPersonality(personality);
    }

    setPersonality(personality) {
        this.personality = personality;
        const profile = RTS_DATA.AI_PERSONALITIES[personality] || RTS_DATA.AI_PERSONALITIES.aggressive;
        this.profile = profile;
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        if (difficulty === 'easy') {
            this.attackDelay = 7.0;
            this.spawnIntervalBase = 4.8;
            this.goldRate = 8;
            this.xpRate = 8;
            this.heavyChance = 0.15;
            this.rangedChance = 0.30;
        } else if (difficulty === 'hard') {
            this.attackDelay = 1.8;
            this.spawnIntervalBase = 1.8;
            this.goldRate = 26;
            this.xpRate = 40;
            this.heavyChance = 0.50;
            this.rangedChance = 0.60;
        } else if (difficulty === 'unlimited' || difficulty === 'nightmare' || difficulty === 'insane' || difficulty === 'extreme' || difficulty === 'Ekstremalus') {
            this.attackDelay = 1.0;
            this.spawnIntervalBase = 1.3;
            this.goldRate = 38;
            this.xpRate = 50;
            this.heavyChance = 0.60;
            this.rangedChance = 0.65;
        } else {
            // Normalus
            this.attackDelay = 4.0;
            this.spawnIntervalBase = 3.2;
            this.goldRate = 14;
            this.xpRate = 18;
            this.heavyChance = 0.35;
            this.rangedChance = 0.50;
        }
    }

    update(dt) {
        this.timer += dt;
        this.spawnTimer += dt;
        this.peaceTimer += dt;
        this.waveGatherTimer += dt;

        // Prieaugių skaičiavimas pagal sunkumą ir asmenybę
        const pMult = this.profile ? this.profile.goldMultiplier : 1.0;
        this.game.enemyXp += dt * this.xpRate;
        this.game.enemyGold += dt * (this.goldRate + this.game.enemyEra * 9) * pMult;

        const isHardOrHigher = (this.difficulty === 'hard' || this.difficulty === 'nightmare' || this.difficulty === 'insane' || this.difficulty === 'extreme' || this.difficulty === 'Ekstremalus');
        const isUnlimited = this.game.isUnlimitedMode || this.difficulty === 'unlimited' || this.game.gameMode === 'sandbox';
        if (isHardOrHigher || isUnlimited) {
            this.game.enemyResources.wood += dt * 1.5;
            this.game.enemyResources.stone += dt * 1.5;
            this.game.enemyResources.food += dt * 1.5;
        }

        if (this.timer >= 1.0) {
            this.timer = 0;
            this.manageEconomy();
            this.manageTech();
            this.manageDefense();
        }

        // Reaktyvus gynybinis šaukimas: jei žaidėjo kariai artėja prie priešo bazės, šaukti karius nedelsiant!
        const playerApproaching = this.game.soldiers.some(s => s.isPlayer && s.x > 1250);
        const pIntervalMult = this.profile ? this.profile.spawnIntervalMult : 1.0;
        const currentInterval = (playerApproaching ? (this.spawnIntervalBase * 0.6) : (this.spawnIntervalBase + Math.random() * 1.2)) * pIntervalMult;

        const effectiveDelay = (this.profile && this.profile.attackDelay) ? Math.min(this.attackDelay, this.profile.attackDelay) : this.attackDelay;

        if ((this.peaceTimer >= effectiveDelay || playerApproaching) && this.spawnTimer >= currentInterval) {
            this.spawnTimer = 0;
            this.manageMilitary(playerApproaching);
        }
    }

    manageEconomy() {
        const game = this.game;
        const res = game.enemyResources;
        const isEconomist = this.personality === 'economist';

        // 1. Siųsti laisvus gyventojus į gavybą pagal leistiną darbininkų limitą
        const maxWorkers = isEconomist ? 8 : ((this.difficulty === 'hard' || this.difficulty === 'unlimited' || this.difficulty === 'nightmare' || this.difficulty === 'insane') ? 6 : 4);
        let currentWorkers = game.enemyWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length;

        let popGuard = 60;
        while (res.idlePop > 0 && currentWorkers < maxWorkers && popGuard-- > 0) {
            let type = 'wood';
            if (res.wood <= res.stone && res.wood <= res.food) type = 'wood';
            else if (res.stone <= res.wood && res.stone <= res.food) type = 'stone';
            else type = 'food';

            // Ekonomistas AI dažnai siunčia darbininką į centrą dideliam auksui ir XP gauti!
            const centerChance = isEconomist ? 0.45 : 0.20;
            if (Math.random() < centerChance && (isEconomist || game.soldiers.some(s => !s.isPlayer && s.x < 1600))) {
                type = 'center_gold';
            }

            res.idlePop--;
            currentWorkers++;
            let targetX = 2300;
            if (type === 'wood') {
                const idx = Math.floor(Math.random() * 4);
                targetX = 2285 + idx * 30;
            } else if (type === 'stone') {
                const idx = Math.floor(Math.random() * 3);
                targetX = 2185 + idx * 28;
            } else if (type === 'food') {
                const idx = Math.floor(Math.random() * 3);
                targetX = 2100 + idx * 22;
            } else if (type === 'center_gold') {
                targetX = RTS_DATA.NEUTRAL_CACHE_X + 32;
            }

            const w = new RTSWorker(false, type, targetX, game.gatherAmount, game.enemyEra);
            game.enemyWorkers.push(w);
        }

        // 2. Populiacijos limitas (įskaitant ir karius, kad populiacija nestrigtų)
        const livingEnemySoldiers = game.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
        const totalPop = (res.idlePop || 0) + currentWorkers + livingEnemySoldiers;
        const maxDesiredPop = isEconomist ? 34 : ((this.difficulty === 'hard' || this.difficulty === 'unlimited') ? 28 : 20);
        if (totalPop >= res.maxPop - 1 && res.maxPop < maxDesiredPop && game.enemyGold >= 100) {
            game.enemyGold -= 90;
            res.maxPop += 4;
        }

        // 3. Parduoti medžiagas jei trūksta aukso
        const eraData = RTS_DATA.AGES[game.enemyEra];
        const cheapestUnitCost = eraData ? eraData.units[0].costGold : 25;

        // Apsaugome resursus: niekada neišparduoti maisto žemiau 20 (kad gimtų gyventojai)
        // ir išsaugome VISUS evoliucijai reikalingus resursus, kad neišparduotų reikalingos medienos/akmens
        const nextCost = eraData ? eraData.evolveCost : null;
        const minWoodReserve = nextCost ? nextCost.wood : 0;
        const minStoneReserve = nextCost ? nextCost.stone : 0;
        const minFoodReserve = 25;

        if (game.enemyGold < cheapestUnitCost * 2) {
            if (res.wood >= minWoodReserve + 10) { res.wood -= 10; game.enemyGold += 20; }
            if (res.stone >= minStoneReserve + 10) { res.stone -= 10; game.enemyGold += 25; }
            if (res.food >= minFoodReserve + 10) { res.food -= 10; game.enemyGold += 15; }
        }
    }

    manageTech() {
        const game = this.game;
        const maxAllowedEra = (game.currentChallenge && game.currentChallenge.maxEra !== undefined) ? game.currentChallenge.maxEra : 4;
        if (game.enemyEra < maxAllowedEra) {
            const eraData = RTS_DATA.AGES[game.enemyEra];
            const cost = eraData.evolveCost;
            const res = game.enemyResources;
            const isEconomist = this.personality === 'economist';
            const isHardOrHigher = (this.difficulty === 'hard' || this.difficulty === 'nightmare' || this.difficulty === 'insane' || this.difficulty === 'extreme' || this.difficulty === 'Ekstremalus');
            const isUnlimited = game.isUnlimitedMode || this.difficulty === 'unlimited' || game.gameMode === 'sandbox';

            // 1. Dinaminis pasivijimas, jei priešas atsilieka nuo žaidėjo:
            if (game.enemyEra < game.playerEra) {
                this.catchupTimer = (this.catchupTimer || 0) + 1.0;
            } else {
                this.catchupTimer = 0;
            }

            // =========================================================================
            // 1. LENGVAS REŽIMAS (EASY):
            // Žaidėjas turi LENGVAI APLENKTI priešą. Priešas NIEKADA neevoliucionuoja
            // anksčiau už žaidėją! Tik žaidėjui pasiekus naują epochą, po 35s priešas pasiveja.
            // =========================================================================
            if (this.difficulty === 'easy') {
                if (game.enemyEra < game.playerEra && this.catchupTimer >= 35) {
                    this.catchupTimer = 0;
                    game.evolveEra(false);
                }
                this.manageUpgrades();
                return;
            }

            // =========================================================================
            // 2. SUNKUS / EKSTREMALUS REŽIMAS (HARD / NIGHTMARE / UNLIMITED):
            // Priešas TURI APLENKTI ŽAIDĖJĄ! Didelis XP prieaugis, sumažinti reikalavimai
            // (45% XP, 25% resursų), greitas šuolis į priekį. Pasiveja per 2s, jei atsilieka.
            // =========================================================================
            if (isHardOrHigher || isUnlimited) {
                const canCatchup = (game.enemyEra < game.playerEra && this.catchupTimer >= 2);
                let reqFactor = isEconomist ? 0.20 : 0.25;
                const hasRes = (res.wood >= cost.wood * reqFactor) && (res.stone >= cost.stone * reqFactor) && (res.food >= cost.food * reqFactor);
                const canEvolveAhead = (game.enemyXp >= cost.xp * 0.45 && hasRes);
                const canEvolveOverflow = (game.enemyXp >= cost.xp * 0.60);

                if (canCatchup || canEvolveAhead || canEvolveOverflow) {
                    this.catchupTimer = 0;
                    game.evolveEra(false);
                }
                this.manageUpgrades();
                return;
            }

            // =========================================================================
            // 3. NORMALUS REŽIMAS (NORMAL):
            // Žaidėjas ir priešas vystosi PANAŠIAI. Pasivijimas per 14s, natūrali evoliucija
            // prie 90% XP ir 65% resursų arba 125% XP.
            // =========================================================================
            const canCatchupNormal = (game.enemyEra < game.playerEra && this.catchupTimer >= 14);
            let reqFactorNormal = isEconomist ? 0.50 : 0.65;
            const hasResNormal = (res.wood >= cost.wood * reqFactorNormal) && (res.stone >= cost.stone * reqFactorNormal) && (res.food >= cost.food * reqFactorNormal);
            const canEvolveNaturalNormal = (game.enemyXp >= cost.xp * 0.90 && hasResNormal);
            const canEvolveOverflowNormal = (game.enemyXp >= cost.xp * 1.25);

            if (canCatchupNormal || canEvolveNaturalNormal || canEvolveOverflowNormal) {
                this.catchupTimer = 0;
                game.evolveEra(false);
            }
        }

        // Priešo NPC tobulinimų pirkimas pagal pasirinktą sunkumo lygį
        this.manageUpgrades();
    }

    manageUpgrades() {
        const game = this.game;
        // 1. Lengvame (Easy) režime priešas neturi tobulinimų ir nestato sienos (draugiška pradedantiesiems)
        if (this.difficulty === 'easy') return;

        const res = game.enemyResources;
        const gold = game.enemyGold;
        const isDefensive = this.personality === 'defensive';
        const isEconomist = this.personality === 'economist';

        // Maksimalus leistinas tobulinimų lygis pagal sunkumą: Normalus = 2, Sunkus/Unlimited = 5
        const maxLevelByDiff = (this.difficulty === 'hard' || this.difficulty === 'unlimited' || this.difficulty === 'nightmare' || this.difficulty === 'insane') ? 5 : 2;

        // Tobulinimų prioritetai pagal asmenybę
        let tracks = ['base_wall', 'military_academy', 'workers_ai', 'trade_economy'];
        if (isDefensive) {
            tracks = ['base_wall', 'military_academy', 'trade_economy', 'workers_ai'];
        } else if (isEconomist) {
            tracks = ['trade_economy', 'workers_ai', 'base_wall', 'military_academy'];
        }

        for (const trackId of tracks) {
            const currentLvl = game.getUpgradeLevel(trackId, false);
            if (currentLvl >= maxLevelByDiff) continue;

            const trackData = RTS_DATA.UPGRADES && RTS_DATA.UPGRADES[trackId];
            if (!trackData || !trackData.levels) continue;
            const nextLvlData = trackData.levels[currentLvl];
            if (!nextLvlData || !nextLvlData.cost) continue;

            const cost = nextLvlData.cost;
            // Saugiklis: paliekame aukso rezervą bent vienam kariui
            const minGoldBuffer = (trackId === 'base_wall') ? 40 : 100;
            const canAfford = (gold >= (cost.gold || 0) + minGoldBuffer) &&
                              (res.wood >= (cost.wood || 0)) &&
                              (res.stone >= (cost.stone || 0)) &&
                              (res.food >= (cost.food || 0));

            if (canAfford) {
                game.buyUpgrade(trackId, false);
                break; // Perka po vieną tobulinimą per ciklą
            }
        }
    }

    // ========================================================================
    // ADAPTYVUS KARIŲ ŠAUKIMAS (COUNTER-UNITS ANALIZATORIUS)
    // ========================================================================
    manageMilitary(isUnderPressure = false) {
        const game = this.game;
        const eraData = RTS_DATA.AGES[game.enemyEra];
        if (!eraData || !eraData.units) return;
        const units = eraData.units;

        // 1. Armijos dydžio limitas pagal sunkumą (apsauga nuo karių perteklinio kaupimosi vienoje vietoje)
        const livingEnemySoldiers = game.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING' && s.hp > 0).length;
        const maxEnemyArmy = (this.difficulty === 'unlimited') ? 30 : ((this.difficulty === 'hard' || this.difficulty === 'nightmare' || this.difficulty === 'insane') ? 24 : (this.difficulty === 'normal' ? 18 : 12));
        if (livingEnemySoldiers >= maxEnemyArmy) return;

        // Iššūkių leistinų karių tipų filtras (pvz. tik šauliai ar tik sunkieji)
        const allowed = (game.currentChallenge && game.currentChallenge.allowedUnitTypes && game.currentChallenge.allowedUnitTypes.length > 0)
            ? game.currentChallenge.allowedUnitTypes
            : null;
        const candidateUnits = allowed ? units.filter(u => allowed.includes(u.type)) : units;
        if (candidateUnits.length === 0) return;

        // 2. Žaidėjo armijos sudėties skenavimas
        let playerMelee = 0;
        let playerRanged = 0;
        let playerHeavy = 0;

        for (const s of game.soldiers) {
            if (!s.isPlayer) continue;
            const uType = s.data.type || 'melee';
            if (uType === 'ranged') playerRanged++;
            else if (uType === 'heavy') playerHeavy++;
            else playerMelee++;
        }

        const playerTurretCount = game.playerTurrets.filter(Boolean).length;

        // 3. Counter-weights apskaičiavimas
        let heavyWeight = this.heavyChance;
        let rangedWeight = this.rangedChance;
        let meleeWeight = 0.40;

        // Jei žaidėjas turi daug pėstininkų -> AI prioritetas distanciniai (kite) ir sunkūs
        if (playerMelee >= 2) {
            rangedWeight += 0.30;
            heavyWeight += 0.20;
        }

        // Jei žaidėjas turi daug lankininkų -> AI prioritetas sunkūs / greiti šturmo kariai
        if (playerRanged >= 2) {
            heavyWeight += 0.35;
            meleeWeight += 0.25;
        }

        // Jei žaidėjas turi stiprių bokštelių -> AI prioritetas didelio HP sunkūs kariai su skydais
        if (playerTurretCount >= 2) {
            heavyWeight += 0.40;
        }

        // Asmenybės modifikatoriai
        if (this.personality === 'aggressive') {
            meleeWeight += 0.20;
            rangedWeight += 0.15;
        } else if (this.personality === 'defensive') {
            rangedWeight += 0.30;
            heavyWeight += 0.25;
        }

        // 0. Sunkiausiame lygyje AI pasitelkia Didvyrį (Hero)
        if ((this.difficulty === 'hard' || this.difficulty === 'nightmare' || this.difficulty === 'unlimited') && game.canSummonHero && game.canSummonHero(false)) {
            const hasEnemyHero = game.soldiers.some(s => !s.isPlayer && s.isHero && s.state !== 'DYING');
            if (!hasEnemyHero && Math.random() < 0.75) {
                if (game.summonHero(false)) return;
            }
        }

        // 4. Vieneto pasirinkimas iš leistinų vienetų
        let chosenUnit = null;

        if (candidateUnits.length === 1) {
            if (game.enemyGold >= candidateUnits[0].costGold) {
                chosenUnit = candidateUnits[0];
            }
        } else if (this.difficulty === 'easy') {
            // Lengvame lygyje AI renkasi paprastesnius karius ir nenaudoja agresyvių sunkiųjų vienetų
            const u1 = candidateUnits[1] || candidateUnits[0];
            const u0 = candidateUnits[0];
            if (u1 && game.enemyGold >= u1.costGold && Math.random() < 0.35) {
                chosenUnit = u1;
            } else if (u0 && game.enemyGold >= u0.costGold) {
                chosenUnit = u0;
            }
        } else {
            const heavyUnit = candidateUnits.find(u => u.type === 'heavy') || candidateUnits[2];
            const rangedUnit = candidateUnits.find(u => u.type === 'ranged') || candidateUnits[1];
            const meleeUnit = candidateUnits.find(u => u.type === 'melee') || candidateUnits[0];

            if (heavyUnit && game.enemyGold >= heavyUnit.costGold && Math.random() < Math.min(0.85, heavyWeight)) {
                chosenUnit = heavyUnit;
            } else if (rangedUnit && game.enemyGold >= rangedUnit.costGold && Math.random() < Math.min(0.85, rangedWeight)) {
                chosenUnit = rangedUnit;
            } else if (meleeUnit && game.enemyGold >= meleeUnit.costGold) {
                chosenUnit = meleeUnit;
            }
        }

        if (chosenUnit) {
            game.enemyGold -= chosenUnit.costGold;
            const s = new RTSSoldier(false, chosenUnit, game.enemyEra, RTS_DATA.ENEMY_BASE_X + 20);
            game.soldiers.push(s);

            // Taktinis Būrys (Squad Push) Hard ir Unlimited režimuose:
            // Sukaupia smogiamąją grupę: sunkusis priekyje + šaulys ar pėstininkas iškart už jo!
            if ((this.difficulty === 'hard' || this.difficulty === 'unlimited') && Math.random() < 0.65) {
                const currentLiving = game.soldiers.filter(sol => !sol.isPlayer && sol.state !== 'DYING' && sol.hp > 0).length;
                if (currentLiving + 1 < maxEnemyArmy && units[1] && (!allowed || allowed.includes(units[1].type)) && game.enemyGold >= units[1].costGold) {
                    game.enemyGold -= units[1].costGold;
                    game.queueDelayedSpawn(false, units[1], 0.4, RTS_DATA.ENEMY_BASE_X + 45);
                }
                if (currentLiving + 2 < maxEnemyArmy && units[0] && (!allowed || allowed.includes(units[0].type)) && game.enemyGold >= units[0].costGold && Math.random() < 0.45) {
                    game.enemyGold -= units[0].costGold;
                    game.queueDelayedSpawn(false, units[0], 0.8, RTS_DATA.ENEMY_BASE_X + 35);
                }
            }
        }

        // 4. Pažangus Ultimate panaudojimas
        const playerSoldiersNear = game.soldiers.filter(s => s.isPlayer && s.x > 950);
        const reqClump = isUnderPressure ? 2 : (this.difficulty === 'easy' ? 4 : 2);
        if (playerSoldiersNear.length >= reqClump && game.enemyUltimateCooldown <= 0 && this.difficulty !== 'easy') {
            game.triggerUltimate(false);
        }
    }

    manageDefense() {
        const game = this.game;
        // 1. Lengvame (Easy) režime priešas NESTATO jokių patrankų ir neperka lizdų!
        if (this.difficulty === 'easy') return;

        const eraData = RTS_DATA.AGES[game.enemyEra];
        const isDefensive = this.personality === 'defensive';

        // Normalus lygis: iki 2-3 bokštelių. Sunkus / Unlimited: visi 4 bokšteliai.
        const maxDesiredSlots = (this.difficulty === 'hard' || this.difficulty === 'unlimited') ? 4 : (isDefensive ? 3 : 2);

        if (game.enemyUnlockedSlots < maxDesiredSlots && game.enemyGold >= (isDefensive ? 130 : 200)) {
            game.buyTurretSlot(false);
        }

        if (eraData && eraData.turrets && eraData.turrets.length > 0) {
            for (let i = 0; i < game.enemyUnlockedSlots; i++) {
                const existing = game.enemyTurrets[i];
                if (!existing) {
                    const tIndex = (eraData.turrets.length > 1 && game.enemyGold >= eraData.turrets[1].cost.gold) ? 1 : 0;
                    const t = eraData.turrets[tIndex];
                    if (game.enemyGold >= t.cost.gold) {
                        game.buildTurret(false, i, t.id);
                    }
                    break;
                } else if (game.enemyGold >= 380 && !eraData.turrets.some(t => t.id === existing.data.id)) {
                    // Atnaujinti senos epochos bokštelį
                    game.sellTurret(false, i);
                    const t = eraData.turrets[0];
                    game.buildTurret(false, i, t.id);
                    break;
                }
            }
        }
    }
}

