/**
 * AdService handles Google AdSense for Games (H5 Games Ads)
 * It provides a clean interface for triggering interstitial and rewarded ads.
 */
export class AdService {
    constructor() {
        this.adBreak = null;
        this.adConfig = null;
        this.initialized = false;
        this.adInProgress = false;
    }

    /**
     * Initialize the AdSense SDK logic
     */
    init() {
        if (this.initialized) return;

        // The adsbygoogle.js script is loaded in index.html
        window.adsbygoogle = window.adsbygoogle || [];
        
        // Setup the adConfig for H5 Games
        // Documentation: https://support.google.com/adsense/answer/10731903
        window.adConfig = (args) => {
            console.log('AdSense adConfig:', args);
            if (args.adBreak) {
                this.adBreak = args.adBreak;
            }
        };

        this.initialized = true;
        console.log('AdService: Initialized');
    }

    /**
     * Show an interstitial ad (between levels, on death, etc.)
     * @param {Object} options Options for the ad break
     */
    showInterstitial(options = {}) {
        if (!this.adBreak) {
            console.warn('AdService: adBreak not available yet');
            if (options.adBreakDone) options.adBreakDone();
            return;
        }

        const adOptions = {
            type: 'next', // 'next', 'start', 'pause'
            name: options.name || 'interstitial',
            beforeAd: () => {
                console.log('AdService: Before Ad');
                this.adInProgress = true;
                if (options.beforeAd) options.beforeAd();
                // Pause game audio if necessary
                if (window.game && window.game.pauseForAd) window.game.pauseForAd();
            },
            afterAd: () => {
                console.log('AdService: After Ad');
                this.adInProgress = false;
                if (options.afterAd) options.afterAd();
                // Resume game audio
                if (window.game && window.game.resumeAfterAd) window.game.resumeAfterAd();
            },
            adBreakDone: (placementInfo) => {
                console.log('AdService: Ad Break Done', placementInfo);
                this.adInProgress = false;
                if (options.adBreakDone) options.adBreakDone(placementInfo);
            }
        };

        console.log('AdService: Requesting interstitial...');
        this.adBreak(adOptions);
    }

    /**
     * Show a rewarded ad
     * @param {Object} options Options for the rewarded ad
     */
    showRewarded(options = {}) {
        if (!this.adBreak) {
            console.warn('AdService: adBreak not available yet');
            if (options.adBreakDone) options.adBreakDone();
            return;
        }

        const adOptions = {
            type: 'reward',
            name: options.name || 'rewarded_ad',
            beforeAd: () => {
                this.adInProgress = true;
                if (options.beforeAd) options.beforeAd();
                if (window.game && window.game.pauseForAd) window.game.pauseForAd();
            },
            afterAd: () => {
                this.adInProgress = false;
                if (options.afterAd) options.afterAd();
                if (window.game && window.game.resumeAfterAd) window.game.resumeAfterAd();
            },
            beforeReward: (showAdFn) => {
                // Show prompt to player to watch ad
                if (confirm('Watch an ad to receive a reward?')) {
                    showAdFn();
                } else {
                    this.adInProgress = false;
                    if (options.adDismissed) options.adDismissed();
                }
            },
            adDismissed: () => {
                this.adInProgress = false;
                if (options.adDismissed) options.adDismissed();
            },
            adViewed: () => {
                this.adInProgress = false;
                if (options.adViewed) options.adViewed();
            },
            adBreakDone: (placementInfo) => {
                this.adInProgress = false;
                if (options.adBreakDone) options.adBreakDone(placementInfo);
            }
        };

        console.log('AdService: Requesting rewarded ad...');
        this.adBreak(adOptions);
    }
}

export const adService = new AdService();
