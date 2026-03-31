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

    init() {
        if (this.initialized) return;

        window.adsbygoogle = window.adsbygoogle || [];

        window.adConfig = (args) => {
            if (args && args.adBreak) {
                this.adBreak = args.adBreak;
            }
        };

        this.initialized = true;
    }

    showInterstitial(options = {}) {
        if (!this.adBreak) {
            if (options.adBreakDone) options.adBreakDone();
            return;
        }

        const game = window.game;
        const adOptions = {
            type: 'next',
            name: options.name || 'interstitial',
            beforeAd: () => {
                this.adInProgress = true;
                if (options.beforeAd) options.beforeAd();
                if (game && game.pauseForAd) game.pauseForAd();
            },
            afterAd: () => {
                this.adInProgress = false;
                if (options.afterAd) options.afterAd();
                if (game && game.resumeAfterAd) game.resumeAfterAd();
            },
            adBreakDone: (placementInfo) => {
                this.adInProgress = false;
                if (options.adBreakDone) options.adBreakDone(placementInfo);
            }
        };

        this.adBreak(adOptions);
    }

    showRewarded(options = {}) {
        if (!this.adBreak) {
            if (options.adBreakDone) options.adBreakDone();
            return;
        }

        const game = window.game;
        const adOptions = {
            type: 'reward',
            name: options.name || 'rewarded_ad',
            beforeAd: () => {
                this.adInProgress = true;
                if (options.beforeAd) options.beforeAd();
                if (game && game.pauseForAd) game.pauseForAd();
            },
            afterAd: () => {
                this.adInProgress = false;
                if (options.afterAd) options.afterAd();
                if (game && game.resumeAfterAd) game.resumeAfterAd();
            },
            beforeReward: (showAdFn) => {
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

        this.adBreak(adOptions);
    }
}

export const adService = new AdService();
