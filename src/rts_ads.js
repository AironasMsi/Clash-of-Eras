// ============================================================================
// CLASH OF ERAS - CRAZYGAMES SDK v3 AD & GAMEPLAY MANAGER
// Official CrazyGames SDK v3 Integration (Video Ads, Lifecycle, Cloud Data & Happy Time)
// ============================================================================

class RTSAdManager {
    constructor() {
        this.isInitialized = false;
        this.isAdPlaying = false;
        this.lastMidgameTime = 0;
        this.mockDurationSec = 3;
        this.environment = 'disabled';
        this.init();
    }

    async init() {
        if (typeof window === 'undefined') return;

        // CrazyGames SDK v3 detection and initialization
        if (window.CrazyGames && window.CrazyGames.SDK) {
            try {
                await window.CrazyGames.SDK.init();
                this.isInitialized = true;
                this.environment = window.CrazyGames.SDK.environment || 'crazygames';
                console.log(`[CrazyGames SDK v3] Initialized successfully. Environment: ${this.environment}`);

                // Listen to platform settings (e.g. platform muteAudio requirement)
                if (window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.addSettingsChangeListener) {
                    window.CrazyGames.SDK.game.addSettingsChangeListener((newSettings) => {
                        if (newSettings && newSettings.muteAudio !== undefined) {
                            if (newSettings.muteAudio && window.rtsSoundSystem) {
                                window.rtsSoundSystem.muteAll();
                            }
                        }
                    });
                }
            } catch (err) {
                console.warn('[CrazyGames SDK v3] Initialization warning (running in fallback mode):', err);
            }
        } else {
            console.log('[CrazyGames SDK v3] SDK not found on window, fallback simulator active.');
        }
    }

