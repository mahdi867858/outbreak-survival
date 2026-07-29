import * as THREE from 'three';
import { audioManager } from './audio.js';

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Movement States
    this.keys = { w: false, a: false, s: false, d: false, Shift: false, c: false, Space: false };
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 1.8, 15); // Start position inside the safe house yard (bed is around x:0, z:12)
    
    // Physical attributes
    this.height = 1.8;
    this.crouchHeight = 1.0;
    this.eyeHeight = 1.6; // camera height relative to position.y
    this.targetEyeHeight = 1.6;
    this.currentEyeHeight = 1.6;
    this.isGrounded = true;
    this.isSprinting = false;
    this.isCrouching = false;

    // Vitals
    this.health = 100;
    this.stamina = 100;
    this.maxHealth = 100;
    this.maxStamina = 100;
    
    // Physics parameters
    this.gravity = 25.0;
    this.jumpForce = 8.0;
    this.walkSpeed = 6.0;
    this.sprintSpeed = 10.0;
    this.crouchSpeed = 3.0;

    // Camera Pitch/Yaw
    this.pitch = 0;
    this.yaw = Math.PI; // Look towards negative z (towards safehouse exit)

    // Audio & Footsteps
    this.footstepTimer = 0;
    this.footstepInterval = 0.35; // speed of footsteps

    // Collision boundaries
    this.colliders = [];
    this.worldBounds = { minX: -45, maxX: 45, minZ: -45, maxZ: 45 };

    // Setup input listeners
    this.setupInputs();
  }

  setupInputs() {
    // Key presses
    const keyMap = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
      ShiftLeft: 'Shift', ShiftRight: 'Shift',
      KeyC: 'c', Space: 'Space'
    };

    window.addEventListener('keydown', (e) => {
      if (e.code in keyMap) {
        this.keys[keyMap[e.code]] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code in keyMap) {
        this.keys[keyMap[e.code]] = false;
      }
    });

    // Mouse movement (Pointer Lock)
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.domElement) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      // Mouse sensitivity
      const sensitivity = 0.0022;

      this.yaw -= movementX * sensitivity;
      this.pitch -= movementY * sensitivity;

      // Clamp vertical look angle (-85 deg to +85 deg)
      const maxPitch = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  // Set collidable bounding boxes
  setColliders(colliders) {
    this.colliders = colliders;
  }

  takeDamage(amount) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    audioManager.playPlayerHit();
    
    // Screen shake visual effect on camera could go here
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addAmmo(amount) {
    // Handled in weapon/inventory, but can access via player
  }

  // Simple bounding box check for position
  checkCollision(newPos) {
    // 1. Check world boundaries
    if (newPos.x < this.worldBounds.minX || newPos.x > this.worldBounds.maxX ||
        newPos.z < this.worldBounds.minZ || newPos.z > this.worldBounds.maxZ) {
      return true;
    }

    // Player radius for collision
    const playerRadius = 0.6;
    
    // 2. Check collision with obstacle objects (trees, walls, containers)
    for (let i = 0; i < this.colliders.length; i++) {
      const col = this.colliders[i];
      
      if (col.type === 'box') {
        // AABB box collision check
        const minX = col.pos.x - col.size.x / 2 - playerRadius;
        const maxX = col.pos.x + col.size.x / 2 + playerRadius;
        const minZ = col.pos.z - col.size.z / 2 - playerRadius;
        const maxZ = col.pos.z + col.size.z / 2 + playerRadius;
        
        // Also check height collision
        const minY = col.pos.y - col.size.y / 2;
        const maxY = col.pos.y + col.size.y / 2;

        if (newPos.x >= minX && newPos.x <= maxX &&
            newPos.z >= minZ && newPos.z <= maxZ &&
            newPos.y >= minY && newPos.y <= maxY) {
          return true;
        }
      } else if (col.type === 'cylinder') {
        // Cylinder check (2D distance check on XZ-plane)
        const dx = newPos.x - col.pos.x;
        const dz = newPos.z - col.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = col.radius + playerRadius;
        
        // Check if Y overlaps
        const minY = col.pos.y - col.height / 2;
        const maxY = col.pos.y + col.height / 2;
        
        if (dist < minDist && newPos.y >= minY && newPos.y <= maxY) {
          return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    if (dt > 0.1) dt = 0.1; // Cap time delta to avoid physics clips

    // 1. Camera orientation update
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // 2. Crouching mechanics (smooth transition of camera height)
    this.isCrouching = this.keys.c;
    this.targetEyeHeight = this.isCrouching ? this.crouchHeight : this.eyeHeight;
    this.currentEyeHeight += (this.targetEyeHeight - this.currentEyeHeight) * 10 * dt;

    // Camera placement: offset from player base position
    this.camera.position.copy(this.position);
    this.camera.position.y += this.currentEyeHeight;

    // 3. Movement speed & stamina calculations
    let currentSpeed = this.walkSpeed;
    this.isSprinting = this.keys.Shift && !this.isCrouching && (this.keys.w || this.keys.a || this.keys.s || this.keys.d);

    if (this.isCrouching) {
      currentSpeed = this.crouchSpeed;
    } else if (this.isSprinting && this.stamina > 10) {
      currentSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - 20 * dt); // drain stamina
    } else {
      // Regenerate stamina slowly
      const regenRate = this.keys.c ? 25 : 15;
      this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
    }

    // 4. Calculate movement vectors
    this.direction.set(0, 0, 0);

    if (this.keys.w) this.direction.z -= 1;
    if (this.keys.s) this.direction.z += 1;
    if (this.keys.a) this.direction.x -= 1;
    if (this.keys.d) this.direction.x += 1;

    this.direction.normalize(); // Ensure constant diagonal speed

    // Rotate movement direction based on player yaw
    const moveDirection = new THREE.Vector3();
    moveDirection.copy(this.direction);
    moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    // Apply speed
    this.velocity.x = moveDirection.x * currentSpeed;
    this.velocity.z = moveDirection.z * currentSpeed;

    // 5. Jump and gravity
    if (this.isGrounded) {
      this.velocity.y = 0;
      if (this.keys.Space) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
        audioManager.playPlayerJump();
      }
    } else {
      this.velocity.y -= this.gravity * dt;
    }

    // 6. Collision testing & movement implementation
    const moveX = new THREE.Vector3(this.position.x + this.velocity.x * dt, this.position.y, this.position.z);
    if (!this.checkCollision(moveX)) {
      this.position.x = moveX.x;
    } else {
      this.velocity.x = 0; // stop X velocity on obstacle
    }

    const moveZ = new THREE.Vector3(this.position.x, this.position.y, this.position.z + this.velocity.z * dt);
    if (!this.checkCollision(moveZ)) {
      this.position.z = moveZ.z;
    } else {
      this.velocity.z = 0; // stop Z velocity on obstacle
    }

    // Y movement (gravity and jump) - ground check
    this.position.y += this.velocity.y * dt;
    
    // Temporary hard ground clamp
    const minGroundY = 0;
    if (this.position.y <= minGroundY) {
      this.position.y = minGroundY;
      if (!this.isGrounded && this.velocity.y < -1) {
        // Just landed! Play thump sound
        audioManager.playPlayerHit(); // landing sound uses playerHit or we can synth landing
      }
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // 7. Footstep sounds triggers
    const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
    if (this.isGrounded && isMoving) {
      this.footstepInterval = this.isSprinting ? 0.25 : (this.isCrouching ? 0.5 : 0.38);
      this.footstepTimer += dt;
      
      if (this.footstepTimer >= this.footstepInterval) {
        this.footstepTimer = 0;
        
        // Synthesize low-volume walking thump using short noise/osc
        if (audioManager.ctx) {
          const now = audioManager.ctx.currentTime;
          const osc = audioManager.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(60, now);
          
          const gain = audioManager.ctx.createGain();
          const stepVol = this.isSprinting ? 0.05 : (this.isCrouching ? 0.01 : 0.025);
          gain.gain.setValueAtTime(stepVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          
          osc.connect(gain);
          gain.connect(audioManager.masterGain);
          osc.start(now);
          osc.stop(now + 0.1);
        }
      }
    }
  }

  // Waking up animation inside the Safe House bed (X: 0, Y: 0.2, Z: 12)
  triggerWakeUpAnimation(callback) {
    // Disable inputs
    this.position.set(0, 0.4, 12);
    this.yaw = Math.PI; // Looking towards the exit door
    this.pitch = -0.5; // Looking down at start
    this.crouchHeight = 0.6; // extra low to simulate lying down
    this.isCrouching = true;
    this.keys.c = true;
    
    let duration = 3000; // 3 seconds waking up animation
    let startTime = Date.now();

    const animate = () => {
      let elapsed = Date.now() - startTime;
      let progress = Math.min(elapsed / duration, 1.0);

      // Pitch slowly rises to horizontal, height rises to standard standup
      this.pitch = -0.5 + progress * 0.5;
      
      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        // Complete wake up
        this.keys.c = false;
        this.isCrouching = false;
        if (callback) callback();
      }
    };
    
    animate();
  }
}
export default Player;
