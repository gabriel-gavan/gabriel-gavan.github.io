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
  },

  createMobileUI() {
    // Create container for all mobile controls
    const container = document.createElement('div');
    container.id = 'mobile-game-controls';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      font-family: Arial, sans-serif;
    `;

    // Virtual Joystick
    const joystickContainer = document.createElement('div');
    joystickContainer.id = 'virtual-joystick';
    joystickContainer.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: 120px;
      height: 120px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      pointer-events: auto;
      touch-action: none;
    `;

    const joystickKnob = document.createElement('div');
    joystickKnob.id = 'virtual-joystick-knob';
    joystickKnob.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.1s ease;
    `;

    joystickContainer.appendChild(joystickKnob);

    // Jump Button
    const jumpButton = document.createElement('div');
    jumpButton.id = 'jump-button';
    jumpButton.className = 'mobile-action-btn';
    jumpButton.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 70px;
      height: 70px;
      background: rgba(0, 255, 127, 0.2);
      border: 2px solid rgba(0, 255, 127, 0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
    `;
    jumpButton.textContent = 'JUMP';

    // Fire Button (Right side, slightly above jump)
    const fireButton = document.createElement('div');
    fireButton.id = 'fire-button';
    fireButton.className = 'mobile-action-btn';
    fireButton.style.cssText = `
      position: absolute;
      bottom: 100px;
      right: 20px;
      width: 90px;
      height: 90px;
      background: rgba(255, 77, 77, 0.3);
      border: 2px solid rgba(255, 77, 77, 0.6);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: bold;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
      box-shadow: 0 0 15px rgba(255, 77, 77, 0.3);
    `;
    fireButton.textContent = 'FIRE';

    // Ability Button (Right side, left of fire)
    const abilityButton = document.createElement('div');
    abilityButton.id = 'ability-button';
    abilityButton.className = 'mobile-action-btn';
    abilityButton.style.cssText = `
      position: absolute;
      bottom: 120px;
      right: 120px;
      width: 60px;
      height: 60px;
      background: rgba(0, 204, 255, 0.2);
      border: 2px solid rgba(0, 204, 255, 0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
    `;
    abilityButton.textContent = 'ABILITY';

    container.appendChild(joystickContainer);
    container.appendChild(jumpButton);
    container.appendChild(fireButton);
    container.appendChild(abilityButton);

    return { container, joystickContainer, joystickKnob, jumpButton, fireButton, abilityButton };
  },

  removeMobileUI() {
    const existing = document.getElementById('mobile-game-controls');
    if (existing) {
      existing.remove();
    }
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
    this.center = { x: 60, y: 60 }; // Center of joystick
    this.maxDistance = 40; // Maximum distance from center
    this.currentPos = { x: 0, y: 0 }; // Current position (-1 to 1)

    this.setupEvents();
  }

  setupEvents() {
    const handleStart = (e) => {
      e.preventDefault();
      this.isActive = true;
      this.container.style.background = 'rgba(255, 255, 255, 0.3)';
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
        this.knob.style.transform = `translate(${deltaX - 20}px, ${deltaY - 20}px)`;
        this.currentPos.x = deltaX / this.maxDistance;
        this.currentPos.y = deltaY / this.maxDistance;
      } else {
        const angle = Math.atan2(deltaY, deltaX);
        const limitedX = Math.cos(angle) * this.maxDistance;
        const limitedY = Math.sin(angle) * this.maxDistance;

        this.knob.style.transform = `translate(${limitedX - 20}px, ${limitedY - 20}px)`;
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
      this.knob.style.transform = 'translate(-20px, -20px)';
      this.currentPos = { x: 0, y: 0 };
      this.container.style.background = 'rgba(255, 255, 255, 0.2)';

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

    this.mobileUI = null;
    this.virtualJoystick = null;
    this.currentInput = { x: 0, y: 0 };

    this.setupPlayerControls();
  }

  setupPlayerControls() {
    // Create mobile UI
    this.mobileUI = MobileUtils.createMobileUI();
    document.body.appendChild(this.mobileUI.container);

    // Setup virtual joystick
    this.virtualJoystick = new VirtualJoystick(
      this.mobileUI.joystickContainer,
      this.mobileUI.joystickKnob,
      (input) => this.handleJoystickInput(input)
    );

    // Setup jump button
    this.setupJumpButton();
    this.setupActionButtons();
  }

  setupActionButtons() {
    // Fire Button
    const handleFireStart = (e) => {
      e.preventDefault();
      this.controller.keys['Mouse0'] = true; // Use a special key for fire
      this.mobileUI.fireButton.style.background = 'rgba(255, 77, 77, 0.5)';
      this.mobileUI.fireButton.style.transform = 'scale(1.1)';
      // Dispatch a custom event for the Game class to pick up
      window.dispatchEvent(new CustomEvent('mobileFire', { detail: { firing: true } }));
    };

    const handleFireEnd = (e) => {
      e.preventDefault();
      this.controller.keys['Mouse0'] = false;
      this.mobileUI.fireButton.style.background = 'rgba(255, 77, 77, 0.3)';
      this.mobileUI.fireButton.style.transform = 'scale(1)';
      window.dispatchEvent(new CustomEvent('mobileFire', { detail: { firing: false } }));
    };

    this.mobileUI.fireButton.addEventListener('touchstart', handleFireStart);
    this.mobileUI.fireButton.addEventListener('touchend', handleFireEnd);

    // Ability Button
    const handleAbilityStart = (e) => {
      e.preventDefault();
      this.controller.keys['KeyF'] = true;
      this.mobileUI.abilityButton.style.background = 'rgba(0, 204, 255, 0.4)';
      this.mobileUI.abilityButton.style.transform = 'scale(1.1)';
    };

    const handleAbilityEnd = (e) => {
      e.preventDefault();
      this.controller.keys['KeyF'] = false;
      this.mobileUI.abilityButton.style.background = 'rgba(0, 204, 255, 0.2)';
      this.mobileUI.abilityButton.style.transform = 'scale(1)';
    };

    this.mobileUI.abilityButton.addEventListener('touchstart', handleAbilityStart);
    this.mobileUI.abilityButton.addEventListener('touchend', handleAbilityEnd);

    // Weapon switching for mobile: We'll make the existing weapon slots in the HUD touchable
    const weaponSlots = document.querySelectorAll('.weapon-slot');
    weaponSlots.forEach(slot => {
      slot.style.pointerEvents = 'auto'; // Enable touch on HUD slots
    });
  }

  setupJumpButton() {
    const handleJumpStart = (e) => {
      e.preventDefault();
      this.controller.keys['Space'] = true;
      this.mobileUI.jumpButton.style.background = 'rgba(255, 255, 255, 0.4)';
    };

    const handleJumpEnd = (e) => {
      e.preventDefault();
      this.controller.keys['Space'] = false;
      this.mobileUI.jumpButton.style.background = 'rgba(255, 255, 255, 0.2)';
    };

    this.mobileUI.jumpButton.addEventListener('touchstart', handleJumpStart);
    this.mobileUI.jumpButton.addEventListener('touchend', handleJumpEnd);
    this.mobileUI.jumpButton.addEventListener('mousedown', handleJumpStart);
    this.mobileUI.jumpButton.addEventListener('mouseup', handleJumpEnd);
  }

  handleJoystickInput(input) {
    this.currentInput = input;

    // Clear all movement keys first
    this.controller.keys['KeyW'] = false;
    this.controller.keys['KeyS'] = false;
    this.controller.keys['KeyA'] = false;
    this.controller.keys['KeyD'] = false;

    // Set keys based on joystick input (with deadzone)
    const deadzone = 0.1;

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

    // Remove the mobile UI
    MobileUtils.removeMobileUI();
  }
}

export { MobileControls };