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
      display: none; /* Hidden by default, managed by Game class */
    `;

    // Virtual Joystick (Left - Movement)
    const joystickContainer = document.createElement('div');
    joystickContainer.id = 'virtual-joystick';
    joystickContainer.className = 'joystick-base';
    joystickContainer.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 40px;
      width: 120px;
      height: 120px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      pointer-events: auto;
      touch-action: none;
    `;

    const joystickKnob = document.createElement('div');
    joystickKnob.id = 'virtual-joystick-knob';
    joystickKnob.className = 'joystick-knob';
    joystickKnob.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50px;
      height: 50px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;
    joystickContainer.appendChild(joystickKnob);

    // Look Joystick (Right - Aiming)
    const lookJoystickContainer = document.createElement('div');
    lookJoystickContainer.id = 'look-joystick';
    lookJoystickContainer.className = 'joystick-base';
    lookJoystickContainer.style.cssText = `
      position: absolute;
      bottom: 40px;
      right: 140px;
      width: 120px;
      height: 120px;
      background: rgba(0, 255, 127, 0.05);
      border: 2px solid rgba(0, 255, 127, 0.2);
      border-radius: 50%;
      pointer-events: auto;
      touch-action: none;
    `;

    const lookJoystickKnob = document.createElement('div');
    lookJoystickKnob.id = 'look-joystick-knob';
    lookJoystickKnob.className = 'joystick-knob';
    lookJoystickKnob.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50px;
      height: 50px;
      background: rgba(0, 255, 127, 0.4);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;
    lookJoystickContainer.appendChild(lookJoystickKnob);

    // Jump Button
    const jumpButton = document.createElement('div');
    jumpButton.id = 'jump-button';
    jumpButton.className = 'mobile-action-btn';
    jumpButton.style.cssText = `
      position: absolute;
      bottom: 40px;
      right: 40px;
      width: 70px;
      height: 70px;
      background: rgba(0, 255, 127, 0.1);
      border: 2px solid rgba(0, 255, 127, 0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
      pointer-events: auto;
      touch-action: none;
    `;
    jumpButton.textContent = 'JUMP';

    // Fire Button
    const fireButton = document.createElement('div');
    fireButton.id = 'fire-button';
    fireButton.className = 'mobile-action-btn';
    fireButton.style.cssText = `
      position: absolute;
      bottom: 130px;
      right: 40px;
      width: 80px;
      height: 80px;
      background: rgba(255, 77, 77, 0.2);
      border: 2px solid rgba(255, 77, 77, 0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: bold;
      pointer-events: auto;
      touch-action: none;
      box-shadow: 0 0 15px rgba(255, 77, 77, 0.2);
    `;
    fireButton.textContent = 'FIRE';

    // Ability Button
    const abilityButton = document.createElement('div');
    abilityButton.id = 'ability-button';
    abilityButton.className = 'mobile-action-btn';
    abilityButton.style.cssText = `
      position: absolute;
      bottom: 180px;
      right: 140px;
      width: 60px;
      height: 60px;
      background: rgba(0, 204, 255, 0.1);
      border: 2px solid rgba(0, 204, 255, 0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
      pointer-events: auto;
      touch-action: none;
    `;
    abilityButton.textContent = 'ABILITY';

    container.appendChild(joystickContainer);
    container.appendChild(lookJoystickContainer);
    container.appendChild(jumpButton);
    container.appendChild(fireButton);
    container.appendChild(abilityButton);

    // Settings Button (Top left)
    const settingsButton = document.createElement('div');
    settingsButton.id = 'mobile-settings-btn';
    settingsButton.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      pointer-events: auto;
      touch-action: none;
      z-index: 1001;
    `;
    settingsButton.innerHTML = '⚙️';
    container.appendChild(settingsButton);

    return { 
      container, 
      joystickContainer, joystickKnob, 
      lookJoystickContainer, lookJoystickKnob,
      jumpButton, fireButton, abilityButton, settingsButton 
    };
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
    this.touchId = null;
    this.center = { x: 60, y: 60 }; // Center of joystick
    this.maxDistance = 40; // Maximum distance from center
    this.currentPos = { x: 0, y: 0 }; // Current position (-1 to 1)

    this.setupEvents();
  }

  setupEvents() {
    const handleStart = (e) => {
      if (this.isActive) return;
      e.preventDefault();
      
      const touch = e.touches ? e.touches[e.touches.length - 1] : e;
      if (e.touches) this.touchId = touch.identifier;
      
      this.isActive = true;
      this.container.style.background = 'rgba(255, 255, 255, 0.3)';
    };

    const handleMove = (e) => {
      if (!this.isActive) return;
      
      let touch = null;
      if (e.touches) {
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === this.touchId) {
            touch = e.touches[i];
            break;
          }
        }
      } else {
        touch = e;
      }

      if (!touch) return;
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = touch.clientX - centerX;
      const deltaY = touch.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance <= this.maxDistance) {
        this.knob.style.transform = `translate(${deltaX - 25}px, ${deltaY - 25}px)`;
        this.currentPos.x = deltaX / this.maxDistance;
        this.currentPos.y = deltaY / this.maxDistance;
      } else {
        const angle = Math.atan2(deltaY, deltaX);
        const limitedX = Math.cos(angle) * this.maxDistance;
        const limitedY = Math.sin(angle) * this.maxDistance;

        this.knob.style.transform = `translate(${limitedX - 25}px, ${limitedY - 25}px)`;
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
      if (!this.isActive) return;

      if (e.touches && this.touchId !== null) {
        let stillActive = false;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === this.touchId) {
            stillActive = true;
            break;
          }
        }
        if (stillActive) return;
      }

      e.preventDefault();
      this.isActive = false;
      this.touchId = null;
      this.knob.style.transform = 'translate(-25px, -25px)';
      this.currentPos = { x: 0, y: 0 };
      this.container.style.background = 'rgba(255, 255, 255, 0.1)';

      // Notify of input change
      this.onInputChange({ x: 0, y: 0 });
    };

    // Touch events
    this.container.addEventListener('touchstart', handleStart);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

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
    this.lookJoystick = null;
    this.currentInput = { x: 0, y: 0 };
    this.currentLookInput = { x: 0, y: 0 };
    this.joystickSensitivity = parseFloat(localStorage.getItem('alien_exploration_joystick_sensitivity')) || 1.0;
    this.joystickSteering = localStorage.getItem('alien_exploration_joystick_steering') !== 'false'; // Default to true
    this.cameraController = null; // Will be set by Game class

    this.setupPlayerControls();
  }

  setupPlayerControls() {
    // Create mobile UI
    this.mobileUI = MobileUtils.createMobileUI();
    document.body.appendChild(this.mobileUI.container);

    // Setup movement joystick
    this.virtualJoystick = new VirtualJoystick(
      this.mobileUI.joystickContainer,
      this.mobileUI.joystickKnob,
      (input) => this.handleJoystickInput(input)
    );

    // Setup look joystick
    this.lookJoystick = new VirtualJoystick(
      this.mobileUI.lookJoystickContainer,
      this.mobileUI.lookJoystickKnob,
      (input) => this.handleLookJoystickInput(input)
    );

    // Setup jump button
    this.setupJumpButton();
    this.setupActionButtons();
    this.setupSettingsButton();
  }

  handleLookJoystickInput(input) {
    this.currentLookInput = input;
  }

  update(deltaTime) {
    if (!this.cameraController || !this.isMobile) return;

    const deadzone = 0.1;
    const lookSens = this.cameraController.lookSensitivity || 1.0;
    
    // Constant rotation speed when holding the joystick
    // 2.0 radians per second at max tilt
    const rotationSpeed = 2.0 * this.joystickSensitivity * lookSens * deltaTime;

    // Horizontal Look (Yaw)
    if (Math.abs(this.currentLookInput.x) > deadzone) {
      this.cameraController.rotationY -= this.currentLookInput.x * rotationSpeed;
    }

    // Vertical Look (Pitch)
    if (Math.abs(this.currentLookInput.y) > deadzone) {
      // Non-inverted: Pushing stick UP (positive input.y) makes us look UP (negative rotationX)
      this.cameraController.rotationX -= this.currentLookInput.y * rotationSpeed;
      
      // Clamp vertical rotation
      this.cameraController.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.cameraController.rotationX));
    }
  }

  setupSettingsButton() {
    const handleSettings = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('toggleMobileSettings'));
    };

    this.mobileUI.settingsButton.addEventListener('touchstart', handleSettings);
    this.mobileUI.settingsButton.addEventListener('click', handleSettings);
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

    // Apply sensitivity to the input magnitude
    const scaledInput = {
      x: input.x * this.joystickSensitivity,
      y: input.y * this.joystickSensitivity
    };

    // Clear all movement keys first
    this.controller.keys['KeyW'] = false;
    this.controller.keys['KeyS'] = false;
    this.controller.keys['KeyA'] = false;
    this.controller.keys['KeyD'] = false;

    // Set keys based on joystick input (with deadzone)
    const deadzone = 0.1;

    // Vertical movement (Forward/Backward)
    if (Math.abs(scaledInput.y) > deadzone) {
      if (scaledInput.y > 0) {
        this.controller.keys['KeyW'] = true; // Forward
      } else {
        this.controller.keys['KeyS'] = true; // Backward
      }
    }

    // Horizontal logic
    if (Math.abs(scaledInput.x) > deadzone) {
      if (this.joystickSteering && this.cameraController) {
        // Steering Mode: Horizontal joystick rotates the camera
        // Scaled by look sensitivity for a consistent feel
        const lookSens = this.cameraController.lookSensitivity || 1.0;
        const turnSpeed = 0.03 * this.joystickSensitivity * lookSens;
        this.cameraController.rotationY -= scaledInput.x * turnSpeed;
      } else {
        // Tactical Mode: Horizontal joystick strafes left/right
        if (scaledInput.x > 0) {
          this.controller.keys['KeyD'] = true; // Right
        } else {
          this.controller.keys['KeyA'] = true; // Left
        }
      }
    }
  }

  updateJoystickSteering(enabled) {
    this.joystickSteering = enabled;
    localStorage.setItem('alien_exploration_joystick_steering', enabled);
  }

  updateJoystickSensitivity(value) {
    this.joystickSensitivity = value;
    localStorage.setItem('alien_exploration_joystick_sensitivity', value);
  }

  show() {
    if (this.mobileUI && this.mobileUI.container) {
      this.mobileUI.container.style.display = 'block';
    }
  }

  hide() {
    if (this.mobileUI && this.mobileUI.container) {
      this.mobileUI.container.style.display = 'none';
    }
  }

  destroy() {
    if (!this.isMobile) return;

    // Remove the mobile UI
    MobileUtils.removeMobileUI();
  }
}

export { MobileControls };