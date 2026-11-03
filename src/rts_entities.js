// ============================================================================
// CLASH OF ERAS - WORKERS, CANONICAL WARRIORS, TURRETS & VFX (BUG-FREE ENGINE)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. DARBININKAS (SINGLE-TRIP / MISSION-BASED GATHERER & CENTER MINE)
// ----------------------------------------------------------------------------
class RTSWorker {
    constructor(isPlayer, role = 'wood', targetX = 140, gatherAmount = 10, era = 0) {
        this.id = 'w_' + Math.random().toString(36).substr(2, 7);
        this.isPlayer = isPlayer;
        this.role = role; // 'wood', 'stone', 'food', 'center_gold'
        this.era = era || 0;
        this.gatherAmount = gatherAmount + this.era * 3;

        // Bazinės koordinatės (prie pat pilies / bazės priekinių vartų ir durų)
        this.baseX = isPlayer ? (RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH - 25) : (RTS_DATA.ENEMY_BASE_X + 25);
        this.x = this.baseX;
        this.seed = Math.floor(Math.random() * 100);
        this.laneOffsetY = (this.seed % 5) * 1.5;
        this.slotOffset = (this.seed % 4) * 6;
        this.y = RTS_DATA.GROUND_Y;
        this.width = 26;
        this.height = 38;

        // Epochos HP balansas (Akmens amžiuje 60 HP, vėliau kyla proporcingai)
        const eraHps = [60, 110, 180, 270, 400];
        this.hp = eraHps[this.era] || 60;
        this.maxHp = this.hp;

        this.hitFlash = 0;
        this.targetNodeX = targetX;
        this.speed = (role === 'center_gold') ? 95 : 88;
        this.state = 'WALKING_TO_NODE'; // 'WALKING_TO_NODE', 'WORKING', 'WALKING_TO_BASE', 'DYING', 'FINISHED', 'DEAD'
        this.workTimer = 0;
        this.workDuration = (role === 'center_gold') ? 2.8 : 2.0;
        this.carryingAmount = 0;
        this.droppedGold = 0;
        this.deathTimer = 0;
        this.deathDuration = 1.2;
        this.animTime = Math.random() * 5;

        // Taikome Darbininkų & AI tobulinimų lygio bonusus
        if (typeof game !== 'undefined' && game && game.getUpgradeLevel) {
            const wLvl = game.getUpgradeLevel('workers_ai', this.isPlayer);
            if (wLvl >= 1) {
                this.speed = Math.round(this.speed * 1.20);
                if (RTS_DATA.UPGRADES && RTS_DATA.UPGRADES.workers_ai && RTS_DATA.UPGRADES.workers_ai.levels[wLvl - 1]) {
                    const up = RTS_DATA.UPGRADES.workers_ai.levels[wLvl - 1];
                    if (up.capacity) this.carryingCapacity = up.capacity;
                }
            }
            if (wLvl >= 2) this.workDuration = Math.max(0.7, this.workDuration * 0.65);
            if (wLvl >= 3) {
                this.hp += 100;
                this.maxHp += 100;
                this.speed = Math.round(this.speed * 1.25);
            }
            if (wLvl >= 5) {
                this.speed = Math.round(this.speed * 1.15);
            }
        }
    }

