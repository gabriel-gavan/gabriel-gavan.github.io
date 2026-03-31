/**
 * Mobile Controls - Handles all mobile-specific input and UI
 * Works by simulating keyboard/mouse events to integrate with existing desktop controls
 */

/**
 * Utility functions for mobile detection and UI management
 */
const MobileUtils = {
  isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
};

/**
 * VirtualJoystick - Handles virtual joystick input for mobile
 */
class VirtualJoystick {
  constructor(container, knob, onInputChange) {
    this.container = container;
    this.knob = knob;
    this.onInputChange = onInputChange;
    this.isActive = false;
    this.center = { x: 70, y: 70 }; // Center of joystick (half of 140)
    this.maxDistance = 50; // Maximum distance from center
    this.currentPos = { x: 0, y: 0 }; // Current position (-1 to 1)

    this.setupEvents();
  }

  setupEvents() {
    const handleStart = (e) => {
      e.preventDefault();
      this.isActive = true;
      this.container.style.background = 'rgba(0, 208, 255, 0.15)';
    };

    const handleMove = (e) => {
      if (!this.isActive) return;
      e.preventDefault();

      const touch = e.touches ? e.touches[0] : e;
      const rect = this.container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = touch.clientX - centerX;
      const deltaY = touch.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance <= this.maxDistance) {
        this.knob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
        this.currentPos.x = deltaX / this.maxDistance;
        this.currentPos.y = deltaY / this.maxDistance;
      } else {
        const angle = Math.atan2(deltaY, deltaX);
        const limitedX = Math.cos(angle) * this.maxDistance;
        const limitedY = Math.sin(angle) * this.maxDistance;

        this.knob.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
        this.currentPos.x = limitedX / this.maxDistance;
        this.currentPos.y = limitedY / this.maxDistance;
      }

      // Notify of input change
      this.onInputChange({
        x: this.currentPos.x,
        y: -this.currentPos.y // Invert Y for game coordinates
      });
    };

    const handleEnd = (e) => {
      e.preventDefault();
      this.isActive = false;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.currentPos = { x: 0, y: 0 };
      this.container.style.background = 'rgba(0, 208, 255, 0.05)';

      // Notify of input change
      this.onInputChange({ x: 0, y: 0 });
    };

    // Touch events
    this.container.addEventListener('touchstart', handleStart);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);

    // Mouse events for testing on desktop
    this.container.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
  }
}

/**
 * MobileControls - Handles mobile player movement controls only
 */
class MobileControls {
  constructor(controller) {
    this.controller = controller;
    this.isMobile = MobileUtils.isMobile();

    // Only initialize on mobile devices and for player controllers
    if (!this.isMobile) {
      return;
    }

    this.virtualJoystick = null;
    this.currentInput = { x: 0, y: 0 };

    this.setupPlayerControls();
  }

  setupPlayerControls() {
    const mobileUI = document.getElementById('mobile-game-controls');
    if (mobileUI) mobileUI.style.display = 'block';

    // Setup virtual joystick
    const joystickContainer = document.getElementById('mobile-joystick-container');
    const joystickKnob = document.getElementById('mobile-joystick-knob');
    
    if (joystickContainer && joystickKnob) {
        this.virtualJoystick = new VirtualJoystick(
          joystickContainer,
          joystickKnob,
          (input) => this.handleJoystickInput(input)
        );
    }

    // Setup utility buttons
    this.bindButton('mobile-jump-btn', 'Space');
    this.bindButton('mobile-reload-btn', 'KeyR');
    this.bindButton('mobile-swap-btn', 'KeyQ');
    this.bindButton('mobile-interact-btn', 'KeyE');
    this.bindButton('mobile-melee-btn', 'KeyV');
    this.bindButton('mobile-util-btn', 'KeyG');
    this.bindButton('mobile-command-btn', 'KeyX');
    this.bindButton('mobile-cycle-btn', 'CapsLock');
    this.bindButton('mobile-ability-btn', 'KeyC');

    // Fire button is special - it needs to trigger mouse events
    this.setupFireButton();
  }

  bindButton(id, keyCode) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const start = (e) => {
        e.preventDefault();
        this.controller.keys[keyCode] = true;
    };

    const end = (e) => {
        e.preventDefault();
        this.controller.keys[keyCode] = false;
    };

    btn.addEventListener('touchstart', start);
    btn.addEventListener('touchend', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
  }

  setupFireButton() {
    const fireBtn = document.getElementById('mobile-fire-btn');
    if (!fireBtn) return;

    const start = (e) => {
        e.preventDefault();
        // Trigger a mousedown on the window element
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2,
            button: 0
        });
        window.dispatchEvent(event);
    };

    const end = (e) => {
        e.preventDefault();
        const event = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2,
            button: 0
        });
        window.dispatchEvent(event);
    };

    fireBtn.addEventListener('touchstart', start);
    fireBtn.addEventListener('touchend', end);
    fireBtn.addEventListener('mousedown', start);
    fireBtn.addEventListener('mouseup', end);
  }

  handleJoystickInput(input) {
    this.currentInput = input;

    // Clear all movement keys first
    this.controller.keys['KeyW'] = false;
    this.controller.keys['KeyS'] = false;
    this.controller.keys['KeyA'] = false;
    this.controller.keys['KeyD'] = false;

    // Set keys based on joystick input (with deadzone)
    const deadzone = 0.05;

    if (Math.abs(input.y) > deadzone) {
      if (input.y > 0) {
        this.controller.keys['KeyW'] = true; // Forward
      } else {
        this.controller.keys['KeyS'] = true; // Backward
      }
    }

    if (Math.abs(input.x) > deadzone) {
      if (input.x > 0) {
        this.controller.keys['KeyD'] = true; // Right
      } else {
        this.controller.keys['KeyA'] = true; // Left
      }
    }
  }

  destroy() {
    if (!this.isMobile) return;
    const mobileUI = document.getElementById('mobile-game-controls');
    if (mobileUI) mobileUI.style.display = 'none';
  }
}

export { MobileControls };