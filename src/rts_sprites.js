// ============================================================================
// CLASH OF ERAS - ADVANCED 2D SPRITE, ANIMATION & VFX ENGINE
// High-fidelity micro-sprites, procedural pixel/vector detailing, dynamic 
// keyframe animations, directional turrets, atmospheric particles & shadows.
// ============================================================================

window.RTSSprites = {
    // ------------------------------------------------------------------------
    // BAZINIAI PAGALBINIAI METODAI (ŠEŠĖLIAI, KONTŪRAI, DALELĖS)
    // ------------------------------------------------------------------------

    // Piešia minkštą 2.5D žemės šešėlį po bet kuriuo objektu (ypač greitas be save/restore)
    drawGroundShadow(ctx, x, y, width, height, opacity = 0.35) {
        ctx.fillStyle = `rgba(10, 15, 20, ${opacity})`;
        ctx.beginPath();
        ctx.ellipse(x, y, width * 0.5, height * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // Švytintis spindulys / lazeris
    drawLaserBeam(ctx, x1, y1, x2, y2, color, coreColor = '#ffffff', width = 3) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = width * 3;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = coreColor;
        ctx.lineWidth = Math.max(1, width * 0.35);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    },

    // ------------------------------------------------------------------------
    // 1. DARBININKAI (4 EPOCHINĖS VARIACIJOS IR 4 ROLĖS)
    // ------------------------------------------------------------------------
    drawWorker(ctx, w, dt) {
        const isP = w.isPlayer;
        const wEra = w.era || 0;
        const now = Date.now() * 0.001;
        const isDying = w.state === 'DYING';
        const deathProgress = isDying ? Math.min(1.0, (w.deathTimer || 0) / (w.deathDuration || 1.2)) : 0;
        const isActuallyMoving = (w.isMoving !== false);
        const isWalking = (w.state === 'WALKING_TO_NODE' || w.state === 'WALKING_TO_BASE') && isActuallyMoving;
        const isIdle = (w.state === 'WALKING_TO_NODE' || w.state === 'WALKING_TO_BASE') && !isActuallyMoving;
        const isWorking = w.state === 'WORKING';
        let dir = 1;
        if (w.state === 'WALKING_TO_NODE') {
            dir = (w.targetNodeX >= w.x) ? 1 : -1;
        } else if (w.state === 'WORKING') {
            if (w.role === 'center_gold') {
                dir = (1200 >= w.x) ? 1 : -1;
            } else {
                dir = (w.targetNodeX >= w.x) ? 1 : (isP ? -1 : 1);
            }
        } else if (w.state === 'WALKING_TO_BASE') {
            dir = (w.baseX >= w.x) ? 1 : -1;
        } else {
            dir = isP ? 1 : -1;
        }

        const idleBreathe = Math.sin((w.animTime || 0) * 3) * 0.7;
        const walk = isWalking ? Math.sin((w.animTime || 0) * 14) * 3.5 : (isIdle ? idleBreathe : 0);
        const legSwing = isWalking ? Math.sin((w.animTime || 0) * 14) * 0.6 : 0;
        const workCycle = isWorking ? Math.sin((w.animTime || 0) * 12) : 0;

        ctx.save();
        ctx.translate(w.x, w.y + (w.laneOffsetY || 0));

        // 1. Žemės šešėlis
        this.drawGroundShadow(ctx, 0, 0, 24, 10, 0.4);

        if (isDying) {
            ctx.globalAlpha = Math.max(0, 1.0 - deathProgress);
            ctx.translate(0, deathProgress * 12);
            ctx.rotate(dir * deathProgress * 1.3);
        }

        ctx.scale(dir, 1);

        // Kūno hit flash efektas
        if (w.hitFlash > 0) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10 * w.hitFlash;
        }

        // --- EPOCHŲ DARBININKŲ IŠVAIZDA ---
        if (wEra === 0) {
            // 🦴 AKMENS AMŽIUS: Priešistorinis urvinis darbininkas
            ctx.fillStyle = '#b45309';
            ctx.fillRect(-5 + legSwing * 4, -12, 3.5, 12);
            ctx.fillRect(1 - legSwing * 4, -12, 3.5, 12);

            ctx.fillStyle = '#d97706';
            ctx.fillRect(-6, -26 + walk, 12, 15);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-4, -22 + walk, 4, 4);
            ctx.fillRect(2, -18 + walk, 3, 3);

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(0, -32 + walk, 6.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(0, -35 + walk, 6.5, Math.PI * 0.9, Math.PI * 2.1);
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-4, -39 + walk, 8, 2.5); // Kaulas
        } else if (wEra === 1) {
            // 🌾 VIDURAMŽIAI: Valstietis su lino marškiniais ir šiaudine skrybėle
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-5 + legSwing * 4, -12, 3.5, 12);
            ctx.fillRect(1 - legSwing * 4, -12, 3.5, 12);

            ctx.fillStyle = isP ? '#2563eb' : '#dc2626';
            ctx.fillRect(-6, -26 + walk, 12, 15);
            ctx.fillStyle = '#451a03';
            ctx.fillRect(-6, -18 + walk, 12, 3);

            ctx.fillStyle = '#ffedd5';
            ctx.beginPath();
            ctx.arc(0, -32 + walk, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.ellipse(0, -36 + walk, 11, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(-5, -40 + walk, 10, 5);
        } else if (wEra === 2) {
            // 🎨 RENESANSAS: Amantininkas su liemene ir berete
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-5 + legSwing * 4, -12, 3.5, 12);
            ctx.fillRect(1 - legSwing * 4, -12, 3.5, 12);

            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-6, -26 + walk, 12, 15);
            ctx.fillStyle = isP ? '#0284c7' : '#991b1b';
            ctx.fillRect(-6, -26 + walk, 4, 15);
            ctx.fillRect(2, -26 + walk, 4, 15);

            ctx.fillStyle = '#ffedd5';
            ctx.beginPath();
            ctx.arc(0, -32 + walk, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isP ? '#0369a1' : '#b91c1c';
            ctx.beginPath();
            ctx.ellipse(-1, -37 + walk, 8, 4, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(3, -42 + walk, 2, 7);
        } else if (wEra === 3) {
            // 🪖 MODERNAS: Pramoninis statybininkas su šalmu
            ctx.fillStyle = '#334155';
            ctx.fillRect(-5 + legSwing * 4, -12, 3.5, 12);
            ctx.fillRect(1 - legSwing * 4, -12, 3.5, 12);

            ctx.fillStyle = isP ? '#0284c7' : '#ea580c';
            ctx.fillRect(-6, -26 + walk, 12, 15);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(-6, -22 + walk, 12, 2.5);
            ctx.fillRect(-6, -16 + walk, 12, 2.5);

            ctx.fillStyle = '#ffedd5';
            ctx.beginPath();
            ctx.arc(0, -32 + walk, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isP ? '#f59e0b' : '#dc2626';
            ctx.beginPath();
            ctx.arc(0, -35 + walk, 7.5, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-8, -35 + walk, 16, 2.5);
        } else {
            // 🤖 ATEITIS: Dvikojis kasybos nanorobotas
            ctx.fillStyle = '#475569';
            ctx.fillRect(-5 + legSwing * 4, -12, 3.5, 12);
            ctx.fillRect(1 - legSwing * 4, -12, 3.5, 12);

            ctx.fillStyle = isP ? '#0f172a' : '#1e1b4b';
            ctx.fillRect(-6, -26 + walk, 12, 15);
            ctx.fillStyle = isP ? '#00f2fe' : '#ff0055';
            ctx.shadowColor = isP ? '#00f2fe' : '#ff0055';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, -18 + walk, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#334155';
            ctx.fillRect(-5, -36 + walk, 10, 8);
            ctx.fillStyle = isP ? '#00f2fe' : '#ff0055';
            ctx.fillRect(-4, -34 + walk, 8, 3);
        }

        // --- DARBININKO ĮRANKIS / NEŠAMAS RESURSAS ---
        if (isWorking) {
            ctx.save();
            ctx.translate(6, -20 + walk);
            ctx.rotate(-0.4 + workCycle * 1.1);

            if (wEra === 4) {
                ctx.strokeStyle = isP ? '#00f2fe' : '#ff0055';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = isP ? '#00f2fe' : '#ff0055';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(16, 12);
                ctx.stroke();
            } else if (w.role === 'wood') {
                ctx.fillStyle = '#78350f';
                ctx.fillRect(0, -14, 3, 18);
                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                ctx.moveTo(3, -14); ctx.lineTo(10, -18); ctx.lineTo(10, -10); ctx.closePath();
                ctx.fill();
            } else if (w.role === 'food') {
                ctx.fillStyle = '#78350f';
                ctx.fillRect(0, -4, 3, 8);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(5, -6, 7, -Math.PI * 0.3, Math.PI * 0.7);
                ctx.stroke();
            } else {
                ctx.fillStyle = '#78350f';
                ctx.fillRect(0, -14, 3, 18);
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-5, -16, 13, 4);
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(5, -15, 4, 2);
            }
            ctx.restore();
        } else if (w.carryingAmount > 0) {
            ctx.save();
            ctx.translate(-9, -20 + walk);
            if (w.role === 'center_gold') {
                ctx.fillStyle = '#b45309';
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(1, -2, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(0, -3, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (w.role === 'wood') {
                ctx.fillStyle = '#854d0e';
                ctx.fillRect(-4, -6, 8, 12);
                ctx.fillStyle = '#ca8a04';
                ctx.beginPath();
                ctx.arc(0, -6, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (w.role === 'stone') {
                ctx.fillStyle = '#64748b';
                ctx.beginPath();
                ctx.moveTo(-5, 4); ctx.lineTo(-2, -6); ctx.lineTo(5, -4); ctx.lineTo(4, 5); ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = '#eab308';
                ctx.fillRect(-3, -8, 6, 14);
                ctx.fillStyle = '#ca8a04';
                ctx.fillRect(-5, -2, 10, 2);
            }
            ctx.restore();
        }

        // --- 4. DARBININKŲ TOBULINIMO PRIEDAI (KREPŠIAI, VEŽIMĖLIAI, KIBERNETINĖ AURA) ---
        const workerUpgLvl = (typeof window !== 'undefined' && window.game && window.game.getUpgradeLevel) 
            ? window.game.getUpgradeLevel('workers_ai', isP) : 0;

        if (workerUpgLvl >= 1) {
            // Odinė kuprinė ant nugaros
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-10, -25 + walk, 4, 9);
        }
        if (workerUpgLvl >= 4 && w.state === 'WALKING_TO_BASE') {
            // Dviejų ratų medinis resursų vežimėlis už darbininko
            ctx.fillStyle = '#92400e';
            ctx.fillRect(-22, -15 + walk, 12, 10);
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(-16, -5 + walk, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        if (workerUpgLvl >= 5) {
            // Švytinti auksinė Išmaniojo AI aura
            ctx.strokeStyle = isP ? 'rgba(251, 191, 36, 0.75)' : 'rgba(239, 68, 68, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = isP ? '#fbbf24' : '#ef4444';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(0, -20 + walk, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.restore();

        if (!isDying && w.hp < w.maxHp && w.hp > 0) {
            ctx.save();
            ctx.translate(w.x, w.y + (w.laneOffsetY || 0));
            const hpPct = Math.max(0, w.hp / w.maxHp);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(-12, -48, 24, 4);
            ctx.fillStyle = isP ? '#22c55e' : '#ef4444';
            ctx.fillRect(-11, -47, 22 * hpPct, 2);
            ctx.restore();
        }
    },

    // ------------------------------------------------------------------------
    // 2. KARIŲ SPRITE ENGINE (VISI 15 VIENETŲ + HEROJAI + MONSTRAI)
    // ------------------------------------------------------------------------
    drawUnit(ctx, u, dt) {
        const id = u.data.id;
        const isPlayer = u.isPlayer;
        const now = Date.now() * 0.001;

        ctx.save();
        ctx.translate(u.x, RTS_DATA.GROUND_Y + (u.laneOffsetY || 0));

        // 1. Pulsuojanti didvyrio aura (aktyvi tik jei toje vietoje nėra susigrūdę > 5 karių)
        const allowGlow = (u.allowGlow !== false);
        if (u.isHero && allowGlow) {
            const aRadius = (u.auraRadius || 200) * 0.45;
            const aColor = (u.aura === 'heal') ? '#10b981' : (u.aura === 'shield' ? '#38bdf8' : (u.aura === 'volley' ? '#f59e0b' : '#00f2fe'));
            ctx.save();
            const aGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, aRadius);
            aGrad.addColorStop(0, aColor + '55');
            aGrad.addColorStop(0.7, aColor + '18');
            aGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = aGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, aRadius, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = aColor + '77';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, aRadius * (0.7 + Math.sin(now * 4) * 0.15), 10, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 2. Dinaminis Žemės Šešėlis
        const shadowW = u.width ? u.width * 0.95 : 36;
        const shadowH = u.width ? u.width * 0.35 : 14;
        this.drawGroundShadow(ctx, 0, 0, shadowW, shadowH, 0.42);

        // 3. Orientacija ir animacijos parametrai
        ctx.save();
        const isActuallyRetreating = (u.isRetreating && u.isMoving);
        const facing = isActuallyRetreating ? (u.isPlayer ? -1 : 1) : (u.attackFacing || (u.isPlayer ? 1 : -1));
        const rankScale = (u.rank === 4) ? 1.25 : ((u.rank === 3) ? 1.18 : ((u.rank === 2) ? 1.12 : ((u.rank === 1) ? 1.06 : 1.0)));
        const giantScale = (u.isGiant || (u.data && u.data.isGiant)) ? 1.35 : 1.0;
        const finalScale = rankScale * giantScale;
        ctx.scale(facing * finalScale, finalScale);

        if (u.rank >= 1 && !u.isHero && allowGlow) {
            if (u.rank === 4) {
                // ČEMPIONAS: Žaidėjui – ryški neoninė ciano/mėlyna aura (#00f2fe), Priešui – agresyvi liepsnojanti raudona/crimson (#ef4444)
                ctx.shadowColor = isPlayer ? '#00f2fe' : '#ef4444';
                ctx.shadowBlur = 18;
            } else if (u.rank === 3) {
                ctx.shadowColor = isPlayer ? '#fbbf24' : '#f87171';
                ctx.shadowBlur = 10;
            } else if (u.rank === 2) {
                ctx.shadowColor = isPlayer ? '#fde047' : '#fca5a5';
                ctx.shadowBlur = 6;
            } else {
                ctx.shadowColor = isPlayer ? '#fef08a' : '#fecaca';
                ctx.shadowBlur = 3;
            }
        }

        const walk = u.isMoving ? Math.sin((u.animTime || 0) * (isActuallyRetreating ? 15 : 10)) * (isActuallyRetreating ? 4 : 3) : 0;
        const legSwing = u.isMoving ? Math.sin((u.animTime || 0) * (isActuallyRetreating ? 15 : 10)) * 0.7 : 0;
        const attack = u.isAttacking ? Math.sin(u.attackProgress * Math.PI) : 0;

        if (u.hitFlash > 0 && allowGlow) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 16 * u.hitFlash;
        }

        if (u.frenzyTimer > 0 && allowGlow) {
            ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ea580c';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.ellipse(0, -(u.height || 45) * 0.5, (u.width || 36) * 0.6, (u.height || 45) * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Čempiono pulsuojantis jėgos žiedas (Žaidėjui - Ciano/Mėlynas, Priešui - Raudonas)
        if (u.rank === 4 && !u.isHero && allowGlow) {
            ctx.strokeStyle = isPlayer ? 'rgba(0, 242, 254, 0.8)' : 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 2.0;
            ctx.shadowColor = isPlayer ? '#00f2fe' : '#ef4444';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(0, -(u.height || 45) * 0.5, (u.width || 36) * 0.68, (u.height || 45) * 0.6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.renderUnitSprite(ctx, u, id, isPlayer, walk, legSwing, attack, now);
        ctx.restore();

        // 4. HP Juosta ir Didvyrio Karūna
        const hpPercent = Math.max(0, u.hp / u.maxHp);
        const barW = Math.max(30, (u.width || 36) + 10);
        const barH = u.isHero ? 7 : 5;
        const barY = -(u.height || 45) - (u.isHero ? 26 : 18);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-barW * 0.5 - 1, barY - 1, barW + 2, barH + 2);

        if (u.isHero) {
            const heroGrad = ctx.createLinearGradient(-barW * 0.5, barY, barW * 0.5, barY);
            heroGrad.addColorStop(0, '#fbbf24');
            heroGrad.addColorStop(1, '#f59e0b');
            ctx.fillStyle = heroGrad;
            ctx.fillRect(-barW * 0.5, barY, barW * hpPercent, barH);

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#f59e0b';
            const isLt = typeof window !== 'undefined' && window.RTS_I18N && window.RTS_I18N.currentLang === 'lt';
            ctx.fillText(isLt ? '👑 HEROJUS' : '👑 HERO', 0, barY - 4);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = u.isPlayer ? '#22c55e' : '#ef4444';
            ctx.fillRect(-barW * 0.5, barY, barW * hpPercent, barH);

            // Žvaigždučių rangas virš kario HP juostos (1 kill = ⭐, 3 kills = ⭐⭐, 6 kills = ⭐⭐⭐, 10 kills = 👑 ⭐⭐⭐⭐)
            if (u.rank >= 1) {
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.lineWidth = 2.2;

                let starTxt = '⭐';
                let starColor = '#fde047';
                let fontSize = 8.5;

                if (u.rank === 4) {
                    starTxt = isPlayer ? '👑 ⭐⭐⭐⭐' : '👑 ⭐⭐⭐⭐';
                    starColor = isPlayer ? '#00f2fe' : '#ef4444';
                    fontSize = 9.5;
                    ctx.shadowColor = isPlayer ? '#00f2fe' : '#ef4444';
                    ctx.shadowBlur = 8;
                } else if (u.rank === 3) {
                    starTxt = '⭐⭐⭐';
                    starColor = isPlayer ? '#f59e0b' : '#f87171';
                    fontSize = 9.0;
                    ctx.shadowColor = isPlayer ? '#fbbf24' : '#ef4444';
                    ctx.shadowBlur = 4;
                } else if (u.rank === 2) {
                    starTxt = '⭐⭐';
                    starColor = isPlayer ? '#fbbf24' : '#fca5a5';
                    fontSize = 8.5;
                } else if (u.rank === 1) {
                    starTxt = '⭐';
                    starColor = isPlayer ? '#fde047' : '#fecaca';
                    fontSize = 8.5;
                }

                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.strokeText(starTxt, 0, barY - 4);
                ctx.fillStyle = starColor;
                ctx.fillText(starTxt, 0, barY - 4);
                ctx.restore();
            }
        }

        ctx.restore();
    },

    // ------------------------------------------------------------------------
    // 3. UNIKALŪS KARIŲ SPRITE MODELIAI
    // ------------------------------------------------------------------------
    renderUnitSprite(ctx, u, id, isPlayer, walk, legSwing, attack, now) {
        const teamColor = isPlayer ? '#2563eb' : '#dc2626';
        const teamTrim = isPlayer ? '#38bdf8' : '#f87171';

        // ====================================================================
        // A. MONSTRŲ INVAZIJA (13 MONSTRŲ & BOSŲ)
        // ====================================================================
        if (id === 'goblin_scout' || u.monsterType === 'goblin_scout') {
            ctx.fillStyle = '#14532d';
            ctx.fillRect(-6 + legSwing * 5, -14, 4, 14);
            ctx.fillRect(1 - legSwing * 5, -14, 4, 14);

            ctx.fillStyle = '#16a34a';
            ctx.fillRect(-7, -28 + walk, 14, 16);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-8, -20 + walk, 16, 6);

            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(2, -34 + walk, 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-4, -36 + walk); ctx.lineTo(-12, -42 + walk); ctx.lineTo(-4, -32 + walk);
            ctx.moveTo(8, -36 + walk); ctx.lineTo(16, -42 + walk); ctx.lineTo(8, -32 + walk);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(3, -36 + walk, 2.5, 2.5);

            ctx.save();
            ctx.translate(8, -24 + walk);
            ctx.rotate(0.3 + attack * 1.8);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(0, -12, 3, 16);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-1, 2, 5, 3);
            ctx.restore();
            return;
        }

        if (id === 'acid_spitter' || u.monsterType === 'acid_spitter') {
            ctx.fillStyle = '#581c87';
            ctx.fillRect(-12 + legSwing * 4, -14, 5, 14);
            ctx.fillRect(6 - legSwing * 4, -14, 5, 14);

            ctx.fillStyle = '#7e22ce';
            ctx.beginPath();
            ctx.ellipse(0, -24 + walk, 18, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-14, -22 + walk); ctx.lineTo(-32, -14 + walk); ctx.lineTo(-12, -16 + walk);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#10b981';
            [-8, -2, 4].forEach(sx => {
                ctx.beginPath();
                ctx.moveTo(sx, -26 + walk); ctx.lineTo(sx - 3, -36 + walk); ctx.lineTo(sx + 3, -26 + walk);
                ctx.fill();
            });

            ctx.fillStyle = '#9333ea';
            ctx.beginPath();
            ctx.arc(14, -26 + walk, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#34d399';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(18, -25 + walk, 4 + attack * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'ogre_brute' || u.monsterType === 'ogre_brute') {
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(-14 + legSwing * 4, -22, 11, 22);
            ctx.fillRect(4 - legSwing * 4, -22, 11, 22);

            ctx.fillStyle = '#991b1b';
            ctx.fillRect(-16, -50 + walk, 32, 30);
            ctx.fillStyle = '#450a0a';
            ctx.fillRect(-17, -34 + walk, 34, 7);

            ctx.fillStyle = '#b91c1c';
            ctx.beginPath();
            ctx.arc(4, -58 + walk, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.moveTo(-2, -64 + walk); ctx.lineTo(-10, -76 + walk); ctx.lineTo(2, -66 + walk);
            ctx.moveTo(10, -64 + walk); ctx.lineTo(18, -76 + walk); ctx.lineTo(6, -66 + walk);
            ctx.fill();

            ctx.save();
            ctx.translate(14, -42 + walk);
            ctx.rotate(-0.4 + attack * 2.1);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-4, -36, 10, 44);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -38, 18, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-12, -34, 4, 4);
            ctx.fillRect(10, -34, 4, 4);
            ctx.restore();
            return;
        }

        if (id === 'shadow_gargoyle' || u.monsterType === 'shadow_gargoyle') {
            const flap = Math.sin(now * 14) * 16;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -38 + walk, 16, 22);

            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(0, -32 + walk); ctx.lineTo(-28, -56 + walk + flap); ctx.lineTo(-14, -26 + walk);
            ctx.moveTo(0, -32 + walk); ctx.lineTo(28, -56 + walk - flap); ctx.lineTo(14, -26 + walk);
            ctx.fill();

            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.arc(0, -44 + walk, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c084fc';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 8;
            ctx.fillRect(2, -46 + walk, 3, 3);
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'lava_golem' || u.monsterType === 'lava_golem') {
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(-18 + legSwing * 4, -26, 14, 26);
            ctx.fillRect(4 - legSwing * 4, -26, 14, 26);

            ctx.fillStyle = '#292524';
            ctx.fillRect(-18, -62 + walk, 36, 38);
            ctx.fillStyle = '#ea580c';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 12;
            ctx.fillRect(-14, -54 + walk, 28, 5);
            ctx.fillRect(-10, -44 + walk, 20, 5);
            ctx.fillRect(-6, -34 + walk, 12, 5);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#44403c';
            ctx.fillRect(-10, -76 + walk, 20, 16);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(-2, -72 + walk, 8, 4);

            ctx.save();
            ctx.translate(16, -46 + walk);
            ctx.rotate(attack * 1.8);
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.arc(10, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        if (id === 'plasma_hydra' || u.monsterType === 'plasma_hydra') {
            ctx.fillStyle = '#0e7490';
            ctx.fillRect(-12 + legSwing * 4, -20, 24, 20);

            [-8, 0, 8].forEach((offset, idx) => {
                const headWave = Math.sin(now * 6 + idx * 1.5) * 4;
                ctx.fillStyle = '#0891b2';
                ctx.beginPath();
                ctx.moveTo(offset, -20 + walk);
                ctx.lineTo(offset + 6, -42 + walk + headWave);
                ctx.lineTo(offset + 12, -40 + walk + headWave);
                ctx.lineTo(offset + 4, -18 + walk);
                ctx.fill();

                ctx.fillStyle = '#06b6d4';
                ctx.beginPath();
                ctx.arc(offset + 9, -42 + walk + headWave, 6.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#67e8f9';
                ctx.shadowColor = '#22d3ee';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(offset + 12, -42 + walk + headWave, 3 + attack * 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });
            return;
        }

        if (id === 'undead_necromancer' || u.monsterType === 'undead_necromancer') {
            ctx.fillStyle = '#3b0764';
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(-7, -38 + walk); ctx.lineTo(7, -38 + walk); ctx.lineTo(10, 0);
            ctx.fill();

            ctx.fillStyle = '#581c87';
            ctx.beginPath();
            ctx.arc(0, -42 + walk, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c084fc';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 8;
            ctx.fillRect(2, -43 + walk, 2.5, 2.5);
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.translate(10, -28 + walk);
            ctx.rotate(attack * 0.8);
            ctx.fillStyle = '#475569';
            ctx.fillRect(-2, -26, 4, 38);
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(0, -28, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#9333ea';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 10;
            ctx.fillRect(-2, -30, 4, 4);
            ctx.shadowBlur = 0;
            ctx.restore();
            return;
        }

        if (id === 'cyber_mutant' || u.monsterType === 'cyber_mutant') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-12 + legSwing * 4, -22, 24, 22);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-10, -45 + walk, 20, 24);

            ctx.fillStyle = '#64748b';
            ctx.fillRect(-8, -55 + walk, 16, 12);
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#dc2626';
            ctx.shadowBlur = 8;
            ctx.fillRect(1, -52 + walk, 6, 3);
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.translate(6, -42 + walk);
            ctx.rotate(-0.1 + attack * 0.4);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-4, -14, 24, 8);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(16, -16, 6, 12);
            ctx.restore();
            return;
        }

        if (id === 'void_colossus' || u.monsterType === 'void_colossus') {
            ctx.fillStyle = '#090514';
            ctx.fillRect(-18 + legSwing * 4, -26, 36, 26);
            ctx.fillStyle = '#180d2b';
            ctx.fillRect(-16, -65 + walk, 32, 40);

            ctx.fillStyle = '#9333ea';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 12;
            ctx.fillRect(-10, -56 + walk, 20, 5);
            ctx.fillRect(-6, -44 + walk, 12, 5);
            ctx.fillRect(-12, -32 + walk, 24, 5);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#2e1065';
            ctx.fillRect(-10, -78 + walk, 20, 15);
            ctx.fillStyle = '#f43f5e';
            ctx.fillRect(-2, -74 + walk, 8, 4);

            ctx.save();
            ctx.translate(16, -45 + walk);
            ctx.rotate(attack * 1.8);
            ctx.fillStyle = '#090514';
            ctx.fillRect(0, -15, 18, 22);
            ctx.restore();
            return;
        }

        if (id === 'frost_wyrm' || u.monsterType === 'frost_wyrm') {
            const fWing = Math.sin(now * 10) * 16;
            ctx.fillStyle = '#0369a1';
            ctx.fillRect(-16, -42 + walk, 32, 24);

            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#0284c7';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -38 + walk); ctx.lineTo(-34, -72 + walk + fWing); ctx.lineTo(-12, -32 + walk);
            ctx.moveTo(0, -38 + walk); ctx.lineTo(34, -72 + walk - fWing); ctx.lineTo(12, -32 + walk);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            ctx.moveTo(12, -46 + walk); ctx.lineTo(28, -52 + walk); ctx.lineTo(18, -38 + walk);
            ctx.fill();
            ctx.fillStyle = '#e0f2fe';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(24, -48 + walk, 4 + attack * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'dragon_boss' || u.monsterType === 'dragon_boss') {
            const dWing = Math.sin(now * 8) * 22;
            ctx.fillStyle = '#7f1d1d';
            ctx.beginPath();
            ctx.moveTo(-24, -40 + walk); ctx.lineTo(-58, -32 + walk + Math.sin(now * 6) * 10); ctx.lineTo(-26, -26 + walk);
            ctx.fill();

            ctx.fillStyle = '#991b1b';
            ctx.fillRect(-26, -56 + walk, 52, 38);
            ctx.fillStyle = '#450a0a';
            ctx.fillRect(-20, -36 + walk, 40, 18);

            ctx.fillStyle = '#b91c1c';
            ctx.beginPath();
            ctx.moveTo(0, -50 + walk); ctx.lineTo(-46, -92 + walk + dWing); ctx.lineTo(-18, -44 + walk);
            ctx.moveTo(0, -50 + walk); ctx.lineTo(46, -92 + walk - dWing); ctx.lineTo(18, -44 + walk);
            ctx.fill();

            ctx.fillStyle = '#7f1d1d';
            ctx.beginPath();
            ctx.moveTo(22, -62 + walk); ctx.lineTo(44, -70 + walk); ctx.lineTo(30, -50 + walk);
            ctx.fill();
            ctx.fillStyle = '#f97316';
            ctx.shadowColor = '#ea580c';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(36, -64 + walk, 8 + attack * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'mecha_titan_boss' || u.monsterType === 'mecha_titan_boss') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-24 + legSwing * 4, -30, 48, 30);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-22, -80 + walk, 44, 52);

            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#dc2626';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(0, -55 + walk, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.translate(22, -60 + walk);
            ctx.rotate(attack * 0.6);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-6, -15, 36, 12);
            ctx.fillRect(-6, 2, 36, 12);
            ctx.restore();
            return;
        }

        if (id === 'abyssal_overlord' || u.monsterType === 'abyssal_overlord') {
            const hover = Math.sin(now * 4) * 8;
            ctx.fillStyle = '#090514';
            ctx.beginPath();
            ctx.ellipse(0, -60 + hover, 28, 48, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a855f7';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 20;
            for (let i = 0; i < 5; i++) {
                const ang = now * 2 + i * (Math.PI * 2 / 5);
                ctx.beginPath();
                ctx.arc(Math.cos(ang) * 36, -60 + hover + Math.sin(ang) * 20, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'ancient_colossus_titan' || u.monsterType === 'ancient_colossus_titan') {
            // Gigantiškas akmeninis titanas su liepsnojančiomis gyslomis ir masyviais kumščiais
            const legWalk = Math.sin(now * 5) * 8;
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(-26 + legWalk, -35, 24, 35);
            ctx.fillRect(4 - legWalk, -35, 24, 35);

            // Kūnas - uolienų monolitas
            ctx.fillStyle = '#292524';
            ctx.fillRect(-34, -100 + walk, 68, 70);

            // Magmos gyslos krūtinėje (pulsavimas)
            ctx.fillStyle = '#f97316';
            ctx.shadowColor = '#ea580c';
            ctx.shadowBlur = 18;
            ctx.fillRect(-18, -88 + walk, 36, 8);
            ctx.fillRect(-12, -72 + walk, 24, 7);
            ctx.fillRect(-22, -56 + walk, 44, 8);
            ctx.shadowBlur = 0;

            // Galva su liepsnojančia viena akimi
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(-18, -122 + walk, 36, 24);
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 15;
            ctx.fillRect(-4, -114 + walk, 12, 8);
            ctx.shadowBlur = 0;

            // Triuškinantis kumštis
            ctx.save();
            ctx.translate(28, -75 + walk);
            ctx.rotate(attack * 1.5);
            ctx.fillStyle = '#44403c';
            ctx.fillRect(0, -18, 28, 36);
            ctx.fillStyle = '#f97316';
            ctx.fillRect(6, -10, 16, 18);
            ctx.restore();
            return;
        }

        // ====================================================================
        // B. 9 EPOCHOS DIDVYRIAI (HEROJAI)
        // ====================================================================
        if (id === 'shaman_hero') {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-7 + legSwing * 4, -18, 5, 18);
            ctx.fillRect(2 - legSwing * 4, -18, 5, 18);

            ctx.fillStyle = '#92400e';
            ctx.fillRect(-8, -42 + walk, 16, 26);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(-8, -32 + walk, 16, 5);

            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.arc(0, -48 + walk, 8.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-8, -58 + walk, 16, 5);

            ctx.save();
            ctx.translate(10, -32 + walk);
            ctx.rotate(-0.2 + attack * 0.8);
            ctx.fillStyle = '#451a03';
            ctx.fillRect(0, -28, 4, 44);
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(2, -32 + Math.sin(now * 6) * 3, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
            return;
        }

        if (id === 'paladin_hero') {
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(-9 + legSwing * 4, -20, 6, 20);
            ctx.fillRect(3 - legSwing * 4, -20, 6, 20);

            ctx.fillStyle = '#eab308';
            ctx.fillRect(-10, -46 + walk, 20, 28);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-12, -44 + walk, 4, 26);

            ctx.fillStyle = '#fde047';
            ctx.fillRect(-8, -58 + walk, 16, 14);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-2, -66 + walk, 4, 10);

            ctx.save();
            ctx.translate(12, -32 + walk);
            ctx.rotate(-0.5 + attack * 2.0);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 12;
            ctx.fillRect(0, -34, 5, 38);
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(-5, 2, 15, 5);
            ctx.shadowBlur = 0;
            ctx.restore();
            return;
        }

        if (id === 'general_hero') {
            ctx.fillStyle = '#1e3a8a';
            ctx.fillRect(-8 + legSwing * 4, -20, 5, 20);
            ctx.fillRect(3 - legSwing * 4, -20, 5, 20);

            ctx.fillStyle = '#1d4ed8';
            ctx.fillRect(-9, -44 + walk, 18, 26);
            ctx.fillStyle = '#fbbf24'; // Aukso epoletai
            ctx.fillRect(-11, -44 + walk, 22, 5);

            // Dviragė skrybėlė
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(-14, -58 + walk); ctx.lineTo(14, -58 + walk); ctx.lineTo(0, -70 + walk); ctx.fill();

            // Karinis kardas
            ctx.save();
            ctx.translate(10, -30 + walk);
            ctx.rotate(-0.3 + attack * 1.8);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, -30, 3.5, 34);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-3, 0, 9, 3);
            ctx.restore();
            return;
        }

        if (id === 'commando_hero') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-8 + legSwing * 4, -20, 5, 20);
            ctx.fillRect(3 - legSwing * 4, -20, 5, 20);

            ctx.fillStyle = '#334155';
            ctx.fillRect(-9, -44 + walk, 18, 26);

            // Naktinio matymo akiniai
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-7, -54 + walk, 14, 12);
            ctx.fillStyle = '#22c55e';
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 8;
            ctx.fillRect(-3, -50 + walk, 7, 3);
            ctx.shadowBlur = 0;

            // Dvigubi automatai
            ctx.save();
            ctx.translate(8, -32 + walk);
            ctx.rotate(-0.15 + attack * 0.4);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, -10, 24, 7);
            ctx.fillRect(0, 2, 24, 7);
            ctx.restore();
            return;
        }

        if (id === 'mecha_hero') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-16 + legSwing * 4, -24, 12, 24);
            ctx.fillRect(4 - legSwing * 4, -24, 12, 24);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-15, -64 + walk, 30, 42);

            ctx.fillStyle = '#00f2fe';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(0, -45 + walk, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.translate(14, -48 + walk);
            ctx.rotate(attack * 0.5);
            ctx.fillStyle = '#475569';
            ctx.fillRect(-4, -10, 30, 8);
            ctx.fillRect(-4, 2, 30, 8);
            ctx.restore();
            return;
        }

        if (id === 'kensei_hero') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8 + legSwing * 4, -20, 5, 20);
            ctx.fillRect(3 - legSwing * 4, -20, 5, 20);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-9, -44 + walk, 18, 26);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-9, -32 + walk, 18, 4);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -56 + walk, 16, 14);
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(0, -62 + walk, 8, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();

            ctx.save();
            ctx.translate(8, -30 + walk);
            ctx.rotate(-0.7 + attack * 2.4);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, -36, 3, 40);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-3, 2, 9, 3);
            ctx.restore();
            return;
        }

        if (id === 'alchemist_hero') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-8 + legSwing * 4, -20, 5, 20);
            ctx.fillRect(3 - legSwing * 4, -20, 5, 20);

            ctx.fillStyle = '#047857';
            ctx.fillRect(-9, -44 + walk, 18, 26);

            // Daktaro kaukė (Snapelis)
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, -52 + walk, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(4, -54 + walk); ctx.lineTo(16, -48 + walk); ctx.lineTo(4, -46 + walk); ctx.fill();

            // Kolba rankoje
            ctx.save();
            ctx.translate(10, -28 + walk);
            ctx.rotate(attack * 1.6);
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
            return;
        }

        if (id === 'drone_hero') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-7 + legSwing * 4, -20, 4.5, 20);
            ctx.fillRect(3 - legSwing * 4, -20, 4.5, 20);

            ctx.fillStyle = '#0284c7';
            ctx.fillRect(-8, -44 + walk, 16, 26);

            // Orbituojantis dronas
            const dAng = now * 4;
            const drX = Math.cos(dAng) * 26;
            const drY = -48 + Math.sin(dAng) * 10;
            ctx.fillStyle = '#00f2fe';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(drX, drY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'bio_queen_hero') {
            const bWing = Math.sin(now * 12) * 14;
            ctx.fillStyle = '#831843';
            ctx.fillRect(-8, -44 + walk, 16, 26);

            // Chitininiai sparnai
            ctx.fillStyle = '#be123c';
            ctx.beginPath();
            ctx.moveTo(0, -36 + walk); ctx.lineTo(-24, -64 + walk + bWing); ctx.lineTo(-10, -28 + walk);
            ctx.moveTo(0, -36 + walk); ctx.lineTo(24, -64 + walk - bWing); ctx.lineTo(10, -28 + walk);
            ctx.fill();

            ctx.fillStyle = '#fb7185';
            ctx.beginPath();
            ctx.arc(0, -52 + walk, 8, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // ====================================================================
        // C. 15 KANONINIŲ EPOCHŲ KARIŲ
        // ====================================================================

        // --------------------------------------------------------------------
        // EPOCHA 0: AKMENS AMŽIUS
        // --------------------------------------------------------------------
        if (id === 'clubman') {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-7 + legSwing * 4, -16, 4.5, 16);
            ctx.fillRect(2 - legSwing * 4, -16, 4.5, 16);

            ctx.fillStyle = '#d97706';
            ctx.fillRect(-8, -36 + walk, 16, 22);
            ctx.fillStyle = '#451a03';
            ctx.fillRect(-6, -30 + walk, 5, 5);

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(0, -42 + walk, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a2010';
            ctx.beginPath();
            ctx.arc(0, -45 + walk, 9, Math.PI * 0.8, Math.PI * 2.2);
            ctx.fill();

            ctx.save();
            ctx.translate(8, -26 + walk);
            ctx.rotate(-0.5 + attack * 2.0);
            ctx.fillStyle = '#5c3818';
            ctx.fillRect(0, -22, 6, 28);
            ctx.fillStyle = '#7a4e25';
            ctx.beginPath();
            ctx.arc(3, -20, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(8, -22, 4, 3);
            ctx.fillRect(-4, -22, 4, 3);
            ctx.restore();
            return;
        }

        if (id === 'rock_thrower') {
            ctx.fillStyle = '#6e4120';
            ctx.fillRect(-6 + legSwing * 4, -15, 4, 15);
            ctx.fillRect(2 - legSwing * 4, -15, 4, 15);

            ctx.fillStyle = '#c58a59';
            ctx.fillRect(-6, -32 + walk, 12, 19);

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(0, -38 + walk, 7.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(6, -26 + walk);
            ctx.rotate(attack * 4.0);
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(16, -10); ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(16, -10, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        if (id === 'dino_rider') {
            ctx.fillStyle = isPlayer ? '#15803d' : '#b45309';
            ctx.fillRect(-22 + legSwing * 8, -18, 10, 18);
            ctx.fillRect(8 - legSwing * 8, -18, 10, 18);

            ctx.beginPath();
            ctx.ellipse(0, -32 + walk, 36, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-30, -32 + walk); ctx.lineTo(-60, -18 + walk); ctx.lineTo(-26, -22 + walk);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(20, -38 + walk); ctx.lineTo(44, -58 + walk); ctx.lineTo(58, -50 + walk); ctx.lineTo(32, -26 + walk);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(46, -52 + walk, 4, 4);

            ctx.fillStyle = '#d49b6a';
            ctx.fillRect(-6, -54 + walk, 12, 18);
            ctx.beginPath();
            ctx.arc(0, -60 + walk, 7.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-12, -48 + walk);
            ctx.lineTo(44 + attack * 28, -54 + walk);
            ctx.stroke();
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.moveTo(44 + attack * 28, -58 + walk);
            ctx.lineTo(56 + attack * 28, -54 + walk);
            ctx.lineTo(44 + attack * 28, -50 + walk);
            ctx.fill();
            return;
        }

        // --------------------------------------------------------------------
        // EPOCHA 1: VIDURAMŽIAI
        // --------------------------------------------------------------------
        if (id === 'swordsman') {
            ctx.fillStyle = '#475569';
            ctx.fillRect(-7 + legSwing * 4, -18, 4.5, 18);
            ctx.fillRect(2 - legSwing * 4, -18, 4.5, 18);

            ctx.fillStyle = teamColor;
            ctx.fillRect(-7, -36 + walk, 14, 20);

            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(-7, -48 + walk, 14, 13);
            ctx.fillStyle = teamTrim;
            ctx.fillRect(-2, -54 + walk, 4, 7);

            ctx.fillStyle = teamColor;
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-12, -36 + walk); ctx.lineTo(-2, -36 + walk); ctx.lineTo(-2, -18 + walk);
            ctx.lineTo(-7, -12 + walk); ctx.lineTo(-12, -18 + walk); ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.save();
            ctx.translate(6, -26 + walk);
            ctx.rotate(-0.5 + attack * 2.0);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, -26, 4, 28);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-4, 0, 12, 3.5);
            ctx.restore();
            return;
        }

        if (id === 'archer') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(-6 + legSwing * 4, -16, 4, 16);
            ctx.fillRect(2 - legSwing * 4, -16, 4, 16);

            ctx.fillStyle = isPlayer ? '#166534' : '#7f1d1d';
            ctx.fillRect(-6, -34 + walk, 12, 20);

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(0, -40 + walk, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.moveTo(-7, -43 + walk); ctx.lineTo(7, -43 + walk); ctx.lineTo(0, -51 + walk); ctx.fill();

            ctx.save();
            ctx.translate(6, -26 + walk);
            const aim = (u.isAttacking && typeof u.aimAngle === 'number' && Number.isFinite(u.aimAngle)) ? u.aimAngle : 0;
            ctx.rotate(aim);
            ctx.strokeStyle = '#854d0e';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(6, 0, 16, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.stroke();
            if (u.isAttacking) {
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-6 * (1 - attack), 0); ctx.lineTo(18, 0); ctx.stroke();
            }
            ctx.restore();
            return;
        }

        if (id === 'knight') {
            ctx.fillStyle = '#451a03';
            ctx.fillRect(-24 + legSwing * 6, -20, 9, 20);
            ctx.fillRect(14 - legSwing * 6, -20, 9, 20);

            ctx.fillStyle = teamColor;
            ctx.fillRect(-28, -38 + walk, 54, 22);
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.moveTo(22, -38 + walk); ctx.lineTo(40, -62 + walk); ctx.lineTo(50, -54 + walk); ctx.lineTo(34, -28 + walk);
            ctx.fill();

            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(-8, -58 + walk, 16, 22);
            ctx.fillRect(-6, -70 + walk, 12, 13);
            ctx.fillStyle = teamTrim;
            ctx.fillRect(-2, -76 + walk, 5, 7);

            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-10, -52 + walk);
            ctx.lineTo(48 + attack * 26, -52 + walk);
            ctx.stroke();
            ctx.fillStyle = teamColor;
            ctx.beginPath();
            ctx.moveTo(34, -52 + walk); ctx.lineTo(46, -45 + walk); ctx.lineTo(34, -40 + walk); ctx.fill();
            return;
        }

        // --------------------------------------------------------------------
        // EPOCHA 2: RENESANSAS
        // --------------------------------------------------------------------
        if (id === 'duelist') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-5 + legSwing * 4, -16, 4, 16);
            ctx.fillRect(2 - legSwing * 4, -16, 4, 16);

            ctx.fillStyle = teamColor;
            ctx.fillRect(-6, -34 + walk, 12, 20);

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(0, -40 + walk, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-10, -44 + walk, 20, 3.5);
            ctx.fillRect(-5, -50 + walk, 10, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-3, -55 + walk, 3, 7);

            ctx.save();
            ctx.translate(6, -26 + walk);
            ctx.rotate(-0.2 + attack * 1.5);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(0, -20, 2.5, 26);
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(1, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        if (id === 'musketeer') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-5 + legSwing * 4, -16, 4, 16);
            ctx.fillRect(2 - legSwing * 4, -16, 4, 16);

            ctx.fillStyle = isPlayer ? '#1e3a8a' : '#831843';
            ctx.fillRect(-6, -34 + walk, 12, 20);

            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(0, -40 + walk, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-8, -45 + walk, 16, 4.5);

            ctx.save();
            ctx.translate(0, -25 + walk);
            const aim = (u.isAttacking && typeof u.aimAngle === 'number' && Number.isFinite(u.aimAngle)) ? u.aimAngle : 0;
            ctx.rotate(aim);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(0, -2, 22, 4.5);
            ctx.fillStyle = '#475569';
            ctx.fillRect(18, -3, 14, 3.5);

            if (u.isAttacking) {
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(33, -1, 6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        if (id === 'mobile_cannon' || id === 'cannon_wagon') {
            const recoil = u.isAttacking ? -attack * 7 : 0;
            ctx.save();
            ctx.translate(recoil, 0);

            ctx.fillStyle = '#451a03';
            ctx.fillRect(-24, -20 + walk * 1.5, 42, 12);
            ctx.fillStyle = '#b45309';
            ctx.beginPath();
            ctx.moveTo(-12, -28 + walk); ctx.lineTo(22, -30 + walk); ctx.lineTo(22, -20 + walk); ctx.lineTo(-12, -18 + walk);
            ctx.fill();

            ctx.fillStyle = '#78350f';
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            [-14, 8].forEach(wx => {
                ctx.beginPath();
                ctx.arc(wx, -8, 9.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            if (u.isAttacking) {
                ctx.fillStyle = '#f59e0b';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 18;
                ctx.beginPath();
                ctx.arc(32, -25 + walk, 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            ctx.restore();
            return;
        }

        // --------------------------------------------------------------------
        // EPOCHA 3: MODERNUS AMŽIUS
        // --------------------------------------------------------------------
        if (id === 'assault_soldier' || id === 'infantry') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-6 + legSwing * 4, -18, 4.5, 18);
            ctx.fillRect(2 - legSwing * 4, -18, 4.5, 18);

            ctx.fillStyle = teamColor;
            ctx.fillRect(-7, -36 + walk, 14, 22);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-6, -32 + walk, 12, 13);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-7, -46 + walk, 14, 11);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(-4, -42 + walk, 8, 3);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(2, -26 + walk, 22, 5.5);
            if (u.isAttacking) {
                ctx.fillStyle = '#fde047';
                ctx.fillRect(24, -28 + walk, 6, 4);
            }
            return;
        }

        if (id === 'rocket_soldier' || id === 'sniper') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-6 + legSwing * 4, -16, 4, 16);
            ctx.fillRect(2 - legSwing * 4, -16, 4, 16);

            ctx.fillStyle = teamColor;
            ctx.fillRect(-6, -34 + walk, 12, 20);

            ctx.save();
            ctx.translate(0, -33 + walk);
            const aim = (u.isAttacking && typeof u.aimAngle === 'number' && Number.isFinite(u.aimAngle)) ? u.aimAngle : 0;
            ctx.rotate(aim);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-6, -3, 34, 6.5);
            ctx.fillStyle = '#eab308';
            ctx.fillRect(24, -2, 4, 4.5);
            if (u.isAttacking) {
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(30, 0, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        if (id === 'battle_tank' || id === 'tank') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-32, -20, 64, 16);
            ctx.fillStyle = '#475569';
            for (let i = -24; i <= 24; i += 12) {
                ctx.beginPath();
                ctx.arc(i, -11, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = teamColor;
            ctx.fillRect(-30, -30 + walk * 1.2, 60, 13);
            ctx.fillStyle = isPlayer ? '#172554' : '#450a0a';
            ctx.fillRect(-14, -40 + walk * 1.2, 30, 12);

            // Tanko bokštelio vamzdis nusitaiko link taikinio!
            ctx.save();
            ctx.translate(14, -34 + walk * 1.2);
            const tankAim = (u.isAttacking && typeof u.aimAngle === 'number' && Number.isFinite(u.aimAngle)) ? u.aimAngle : 0;
            ctx.rotate(tankAim);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, -3, 36, 6);

            if (u.isAttacking) {
                ctx.fillStyle = '#f59e0b';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(40, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            ctx.restore();
            return;
        }

        // --------------------------------------------------------------------
        // EPOCHA 4: ATEITIES AMŽIUS
        // --------------------------------------------------------------------
        if (id === 'laser_cyborg') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-6 + legSwing * 4, -18, 4.5, 18);
            ctx.fillRect(2 - legSwing * 4, -18, 4.5, 18);

            ctx.fillStyle = isPlayer ? '#0369a1' : '#991b1b';
            ctx.fillRect(-7, -36 + walk, 14, 22);

            ctx.fillStyle = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.shadowColor = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.shadowBlur = 10;
            ctx.fillRect(-4, -42 + walk, 9, 3.5);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(4, -26 + walk, 22, 5.5);
            ctx.fillStyle = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.fillRect(16, -25 + walk, 12, 3.5);
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'jetpack_marine') {
            const hoverY = Math.sin(now * 8) * 4;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-7, -48 + hoverY, 14, 24);

            ctx.fillStyle = '#475569';
            ctx.fillRect(-12, -44 + hoverY, 5, 16);
            ctx.fillStyle = isPlayer ? '#00f2fe' : '#f43f5e';
            ctx.shadowColor = isPlayer ? '#00f2fe' : '#f43f5e';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(-12, -28 + hoverY); ctx.lineTo(-9.5, -16 + hoverY + Math.random() * 6); ctx.lineTo(-7, -28 + hoverY);
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (id === 'titan_mech') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-18 + legSwing * 4, -26, 12, 26);
            ctx.fillRect(6 - legSwing * 4, -26, 12, 26);

            ctx.fillStyle = isPlayer ? '#0369a1' : '#881337';
            ctx.fillRect(-16, -68 + walk, 32, 44);

            ctx.fillStyle = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.shadowColor = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(0, -48 + walk, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#334155';
            ctx.fillRect(14, -54 + walk, 28, 7);
            ctx.fillRect(14, -42 + walk, 28, 7);
            return;
        }

        // Fallback
        ctx.fillStyle = teamColor;
        ctx.fillRect(-8, -34 + walk, 16, 24);
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(0, -40 + walk, 7, 0, Math.PI * 2);
        ctx.fill();
    },

    // ------------------------------------------------------------------------
    // 4. BOKŠTELIŲ SPRITE ENGINE (VISI 15 BOKŠTELIŲ)
    // ------------------------------------------------------------------------
    drawTurretWeapon(ctx, turret, isPlayer) {
        const pType = turret.data.projectile || turret.data.projectileType || '';
        const tId = turret.data.id || '';
        const isRecoil = turret.recoilTimer > 0;
        const recoilOffset = isRecoil ? -3 : 0;

        ctx.save();
        ctx.translate(recoilOffset, 0);

        if (tId === 'slingshot') {
            // Medinė svaidyklė
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(0, -4, 24, 8);
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.arc(24, 0, 7, 0, Math.PI * 2);
            ctx.fill();
        } else if (tId === 'fire_slingshot') {
            // Dervos svaidyklė
            ctx.fillStyle = '#78350f';
            ctx.fillRect(0, -5, 26, 10);
            ctx.fillStyle = '#ea580c';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(26, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (tId === 'bone_catapult' || pType === 'volcano_rock') {
            // Ugnikalnio katapulta
            ctx.fillStyle = '#fde68a';
            ctx.fillRect(0, -5, 30, 10);
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(30, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (tId === 'light_ballista' || pType === 'bolt') {
            // Balista
            ctx.fillStyle = '#5a3d28';
            ctx.fillRect(0, -5, 30, 10);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(22, -12, 4, 24);
        } else if (tId === 'fire_arrow_tower') {
            // Ugninių strėlių bokštelis
            ctx.fillStyle = '#78350f';
            ctx.fillRect(0, -5, 28, 10);
            ctx.fillStyle = '#f97316';
            ctx.fillRect(20, -10, 6, 20);
        } else if (tId === 'heavy_catapult' || tId === 'tar_boiler') {
            // Katapulta / Dervos katilas
            ctx.fillStyle = '#334155';
            ctx.fillRect(0, -7, 30, 14);
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(26, 0, 9, 0, Math.PI * 2);
            ctx.fill();
        } else if (tId === 'renaissance_cannon' || pType === 'cannonball') {
            // Bronzinė patranka
            ctx.fillStyle = '#b45309';
            ctx.fillRect(0, -6, 32, 12);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(28, -7, 4, 14);
        } else if (tId === 'double_cannon') {
            // Dviguba patranka
            ctx.fillStyle = '#475569';
            ctx.fillRect(0, -8, 32, 7);
            ctx.fillRect(0, 1, 32, 7);
        } else if (tId === 'organ_gun') {
            // Daugiavamzdė patranka
            ctx.fillStyle = '#334155';
            ctx.fillRect(0, -10, 28, 20);
            ctx.fillStyle = '#64748b';
            for (let b = -8; b <= 8; b += 4) {
                ctx.fillRect(24, b - 1, 10, 2.5);
            }
        } else if (tId === 'flak_cannon') {
            // Priešlėktuvinis Flak 88
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(0, -5, 36, 10);
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(32, -6, 4, 12);
        } else if (tId === 'rocket_turret') {
            // Raketų bokštas
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, -8, 26, 16);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(20, -7, 8, 4);
            ctx.fillRect(20, 3, 8, 4);
        } else if (tId === 'tesla_coil' || pType === 'lightning') {
            // Tesla ritė
            ctx.fillStyle = '#b45309';
            ctx.fillRect(0, -4, 24, 8);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 12;
            for (let c = 8; c <= 24; c += 6) {
                ctx.beginPath();
                ctx.arc(c, 0, 5, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = '#00f2fe';
            ctx.beginPath();
            ctx.arc(26, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (tId === 'plasma_turret') {
            // Plazminis bokštas
            ctx.fillStyle = isPlayer ? '#0284c7' : '#991b1b';
            ctx.fillRect(0, -5, 32, 10);
            ctx.fillStyle = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.shadowColor = isPlayer ? '#00f2fe' : '#ff0055';
            ctx.shadowBlur = 12;
            ctx.fillRect(26, -6, 8, 12);
            ctx.shadowBlur = 0;
        } else if (tId === 'ion_beam_turret') {
            // Joninė patranka
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, -6, 36, 12);
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 14;
            ctx.fillRect(30, -5, 8, 10);
            ctx.shadowBlur = 0;
        } else if (tId === 'orbital_emitter') {
            // Gravitacinis emiteris
            ctx.fillStyle = '#090d16';
            ctx.fillRect(0, -6, 32, 12);
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(28, 0, 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#e879f9';
            ctx.beginPath();
            ctx.arc(28, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Bazinė patranka
            ctx.fillStyle = isPlayer ? '#0284c7' : '#991b1b';
            ctx.fillRect(0, -5, 30, 10);
        }

        ctx.restore();
    }
};