    update(dt, game) {
        this.animTime += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt * 6;
        if (this.state === 'DEAD' || this.state === 'FINISHED') return;

        if (this.state === 'DYING') {
            this.deathTimer += dt;
            if (this.deathTimer >= this.deathDuration) {
                this.state = 'DEAD';
            }
            return;
        }

        this.stuckTimer = (this.stuckTimer || 0) + dt;
        if (this.stuckTimer > 25.0) {
            // Saugiklis: jei darbininkas užstrigtų ilgiau nei 25s, saugiai užbaigiame misiją ir grąžiname populiaciją
            if (this.isPlayer) {
                const livingSoldiers = game.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
                const queuedSoldiers = game.spawnQueue.filter(item => item.isPlayer !== false).length;
                const otherActiveWorkers = game.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING' && w !== this).length;
                const maxPossibleIdle = Math.max(0, game.playerResources.maxPop - (livingSoldiers + queuedSoldiers + otherActiveWorkers));
                game.playerResources.idlePop = Math.min(maxPossibleIdle, (game.playerResources.idlePop || 0) + 1);
            } else {
                const livingSoldiers = game.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING').length;
                const otherActiveWorkers = game.enemyWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING' && w !== this).length;
                const maxPossibleIdleEnemy = Math.max(0, game.enemyResources.maxPop - (livingSoldiers + otherActiveWorkers));
                game.enemyResources.idlePop = Math.min(maxPossibleIdleEnemy, (game.enemyResources.idlePop || 0) + 1);
            }
            this.state = 'FINISHED';
            return;
        }

        // Naudojamas stabilus darbininko ofsetas (fiksuotas konstruktoriuje, kad nekeltų mini-šokinėjimų)
        const slotOffset = this.slotOffset || 0;
        const formationIdx = (this.seed !== undefined ? this.seed : 0) % 5;

        switch (this.state) {
            case 'WALKING_TO_NODE':
                // KASĖJŲ LOGIKA: Darbininkai saugiai žygiuoja KARTU su priekyje esančiais kariais, o jei priekyje karių nelieka – bėga prie kasyklos!
                let effectiveTargetX = this.targetNodeX;
                let isSprinting = false;

                if (this.role === 'center_gold') {
                    if (this.isPlayer) {
                        const gatherCfg = game.autoGatherConfig || {};
                        const isSecurityEnabled = !this.manualOrder && (gatherCfg.centerGoldSafe !== false);

                        if (!isSecurityEnabled) {
                            // BE APSAUGOS ARBA RANKINĖ ŽAIDĖJO KOMANDA: Eina tiesiai ir greitai prie kasyklos
                            effectiveTargetX = this.targetNodeX - 5 - (formationIdx % 4) * 8;
                            isSprinting = true;
                        } else {
                            // SU APSAUGA:
                            const enemyAhead = game.soldiers.some(s => !s.isPlayer && s.state !== 'DYING' && s.x >= this.x - 30 && s.x <= this.targetNodeX + 120);
                            if (!enemyAhead) {
                                // SAUGU: Nėra priešų – eina tiesiai kasti aukso
                                effectiveTargetX = this.targetNodeX - 5 - (formationIdx % 4) * 8;
                                isSprinting = true;
                            } else {
                                // Yra priešų: jei turime pakankamai karių priekyje apsaugai – saugiai žygiuojame paskui juos
                                const soldiersAhead = game.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.x >= this.x - 20);
                                const enemiesInFront = game.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING' && s.x >= this.x - 30 && s.x <= this.targetNodeX + 120);

                                if (soldiersAhead.length >= enemiesInFront.length) {
                                    // Savų karių pakanka eskortui – saugiai einame už karių nugarų
                                    let frontX = -Infinity;
                                    for (const s of soldiersAhead) {
                                        if (s.x > frontX) frontX = s.x;
                                    }
                                    const safeFollowX = frontX - 35 - (formationIdx % 4) * 8;
                                    effectiveTargetX = Math.min(this.targetNodeX - (formationIdx % 4) * 8, Math.max(this.x, safeFollowX));
                                } else {
                                    // Priešas arti ir savų karių trūksta: saugiai atsitraukiame link bazės
                                    effectiveTargetX = this.baseX;
                                }
                            }
                        }
                    } else {
                        const enemyAhead = game.soldiers.some(s => s.isPlayer && s.state !== 'DYING' && s.x <= this.x + 30 && s.x >= this.targetNodeX - 120);
                        if (!enemyAhead) {
                            effectiveTargetX = this.targetNodeX + 5 + (formationIdx % 4) * 8;
                            isSprinting = true;
                        } else {
                            const soldiersAhead = game.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING' && s.x <= this.x + 20);
                            if (soldiersAhead.length > 0) {
                                let frontX = Infinity;
                                for (const s of soldiersAhead) {
                                    if (s.x < frontX) frontX = s.x;
                                }
                                const safeFollowX = frontX + 45 + (formationIdx % 4) * 8;
                                effectiveTargetX = Math.max(this.targetNodeX + (formationIdx % 4) * 8, Math.min(this.x, safeFollowX));
                            } else {
                                effectiveTargetX = this.baseX;
                            }
                        }
                    }
                }

                // Jei darbininkas grįžo į bazę dėl pavojaus be resursų (carryingAmount === 0), grąžiname gyventoją į laisvą populiaciją
                if (this.isPlayer && effectiveTargetX === this.baseX && Math.abs(this.baseX - this.x) <= 12) {
                    this.isMoving = false;
                    const livingSoldiers = game.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
                    const queuedSoldiers = game.spawnQueue.filter(item => item.isPlayer !== false).length;
                    const otherActiveWorkers = game.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING' && w !== this).length;
                    const maxPossibleIdle = Math.max(0, game.playerResources.maxPop - (livingSoldiers + queuedSoldiers + otherActiveWorkers));
                    game.playerResources.idlePop = Math.min(maxPossibleIdle, (game.playerResources.idlePop || 0) + 1);
                    this.state = 'FINISHED';
                    break;
                }

                const currentSpeed = (isSprinting ? 125 : this.speed) + (formationIdx % 4) * 2;
                const distToTarget = Math.abs(effectiveTargetX - this.x);
                if (distToTarget > 4) {
                    this.isMoving = true;
                    const step = Math.sign(effectiveTargetX - this.x) * currentSpeed * dt;
                    if (Math.abs(step) >= distToTarget) {
                        this.x = effectiveTargetX;
                    } else {
                        this.x += step;
                    }
                } else {
                    this.isMoving = false;
                }

                const nodeReachDist = (this.role === 'center_gold') ? 45 : 8;
                if (Math.abs(this.targetNodeX - this.x) <= nodeReachDist) {
                    this.state = 'WORKING';
                    this.workTimer = 0;
                    this.stuckTimer = 0;
                }
                break;

            case 'WORKING':
                this.isMoving = false;
                this.workTimer += dt;
                if (this.isPlayer && Math.random() < 0.05 && game.sound) {
                    if (this.role === 'wood') game.sound.playChop(this.x);
                    else if (this.role === 'stone' || this.role === 'center_gold') game.sound.playMine(this.x);
                }

                if (this.workTimer >= this.workDuration) {
                    this.workTimer = 0;
                    this.stuckTimer = 0;
                    this.carryingAmount = this.gatherAmount;
                    this.state = 'WALKING_TO_BASE';
                }
                break;

            case 'WALKING_TO_BASE':
                // Grįžtant su resursais – eina tiesiai link bazės padidintu greičiu
                const returnSpeed = (this.speed + 15) + (formationIdx % 3) * 4;
                const distToBase = Math.abs(this.baseX - this.x);
                if (distToBase > 10) {
                    this.isMoving = true;
                    const step = Math.sign(this.baseX - this.x) * returnSpeed * dt;
                    if (Math.abs(step) >= distToBase) {
                        this.x = this.baseX;
                    } else {
                        this.x += step;
                    }
                } else {
                    this.isMoving = false;
                    // Iškrauti resursus ir grąžinti žmogų į laisvą populiaciją
                    if (this.carryingAmount > 0) {
                        const showTexts = (!game.settings || (game.settings.baseFloatingTexts !== false && game.settings.baseInWorldUI !== false));
                        if (this.isPlayer) {
                            const livingSoldiers = game.soldiers.filter(s => s.isPlayer && s.state !== 'DYING').length;
                            const queuedSoldiers = game.spawnQueue.filter(item => item.isPlayer !== false).length;
                            const otherActiveWorkers = game.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING' && w !== this).length;
                            const maxPossibleIdle = Math.max(0, game.playerResources.maxPop - (livingSoldiers + queuedSoldiers + otherActiveWorkers));

                            if (this.role === 'center_gold') {
                                const mult = this.gatherAmount / 10;
                                const goldYield = Math.round(25 * mult);
                                const xpYield = Math.round(40 * mult);
                                game.playerGold += goldYield;
                                game.playerXp += xpYield;
                                game.playerResources.idlePop = Math.min(maxPossibleIdle, (game.playerResources.idlePop || 0) + 1);
                                if (game.sound && game.sound.playGoldCache) game.sound.playGoldCache();
                                if (showTexts) {
                                    game.floatingTexts.push({
                                        text: `💎 +${goldYield}💰 +${xpYield}XP (+1👥)`,
                                        x: this.x,
                                        y: RTS_DATA.GROUND_Y - 55,
                                        color: '#f1c40f',
                                        life: 1.6,
                                        maxLife: 1.6
                                    });
                                }
                            } else {
                                const xpGain = this.role === 'stone' ? 25 : 18;
                                game.playerResources[this.role] = (game.playerResources[this.role] || 0) + this.carryingAmount;
                                game.playerResources.idlePop = Math.min(maxPossibleIdle, (game.playerResources.idlePop || 0) + 1);
                                game.playerXp += xpGain;
                                if (game.sound && game.sound.playCoin) game.sound.playCoin(this.x);
                                if (showTexts) {
                                    game.floatingTexts.push({
                                        text: `+${this.carryingAmount} ${this.getIcon()} (+${xpGain}XP +1👥)`,
                                        x: this.x,
                                        y: RTS_DATA.GROUND_Y - 50,
                                        color: this.getColor(),
                                        life: 1.2,
                                        maxLife: 1.2
                                    });
                                }
                            }
                        } else {
                            const livingSoldiers = game.soldiers.filter(s => !s.isPlayer && s.state !== 'DYING').length;
                            const otherActiveWorkers = game.enemyWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING' && w !== this).length;
                            const maxPossibleIdleEnemy = Math.max(0, game.enemyResources.maxPop - (livingSoldiers + otherActiveWorkers));
                            if (this.role === 'center_gold') {
                                game.enemyGold += 25;
                                game.enemyXp += 30;
                                game.enemyResources.idlePop = Math.min(maxPossibleIdleEnemy, (game.enemyResources.idlePop || 0) + 1);
                            } else {
                                game.enemyResources[this.role] = (game.enemyResources[this.role] || 0) + this.carryingAmount;
                                game.enemyResources.idlePop = Math.min(maxPossibleIdleEnemy, (game.enemyResources.idlePop || 0) + 1);
                                game.enemyXp += 15;
                            }
                        }
                        this.carryingAmount = 0;
                    }
                    this.state = 'FINISHED';
                }
                break;
        }
    }

    takeDamage(dmg, fromPlayer, game) {
        if (this.state === 'DYING' || this.state === 'DEAD' || this.state === 'FINISHED') return;
        this.hp -= dmg;
        this.hitFlash = 1.0;
        game.floatingTexts.push({
            text: `-${dmg}`,
            x: this.x,
            y: RTS_DATA.GROUND_Y - 45,
            color: '#ef4444',
            life: 0.8,
            maxLife: 0.8
        });

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'DYING';
            this.deathTimer = 0.0;
            this.deathDuration = 1.2;
            this.droppedGold = this.carryingAmount;
            this.carryingAmount = 0;

            const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';
            if (this.isPlayer) {
                game.stats.losses++;
                game.floatingTexts.push({
                    text: isEn ? `💀 Miner fallen!` : `💀 Kasėjas krito!`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - 65,
                    color: '#ef4444',
                    life: 1.8,
                    maxLife: 1.8
                });
            } else {
                game.stats.kills++;
            }

            if (this.droppedGold > 0) {
                game.floatingTexts.push({
                    text: isEn ? `💰 Lost ${this.droppedGold} gold!` : `💰 Prarasta ${this.droppedGold} aukso!`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - 85,
                    color: '#f59e0b',
                    life: 2.0,
                    maxLife: 2.0
                });
            }
        }
    }

    getIcon() {
        if (this.role === 'wood') return '🪵';
        if (this.role === 'stone') return '🪨';
        if (this.role === 'food') return '🌾';
        if (this.role === 'center_gold') return '💎';
        return '📦';
    }

    getColor() {
        if (this.role === 'wood') return '#e67e22';
        if (this.role === 'stone') return '#bdc3c7';
        if (this.role === 'food') return '#2ecc71';
        if (this.role === 'center_gold') return '#f1c40f';
        return '#f1c40f';
    }
}

