import * as THREE from 'three';
import { MobileControls } from './rosieMobileControls.js';

/**
 * PlayerController - Handles player movement and physics
 */
class PlayerController {
  constructor(player, options = {}) {
    this.player = player;

    // Configuration
    this.moveSpeed = options.moveSpeed || 10;
    this.jumpForce = options.jumpForce || 15;
    this.gravity = options.gravity || 30;
    this.groundLevel = options.groundLevel || 1; 
    this.ceilingLevel = options.ceilingLevel || Infinity; 

    // State
    this.velocity = new THREE.Vector3();
    this.isOnGround = true;
    this.canJump = true;
    this.keys = {};
    this.cameraMode = 'third-person'; // Default camera mode
    this.radius = options.radius || 0.6; // Collision radius
    this.raycaster = new THREE.Raycaster();

    // Setup input handlers
    this.setupInput();

    // Initialize mobile controls (handles its own detection and activation)
    this.mobileControls = new MobileControls(this);
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Clear keys on window blur to prevent stuck keys
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  /**
   * Updates the player's state, velocity, and position.
   * @param {number} deltaTime Time elapsed since the last frame.
   * @param {number} cameraRotation The current horizontal rotation (yaw) of the active camera.
   * @param {Array} collisionObjects Objects to check for collisions against.
   */
  update(deltaTime, cameraRotation, collisionObjects = []) {
    // Apply gravity
    if (this.player.position.y > this.groundLevel) {
      this.velocity.y -= this.gravity * deltaTime;
      this.isOnGround = false;
    } else {
      // Clamp player to ground level and reset vertical velocity
      this.velocity.y = Math.max(0, this.velocity.y); 
      this.player.position.y = this.groundLevel;
      this.isOnGround = true;
      this.canJump = true; 
    }

    // Ceiling collision
    if (this.player.position.y > this.ceilingLevel) {
        this.player.position.y = this.ceilingLevel;
        this.velocity.y = Math.min(0, this.velocity.y); // Stop upward momentum
    }

    // Handle jumping
    if (this.keys['Space'] && this.isOnGround && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.canJump = false; // Prevent double jumps until grounded again
    }

    // --- Horizontal Movement ---

    // Reset horizontal velocity each frame
    let moveXInput = 0;
    let moveZInput = 0;

    // Calculate movement direction vectors relative to the camera's horizontal rotation
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

    if (this.keys['KeyW']) { // Forward
      moveXInput += forward.x;
      moveZInput += forward.z;
    }
    if (this.keys['KeyS']) { // Backward
      moveXInput -= forward.x;
      moveZInput -= forward.z;
    }
    if (this.keys['KeyA']) { // Left
      moveXInput -= right.x;
      moveZInput -= right.z;
    }
    if (this.keys['KeyD']) { // Right
      moveXInput += right.x;
      moveZInput += right.z;
    }

    // Normalize movement
    const moveDirection = new THREE.Vector3(moveXInput, 0, moveZInput);
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
    }

    // Set horizontal velocity
    this.velocity.x = moveDirection.x * this.moveSpeed;
    this.velocity.z = moveDirection.z * this.moveSpeed;


    // --- Update Player Position with Collisions ---
    
    // Y Position (Gravity/Jump) - Apply first
    this.player.position.y += this.velocity.y * deltaTime;

    // X and Z Position with simple sliding collision check
    if (collisionObjects.length > 0) {
        const heights = [-0.4, 0.4]; // Check near feet and chest
        
        // Check X movement
        if (this.velocity.x !== 0) {
            const dispX = this.velocity.x * deltaTime;
            const dirX = new THREE.Vector3(this.velocity.x > 0 ? 1 : -1, 0, 0);
            let blockedX = false;
            
            for (const h of heights) {
                const rayOrigin = new THREE.Vector3(this.player.position.x, this.player.position.y + h, this.player.position.z);
                this.raycaster.set(rayOrigin, dirX);
                this.raycaster.far = this.radius + Math.abs(dispX);
                
                const hits = this.raycaster.intersectObjects(collisionObjects, true);
                if (hits.length > 0) {
                    blockedX = true;
                    break;
                }
            }
            
            if (!blockedX) {
                this.player.position.x += dispX;
            } else {
                this.velocity.x = 0; // Stop horizontal velocity on impact
            }
        }
        
        // Check Z movement
        if (this.velocity.z !== 0) {
            const dispZ = this.velocity.z * deltaTime;
            const dirZ = new THREE.Vector3(0, 0, this.velocity.z > 0 ? 1 : -1);
            let blockedZ = false;
            
            for (const h of heights) {
                const rayOrigin = new THREE.Vector3(this.player.position.x, this.player.position.y + h, this.player.position.z);
                this.raycaster.set(rayOrigin, dirZ);
                this.raycaster.far = this.radius + Math.abs(dispZ);
                
                const hits = this.raycaster.intersectObjects(collisionObjects, true);
                if (hits.length > 0) {
                    blockedZ = true;
                    break;
                }
            }
            
            if (!blockedZ) {
                this.player.position.z += dispZ;
            } else {
                this.velocity.z = 0; // Stop horizontal velocity on impact
            }
        }
    } else {
        // No collision objects, move freely
        this.player.position.x += this.velocity.x * deltaTime;
        this.player.position.z += this.velocity.z * deltaTime;
    }


    // --- Update Player Rotation ---
    // Rotate player model to face movement direction (only in third-person mode)
    // In first-person mode, the FirstPersonCameraController handles player rotation.
    if (this.cameraMode === 'third-person' && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      // Calculate the angle of the horizontal velocity vector (world space)
      const angle = Math.atan2(this.velocity.x, this.velocity.z);

      // Set the player's rotation to face the movement direction
      // Works with standard 3D mesh orientation (front facing -Z)
      this.player.rotation.y = angle;
    }
     // If not moving in third-person, the player keeps their last rotation.
     // In first-person mode, the player's rotation is handled entirely by
     // the FirstPersonCameraController synchronizing with the mouse look.
  }

