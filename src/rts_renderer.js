// ============================================================================
// CLASH OF ERAS - IDENTICAL CANONICAL 2D VECTOR RENDERER & VFX ENGINE
// ============================================================================

// Apsauginis roundRect palaikymas senesnėms naršyklėms ir saugiam spindulių apdorojimui
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        if (!radii) radii = 0;
        const r = Math.min(Math.max(0, typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0)), Math.abs(w) / 2, Math.abs(h) / 2);
        if (r <= 0) {
            this.rect(x, y, w, h);
            return this;
        }
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

class RTSRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = RTS_DATA.WORLD_WIDTH;
        this.height = RTS_DATA.WORLD_HEIGHT;
        this.cameraX = 0;
        this.targetCameraX = null;
        this.screenShake = 0;

        // Fono optimizacija (Offscreen Canvas buferis)
        this.skyPadding = 220;
        this.bgCacheCanvas = document.createElement('canvas');
        this.bgCacheCanvas.width = this.width;
        this.bgCacheCanvas.height = this.skyPadding + RTS_DATA.GROUND_Y + 40;
        this.bgCacheCtx = this.bgCacheCanvas.getContext('2d');
        this.cachedEraKey = '';

        // Fono dalelės (debesys, dūmai, kibirkštys)
        this.cloudSprites = null;
        this.bgParticles = [];
        this.initBgParticles();
    }

    getZoomFactor() {
        if (typeof document !== 'undefined' && document.body) {
            if (document.body.classList.contains('mobile-mode')) return 0.83;
        }
        if (typeof window !== 'undefined' && window.matchMedia) {
            if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return 0.83;
        }
        return 1.0;
    }

    getEffectiveScale() {
        const baseScale = this.canvas.height / RTS_DATA.WORLD_HEIGHT || 1;
        return baseScale * this.getZoomFactor();
    }

    getOffsetY() {
        const scale = this.getEffectiveScale();
        return (this.canvas.height / scale) - RTS_DATA.WORLD_HEIGHT;
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = (rect.width / this.canvas.width) || 1;
        const scaleY = (rect.height / this.canvas.height) || 1;
        const canvasPixelX = (clientX - rect.left) / scaleX;
        const canvasPixelY = (clientY - rect.top) / scaleY;
        const scale = this.getEffectiveScale();
        const offsetY = this.getOffsetY();
        return {
            x: canvasPixelX / scale + this.cameraX,
            y: canvasPixelY / scale - offsetY
        };
    }

    createCloudSprites() {
        if (typeof document === 'undefined') {
            this.cloudSprites = [];
            return;
        }
        const createCloud = (type) => {
            const c = document.createElement('canvas');
            const cCtx = c.getContext('2d');
            let w = 280, h = 120, puffs = [];

            if (type === 0) { // Klasikinis purus debesis
                w = 280; h = 120;
                puffs = [
                    { x: 65, y: 75, rx: 42, ry: 32 },
                    { x: 120, y: 55, rx: 50, ry: 42 },
                    { x: 175, y: 60, rx: 46, ry: 38 },
                    { x: 220, y: 80, rx: 38, ry: 28 },
                    { x: 140, y: 85, rx: 100, ry: 26 }
                ];
            } else if (type === 1) { // Didelis tūrinis kamuolinis debesis
                w = 310; h = 145;
                puffs = [
                    { x: 70, y: 98, rx: 45, ry: 35 },
                    { x: 130, y: 72, rx: 52, ry: 45 },
                    { x: 175, y: 48, rx: 48, ry: 42 },
                    { x: 225, y: 76, rx: 45, ry: 36 },
                    { x: 265, y: 102, rx: 32, ry: 25 },
                    { x: 160, y: 108, rx: 115, ry: 28 }
                ];
            } else if (type === 2) { // Pailgas vėjo ištemptas debesis
                w = 340; h = 100;
                puffs = [
                    { x: 55, y: 68, rx: 40, ry: 25 },
                    { x: 110, y: 54, rx: 45, ry: 30 },
                    { x: 170, y: 50, rx: 50, ry: 34 },
                    { x: 230, y: 56, rx: 44, ry: 28 },
                    { x: 285, y: 68, rx: 38, ry: 24 },
                    { x: 170, y: 78, rx: 135, ry: 22 }
                ];
            } else { // Mažas lengvas debesėlis
                w = 160; h = 80;
                puffs = [
                    { x: 40, y: 52, rx: 28, ry: 22 },
                    { x: 80, y: 40, rx: 36, ry: 28 },
                    { x: 120, y: 50, rx: 28, ry: 22 },
                    { x: 80, y: 58, rx: 55, ry: 18 }
                ];
            }

            c.width = w;
            c.height = h;

            // 1. Švelnus apatinis šešėlis
            cCtx.fillStyle = 'rgba(210, 224, 240, 0.72)';
            puffs.forEach(p => {
                cCtx.beginPath();
                cCtx.ellipse(p.x, p.y + 4, p.rx + 1, p.ry + 2, 0, 0, Math.PI * 2);
                cCtx.fill();
            });

            // 2. Pagrindinis baltas pūkas
            cCtx.fillStyle = 'rgba(255, 255, 255, 0.94)';
            puffs.forEach(p => {
                cCtx.beginPath();
                cCtx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
                cCtx.fill();
            });

            // 3. Viršutinis šviesus apvadas / tūris
            cCtx.fillStyle = 'rgba(255, 255, 255, 0.98)';
            puffs.slice(0, puffs.length - 1).forEach(p => {
                cCtx.beginPath();
                cCtx.ellipse(p.x - 2, p.y - p.ry * 0.25, p.rx * 0.75, p.ry * 0.58, 0, 0, Math.PI * 2);
                cCtx.fill();
            });

            return c;
        };

        this.cloudSprites = [0, 1, 2, 3].map(createCloud);
    }

    initBgParticles() {
        if (!this.cloudSprites) {
            this.createCloudSprites();
        }
        this.bgParticles = [];
        const numSprites = (this.cloudSprites && this.cloudSprites.length) || 4;
        const cloudCount = 18;
        for (let i = 0; i < cloudCount; i++) {
            const isDeep = Math.random() < 0.5;
            this.bgParticles.push({
                x: (i / cloudCount) * (this.width + 500) - 250 + (Math.random() * 80 - 40),
                y: -40 + Math.random() * 200,
                spriteIdx: Math.floor(Math.random() * numSprites),
                scale: isDeep ? (0.45 + Math.random() * 0.25) : (0.75 + Math.random() * 0.35),
                speed: isDeep ? (4 + Math.random() * 7) : (12 + Math.random() * 10),
                opacity: isDeep ? (0.28 + Math.random() * 0.16) : (0.55 + Math.random() * 0.25)
            });
        }
    }

    resetTransform() {
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }

    setCamera(x) {
        const scale = this.getEffectiveScale();
        const safeScale = (Number.isFinite(scale) && scale > 0.01) ? scale : 1;
        const viewWidth = this.canvas.width / safeScale;
        const maxCam = Math.max(0, this.width - viewWidth);
        const targetX = Number.isFinite(x) ? x : 0;
        this.cameraX = Math.max(0, Math.min(maxCam, targetX));
        this.targetCameraX = null;
    }

    panCameraTo(x) {
        const scale = this.getEffectiveScale();
        const safeScale = (Number.isFinite(scale) && scale > 0.01) ? scale : 1;
        const viewWidth = this.canvas.width / safeScale;
        const maxCam = Math.max(0, this.width - viewWidth);
        const targetX = Number.isFinite(x) ? x : 0;
        this.targetCameraX = Math.max(0, Math.min(maxCam, targetX));
    }

    addShake(amount) {
        this.screenShake = Math.min(25, this.screenShake + amount);
    }

    // ========================================================================
    // PAGRINDINIS PIEŠIMO CIKLAS (100% BULLETPROOF APSAUGA NUO KASKADINIO GLITCH)
    // ========================================================================
    render(gameState, dt) {
        if (dt > 0) {
            this.animTime = (this.animTime || 0) + dt;
        }

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 0. VISIŠKAS TRANSFORMACIJOS ATSTATYMAS IR GRIEŽTAS DROBĖS IŠVALYMAS
        // Tai 100% apsaugo nuo bet kokio kaskadinio "veidrodžio" efekto (hall of mirrors) net įvykus klaidai ar keičiant režimą
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);

        // 0. Sklandus ir greitas kameros nuslinkimas (Smooth camera panning)
        if (this.targetCameraX !== null && this.targetCameraX !== undefined) {
            const diff = this.targetCameraX - this.cameraX;
            const safeDt = Math.min(0.1, dt || 0.016);
            if (Math.abs(diff) <= 3) {
                this.cameraX = this.targetCameraX;
                this.targetCameraX = null;
            } else {
                const moveSpeed = Math.max(1600, Math.abs(diff) * 12);
                const step = Math.sign(diff) * Math.min(Math.abs(diff), moveSpeed * safeDt);
                this.cameraX += step;
            }
        }

        const scale = this.getEffectiveScale();
        const offsetY = this.getOffsetY();
        const safeScale = (Number.isFinite(scale) && scale > 0.01) ? scale : 1;
        const safeOffsetY = Number.isFinite(offsetY) ? offsetY : 0;
        const safeCamX = Number.isFinite(this.cameraX) ? this.cameraX : 0;
        this.viewWidth = width / safeScale;
        this.camLeft = safeCamX - 140;
        this.camRight = safeCamX + this.viewWidth + 140;

        let shakeX = 0, shakeY = 0;
        if (dt > 0 && this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake = Math.max(0, this.screenShake - dt * 25);
        }

        ctx.save();
        try {
            ctx.scale(safeScale, safeScale);
            ctx.translate(-Math.round(safeCamX) + shakeX, safeOffsetY + shakeY);

            // 1. Foninė aplinka (optimizuota su Offscreen Canvas)
            this.drawEnvironment(gameState.playerEra, gameState.enemyEra, dt, gameState);

            // 1.5. Atmosferinis žaibas danguje (už kalnų, žemės, karių ir resursų UI)
            this.drawWeatherLightning(gameState);

            // 2. Žemės paviršius
            this.drawGround(gameState.playerEra, gameState.enemyEra);

            // 3. Nuosavų ir neutralių resursų zonos (Medžiai, Akmenys, Maistas, Centrinis Luitas)
            this.drawResourceZones(gameState);

            // 4. Bazės (Žaidėjo kairėje, Priešo dešinėje su augimu pagal lizdus)
            this.drawBase(gameState.playerBase, true, gameState.playerEra, RTS_DATA.PLAYER_BASE_X, gameState.playerUnlockedSlots || 1, gameState);
            this.drawBase(gameState.enemyBase, false, gameState.enemyEra, RTS_DATA.ENEMY_BASE_X, gameState.enemyUnlockedSlots || 1, gameState);
            this.drawBaseUpgradeDecorations(gameState);
            this.drawOuterWalls(gameState);

            // 5. Bokšteliai ant bazių stogo (su lizdų platformomis)
            this.drawTurrets(gameState.playerTurrets, gameState.playerUnlockedSlots || 1, true, gameState.playerEra, RTS_DATA.PLAYER_BASE_X);
            if (gameState.gameMode !== 'monsters') {
                this.drawTurrets(gameState.enemyTurrets, gameState.enemyUnlockedSlots || 1, false, gameState.enemyEra, RTS_DATA.ENEMY_BASE_X);
            }

            // 6. Darbininkai
            this.drawWorkers(gameState);

            // 7. Kariai (visi 15 kanoninių vienetų su formacija ir depth sorting)
            this.drawUnits(gameState.soldiers, dt);

            // 8. Skriejantys sviediniai
            this.drawProjectiles(gameState.projectiles);

            // 9. Dalelės ir sprogimai
            this.drawParticles(gameState.particles, dt);

            // 10. Specialieji gebėjimai (Ultimate VFX)
            this.drawUltimates(gameState.activeUltimates, dt);

            // 11. Skraidantys žalos ir atlygio tekstai
            this.drawFloatingTexts(gameState.floatingTexts, dt);

            // 12. Dienos/nakties ir orų atmosfera
            this.drawAtmosphere(gameState, dt);
        } catch (renderErr) {
            console.error('RTSRenderer render pass error (handled safely):', renderErr);
        } finally {
            ctx.restore();
            // Garantinis saugiklis: matricą visada atstatome, net jei kas nors viduje paliko atvirą save()
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // 13. Minimapas
        this.drawMinimap(gameState);
    }

    // ========================================================================
    // 1. APLINKA IR PARALLAX FONAS (OPTIMIZUOTAS SU BUFERIU)
    // ========================================================================
    buildBackgroundCache(playerEra, enemyEra) {
        const cCtx = this.bgCacheCtx;
        const w = this.width;
        const groundY = RTS_DATA.GROUND_Y;
        const skyPadding = this.skyPadding || 220;
        const bgGroundY = skyPadding + groundY;
        const totalH = this.bgCacheCanvas.height || (bgGroundY + 40);

        const pEraData = RTS_DATA.AGES[playerEra];
        const eEraData = RTS_DATA.AGES[enemyEra];

        cCtx.clearRect(0, 0, w, totalH);

        const skyGrad = cCtx.createLinearGradient(0, 0, w, 0);
        skyGrad.addColorStop(0, pEraData.skyColors[0]);
        skyGrad.addColorStop(0.5, '#4a6984');
        skyGrad.addColorStop(1, eEraData.skyColors[0]);

        cCtx.fillStyle = skyGrad;
        cCtx.fillRect(0, 0, w, totalH);

        // Tolimieji kalnai / siluetai (sėdi tiksliai ant žemės linijos bgGroundY)
        cCtx.fillStyle = 'rgba(25, 35, 45, 0.4)';
        cCtx.beginPath();
        cCtx.moveTo(0, bgGroundY);
        for (let x = 0; x <= w; x += 150) {
            const peakH = 120 + Math.sin(x * 0.005) * 80 + Math.cos(x * 0.012) * 50;
            cCtx.lineTo(x, bgGroundY - peakH);
        }
        cCtx.lineTo(w, bgGroundY);
        cCtx.closePath();
        cCtx.fill();

        // Vidurinio plano detalės (vulkanas, medžiai, pastatai sėdi tiesiai ant žemės)
        this.drawEraSceneryToCtx(cCtx, playerEra, 0, w * 0.5, bgGroundY, false);
        this.drawEraSceneryToCtx(cCtx, enemyEra, w * 0.5, w, bgGroundY, true);

        // Saulė / Mėnulis
        cCtx.save();
        cCtx.fillStyle = playerEra === 4 ? '#00ffff' : '#ffeb80';
        cCtx.shadowColor = playerEra === 4 ? '#00f2fe' : '#ffd15c';
        cCtx.shadowBlur = 30;
        cCtx.beginPath();
        cCtx.arc(w * 0.45, skyPadding + 110, playerEra === 4 ? 35 : 45, 0, Math.PI * 2);
        cCtx.fill();
        cCtx.restore();

        this.cachedEraKey = `${playerEra}_${enemyEra}`;
    }

    drawEnvironment(playerEra, enemyEra, dt, gameState = null) {
        const ctx = this.ctx;
        const w = this.width;

        const curKey = `${playerEra}_${enemyEra}`;
        if (this.cachedEraKey !== curKey) {
            this.buildBackgroundCache(playerEra, enemyEra);
        }

        // Momentinis greitas fono atvaizdavimas iš buferio (1:1 be iškraipymų ar pakėlimų)
        const skyPadding = this.skyPadding || 220;
        ctx.drawImage(this.bgCacheCanvas, 0, -skyPadding);

        const showClouds = (gameState && gameState.settings && gameState.settings.bgClouds !== false && gameState.settings.graphicsQuality !== 'low');
        if (!showClouds) return;

        // Fono tikri debesys (su paralaksu ir optimizuotais sprite'ais)
        if (!this.cloudSprites || this.cloudSprites.length === 0) {
            this.createCloudSprites();
        }

        if (this.bgParticles && this.cloudSprites && this.cloudSprites.length > 0) {
            for (const c of this.bgParticles) {
                c.x += c.speed * dt;
                const sprite = this.cloudSprites[c.spriteIdx] || this.cloudSprites[0];
                const cloudW = sprite.width * c.scale;
                const cloudH = sprite.height * c.scale;

                if (c.x > w + 250) {
                    c.x = -cloudW - 80;
                    c.y = -40 + Math.random() * 200;
                }

                // Tik matomus ekrane atvaizduojame (frustum culling)
                if (c.x + cloudW >= this.camLeft && c.x <= this.camRight) {
                    ctx.save();
                    ctx.globalAlpha = c.opacity;
                    ctx.drawImage(sprite, c.x, c.y, cloudW, cloudH);
                    ctx.restore();
                }
            }
        }
    }

    drawEraSceneryToCtx(cCtx, era, startX, endX, groundY, isEnemy = false) {
        const ctx = cCtx;
        ctx.save();

        if (era === 0) {
            ctx.fillStyle = '#4a2c1d';
            const volcX = isEnemy ? endX - 250 : startX + 250;
            ctx.beginPath();
            ctx.moveTo(volcX - 120, groundY);
            ctx.lineTo(volcX - 30, groundY - 180);
            ctx.lineTo(volcX + 30, groundY - 180);
            ctx.lineTo(volcX + 120, groundY);
            ctx.fill();

            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.ellipse(volcX, groundY - 180, 25, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2d5a27';
            for (let i = startX + 60; i < endX - 60; i += 180) {
                ctx.fillRect(i - 4, groundY - 70, 8, 70);
                ctx.beginPath();
                ctx.arc(i, groundY - 75, 30, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (era === 1) {
            ctx.fillStyle = '#41525d';
            for (let i = startX + 80; i < endX - 80; i += 220) {
                ctx.fillRect(i - 20, groundY - 130, 40, 130);
                ctx.beginPath();
                ctx.moveTo(i - 28, groundY - 130);
                ctx.lineTo(i, groundY - 170);
                ctx.lineTo(i + 28, groundY - 130);
                ctx.fill();
            }
        } else if (era === 2) {
            ctx.fillStyle = '#5c4d3c';
            for (let i = startX + 90; i < endX - 90; i += 240) {
                ctx.fillRect(i - 18, groundY - 150, 36, 150);
                ctx.beginPath();
                ctx.arc(i, groundY - 150, 22, Math.PI, 0);
                ctx.fill();
            }
        } else if (era === 3) {
            // Modernaus miesto & gamyklų foniniai siluetai su šviečiančiais langais ir antenų švyturiais
            for (let i = startX + 70; i < endX - 70; i += 200) {
                // Pastato korpusas su apšvietimu
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(i - 25, groundY - 160, 50, 160);
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(i - 25, groundY - 160, 50, 160);

                // Šviečiantys langai (šiltas gintaras ir ciano mėlyna)
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(i - 16, groundY - 142, 10, 16);
                ctx.fillRect(i + 6, groundY - 142, 10, 16);
                
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(i - 16, groundY - 110, 10, 16);
                ctx.fillRect(i + 6, groundY - 110, 10, 16);

                ctx.fillStyle = '#fef08a';
                ctx.fillRect(i - 16, groundY - 78, 10, 16);
                ctx.fillRect(i + 6, groundY - 78, 10, 16);

                // Ryšio antena ant stogo su raudonu aviacijos švyturiu
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(i, groundY - 160);
                ctx.lineTo(i, groundY - 185);
                ctx.stroke();

                ctx.fillStyle = '#ef4444';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(i, groundY - 186, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        } else if (era === 4) {
            // Ateities kiber dangoraižiai su neoninėmis linijomis
            for (let i = startX + 90; i < endX - 90; i += 250) {
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.moveTo(i - 30, groundY);
                ctx.lineTo(i - 6, groundY - 220);
                ctx.lineTo(i + 6, groundY - 220);
                ctx.lineTo(i + 30, groundY);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 1.8;
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 8;
                ctx.stroke();

                // Holografinis viršūnės švyturys
                ctx.fillStyle = '#00f2fe';
                ctx.beginPath();
                ctx.arc(i, groundY - 224, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        ctx.restore();
    }

    // ========================================================================
    // 2. ŽEMĖ IR GRUNTAS (SU ŽOLĖS KRAŠTAIS, TEKSTŪRA IR ŠEŠĖLIAIS)
    // ========================================================================
    drawGround(playerEra, enemyEra) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const groundY = RTS_DATA.GROUND_Y;
        const now = this.animTime || 0;

        // Grunto gradientas pagal epochas
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
        if (playerEra === 4) {
            groundGrad.addColorStop(0, '#0f172a');
            groundGrad.addColorStop(0.3, '#090d16');
            groundGrad.addColorStop(1, '#020617');
        } else if (playerEra === 3) {
            groundGrad.addColorStop(0, '#334155');
            groundGrad.addColorStop(0.3, '#1e293b');
            groundGrad.addColorStop(1, '#0f172a');
        } else {
            groundGrad.addColorStop(0, '#384d26');
            groundGrad.addColorStop(0.25, '#2b3b1e');
            groundGrad.addColorStop(1, '#1b2413');
        }

        ctx.fillStyle = groundGrad;
        const offsetY = this.getOffsetY();
        ctx.fillRect(0, groundY, w, (h - groundY) + offsetY + 60);

        // Viršutinė velėnos / dangos juosta
        if (playerEra === 4) {
            // Neoninė kiber danga
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(0, groundY, w, 4);
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, groundY);
            ctx.lineTo(w, groundY);
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = playerEra === 3 ? '#475569' : '#4d6935';
            ctx.fillRect(0, groundY, w, 8);

            // Žolės kuokštai
            ctx.fillStyle = '#5c8040';
            for (let x = 15; x < w; x += 45) {
                const bladeH = 4 + (x % 7);
                const sway = Math.sin(now * 3 + x * 0.1) * 2;
                ctx.beginPath();
                ctx.moveTo(x - 3, groundY + 1);
                ctx.lineTo(x + sway, groundY - bladeH);
                ctx.lineTo(x + 3, groundY + 1);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Grunto sluoksnio akmenukai / plyšiai
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        for (let x = 30; x < w; x += 70) {
            const py = groundY + 12 + (x % 35);
            ctx.beginPath();
            ctx.ellipse(x, py, 6 + (x % 5), 3, (x % 3) * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ========================================================================
    // 3. RESURSŲ ZONOS (MEDŽIAI, UOLOS, DERLIUS IR DIDŽIULIS AUKSO LUITAS)
    // ========================================================================
    drawResourceZones(gameState) {
        const ctx = this.ctx;
        const groundY = RTS_DATA.GROUND_Y;
        const now = this.animTime || 0;

        // --------------------------------------------------------------------
        // ŽAIDĖJO RESURSAI (Kairėje: X: 30..280)
        // --------------------------------------------------------------------
        const isLowWind = (gameState && gameState.settings && (gameState.settings.windEffects === false || gameState.settings.graphicsQuality === 'low'));

        // 1. Medžiai (X: 35..115)
        for (let i = 0; i < 4; i++) {
            const tx = 35 + i * 26;
            const treeWind = isLowWind ? 0 : Math.sin(now * 2.5 + i * 0.8) * 3;

            RTSSprites.drawGroundShadow(ctx, tx, groundY, 32, 10, 0.35);

            ctx.fillStyle = '#5c3a21';
            ctx.fillRect(tx - 4, groundY - 65, 8, 65);
            ctx.fillStyle = '#3e2715';
            ctx.fillRect(tx - 4, groundY - 65, 3, 65);

            ctx.save();
            ctx.translate(tx + treeWind, groundY - 78);
            ctx.fillStyle = '#1e7e34';
            ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#28a745';
            ctx.beginPath(); ctx.arc(-3, -4, 18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#34d399';
            ctx.beginPath(); ctx.arc(-5, -7, 10, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // 2. Akmenys (X: 145..195)
        for (let i = 0; i < 3; i++) {
            const rx = 145 + i * 24;
            RTSSprites.drawGroundShadow(ctx, rx, groundY, 34, 12, 0.4);

            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(rx - 16, groundY);
            ctx.lineTo(rx - 6, groundY - 38);
            ctx.lineTo(rx + 12, groundY - 34);
            ctx.lineTo(rx + 18, groundY);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.moveTo(rx - 6, groundY - 38);
            ctx.lineTo(rx + 2, groundY - 36);
            ctx.lineTo(rx + 4, groundY - 10);
            ctx.lineTo(rx - 10, groundY);
            ctx.closePath();
            ctx.fill();
        }

        // 3. Maistas (Uogų krūmai & Kviečiai X: 250..294 saugioje zonoje, atskirti nuo akmenų)
        for (let i = 0; i < 3; i++) {
            const fx = 250 + i * 22;
            const bushWind = isLowWind ? 0 : Math.sin(now * 3.2 + i * 1.2) * 2;

            RTSSprites.drawGroundShadow(ctx, fx, groundY, 28, 10, 0.35);

            ctx.fillStyle = '#15803d';
            ctx.beginPath(); ctx.arc(fx + bushWind, groundY - 20, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(fx - 3 + bushWind, groundY - 24, 11, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#ef4444';
            [-5, 4, -1, 6].forEach((ox, oIdx) => {
                const oy = [-22, -25, -15, -18][oIdx];
                ctx.beginPath();
                ctx.arc(fx + ox + bushWind, groundY + oy, 3.5, 0, Math.PI * 2);
                ctx.fill();
            });
            // Vaisių blizgesys
            ctx.fillStyle = '#fecdd3';
            [-5, 4, -1, 6].forEach((ox, oIdx) => {
                const oy = [-22, -25, -15, -18][oIdx];
                ctx.beginPath();
                ctx.arc(fx + ox + bushWind - 1, groundY + oy - 1, 1.2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // --------------------------------------------------------------------
        // PRIEŠO RESURSAI (Dešinėje: X: 2100..2380 - jei ne monstrų režimas)
        // --------------------------------------------------------------------
        if (gameState && gameState.gameMode !== 'monsters') {
            // 1. Priešo Medžiai (X: 2285..2375)
            for (let i = 0; i < 4; i++) {
                const tx = 2285 + i * 30;
                const treeWind = isLowWind ? 0 : Math.sin(now * 2.5 + i * 0.8) * 3;
                RTSSprites.drawGroundShadow(ctx, tx, groundY, 34, 10, 0.35);

                ctx.fillStyle = '#5c3a21';
                ctx.fillRect(tx - 5, groundY - 70, 10, 70);

                ctx.save();
                ctx.translate(tx + treeWind, groundY - 85);
                ctx.fillStyle = '#701a75';
                ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#a21caf';
                ctx.beginPath(); ctx.arc(-3, -4, 19, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            // 2. Priešo Akmenys (X: 2185..2241)
            for (let i = 0; i < 3; i++) {
                const rx = 2185 + i * 28;
                RTSSprites.drawGroundShadow(ctx, rx, groundY, 36, 12, 0.4);

                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.moveTo(rx - 18, groundY);
                ctx.lineTo(rx - 6, groundY - 42);
                ctx.lineTo(rx + 16, groundY - 38);
                ctx.lineTo(rx + 22, groundY);
                ctx.closePath();
                ctx.fill();
            }

            // 3. Priešo Maistas (Uogų krūmai su vaisiais X: 2100..2144, atitraukti nuo bazės)
            for (let i = 0; i < 3; i++) {
                const fx = 2100 + i * 22;
                const bushWind = isLowWind ? 0 : Math.sin(now * 3.2 + i * 1.2) * 2;
                RTSSprites.drawGroundShadow(ctx, fx, groundY, 28, 10, 0.35);

                // Pagrindinė krūmo laja (rudai vyšninis / tamsaus gintaro stilius)
                ctx.fillStyle = '#7c2d12';
                ctx.beginPath(); ctx.arc(fx + bushWind, groundY - 20, 16, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ea580c';
                ctx.beginPath(); ctx.arc(fx - 3 + bushWind, groundY - 24, 11, 0, Math.PI * 2); ctx.fill();

                // Ryškūs sultingi vaisiai / uogos
                ctx.fillStyle = '#f43f5e';
                [-5, 4, -1, 6].forEach((ox, oIdx) => {
                    const oy = [-22, -25, -15, -18][oIdx];
                    ctx.beginPath();
                    ctx.arc(fx + ox + bushWind, groundY + oy, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                });
                // Vaisių blizgesys
                ctx.fillStyle = '#fecdd3';
                [-5, 4, -1, 6].forEach((ox, oIdx) => {
                    const oy = [-22, -25, -15, -18][oIdx];
                    ctx.beginPath();
                    ctx.arc(fx + ox + bushWind - 1, groundY + oy - 1, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        // --------------------------------------------------------------------
        // 4. STATINIS DIDŽIULIS AUKSO LUITAS (X: 1200 - MASYVUS KRISTALINIS AUKSO MONOLITAS)
        // --------------------------------------------------------------------
        const cx = RTS_DATA.NEUTRAL_CACHE_X || 1200;

        // A. Minkštas žemės šešėlis ir aukso spindesio aura
        RTSSprites.drawGroundShadow(ctx, cx, groundY, 105, 22, 0.55);

        // Šilta radialinė aukso aura ant žemės
        const auraGrad = ctx.createRadialGradient(cx, groundY - 35, 10, cx, groundY - 35, 65);
        auraGrad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
        auraGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.08)');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.ellipse(cx, groundY - 35, 75, 45, 0, 0, Math.PI * 2);
        ctx.fill();

        // B. Tamsus granito / skalūno uolos pamatas su aukso gyslomis
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.moveTo(cx - 56, groundY);
        ctx.lineTo(cx - 48, groundY - 22);
        ctx.lineTo(cx - 32, groundY - 38);
        ctx.lineTo(cx - 10, groundY - 45);
        ctx.lineTo(cx + 36, groundY - 40);
        ctx.lineTo(cx + 54, groundY - 22);
        ctx.lineTo(cx + 62, groundY);
        ctx.closePath();
        ctx.fill();

        // Uolos briaunų šviesa
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.moveTo(cx - 48, groundY - 22);
        ctx.lineTo(cx - 32, groundY - 38);
        ctx.lineTo(cx - 14, groundY - 26);
        ctx.lineTo(cx - 38, groundY - 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#52525b';
        ctx.beginPath();
        ctx.moveTo(cx + 18, groundY - 36);
        ctx.lineTo(cx + 36, groundY - 40);
        ctx.lineTo(cx + 54, groundY - 22);
        ctx.lineTo(cx + 32, groundY - 18);
        ctx.closePath();
        ctx.fill();

        // Aukso gyslos, įsirėžusios į tamsią uolą
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 44, groundY - 12); ctx.lineTo(cx - 28, groundY - 24); ctx.lineTo(cx - 34, groundY - 34);
        ctx.moveTo(cx + 25, groundY - 16); ctx.lineTo(cx + 38, groundY - 28); ctx.lineTo(cx + 48, groundY - 18);
        ctx.stroke();

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 42, groundY - 13); ctx.lineTo(cx - 29, groundY - 24);
        ctx.moveTo(cx + 26, groundY - 17); ctx.lineTo(cx + 37, groundY - 27);
        ctx.stroke();

        // C. KRISTALINĖ AUKSO SPYGLIŲ IR LUITŲ KOMPOZICIJA (5 SUJUNGTI KRISTALAI)

        // 1. Galinis tamsesnis kristalas (gyliui sukurti)
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(cx - 18, groundY - 35);
        ctx.lineTo(cx - 6, groundY - 92);
        ctx.lineTo(cx + 12, groundY - 86);
        ctx.lineTo(cx + 4, groundY - 35);
        ctx.closePath();
        ctx.fill();

        // 2. Kairysis aukštas kristalo smaigalys (Left Obelisk Spire)
        // Šešėlinė pusė
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.moveTo(cx - 36, groundY - 24);
        ctx.lineTo(cx - 22, groundY - 76);
        ctx.lineTo(cx - 10, groundY - 58);
        ctx.lineTo(cx - 18, groundY - 22);
        ctx.closePath();
        ctx.fill();

        // Apšviesta pusė
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(cx - 22, groundY - 76);
        ctx.lineTo(cx - 8, groundY - 70);
        ctx.lineTo(cx - 4, groundY - 32);
        ctx.lineTo(cx - 10, groundY - 58);
        ctx.closePath();
        ctx.fill();

        // Švytinti priekinė briauna
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(cx - 22, groundY - 76);
        ctx.lineTo(cx - 12, groundY - 72);
        ctx.lineTo(cx - 10, groundY - 58);
        ctx.closePath();
        ctx.fill();

        // 3. Dešinysis aštrus kristalas (Right Gem Spire)
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(cx + 8, groundY - 32);
        ctx.lineTo(cx + 24, groundY - 74);
        ctx.lineTo(cx + 42, groundY - 42);
        ctx.lineTo(cx + 22, groundY - 22);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(cx + 12, groundY - 45);
        ctx.lineTo(cx + 24, groundY - 74);
        ctx.lineTo(cx + 34, groundY - 60);
        ctx.lineTo(cx + 20, groundY - 30);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(cx + 24, groundY - 74);
        ctx.lineTo(cx + 34, groundY - 60);
        ctx.lineTo(cx + 28, groundY - 42);
        ctx.closePath();
        ctx.fill();

        // 4. Centrinis didysis valdantysis aukso monolitinis kristalas (Main Center Monolith)
        // Kairysis šešėlinis fasadas
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(cx - 24, groundY - 32);
        ctx.lineTo(cx - 4, groundY - 96);
        ctx.lineTo(cx + 6, groundY - 62);
        ctx.lineTo(cx - 8, groundY - 24);
        ctx.closePath();
        ctx.fill();

        // Centrinis pagrindinis fasadas
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(cx - 4, groundY - 96);
        ctx.lineTo(cx + 10, groundY - 92);
        ctx.lineTo(cx + 16, groundY - 52);
        ctx.lineTo(cx + 6, groundY - 62);
        ctx.closePath();
        ctx.fill();

        // Ryškiai apšviestas dešinysis fasadas
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(cx + 10, groundY - 92);
        ctx.lineTo(cx + 18, groundY - 68);
        ctx.lineTo(cx + 16, groundY - 52);
        ctx.closePath();
        ctx.fill();

        // Viršutinis kristalinis švytintis veidas
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(cx - 4, groundY - 96);
        ctx.lineTo(cx + 4, groundY - 98);
        ctx.lineTo(cx + 10, groundY - 92);
        ctx.lineTo(cx + 2, groundY - 78);
        ctx.closePath();
        ctx.fill();

        // Poliruota šviesos briauna (Mirror Specular)
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(cx - 4, groundY - 96);
        ctx.lineTo(cx, groundY - 84);
        ctx.lineTo(cx - 2, groundY - 65);
        ctx.lineTo(cx - 6, groundY - 74);
        ctx.closePath();
        ctx.fill();

        // 5. Priekiniai mažesni kristalų luitai papėdėje
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(cx - 16, groundY - 10);
        ctx.lineTo(cx - 8, groundY - 32);
        ctx.lineTo(cx + 4, groundY - 28);
        ctx.lineTo(cx + 2, groundY - 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(cx - 8, groundY - 32);
        ctx.lineTo(cx + 2, groundY - 30);
        ctx.lineTo(cx - 2, groundY - 14);
        ctx.closePath();
        ctx.fill();

        // D. KRAŠTŲ ŽVILGESIO LINIJOS (CRISP CRYSTAL HIGHLIGHTS)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // Centrinio kristalo viršūnė
        ctx.moveTo(cx - 4, groundY - 96); ctx.lineTo(cx + 4, groundY - 98); ctx.lineTo(cx + 10, groundY - 92);
        ctx.moveTo(cx - 4, groundY - 96); ctx.lineTo(cx + 2, groundY - 78);
        // Kairiojo kristalo viršūnė
        ctx.moveTo(cx - 22, groundY - 76); ctx.lineTo(cx - 10, groundY - 58);
        // Dešiniojo kristalo viršūnė
        ctx.moveTo(cx + 24, groundY - 74); ctx.lineTo(cx + 34, groundY - 60);
        ctx.stroke();

        // E. ŽVILGANTYS AUKSO NUGGETS ANT ŽEMĖS
        const nuggets = [
            { x: cx - 44, y: groundY - 8, w: 8, h: 5 },
            { x: cx - 28, y: groundY - 6, w: 6, h: 4 },
            { x: cx + 32, y: groundY - 7, w: 9, h: 6 },
            { x: cx + 46, y: groundY - 8, w: 7, h: 5 }
        ];

        for (const n of nuggets) {
            ctx.fillStyle = '#b45309';
            ctx.beginPath();
            ctx.ellipse(n.x, n.y, n.w * 0.5, n.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.ellipse(n.x - 1, n.y - 1, n.w * 0.35, n.h * 0.35, -0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(n.x - 2, n.y - 2.5, 1.5, 1.5);
        }

        // F. ANIMUOTI ŠVIESOS ŽVAIGŽDUČIŲ BLIKSNIAI (TWINKLE STARS)
        const glints = [
            { x: cx - 2, y: groundY - 97, speed: 4.0, phase: 0 },
            { x: cx - 22, y: groundY - 76, speed: 3.5, phase: 1.8 },
            { x: cx + 24, y: groundY - 74, speed: 4.5, phase: 3.4 }
        ];

        for (const g of glints) {
            const pulse = Math.max(0, Math.sin(now * g.speed + g.phase));
            if (pulse > 0.2) {
                const gSize = 2 + pulse * 4.5;
                ctx.save();
                ctx.translate(g.x, g.y);
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#fef08a';
                ctx.shadowBlur = 10;

                // 4-kampė žvaigždutė
                ctx.beginPath();
                ctx.moveTo(-gSize, 0);
                ctx.lineTo(0, -gSize * 0.3);
                ctx.lineTo(gSize, 0);
                ctx.lineTo(0, gSize * 0.3);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(0, -gSize);
                ctx.lineTo(-gSize * 0.3, 0);
                ctx.lineTo(0, gSize);
                ctx.lineTo(gSize * 0.3, 0);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }

        // G. ELEGANTIŠKA AUKSO LUITO INFORMACINĖ LENTELĖ / BADGE
        const badgeW = 205;
        const badgeH = 22;
        const badgeY = groundY - 118;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(cx - badgeW * 0.5, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        const goldTxt = (window.RTS_I18N) ? window.RTS_I18N.t('field.gold_cache') : '💎 Aukso Luitas (+25💰 +40XP)';
        ctx.fillText(goldTxt, cx, badgeY + badgeH * 0.5);
        ctx.restore();

        // Kitų zonų užrašai
        const treesTxt = (window.RTS_I18N) ? window.RTS_I18N.t('field.trees') : '🌲 Medžiai';
        const stonesTxt = (window.RTS_I18N) ? window.RTS_I18N.t('field.stones') : '⛏️ Akmenys';
        const foodTxt = (window.RTS_I18N) ? window.RTS_I18N.t('field.food') : '🌾 Maistas';

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(treesTxt, 74, groundY - 105);
        ctx.fillText(stonesTxt, 168, groundY - 52);
        ctx.fillText(foodTxt, 272, groundY - 46);

        if (gameState && gameState.gameMode !== 'monsters') {
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(foodTxt, 2122, groundY - 46);
            ctx.fillText(stonesTxt, 2213, groundY - 52);
            ctx.fillText(treesTxt, 2330, groundY - 118);
        }

    }

    // ========================================================================
    // 4. BAZĖS IR PILYS (VISOS EPOCHOS SU TIKRAIS BOKŠTAIS IR INTEGRUOTAIS LIZDAIS)
    // ========================================================================
    drawBase(base, isPlayer, era, baseX, unlockedSlots = 1, gameState = null) {
        const ctx = this.ctx;
        const x = baseX;
        const groundY = RTS_DATA.GROUND_Y;
        const bw = RTS_DATA.PLAYER_BASE_WIDTH;
        const bh = RTS_DATA.PLAYER_BASE_HEIGHT;
        const by = groundY - bh;
        const hpPercent = base.maxHp >= 999999 ? 1.0 : Math.max(0, base.hp / base.maxHp);
        const now = this.animTime || 0;
        const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');

        ctx.save();

        // --------------------------------------------------------------------
        // MONSTRŲ REŽIMAS: TAMSOS PORTALAS (VOID RIFT VARTAI)
        // --------------------------------------------------------------------
        if (!isPlayer && gameState && gameState.gameMode === 'monsters') {
            const px = x + 65;
            const py = groundY - 110;

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(px - 55, groundY);
            ctx.lineTo(px - 45, py - 60);
            ctx.lineTo(px - 30, py - 95);
            ctx.lineTo(px - 22, py - 90);
            ctx.lineTo(px - 35, groundY);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(px + 55, groundY);
            ctx.lineTo(px + 45, py - 60);
            ctx.lineTo(px + 30, py - 95);
            ctx.lineTo(px + 22, py - 90);
            ctx.lineTo(px + 35, groundY);
            ctx.fill();

            ctx.fillStyle = '#9333ea';
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.moveTo(px - 20, py - 100);
            ctx.lineTo(px, py - 125);
            ctx.lineTo(px + 20, py - 100);
            ctx.lineTo(px, py - 85);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(88, 28, 135, 0.75)';
            ctx.beginPath();
            ctx.ellipse(px, py, 46 + Math.sin(now * 4) * 4, 95 + Math.cos(now * 4) * 6, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#090514';
            ctx.beginPath();
            ctx.ellipse(px, py, 34, 78, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.ellipse(px, py, 16 + Math.sin(now * 6) * 6, 52 + Math.cos(now * 6) * 10, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#c084fc';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.fillText(isEn ? '🌌 Dark Portal' : '🌌 Tamsos Portalas', px, py - 135);

            ctx.restore();
            return;
        }

        // --------------------------------------------------------------------
        // CIVILIZACIJOS ŠAKOS
        // --------------------------------------------------------------------
        const branch = isPlayer 
            ? (gameState.playerBranch || (era === 1 ? 'chivalry' : (era === 2 ? 'fleet' : (era === 3 ? 'mechanized' : (era === 4 ? 'cyber_mecha' : null)))))
            : (gameState.enemyBranch || (era === 1 ? 'dynasty' : (era === 2 ? 'alchemy' : (era === 3 ? 'spec_ops' : (era === 4 ? 'bio_swarm' : null)))));

        // Bazės natūralus nusėdimas / griūtis sunaikinus
        if (gameState && gameState.baseCollapsePending && gameState.baseCollapsePending.isPlayer === isPlayer) {
            const prog = Math.min(1.0, gameState.baseCollapsePending.timer / gameState.baseCollapsePending.duration);
            const sinkY = prog * 48;
            const shudder = Math.sin(now * 25) * Math.max(0, 1 - prog) * 1.5;
            ctx.translate(shudder, sinkY);
        }

        // --------------------------------------------------------------------
        // EPOCHOS BAZIŲ ARCHITEKTŪRA SU VISIŠKAI INTEGRUOTAIS BOKŠTAIS
        // (PRIEŠO BAZĖ TURI ATSKIRAS UNIKALIAS AGRESYVIAS SPALVAS IR ŠVIESAS)
        // --------------------------------------------------------------------
        // VISIŠKAI NEPERMATOMAS BAZĖS KORPUSAS (Užtikrina, kad jokia bazė jokioje epochoje nepersišviestų)
        ctx.fillStyle = isPlayer ? '#18181b' : '#0c0a09';
        ctx.fillRect(x + 2, by + 10, bw - 4, bh - 10);

        if (era === 0) {
            // ================================================================
            // 🦴 AKMENS AMŽIUS: PREISTORINIS UOLOS KALNAS SU 4 INTEGRUOTOMIS TERASOMIS
            // ================================================================
            const highX = isPlayer ? x + 20 : x + bw - 56;
            const midX = isPlayer ? x + 60 : x + bw - 92;
            const frontX = isPlayer ? x + bw - 38 : x + 6;
            const rearX = isPlayer ? x + 2 : x + bw - 36;

            // 1. Pagrindinis uolos masyvas
            ctx.fillStyle = isPlayer ? '#4a3525' : '#2b1b10';
            ctx.fillRect(x + 4, by + 12, bw - 8, bh - 12);

            // 4 Uolos terasų pilonai po kiekvienu lizdu
            ctx.fillStyle = isPlayer ? '#5c3a21' : '#3d2516';
            ctx.fillRect(highX, by - 18, 36, bh + 18);  // Aukštasis bokštas (Slot 2)
            ctx.fillRect(midX, by + 14, 34, bh - 14);   // Vidurinis bokštas (Slot 1)
            ctx.fillRect(frontX, by + 44, 34, bh - 44); // Priekinis bokštas (Slot 0)
            ctx.fillRect(rearX, by + 48, 34, bh - 48);  // Galinis bokštas (Slot 3)

            // Uolos briaunų šviesos ir reljefas
            ctx.fillStyle = isPlayer ? '#784e2d' : '#4d301e';
            ctx.beginPath();
            ctx.moveTo(highX, by - 18);
            ctx.lineTo(highX + 36, by - 18);
            ctx.lineTo(highX + 26, by + 25);
            ctx.lineTo(highX - 4, by + 25);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(midX, by + 14);
            ctx.lineTo(midX + 34, by + 14);
            ctx.lineTo(midX + 24, by + 55);
            ctx.lineTo(midX - 4, by + 55);
            ctx.closePath();
            ctx.fill();

            // Mamuto ilčių arka virš vartų
            ctx.strokeStyle = isPlayer ? '#fef3c7' : '#e2e8f0';
            ctx.lineWidth = 6;
            ctx.beginPath();
            const tuskX = isPlayer ? x + bw - 22 : x + 22;
            if (isPlayer) {
                ctx.moveTo(tuskX - 30, groundY);
                ctx.quadraticCurveTo(tuskX - 8, groundY - 68, tuskX + 16, groundY - 45);
            } else {
                ctx.moveTo(tuskX + 30, groundY);
                ctx.quadraticCurveTo(tuskX + 8, groundY - 68, tuskX - 16, groundY - 45);
            }
            ctx.stroke();

            // Urvo durų anga
            const doorX = isPlayer ? x + bw - 38 : x + 8;
            ctx.fillStyle = '#0f0a07';
            ctx.beginPath();
            ctx.arc(doorX + 15, groundY - 30, 20, Math.PI, 0);
            ctx.rect(doorX - 5, groundY - 30, 40, 30);
            ctx.fill();

            // Laužavietė prie durų (Žaidėjui: gintarinė liepsna, Priešui: kraujo raudonumo liepsna)
            ctx.fillStyle = isPlayer ? '#ea580c' : '#dc2626';
            ctx.shadowColor = isPlayer ? '#f97316' : '#ef4444';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(isPlayer ? doorX - 10 : doorX + 40, groundY - 8, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

        } else if (era === 1) {
            if (branch === 'dynasty') {
                // ============================================================
                // 🏯 RYTŲ DINASTIJA: RAUDONMEDŽIO PAGODA (PRIEŠUI: JUODO TAMSOS OBSIDIANO PAGODA)
                // ============================================================
                // Pagrindinis korpusas
                ctx.fillStyle = isPlayer ? '#7f1d1d' : '#1c1917';
                ctx.fillRect(x + 6, by + 18, bw - 12, bh - 18);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 62 : x + bw - 94;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 34;

                ctx.fillStyle = isPlayer ? '#991b1b' : '#292524';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 16, 32, bh - 16);
                ctx.fillRect(frontX, by + 44, 32, bh - 44);
                ctx.fillRect(rearX, by + 48, 32, bh - 48);

                // Čerpių stogai
                const roofs = [
                    { x: highX - 6, y: by - 18, w: 48 },
                    { x: midX - 6, y: by + 16, w: 44 },
                    { x: frontX - 6, y: by + 44, w: 44 },
                    { x: rearX - 6, y: by + 48, w: 44 }
                ];

                for (const rf of roofs) {
                    ctx.fillStyle = isPlayer ? '#18181b' : '#09090b';
                    ctx.beginPath();
                    ctx.moveTo(rf.x - 4, rf.y + 10);
                    ctx.quadraticCurveTo(rf.x + rf.w * 0.5, rf.y - 4, rf.x + rf.w + 4, rf.y + 10);
                    ctx.lineTo(rf.x + rf.w, rf.y + 4);
                    ctx.quadraticCurveTo(rf.x + rf.w * 0.5, rf.y - 8, rf.x, rf.y + 4);
                    ctx.closePath();
                    ctx.fill();

                    ctx.strokeStyle = isPlayer ? '#fbbf24' : '#ef4444';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // Žibintai
                ctx.fillStyle = isPlayer ? '#ef4444' : '#a855f7';
                ctx.shadowColor = isPlayer ? '#f87171' : '#c084fc';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(isPlayer ? x + bw - 15 : x + 15, by + 75, 7, 0, Math.PI * 2);
                ctx.arc(isPlayer ? x + 25 : x + bw - 25, by + 75, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Vartai
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#0c0a09';
                ctx.fillRect(doorX, groundY - 60, 30, 60);
                ctx.fillStyle = isPlayer ? '#d97706' : '#7f1d1d';
                ctx.fillRect(doorX + 2, groundY - 58, 12, 56);
                ctx.fillRect(doorX + 16, groundY - 58, 12, 56);

            } else {
                // ============================================================
                // 🏰 EUROPOS RITERYSTĖ: AKMENINĖ PILIS (PRIEŠUI: TAMSUS ŠARVUOTAS DONŽONAS)
                // ============================================================
                ctx.fillStyle = isPlayer ? '#64748b' : '#1e293b';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const keepX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#475569' : '#0f172a';
                ctx.fillRect(keepX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                // Parapetai
                ctx.fillStyle = isPlayer ? '#334155' : '#450a0a';
                for (let mx = keepX; mx < keepX + 36; mx += 9) ctx.fillRect(mx, by - 24, 6, 7);
                for (let mx = midX; mx < midX + 34; mx += 9) ctx.fillRect(mx, by + 8, 6, 7);
                for (let mx = frontX; mx < frontX + 34; mx += 9) ctx.fillRect(mx, by + 38, 6, 7);
                for (let mx = rearX; mx < rearX + 34; mx += 9) ctx.fillRect(mx, by + 42, 6, 7);

                // Mūro linijos
                ctx.fillStyle = isPlayer ? '#334155' : '#090d16';
                for (let row = 0; row < 5; row++) {
                    const ry = by + 35 + row * 24;
                    const rOff = (row % 2) * 16;
                    for (let cx = x + 12 + rOff; cx < x + bw - 18; cx += 32) {
                        ctx.fillRect(cx, ry, 24, 2);
                    }
                }

                // Vartai
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#090d16';
                ctx.fillRect(doorX, groundY - 65, 30, 65);
                ctx.strokeStyle = isPlayer ? '#94a3b8' : '#ef4444';
                ctx.lineWidth = 2;
                for (let gx = doorX + 4; gx < doorX + 30; gx += 7) {
                    ctx.beginPath(); ctx.moveTo(gx, groundY - 65); ctx.lineTo(gx, groundY); ctx.stroke();
                }
                for (let gy = groundY - 55; gy < groundY; gy += 14) {
                    ctx.beginPath(); ctx.moveTo(doorX, gy); ctx.lineTo(doorX + 30, gy); ctx.stroke();
                }

                // Vėliava
                ctx.fillStyle = isPlayer ? '#2563eb' : '#dc2626';
                ctx.beginPath();
                ctx.moveTo(keepX + 18, by - 24);
                ctx.lineTo(isPlayer ? keepX + 48 : keepX - 12, by - 36);
                ctx.lineTo(keepX + 18, by - 48);
                ctx.closePath();
                ctx.fill();
            }

        } else if (era === 2) {
            if (branch === 'alchemy') {
                // ============================================================
                // ⚙️ ALCHEMIJOS GILDIJA (PRIEŠUI: NUODINGA VIOLETINĖ LABORATORIJA)
                // ============================================================
                ctx.fillStyle = isPlayer ? '#3f3f46' : '#27272a';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#52525b' : '#18181b';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                // Kupolai
                ctx.fillStyle = isPlayer ? '#b45309' : '#831843';
                ctx.beginPath(); ctx.arc(highX + 18, by - 16, 18, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(midX + 17, by + 16, 17, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(frontX + 17, by + 46, 17, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(rearX + 17, by + 50, 17, Math.PI, 0); ctx.fill();

                // Eliksyro kolba (Žaidėjui: žalia, Priešui: violetinė / kraujo raudona)
                ctx.fillStyle = isPlayer ? 'rgba(16, 185, 129, 0.85)' : 'rgba(168, 85, 247, 0.85)';
                ctx.shadowColor = isPlayer ? '#10b981' : '#c084fc';
                ctx.shadowBlur = 18;
                ctx.beginPath();
                ctx.arc(x + bw * 0.5, by + 75, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Vamzdžiai
                ctx.strokeStyle = isPlayer ? '#d97706' : '#a21caf';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(x + bw * 0.5, by + 55);
                ctx.lineTo(x + bw * 0.5, by);
                ctx.lineTo(isPlayer ? x + bw - 20 : x + 20, by);
                ctx.stroke();

                // Vartai
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#18181b';
                ctx.fillRect(doorX, groundY - 60, 30, 60);
                ctx.fillStyle = isPlayer ? '#78350f' : '#4c0519';
                ctx.fillRect(doorX + 2, groundY - 58, 26, 56);

            } else {
                // ============================================================
                // ⚓ IMPERIJOS LAIVYNAS (PRIEŠUI: KORSARŲ KRUVIZINIO LAIVYNO BASTIONAS)
                // ============================================================
                ctx.fillStyle = isPlayer ? '#78350f' : '#451a03';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#e2e8f0' : '#334155';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                ctx.fillStyle = isPlayer ? '#0284c7' : '#dc2626';
                ctx.fillRect(highX + 2, by - 16, 32, 6);
                ctx.fillRect(midX + 2, by + 16, 30, 6);
                ctx.fillRect(frontX + 2, by + 46, 30, 6);
                ctx.fillRect(rearX + 2, by + 50, 30, 6);

                // Inkaras
                ctx.strokeStyle = isPlayer ? '#38bdf8' : '#f87171';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x + bw * 0.5, by + 75, 12, 0, Math.PI);
                ctx.moveTo(x + bw * 0.5, by + 60);
                ctx.lineTo(x + bw * 0.5, by + 90);
                ctx.stroke();

                // Vartai
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(doorX, groundY - 60, 30, 60);
                ctx.fillStyle = isPlayer ? '#0284c7' : '#991b1b';
                ctx.fillRect(doorX + 2, groundY - 58, 26, 56);
            }

        } else if (era === 3) {
            if (branch === 'spec_ops') {
                // ============================================================
                // ⚡ SPECIALIOSIOS PAJĖGOS (PRIEŠUI: RAUDONO LAZERIO STEALTH BŪSTINĖ)
                // ============================================================
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#1e293b' : '#18181b';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                ctx.strokeStyle = isPlayer ? '#a855f7' : '#ef4444';
                ctx.lineWidth = 1.5;
                for (const px of [highX, midX, frontX, rearX]) {
                    ctx.strokeRect(px + 2, by - 14, 30, bh + 14);
                }

                // Radaras (Žaidėjui: neoninis violetinis/mėlynas, Priešui: raudonas lazeris)
                ctx.fillStyle = isPlayer ? '#a855f7' : '#ef4444';
                ctx.shadowColor = isPlayer ? '#c084fc' : '#f87171';
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(x + bw * 0.5, by + 68, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Durys
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#020617';
                ctx.fillRect(doorX, groundY - 60, 30, 60);
                ctx.fillStyle = isPlayer ? '#38bdf8' : '#dc2626';
                ctx.fillRect(doorX + 4, groundY - 56, 22, 52);

            } else {
                // ============================================================
                // 🪖 KARO PRAMONĖ (PRIEŠUI: JUODO GELŽBETONIO BUNKERIS SU RAUDONU ĮSPĖJIMU)
                // ============================================================
                ctx.fillStyle = isPlayer ? '#475569' : '#1e293b';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#334155' : '#0f172a';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                // Įspėjamosios juostos
                const platforms = [
                    { x: highX, y: by - 18, w: 36 },
                    { x: midX, y: by + 14, w: 34 },
                    { x: frontX, y: by + 44, w: 34 },
                    { x: rearX, y: by + 48, w: 34 }
                ];
                for (const p of platforms) {
                    ctx.fillStyle = isPlayer ? '#eab308' : '#dc2626';
                    ctx.fillRect(p.x, p.y + 2, p.w, 6);
                    ctx.fillStyle = '#18181b';
                    for (let hx = p.x; hx < p.x + p.w - 4; hx += 8) {
                        ctx.fillRect(hx, p.y + 2, 4, 6);
                    }
                }

                // Durys
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#18181b';
                ctx.fillRect(doorX, groundY - 60, 30, 60);
                ctx.fillStyle = isPlayer ? '#71717a' : '#450a0a';
                ctx.fillRect(doorX + 2, groundY - 58, 26, 56);
            }

        } else if (era === 4) {
            if (branch === 'bio_swarm') {
                // ============================================================
                // 🧬 BIO-MUTANTAI (PRIEŠUI: KRAUJO RAUDONUMO AVILYS SU VIOLETINE LIEPSNA)
                // ============================================================
                ctx.fillStyle = isPlayer ? '#14250a' : '#2e0818';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#224411' : '#4c0519';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                // Chitino kiaušiniai
                ctx.fillStyle = isPlayer ? '#65a30d' : '#e11d48';
                ctx.shadowColor = isPlayer ? '#84cc16' : '#f43f5e';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.ellipse(x + bw * 0.5, by + 68, 16, 22, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Durys
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#051003';
                ctx.beginPath();
                ctx.arc(doorX + 15, groundY - 25, 18, Math.PI, 0);
                ctx.rect(doorX - 3, groundY - 25, 36, 25);
                ctx.fill();

            } else {
                // ============================================================
                // 🤖 KIBER-TITANAI (ŽAIDĖJUI: NEONINIS CIANAS, PRIEŠUI: PLAZMINIS RAUDONAS)
                // ============================================================
                ctx.fillStyle = isPlayer ? '#0c1929' : '#1f0910';
                ctx.fillRect(x + 8, by + 20, bw - 16, bh - 20);

                const highX = isPlayer ? x + 20 : x + bw - 56;
                const midX = isPlayer ? x + 60 : x + bw - 92;
                const frontX = isPlayer ? x + bw - 38 : x + 6;
                const rearX = isPlayer ? x + 2 : x + bw - 36;

                ctx.fillStyle = isPlayer ? '#0284c7' : '#991b1b';
                ctx.fillRect(highX, by - 18, 36, bh + 18);
                ctx.fillRect(midX, by + 14, 34, bh - 14);
                ctx.fillRect(frontX, by + 44, 34, bh - 44);
                ctx.fillRect(rearX, by + 48, 34, bh - 48);

                // Neoninis šerdis (Žaidėjui: Cyan #00ffff, Priešui: Plasma Red #ff0055)
                ctx.fillStyle = isPlayer ? '#00ffff' : '#ff0055';
                ctx.shadowColor = isPlayer ? '#00f2fe' : '#ff0055';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(x + bw * 0.5, by + 68, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Durys
                const doorX = isPlayer ? x + bw - 38 : x + 8;
                ctx.fillStyle = '#020617';
                ctx.fillRect(doorX, groundY - 60, 30, 60);
                ctx.fillStyle = isPlayer ? '#00f2fe' : '#ff0055';
                ctx.fillRect(doorX + 4, groundY - 56, 22, 52);
            }
        }

        // --------------------------------------------------------------------
        // APSAUGINIS SKYDAS PO REKLAMOS (REVIVE SHIELD FORCEFIELD)
        // --------------------------------------------------------------------
        if (isPlayer && gameState && gameState.playerBase && gameState.playerBase.shieldTimer > 0) {
            const alpha = Math.min(0.6, gameState.playerBase.shieldTimer / 2);
            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha + 0.35})`;
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.22})`;
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 22;
            ctx.beginPath();
            ctx.arc(x + bw * 0.5, groundY - bh * 0.5, Math.max(bw, bh) * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // --------------------------------------------------------------------
        // IN-WORLD EVOLIUCIJOS HERBAI VIRŠ PILIES (ŠVARUS DIZAINAS + TOOLTIP TIK UŽVEDUS PELĘ)
        // --------------------------------------------------------------------
        if (isPlayer && era < 4 && gameState) {
            const nextEra = era + 1;
            const cost = RTS_DATA.AGES[era] ? RTS_DATA.AGES[era].evolveCost : null;
            const res = gameState.playerResources;
            const canEvolve = cost && (gameState.gameMode === 'sandbox' || (gameState.playerXp >= cost.xp && res.wood >= cost.wood && res.stone >= cost.stone && res.food >= cost.food));
            const branches = (canEvolve && RTS_DATA.BRANCHES && RTS_DATA.BRANCHES[nextEra]) ? RTS_DATA.BRANCHES[nextEra] : null;
            const isMobileEvo = (typeof document !== 'undefined') && (document.body.classList.contains('mobile-mode') || (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches));
            if (canEvolve && branches && branches.length >= 2) {
                const isStaticEvo = (gameState.settings && (gameState.settings.castleEvoBeam === false || gameState.settings.graphicsQuality === 'low' || gameState.settings.uiGlow === false));
                const isLowGfx = isStaticEvo;
                const floatY = isStaticEvo ? 0 : Math.sin(now * 3.5) * 5;
                const b0 = branches[0];
                const b1 = branches[1];
                const isGameActive = gameState && gameState.state === 'PLAYING' && !gameState.isPaused;
                const hoveredIdx = isGameActive ? gameState.hoveredEvoBranch : null;

                // 1. Šviesos stulpas iš pilies viršūnės į dangų (tik kai įjungti efektai)
                if (!isStaticEvo) {
                    const beamGrad = ctx.createLinearGradient(x + bw * 0.5, groundY - bh, x + bw * 0.5, 40);
                    beamGrad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
                    beamGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.15)');
                    beamGrad.addColorStop(1, 'transparent');
                    ctx.fillStyle = beamGrad;
                    ctx.fillRect(x + 20, 40, bw - 40, groundY - bh - 40);
                }

                // 2. Viršutinė informacinė juosta
                const bannerW = isMobileEvo ? 320 : 240;
                const bannerH = isMobileEvo ? 30 : 22;
                const bannerX = x + bw * 0.5 - bannerW * 0.5;
                const bannerY = (isMobileEvo ? 18 : 28) + floatY;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = isMobileEvo ? 2.2 : 1.5;
                if (!isStaticEvo) {
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = isMobileEvo ? 16 : 10;
                }
                ctx.beginPath();
                ctx.roundRect(bannerX, bannerY, bannerW, bannerH, isMobileEvo ? 9 : 6);
                ctx.fill();
                ctx.stroke();
                if (!isStaticEvo) ctx.shadowBlur = 0;

                ctx.fillStyle = '#fbbf24';
                ctx.font = isMobileEvo ? 'bold 13px sans-serif' : 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const bannerText = isEn 
                    ? (isMobileEvo ? '⚡ TAP BRANCH TO EVOLVE ⚡' : '⚡ CHOOSE CIVILIZATION PATH ⚡')
                    : (isMobileEvo ? '⚡ BAKSTELĖKITE ŠAKĄ EVOLIUCIJAI ⚡' : '⚡ PASIRINK CIVILIZACIJOS KELIĄ ⚡');
                ctx.fillText(bannerText, x + bw * 0.5, bannerY + bannerH * 0.5);

                // 3. Kairysis Herbas (Šaka 0)
                const isHover0 = (hoveredIdx === 0);
                const scale0 = isHover0 ? 1.06 : 1.0;
                const baseCardW = isMobileEvo ? 165 : 118;
                const baseCardH = isMobileEvo ? 105 : 72;
                const card0W = baseCardW * scale0;
                const card0H = baseCardH * scale0;
                const card0X = (isMobileEvo ? (x + bw * 0.5 - baseCardW - 12) : 255) - (card0W - baseCardW) * 0.5;
                const card0Y = (isMobileEvo ? 56 : 64) + floatY - (card0H - baseCardH) * 0.5;

                // Fonas
                ctx.fillStyle = isHover0 ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.90)';
                ctx.strokeStyle = b0.themeColor || '#38bdf8';
                ctx.lineWidth = isHover0 ? 3.5 : (isMobileEvo ? 2.5 : 1.8);
                if (!isStaticEvo) {
                    ctx.shadowColor = b0.themeColor || '#38bdf8';
                    ctx.shadowBlur = isHover0 ? 24 : (isMobileEvo ? 16 : 8);
                }
                ctx.beginPath();
                ctx.roundRect(card0X, card0Y, card0W, card0H, isMobileEvo ? 14 : 10);
                ctx.fill();
                ctx.stroke();
                if (!isStaticEvo) ctx.shadowBlur = 0;

                // Didelė epochos ikona
                ctx.font = isMobileEvo ? (isHover0 ? '48px sans-serif' : '44px sans-serif') : (isHover0 ? '34px sans-serif' : '30px sans-serif');
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const iconY0 = isMobileEvo ? (card0Y + 39 * scale0) : (card0Y + 28 * scale0);
                ctx.fillText(b0.icon, card0X + card0W * 0.5, iconY0);

                // Pavadinimas su klavišo žyma [Q] kompiuteriams, švarus telefonams
                const b0Name = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchName(b0.id) : b0.name;
                const b0Subtitle = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchSubtitle(b0.id) : b0.subtitle;
                ctx.fillStyle = b0.themeColor || '#38bdf8';
                ctx.font = isMobileEvo ? 'bold 13.5px sans-serif' : 'bold 11px sans-serif';
                const textY0 = isMobileEvo ? (card0Y + 74 * scale0) : (card0Y + 54 * scale0);
                ctx.fillText(isMobileEvo ? b0Name : `[Q] ${b0Name}`, card0X + card0W * 0.5, textY0);

                // Subtitras telefone (kadangi telefone nėra pelės užvedimo/tooltip)
                if (isMobileEvo && b0Subtitle) {
                    ctx.fillStyle = '#fde047';
                    ctx.font = 'bold 10.5px sans-serif';
                    ctx.fillText(`⚡ ${b0Subtitle}`, card0X + card0W * 0.5, card0Y + 91 * scale0);
                }

                // 4. Dešinysis Herbas (Šaka 1)
                const isHover1 = (hoveredIdx === 1);
                const scale1 = isHover1 ? 1.06 : 1.0;
                const card1W = baseCardW * scale1;
                const card1H = baseCardH * scale1;
                const card1X = (isMobileEvo ? (x + bw * 0.5 + 12) : 415) - (card1W - baseCardW) * 0.5;
                const card1Y = (isMobileEvo ? 56 : 64) + floatY - (card1H - baseCardH) * 0.5;

                ctx.fillStyle = isHover1 ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.90)';
                ctx.strokeStyle = b1.themeColor || '#ef4444';
                ctx.lineWidth = isHover1 ? 3.5 : (isMobileEvo ? 2.5 : 1.8);
                if (!isStaticEvo) {
                    ctx.shadowColor = b1.themeColor || '#ef4444';
                    ctx.shadowBlur = isHover1 ? 24 : (isMobileEvo ? 16 : 8);
                }
                ctx.beginPath();
                ctx.roundRect(card1X, card1Y, card1W, card1H, isMobileEvo ? 14 : 10);
                ctx.fill();
                ctx.stroke();
                if (!isStaticEvo) ctx.shadowBlur = 0;

                ctx.font = isMobileEvo ? (isHover1 ? '48px sans-serif' : '44px sans-serif') : (isHover1 ? '34px sans-serif' : '30px sans-serif');
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const iconY1 = isMobileEvo ? (card1Y + 39 * scale1) : (card1Y + 28 * scale1);
                ctx.fillText(b1.icon, card1X + card1W * 0.5, iconY1);

                const b1Name = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchName(b1.id) : b1.name;
                const b1Subtitle = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchSubtitle(b1.id) : b1.subtitle;
                ctx.fillStyle = b1.themeColor || '#ef4444';
                ctx.font = isMobileEvo ? 'bold 13.5px sans-serif' : 'bold 11px sans-serif';
                const textY1 = isMobileEvo ? (card1Y + 74 * scale1) : (card1Y + 54 * scale1);
                ctx.fillText(isMobileEvo ? b1Name : `[E] ${b1Name}`, card1X + card1W * 0.5, textY1);

                if (isMobileEvo && b1Subtitle) {
                    ctx.fillStyle = '#fde047';
                    ctx.font = 'bold 10.5px sans-serif';
                    ctx.fillText(`⚡ ${b1Subtitle}`, card1X + card1W * 0.5, card1Y + 91 * scale1);
                }

                // 5. TRUMPAS & ŠVARUS INFORMACINIS LANGELIS (TILPS 100% BE PERTEKLIAUS)
                if (isHover0 || isHover1) {
                    const hBranch = isHover0 ? b0 : b1;
                    const hColor = hBranch.themeColor || '#38bdf8';
                    const hotkeyTag = isHover0 ? '[Q]' : '[E]';
                    const tipW = 220;
                    const tipH = 62;
                    const tipX = isHover0 ? (card0X + card0W * 0.5 - tipW * 0.5) : (card1X + card1W * 0.5 - tipW * 0.5);
                    const tipY = Math.max(8, card0Y - tipH - 8);

                    const hName = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchName(hBranch.id) : hBranch.name;
                    const hSubtitle = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchSubtitle(hBranch.id) : hBranch.subtitle;
                    const hBadges = (typeof RTS_I18N !== 'undefined') ? RTS_I18N.getBranchBadges(hBranch.id) : (hBranch.badges || []);
                    const fallbackBadges = isEn ? 'New Units & Castle Power' : 'Nauji Kariai & Gynybos Galia';

                    ctx.save();
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
                    ctx.strokeStyle = hColor;
                    ctx.lineWidth = 1.8;
                    ctx.shadowColor = hColor;
                    ctx.shadowBlur = 14;
                    ctx.beginPath();
                    ctx.roundRect(tipX, tipY, tipW, tipH, 8);
                    ctx.fill();
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // 1 Eilutė: Pavadinimas su klavišu
                    ctx.fillStyle = hColor;
                    ctx.font = 'bold 12px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(`${hBranch.icon} ${hName} ${hotkeyTag}`, tipX + 10, tipY + 8);

                    // 2 Eilutė: Specializacija / Subtitras
                    ctx.fillStyle = '#fde047';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillText(`⚡ ${hSubtitle}`, tipX + 10, tipY + 26);

                    // 3 Eilutė: Pagrindinis bonusas
                    const topBadges = (hBadges || []).slice(0, 2).join(' • ');
                    ctx.fillStyle = '#cbd5e1';
                    ctx.font = '9.5px sans-serif';
                    ctx.fillText(`✨ ${topBadges || fallbackBadges}`, tipX + 10, tipY + 43);

                    ctx.restore();
                }
            }
        }

        // --------------------------------------------------------------------
        // DINAMINIS BAZĖS PAŽEIDIMAS (ĮTRŪKIMAI, DŪMAI, UGNIS PAGAL GYVYBES)
        // --------------------------------------------------------------------
        if (hpPercent < 0.75) {
            ctx.save();
            // 1. Mūro įtrūkimai (Cracks)
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(x + 25, by + 40);
            ctx.lineTo(x + 38, by + 58);
            ctx.lineTo(x + 32, by + 75);
            ctx.lineTo(x + 48, by + 95);

            ctx.moveTo(x + bw - 35, by + 35);
            ctx.lineTo(x + bw - 45, by + 55);
            ctx.lineTo(x + bw - 38, by + 80);
            ctx.stroke();

            if (hpPercent < 0.40) {
                ctx.beginPath();
                ctx.moveTo(x + bw * 0.5 - 15, by + 30);
                ctx.lineTo(x + bw * 0.5 - 5, by + 55);
                ctx.lineTo(x + bw * 0.5 + 10, by + 75);
                ctx.stroke();
            }

            // 2. Kylančių dūmų stulpai (Smoke Plumes)
            if (hpPercent < 0.60) {
                const smokeAlpha = 0.55 + Math.sin(now * 3) * 0.15;
                ctx.fillStyle = `rgba(51, 65, 85, ${smokeAlpha})`;
                const s1Y = by + 20 - ((now * 25) % 45);
                const s2Y = by + 35 - (((now + 0.5) * 25) % 45);
                ctx.beginPath();
                ctx.arc(x + 35, s1Y, 12 + ((now * 15) % 10), 0, Math.PI * 2);
                ctx.arc(x + bw - 40, s2Y, 14 + ((now * 15) % 10), 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. Degančios liepsnos (Flickering Fires)
            if (hpPercent < 0.45) {
                const f1H = 14 + Math.sin(now * 16) * 5;
                const f2H = 16 + Math.cos(now * 14) * 6;
                ctx.fillStyle = '#f97316';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 12;
                // Liepsna 1
                ctx.beginPath();
                ctx.moveTo(x + 30, by + 25);
                ctx.quadraticCurveTo(x + 35, by + 25 - f1H, x + 40, by + 25);
                ctx.fill();
                // Liepsna 2
                ctx.beginPath();
                ctx.moveTo(x + bw - 45, by + 35);
                ctx.quadraticCurveTo(x + bw - 38, by + 35 - f2H, x + bw - 30, by + 35);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        }

        // --------------------------------------------------------------------
        // BAZĖS GYVYBIŲ JUOSTA IR INFORMACINIS SKYDELIS (BASE HP BAR)
        // --------------------------------------------------------------------
        if (base && base.maxHp > 0) {
            ctx.save();
            const barW = 118;
            const barH = 11;
            const barX = x + bw * 0.5 - barW * 0.5;
            const barY = by - 36;

            // Fonas
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.strokeStyle = (base.maxHp >= 999999) ? '#c084fc' : (isPlayer ? '#38bdf8' : '#f43f5e');
            ctx.lineWidth = 1.8;
            ctx.shadowColor = isPlayer ? '#0284c7' : '#dc2626';
            ctx.shadowBlur = hpPercent < 0.25 ? 16 + Math.sin(now * 8) * 8 : 6;
            ctx.beginPath();
            ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 6);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // HP Užpildas su spalvos kaita (NEMIRTINGAS = VIOLETINIS, PRIEŠAS = RAUDONAS)
            const isImmortal = (base.maxHp >= 999999 || (gameState && (gameState.gameMode === 'sandbox' || gameState.isUnlimitedMode || gameState.difficulty === 'unlimited' || (gameState.gameMode === 'endless' && !isPlayer))));
            ctx.strokeStyle = isImmortal ? '#c084fc' : (isPlayer ? '#38bdf8' : '#f43f5e');
            const curHpW = Math.max(0, barW * (isImmortal ? 1.0 : hpPercent));
            let hpColor1 = '#22c55e', hpColor2 = '#16a34a';

            if (isImmortal) {
                hpColor1 = '#c084fc'; // Šviesus neoninis violetinis
                hpColor2 = '#7c3aed'; // Gilus karališkas violetinis
            } else if (!isPlayer) {
                // Priešo bazės gyvybės - Raudonos!
                if (hpPercent < 0.30) {
                    hpColor1 = '#ef4444'; hpColor2 = '#7f1d1d';
                } else if (hpPercent < 0.60) {
                    hpColor1 = '#f87171'; hpColor2 = '#991b1b';
                } else {
                    hpColor1 = '#ef4444'; hpColor2 = '#b91c1c';
                }
            } else {
                // Žaidėjo bazės gyvybės - Žalia / Gelsva / Raudona
                if (hpPercent < 0.30) {
                    hpColor1 = '#ef4444'; hpColor2 = '#991b1b';
                } else if (hpPercent < 0.60) {
                    hpColor1 = '#f59e0b'; hpColor2 = '#b45309';
                } else {
                    hpColor1 = '#22c55e'; hpColor2 = '#16a34a';
                }
            }

            const hpGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
            hpGrad.addColorStop(0, hpColor1);
            hpGrad.addColorStop(1, hpColor2);
            ctx.fillStyle = hpGrad;
            if (curHpW > 0) {
                const hpR = Math.min(4, curHpW / 2, barH / 2);
                ctx.beginPath();
                ctx.roundRect(barX, barY, curHpW, barH, hpR);
                ctx.fill();
            }

            // HP Skaitinis tekstas
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const hpText = isImmortal 
                ? (isEn ? '🏰 ♾️ IMMORTAL' : '🏰 ♾️ NEMIRTINGA') 
                : (hpPercent < 0.25 ? `⚠️ ${Math.round(base.hp)} / ${base.maxHp} HP` : `🏰 ${Math.round(base.hp)} / ${base.maxHp} HP`);
            ctx.fillText(hpText, barX + barW * 0.5, barY + barH * 0.5);

            ctx.restore();
        }


        // --------------------------------------------------------------------
        // POPULIACIJA IR GAMYBOS RATUKAS INTEGRUOTI TIESIAI Į PILIES SIENĄ
        // (VISADA RODOMI ŽAIDĖJO PILYJE; GALI BŪTI SUPAPRASTINTI BE ŠVYTĖJIMO)
        // --------------------------------------------------------------------
        if (gameState) {
            const queue = isPlayer ? gameState.spawnQueue : (gameState.enemySpawnQueue || []);
            const currentItem = queue && queue.length > 0 ? queue[0] : null;
            // Pilies centrinės sienos koordinatės
            const castleWallX = x + bw * 0.5;
            const castleWallY = by + bh * 0.45;

            // Tikriname, ar naudoti supaprastintą (be neoninio švytėjimo) režimą:
            const isSimpleWheel = (gameState.settings && (
                gameState.settings.popSpawnWheel === false ||
                gameState.settings.simpleCastleWheel === true ||
                gameState.settings.uiGlow === false ||
                gameState.settings.graphicsQuality === 'low' ||
                gameState.settings.baseInWorldUI === false
            ));

            // 1. Populiacijos tekstas integruotas tiesiai į pilies sieną (VISADA RODOMAS)
            if (isPlayer && gameState.playerResources) {
                const pRes = gameState.playerResources;
                const livingSoldiers = gameState.soldiers ? gameState.soldiers.filter(s => s.isPlayer && s.state !== 'DYING' && s.hp > 0).length : 0;
                const queuedSoldiers = gameState.spawnQueue ? gameState.spawnQueue.filter(item => item.isPlayer !== false).length : 0;
                const activeWorkers = gameState.playerWorkers ? gameState.playerWorkers.filter(w => w.state !== 'DEAD' && w.state !== 'FINISHED' && w.state !== 'DYING').length : 0;
                const totalPop = (pRes.idlePop || 0) + activeWorkers + livingSoldiers + queuedSoldiers;
                const isFull = totalPop >= (pRes.maxPop || 10);

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 11px sans-serif';
                const popTxt = isFull ? (isEn ? `👥 ${totalPop}/${pRes.maxPop} (FULL)` : `👥 ${totalPop}/${pRes.maxPop} (PILNA)`) : `👥 ${totalPop} / ${pRes.maxPop}`;
                
                // Aiškus juodas kontūras maksimaliam skaitomumui bet kokiame fone
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.lineWidth = 2.5;
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.strokeText(popTxt, castleWallX, castleWallY - 14);

                // Ryškus pagrindinis teksto užpildymas
                ctx.fillStyle = isFull ? '#ef4444' : '#00f2fe';
                ctx.fillText(popTxt, castleWallX, castleWallY - 14);
                ctx.restore();
            }

            // 2. Apvalus Gamybos Ratukas tiesiai pilies sienoje (VISADA RODOMAS KAI GAMINA GYVENTOJĄ)
            const isPopSpawning = isPlayer && gameState.playerResources && (gameState.playerResources.idlePop + (gameState.playerWorkers ? gameState.playerWorkers.length : 0) + (gameState.soldiers ? gameState.soldiers.filter(s=>s.isPlayer).length : 0) < gameState.playerResources.maxPop);
            const showSoldierWheel = (gameState.settings && gameState.settings.soldierTrainingWheel === true);
            const shouldShowWheel = isPopSpawning || (currentItem && showSoldierWheel);
            
            if (shouldShowWheel) {
                const ringY = castleWallY + 14;
                const ringR = 13;

                const isItemDisplay = currentItem && showSoldierWheel;
                const percent = isItemDisplay 
                    ? Math.min(1, currentItem.elapsed / currentItem.duration)
                    : Math.min(1, gameState.popTimer / (gameState.popSpawnInterval || 4.0));
                
                const icon = isItemDisplay ? (currentItem.data.icon || '⚔️') : '👥';

                ctx.save();
                ctx.fillStyle = isSimpleWheel ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.85)';
                ctx.strokeStyle = isPlayer 
                    ? (isSimpleWheel ? 'rgba(0, 242, 254, 0.3)' : 'rgba(0, 242, 254, 0.4)') 
                    : (isSimpleWheel ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.4)');
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(castleWallX, ringY, ringR, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = isPlayer ? '#00f2fe' : '#ef4444';
                ctx.lineWidth = 2.6;
                if (!isSimpleWheel) {
                    ctx.shadowColor = isPlayer ? '#00f2fe' : '#ef4444';
                    ctx.shadowBlur = 8;
                } else {
                    ctx.shadowBlur = 0;
                }
                ctx.beginPath();
                ctx.arc(castleWallX, ringY, ringR - 1, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * percent, false);
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(icon, castleWallX, ringY);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    // ========================================================================
    // 4.5. BAZĖS TOBULINIMŲ PAPILDOMI DEKORATYVINIAI ELEMENTAI & STATINIAI
    // ========================================================================
    drawBaseUpgradeDecorations(gameState) {
        if (!gameState) return;
        const ctx = this.ctx;
        const groundY = RTS_DATA.GROUND_Y;
        const baseX = RTS_DATA.PLAYER_BASE_X;
        const baseW = RTS_DATA.PLAYER_BASE_WIDTH;
        const by = groundY - RTS_DATA.PLAYER_BASE_HEIGHT;
        const baseLvl = gameState.getUpgradeLevel ? gameState.getUpgradeLevel('base_wall', true) : 0;
        const tradeLvl = gameState.getUpgradeLevel ? gameState.getUpgradeLevel('trade_economy', true) : 0;

        const era = gameState.playerEra || 0;

        ctx.save();

        // 1. Tvirtovės & Būsto priedai (ŽAIDĖJUI - DEŠINĖJE PUSĖJE, KIEME UŽ BAZĖS, KAD NEUŽDENGTŲ MAISTO)
        if (baseLvl >= 1) {
            // Pamatai / atramos pagal epochą
            if (era >= 4) {
                // Kiber epocha: neoniniai anglies pluošto pilonai
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 1.5;
                ctx.fillRect(baseX + 4, groundY - 45, 6, 45);
                ctx.strokeRect(baseX + 4, groundY - 45, 6, 45);
                ctx.fillRect(baseX + baseW - 10, groundY - 45, 6, 45);
                ctx.strokeRect(baseX + baseW - 10, groundY - 45, 6, 45);
            } else if (era === 3) {
                // Modernus bunkeris: šarvuotos plieno sijos
                ctx.fillStyle = '#334155';
                ctx.fillRect(baseX + 4, groundY - 45, 6, 45);
                ctx.fillRect(baseX + baseW - 10, groundY - 45, 6, 45);
            } else if (era >= 1) {
                // Viduramžiai / Renesansas: akmeninės kolonos
                ctx.fillStyle = '#475569';
                ctx.fillRect(baseX + 4, groundY - 45, 6, 45);
                ctx.fillRect(baseX + baseW - 10, groundY - 45, 6, 45);
            } else {
                // Akmens amžius: medinės sijos
                ctx.fillStyle = '#78350f';
                ctx.fillRect(baseX + 4, groundY - 45, 6, 45);
                ctx.fillRect(baseX + baseW - 10, groundY - 45, 6, 45);
            }
        }
        if (baseLvl >= 2) {
            const tentX = baseX + baseW + 16;
            if (era >= 4) {
                // 🤖 KIBER / ATEITIS: Kvantinė energijos papildymo stotelė ir duomenų pilonas (vietoj urvinio laužo!)
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = '#00f2fe';
                ctx.lineWidth = 1.8;
                ctx.fillRect(tentX - 10, groundY - 24, 20, 24);
                ctx.strokeRect(tentX - 10, groundY - 24, 20, 24);

                // Pulsuojanti neoninė šviesa
                const pulse = Math.sin((this.animTime || 0) * 6) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(0, 242, 254, ${pulse})`;
                ctx.fillRect(tentX - 6, groundY - 18, 12, 10);

                // Energijos švyturėlis
                ctx.fillStyle = '#38bdf8';
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(baseX + baseW + 36, groundY - 12, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (era === 3) {
                // 🪖 MODERNUS: Kareivių maskuojamoji palapinė ir amunicijos konteineris
                ctx.fillStyle = '#1e3a1e';
                ctx.beginPath();
                ctx.moveTo(tentX - 14, groundY);
                ctx.lineTo(tentX, groundY - 24);
                ctx.lineTo(tentX + 14, groundY);
                ctx.closePath();
                ctx.fill();

                // Plieninė kuro statinė
                ctx.fillStyle = '#475569';
                ctx.fillRect(baseX + baseW + 30, groundY - 14, 10, 14);
            } else {
                // 🦴 0-2 EPOCHOS: Gyvenvietės palapinė ir laužas
                ctx.fillStyle = (era === 0) ? '#b45309' : '#334155';
                ctx.beginPath();
                ctx.moveTo(tentX - 14, groundY);
                ctx.lineTo(tentX, groundY - 26);
                ctx.lineTo(tentX + 14, groundY);
                ctx.closePath();
                ctx.fill();

                // Laužas / žibintas
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.arc(baseX + baseW + 36, groundY - 5, 4 + Math.sin((this.animTime || 0) * 8) * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (baseLvl >= 3) {
            // ================================================================
            // SARGYBOS VĖLIAVA / STANDARTAS (INTEGRUOTA TIESIAI ANT BAZĖS BOKŠTO KRAŠTO, PRISITAIKO PRIE EPOCHOS)
            // ================================================================
            const era = gameState.playerEra || 0;
            const fx = baseX + 14; // Tvirtai įtvirtinta kairiajame pagrindinio valdymo bokšto krašte (netrukdo bokštelių lizdui x+38)
            const fy = by - 18;    // Tikslus bokšto viršūnės lygis
            const now = this.animTime || 0;
            const wave = Math.sin(now * 4) * 3;

            if (era === 0) {
                // 🦴 AKMENS AMŽIUS: Medinis genties totemo stiebas su kailine vėliava ir kauliniu antgaliu
                // Pamatinis akmens lizdas
                ctx.fillStyle = '#5c3a21';
                ctx.fillRect(fx - 4, fy - 2, 10, 6);
                // Medinis stiebas
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx, fy - 32);
                ctx.stroke();
                // Kaulinis ieties antgalis
                ctx.fillStyle = '#fef3c7';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 36);
                ctx.lineTo(fx - 2, fy - 31);
                ctx.lineTo(fx + 2, fy - 31);
                ctx.closePath();
                ctx.fill();
                // Genties odos vėliavėlė su bangavimu
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 30);
                ctx.quadraticCurveTo(fx + 12, fy - 26 + wave, fx + 24, fy - 22 + wave * 1.2);
                ctx.lineTo(fx + 20, fy - 14 + wave * 0.8);
                ctx.quadraticCurveTo(fx + 10, fy - 18 + wave * 0.5, fx, fy - 16);
                ctx.closePath();
                ctx.fill();
            } else if (era === 1) {
                // 🏰 VIDURAMŽIAI: Karališkasis geležinis standartas su auksiniu antgaliu ir dviguba herbo uodega
                ctx.fillStyle = '#334155';
                ctx.fillRect(fx - 4, fy - 3, 10, 7);
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx, fy - 36);
                ctx.stroke();
                // Auksinis burbulas
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(fx, fy - 37, 3, 0, Math.PI * 2);
                ctx.fill();
                // Dviguba riteriška vėliava
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 34);
                ctx.lineTo(fx + 24, fy - 28 + wave);
                ctx.lineTo(fx + 16, fy - 22 + wave);
                ctx.lineTo(fx + 24, fy - 16 + wave);
                ctx.lineTo(fx, fy - 14);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (era === 2) {
                // ⚙️ RENESANSAS / LAIVYNAS: Žvilgantis žalvarinis stiebas su jūrų laivyno vėliava
                ctx.fillStyle = '#78350f';
                ctx.fillRect(fx - 4, fy - 3, 10, 7);
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx, fy - 36);
                ctx.stroke();
                // Žalvarinis kryžius / antgalis
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(fx - 3, fy - 38, 6, 3);
                // Prekybos gildijos / Admiraliteto vėliava
                ctx.fillStyle = '#0284c7';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 34);
                ctx.quadraticCurveTo(fx + 14, fy - 30 + wave, fx + 26, fy - 24 + wave);
                ctx.lineTo(fx, fy - 14);
                ctx.closePath();
                ctx.fill();
                // Baltas inkaras/herbas ant vėliavos
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(fx + 6, fy - 26 + wave * 0.5, 5, 2);
            } else if (era === 3) {
                // 🪖 MODERNUSIS BUNKERIS: Taktinė karinė ryšio antena su mirksinčiu švyturiu ir vėliava
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(fx - 3, fy - 3, 8, 7);
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx, fy - 38);
                ctx.stroke();
                // Mirksintis aviacijos švyturys
                const blink = Math.sin(now * 8) > 0;
                ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = blink ? 8 : 0;
                ctx.beginPath();
                ctx.arc(fx, fy - 39, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                // Taktinė kamufliažinė vėliavėlė
                ctx.fillStyle = '#0284c7';
                ctx.fillRect(fx + 1, fy - 32, 18, 12);
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(fx + 4, fy - 29, 12, 6);
            } else {
                // 🤖 KIBER / ATEITIES EPOCHA: Holografinis pilonas su pulsuojančiu neoniniu ciano herbu
                ctx.fillStyle = '#0284c7';
                ctx.fillRect(fx - 4, fy - 3, 10, 7);
                ctx.strokeStyle = '#00f2fe';
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 10;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx, fy - 36);
                ctx.stroke();
                // Holografinis neoninis skydas/vėliava
                ctx.fillStyle = 'rgba(0, 242, 254, 0.8)';
                ctx.beginPath();
                ctx.moveTo(fx + 2, fy - 34);
                ctx.lineTo(fx + 24, fy - 28 + wave * 0.6);
                ctx.lineTo(fx + 18, fy - 20 + wave * 0.6);
                ctx.lineTo(fx + 24, fy - 12 + wave * 0.6);
                ctx.lineTo(fx + 2, fy - 14);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        if (baseLvl >= 4) {
            // Šviesos šaltiniai ant fasado pagal epochą
            if (era >= 4) {
                // Kiber epocha: neoninės pulsuojančios LED lemputės
                ctx.fillStyle = '#00f2fe';
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(baseX + 25, groundY - 100, 3, 0, Math.PI * 2);
                ctx.arc(baseX + baseW - 25, groundY - 100, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (era === 3) {
                // Modernus bunkeris: raudoni signaliniai švyturėliai
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(baseX + 25, groundY - 100, 3, 0, Math.PI * 2);
                ctx.arc(baseX + baseW - 25, groundY - 100, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Senovės epochos: liepsnojantys fakelai
                const tFlame = Math.sin((this.animTime || 0) * 10) * 2;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(baseX + 25, groundY - 100 + tFlame, 4, 0, Math.PI * 2);
                ctx.arc(baseX + baseW - 25, groundY - 100 + tFlame, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ================================================================
        // 2. PREKYVIETĖS & EKONOMIKOS ARCHITEKTŪRA (PRISITAIKO PRIE KIEKVIENOS EPOCHOS)
        // ================================================================
        if (tradeLvl >= 1) {
            const era = gameState.playerEra || 0;
            const mktX = baseX + baseW + 58; // Turgavietės centras dešinėje pusėje kieme (rodomas TIK kai patobulinta)
            const now = this.animTime || 0;

            if (era === 0) {
                // 🦴 0 EPOCHA: PREISTORINĖ GENTIES MAINŲ STOVYKLĖ
                // Lv.1: Medinių rąstų prekystalis su mamuto kailio stogeliu
                ctx.fillStyle = '#78350f';
                ctx.fillRect(mktX - 10, groundY - 22, 22, 22);
                ctx.fillStyle = '#92400e';
                ctx.beginPath();
                ctx.moveTo(mktX - 14, groundY - 22);
                ctx.lineTo(mktX + 1, groundY - 34);
                ctx.lineTo(mktX + 16, groundY - 22);
                ctx.closePath();
                ctx.fill();
                // Kailio apvadas
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (tradeLvl >= 2) {
                    // Lv.2: Titnago įrankių krepšys ir molinės puodynės
                    ctx.fillStyle = '#b45309';
                    ctx.beginPath(); ctx.arc(mktX + 18, groundY - 6, 6, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(mktX + 26, groundY - 10, 8, 10);
                }
                if (tradeLvl >= 3) {
                    // Lv.3: Šviečiantis gintaro karolių krepšys ir džiovinta mėsa
                    ctx.fillStyle = '#f59e0b';
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.arc(mktX - 18, groundY - 7, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
                if (tradeLvl >= 4) {
                    // Lv.4: Šamanistinis mainų totemas su smilkstančia liepsna
                    ctx.strokeStyle = '#78350f';
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(mktX + 38, groundY); ctx.lineTo(mktX + 38, groundY - 30); ctx.stroke();
                    ctx.fillStyle = '#ea580c';
                    ctx.beginPath(); ctx.arc(mktX + 38, groundY - 32, 3.5, 0, Math.PI * 2); ctx.fill();
                }
                if (tradeLvl >= 5) {
                    // Lv.5: Didysis Saulės Gintaro aukuras su auksiniu spindesiu
                    ctx.fillStyle = '#fbbf24';
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = 14;
                    ctx.fillRect(mktX - 12, groundY - 38, 26, 4);
                    ctx.shadowBlur = 0;
                }

            } else if (era === 1) {
                // 🏰 1 EPOCHA: VIDURAMŽIŲ GILDIJOS TŪRGAVIETĖ
                // Lv.1: Karališka dryžuota prekeivio palapinė su ąžuoliniu stalu
                ctx.fillStyle = '#78350f';
                ctx.fillRect(mktX - 12, groundY - 24, 24, 24);
                // Dryžuotas stogelis (mėlyna & balta)
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.moveTo(mktX - 16, groundY - 24);
                ctx.lineTo(mktX, groundY - 38);
                ctx.lineTo(mktX + 16, groundY - 24);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(mktX - 6, groundY - 32, 4, 8);
                ctx.fillRect(mktX + 2, groundY - 32, 4, 8);

                if (tradeLvl >= 2) {
                    // Lv.2: Vyno ir aliejaus statinės su geležiniais lankais
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(mktX + 18, groundY - 14, 11, 14);
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(mktX + 18, groundY - 11, 11, 2);
                    ctx.fillRect(mktX + 18, groundY - 5, 11, 2);
                }
                if (tradeLvl >= 3) {
                    // Lv.3: Atverta kaustyta skrynia su aukso monetomis ir prieskonių maišai
                    ctx.fillStyle = '#d97706';
                    ctx.fillRect(mktX + 32, groundY - 12, 10, 12);
                    ctx.fillStyle = '#fbbf24';
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.arc(mktX - 20, groundY - 6, 4.5, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
                if (tradeLvl >= 4) {
                    // Lv.4: Gildijos iškaba su pakabintu aliejiniu žibintu
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(mktX - 16, groundY - 24); ctx.lineTo(mktX - 16, groundY - 42); ctx.lineTo(mktX - 24, groundY - 42); ctx.stroke();
                    ctx.fillStyle = '#f59e0b';
                    ctx.shadowColor = '#f97316';
                    ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.arc(mktX - 24, groundY - 38, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
                if (tradeLvl >= 5) {
                    // Lv.5: Karališkasis Biržos paauksuotas stogas
                    ctx.fillStyle = '#fbbf24';
                    ctx.shadowColor = '#eab308';
                    ctx.shadowBlur = 14;
                    ctx.fillRect(mktX - 16, groundY - 42, 32, 5);
                    ctx.shadowBlur = 0;
                }

            } else if (era === 2) {
                // ⚙️ 2 EPOCHA: RENESANSO UOSTAS & PREKYBOS RŪMAI
                // Lv.1: Marmurinė arkada su terakotos čerpių stogeliu
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(mktX - 12, groundY - 26, 24, 26);
                ctx.fillStyle = '#b45309';
                ctx.fillRect(mktX - 15, groundY - 34, 30, 8);
                ctx.fillStyle = '#0284c7';
                ctx.fillRect(mktX - 7, groundY - 20, 14, 20);

                if (tradeLvl >= 2) {
                    // Lv.2: Egzotiniai krovinių lagaminai ir šilko ryšuliai
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillRect(mktX + 18, groundY - 14, 12, 14);
                    ctx.fillStyle = '#c084fc';
                    ctx.fillRect(mktX + 32, groundY - 10, 10, 10);
                }
                if (tradeLvl >= 3) {
                    // Lv.3: Bankininko seifas ir žalvarinės svarstyklės
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(mktX - 22, groundY - 12, 10, 12);
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(mktX - 21, groundY - 14, 8, 3);
                }
                if (tradeLvl >= 4) {
                    // Lv.4: Jūrų navigacinis astroliabijos bokštelis
                    ctx.strokeStyle = '#d97706';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.moveTo(mktX + 46, groundY); ctx.lineTo(mktX + 46, groundY - 36); ctx.stroke();
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath(); ctx.arc(mktX + 46, groundY - 38, 4, 0, Math.PI * 2); ctx.fill();
                }
                if (tradeLvl >= 5) {
                    // Lv.5: Didysis Medici Banko auksinis kupolas
                    ctx.fillStyle = '#fbbf24';
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = 15;
                    ctx.beginPath(); ctx.arc(mktX, groundY - 34, 14, Math.PI, 0); ctx.fill();
                    ctx.shadowBlur = 0;
                }

            } else if (era === 3) {
                // 🪖 3 EPOCHA: KARINĖS LOGISTIKOS & TIEKIMO DEPAS
                // Lv.1: Karinė chaki/plieno palapinė su tiekimų langeliu
                ctx.fillStyle = '#334155';
                ctx.fillRect(mktX - 12, groundY - 26, 24, 26);
                ctx.fillStyle = '#15803d';
                ctx.fillRect(mktX - 15, groundY - 32, 30, 7);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(mktX - 6, groundY - 18, 12, 18);

                if (tradeLvl >= 2) {
                    // Lv.2: Amunicijos žalios dėžės su pavojaus juostomis
                    ctx.fillStyle = '#166534';
                    ctx.fillRect(mktX + 18, groundY - 14, 12, 14);
                    ctx.fillStyle = '#eab308';
                    ctx.fillRect(mktX + 20, groundY - 10, 8, 3);
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(mktX + 32, groundY - 16, 9, 16);
                }
                if (tradeLvl >= 3) {
                    // Lv.3: Medicininės pagalbos konteineris su raudonu kryžiumi
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillRect(mktX - 22, groundY - 12, 10, 12);
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(mktX - 19, groundY - 9, 4, 6);
                    ctx.fillRect(mktX - 20, groundY - 8, 6, 4);
                }
                if (tradeLvl >= 4) {
                    // Lv.4: Ryšio radijo antena su žaliu radaru
                    ctx.strokeStyle = '#64748b';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(mktX + 46, groundY); ctx.lineTo(mktX + 46, groundY - 38); ctx.stroke();
                    ctx.fillStyle = '#22c55e';
                    ctx.shadowColor = '#4ade80';
                    ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.arc(mktX + 46, groundY - 39, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
                if (tradeLvl >= 5) {
                    // Lv.5: Šarvuotas aukštųjų technologijų tiekimo depas su prožektoriumi
                    ctx.fillStyle = '#0284c7';
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 12;
                    ctx.fillRect(mktX - 16, groundY - 38, 32, 6);
                    ctx.shadowBlur = 0;
                }

            } else {
                // 🤖 4 EPOCHA: KVANTINĖ KIBER BIRŽA & PLANETINIS MAZGAS
                // Lv.1: Anglies pluošto kiber terminalas su holografiniu ekranu
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(mktX - 12, groundY - 26, 24, 26);
                ctx.fillStyle = '#00f2fe';
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 8;
                ctx.fillRect(mktX - 8, groundY - 20, 16, 12);
                ctx.shadowBlur = 0;

                if (tradeLvl >= 2) {
                    // Lv.2: Levitaciniai krovinių konteineriai su neoniniu spindesiu
                    const hoverY = Math.sin(now * 5) * 3;
                    ctx.fillStyle = '#0284c7';
                    ctx.shadowColor = '#00f2fe';
                    ctx.shadowBlur = 10;
                    ctx.fillRect(mktX + 18, groundY - 18 + hoverY, 12, 10);
                    ctx.fillStyle = '#a855f7';
                    ctx.fillRect(mktX + 33, groundY - 14 - hoverY, 10, 8);
                    ctx.shadowBlur = 0;
                }
                if (tradeLvl >= 3) {
                    // Lv.3: Kriptovaliutų kvantiniai kristalai
                    ctx.fillStyle = '#00ffff';
                    ctx.shadowColor = '#00f2fe';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.moveTo(mktX - 18, groundY - 16);
                    ctx.lineTo(mktX - 14, groundY - 24);
                    ctx.lineTo(mktX - 10, groundY - 16);
                    ctx.lineTo(mktX - 14, groundY - 8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
                if (tradeLvl >= 4) {
                    // Lv.4: Skraidantis prekybos dronas
                    const droneY = groundY - 45 + Math.sin(now * 4) * 4;
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(mktX + 42, droneY, 14, 6);
                    ctx.fillStyle = '#00f2fe';
                    ctx.beginPath(); ctx.arc(mktX + 49, droneY + 3, 2.5, 0, Math.PI * 2); ctx.fill();
                }
                if (tradeLvl >= 5) {
                    // Lv.5: Kvantinio super-mazgo duomenų spindulys
                    ctx.fillStyle = 'rgba(0, 242, 254, 0.7)';
                    ctx.shadowColor = '#00f2fe';
                    ctx.shadowBlur = 16;
                    ctx.fillRect(mktX - 14, groundY - 42, 28, 6);
                    ctx.fillRect(mktX - 1, groundY - 70, 3, 28);
                    ctx.shadowBlur = 0;
                }
            }
        }

        ctx.restore();
    }

    // ========================================================================
    // 4.6. IŠORINĖS GYNYBINĖS SIENOS (DESTRUCTIBLE OUTER WALLS)
    // ========================================================================
    drawOuterWalls(gameState) {
        if (!gameState) return;
        const ctx = this.ctx;
        const groundY = RTS_DATA.GROUND_Y;

        const walls = [
            { wall: gameState.playerWall, isPlayer: true, era: gameState.playerEra },
            { wall: gameState.enemyWall, isPlayer: false, era: gameState.enemyEra }
        ];

        for (const item of walls) {
            const w = item.wall;
            if (!w || !w.active) continue;

            const wx = w.x;
            const wy = groundY - w.height;
            const isPlayer = item.isPlayer;
            const era = item.era;
            const hpRatio = Math.max(0, Math.min(1, w.hp / (w.maxHp || 1500)));

            ctx.save();

            // ================================================================
            // ERA-SPECIFIC HIGH-CONTRAST WALL RENDERING (SU AIŠKIAIS KONTŪRAIS IR DETALĖMIS)
            // ================================================================
            if (era === 0) {
                // 🦴 0 EPOCHA: AKMENS AMŽIUS - Smailinti ąžuoliniai rąstai ir kauliniai smaigaliai
                ctx.fillStyle = '#78350f';
                ctx.strokeStyle = '#1c0d02';
                ctx.lineWidth = 2.2;
                ctx.fillRect(wx - 2, wy, w.width + 4, w.height);
                ctx.strokeRect(wx - 2, wy, w.width + 4, w.height);

                for (let i = 0; i < 4; i++) {
                    const logX = wx + i * 7;
                    ctx.fillStyle = i % 2 === 0 ? '#92400e' : '#b45309';
                    ctx.fillRect(logX, wy + 16, 6, w.height - 16);
                    
                    // Smailus kaulinis antgalis viršuje
                    ctx.fillStyle = '#fef3c7';
                    ctx.beginPath();
                    ctx.moveTo(logX, wy + 16);
                    ctx.lineTo(logX + 3, wy);
                    ctx.lineTo(logX + 6, wy + 16);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }

                // Odinės surišimo virvės su mazgais
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(wx - 4, wy + 45); ctx.lineTo(wx + w.width + 4, wy + 45);
                ctx.moveTo(wx - 4, wy + 110); ctx.lineTo(wx + w.width + 4, wy + 110);
                ctx.stroke();

            } else if (era === 1) {
                // 🏰 1 EPOCHA: VIDURAMŽIAI - Šviesus granito mūras su dantytais bokštais ir šaudymo angomis
                // Pagrindinis akmens korpusas su tamsiu kontūru
                ctx.fillStyle = '#64748b';
                ctx.fillRect(wx - 4, wy, w.width + 8, w.height);
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2.2;
                ctx.strokeRect(wx - 4, wy, w.width + 8, w.height);

                // Dantytos viršūnės (merlons) su šviesia akmens atbraila
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(wx - 6, wy - 16, 14, 18);
                ctx.strokeRect(wx - 6, wy - 16, 14, 18);
                ctx.fillRect(wx + 18, wy - 16, 14, 18);
                ctx.strokeRect(wx + 18, wy - 16, 14, 18);

                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(wx - 6, wy - 18, 14, 3);
                ctx.fillRect(wx + 18, wy - 18, 14, 3);

                // Akmens plytų mūro raštas su šviesos atspindžiais
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 1.8;
                for (let row = 0; row < 6; row++) {
                    const ry = wy + 20 + row * 22;
                    ctx.beginPath();
                    ctx.moveTo(wx - 4, ry); ctx.lineTo(wx + w.width + 4, ry);
                    ctx.stroke();
                }

                // Geležiniai sutvirtinimo vartai ir šaudymo anga
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(wx + 7, wy + 50, 12, 28);
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(wx + 11, wy + 54, 4, 20);

            } else if (era === 2) {
                // ⚙️ 2 EPOCHA: RENESANSAS - Tvirtas raudonų plytų & smiltainio bastionas su ketaus spygliais
                ctx.fillStyle = '#78716c';
                ctx.fillRect(wx - 4, wy, w.width + 8, w.height);
                ctx.strokeStyle = '#1c1917';
                ctx.lineWidth = 2.2;
                ctx.strokeRect(wx - 4, wy, w.width + 8, w.height);

                // Smėlio maišų gynybinė barikada
                ctx.fillStyle = '#d97706';
                ctx.fillRect(wx - 6, wy + 25, w.width + 12, 35);
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(wx - 6, wy + 25, w.width + 12, 35);

                // Ketaus spygliai viršuje
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 3;
                for (let i = 0; i < 5; i++) {
                    const sx = wx + i * 6;
                    ctx.beginPath();
                    ctx.moveTo(sx, wy + 5); ctx.lineTo(sx, wy - 18);
                    ctx.stroke();
                    // Smailus antgalis
                    ctx.fillStyle = '#f59e0b';
                    ctx.fillRect(sx - 2, wy - 20, 4, 4);
                }

            } else if (era === 3) {
                // 🪖 3 EPOCHA: MODERNUSIS AMŽIUS - Šarvuotas gelžbetonio barjeras su geltonomis/juodomis pavojaus juostomis ir spygliuota viela
                // Šviesesnis, gerai matomas karinis gelžbetonis
                ctx.fillStyle = '#64748b';
                ctx.fillRect(wx - 4, wy, w.width + 8, w.height);
                
                // Ryškios geltonos ir juodos įstrižos pavojaus juostos (Hazard Warning Stripes)
                ctx.save();
                ctx.beginPath();
                ctx.rect(wx - 4, wy + 20, w.width + 8, 40);
                ctx.clip();
                ctx.fillStyle = '#eab308';
                ctx.fillRect(wx - 4, wy + 20, w.width + 8, 40);
                ctx.fillStyle = '#0f172a';
                for (let s = -20; s < w.width + 40; s += 16) {
                    ctx.beginPath();
                    ctx.moveTo(wx + s, wy + 20);
                    ctx.lineTo(wx + s + 10, wy + 20);
                    ctx.lineTo(wx + s - 10, wy + 60);
                    ctx.lineTo(wx + s - 20, wy + 60);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();

                // Plieninės kniedės ir plokščių sujungimai
                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                ctx.arc(wx, wy + 80, 2.5, 0, Math.PI * 2);
                ctx.arc(wx + w.width, wy + 80, 2.5, 0, Math.PI * 2);
                ctx.arc(wx, wy + 120, 2.5, 0, Math.PI * 2);
                ctx.arc(wx + w.width, wy + 120, 2.5, 0, Math.PI * 2);
                ctx.fill();

                // Galingas juodas išorinis kontūras
                ctx.strokeStyle = '#020617';
                ctx.lineWidth = 2.4;
                ctx.strokeRect(wx - 4, wy, w.width + 8, w.height);

                // Šviesios viršutinės briaunos akcentas
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(wx - 4, wy, w.width + 8, 4);

                // Blizganti spiralinė plieninė spygliuota viela (Razor Wire) viršuje
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 2.2;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                for (let i = 0; i < 9; i++) {
                    const px = wx - 4 + i * 3.8;
                    const py = wy - 10 + (i % 2 === 0 ? -5 : 5);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

            } else {
                // 🤖 4 EPOCHA: ATEITIES AMŽIUS - Kvantinis pulsuojantis kiber-jėgos skydas
                const time = (this.animTime || 0) * 4;
                const fieldGlow = Math.sin(time) * 0.2 + 0.8;
                
                // Emiterio stulpai viršuje ir apačioje
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = isPlayer ? '#00f2fe' : '#ef4444';
                ctx.lineWidth = 2;
                ctx.fillRect(wx - 6, wy + w.height - 25, w.width + 12, 25);
                ctx.strokeRect(wx - 6, wy + w.height - 25, w.width + 12, 25);
                ctx.fillRect(wx - 4, wy - 12, w.width + 8, 16);
                ctx.strokeRect(wx - 4, wy - 12, w.width + 8, 16);

                // Švytintis jėgos laukas su matricos tinkleliu
                ctx.fillStyle = isPlayer ? `rgba(6, 182, 212, ${0.55 * fieldGlow})` : `rgba(239, 68, 68, ${0.55 * fieldGlow})`;
                ctx.shadowColor = isPlayer ? '#00f2fe' : '#ef4444';
                ctx.shadowBlur = 18;
                ctx.fillRect(wx - 3, wy + 4, w.width + 6, w.height - 29);
                
                // Energinis tinklelis
                ctx.strokeStyle = isPlayer ? 'rgba(0, 242, 254, 0.9)' : 'rgba(254, 202, 202, 0.9)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let y = wy + 15; y < wy + w.height - 25; y += 18) {
                    ctx.moveTo(wx - 3, y); ctx.lineTo(wx + w.width + 3, y);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Sienos gyvybių juosta (Wall HP Bar)
            const barW = 44;
            const barH = 6;
            const barX = wx + (w.width - barW) * 0.5;
            const barY = wy - 22;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
            ctx.fillRect(barX, barY, barW * hpRatio, barH);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#000';
            ctx.fillText(`🛡️ ${Math.round(w.hp)}`, wx + w.width * 0.5, barY - 4);

            ctx.restore();
        }
    }

    // ========================================================================
    // 5. BOKŠTELIAI ANT BAZĖS (SU TVIRTAIS INTEGRUOTAIS PAMATAIS - JOKIO SKRAIDYMO)
    // ========================================================================
    drawTurrets(turrets, unlockedSlots, isPlayer, era, baseX) {
        const ctx = this.ctx;
        const bw = RTS_DATA.PLAYER_BASE_WIDTH;
        const groundY = RTS_DATA.GROUND_Y;
        const by = groundY - RTS_DATA.PLAYER_BASE_HEIGHT;

        // Tikslios 4 lizdų koordinatės, idealiai priderintos prie visų bazių stogų ir bokštų
        const slotPositions = [
            { x: isPlayer ? baseX + bw - 22 : baseX + 22, y: by + 48 },  // 1. Priekinis barbakano bokštas
            { x: isPlayer ? baseX + 76 : baseX + bw - 76, y: by + 18 },   // 2. Vidurinis energijos/šaulių denis
            { x: isPlayer ? baseX + 38 : baseX + bw - 38, y: by - 14 },   // 3. Didysis aukštasis valdymo bokštas
            { x: isPlayer ? baseX + 18 : baseX + bw - 18, y: by + 52 }    // 4. Galinis bastiono/skydų bokštas
        ];

        // Piešti platformas kiekvienam atrakintam lizdui
        for (let i = 0; i < 4; i++) {
            const pos = (window.RTS_DATA && window.RTS_DATA.getTurretSlotPosition) ? window.RTS_DATA.getTurretSlotPosition(isPlayer, i) : slotPositions[i];
            const isUnlocked = i < unlockedSlots;
            const turret = turrets[i];

            if (isUnlocked) {
                ctx.save();
                ctx.translate(pos.x, pos.y);

                // Tvirta atraminė platforma po ginklu
                if (era === 0) {
                    ctx.fillStyle = '#451a03';
                    ctx.fillRect(-14, 2, 28, 6);
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(-12, 0, 24, 3);
                } else if (era === 1) {
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(-14, 2, 28, 6);
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(-12, 0, 24, 3);
                } else if (era === 2) {
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(-14, 2, 28, 6);
                    ctx.fillStyle = '#d97706';
                    ctx.fillRect(-12, 0, 24, 3);
                } else if (era === 3) {
                    ctx.fillStyle = '#18181b';
                    ctx.fillRect(-14, 2, 28, 6);
                    ctx.fillStyle = '#71717a';
                    ctx.fillRect(-12, 0, 24, 3);
                } else {
                    ctx.fillStyle = isPlayer ? '#0369a1' : '#1e3a10';
                    ctx.fillRect(-14, 2, 28, 6);
                    ctx.fillStyle = isPlayer ? '#00f2fe' : '#84cc16';
                    ctx.fillRect(-12, 0, 24, 3);
                }

                // Jei lizdas laisvas - piešti tvirtą gynybinį lizdo žymeklį
                if (!turret) {
                    ctx.strokeStyle = isPlayer ? 'rgba(0, 242, 254, 0.7)' : 'rgba(239, 68, 68, 0.7)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(-9, -6, 18, 8);
                    ctx.fillStyle = isPlayer ? '#00f2fe' : '#ef4444';
                    ctx.font = 'bold 9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('+', 0, 1);
                }

                ctx.restore();
            }

            // Jei bokštelis pastatytas - piešti ginklą su sukimosi kampu
            if (turret) {
                ctx.save();
                ctx.translate(pos.x, pos.y);

                // Bokštelio besisukanti mechaninė bazė
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(0, 0, 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                let angle = (turret.aimAngle !== undefined) ? turret.aimAngle : ((turret.targetAngle !== undefined) ? turret.targetAngle : (isPlayer ? -0.2 : Math.PI + 0.2));
                ctx.rotate(angle);
                RTSSprites.drawTurretWeapon(ctx, turret, isPlayer);

                ctx.restore();
            }
        }
    }


    // ========================================================================
    // 6. DARBININKAI (ŽAIDĖJO IR PRIEŠO - SU EPOCHOS IŠVAIZDA & ANIMACIJA)
    // ========================================================================
    drawWorkers(game) {
        const ctx = this.ctx;
        const camLeft = (this.camLeft !== undefined) ? this.camLeft : -100;
        const camRight = (this.camRight !== undefined) ? this.camRight : (RTS_DATA.WORLD_WIDTH + 100);

        const pw = game.playerWorkers;
        for (let i = 0; i < pw.length; i++) {
            const w = pw[i];
            if (w.state === 'DEAD' || w.state === 'FINISHED') continue;
            if (w.x < camLeft || w.x > camRight) continue;
            RTSSprites.drawWorker(ctx, w, 0.016);
        }

        const ew = game.enemyWorkers;
        for (let i = 0; i < ew.length; i++) {
            const w = ew[i];
            if (w.state === 'DEAD' || w.state === 'FINISHED') continue;
            if (w.x < camLeft || w.x > camRight) continue;
            RTSSprites.drawWorker(ctx, w, 0.016);
        }
    }

    // ========================================================================
    // 7. KARIAI (VISI 15 VIENETŲ SU FORMACIJA IR DINAMINIU ŠVYTĖJIMO LIMITU)
    // ========================================================================
    updateGlowClusterLimits(soldiers) {
        if (!soldiers || soldiers.length === 0) return;
        const CLUSTER_DIST = 90;
        const MAX_CLUSTER_GLOW = 5;

        // Iš pradžių atstatome visų karių švytėjimo būseną
        for (let i = 0; i < soldiers.length; i++) {
            soldiers[i].allowGlow = false;
        }

        // Prioritetų rūšiavimas toje pačioje zonoje:
        // 1. Didvyris (Hero) visada turi aukščiausią prioritetą išlaikyti savo aurą
        // 2. Kariai su aukštesniu rangu (Čempionai, Elitas)
        // 3. Seniau pozicijoje esantys kariai (kovojantys priekyje)
        const priorityList = soldiers.slice().sort((a, b) => {
            if (a.isHero !== b.isHero) return a.isHero ? -1 : 1;
            if ((a.rank || 0) !== (b.rank || 0)) return (b.rank || 0) - (a.rank || 0);
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        for (let i = 0; i < priorityList.length; i++) {
            const s = priorityList[i];
            let localGlowCount = 0;
            for (let j = 0; j < priorityList.length; j++) {
                if (i === j) continue;
                const other = priorityList[j];
                if (other.allowGlow && Math.abs(other.x - s.x) <= CLUSTER_DIST) {
                    localGlowCount++;
                }
            }
            // Jei toje pačioje vietoje (90px) jau šviečia 5 kariai, naujesni/kiti toje vietoje nešviečia.
            // Kai karys išbėga iš krūvos (ar atsilaisvina vieta), jis automatiškai vėl gauna allowGlow = true!
            if (localGlowCount < MAX_CLUSTER_GLOW) {
                s.allowGlow = true;
            } else {
                s.allowGlow = false;
            }
        }
    }

    drawUnits(soldiers, dt) {
        const ctx = this.ctx;
        const camLeft = (this.camLeft !== undefined) ? this.camLeft : -100;
        const camRight = (this.camRight !== undefined) ? this.camRight : (RTS_DATA.WORLD_WIDTH + 100);

        this.updateGlowClusterLimits(soldiers);

        for (let i = 0; i < soldiers.length; i++) {
            const u = soldiers[i];
            if (u.x < camLeft || u.x > camRight) continue;
            RTSSprites.drawUnit(ctx, u, dt);
        }
    }

    // ========================================================================
    // 8. SVIEDINIAI (SU SPECIALIAIS ŠVYTĖJIMAIS IR EFEKTAIS)
    // ========================================================================
    drawProjectiles(projectiles) {
        const ctx = this.ctx;
        const camLeft = (this.camLeft !== undefined) ? this.camLeft : -100;
        const camRight = (this.camRight !== undefined) ? this.camRight : (RTS_DATA.WORLD_WIDTH + 100);
        for (const p of projectiles) {
            if (p.x < camLeft || p.x > camRight) continue;
            ctx.save();
            ctx.translate(p.x, p.y);

            if (p.type === 'laser_beam') {
                ctx.fillStyle = p.isPlayer ? '#00f2fe' : '#ff0055';
                ctx.shadowColor = p.isPlayer ? '#00f2fe' : '#ff0055';
                ctx.shadowBlur = 15;
                ctx.fillRect(-20, -3, 40, 6);
            } else if (p.type === 'plasma' || p.type === 'plasma_bomb') {
                ctx.fillStyle = p.isPlayer ? '#38bdf8' : '#f43f5e';
                ctx.shadowColor = p.isPlayer ? '#38bdf8' : '#f43f5e';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(0, 0, p.radius || 7, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'volcano_rock') {
                ctx.fillStyle = '#ef4444';
                ctx.shadowColor = '#f97316';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(2, -2, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'tar_fire') {
                ctx.fillStyle = '#ea580c';
                ctx.shadowColor = '#ea580c';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1c1917';
                ctx.beginPath();
                ctx.arc(-2, 0, 3.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'lightning') {
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.moveTo(-15, (Math.random() - 0.5) * 6);
                ctx.lineTo(0, (Math.random() - 0.5) * 8);
                ctx.lineTo(15, (Math.random() - 0.5) * 6);
                ctx.stroke();
            } else if (p.type === 'rocket') {
                ctx.fillStyle = '#64748b';
                ctx.fillRect(-8, -3, 16, 6);
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(8, -3); ctx.lineTo(13, 0); ctx.lineTo(8, 3);
                ctx.closePath();
                ctx.fill();
                // Liepsna
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(-12, -2, 4, 4);
            } else if (p.type === 'fire_stone') {
                ctx.fillStyle = '#f97316';
                ctx.shadowColor = '#f97316';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'arrow' || p.type === 'bolt') {
                ctx.strokeStyle = p.type === 'bolt' ? '#94a3b8' : '#78350f';
                ctx.lineWidth = p.type === 'bolt' ? 3 : 2;
                ctx.beginPath();
                ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
                ctx.stroke();
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(8, -2, 4, 4);
            } else {
                ctx.fillStyle = '#7f8c8d';
                ctx.beginPath();
                ctx.arc(0, 0, p.radius || 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // ========================================================================
    // 9. DALELĖS IR SPROGIMAI
    // ========================================================================
    drawParticles(particles, dt) {
        const ctx = this.ctx;
        const camLeft = (this.camLeft !== undefined) ? this.camLeft : -100;
        const camRight = (this.camRight !== undefined) ? this.camRight : (RTS_DATA.WORLD_WIDTH + 100);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.active === false) continue;
            if (p.x < camLeft || p.x > camRight) continue;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius || p.size || 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }

    // ========================================================================
    // 10. SPECIALIEJI GEBĖJIMAI (ULTIMATES - VISOS 5 EPOCHOS SU KINEMATINE ANIMACIJA)
    // ========================================================================
    drawUltimates(ultimates, dt) {
        const ctx = this.ctx;
        const groundY = RTS_DATA.GROUND_Y;
        const now = this.animTime || 0;
        const camLeft = (this.camLeft !== undefined) ? this.camLeft : -100;
        const camRight = (this.camRight !== undefined) ? this.camRight : (RTS_DATA.WORLD_WIDTH + 100);

        for (const ult of ultimates) {
            ctx.save();

            // ----------------------------------------------------------------
            // ERA 0: METEORITŲ LIETUS (Ugniniai krintantys akmenys ir dūmų uodegos)
            // ----------------------------------------------------------------
            if (ult.era === 0) {
                for (const m of ult.items) {
                    if (ult.time < m.delay) continue;
                    if (m.x < camLeft - 90 || m.x > camRight + 90) continue;
                    if (!m.hit) {
                        ctx.save();
                        ctx.translate(m.x, m.y);
                        ctx.rotate(m.angle || (Math.PI * 0.25));

                        // Liepsnų ir dūmų uodega
                        const grad = ctx.createLinearGradient(-50, 0, 10, 0);
                        grad.addColorStop(0, 'transparent');
                        grad.addColorStop(0.5, 'rgba(239, 68, 68, 0.5)');
                        grad.addColorStop(1, '#fbbf24');
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.moveTo(10, 0);
                        ctx.lineTo(-65, -12);
                        ctx.lineTo(-45, 0);
                        ctx.lineTo(-65, 12);
                        ctx.closePath();
                        ctx.fill();

                        // Meteorito ugninis branduolys
                        ctx.shadowColor = '#f59e0b';
                        ctx.shadowBlur = 25;
                        ctx.fillStyle = '#b91c1c';
                        ctx.beginPath();
                        ctx.arc(0, 0, m.radius || 15, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#fbbf24';
                        ctx.beginPath();
                        ctx.arc(3, 0, (m.radius || 15) * 0.6, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(5, 0, (m.radius || 15) * 0.25, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    } else if (ult.time - m.delay < 0.6) {
                        // Smūgio liepsnų žiedas ant žemės
                        const hitProgress = (ult.time - m.delay) / 0.6;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, 1 - hitProgress);
                        ctx.strokeStyle = '#f59e0b';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.ellipse(m.x, groundY - 5, hitProgress * 50, hitProgress * 15, 0, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
            // ----------------------------------------------------------------
            // ERA 1: UGNINIŲ STRĖLIŲ LIETUS (Degančios strėlės krentančios iš dangaus)
            // ----------------------------------------------------------------
            else if (ult.era === 1) {
                for (const arr of ult.items) {
                    if (ult.time < arr.delay) continue;
                    if (arr.x < camLeft - 80 || arr.x > camRight + 80) continue;
                    if (!arr.hit) {
                        ctx.save();
                        ctx.translate(arr.x, arr.y);
                        ctx.rotate(arr.angle || (Math.PI * 0.28));

                        // Liepsnojanti strėlės uodega
                        ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
                        ctx.beginPath();
                        ctx.moveTo(12, 0);
                        ctx.lineTo(-30, -4);
                        ctx.lineTo(-20, 0);
                        ctx.lineTo(-30, 4);
                        ctx.closePath();
                        ctx.fill();

                        // Strėlės medinis kotas
                        ctx.strokeStyle = '#78350f';
                        ctx.lineWidth = 2.5;
                        ctx.beginPath();
                        ctx.moveTo(-16, 0);
                        ctx.lineTo(12, 0);
                        ctx.stroke();

                        // Ugninis strėlės antgalis
                        ctx.shadowColor = '#ef4444';
                        ctx.shadowBlur = 12;
                        ctx.fillStyle = '#fef08a';
                        ctx.beginPath();
                        ctx.arc(12, 0, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    } else if (ult.time - arr.delay < 0.8) {
                        // Deganti strėlė įsmigusi į žemę
                        const burnProgress = (ult.time - arr.delay) / 0.8;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, 1 - burnProgress);
                        ctx.fillStyle = '#f59e0b';
                        ctx.beginPath();
                        ctx.arc(arr.x, groundY - 4, 6 + Math.sin(now * 20 + arr.x) * 3, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
            // ----------------------------------------------------------------
            // ERA 2: ARTILERIJOS SALVĖ (Galingi patrankų sviediniai su dūmais)
            // ----------------------------------------------------------------
            else if (ult.era === 2) {
                for (const ball of ult.items) {
                    if (ult.time < ball.delay) continue;
                    if (ball.x < camLeft - 80 || ball.x > camRight + 80) continue;
                    if (!ball.hit) {
                        ctx.save();
                        ctx.translate(ball.x, ball.y);

                        // Dūmų uodega
                        ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
                        ctx.beginPath();
                        ctx.arc(-12, -8, 8, 0, Math.PI * 2);
                        ctx.arc(-22, -14, 12, 0, Math.PI * 2);
                        ctx.fill();

                        // Didelis ketaus patrankos sviedinys
                        ctx.fillStyle = '#1e293b';
                        ctx.strokeStyle = '#475569';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(0, 0, 11, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();

                        // Deganti dagtis / kibirkštys
                        ctx.fillStyle = '#fde047';
                        ctx.shadowColor = '#f59e0b';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(-4, -6, 3, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
            // ----------------------------------------------------------------
            // ERA 3: BOMBONEŠIO ANTSKRYDIS (Modernus lėktuvas + krintančios bombos)
            // ----------------------------------------------------------------
            else if (ult.era === 3) {
                // 1. Skrendantis bombonešis
                const px = ult.planeX;
                const py = 75;
                const dir = ult.isPlayer ? 1 : -1;

                if (px >= camLeft - 180 && px <= camRight + 180) {
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.scale(dir, 1);

                    // Reaktyviniai variklių liepsnos pliūpsniai
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 18;
                    ctx.fillStyle = '#0284c7';
                    ctx.beginPath();
                    ctx.moveTo(-50, -6);
                    ctx.lineTo(-85 - Math.random() * 20, 0);
                    ctx.lineTo(-50, 6);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#fde047';
                    ctx.beginPath();
                    ctx.moveTo(-50, -3);
                    ctx.lineTo(-68, 0);
                    ctx.lineTo(-50, 3);
                    ctx.closePath();
                    ctx.fill();

                    // Lėktuvo fiuzeliažas (Stealth / Modern Bomber)
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(55, 0); // Nosis
                    ctx.lineTo(-30, -32); // Kairysis sparnas
                    ctx.lineTo(-45, -30);
                    ctx.lineTo(-20, -8);
                    ctx.lineTo(-48, -10); // Uodega
                    ctx.lineTo(-48, 10);
                    ctx.lineTo(-20, 8);
                    ctx.lineTo(-45, 30); // Dešinysis sparnas
                    ctx.lineTo(-30, 32);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Kabinos stiklas
                    ctx.fillStyle = '#38bdf8';
                    ctx.beginPath();
                    ctx.ellipse(22, 0, 10, 4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // 2. Krintančios bombos
                for (const bomb of ult.items) {
                    if (ult.time < bomb.delay) continue;
                    if (bomb.x < camLeft - 60 || bomb.x > camRight + 60) continue;
                    if (!bomb.hit) {
                        ctx.save();
                        ctx.translate(bomb.x, bomb.y);
                        ctx.rotate(bomb.angle || (Math.PI * 0.4));

                        // Reaktyvinė / liepsnojanti bombos uodega
                        ctx.fillStyle = 'rgba(249, 115, 22, 0.8)';
                        ctx.beginPath();
                        ctx.moveTo(-16, -3.5);
                        ctx.lineTo(-28 - Math.random() * 8, 0);
                        ctx.lineTo(-16, 3.5);
                        ctx.closePath();
                        ctx.fill();

                        ctx.fillStyle = '#fef08a';
                        ctx.beginPath();
                        ctx.moveTo(-16, -2);
                        ctx.lineTo(-22, 0);
                        ctx.lineTo(-16, 2);
                        ctx.closePath();
                        ctx.fill();

                        // Karinė aerodinaminė bomba / raketa su stabilizatoriais
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(-12, -5, 24, 10);
                        ctx.fillStyle = '#0f172a';
                        ctx.beginPath();
                        ctx.arc(12, 0, 5, -Math.PI * 0.5, Math.PI * 0.5);
                        ctx.fill();

                        // Stabilizatoriai (uodega)
                        ctx.fillStyle = '#eab308';
                        ctx.fillRect(-16, -8, 5, 16);
                        ctx.restore();
                    }
                }
            }
            // ----------------------------------------------------------------
            // ERA 4: ORBITINIS PALYDOVO LAZERIS (Galingas kosminis joninis spindulys)
            // ----------------------------------------------------------------
            else if (ult.era === 4) {
                const beamX = ult.laserX || (this.width * 0.5);
                if (beamX < camLeft - 100 || beamX > camRight + 100) {
                    ctx.restore();
                    continue;
                }

                const topY = -(this.skyPadding || 250);
                const beamH = groundY - topY;

                // 1. Išorinė energijos aura (nuo pat dangaus viršaus / orbitos)
                ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
                ctx.fillRect(beamX - 75, topY, 150, beamH);

                // 2. Pagrindinis plazminis stulpas
                ctx.fillStyle = 'rgba(0, 242, 254, 0.75)';
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 45;
                ctx.fillRect(beamX - 35, topY, 70, beamH);

                // 3. Baltas lazerio branduolys
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(beamX - 12, topY, 24, beamH);

                // 4. Elektros išlydžiai ir žaibo lankai išilgai spindulio nuo pat viršaus
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                for (let y = topY; y < groundY; y += 35) {
                    const offset = Math.sin(now * 30 + y) * 16;
                    if (y === topY) ctx.moveTo(beamX + offset, y);
                    else ctx.lineTo(beamX + offset, y);
                }
                // Priverstinis žaibo lanko sujungimas tiesiai į patį žemės paviršių
                ctx.lineTo(beamX + (Math.sin(now * 30 + groundY) * 10), groundY);
                ctx.stroke();

                // 5. Smūgio į žemę plazminis sprogimas
                ctx.fillStyle = '#00f2fe';
                ctx.shadowBlur = 35;
                ctx.beginPath();
                ctx.ellipse(beamX, groundY - 6, 65 + Math.sin(now * 40) * 15, 20, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.ellipse(beamX, groundY - 6, 30, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // ========================================================================
    // 11. SKRAIDANTYS ŽALOS IR ATLYGIO TEKSTAI (SU CRIT! IR BLOCKED)
    // ========================================================================
    drawFloatingTexts(texts, dt) {
        if (!texts) return;
        const s = (this.game && this.game.settings) ? this.game.settings : (typeof gameState !== 'undefined' ? gameState.settings : null);
        const suppressNormal = s && (s.baseFloatingTexts === false || s.showFloatingTexts === false);
        const ctx = this.ctx;
        const camLeft = (this.camLeft !== undefined) ? this.camLeft : -100;
        const camRight = (this.camRight !== undefined) ? this.camRight : (RTS_DATA.WORLD_WIDTH + 100);

        ctx.textAlign = 'center';
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            if (t.active === false) continue;
            if (suppressNormal && !t.isError && !t.isAlert && !(t.text && (t.text.includes('❌') || t.text.includes('💎')))) continue;
            if (t.x < camLeft || t.x > camRight) continue;

            ctx.save();
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
            ctx.font = t.isCrit ? 'bold 18px sans-serif' : 'bold 12px sans-serif';

            // Greitas aparatinis GPU šešėlis vietoj lėto CPU strokeText
            ctx.shadowColor = t.isCrit ? '#f59e0b' : '#000000';
            ctx.shadowBlur = t.isCrit ? 8 : 4;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }

    // ========================================================================
    // 12. DIENOS / NAKTIES IR ORŲ CIKLAS (ATMOSPHERE & WEATHER)
    // ========================================================================
    drawAtmosphere(game, dt) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const groundY = RTS_DATA.GROUND_Y;

        const weights = game.weatherWeights || { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 };
        const wNight = weights.night || 0;
        const wRain = Math.max(weights.rain || 0, (game.playerEra === 0 && !weights.night) ? 0.35 : 0);
        const wAsh = weights.ash || 0;
        const now = this.animTime || 0;

        const topY = -(this.skyPadding || 250);
        const skyH = groundY - topY;

        // 1. NAKTIS (Švelni, mistiška mėnesiena – veikėjai išlieka 100% ryškūs ir aiškiai matomi!)
        if (wNight > 0.01) {
            ctx.save();
            // Švelnus dangaus mėnesienos gradientas (neperkrautas, neper tamsus, dengia visą dangų iki viršaus)
            const skyGrad = ctx.createLinearGradient(0, topY, 0, groundY);
            skyGrad.addColorStop(0, `rgba(10, 16, 38, ${wNight * 0.35})`);
            skyGrad.addColorStop(0.6, `rgba(15, 23, 42, ${wNight * 0.22})`);
            skyGrad.addColorStop(1, `rgba(56, 189, 248, ${wNight * 0.08})`);
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, topY, w, skyH);

            // Mirgančios žvaigždės visame danguje
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 40; i++) {
                const sx = (i * 73) % w;
                const sy = topY + ((i * 37) % (skyH - 120));
                const sSize = (i % 3 === 0) ? 2 : 1;
                const twinkle = Math.sin(now * 3 + i) * 0.5 + 0.5;
                ctx.globalAlpha = wNight * (0.20 + twinkle * 0.80);
                ctx.fillRect(sx, sy, sSize, sSize);
            }
            ctx.globalAlpha = 1.0;

            // Šviesos šaltiniai (bazės, kasykla, kariai)
            const lights = [
                { x: RTS_DATA.PLAYER_BASE_X + 65, y: groundY - 60, r: 180, color: '#38bdf8' },
                { x: RTS_DATA.ENEMY_BASE_X + 65, y: groundY - 60, r: 180, color: '#ef4444' },
                { x: RTS_DATA.NEUTRAL_CACHE_X, y: groundY - 40, r: 140, color: '#fbbf24' }
            ];

            if (game.soldiers) {
                for (const s of game.soldiers) {
                    if ((s.isHero || s.data.type === 'heavy') && (s.allowGlow !== false)) {
                        lights.push({ x: s.x, y: groundY - 30, r: s.isHero ? 110 : 70, color: s.isPlayer ? '#38bdf8' : '#f87171' });
                    }
                }
            }

            const alphaHex = Math.round(wNight * 0x44).toString(16).padStart(2, '0');
            for (const light of lights) {
                const g = ctx.createRadialGradient(light.x, light.y, 8, light.x, light.y, light.r);
                g.addColorStop(0, light.color + alphaHex);
                g.addColorStop(1, 'transparent');
                ctx.fillStyle = g;
                ctx.fillRect(light.x - light.r, light.y - light.r, light.r * 2, light.r * 2);
            }
            ctx.restore();
        }

        // 2. LIETUS SU ŽAIBAIS (Švelnus lašų tirštėjimas / sklaidymasis visame ekrane)
        if (wRain > 0.01) {
            ctx.save();
            ctx.strokeStyle = `rgba(186, 230, 253, ${wRain * 0.32})`;
            ctx.lineWidth = 1.2;
            const rTime = now * 9;
            const dropCount = Math.floor(55 * wRain);
            for (let i = 0; i < dropCount; i++) {
                const rx = ((i * 55 + rTime * 140) % w);
                const ry = topY + ((i * 38 + rTime * 420) % skyH);
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx - 6, ry + 18);
                ctx.stroke();
            }

            // Žaibo atmosferinis blyksnis
            if (wRain > 0.6 && Math.sin(now * 0.35) > 0.990) {
                ctx.fillStyle = `rgba(255, 255, 255, ${wRain * 0.30})`;
                ctx.fillRect(0, topY, w, skyH);
            }
            ctx.restore();
        }

        // 3. UGNIKALNIO PELENAI / KIBIRKŠTYS (Švelnus dūmų kilimas visame danguje)
        if (wAsh > 0.01) {
            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${wAsh * 0.07})`;
            ctx.fillRect(0, topY, w, skyH);

            const aTime = now * 4;
            const emberCount = Math.floor(40 * wAsh);
            for (let i = 0; i < emberCount; i++) {
                const ax = (i * 68 + Math.sin(aTime + i) * 25) % w;
                const ay = groundY - ((i * 22 + aTime * 90) % skyH);
                const aSize = (i % 2 === 0) ? 3 : 2;
                ctx.globalAlpha = wAsh * 0.85;
                ctx.fillStyle = (i % 3 === 0) ? '#fbbf24' : '#ef4444';
                ctx.shadowColor = '#f97316';
                ctx.shadowBlur = 5;
                ctx.fillRect(ax, ay, aSize, aSize);
            }
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    // ========================================================================
    // 12.5. ATMOSFERINIS ŽAIBAS (FONINIS SLUOKSNIS - UŽ KARIŲ IR RESURSŲ UI)
    // ========================================================================
    drawWeatherLightning(game) {
        if (!game) return;
        const weights = game.weatherWeights || { clear: 1.0, rain: 0.0, night: 0.0, ash: 0.0 };
        const wRain = Math.max(weights.rain || 0, (game.playerEra === 0 && !weights.night) ? 0.35 : 0);
        const now = this.animTime || 0;

        // Žaibas trenkia esant lietui
        if (wRain > 0.6 && Math.sin(now * 0.35) > 0.990) {
            const ctx = this.ctx;
            const groundY = RTS_DATA.GROUND_Y;
            const topY = -(this.skyPadding || 250);
            const w = this.width;

            ctx.save();
            const boltSeed = Math.floor(now * 12);
            const curLeft = (this.camLeft !== undefined) ? this.camLeft : 0;
            const curWidth = (this.camRight !== undefined) ? (this.camRight - curLeft) : w;
            const boltBaseX = curLeft + curWidth * 0.2 + (((boltSeed * 9301 + 49297) % 233280) / 233280) * (curWidth * 0.6);

            // Viena galinga, gryna, aštri žaibo linija be jokių apvalių galų
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 22;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            let curBX = boltBaseX;
            ctx.moveTo(curBX, topY);

            for (let by = topY; by < groundY; by += 26) {
                curBX += Math.sin(by * 0.12 + now * 30) * 14 + (Math.random() - 0.5) * 8;
                ctx.lineTo(curBX, by);
            }
            // Priverstinis smūgis tiesiai į patį žemės paviršių
            ctx.lineTo(curBX, groundY);
            ctx.stroke();

            // Antras plonas vidinis melsvas kontūras didesniam elektros aštrumui
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.restore();
        }
    }

    // ========================================================================
    // 13. MINIMAPAS (INTEGRUOTAS Į VIRŠŲ IR SĄVEIKUS)
    // ========================================================================
    drawMinimap(game) {
        // Piešiama į viršutinį minimap elementą, jei toks yra HTML
        const miniCanvas = document.getElementById('rtsMinimapCanvas');
        if (!miniCanvas) return;

        const mCtx = miniCanvas.getContext('2d');
        const mw = miniCanvas.width;
        const mh = miniCanvas.height;

        mCtx.clearRect(0, 0, mw, mh);

        // Fonas
        mCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        mCtx.fillRect(0, 0, mw, mh);
        mCtx.strokeStyle = '#334155';
        mCtx.lineWidth = 1;
        mCtx.strokeRect(0, 0, mw, mh);

        const scaleX = mw / RTS_DATA.WORLD_WIDTH;

        // Bazės
        mCtx.fillStyle = '#00f2fe';
        mCtx.fillRect(RTS_DATA.PLAYER_BASE_X * scaleX, 3, RTS_DATA.PLAYER_BASE_WIDTH * scaleX, mh - 6);

        mCtx.fillStyle = '#ef4444';
        mCtx.fillRect(RTS_DATA.ENEMY_BASE_X * scaleX, 3, RTS_DATA.ENEMY_BASE_WIDTH * scaleX, mh - 6);

        // Centrinis auksas
        mCtx.fillStyle = '#f59e0b';
        mCtx.fillRect(RTS_DATA.NEUTRAL_CACHE_X * scaleX - 2, 4, 4, mh - 8);

        // Darbininkai
        for (const w of game.playerWorkers) {
            mCtx.fillStyle = '#38bdf8';
            mCtx.fillRect(w.x * scaleX - 1, mh - 7, 2, 4);
        }
        for (const ew of game.enemyWorkers) {
            mCtx.fillStyle = '#f97316';
            mCtx.fillRect(ew.x * scaleX - 1, mh - 7, 2, 4);
        }

        // Kariai
        for (const s of game.soldiers) {
            mCtx.fillStyle = s.isPlayer ? '#10b981' : '#f43f5e';
            mCtx.fillRect(s.x * scaleX - 1.5, mh - 11, 3, 8);
        }

        // Kameros stačiakampis (Viewport) su švytinčiu ciano rėmeliu
        const scale = this.getEffectiveScale();
        const viewWidth = this.canvas.width / scale;
        const camViewW = Math.max(14, viewWidth * scaleX);
        const camViewX = Math.max(0, Math.min(mw - camViewW, this.cameraX * scaleX));

        mCtx.save();
        mCtx.strokeStyle = '#38bdf8';
        mCtx.shadowColor = '#00f2fe';
        mCtx.shadowBlur = 6;
        mCtx.lineWidth = 1.5;
        mCtx.strokeRect(camViewX, 1, camViewW, mh - 2);
        mCtx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        mCtx.fillRect(camViewX, 1, camViewW, mh - 2);
        mCtx.restore();
    }
}

window.RTSRenderer = RTSRenderer;