    // ========================================================================
    // GAMEPLAY LIFECYCLE (Mandatory for CrazyGames verification)
    // ========================================================================
    gameplayStart() {
        if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            try {
                window.CrazyGames.SDK.game.gameplayStart();
                console.log('[CrazyGames SDK v3] gameplayStart() triggered');
            } catch (e) {
                console.warn('[CrazyGames] gameplayStart error:', e);
            }
        }
    }

    gameplayStop() {
        if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            try {
                window.CrazyGames.SDK.game.gameplayStop();
                console.log('[CrazyGames SDK v3] gameplayStop() triggered');
            } catch (e) {
                console.warn('[CrazyGames] gameplayStop error:', e);
            }
        }
    }

    loadingStart() {
        if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            try {
                window.CrazyGames.SDK.game.loadingStart();
            } catch (e) {}
        }
    }

    loadingStop() {
        if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            try {
                window.CrazyGames.SDK.game.loadingStop();
            } catch (e) {}
        }
    }

    // ========================================================================
    // HAPPY TIME & PROGRESSION (CrazyGames platform celebration)
    // ========================================================================
    happyTime() {
        if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            try {
                window.CrazyGames.SDK.game.happytime();
                console.log('[CrazyGames SDK v3] happytime() celebrated!');
            } catch (e) {}
        }
    }

    reportProgress(percent) {
        if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            try {
                const val = Math.max(0, Math.min(100, Math.round(percent)));
                window.CrazyGames.SDK.game.reportGameCompletedPercentage(val);
                console.log(`[CrazyGames SDK v3] reportGameCompletedPercentage(${val}%)`);
            } catch (e) {}
        }
    }

    // ========================================================================
    // REWARDED ADS (Player initiated for in-game reward: Gold, Revive, Bonus)
    // ========================================================================
    showRewardedAd(onSuccess, onFail = null, rewardName = 'Reward') {
        if (this.isAdPlaying) return;
        this.isAdPlaying = true;
        this.pauseGameAudio();

        const handleSuccess = () => {
            this.isAdPlaying = false;
            this.resumeGameAudio();
            if (typeof onSuccess === 'function') onSuccess();
        };

        const handleFail = (err) => {
            this.isAdPlaying = false;
            this.resumeGameAudio();
            if (typeof onFail === 'function') onFail(err);
        };

        if (this.isInitialized && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
            const callbacks = {
                adStarted: () => {
                    this.pauseGameAudio();
                    if (window.game && window.game.pauseGame) {
                        window.game.pauseGame(true);
                    }
                },
                adFinished: () => {
                    handleSuccess();
                },
                adError: (error) => {
                    console.warn('[CrazyGames SDK v3] Rewarded ad error / unfilled:', error);
                    handleFail(error);
                }
            };
            try {
                window.CrazyGames.SDK.ad.requestAd('rewarded', callbacks);
            } catch (e) {
                console.warn('[CrazyGames SDK v3] Rewarded request exception:', e);
                handleFail(e);
            }
        } else {
            // Localhost / Standalone fallback simulator
            this.playMockAd('rewarded', rewardName, handleSuccess, handleFail);
        }
    }

    // ========================================================================
    // MIDGAME / INTERSTITIAL ADS (Between levels or after match ends)
    // ========================================================================
    showInterstitialAd(onComplete = null) {
        if (this.isAdPlaying) return;

        const now = Date.now();
        // Respect CrazyGames cooldown
        if (now - this.lastMidgameTime < 60000) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        this.isAdPlaying = true;
        this.pauseGameAudio();

        const handleComplete = () => {
            this.isAdPlaying = false;
            this.lastMidgameTime = Date.now();
            this.resumeGameAudio();
            if (typeof onComplete === 'function') onComplete();
        };

        if (this.isInitialized && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
            const callbacks = {
                adStarted: () => {
                    this.pauseGameAudio();
                    if (window.game && window.game.pauseGame) {
                        window.game.pauseGame(true);
                    }
                },
                adFinished: () => {
                    handleComplete();
                },
                adError: (error) => {
                    console.log('[CrazyGames SDK v3] Midgame ad unfilled or cooldown:', error);
                    handleComplete();
                }
            };
            try {
                window.CrazyGames.SDK.ad.requestAd('midgame', callbacks);
            } catch (e) {
                console.warn('[CrazyGames SDK v3] Midgame request exception:', e);
                handleComplete();
            }
        } else {
            this.playMockAd('interstitial', 'Match Complete', handleComplete, handleComplete);
        }
    }

    // ========================================================================
    // CLOUD DATA MODULE (Cross-device persistence via CrazyGames SDK data)
    // ========================================================================
    saveData(key, value) {
        const valStr = (typeof value === 'string') ? value : JSON.stringify(value);
        try {
            if (this.isInitialized && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
                window.CrazyGames.SDK.data.setItem(key, valStr);
            }
            localStorage.setItem(key, valStr);
        } catch (e) {
            console.warn('[AdManager] Save data error:', e);
        }
    }

    loadData(key) {
        try {
            if (this.isInitialized && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
                const cgVal = window.CrazyGames.SDK.data.getItem(key);
                if (cgVal !== null && cgVal !== undefined) return cgVal;
            }
            return localStorage.getItem(key);
        } catch (e) {
            return localStorage.getItem(key);
        }
    }

    // ========================================================================
    // MOCK AD SIMULATOR (Only used during offline / local development)
    // ========================================================================
    playMockAd(type, title, onFinish, onCancel) {
        let overlay = document.getElementById('rtsMockAdOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'rtsMockAdOverlay';
            overlay.className = 'ad-mock-overlay hidden';
            document.body.appendChild(overlay);
        }

        const isEn = (typeof RTS_I18N !== 'undefined' && RTS_I18N.currentLang === 'en');
        const adKicker = isEn ? 'ADVERTISEMENT' : 'REKLAMA';
        const adSub = type === 'rewarded'
            ? (isEn ? `Watching for: ${title}` : `Žiūrima už atlygį: ${title}`)
            : (isEn ? 'Thanks for playing Clash of Eras!' : 'Dėkojame, kad žaidžiate Clash of Eras!');
        const skipLabel = isEn ? 'Skip in' : 'Praleisti po';
        const closeLabel = isEn ? 'Claim Reward ✖' : 'Atsiimti atlygį ✖';

        overlay.innerHTML = `
            <div class="ad-mock-card">
                <div class="ad-mock-header">
                    <span class="ad-badge">${adKicker}</span>
                    <button class="ad-mock-close-btn disabled" id="adMockCloseBtn" disabled>
                        ${skipLabel} <b id="adMockCountdown">${this.mockDurationSec}</b>s
                    </button>
                </div>
                <div class="ad-mock-video-area">
                    <div class="ad-pulse-icon">🎬</div>
                    <div class="ad-mock-title">${title}</div>
                    <div class="ad-mock-desc">${adSub}</div>
                    <div class="ad-mock-progress-bar">
                        <div class="ad-mock-progress-fill" id="adMockProgressFill"></div>
                    </div>
                </div>
                <div class="ad-mock-footer">
                    <span>⚡ CrazyGames SDK Simulator Mode</span>
                </div>
            </div>
        `;

        overlay.classList.remove('hidden');

        let remaining = this.mockDurationSec;
        const countEl = document.getElementById('adMockCountdown');
        const closeBtn = document.getElementById('adMockCloseBtn');
        const fillEl = document.getElementById('adMockProgressFill');

        if (fillEl) {
            fillEl.style.transition = `width ${this.mockDurationSec}s linear`;
            requestAnimationFrame(() => {
                fillEl.style.width = '100%';
            });
        }

        const interval = setInterval(() => {
            remaining--;
            if (countEl) countEl.innerText = remaining;

            if (remaining <= 0) {
                clearInterval(interval);
                if (closeBtn) {
                    closeBtn.disabled = false;
                    closeBtn.classList.remove('disabled');
                    closeBtn.innerHTML = closeLabel;
                    closeBtn.onclick = () => {
                        overlay.classList.add('hidden');
                        if (typeof onFinish === 'function') onFinish();
                    };
                }
            }
        }, 1000);
    }

    pauseGameAudio() {
        if (window.rtsSoundSystem && window.rtsSoundSystem.muteAll) {
            window.rtsSoundSystem.muteAll();
        }
    }

    resumeGameAudio() {
        if (window.rtsSoundSystem && window.rtsSoundSystem.unmuteAll) {
            window.rtsSoundSystem.unmuteAll();
        }
        if (window.game && window.game.resumeGame) {
            window.game.resumeGame(true);
        }
    }
}

// Global initialization
if (typeof window !== 'undefined') {
    window.AdManager = new RTSAdManager();
}