// ----------------------------------------------------------------------------
// 2. KARYS MŪŠIO LAUKE (CANONICAL SOLDIER SU TIKSLIA EDGE-TO-EDGE KOVA)
// ----------------------------------------------------------------------------
class RTSSoldier {
    constructor(isPlayer, unitData, era, startX) {
        this.id = 'sol_' + Math.random().toString(36).substr(2, 8);
        this.isPlayer = isPlayer;
        this.data = unitData;
        this.era = era;
        this.x = startX;
        this.createdAt = Date.now();
        this.laneOffsetY = Math.random() * 10; // Natūralus gylis ant žemės (0..10px žemyn į priekinį planą, niekada virš žemės!)
        this.y = RTS_DATA.GROUND_Y;
        this.width = unitData.type === 'heavy' ? 65 : 36;
        this.height = unitData.type === 'heavy' ? 70 : 45;

        this.hp = unitData.hp;
        this.maxHp = unitData.hp;
        this.damage = unitData.damage;
        this.range = unitData.range;
        this.speed = unitData.speed;
        this.attackSpeed = unitData.attackSpeed;
        this.attackCooldown = 0;
        this.attackProgress = 0;
        this.isMoving = true;
        this.isAttacking = false;
        this.animTime = Math.random() * 2;
        this.hitFlash = 0;
        this.targetScanCooldown = Math.random() * 0.12;
        this.currentTarget = null;

        // Didvyrio savybės ir auros
        this.isHero = !!unitData.aura || (unitData.id && unitData.id.includes('hero'));
        this.aura = unitData.aura || null;
        this.auraRadius = unitData.auraRadius || 200;
        this.auraValue = unitData.auraValue || 0;

        // Veteranizmas ir patirtis mūšyje (Rank 0 = Eilinis, 1 = ⭐ Veteranas, 2 = ⭐⭐ Elitas, 3 = ⭐⭐⭐ Čempionas)
        this.kills = 0;
        this.rank = 0;

        // Būsenų efektai ir Herojaus aktyvi galia
        this.heroSkillCooldown = 0;
        this.heroInvulnerableTime = 0;
        this.isStunned = 0;
        this.bleedTimer = 0;
        this.bleedDps = 0;

        // Karybos Akademijos (Military Academy) tobulinimų bonusai kariams
        const gameRef = (typeof window !== 'undefined' && window.game) ? window.game : null;
        if (gameRef && gameRef.getUpgradeLevel) {
            const milLvl = gameRef.getUpgradeLevel('military_academy', isPlayer);
            if (milLvl > 0 && RTS_DATA.UPGRADES && RTS_DATA.UPGRADES.military_academy) {
                const milData = RTS_DATA.UPGRADES.military_academy.levels[milLvl - 1];
                if (milData) {
                    if (milData.hpBoost) {
                        this.maxHp = Math.round(this.maxHp * (1 + milData.hpBoost));
                        this.hp = this.maxHp;
                    }
                    if (milData.dmgBoost) {
                        this.damage = Math.round(this.damage * (1 + milData.dmgBoost));
                    }
                    if (milData.speedBoost) {
                        this.speed = Math.round(this.speed * (1 + milData.speedBoost));
                    }
                }
            }
        }
    }

