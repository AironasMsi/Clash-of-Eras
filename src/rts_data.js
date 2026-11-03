// ============================================================================
// CLASH OF ERAS - DATA & BALANCED PROGRESSION SPECIFICATIONS
// ============================================================================

window.RTS_DATA = {
    WORLD_WIDTH: 2400,
    WORLD_HEIGHT: 500,
    GROUND_Y: 420,

    // Zonos
    PLAYER_ZONE_START: 20,
    PLAYER_BASE_X: 340,
    PLAYER_BASE_WIDTH: 130,
    PLAYER_BASE_HEIGHT: 180,

    BATTLEFIELD_START: 470,
    BATTLEFIELD_END: 1930,
    NEUTRAL_CACHE_X: 1200,
    NEUTRAL_CACHE_YIELD: { gold: 25, xp: 40 },

    ENEMY_BASE_X: 1930,
    ENEMY_BASE_WIDTH: 130,
    ENEMY_BASE_HEIGHT: 180,
    ENEMY_ZONE_START: 2060,

    // Pradinis auksas ir resursai
    STARTING_GOLD: 175,
    ERA_BASE_MAX_POP: [8, 14, 20, 28, 38], // Kiekviena epocha turi vis didesnę populiacijos talpą!
    ERA_WALL_HP: [450, 1200, 2800, 5500, 11000], // Sienos gyvybės proporcingai auga kiekvienoje epochoje!
    EVOLUTION_COSTS: [
        { xp: 2200, wood: 80, stone: 60, food: 60 },
        { xp: 6500, wood: 180, stone: 150, food: 150 },
        { xp: 16000, wood: 360, stone: 300, food: 300 },
        { xp: 38000, wood: 650, stone: 580, food: 580 },
        { xp: 9999999, wood: 999999, stone: 999999, food: 999999 }
    ],
    STARTING_RESOURCES: {
        wood: 50,
        stone: 30,
        food: 50,
        idlePop: 4,
        maxPop: 8
    },

    // Populiacijos ciklas
    FOOD_PER_CITIZEN: 15,
    BASE_POP_SPAWN_INTERVAL: 4.5,
    INITIAL_MAX_POP: 8,
    BASE_GATHER_AMOUNT: 10,

    // Prekyvietės kainos (Parduoti medžiagas už Auksą)
    MARKET_RATES: {
        wood: { amount: 10, gold: 20 },
        stone: { amount: 10, gold: 25 },
        food: { amount: 10, gold: 15 }
    },

    // Bazių parametrai pagal epochas
    BASE_STATS: {
        0: { name: 'Akmens amžiaus Urvas', maxHp: 600 },
        1: { name: 'Viduramžių Pilis', maxHp: 1500 },
        2: { name: 'Renesanso Tvirtovė', maxHp: 3200 },
        3: { name: 'Modernus Bunkeris', maxHp: 6500 },
        4: { name: 'Ateities Citadelė', maxHp: 12000 }
    },

    // Bokštelių lizdų pirkimo kainos
    SLOT_COSTS: [
        { gold: 0, wood: 0, stone: 0 },
        { gold: 80, wood: 20, stone: 15 },
        { gold: 180, wood: 40, stone: 35 },
        { gold: 400, wood: 80, stone: 70 }
    ],

    // Tikslios 4 bokštelių lizdų koordinatės, idealiai priderintos prie visų bazių stogų ir bokštų
    getTurretSlotPosition(isPlayer, slotIndex) {
        const bw = this.PLAYER_BASE_WIDTH;
        const by = this.GROUND_Y - this.PLAYER_BASE_HEIGHT;
        const baseX = isPlayer ? this.PLAYER_BASE_X : this.ENEMY_BASE_X;

        const slotOffsets = [
            { x: isPlayer ? bw - 22 : 22, y: 48 },  // 1. Priekinis barbakano bokštas
            { x: isPlayer ? 76 : bw - 76, y: 18 },   // 2. Vidurinis energijos/šaulių denis
            { x: isPlayer ? 38 : bw - 38, y: -14 },  // 3. Didysis aukštasis valdymo bokštas
            { x: isPlayer ? 18 : bw - 18, y: 52 }    // 4. Galinis bastiono/skydų bokštas
        ];
        const offset = slotOffsets[slotIndex] || slotOffsets[0];
        return {
            x: baseX + offset.x,
            y: by + offset.y
        };
    },

    // 5 EVOLIUCINĖS EPOCHOS (GREITESNĖ IR SMAGESNĖ EVOLIUCIJA)
    AGES: [
        // -------------------------------------------------------------
        // ERA 1: AKMENS AMŽIUS
        // -------------------------------------------------------------
        {
            id: 0,
            name: 'Akmens amžius',
            theme: 'stone',
            skyColors: ['#ffaa5e', '#ffd28e', '#88c999'],
            evolveCost: { xp: 2200, wood: 80, stone: 60, food: 60 },
            ultimate: {
                name: 'Meteoritų lietus',
                cooldown: 35,
                damage: 220,
                meteorCount: 16,
                desc: 'Liepsnojantys meteoritai triuškina visus priešo karius.'
            },
            turrets: [
                {
                    id: 'slingshot',
                    name: 'Akmenų svaidyklė',
                    icon: '🪨',
                    cost: { gold: 70, wood: 0, stone: 0 },
                    sellGold: 45,
                    damage: 32,
                    range: 380,
                    attackSpeed: 1.3,
                    projectile: 'stone',
                    projectileSpeed: 550,
                    desc: 'Bokšto akmens mėtyklė prieš artėjančius priešus.'
                },
                {
                    id: 'fire_slingshot',
                    name: 'Dervos mėtyklė',
                    icon: '🔥',
                    cost: { gold: 120, wood: 0, stone: 0 },
                    sellGold: 75,
                    damage: 55,
                    range: 430,
                    attackSpeed: 1.5,
                    projectile: 'fire_stone',
                    projectileSpeed: 520,
                    desc: 'Mėto liepsnojančius dervuotus akmenis su ugnies žala.'
                },
                {
                    id: 'bone_catapult',
                    name: 'Ugnikalnio Mėtytuvas',
                    icon: '🌋',
                    cost: { gold: 180, wood: 0, stone: 0 },
                    sellGold: 110,
                    damage: 95,
                    range: 460,
                    attackSpeed: 2.0,
                    projectile: 'volcano_rock',
                    projectileSpeed: 480,
                    splash: 35,
                    desc: 'Svaido ugnikalnio magmos luitus su plotine žala.'
                }
            ],
            units: [
                {
                    id: 'clubman',
                    name: 'Kuokininkas',
                    icon: '🦴',
                    type: 'melee',
                    costGold: 25,
                    hp: 120,
                    damage: 22,
                    range: 40,
                    speed: 65,
                    attackSpeed: 1.0,
                    trainTime: 1.5,
                    bountyGold: 22,
                    bountyXp: 50,
                    desc: 'Pėstininkas su medine kuoka.'
                },
                {
                    id: 'rock_thrower',
                    name: 'Akmenisvaidis',
                    icon: '🪨',
                    type: 'ranged',
                    costGold: 50,
                    hp: 75,
                    damage: 26,
                    range: 230,
                    speed: 60,
                    attackSpeed: 1.2,
                    projectile: 'stone',
                    projectileSpeed: 460,
                    trainTime: 2.0,
                    bountyGold: 45,
                    bountyXp: 90,
                    desc: 'Tolimojo nuotolio karys su aštriais akmenimis.'
                },
                {
                    id: 'dino_rider',
                    name: 'Dino raitelis',
                    icon: '🦖',
                    type: 'heavy',
                    costGold: 150,
                    hp: 350,
                    damage: 65,
                    range: 50,
                    speed: 80,
                    attackSpeed: 1.1,
                    trainTime: 4.0,
                    bountyGold: 130,
                    bountyXp: 260,
                    desc: 'Galingas kovinis dinozauras. Pralaužia priešo linijas.'
                }
            ]
        },

        // -------------------------------------------------------------
        // ERA 2: VIDURAMŽIAI
        // -------------------------------------------------------------
        {
            id: 1,
            name: 'Viduramžių amžius',
            theme: 'medieval',
            skyColors: ['#6094b8', '#99c2db', '#6ca063'],
            evolveCost: { xp: 6500, wood: 180, stone: 150, food: 150 },
            ultimate: {
                name: 'Ugninių strėlių lietus',
                cooldown: 35,
                damage: 350,
                meteorCount: 22,
                desc: 'Liepsnojančių strėlių kruša apiberia visą mūšio lauką.'
            },
            turrets: [
                {
                    id: 'ballista',
                    name: 'Bokšto Balista',
                    icon: '🏹',
                    cost: { gold: 160, wood: 0, stone: 0 },
                    sellGold: 100,
                    damage: 95,
                    range: 480,
                    attackSpeed: 1.4,
                    projectile: 'bolt',
                    projectileSpeed: 650,
                    desc: 'Šaudo sunkiais geležiniais ietigaliais.'
                },
                {
                    id: 'catapult',
                    name: 'Tvirtovės Katapulta',
                    icon: '🎯',
                    cost: { gold: 320, wood: 0, stone: 0 },
                    sellGold: 200,
                    damage: 185,
                    range: 520,
                    attackSpeed: 2.0,
                    projectile: 'boulder',
                    projectileSpeed: 480,
                    splash: 50,
                    desc: 'Mėto didžiulius uolienų luitus su sprogstamuoju poveikiu.'
                },
                {
                    id: 'tar_boiler',
                    name: 'Dervos Katilas',
                    icon: '🛢️',
                    cost: { gold: 240, wood: 0, stone: 0 },
                    sellGold: 150,
                    damage: 140,
                    range: 440,
                    attackSpeed: 1.2,
                    projectile: 'tar_fire',
                    projectileSpeed: 540,
                    splash: 30,
                    desc: 'Iššauna degančios dervos pliūpsnius, deginančius priešų būrius.'
                }
            ],
            units: [
                {
                    id: 'swordsman',
                    name: 'Kalavijininkas',
                    icon: '⚔️',
                    type: 'melee',
                    costGold: 60,
                    hp: 260,
                    damage: 48,
                    range: 42,
                    speed: 70,
                    attackSpeed: 0.95,
                    trainTime: 2.0,
                    bountyGold: 52,
                    bountyXp: 120,
                    desc: 'Šarvuotas karys su kalaviju ir skydu.'
                },
                {
                    id: 'archer',
                    name: 'Ilgasis lankininkas',
                    icon: '🏹',
                    type: 'ranged',
                    costGold: 100,
                    hp: 150,
                    damage: 62,
                    range: 290,
                    speed: 65,
                    attackSpeed: 1.1,
                    projectile: 'arrow',
                    projectileSpeed: 560,
                    trainTime: 2.5,
                    bountyGold: 85,
                    bountyXp: 180,
                    desc: 'Taiklios strėlės iš saugaus atstumo.'
                },
                {
                    id: 'knight',
                    name: 'Šarvuotas Riteris',
                    icon: '🐴',
                    type: 'heavy',
                    costGold: 250,
                    hp: 750,
                    damage: 140,
                    range: 55,
                    speed: 95,
                    attackSpeed: 1.0,
                    trainTime: 4.5,
                    bountyGold: 210,
                    bountyXp: 450,
                    desc: 'Sunkusis riteris ant šarvuoto žirgo.'
                }
            ]
        },

        // -------------------------------------------------------------
        // ERA 3: RENESANSAS
        // -------------------------------------------------------------
        {
            id: 2,
            name: 'Renesanso amžius',
            theme: 'renaissance',
            skyColors: ['#7fa0b5', '#c09875', '#55694a'],
            evolveCost: { xp: 16000, wood: 360, stone: 300, food: 300 },
            ultimate: {
                name: 'Artilerijos salvė',
                cooldown: 35,
                damage: 750,
                meteorCount: 18,
                desc: 'Griausminga forto artilerijos salvė paverčia visus priešus pelenais.'
            },
            turrets: [
                {
                    id: 'renaissance_cannon',
                    name: 'Bastiono Patranka',
                    icon: '💣',
                    cost: { gold: 400, wood: 0, stone: 0 },
                    sellGold: 240,
                    damage: 280,
                    range: 540,
                    attackSpeed: 1.8,
                    projectile: 'cannonball',
                    projectileSpeed: 600,
                    splash: 55,
                    desc: 'Šaudo sunkiais ketaus sviediniais.'
                },
                {
                    id: 'double_cannon',
                    name: 'Dvigubas Pabūklas',
                    icon: '💥',
                    cost: { gold: 750, wood: 0, stone: 0 },
                    sellGold: 440,
                    damage: 490,
                    range: 580,
                    attackSpeed: 2.0,
                    projectile: 'cannonball',
                    projectileSpeed: 620,
                    splash: 65,
                    desc: 'Du sujungti parako pabūklai, šaudantys salvėmis.'
                },
                {
                    id: 'organ_gun',
                    name: 'Daugiavamzdė Ribauldequin',
                    icon: '🎯',
                    cost: { gold: 580, wood: 0, stone: 0 },
                    sellGold: 350,
                    damage: 360,
                    range: 510,
                    attackSpeed: 1.3,
                    projectile: 'bullet',
                    projectileSpeed: 800,
                    desc: 'Devynių vamzdžių salvė, šienaujanti visą pėstininkų liniją.'
                }
            ],
            units: [
                {
                    id: 'duelist',
                    name: 'Dvikovininkas',
                    icon: '🤺',
                    type: 'melee',
                    costGold: 140,
                    hp: 550,
                    damage: 110,
                    range: 45,
                    speed: 85,
                    attackSpeed: 0.8,
                    trainTime: 2.2,
                    bountyGold: 120,
                    bountyXp: 280,
                    desc: 'Vikrus fechtuotojas su aštria plienine špaga.'
                },
                {
                    id: 'musketeer',
                    name: 'Muskietininkas',
                    icon: '💂',
                    type: 'ranged',
                    costGold: 220,
                    hp: 340,
                    damage: 180,
                    range: 340,
                    speed: 65,
                    attackSpeed: 1.4,
                    projectile: 'bullet',
                    projectileSpeed: 860,
                    trainTime: 2.8,
                    bountyGold: 185,
                    bountyXp: 420,
                    desc: 'Parako šūvis, praduriantis bet kokius šarvus.'
                },
                {
                    id: 'mobile_cannon',
                    name: 'Mobili Patranka',
                    icon: '💣',
                    type: 'heavy',
                    costGold: 600,
                    hp: 1500,
                    damage: 380,
                    range: 280,
                    speed: 55,
                    attackSpeed: 1.7,
                    projectile: 'cannonball',
                    projectileSpeed: 580,
                    splash: 60,
                    trainTime: 5.0,
                    bountyGold: 500,
                    bountyXp: 1100,
                    desc: 'Arklių traukiama patranka, griaunanti visą priekį.'
                }
            ]
        },

        // -------------------------------------------------------------
        // ERA 4: MODERNUSIS AMŽIUS
        // -------------------------------------------------------------
        {
            id: 3,
            name: 'Modernusis amžius',
            theme: 'modern',
            skyColors: ['#3e4a52', '#7a8b94', '#2d382e'],
            evolveCost: { xp: 38000, wood: 650, stone: 580, food: 580 },
            ultimate: {
                name: 'Bombonešio antskrydis',
                cooldown: 35,
                damage: 1600,
                meteorCount: 20,
                isAirstrike: true,
                desc: 'Karinių pajėgų bombonešis numeta galingą bombų kilimą.'
            },
            turrets: [
                {
                    id: 'flak_cannon',
                    name: 'Automatinis Pabūklas',
                    icon: '🔫',
                    cost: { gold: 1000, wood: 0, stone: 0 },
                    sellGold: 600,
                    damage: 420,
                    range: 560,
                    attackSpeed: 0.75,
                    projectile: 'tracer',
                    projectileSpeed: 950,
                    desc: 'Itin greito šaudymo automatinis zenitinis pabūklas.'
                },
                {
                    id: 'rocket_turret',
                    name: 'Raketų Leistuvas',
                    icon: '🚀',
                    cost: { gold: 1800, wood: 0, stone: 0 },
                    sellGold: 1100,
                    damage: 1050,
                    range: 620,
                    attackSpeed: 1.8,
                    projectile: 'rocket',
                    projectileSpeed: 680,
                    splash: 70,
                    desc: 'Salvinės sprogstamosios raketos.'
                },
                {
                    id: 'tesla_coil',
                    name: 'Tesla Bokštas',
                    icon: '⚡',
                    cost: { gold: 1400, wood: 0, stone: 0 },
                    sellGold: 850,
                    damage: 780,
                    range: 520,
                    attackSpeed: 1.2,
                    projectile: 'lightning',
                    projectileSpeed: 1400,
                    desc: 'Aukštos įtampos elektros išlydžiai, perkertantys priešo šarvus.'
                }
            ],
            units: [
                {
                    id: 'assault_soldier',
                    name: 'Automatininkas',
                    icon: '🪖',
                    type: 'melee_mid',
                    costGold: 350,
                    hp: 1100,
                    damage: 220,
                    range: 150,
                    speed: 80,
                    attackSpeed: 0.6,
                    projectile: 'tracer',
                    projectileSpeed: 900,
                    trainTime: 2.2,
                    bountyGold: 300,
                    bountyXp: 700,
                    desc: 'Karys su automatiniu šautuvu. Greita ugnis.'
                },
                {
                    id: 'rocket_soldier',
                    name: 'Granatsvaidininkas',
                    icon: '🚀',
                    type: 'ranged',
                    costGold: 550,
                    hp: 780,
                    damage: 480,
                    range: 350,
                    speed: 65,
                    attackSpeed: 1.5,
                    projectile: 'rocket',
                    projectileSpeed: 620,
                    splash: 55,
                    trainTime: 3.0,
                    bountyGold: 460,
                    bountyXp: 1050,
                    desc: 'Šaudo sprogstamosiomis raketomis.'
                },
                {
                    id: 'battle_tank',
                    name: 'Kovinis Tankas',
                    icon: '🚜',
                    type: 'heavy',
                    costGold: 1500,
                    hp: 3600,
                    damage: 850,
                    range: 300,
                    speed: 60,
                    attackSpeed: 1.6,
                    projectile: 'tank_shell',
                    projectileSpeed: 750,
                    splash: 65,
                    trainTime: 5.5,
                    bountyGold: 1250,
                    bountyXp: 2800,
                    desc: 'Šarvuota plieno tvirtovė su galingu vamzdžiu.'
                }
            ]
        },

        // -------------------------------------------------------------
        // ERA 5: ATEITIES AMŽIUS
        // -------------------------------------------------------------
        {
            id: 4,
            name: 'Ateities amžius',
            theme: 'future',
            skyColors: ['#0f192b', '#1a0b2e', '#00f2fe'],
            evolveCost: { xp: 9999999, wood: 999999, stone: 999999, food: 999999 },
            ultimate: {
                name: 'Orbitinis Palydovo Lazeris',
                cooldown: 35,
                damage: 4200,
                meteorCount: 25,
                isLaserSweep: true,
                desc: 'Kosminis lazerinis spindulys akimirksniu nusluoja visus priešo dalinius.'
            },
            turrets: [
                {
                    id: 'plasma_turret',
                    name: 'Plazminis Pabūklas',
                    icon: '⚡',
                    cost: { gold: 2600, wood: 0, stone: 0 },
                    sellGold: 1600,
                    damage: 1300,
                    range: 650,
                    attackSpeed: 1.0,
                    projectile: 'plasma',
                    projectileSpeed: 900,
                    splash: 50,
                    desc: 'Plazminiai naikinamieji sprogimai.'
                },
                {
                    id: 'ion_beam_turret',
                    name: 'Joninis Lazeris',
                    icon: '🔮',
                    cost: { gold: 4800, wood: 0, stone: 0 },
                    sellGold: 2900,
                    damage: 2800,
                    range: 720,
                    attackSpeed: 1.5,
                    projectile: 'laser_beam',
                    projectileSpeed: 1600,
                    desc: 'Ištisinis jonų lazeris su kolosalia momentine žala.'
                },
                {
                    id: 'orbital_emitter',
                    name: 'Gravitacinis Emiteris',
                    icon: '🌌',
                    cost: { gold: 6500, wood: 0, stone: 0 },
                    sellGold: 3900,
                    damage: 3800,
                    range: 760,
                    attackSpeed: 2.2,
                    projectile: 'plasma',
                    projectileSpeed: 1100,
                    splash: 90,
                    desc: 'Kelia galingus gravitacinius plazmos sprogimus visame taikinio plote.'
                }
            ],
            units: [
                {
                    id: 'laser_cyborg',
                    name: 'Kiborgas Karys',
                    icon: '🤖',
                    type: 'melee_mid',
                    costGold: 900,
                    hp: 2700,
                    damage: 640,
                    range: 160,
                    speed: 90,
                    attackSpeed: 0.65,
                    projectile: 'laser_beam',
                    projectileSpeed: 1200,
                    trainTime: 2.5,
                    bountyGold: 780,
                    bountyXp: 1800,
                    desc: 'Patobulintas kiborgas su lazeriniais ašmenimis.'
                },
                {
                    id: 'jetpack_marine',
                    name: 'Skraidantis Karys',
                    icon: '🪂',
                    type: 'ranged',
                    costGold: 1600,
                    hp: 1900,
                    damage: 1050,
                    range: 380,
                    speed: 105,
                    attackSpeed: 1.0,
                    projectile: 'plasma',
                    projectileSpeed: 1000,
                    trainTime: 3.2,
                    bountyGold: 1350,
                    bountyXp: 3000,
                    desc: 'Sklando virš lauko ir šaudo plazma.'
                },
                {
                    id: 'titan_mech',
                    name: 'Kovinis Mechas',
                    icon: '🦾',
                    type: 'heavy',
                    costGold: 4500,
                    hp: 9500,
                    damage: 2600,
                    range: 320,
                    speed: 65,
                    attackSpeed: 1.3,
                    projectile: 'plasma_bomb',
                    projectileSpeed: 1100,
                    splash: 90,
                    trainTime: 6.0,
                    bountyGold: 3800,
                    bountyXp: 8000,
                    desc: 'Titaniškas kovinis robotas su fotoninėmis patrankomis.'
                }
            ]
        }
    ],

    // ========================================================================
    // AI ASMENYBĖS (PERSONALITY PROFILES)
    // ========================================================================
    AI_PERSONALITIES: {
        aggressive: {
            id: 'aggressive',
            name: '⚡ Agresyvus (Rush)',
            desc: 'Nuolatinis puolimas, didesnis karių greitis, skubus spaudimas',
            attackDelay: 1.5,
            spawnIntervalMult: 0.75,
            goldMultiplier: 1.2,
            heavyBias: 0.25,
            rangedBias: 0.35,
            meleeBias: 0.50,
            saveForEvolveRatio: 0.4,
            buildTurretProb: 0.35
        },
        economist: {
            id: 'economist',
            name: '💎 Ekonomistas (Boom)',
            desc: 'Fokusas į gavybą, centrinę kasyklą ir greitą evoliuciją',
            attackDelay: 5.0,
            spawnIntervalMult: 1.15,
            goldMultiplier: 1.1,
            heavyBias: 0.45,
            rangedBias: 0.35,
            meleeBias: 0.20,
            saveForEvolveRatio: 0.85,
            buildTurretProb: 0.50
        },
        defensive: {
            id: 'defensive',
            name: '🛡️ Gynybinis (Turtle)',
            desc: 'Maksimaliai stato bokštus, kaupia armiją ir daro masinę kontrataką',
            attackDelay: 4.5,
            spawnIntervalMult: 0.95,
            goldMultiplier: 1.0,
            heavyBias: 0.40,
            rangedBias: 0.45,
            meleeBias: 0.15,
            saveForEvolveRatio: 0.6,
            buildTurretProb: 0.95
        }
    },

    // ========================================================================
    // IŠŠŪKIŲ MISIJOS (5 SCENARIJAI)
    // ========================================================================
    CHALLENGES: [
        {
            id: 'archer_rain',
            name: '🏹 Lankininkų Lietus',
            title: 'Lankininkų Lietus',
            icon: '🏹',
            difficulty: 'Normalus',
            desc: 'Prieinami tik distanciniai kariai ir bokštai! Šaudymo sparta padvigubinta.',
            allowedUnitTypes: ['ranged'],
            attackSpeedBuff: 0.5,
            playerGold: 300,
            enemyGold: 250,
            initialEra: 1,
            maxEra: 2
        },
        {
            id: 'iron_fortress',
            name: '🏰 Geležinė Tvirtovė',
            title: 'Geležinė Tvirtovė',
            icon: '🏰',
            difficulty: 'Sunkus',
            desc: 'Karių šaukimas uždraustas! Gynybai turite tik 4 bokštus ir darbininkus. Atlaikykite 3 min.',
            allowedUnitTypes: [],
            disableUnits: true,
            freeTurretSlots: 4,
            surviveTime: 180,
            playerGold: 500,
            enemyGold: 350,
            initialEra: 0,
            maxEra: 3
        },
        {
            id: 'fast_evolve',
            name: '⚡ Evoliucionavimo Karštinė',
            title: 'Evoliucionavimo Karštinė',
            icon: '⚡',
            difficulty: 'Sunkus',
            desc: 'Pasiekite Ateities amžių (5 epocha) per mažiau nei 4 minutes!',
            timeLimit: 240,
            targetEra: 4,
            playerGold: 400,
            enemyGold: 200,
            initialEra: 0
        },
        {
            id: 'gold_rush',
            name: '💰 Aukso Trūkumas',
            title: 'Aukso Trūkumas',
            icon: '💰',
            difficulty: 'Ekstremalus',
            desc: 'Pradedate su 0 aukso! Vienintelis būdas užsidirbti – kasti centrinį luitą ir prekiauti.',
            playerGold: 0,
            playerResources: { wood: 30, stone: 20, food: 30, idlePop: 4, maxPop: 7 },
            enemyGold: 100,
            initialEra: 0
        },
        {
            id: 'titan_clash',
            name: '🦣 Titanų Kova',
            title: 'Titanų Kova',
            icon: '🦣',
            difficulty: 'Ekstremalus',
            desc: 'Tik sunkioji technika ir dinozaurai! Silpni pėstininkai neprieinami.',
            allowedUnitTypes: ['heavy'],
            playerGold: 1500,
            enemyGold: 1500,
            initialEra: 0,
            maxEra: 4
        }
    ],

    // ========================================================================
    // MONSTRŲ INVAZIJOS REŽIMAS: 6 UNIKALŪS MONSTRAI
    // ========================================================================
    // ========================================================================
    // MONSTRŲ INVAZIJOS REŽIMAS: 13 DIVERSIFIKUOTŲ IR EVOLIUCIONAVUSIŲ MONSTRŲ
    // ========================================================================
    MONSTERS: {
        goblin_scout: {
            id: 'goblin_scout',
            name: 'Goblinas Šnipas',
            icon: '👺',
            hp: 95,
            damage: 16,
            attackSpeed: 0.8,
            range: 35,
            speed: 105,
            width: 26,
            height: 32,
            bountyGold: 22,
            bountyXp: 35,
            type: 'melee'
        },
        acid_spitter: {
            id: 'acid_spitter',
            name: 'Rūgšties Spjaudytojas',
            icon: '🦎',
            hp: 160,
            damage: 26,
            attackSpeed: 1.2,
            range: 270,
            speed: 68,
            width: 32,
            height: 35,
            bountyGold: 36,
            bountyXp: 55,
            type: 'ranged',
            projectile: { type: 'acid', speed: 300, color: '#10b981' }
        },
        ogre_brute: {
            id: 'ogre_brute',
            name: 'Ogro Galiūnas',
            icon: '👹',
            hp: 550,
            damage: 52,
            attackSpeed: 1.6,
            range: 48,
            speed: 48,
            width: 44,
            height: 60,
            bountyGold: 75,
            bountyXp: 120,
            type: 'melee'
        },
        shadow_gargoyle: {
            id: 'shadow_gargoyle',
            name: 'Tamsos Gargoylas',
            icon: '🦇',
            hp: 280,
            damage: 38,
            attackSpeed: 1.0,
            range: 42,
            speed: 94,
            isFlying: true,
            width: 36,
            height: 42,
            bountyGold: 55,
            bountyXp: 85,
            type: 'melee'
        },
        lava_golem: {
            id: 'lava_golem',
            name: 'Lavos Golemas',
            icon: '🌋',
            hp: 1100,
            damage: 80,
            attackSpeed: 1.8,
            range: 52,
            speed: 40,
            width: 52,
            height: 68,
            bountyGold: 140,
            bountyXp: 210,
            type: 'melee'
        },
        plasma_hydra: {
            id: 'plasma_hydra',
            name: 'Plazminė Hidra',
            icon: '🐍',
            hp: 850,
            damage: 55,
            attackSpeed: 1.1,
            range: 320,
            speed: 58,
            width: 48,
            height: 58,
            bountyGold: 160,
            bountyXp: 240,
            type: 'ranged',
            projectile: { type: 'plasma', speed: 340, color: '#06b6d4' }
        },
        undead_necromancer: {
            id: 'undead_necromancer',
            name: 'Tamsos Nekromantas',
            icon: '🧙‍♂️',
            hp: 620,
            damage: 65,
            attackSpeed: 1.3,
            range: 350,
            speed: 55,
            width: 34,
            height: 52,
            bountyGold: 180,
            bountyXp: 270,
            type: 'ranged',
            projectile: { type: 'shadow_skull', speed: 320, color: '#a855f7' }
        },
        cyber_mutant: {
            id: 'cyber_mutant',
            name: 'Kiber-Mutantas Šaulys',
            icon: '👾',
            hp: 1600,
            damage: 115,
            attackSpeed: 1.4,
            range: 360,
            speed: 62,
            width: 50,
            height: 66,
            bountyGold: 260,
            bountyXp: 400,
            type: 'ranged',
            projectile: { type: 'rocket', speed: 360, color: '#ef4444' }
        },
        void_colossus: {
            id: 'void_colossus',
            name: 'Bedugnės Kolosas',
            icon: '🗿',
            hp: 3400,
            damage: 160,
            attackSpeed: 1.9,
            range: 58,
            speed: 36,
            width: 65,
            height: 85,
            bountyGold: 380,
            bountyXp: 600,
            type: 'melee'
        },
        frost_wyrm: {
            id: 'frost_wyrm',
            name: 'Ledo Slibinas',
            icon: '❄️',
            hp: 2400,
            damage: 130,
            attackSpeed: 1.2,
            range: 340,
            speed: 80,
            isFlying: true,
            width: 60,
            height: 70,
            bountyGold: 340,
            bountyXp: 520,
            type: 'ranged',
            projectile: { type: 'frost_beam', speed: 380, color: '#38bdf8' }
        },
        dragon_boss: {
            id: 'dragon_boss',
            name: 'Ugnies Drakonas [BOSAS]',
            icon: '🐉',
            isBoss: true,
            hp: 5500,
            damage: 190,
            attackSpeed: 1.4,
            range: 320,
            speed: 52,
            width: 80,
            height: 95,
            bountyGold: 700,
            bountyXp: 1100,
            type: 'ranged',
            projectile: { type: 'fireball', speed: 350, color: '#f97316' }
        },
        mecha_titan_boss: {
            id: 'mecha_titan_boss',
            name: 'Kiber-Titanas [MEGA BOSAS]',
            icon: '🤖',
            isBoss: true,
            hp: 11000,
            damage: 280,
            attackSpeed: 1.3,
            range: 380,
            speed: 42,
            width: 90,
            height: 108,
            bountyGold: 1400,
            bountyXp: 2200,
            type: 'ranged',
            projectile: { type: 'laser_bolt', speed: 420, color: '#ec4899' }
        },
        abyssal_overlord: {
            id: 'abyssal_overlord',
            name: 'Tamsos Valdovas [GALUTINIS BOSAS]',
            icon: '👑',
            isBoss: true,
            hp: 22000,
            damage: 420,
            attackSpeed: 1.1,
            range: 420,
            speed: 46,
            width: 100,
            height: 120,
            bountyGold: 3000,
            bountyXp: 5000,
            type: 'ranged',
            projectile: { type: 'void_orb', speed: 400, color: '#9333ea' }
        },
        ancient_colossus_titan: {
            id: 'ancient_colossus_titan',
            name: 'Griaunantis Milžinas Titanas [GIGANTAS]',
            icon: '👹',
            isBoss: true,
            isGiant: true,
            hp: 26000,
            damage: 460,
            attackSpeed: 2.0,
            range: 65,
            speed: 26,
            width: 110,
            height: 130,
            bountyGold: 2500,
            bountyXp: 4500,
            type: 'melee',
            splash: 80,
            desc: 'Gigantiškas žemę drebinantis titanas. Triuškina visą priešakinę liniją vienu smūgiu.'
        }
    },

    // ========================================================================
    // 24+ ATRAKINAMI PASIEKIMAI (ACHIEVEMENTS)
    // ========================================================================
    ACHIEVEMENTS: [
        { id: 'first_blood', title: 'Pirmasis Kraujas', icon: '⚔️', desc: 'Nukaukite 1-ą priešo karį.', max: 1 },
        { id: 'slayer_25', title: 'Mūšio Legionierius', icon: '💀', desc: 'Nukaukite 25 priešų karius per vieną mūšį.', max: 25 },
        { id: 'slayer_100', title: 'Armijų Naikintojas', icon: '👑', desc: 'Nukaukite 100 priešų karių per vieną mūšį.', max: 100 },
        { id: 'first_evolve', title: 'Nauja Epocha', icon: '🧬', desc: 'Evoliucionuokite į Viduramžių amžių.', max: 1 },
        { id: 'future_ascension', title: 'Kibernetinis Rytojus', icon: '🤖', desc: 'Pasiekite Ateities amžių (5 epocha).', max: 1 },
        { id: 'meteor_strike', title: 'Dievų Rūstybė', icon: '☄️', desc: 'Panaudokite meteoritų arba kitą Ultimate gebėjimą.', max: 1 },
        { id: 'ult_master', title: 'Griausmavaldys', icon: '⚡', desc: 'Panaudokite Ultimate gebėjimus 5 kartus per žaidimą.', max: 5 },
        { id: 'turret_master', title: 'Geležinis Bastionas', icon: '🛡️', desc: 'Pastatykite visus 4 gynybinius bokštelius.', max: 4 },
        { id: 'gold_miner', title: 'Centrinis Karalius', icon: '💎', desc: 'Sėkmingai iškaskite centrinę aukso kasyklą 5 kartus.', max: 5 },
        { id: 'merchant_king', title: 'Prekybos Magnatas', icon: '🏛️', desc: 'Prekyvietėje uždirbkite bent 500 aukso iš pardavimų.', max: 500 },
        { id: 'pop_boom', title: 'Miesto Plėtra', icon: '👥', desc: 'Išplėskite maksimalią populiaciją iki bent 14 gyventojų.', max: 14 },
        { id: 'clutch_victory', title: 'Paskutinė Sekundė', icon: '❤️', desc: 'Laimėkite mūšį, kai jūsų bazės gyvybės buvo žemiau 15%.', max: 1 },
        { id: 'speed_demon', title: 'Žaibiškas Triumfas', icon: '⏱️', desc: 'Sunaikinkite priešo bazę per mažiau nei 5 minutes.', max: 1 },
        { id: 'endless_wave_5', title: 'Išlikimo Naujokas', icon: '🌊', desc: 'Išlikimo režime atlaikykite 5 bangas.', max: 5 },
        { id: 'endless_wave_15', title: 'Išlikimo Legenda', icon: '🌪️', desc: 'Išlikimo režime atlaikykite 15 bangų.', max: 15 },
        { id: 'monster_wave_5', title: 'Monstrų Tramdytojas', icon: '👾', desc: 'Atlaikykite 5 monstrų invazijos bangas.', max: 5 },
        { id: 'monster_boss_kill', title: 'Drakonų Skerdikas', icon: '🐉', desc: 'Nukaukite milžinišką Monstrų Vadą / Drakoną.', max: 1 },
        { id: 'challenge_first', title: 'Iššūkio Užkariautojas', icon: '🎯', desc: 'Sėkmingai įvykdykite bent 1 iššūkio misiją.', max: 1 },
        { id: 'challenge_all', title: 'Iššūkių Didmeistris', icon: '🌟', desc: 'Sėkmingai įvykdykite visas 5 iššūkių misijas.', max: 5 },
        { id: 'dino_fury', title: 'Juros Periodas', icon: '🦖', desc: 'Išleiskite į mūšį 5 dinozaurų raitelius per vieną žaidimą.', max: 5 },
        { id: 'tank_rush', title: 'Plieno Lavina', icon: '🚜', desc: 'Išleiskite į mūšį 5 tankus per vieną žaidimą.', max: 5 },
        { id: 'titan_mech_spawn', title: 'Titano Žingsniai', icon: '🦾', desc: 'Pasamdykite milžinišką Kovinį Mechą.', max: 1 },
        { id: 'rich_hoarder', title: 'Aukso Skrynia', icon: '💰', desc: 'Vienu metu sukaupkite 3000 aukso.', max: 3000 },
        { id: 'flawless_defense', title: 'Nepajudinamas', icon: '🏰', desc: 'Laimėkite mūšį nepraradę nė 10% bazės gyvybių.', max: 1 },
        { id: 'hero_summon', title: 'Didvyrio Gimimas', icon: '👑', desc: 'Išsikvieskite epochos didvyrį į mūšio lauką.', max: 1 }
    ],

    // ========================================================================
    // 5 EPOCHŲ DIDVYRIAI (SUBALANSUOTI MŪŠIO VADAI - 2x HP & DIDELĖ TAKTINĖ VERTĖ)
    // ========================================================================
    HEROES: {
        0: {
            id: 'shaman_hero',
            name: 'Pirmykštis Šamanas',
            title: '👑 Didvyris Šamanas',
            costGold: 220,
            costFood: 30,
            hp: 850,
            damage: 50,
            attackSpeed: 1.2,
            range: 65,
            speed: 46,
            width: 42,
            height: 52,
            aura: 'heal',
            auraRadius: 200,
            auraValue: 22,
            auraTitle: '🌿 Gydymo Dvasia (+22 HP/s)',
            activeSkill: {
                id: 'ancestral_heal',
                name: 'Protėvių Šviesa',
                icon: '🌿',
                cooldown: 12.0,
                radius: 240,
                healAmount: 260,
                knockback: 60,
                desc: 'Momentinis +260 HP gydymas aplinkiniams ir priešų atstūmimas!'
            },
            type: 'melee',
            trainTime: 4.0
        },
        1: {
            id: 'paladin_hero',
            name: 'Didysis Paladinas',
            title: '👑 Šventasis Paladinas',
            costGold: 450,
            costFood: 50,
            hp: 1800,
            damage: 110,
            attackSpeed: 1.1,
            range: 52,
            speed: 48,
            width: 46,
            height: 56,
            aura: 'shield',
            auraRadius: 220,
            auraValue: 0.35,
            auraTitle: '🛡️ Šventasis Skydas (+35% Gynyba)',
            activeSkill: {
                id: 'holy_smite',
                name: 'Šventasis Kirtis',
                icon: '⚔️',
                cooldown: 14.0,
                radius: 140,
                damage: 380,
                shieldDuration: 4.0,
                desc: 'Galingas šventos šviesos kirtis (380 žala) + 4s nepažeidžiamumo skydas!'
            },
            type: 'melee',
            trainTime: 5.0
        },
        'kensei_hero': {
            id: 'kensei_hero',
            name: 'Šešėlių Kensėjus',
            title: '👑 Šešėlių Kensėjus',
            costGold: 450,
            costFood: 50,
            hp: 1600,
            damage: 140,
            attackSpeed: 1.35,
            range: 54,
            speed: 56,
            width: 44,
            height: 54,
            aura: 'wind_blade',
            auraRadius: 220,
            auraValue: 0.30,
            auraTitle: '⚔️ Vėjo Kirtis (+30% Greitis & Kritai)',
            activeSkill: {
                id: 'shadow_dash',
                name: 'Šešėlių Pjūvis',
                icon: '🌪️',
                cooldown: 12.0,
                dashDist: 200,
                damage: 360,
                bleedDuration: 4.0,
                desc: 'Žaibiškas teleport šuolis per priešus, padarantis 360 žalą visiems kelyje!'
            },
            type: 'melee',
            trainTime: 5.0
        },
        2: {
            id: 'general_hero',
            name: 'Mūšio Generolas',
            title: '👑 Vyriausiasis Generolas',
            costGold: 950,
            costFood: 75,
            hp: 3000,
            damage: 220,
            attackSpeed: 1.3,
            range: 180,
            speed: 50,
            width: 48,
            height: 58,
            aura: 'volley',
            auraRadius: 240,
            auraValue: 0.25,
            auraTitle: '⚔️ Salvės Įsakymas (+25% Greitis & Kritai)',
            activeSkill: {
                id: 'cannon_barrage',
                name: 'Artilerijos Salva',
                icon: '💣',
                cooldown: 14.0,
                count: 4,
                damage: 340,
                splash: 65,
                desc: '4 galingų bombų salva į priešų gretas!'
            },
            type: 'ranged',
            projectile: { type: 'musket_ball', speed: 650, color: '#fcd34d' },
            trainTime: 6.0
        },
        'alchemist_hero': {
            id: 'alchemist_hero',
            name: 'Didysis Alchemikas',
            title: '👑 Didysis Alchemikas',
            costGold: 950,
            costFood: 75,
            hp: 2700,
            damage: 190,
            attackSpeed: 1.25,
            range: 165,
            speed: 48,
            width: 46,
            height: 56,
            aura: 'elixir',
            auraRadius: 240,
            auraValue: 28,
            auraTitle: '🧪 Gyvybės Eliksyras (+28 HP/s & Nuodai)',
            activeSkill: {
                id: 'acid_cauldron',
                name: 'Nuodų Katilas',
                icon: '🧪',
                cooldown: 13.0,
                radius: 170,
                dps: 90,
                duration: 5.0,
                desc: 'Numeta korozinės rūgšties katilą, deginantį priešus 5s!'
            },
            type: 'ranged',
            projectile: { type: 'potion_bottle', speed: 520, color: '#10b981' },
            trainTime: 6.0
        },
        3: {
            id: 'commando_hero',
            name: 'Elitinis Komandosas',
            title: '👑 Elitinis Komandosas',
            costGold: 2200,
            costFood: 100,
            hp: 6000,
            damage: 480,
            attackSpeed: 1.4,
            range: 195,
            speed: 52,
            width: 50,
            height: 60,
            aura: 'smoke',
            auraRadius: 260,
            auraValue: 0.40,
            auraTitle: '💨 Taktiniai Dūmai (-40% Priešo Žala)',
            activeSkill: {
                id: 'missile_barrage',
                name: 'Raketų Kasetė',
                icon: '🚀',
                cooldown: 14.0,
                count: 5,
                damage: 450,
                splash: 55,
                desc: '5 savaime nutaikomų mikro-raketų salvė!'
            },
            type: 'ranged',
            projectile: { type: 'rocket', speed: 600, color: '#fbbf24', splash: 45 },
            trainTime: 7.0
        },
        'drone_hero': {
            id: 'drone_hero',
            name: 'Dronų Eskadronas',
            title: '👑 Dronų Eskadronas',
            costGold: 2200,
            costFood: 100,
            hp: 5400,
            damage: 420,
            attackSpeed: 1.6,
            range: 220,
            speed: 56,
            width: 48,
            height: 58,
            aura: 'laser_target',
            auraRadius: 270,
            auraValue: 0.35,
            auraTitle: '🎯 Lazerinis Taikiklis (+35% Žala & Nuotolis)',
            activeSkill: {
                id: 'emp_blast',
                name: 'EMP Sprogimas',
                icon: '⚡',
                cooldown: 13.0,
                radius: 240,
                stunDuration: 3.5,
                damage: 320,
                desc: 'EMP impulsas, paralyžiuojantis ir nutildantis priešus 3.5s!'
            },
            type: 'ranged',
            projectile: { type: 'plasma', speed: 750, color: '#a855f7' },
            trainTime: 7.0
        },
        4: {
            id: 'mecha_hero',
            name: 'Kiber-Titanas Mechas',
            title: '👑 Kiber-Titanas Mechas',
            costGold: 5500,
            costFood: 150,
            hp: 12500,
            damage: 950,
            attackSpeed: 1.5,
            range: 230,
            speed: 46,
            width: 64,
            height: 76,
            aura: 'plasma_barrier',
            auraRadius: 300,
            auraValue: 0.45,
            auraTitle: '⚡ Plazminis Jėgos Laukas (+45% Skydas & Lazeriai)',
            activeSkill: {
                id: 'ion_hyperbeam',
                name: 'Jonų Spindulys',
                icon: '⚡',
                cooldown: 15.0,
                damage: 1100,
                beamLength: 520,
                desc: 'Gigantiškas kiaurai skrodžiantis plazminis spindulys (1100 žala)!'
            },
            type: 'ranged',
            projectile: { type: 'laser_bolt', speed: 900, color: '#00ffff' },
            trainTime: 8.0
        },
        'bio_swarm_hero': {
            id: 'bio_swarm_hero',
            name: 'Bio-Mutantų Motinėlė',
            title: '👑 Bio-Mutantų Motinėlė',
            costGold: 5500,
            costFood: 150,
            hp: 14000,
            damage: 850,
            attackSpeed: 1.45,
            range: 190,
            speed: 52,
            width: 68,
            height: 78,
            aura: 'acid_spores',
            auraRadius: 300,
            auraValue: 0.45,
            auraTitle: '🧬 Rūgštinės Sporos (+45% Kraujavimas & Greitis)',
            activeSkill: {
                id: 'swarm_frenzy',
                name: 'Spiečiaus Įniršis',
                icon: '🧬',
                cooldown: 14.0,
                broodlings: 3,
                hasteDuration: 6.0,
                hasteBonus: 0.50,
                desc: 'Iššaukia 3 rūgštinius parazitus ir suteikia sąjungininkams +50% puolimo greitį!'
            },
            type: 'melee',
            trainTime: 8.0
        }
    },

    // ========================================================================
    // ŠAKOTOJI EVOLIUCIJA (CIVILIZATION BRANCHES SU VIZUALINE PERŽIŪRA)
    // ========================================================================
    BRANCHES: {
        1: [
            {
                id: 'chivalry',
                name: 'Europos Riterystė',
                icon: '🏰',
                subtitle: 'Geležinė Gynyba',
                bannerGrad: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
                themeColor: '#38bdf8',
                castleTitle: '🏰 Akmeninis Donžonas',
                bonus: { hpMod: 1.25, armorMod: 0.15 },
                badges: ['🛡️ +25% HP', '🛡️ +15% Šarvai', '👑 Paladinas'],
                units: [
                    { icon: '🗡️', name: 'Kalavijas' },
                    { icon: '🏹', name: 'Lankas' },
                    { icon: '🐎', name: 'Riteris' }
                ],
                hero: { name: 'Didysis Paladinas', icon: '👑', aura: '🛡️ Šventasis Skydas (+35% Gynyba)' },
                heroId: 'paladin_hero'
            },
            {
                id: 'dynasty',
                name: 'Rytų Dinastija',
                icon: '🏯',
                subtitle: 'Ugnies Strėlės & Katanos',
                bannerGrad: 'linear-gradient(135deg, #991b1b 0%, #0f172a 100%)',
                themeColor: '#ef4444',
                castleTitle: '🏯 Raudonmedžio Pagoda',
                bonus: { speedMod: 1.20, dmgMod: 1.20 },
                badges: ['⚡ +20% Greitis', '⚔️ +20% Žala', '👑 Kensėjus'],
                units: [
                    { icon: '🗡️', name: 'Samurajus' },
                    { icon: '🔥', name: 'Ugnies lankas' },
                    { icon: '🐎', name: 'Raitelis' }
                ],
                hero: { name: 'Šešėlių Kensėjus', icon: '👑', aura: '⚔️ Vėjo Kirtis (+30% Greitis & Kritai)' },
                heroId: 'kensei_hero'
            }
        ],
        2: [
            {
                id: 'fleet',
                name: 'Imperijos Laivynas',
                icon: '⚓',
                subtitle: 'Parako Galia & Artilerija',
                bannerGrad: 'linear-gradient(135deg, #0369a1 0%, #0f172a 100%)',
                themeColor: '#0ea5e9',
                castleTitle: '⚓ Pajūrio Bastionas',
                bonus: { rangeMod: 1.30, splashMod: 20 },
                badges: ['🏹 +30% Nuotolis', '💣 +20 Sprogimas', '👑 Generolas'],
                units: [
                    { icon: '🤺', name: 'Dvikova' },
                    { icon: '💂', name: 'Muškieta' },
                    { icon: '💣', name: 'Patranka' }
                ],
                hero: { name: 'Mūšio Generolas', icon: '👑', aura: '⚔️ Salvės Įsakymas (+25% Greitis & Kritai)' },
                heroId: 'general_hero'
            },
            {
                id: 'alchemy',
                name: 'Alchemijos Gildija',
                icon: '⚙️',
                subtitle: 'Nuodai & Gydymas',
                bannerGrad: 'linear-gradient(135deg, #065f46 0%, #0f172a 100%)',
                themeColor: '#10b981',
                castleTitle: '⚙️ Alchemijos Tvirtovė',
                bonus: { healMod: 1.35, poisonDmg: 25 },
                badges: ['🧪 +20 HP/s Gydymas', '☠️ Nuodai', '👑 Alchemikas'],
                units: [
                    { icon: '🧪', name: 'Alchemikas' },
                    { icon: '🏹', name: 'Nuodų šaulys' },
                    { icon: '🔥', name: 'Katilas' }
                ],
                hero: { name: 'Didysis Alchemikas', icon: '👑', aura: '🧪 Gyvybės Eliksyras (+24 HP/s & Nuodai)' },
                heroId: 'alchemist_hero'
            }
        ],
        3: [
            {
                id: 'mechanized',
                name: 'Karo Pramonė',
                icon: '🪖',
                subtitle: 'Sunkieji Tankai',
                bannerGrad: 'linear-gradient(135deg, #854d0e 0%, #0f172a 100%)',
                themeColor: '#eab308',
                castleTitle: '🪖 Gelžbetonio Bunkeris',
                bonus: { hpMod: 1.30, turretDmgMod: 1.25 },
                badges: ['🛡️ +30% HP', '💥 +25% Bokštai', '👑 Komandosas'],
                units: [
                    { icon: '🪖', name: 'Šturmas' },
                    { icon: '🚀', name: 'Raketos' },
                    { icon: '🚜', name: 'Tankas' }
                ],
                hero: { name: 'Elitinis Komandosas', icon: '👑', aura: '💨 Taktiniai Dūmai (-40% Priešo Žala)' },
                heroId: 'commando_hero'
            },
            {
                id: 'spec_ops',
                name: 'Specialiosios Pajėgos',
                icon: '⚡',
                subtitle: 'Dronai & Snaiperiai',
                bannerGrad: 'linear-gradient(135deg, #581c87 0%, #0f172a 100%)',
                themeColor: '#c084fc',
                castleTitle: '⚡ Slaptoji Būstinė',
                bonus: { critMod: 0.35, speedMod: 1.20 },
                badges: ['🎯 +35% Kritai', '⚡ +20% Greitis', '👑 Dronai'],
                units: [
                    { icon: '🥷', name: 'Agentas' },
                    { icon: '🎯', name: 'Snaiperis' },
                    { icon: '🛸', name: 'Dronas' }
                ],
                hero: { name: 'Dronų Eskadronas', icon: '👑', aura: '🎯 Lazerinis Taikiklis (+35% Žala & Nuotolis)' },
                heroId: 'drone_hero'
            }
        ],
        4: [
            {
                id: 'cyber_mecha',
                name: 'Kiber-Titanai',
                icon: '🤖',
                subtitle: 'Skydai & Lazeriai',
                bannerGrad: 'linear-gradient(135deg, #0e7490 0%, #0f172a 100%)',
                themeColor: '#00ffff',
                castleTitle: '🤖 Kiber-Citadelė',
                bonus: { shieldMod: 0.40, laserDmgMod: 1.30 },
                badges: ['🛡️ +40% Skydai', '⚡ +30% Lazeriai', '👑 Mechas'],
                units: [
                    { icon: '🦾', name: 'Kiborgas' },
                    { icon: '⚡', name: 'Plazma' },
                    { icon: '🤖', name: 'Mechas' }
                ],
                hero: { name: 'Kiber-Titanas Mechas', icon: '👑', aura: '⚡ Plazminis Jėgos Laukas (+45% Skydas)' },
                heroId: 'mecha_hero'
            },
            {
                id: 'bio_swarm',
                name: 'Bio-Mutantai',
                icon: '🧬',
                subtitle: 'Spiečius & Monstrai',
                bannerGrad: 'linear-gradient(135deg, #3f6212 0%, #0f172a 100%)',
                themeColor: '#84cc16',
                castleTitle: '🧬 Mutacijų Avilys',
                bonus: { regenMod: 35, acidDmg: 40 },
                badges: ['🧬 +35 HP/s Gydymas', '☣️ Rūgštis', '👑 Bio-Motė'],
                units: [
                    { icon: '👾', name: 'Mutantas' },
                    { icon: '☣️', name: 'Rūgštis' },
                    { icon: '🦖', name: 'Behemotas' }
                ],
                hero: { name: 'Mutacijų Motė', icon: '👑', aura: '🧬 Biologinė Regeneracija (+35 HP/s)' },
                heroId: 'bio_queen_hero'
            }
        ]
    },

    // ========================================================================
    // EVOLIUCINĖS RELIKVIJOS / PERKAI (ROGUELIKE DRAFTING - ULTRA PUNCHY)
    // ========================================================================
    EVOLUTION_PERKS: [
        {
            id: 'gold_rush',
            name: 'Aukso Karštinė',
            icon: '💎',
            desc: '+40% Auksas & +20% Kasėjų greitis',
            tag: 'Ekonomika'
        },
        {
            id: 'fertile_harvest',
            name: 'Derlingumas',
            icon: '🌾',
            desc: '+35% Gimimas, -33% Maisto kaina',
            tag: 'Gyventojai'
        },
        {
            id: 'iron_will',
            name: 'Geležinė Valia',
            icon: '🛡️',
            desc: '+25% Visų karių HP',
            tag: 'Gynyba'
        },
        {
            id: 'auto_conveyor',
            name: 'Konvejeris',
            icon: '⚡',
            desc: '-35% Karių gamybos trukmė',
            tag: 'Karyba'
        },
        {
            id: 'sniper_eye',
            name: 'Snaiperio Akis',
            icon: '🏹',
            desc: '+35% Šaulių & bokštelių nuotolis',
            tag: 'Karyba'
        },
        {
            id: 'critical_fury',
            name: 'Kritinis Įniršis',
            icon: '💥',
            desc: '25% šansas suduoti 2.5x kritinį smūgį',
            tag: 'Žala'
        },
        {
            id: 'vampirism',
            name: 'Vampyrizmas',
            icon: '🩸',
            desc: '+20% žalos virsta gyvybėmis',
            tag: 'Išgyvenimas'
        },
        {
            id: 'granite_fort',
            name: 'Granito Fortas',
            icon: '🏰',
            desc: '+500 Bazės HP & +25% Bokštų greitis',
            tag: 'Tvirtovė'
        }
    ],

    // ========================================================================
    // TAKTINĖS BŪSENOS (TACTICAL STANCES)
    // ========================================================================
    TACTICAL_STANCES: {
        attack: {
            id: 'attack',
            name: 'Šturmas',
            icon: '⚔️',
            desc: 'Kariai veržiasi į priekį (+15% judėjimo greitis)',
            speedMod: 1.15,
            armorMod: 0,
            healRate: 0
        },
        defend: {
            id: 'defend',
            name: 'Gynyba',
            icon: '🛡️',
            desc: 'Kariai laikosi rikiuotėje (+35% gynyba, laukia priešo)',
            speedMod: 0.65,
            armorMod: 0.35,
            healRate: 0
        },
        retreat: {
            id: 'retreat',
            name: 'Atsitraukimas',
            icon: '🏃',
            desc: 'Kariai atsitraukia link tvirtovės ir pamažu regeneruoja HP',
            speedMod: -0.85,
            armorMod: 0.15,
            healRate: 12
        }
    },

    // ========================================================================
    // 4 PAGRINDINĖS TOBULINIMŲ KRYPTYS (PO 5 LYGIUS)
    // ========================================================================
    UPGRADES: {
        base_wall: {
            id: 'base_wall',
            name: 'Tvirtovė & Siena',
            icon: '🏠',
            levels: [
                {
                    level: 1,
                    name: 'Trobelės & Pamatai',
                    cost: { gold: 60, wood: 45, stone: 0, food: 0 },
                    popBoost: 3,
                    baseHpBoost: 200,
                    hpRegen: 0,
                    turretRangeBoost: 0,
                    turretDmgBoost: 0,
                    hasWall: false,
                    desc: '+3 Max Pop, +200 Bazės HP'
                },
                {
                    level: 2,
                    name: 'Gyvenvietės Palapinės',
                    cost: { gold: 160, wood: 100, stone: 50, food: 40 },
                    popBoost: 5,
                    baseHpBoost: 350,
                    hpRegen: 2,
                    turretRangeBoost: 0,
                    turretDmgBoost: 0,
                    hasWall: false,
                    desc: '+5 Max Pop, +350 Bazės HP, +2 HP/s Gijimas'
                },
                {
                    level: 3,
                    name: 'Sargybos Postas',
                    cost: { gold: 380, wood: 180, stone: 150, food: 0 },
                    popBoost: 6,
                    baseHpBoost: 500,
                    hpRegen: 3,
                    turretRangeBoost: 0.10,
                    turretDmgBoost: 0,
                    hasWall: false,
                    desc: '+6 Max Pop, +500 Bazės HP, +10% Bokštų Nuotolis'
                },
                {
                    level: 4,
                    name: 'Akmeninis Bastionas',
                    cost: { gold: 850, wood: 240, stone: 320, food: 0 },
                    popBoost: 8,
                    baseHpBoost: 800,
                    hpRegen: 4,
                    turretRangeBoost: 0.10,
                    turretDmgBoost: 0.15,
                    hasWall: false,
                    desc: '+8 Max Pop, +800 Bazės HP, +15% Bokštų Žala'
                },
                {
                    level: 5,
                    name: 'Išorinė Gynybinė Siena',
                    cost: { gold: 1800, wood: 500, stone: 650, food: 0 },
                    popBoost: 10,
                    baseHpBoost: 1200,
                    hpRegen: 6,
                    turretRangeBoost: 0.15,
                    turretDmgBoost: 0.20,
                    hasWall: true,
                    wallHp: 450,
                    desc: '🛡️ Griaunama Išorinė Siena (450–11000 HP pagal epochą), +10 Max Pop'
                }
            ]
        },
        workers_ai: {
            id: 'workers_ai',
            name: 'Darbininkai & AI',
            icon: '⛏️',
            levels: [
                {
                    level: 1,
                    name: 'Lengvi Krepšiai & Batai',
                    cost: { gold: 50, wood: 35, stone: 0, food: 25 },
                    speedBoost: 0.20,
                    capacity: 14,
                    gatherSpeedBoost: 0,
                    bonusHp: 0,
                    goldNuggetChance: 0,
                    smartAi: false,
                    desc: '+20% Greitis, 14 vnt. Talpa (+40%)'
                },
                {
                    level: 2,
                    name: 'Grūdinti Kirtikliai',
                    cost: { gold: 150, wood: 80, stone: 90, food: 0 },
                    speedBoost: 0.20,
                    capacity: 18,
                    gatherSpeedBoost: 0.35,
                    bonusHp: 0,
                    goldNuggetChance: 0.10,
                    smartAi: false,
                    desc: '+35% Kasybos Greitis, 18 vnt. Talpa (+80%), 10% Grynuoliai'
                },
                {
                    level: 3,
                    name: 'Apsauginė Šarvuotė',
                    cost: { gold: 360, wood: 0, stone: 180, food: 140 },
                    speedBoost: 0.45,
                    capacity: 22,
                    gatherSpeedBoost: 0.35,
                    bonusHp: 120,
                    goldNuggetChance: 0.10,
                    smartAi: false,
                    desc: '+120 HP, +45% Greitis, 22 vnt. Talpa (+120%)'
                },
                {
                    level: 4,
                    name: 'Inžineriniai Vežimėliai',
                    cost: { gold: 800, wood: 280, stone: 260, food: 0 },
                    speedBoost: 0.50,
                    capacity: 26,
                    gatherSpeedBoost: 0.50,
                    bonusHp: 150,
                    goldNuggetChance: 0.15,
                    smartAi: false,
                    desc: '26 vnt. Talpa (+160%), Kasyba Generuoja XP'
                },
                {
                    level: 5,
                    name: 'Išmanusis AI & Kasybos Valdymas',
                    cost: { gold: 1700, wood: 0, stone: 550, food: 450 },
                    speedBoost: 0.65,
                    capacity: 30,
                    gatherSpeedBoost: 0.65,
                    bonusHp: 200,
                    goldNuggetChance: 0.20,
                    smartAi: true,
                    desc: '🧠 30 vnt. Talpa (3x Kasyba), ⚙️ Kasybos Valdymo Pultas'
                }
            ]
        },
        military_academy: {
            id: 'military_academy',
            name: 'Karybos Akademija',
            icon: '⚔️',
            levels: [
                {
                    level: 1,
                    name: 'Grūdinti Ginklai',
                    cost: { gold: 60, wood: 40, stone: 40, food: 0 },
                    dmgBoost: 0.15,
                    hpBoost: 0.10,
                    speedBoost: 0,
                    spawnSpeedBoost: 0,
                    rangedResist: 0,
                    critChance: 0,
                    battleFrenzy: false,
                    desc: '+15% Karių Žala, +10% Karių HP'
                },
                {
                    level: 2,
                    name: 'Karinis Maršas & Darna',
                    cost: { gold: 170, wood: 60, stone: 0, food: 90 },
                    dmgBoost: 0.15,
                    hpBoost: 0.10,
                    speedBoost: 0.25,
                    spawnSpeedBoost: 0.20,
                    rangedResist: 0,
                    critChance: 0,
                    battleFrenzy: false,
                    desc: '+25% Karių Greitis į Frontą, +20% Gamyba'
                },
                {
                    level: 3,
                    name: 'Skydų Siena & Šarvai',
                    cost: { gold: 400, wood: 160, stone: 180, food: 120 },
                    dmgBoost: 0.20,
                    hpBoost: 0.25,
                    speedBoost: 0.25,
                    spawnSpeedBoost: 0.20,
                    rangedResist: 0.25,
                    critChance: 0,
                    battleFrenzy: false,
                    desc: '25% Atsparumas Strėlėms/Sviediniams, +25% HP'
                },
                {
                    level: 4,
                    name: 'Mirtini Kirčiai (Precision)',
                    cost: { gold: 900, wood: 260, stone: 300, food: 0 },
                    dmgBoost: 0.25,
                    hpBoost: 0.25,
                    speedBoost: 0.30,
                    spawnSpeedBoost: 0.25,
                    rangedResist: 0.25,
                    critChance: 0.20,
                    battleFrenzy: false,
                    desc: '+20% Kritiniai Smūgiai (2.2x Žala)'
                },
                {
                    level: 5,
                    name: 'Mūšio Įniršis & Didvyrio Aura',
                    cost: { gold: 1900, wood: 0, stone: 600, food: 500 },
                    dmgBoost: 0.35,
                    hpBoost: 0.35,
                    speedBoost: 0.35,
                    spawnSpeedBoost: 0.35,
                    rangedResist: 0.30,
                    critChance: 0.25,
                    battleFrenzy: true,
                    desc: '👑 Įniršis po Nužudymo (+35% Greitis & Gijimas), Aura'
                }
            ]
        },
        trade_economy: {
            id: 'trade_economy',
            name: 'Turgus & Rinka',
            icon: '💰',
            levels: [
                {
                    level: 1,
                    name: 'Turgavietės Kioskas',
                    cost: { gold: 50, wood: 50, stone: 0, food: 35 },
                    sellRateBoost: 0.25,
                    passiveGold: 0,
                    buyDiscount: 0,
                    tradeXp: false,
                    killBounty: 0,
                    desc: '+25% Daugiau Aukso Parduodant Resursus'
                },
                {
                    level: 2,
                    name: 'Pirklių Karavanas',
                    cost: { gold: 150, wood: 110, stone: 0, food: 80 },
                    sellRateBoost: 0.25,
                    passiveGold: 12,
                    buyDiscount: 0,
                    tradeXp: false,
                    killBounty: 0,
                    desc: 'Pasyvus Auksas: +12💰 kas 4s'
                },
                {
                    level: 3,
                    name: 'Didieji Sandėliai & Taupyklė',
                    cost: { gold: 380, wood: 220, stone: 180, food: 0 },
                    sellRateBoost: 0.35,
                    passiveGold: 25,
                    buyDiscount: 0.25,
                    tradeXp: false,
                    killBounty: 0,
                    desc: 'Pasyvus Auksas: +25💰 kas 4s, -25% Pirkimo Kaina'
                },
                {
                    level: 4,
                    name: 'Investiciniai Fondai & XP',
                    cost: { gold: 850, wood: 0, stone: 320, food: 260 },
                    sellRateBoost: 0.45,
                    passiveGold: 35,
                    buyDiscount: 0.30,
                    tradeXp: true,
                    killBounty: 0.10,
                    desc: 'Prekyba Teikia XP Evoliucionavimui, +10% Grobis'
                },
                {
                    level: 5,
                    name: 'Aukso Monopolis & Mokesčių Rūmai',
                    cost: { gold: 1800, wood: 550, stone: 600, food: 0 },
                    sellRateBoost: 0.60,
                    passiveGold: 50,
                    buyDiscount: 0.50,
                    tradeXp: true,
                    killBounty: 0.25,
                    desc: '🌟 +50💰 & +5 Resursai kas 3s, +25% Grobis už Priešus'
                }
            ]
        }
    }
};
