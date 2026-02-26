export class InputHandler {
    constructor() {
        this.swipeThreshold = 30;
        this.touchStart = { x: 0, y: 0 };
        this.actions = {
            left: false,
            right: false,
            up: false,
            down: false
        };

        this._setupKeyboard();
        this._setupTouch();
    }

    _setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.actions.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.actions.right = true;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                case 'Space':
                    this.actions.up = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.actions.down = true;
                    break;
            }
        });
    }

    _setupTouch() {
        window.addEventListener('touchstart', (e) => {
            this.touchStart.x = e.touches[0].clientX;
            this.touchStart.y = e.touches[0].clientY;
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            const touchEnd = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY
            };

            const dx = touchEnd.x - this.touchStart.x;
            const dy = touchEnd.y - this.touchStart.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal swipe
                if (Math.abs(dx) > this.swipeThreshold) {
                    if (dx > 0) this.actions.right = true;
                    else this.actions.left = true;
                }
            } else {
                // Vertical swipe
                if (Math.abs(dy) > this.swipeThreshold) {
                    if (dy > 0) this.actions.down = true;
                    else this.actions.up = true;
                }
            }
        }, { passive: false });

        // Prevent scrolling
        window.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    consumeAction(action) {
        if (this.actions[action]) {
            this.actions[action] = false;
            return true;
        }
        return false;
    }

    reset() {
        for (let key in this.actions) {
            this.actions[key] = false;
        }
    }
}