    registerKill(game) {
        this.kills++;
        const prevRank = this.rank;

        // KAUPIAMOJI 1 -> 2 -> 3 -> 4 NUŽUDYMŲ PROGRESIJA ŽVAIGŽDUTĖMS:
        // Rank 1: 1 nukautas priešas (Iš viso: 1)
        // Rank 2: dar 2 nukauti priešai (Iš viso: 1 + 2 = 3)
        // Rank 3: dar 3 nukauti priešai (Iš viso: 1 + 2 + 3 = 6)
        // Rank 4: dar 4 nukauti priešai (Iš viso: 1 + 2 + 3 + 4 = 10)

        const isEn = typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en';

        if (this.kills === 1) {
            this.rank = 1;
            this.maxHp = Math.round(this.maxHp * 1.10);
            this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.20));
            this.damage = Math.round(this.damage * 1.10);
            if (game) {
                game.floatingTexts.push({
                    text: isEn ? `⭐ 1 Star (+10% Power)! (Next: 2 more ⚔️)` : `⭐ 1 Žvaigždė (+10% Galia)! (Kitas: dar 2 ⚔️)`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: this.isPlayer ? '#fde047' : '#fca5a5',
                    life: 2.0,
                    maxLife: 2.0
                });
                if (game.sound) game.sound.playLevelUp(this.x);
                this.spawnRankLevelUpParticles(game, '#fbbf24');
            }
        } else if (this.kills === 2) {
            if (game) {
                game.floatingTexts.push({
                    text: isEn ? `⚔️ Slain! (1/2 to ⭐⭐)` : `⚔️ Nukautas! (1/2 iki ⭐⭐)`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: '#e2e8f0',
                    life: 1.5,
                    maxLife: 1.5
                });
            }
        } else if (this.kills === 3) {
            this.rank = 2;
            this.maxHp = Math.round(this.maxHp * 1.10);
            this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.25));
            this.damage = Math.round(this.damage * 1.10);
            if (game) {
                game.floatingTexts.push({
                    text: isEn ? `⭐⭐ 2 Stars (+20% Power)! (Next: 3 more ⚔️)` : `⭐⭐ 2 Žvaigždės (+20% Galia)! (Kitas: dar 3 ⚔️)`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: this.isPlayer ? '#fbbf24' : '#f87171',
                    life: 2.0,
                    maxLife: 2.0
                });
                if (game.sound) game.sound.playLevelUp(this.x);
                this.spawnRankLevelUpParticles(game, '#fbbf24');
            }
        } else if (this.kills === 4 || this.kills === 5) {
            const step = this.kills - 3;
            if (game) {
                game.floatingTexts.push({
                    text: isEn ? `⚔️ Slain! (${step}/3 to ⭐⭐⭐)` : `⚔️ Nukautas! (${step}/3 iki ⭐⭐⭐)`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: '#e2e8f0',
                    life: 1.5,
                    maxLife: 1.5
                });
            }
        } else if (this.kills === 6) {
            this.rank = 3;
            this.maxHp = Math.round(this.maxHp * 1.10);
            this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.30));
            this.damage = Math.round(this.damage * 1.10);
            if (game) {
                game.floatingTexts.push({
                    text: isEn ? `⭐⭐⭐ VETERAN (+30% Power)! (Next: 4 more ⚔️)` : `⭐⭐⭐ VETERANAS (+30% Galia)! (Kitas: dar 4 ⚔️)`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: this.isPlayer ? '#f59e0b' : '#ef4444',
                    life: 2.2,
                    maxLife: 2.2
                });
                if (game.sound) game.sound.playLevelUp(this.x);
                this.spawnRankLevelUpParticles(game, '#f59e0b');
            }
        } else if (this.kills >= 7 && this.kills <= 9) {
            const step = this.kills - 6;
            if (game) {
                game.floatingTexts.push({
                    text: isEn ? `⚔️ Slain! (${step}/4 to 👑 Champion)` : `⚔️ Nukautas! (${step}/4 iki 👑 Čempiono)`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: '#e2e8f0',
                    life: 1.5,
                    maxLife: 1.5
                });
            }
        } else if (this.kills >= 10 && this.rank < 4) {
            this.rank = 4;
            this.maxHp = Math.round(this.maxHp * 1.10);
            this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.35));
            this.damage = Math.round(this.damage * 1.10);
            this.speed = Math.round(this.speed * 1.15);
            if (game) {
                const champColor = this.isPlayer ? '#00f2fe' : '#ef4444';
                game.floatingTexts.push({
                    text: isEn ? `👑 ⭐⭐⭐⭐ CHAMPION (+40% Power & Speed)!` : `👑 ⭐⭐⭐⭐ ČEMPIONAS (+40% Galia & Greitis)!`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 24,
                    color: champColor,
                    life: 2.6,
                    maxLife: 2.6
                });
                if (game.sound) game.sound.playLevelUp(this.x);
                this.spawnRankLevelUpParticles(game, champColor);
            }
        }

        // Papildomi akademijos ir prekybos bonusai
        if (game && game.getUpgradeLevel) {
            // Karybos Akademija Lv 5: Mūšio Įniršis (Battle Frenzy)
            const milLvl = game.getUpgradeLevel('military_academy', this.isPlayer);
            if (milLvl >= 5) {
                const friendlies = game.soldiers.filter(s => s.isPlayer === this.isPlayer && s.state !== 'DYING' && Math.abs(s.x - this.x) <= 220);
                for (const s of friendlies) {
                    s.frenzyTimer = 4.0;
                    s.hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * 0.10));
                }
                game.floatingTexts.push({
                    text: isEn ? `🔥 ENRAGE! +35% Speed & Regen` : `🔥 ĮNIRŠIS! +35% Greitis & Gijimas`,
                    x: this.x,
                    y: RTS_DATA.GROUND_Y - this.height - 42,
                    color: '#f97316',
                    life: 1.8,
                    maxLife: 1.8
                });
            }

            // Turgus & Rinka Lv 4+: Karo Grobis (+10-25% auksas)
            const tradeLvl = game.getUpgradeLevel('trade_economy', this.isPlayer);
            if (tradeLvl >= 4) {
                const bonusRate = (tradeLvl >= 5) ? 0.25 : 0.10;
                const baseVal = (this.data && this.data.cost && this.data.cost.gold) ? this.data.cost.gold : 30;
                const bonusGold = Math.max(5, Math.round(baseVal * bonusRate));
                if (this.isPlayer) {
                    game.playerGold += bonusGold;
                } else {
                    game.enemyGold += bonusGold;
                }
                if (this.isPlayer) {
                    game.floatingTexts.push({
                        text: isEn ? `💰 War Spoils +${bonusGold}` : `💰 Karo Grobis +${bonusGold}`,
                        x: this.x + 20,
                        y: RTS_DATA.GROUND_Y - this.height - 20,
                        color: '#fbbf24',
                        life: 1.4,
                        maxLife: 1.4
                    });
                }
            }
        }
    }

    spawnRankLevelUpParticles(game, color = '#fbbf24') {
        if (!game || !game.particles) return;
        for (let i = 0; i < 18; i++) {
            game.particles.push({
                x: this.x + (Math.random() - 0.5) * 24,
                y: RTS_DATA.GROUND_Y - Math.random() * (this.height + 20),
                vx: (Math.random() - 0.5) * 35,
                vy: -50 - Math.random() * 60,
                size: 3 + Math.random() * 4,
                color: color,
                life: 0.9,
                maxLife: 0.9
            });
        }
    }

    update(dt, game) {
        this.animTime += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt * 6;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.heroSkillCooldown > 0) this.heroSkillCooldown -= dt;
        if (this.heroInvulnerableTime > 0) this.heroInvulnerableTime -= dt;
        if (this.frenzyTimer > 0) this.frenzyTimer -= dt;

        // Kraujavimo žala
        if (this.bleedTimer > 0) {
            this.bleedTimer -= dt;
            this.hp -= this.bleedDps * dt;
            if (this.hp <= 0 && game) {
                this.hp = 0;
                this.state = 'DYING';
            }
        }

        // Paralyžius / Stun efektas
        if (this.isStunned > 0) {
            this.isStunned -= dt;
            this.isMoving = false;
            this.isAttacking = false;
            return;
        }

        // BAZĖS GYDYMAS: jei karys yra prie savo bazės ir niekas jo nepuola -> regeneruoja gyvybes!
        const isNearBase = this.isPlayer 
            ? (this.x <= RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 140)
            : (this.x >= RTS_DATA.ENEMY_BASE_X - 140);

        if (isNearBase && !this.isAttacking && this.hitFlash <= 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 16 * dt);
        }

        // Didvyrių auros efektai
        if (this.isHero && this.aura === 'heal') {
            for (const ally of game.soldiers) {
                if (ally.isPlayer === this.isPlayer && Math.abs(ally.x - this.x) <= this.auraRadius) {
                    ally.hp = Math.min(ally.maxHp, ally.hp + this.auraValue * dt);
                }
            }
        }

        // Taktinė būsena
        const stance = this.isPlayer ? (game.tacticalStance || 'attack') : (game.enemyTacticalStance || 'attack');

        // Bazinės gynybos ir atsitraukimo ribos
        // Trauktis: visiškai prie pat bazės vartų / pilies sienos (kaip klasikiniame Clash of Eras)
        // Gynyba: priekinė lauko gynybinė linija (toliau lauke, ~240px nuo bazės)
        const baseFrontX = this.isPlayer 
            ? (RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 8)
            : (RTS_DATA.ENEMY_BASE_X - 8);
        const defendLimitX = this.isPlayer 
            ? (RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 240) 
            : (RTS_DATA.ENEMY_BASE_X - 240);

        if (this.targetScanCooldown > 0) this.targetScanCooldown -= dt;

        // 1. PIRMAS PRIORITETAS: Taktinis elgesys pagal pasirinktą režimą
        let target = null;
        if (stance === 'retreat') {
            this.hp = Math.min(this.maxHp, this.hp + 14 * dt);
            const distToBase = this.isPlayer ? (this.x - baseFrontX) : (baseFrontX - this.x);
            if (distToBase > 4) {
                // Aktyvus bėgimas link pačios bazės
                const retreatFactor = this.calculateRetreatMoveFactor(game, baseFrontX);
                if (retreatFactor > 0.05) {
                    this.currentTarget = null;
                    this.isRetreating = true;
                    this.isMoving = true;
                    this.isAttacking = false;
                    this.attackFacing = null;
                    this.x += (this.isPlayer ? -1 : 1) * this.speed * retreatFactor * 0.98 * dt;
                    return; // Vykdo atsitraukimą
                }
            }
            // Pasiekė bazės rikiuotę – sustoja prie pat bazės, pasisuka į priekį ir ginasi nuo priešo
            this.isRetreating = false;
            this.isMoving = false;
            if (this.currentTarget && this.isValidTarget(this.currentTarget, game)) {
                target = this.currentTarget;
            } else {
                target = this.findTarget(game);
                this.currentTarget = target;
            }
        } else {
            // Attack arba Defend: Visada pirma tikriname ar pasiekiamas priešas
            this.isRetreating = false;
            if (this.currentTarget && this.isValidTarget(this.currentTarget, game)) {
                target = this.currentTarget;
            } else if (this.targetScanCooldown <= 0) {
                target = this.findTarget(game);
                this.currentTarget = target;
                this.targetScanCooldown = 0.12;
            } else {
                target = this.currentTarget;
            }
        }

        // 2. KOVA (Jei taikinys pasiekiamas):
        if (target) {
            this.isMoving = false;
            this.isAttacking = true;
            this.isRetreating = false;

            // TAKTINIS DIDVYRIO AI: protingai nusprendžia kada paleisti super-galią didžiausiam efektui!
            if (this.isHero && this.heroSkillCooldown <= 0 && game && game.triggerHeroSkill) {
                const enemiesAhead = game.soldiers.filter(s => s.isPlayer !== this.isPlayer && Math.abs(s.x - this.x) <= 280 && s.state !== 'DYING');
                const alliesNearby = game.soldiers.filter(s => s.isPlayer === this.isPlayer && Math.abs(s.x - this.x) <= 240);
                const woundedAllies = alliesNearby.filter(s => s.hp < s.maxHp * 0.70);
                
                const skillId = (this.data.activeSkill && this.data.activeSkill.id) || '';

                let shouldCast = false;
                if (skillId === 'ancestral_heal') {
                    shouldCast = (woundedAllies.length >= 2) || (this.hp < this.maxHp * 0.65) || (enemiesAhead.length >= 2);
                } else if (skillId === 'holy_smite' || skillId === 'shadow_dash') {
                    shouldCast = (enemiesAhead.length >= 2) || (this.hp < this.maxHp * 0.60);
                } else if (skillId === 'cannon_barrage' || skillId === 'missile_barrage' || skillId === 'ion_hyperbeam' || skillId === 'emp_blast') {
                    shouldCast = (enemiesAhead.length >= 2) || enemiesAhead.some(e => e.isHero || e.data.type === 'heavy');
                } else {
                    shouldCast = enemiesAhead.length >= 1;
                }

                if (shouldCast) {
                    game.triggerHeroSkill(this.isPlayer);
                }
            }
            if (target.target && typeof target.target.x === 'number' && Number.isFinite(target.target.x)) {
                this.attackFacing = (target.target.x >= this.x) ? 1 : -1;
                const tY = (target.target.height) ? (RTS_DATA.GROUND_Y - target.target.height * 0.5) : (RTS_DATA.GROUND_Y - 30);
                const dX = Math.abs(target.target.x - this.x);
                const dY = tY - (RTS_DATA.GROUND_Y - this.height * 0.6);
                const rawAim = Math.atan2(dY, Math.max(12, dX));
                this.aimAngle = Number.isFinite(rawAim) ? Math.max(-0.65, Math.min(0.65, rawAim)) : 0;
            } else if (target.type === 'base') {
                const bX = this.isPlayer ? RTS_DATA.ENEMY_BASE_X + 40 : RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH - 40;
                this.attackFacing = (bX >= this.x) ? 1 : -1;
                const dX = Math.abs(bX - this.x);
                const dY = (RTS_DATA.GROUND_Y - 90) - (RTS_DATA.GROUND_Y - this.height * 0.6);
                const rawAim = Math.atan2(dY, Math.max(12, dX));
                this.aimAngle = Number.isFinite(rawAim) ? Math.max(-0.65, Math.min(0.65, rawAim)) : 0;
            } else {
                this.aimAngle = 0;
            }
            this.attackProgress = Math.min(1, 1 - (this.attackCooldown / this.attackSpeed));

            if (this.attackCooldown <= 0) {
                this.executeAttack(target, game);
                this.attackCooldown = this.attackSpeed;
            }
            return;
        }

        // 3. NĖRA TAIKINIO KOVOS ZONOJE – TAKTINIS JUDĖJIMAS:
        this.currentTarget = null;
        this.attackFacing = null;
        this.aimAngle = 0;
        this.isAttacking = false;

        if (stance === 'attack') {
            // Puolimas: judame į priekį link priešo bazės
            this.isRetreating = false;
            const moveFactor = this.calculateMoveFactor(game);
            if (moveFactor > 0.05) {
                this.isMoving = true;
                this.x += (this.isPlayer ? 1 : -1) * this.speed * moveFactor * 1.15 * dt;
            } else {
                this.isMoving = false;
            }
        } else if (stance === 'defend') {
            // Gynyba: laikomės defendLimitX zonos
            const isFarAhead = this.isPlayer ? (this.x > defendLimitX + 6) : (this.x < defendLimitX - 6);
            const isBehindLine = this.isPlayer ? (this.x < defendLimitX - 6) : (this.x > defendLimitX + 6);

            if (isFarAhead) {
                // Esame toli priekyje – sklandžiai grįžtame atgal į gynybos rikiuotę
                const retreatFactor = this.calculateRetreatMoveFactor(game, defendLimitX);
                if (retreatFactor > 0.05) {
                    this.isRetreating = true;
                    this.isMoving = true;
                    this.x += (this.isPlayer ? -1 : 1) * this.speed * retreatFactor * 0.85 * dt;
                } else {
                    this.isRetreating = false;
                    this.isMoving = false;
                }
            } else if (isBehindLine) {
                // Esame arčiau bazės (pvz. naujai pasamdytas karys) – žygiuojame į priekį iki gynybos linijos
                this.isRetreating = false;
                const moveFactor = this.calculateMoveFactor(game);
                if (moveFactor > 0.05) {
                    this.isMoving = true;
                    this.x += (this.isPlayer ? 1 : -1) * this.speed * moveFactor * 0.75 * dt;
                } else {
                    this.isMoving = false;
                }
            } else {
                // Pasiekėme gynybos linijos zoną – tvarkingai stovime ir laukiame priešo
                this.isRetreating = false;
                this.isMoving = false;
            }
        } else {
            // Retreat režime pasiekus bazę: stovime vietoje
            this.isRetreating = false;
            this.isMoving = false;
        }

        // Bazių ribų apsauga
        const minPlayerX = RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 2;
        const maxEnemyX = RTS_DATA.ENEMY_BASE_X - 2;
        if (this.isPlayer && this.x < minPlayerX) this.x = minPlayerX;
        if (!this.isPlayer && this.x > maxEnemyX) this.x = maxEnemyX;
    }

    calculateRetreatMoveFactor(game, targetBoundaryX) {
        let factor = 1.0;

        // 1. Bazės / Gynybos ribos patikra
        const distToBoundary = this.isPlayer 
            ? (this.x - targetBoundaryX) 
            : (targetBoundaryX - this.x);

        if (distToBoundary <= 0) {
            return 0; // Jau pasiekė arba kirto ribą – sustoti
        }

        if (distToBoundary < 10) {
            factor = Math.min(factor, distToBoundary / 10);
        }

        // 2. Sąjungininkai atsitraukimo kryptimi (tie, kurie yra arčiau bazės / toliau atsitraukę)
        const stance = this.isPlayer ? (game.tacticalStance || 'attack') : (game.enemyTacticalStance || 'attack');
        const isRetreatStance = (stance === 'retreat');
        const isMelee = (this.range <= 80);

        for (const other of game.soldiers) {
            if (other === this || other.isPlayer !== this.isPlayer || other.state === 'DYING') continue;

            const dist = this.isPlayer ? (this.x - other.x) : (other.x - this.x);
            if (dist <= 0) continue; // Sąjungininkas yra už nugaros bėgant atgal – netrukdo

            // 1 Taisyklė: Bėgimo metu greitesnis karys gali sklandžiai aplenkti lėtesnį bėgantį sąjungininką
            if (other.isMoving && this.speed > other.speed && dist < 35) {
                continue; // Sklandus aplenkimas judant
            }

            // 2 Taisyklė: Glaudi formacija & atstumų išlaikymas (Retreat režime glaustesnė rikiuotė prie pat bazės)
            const minSpacing = isRetreatStance
                ? ((this.width + other.width) * 0.28 + 2)
                : (isMelee ? ((this.width + other.width) * 0.35 + 4) : ((this.width + other.width) * 0.45 + 6));

            if (dist < minSpacing * 1.5) {
                if (dist < minSpacing * 0.6) {
                    return 0; // Per arti – sustoti rikiuotėje už sąjungininko
                }
                const ratio = (dist - minSpacing * 0.6) / (minSpacing * 0.8);
                factor = Math.min(factor, Math.max(0, ratio));
            }
        }

        // Savos bazės siena netrukdo saviems kariams atsitraukti pro vartus prie pilies
        // Tik priešo siena blokuotų priešą, jei toks scenarijus egzistuotų

        return factor;
    }

    getRearMeleeReachBonus(game) {
        if (this.range > 80) return 0; // Šauliams netaikoma
        const all = game.soldiers;
        let aheadCount = 0;
        for (let i = 0; i < all.length; i++) {
            const s = all[i];
            if (s !== this && s.isPlayer === this.isPlayer && s.state !== 'DYING' && s.hp > 0 && (s.range <= 80)) {
                if (this.isPlayer ? (s.x > this.x) : (s.x < this.x)) {
                    aheadCount++;
                    if (aheadCount > 2) break;
                }
            }
        }
        // Priekinis karys (aheadCount === 0) kovoja tiesiogiai.
        // 1-as galinis (aheadCount === 1) gauna +34px pasiekiamumą kirsti per petį.
        // 2-as galinis (aheadCount === 2) gauna +64px pasiekiamumą kirsti per petį.
        // 3-as ar tolimesnis (aheadCount > 2) disciplinuotai laukia rikiuotėje savo eilės!
        if (aheadCount === 1) return 24;
        if (aheadCount === 2) return 48;
        return 0;
    }

    calculateMoveFactor(game) {
        let factor = 1.0;

        // Gynybinės pozicijos riba (sustoti rikiuotėje priešais bazę ir laukti priešo)
        const stance = this.isPlayer ? (game.tacticalStance || 'attack') : (game.enemyTacticalStance || 'attack');
        if (stance === 'defend') {
            if (this.isPlayer && this.x >= RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + 236) {
                return 0;
            } else if (!this.isPlayer && this.x <= RTS_DATA.ENEMY_BASE_X - 236) {
                return 0;
            }
        }

        // Tikriname priešus – jei priešas pasiekiamas mūsų atakos spinduliu (su salvės buferiu šauliams), sustojame atakuoti
        const isRanged = (this.range > 80);
        const isMelee = !isRanged;
        const allSoldiers = game.soldiers;
        const rearBonus = isMelee ? this.getRearMeleeReachBonus(game) : 0;

        // Vieno perėjimo optimizuotas ciklas priešams ir sąjungininkams
        for (let i = 0; i < allSoldiers.length; i++) {
            const other = allSoldiers[i];
            if (other === this || other.state === 'DYING') continue;

            if (other.isPlayer !== this.isPlayer) {
                // Priešas: tikriname ar pasiekiamas atakos spinduliu (įskaitant 1-2 galinius karius)
                const absDist = Math.abs(other.x - this.x);
                const combatReach = isRanged 
                    ? (this.range + (this.width + other.width) * 0.5 + 20) 
                    : (this.range + (this.width + other.width) * 0.5 + 12 + rearBonus);
                if (absDist <= combatReach) {
                    return 0; // Priešas pasiekiamas – sustoti ir kariauti!
                }
            } else {
                // Sąjungininkas: formacijos rikiuotė ir prasilenkimas
                const dist = this.isPlayer ? (other.x - this.x) : (this.x - other.x);
                if (dist <= 0) continue; // Sąjungininkas už nugaros

                if (this.range < other.range) continue;
                if (!other.isAttacking && this.speed > other.speed && dist < 35) continue;

                // Glaudi ir tvarkinga rikiuotė petys į petį (šauliams tik 8-12px atstumas)
                const minSpacing = isMelee ? ((this.width + other.width) * 0.28 + 3) : ((this.width + other.width) * 0.16 + 2);
                if (dist < minSpacing) {
                    return 0; // Per arti – sustoti rikiuotėje
                } else if (dist < minSpacing * 1.35) {
                    const ratio = (dist - minSpacing) / (minSpacing * 0.35);
                    factor = Math.min(factor, Math.max(0, ratio));
                }
            }
        }

        // Monstrų išsiveržimas: monstrai portale niekada nestabdomi ir visada veržiasi į areną
        if (!this.isPlayer && (this.isMonster || game.gameMode === 'monsters')) {
            if (this.x >= RTS_DATA.ENEMY_BASE_X - 15) {
                return 1.0;
            }
        }

        // Siena blokuoja judėjimą į priekį (kariai pribėga tiesiai prie pat sienos paviršiaus)
        if (this.isPlayer && game.enemyWall && game.enemyWall.active && game.enemyWall.hp > 0) {
            if (this.x >= game.enemyWall.x - this.width * 0.5 - 2) return 0;
        }
        if (!this.isPlayer && game.playerWall && game.playerWall.active && game.playerWall.hp > 0) {
            if (this.x <= game.playerWall.x + game.playerWall.width + this.width * 0.5 + 2) return 0;
        }

        // Priešo bazės riba / Tamsos Portalo riba
        if (this.isPlayer) {
            const maxRight = (game.gameMode === 'monsters') ? (RTS_DATA.ENEMY_BASE_X + 90) : (RTS_DATA.ENEMY_BASE_X - this.width * 0.5 + 8);
            if (this.x >= maxRight) return 0;
        }
        if (!this.isPlayer && this.x <= RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH + this.width * 0.5 - 8) return 0;

        return factor;
    }

    findTarget(game) {
        let closest = null;
        let closestDist = Infinity;

        // 1. Priešo Kariai & Monstrai (atakuoti visus priešus pasiekiamus ginklo spinduliu + formacijos salvės pasiekiamumas šauliams)
        const isRanged = (this.range > 80);
        const rearBonus = isRanged ? 0 : this.getRearMeleeReachBonus(game);
        for (const other of game.soldiers) {
            if (other.isPlayer === this.isPlayer) continue;

            const absDist = Math.abs(other.x - this.x);
            // Šauliams suteikiame +130px salvės nuotolį, o 1-2 galiniams artimos kovos kariams papildomą pasiekiamumą kirsti per petį!
            const reach = isRanged 
                ? (this.range + (this.width + other.width) * 0.5 + 130) 
                : (this.range + (this.width + other.width) * 0.5 + 12 + rearBonus);

            if (absDist <= reach) {
                if (absDist < closestDist) {
                    closestDist = absDist;
                    closest = { type: 'soldier', target: other };
                }
            }
        }

        // 2. Gynybinė Siena arba Bazė (Prioritetas prieš tolimus/bėgančius darbininkus)
        if (!closest) {
            // Sienos ir bazės pasiekiamumas: artimos kovos kariai (įskaitant 1-2 galinius) ir šauliai
            const wallReach = isRanged ? (this.range + 80) : (this.width * 0.5 + 8 + rearBonus);
            const baseReach = isRanged ? (this.range + 80) : (this.width * 0.5 + 8 + rearBonus);

            if (this.isPlayer) {
                if (game.enemyWall && game.enemyWall.active && game.enemyWall.hp > 0) {
                    const distToWall = game.enemyWall.x - this.x;
                    if (distToWall <= wallReach) {
                        closest = { type: 'wall', target: game.enemyWall, isPlayerWall: false };
                    }
                }
                if (!closest) {
                    const targetX = (game.gameMode === 'monsters') ? (RTS_DATA.ENEMY_BASE_X + 40) : RTS_DATA.ENEMY_BASE_X;
                    const distToBase = targetX - this.x;
                    if (distToBase <= baseReach) {
                        closest = { type: 'base', target: game.enemyBase, isPlayerBase: false };
                    }
                }
            } else {
                if (game.playerWall && game.playerWall.active && game.playerWall.hp > 0) {
                    const distToWall = this.x - (game.playerWall.x + game.playerWall.width);
                    if (distToWall <= wallReach) {
                        closest = { type: 'wall', target: game.playerWall, isPlayerWall: true };
                    }
                }
                if (!closest) {
                    const distToBase = this.x - (RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH);
                    if (distToBase <= baseReach) {
                        closest = { type: 'base', target: game.playerBase, isPlayerBase: true };
                    }
                }
            }
        }

        // 3. Priešo Kasėjai / Darbininkai TIK JEI YRA TIESIOGIAI PRIEŠAIS KELIU (nepersisuka atgal ir nebėga iš paskos!)
        if (!closest) {
            const workersList = this.isPlayer ? game.enemyWorkers : game.playerWorkers;
            for (const w of workersList) {
                if (w.state === 'DEAD' || w.state === 'FINISHED') continue;

                // Tikrinti, ar darbininkas yra priekyje kario judėjimo kryptimi
                const isAhead = this.isPlayer ? (w.x >= this.x - 5) : (w.x <= this.x + 5);
                if (!isAhead) continue; // Nesivaiko bėgančių už nugaros!

                const absDist = Math.abs(w.x - this.x);
                const reach = this.range + (this.width + w.width) * 0.5 + 8;
                if (absDist <= reach) {
                    if (absDist < closestDist) {
                        closestDist = absDist;
                        closest = { type: 'worker', target: w };
                    }
                }
            }
        }

        return closest;
    }

    isValidTarget(t, game) {
        if (!t || !t.target) return false;
        const isRanged = (this.range > 80);
        const rearBonus = isRanged ? 0 : this.getRearMeleeReachBonus(game);
        if (t.type === 'soldier') {
            const s = t.target;
            if (!s || s.hp <= 0 || s.state === 'DYING') return false;
            const reach = isRanged 
                ? (this.range + (this.width + s.width) * 0.5 + 130) 
                : (this.range + (this.width + s.width) * 0.5 + 12 + rearBonus);
            return Math.abs(s.x - this.x) <= reach;
        }
        if (t.type === 'wall') {
            const w = t.target;
            if (!w || !w.active || w.hp <= 0) return false;
            const wallReach = isRanged ? (this.range + 80) : (this.width * 0.5 + 8 + rearBonus);
            const distToWall = this.isPlayer ? (w.x - this.x) : (this.x - (w.x + w.width));
            return distToWall > 0 && distToWall <= wallReach;
        }
        if (t.type === 'base') {
            const b = t.target;
            if (!b || b.hp <= 0) return false;
            const baseReach = isRanged ? (this.range + 80) : (this.width * 0.5 + 8 + rearBonus);
            const distToBase = this.isPlayer 
                ? (((game.gameMode === 'monsters') ? (RTS_DATA.ENEMY_BASE_X + 40) : RTS_DATA.ENEMY_BASE_X) - this.x)
                : (this.x - (RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH));
            return distToBase <= baseReach;
        }
        if (t.type === 'worker') {
            const wk = t.target;
            if (!wk || wk.state === 'DEAD' || wk.state === 'FINISHED') return false;
            const isAhead = this.isPlayer ? (wk.x >= this.x - 5) : (wk.x <= this.x + 5);
            return isAhead && Math.abs(wk.x - this.x) <= (this.range + (this.width + wk.width) * 0.5 + 8);
        }
        return false;
    }

    executeAttack(target, game) {
        const u = this.data;

        if (this.soundAttack(game)) {
            // Garso efektas paleistas
        }

        if (u.projectile) {
            let targetX = this.isPlayer ? RTS_DATA.ENEMY_BASE_X + 40 : RTS_DATA.PLAYER_BASE_X + RTS_DATA.PLAYER_BASE_WIDTH - 40;
            let targetY = RTS_DATA.GROUND_Y - 90;

            if (target.type === 'soldier' && target.target && typeof target.target.x === 'number') {
                targetX = target.target.x;
                targetY = RTS_DATA.GROUND_Y - (target.target.height || 45) * 0.5;
            } else if (target.type === 'worker' && target.target && typeof target.target.x === 'number') {
                targetX = target.target.x;
                targetY = RTS_DATA.GROUND_Y - (target.target.height || 38) * 0.5;
            } else if (target.type === 'wall' && target.target && typeof target.target.x === 'number') {
                targetX = target.target.x + (target.target.width || 40) * 0.5;
                targetY = RTS_DATA.GROUND_Y - (target.target.height || 80) * 0.5;
            }

            // Kulkos, strėlės ir sviediniai paleidžiami TIKSLIAI iš ginklo vamzdžio galiuko!
            const dir = (this.attackFacing !== null && this.attackFacing !== undefined) ? this.attackFacing : (this.isPlayer ? 1 : -1);
            const aim = this.aimAngle || 0;
            const weaponLen = (u.type === 'heavy') ? 36 : 22;
            const handY = RTS_DATA.GROUND_Y - this.height * 0.58;
            const startX = this.x + dir * (8 + Math.cos(aim) * weaponLen);
            const startY = handY + Math.sin(aim) * weaponLen;

            const p = new RTSProjectile(
                this.isPlayer,
                startX,
                startY,
                targetX,
                targetY,
                this.damage,
                u.projectile,
                u.projectileSpeed || 520,
                u.splash || 0,
                this
            );
            game.projectiles.push(p);
        } else {
            // Artimoji ataka
            game.applyDamage(target, this.damage, this.isPlayer, this);
        }
    }

    soundAttack(game) {
        if (!game.sound) return false;
        const u = this.data || {};
        if (u.projectile) {
            game.sound.playRangedShot(u.projectile, this.era, this.x);
        } else {
            game.sound.playMeleeHit(this.era, false, u.type || 'melee', this.x);
        }
        return true;
    }
}