  destroy() {
    // Clean up mobile controls
    this.mobileControls.destroy();
  }
}

/**
 * ThirdPersonCameraController - Handles third-person camera positioning and rotation
 */
class ThirdPersonCameraController {
  constructor(camera, target, domElement, options = {}) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;

    // Configuration
    this.distance = options.distance || 7;
    this.height = options.height || 3;
    this.rotationSpeed = options.rotationSpeed || 0.003;

    // State
    this.rotation = 0;
    this.isDragging = false;
    this.mousePosition = { x: 0, y: 0 };
    this.enabled = true;

    // Setup mouse controls
    this.setupMouseControls();
  }

  setupMouseControls() {
    // Mouse controls
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.isDragging = true;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isDragging) return;

      const deltaX = e.clientX - this.mousePosition.x;
      this.rotation -= deltaX * this.rotationSpeed;

      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    // Touch controls for mobile (only if mobile)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      let touchStart = null;

      this.domElement.addEventListener('touchstart', (e) => {
        if (!this.enabled || e.touches.length !== 1) return;
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.enabled || !touchStart || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        this.rotation -= deltaX * this.rotationSpeed * 2; // Slightly more sensitive on mobile

        touchStart = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchend', (e) => {
        touchStart = null;
        e.preventDefault();
      });
    }
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.isDragging = false;
  }

  update() {
    if (!this.enabled) return 0;

    // Calculate camera position
    const offset = new THREE.Vector3(
      Math.sin(this.rotation) * this.distance,
      this.height,
      Math.cos(this.rotation) * this.distance
    );

    // Position camera
    this.camera.position.copy(this.target.position).add(offset);

    // Look at target
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );

    return this.rotation; // Return rotation for player movement
  }

  destroy() {
    // Camera cleanup if needed
  }
}

/**
 * FirstPersonCameraController - Handles first-person camera controls
 */
class FirstPersonCameraController {
  constructor(camera, player, domElement, options = {}) {
    this.camera = camera;
    this.player = player;
    this.domElement = domElement;

    // Configuration
    this.eyeHeight = options.eyeHeight || 1.6;
    this.mouseSensitivity = options.mouseSensitivity || 0.002;

    // State
    this.enabled = false;
    this.rotationY = 0;
    this.rotationX = 0;

    // Setup mouse controls
    this.setupMouseControls();
  }

  setupMouseControls() {
    // Desktop pointer lock
    this.domElement.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.domElement) return;

      this.rotationY -= e.movementX * this.mouseSensitivity;
      this.rotationX -= e.movementY * this.mouseSensitivity;

      // Limit vertical rotation
      this.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.rotationX));
    });

    // Touch controls for mobile (only if mobile)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      let touchStart = null;

      // Helper function to check if touch is over mobile UI elements
      const isTouchOverMobileUI = (touch) => {
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        return element && (
          element.id === 'mobile-game-controls' ||
          element.id === 'virtual-joystick' ||
          element.id === 'virtual-joystick-knob' ||
          element.id === 'jump-button' ||
          element.closest('#mobile-game-controls')
        );
      };

      this.domElement.addEventListener('touchstart', (e) => {
        if (!this.enabled || e.touches.length !== 1) return;

        // Don't handle touch if it's over mobile UI
        if (isTouchOverMobileUI(e.touches[0])) return;

        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.enabled || !touchStart || e.touches.length !== 1) return;

        // Don't handle touch if it started over mobile UI
        if (isTouchOverMobileUI(e.touches[0])) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;

        this.rotationY -= deltaX * this.mouseSensitivity * 2;
        this.rotationX -= deltaY * this.mouseSensitivity * 2;
        this.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.rotationX));

        touchStart = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchend', (e) => {
        touchStart = null;
        e.preventDefault();
      });
    }
  }

  enable() {
    this.enabled = true;

    // Note: rotationY will be set by setCameraMode before this is called
    this.rotationX = 0;

    // Hide player when in first-person mode
    this.hidePlayer();
  }

  disable() {
    this.enabled = false;

    // Show player when exiting first-person mode
    this.showPlayer();

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  hidePlayer() {
    // Store current player model visibility state
    this.originalVisibility = [];
    this.player.traverse(child => {
      if (child.isMesh) {
        this.originalVisibility.push({
          object: child,
          visible: child.visible
        });
        child.visible = false;
      }
    });
  }

  showPlayer() {
    // Restore player model visibility
    if (this.originalVisibility) {
      this.originalVisibility.forEach(item => {
        item.object.visible = item.visible;
      });
      this.originalVisibility = null;
    }
  }

  update() {
    if (!this.enabled) return 0;

    // Set player rotation to match camera's horizontal rotation
    this.player.rotation.y = this.rotationY;

    // Position camera at player eye height
    this.camera.position.x = this.player.position.x;
    this.camera.position.y = this.player.position.y + this.eyeHeight;
    this.camera.position.z = this.player.position.z;

    // Set camera rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    return this.rotationY;
  }
}

export { PlayerController, ThirdPersonCameraController, FirstPersonCameraController };