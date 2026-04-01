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
        const adBreak = this.adBreak;
        if (!adBreak) {
            if (options.adBreakDone) options.adBreakDone();
            return;
        }

        const game = window.game;
        const beforeAd = options.beforeAd;
        const afterAd = options.afterAd;
        const adBreakDone = options.adBreakDone;
        const adOptions = {
            type: 'next',
            name: options.name || 'interstitial',
            beforeAd: () => {
                this.adInProgress = true;
                if (beforeAd) beforeAd();
                if (game && game.pauseForAd) game.pauseForAd();
            },
            afterAd: () => {
                this.adInProgress = false;
                if (afterAd) afterAd();
                if (game && game.resumeAfterAd) game.resumeAfterAd();
            },
            adBreakDone: (placementInfo) => {
                this.adInProgress = false;
                if (adBreakDone) adBreakDone(placementInfo);
            }
        };

        adBreak(adOptions);
    }

    showRewarded(options = {}) {
        const adBreak = this.adBreak;
        if (!adBreak) {
            if (options.adBreakDone) options.adBreakDone();
            return;
        }

        const game = window.game;
        const beforeAd = options.beforeAd;
        const afterAd = options.afterAd;
        const adDismissed = options.adDismissed;
        const adViewed = options.adViewed;
        const adBreakDone = options.adBreakDone;
        const adOptions = {
            type: 'reward',
            name: options.name || 'rewarded_ad',
            beforeAd: () => {
                this.adInProgress = true;
                if (beforeAd) beforeAd();
                if (game && game.pauseForAd) game.pauseForAd();
            },
            afterAd: () => {
                this.adInProgress = false;
                if (afterAd) afterAd();
                if (game && game.resumeAfterAd) game.resumeAfterAd();
            },
            beforeReward: (showAdFn) => {
                if (confirm('Watch an ad to receive a reward?')) {
                    showAdFn();
                } else {
                    this.adInProgress = false;
                    if (adDismissed) adDismissed();
                }
            },
            adDismissed: () => {
                this.adInProgress = false;
                if (adDismissed) adDismissed();
            },
            adViewed: () => {
                this.adInProgress = false;
                if (adViewed) adViewed();
            },
            adBreakDone: (placementInfo) => {
                this.adInProgress = false;
                if (adBreakDone) adBreakDone(placementInfo);
            }
        };

        adBreak(adOptions);
    }
}

export const adService = new AdService();