// ----------------------------------------------------------------------------
// 3. SVIEDINYS (PROJECTILE SU TIKSLIU TRAP-PROOF HITBOX)
// ----------------------------------------------------------------------------
class RTSProjectile {
    constructor(isPlayer, startX, startY, targetX, targetY, damage, type = 'stone', speed = 500, splash = 0, shooter = null) {
        this.id = 'p_' + Math.random().toString(36).substr(2, 7);
        this.isPlayer = isPlayer;
        this.shooter = shooter;
        this.x = startX;
        this.y = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.type = type;
        this.speed = speed;
        this.splash = splash;
        this.trail = [];

        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.abs(dx) || 1;

        // Gravitacijos taikymas pagal ginklo tipą
        this.gravity = (type === 'stone' || type === 'boulder' || type === 'cannonball' || type === 'arrow') ? 280 : 0;

        // Tikslus skrydžio laikas
        const flightTime = Math.max(0.18, dist / speed);
        this.vx = dx / flightTime;

        // Parabolinė kompensacija: y(t) = y0 + vy*t + 0.5*g*t^2 => vy = (dy - 0.5*g*t^2) / t
        if (this.gravity > 0) {
            this.vy = (dy - 0.5 * this.gravity * flightTime * flightTime) / flightTime;
        } else {
            this.vy = dy / flightTime;
        }

        this.radius = (type === 'boulder' || type === 'cannonball' || type === 'plasma_bomb') ? 9 : 5;
        this.angle = Math.atan2(this.vy, this.vx);
        this.life = flightTime * 1.5;
    }
}

// ----------------------------------------------------------------------------
// 4. BAZĖS BOKŠTELIS (INSTALLED TURRET - 100% PATIKIMAS)
// ----------------------------------------------------------------------------
class RTSTurret {
    constructor(arg1, arg2, arg3, arg4) {
        this.id = 't_' + Math.random().toString(36).substr(2, 7);

        // Palaiko abi argumentų sekas: (isPlayer, slotIndex, data, era) IR (slotIndex, data, isPlayer, era)
        if (typeof arg1 === 'boolean') {
            this.isPlayer = arg1;
            this.slotIndex = arg2 || 0;
            this.data = arg3 || {};
            this.era = arg4 || 0;
        } else {
            this.slotIndex = arg1 || 0;
            this.data = arg2 || {};
            this.isPlayer = (arg3 !== undefined) ? arg3 : true;
            this.era = arg4 || 0;
        }

        this.attackCooldown = Math.random() * 0.5;
        this.target = null;
        this.aimAngle = this.isPlayer ? 0 : Math.PI;
    }

    update(dt, game, slotPos = null) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.recoilTimer > 0) this.recoilTimer -= dt;

        const pos = slotPos || this.getPosition();

        // Optimizuota taikinio talpykla: jei dabartinis taikinys dar gyvas ir zonoje, tęsiame jo sekimą
        let valid = false;
        if (this.target && this.target.hp > 0 && this.target.state !== 'DYING') {
            const range = (this.data && this.data.range) ? this.data.range : 450;
            const dist = Math.hypot(this.target.x - pos.x, (this.target.y || RTS_DATA.GROUND_Y - 20) - pos.y);
            if (dist <= range) {
                valid = true;
            }
        }
        if (!valid) {
            this.target = this.findTarget(pos.x, pos.y, game);
        }

        if (this.target) {
            const targetPos = this.getTargetPosition(this.target);
            this.aimAngle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x);
            this.targetAngle = this.aimAngle;

            if (this.attackCooldown <= 0) {
                this.shoot(pos, targetPos, game);
                this.attackCooldown = (this.data && this.data.attackSpeed) ? this.data.attackSpeed : 1.3;
            }
        } else {
            this.aimAngle = this.isPlayer ? -0.15 : Math.PI + 0.15;
            this.targetAngle = this.aimAngle;
        }
    }

    getPosition() {
        if (window.RTS_DATA && window.RTS_DATA.getTurretSlotPosition) {
            return window.RTS_DATA.getTurretSlotPosition(this.isPlayer, this.slotIndex);
        }
        const bw = RTS_DATA.PLAYER_BASE_WIDTH;
        const groundY = RTS_DATA.GROUND_Y;
        const by = groundY - RTS_DATA.PLAYER_BASE_HEIGHT;
        const baseX = this.isPlayer ? RTS_DATA.PLAYER_BASE_X : RTS_DATA.ENEMY_BASE_X;

        const slotOffsets = [
            { x: this.isPlayer ? bw - 22 : 22, y: 48 },  // 1. Priekinis barbakano bokštas
            { x: this.isPlayer ? 76 : bw - 76, y: 18 },   // 2. Vidurinis energijos/šaulių denis
            { x: this.isPlayer ? 38 : bw - 38, y: -14 },  // 3. Didysis aukštasis valdymo bokštas
            { x: this.isPlayer ? 18 : bw - 18, y: 52 }    // 4. Galinis bastiono/skydų bokštas
        ];

        const off = slotOffsets[this.slotIndex] || slotOffsets[0];
        return {
            x: baseX + off.x,
            y: by + off.y
        };
    }

    findTarget(x, y, game) {
        let closest = null;
        const range = (this.data && this.data.range) ? this.data.range : 480;
        let closestDist = range;

        for (const s of game.soldiers) {
            if (s.isPlayer === this.isPlayer) continue;
            const dist = Math.hypot(s.x - x, (RTS_DATA.GROUND_Y - s.height * 0.5) - y);
            if (dist <= range && dist < closestDist) {
                closestDist = dist;
                closest = { type: 'soldier', target: s };
            }
        }
        return closest;
    }

    getTargetPosition(target) {
        if (target && target.type === 'soldier' && target.target) {
            return {
                x: target.target.x,
                y: RTS_DATA.GROUND_Y - target.target.height * 0.5
            };
        }
        return { x: this.isPlayer ? 1200 : 400, y: RTS_DATA.GROUND_Y - 20 };
    }

    shoot(pos, targetPos, game) {
        this.recoilTimer = 0.15;
        const angle = this.aimAngle !== undefined ? this.aimAngle : (this.isPlayer ? 0 : Math.PI);
        const barrelLength = (this.data && this.data.barrelLength) || 30;

        // Tikslus patrankos vamzdžio galiuko taškas erdvėje
        const muzzleX = pos.x + Math.cos(angle) * barrelLength;
        const muzzleY = pos.y + Math.sin(angle) * barrelLength;

        if (game.sound) game.sound.playTurretShot((this.data && this.data.id) || (this.data && this.data.projectile) || 'stone', this.era, muzzleX);

        // Blyksnis tiesiai iš patrankos vamzdžio galiuko
        if (game.particles) {
            const flashColor = (this.era === 4) ? '#00f2fe' : ((this.era === 3) ? '#f59e0b' : '#f97316');
            game.particles.push({
                x: muzzleX,
                y: muzzleY,
                vx: Math.cos(angle) * 45,
                vy: Math.sin(angle) * 45,
                size: 4 + Math.random() * 3,
                color: flashColor,
                life: 0.2,
                maxLife: 0.2
            });
        }

        const p = new RTSProjectile(
            this.isPlayer,
            muzzleX,
            muzzleY,
            targetPos.x,
            targetPos.y,
            (this.data && this.data.damage) ? this.data.damage : 35,
            (this.data && this.data.projectile) ? this.data.projectile : 'stone',
            (this.data && this.data.projectileSpeed) ? this.data.projectileSpeed : 620,
            (this.data && this.data.splash) ? this.data.splash : 0
        );
        game.projectiles.push(p);
    }
}

window.RTSWorker = RTSWorker;
window.RTSSoldier = RTSSoldier;
window.RTSProjectile = RTSProjectile;
window.RTSTurret = RTSTurret;
