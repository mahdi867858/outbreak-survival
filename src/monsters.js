import * as THREE from 'three';
import { audioManager } from './audio.js';

export class Monster {
  constructor(scene, player, worldManager, position) {
    this.scene = scene;
    this.player = player;
    this.worldManager = worldManager;

    this.health = 40; // tutorial monster is weaker, survival ones can scale
    this.maxHealth = 40;
    this.speed = 3.5;
    
    // AI States
    this.state = 'idle'; // 'idle', 'chase', 'attack', 'dead'
    this.chaseRange = 25.0;
    this.attackRange = 1.6;
    
    // Timers
    this.attackCooldown = 0;
    this.attackInterval = 1.2; // attacks every 1.2s
    this.growlTimer = Math.random() * 5.0;

    // Movement visual animation
    this.animTime = 0;
    this.hitFlashTimer = 0;
    this.isFlashing = false;

    // 3D Mesh
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.position.y = 0; // Ground aligned

    // Material setups
    this.skinMat = new THREE.MeshStandardMaterial({ color: 0x2e3532, roughness: 0.9 }); // Dark swampy green-grey skin
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Glowing red eyes

    this.parts = {};
    this.createBody();

    this.scene.add(this.group);
  }

  createBody() {
    // 1. Torso
    const torsoGeom = new THREE.BoxGeometry(0.8, 1.0, 0.4);
    const torso = new THREE.Mesh(torsoGeom, this.skinMat);
    torso.position.set(0, 0.9, 0);
    torso.monsterOwner = this;
    this.group.add(torso);
    this.parts.torso = torso;

    // 2. Head
    const headGeom = new THREE.BoxGeometry(0.5, 0.5, 0.4);
    const head = new THREE.Mesh(headGeom, this.skinMat);
    head.position.set(0, 1.6, 0);
    head.name = 'monster_head'; // For headshot multiplier checking!
    head.monsterOwner = this;
    this.group.add(head);
    this.parts.head = head;

    // Red eyes
    const eyeGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const leftEye = new THREE.Mesh(eyeGeom, this.eyeMat);
    leftEye.position.set(-0.15, 1.65, -0.21);
    this.group.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.x = 0.15;
    this.group.add(rightEye);

    // Glowing spot light under head (casts red cone onto floor, creepiness!)
    const eyeGlow = new THREE.PointLight(0xff0000, 0.8, 4.0);
    eyeGlow.position.set(0, 1.6, -0.22);
    this.group.add(eyeGlow);

    // 3. Limbs: Arms (hanging forwards)
    const armGeom = new THREE.BoxGeometry(0.2, 0.9, 0.2);
    const leftArm = new THREE.Mesh(armGeom, this.skinMat);
    leftArm.position.set(-0.5, 0.9, -0.2); // raised forward
    leftArm.rotation.x = -Math.PI / 4; // reach out
    leftArm.monsterOwner = this;
    this.group.add(leftArm);
    this.parts.leftArm = leftArm;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.5;
    rightArm.monsterOwner = this;
    this.group.add(rightArm);
    this.parts.rightArm = rightArm;

    // 4. Limbs: Legs
    const legGeom = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    const leftLeg = new THREE.Mesh(legGeom, this.skinMat);
    leftLeg.position.set(-0.25, 0.4, 0);
    leftLeg.monsterOwner = this;
    this.group.add(leftLeg);
    this.parts.leftLeg = leftLeg;

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.25;
    rightLeg.monsterOwner = this;
    this.group.add(rightLeg);
    this.parts.rightLeg = rightLeg;
  }

  takeDamage(amount, headshot) {
    if (this.state === 'dead') return;

    let finalDmg = amount;
    if (headshot) {
      finalDmg = Math.round(amount * 2.5);
      // Dispath custom headshot HUD alert
      const headshotEvent = new CustomEvent('headshotAlert', { detail: { dmg: finalDmg } });
      window.dispatchEvent(headshotEvent);
    }

    this.health = Math.max(0, this.health - finalDmg);
    
    // Play growl/grunt
    audioManager.playMonsterHit();

    // Trigger visual hit flash (turn white)
    this.isFlashing = true;
    this.hitFlashTimer = 0.08; // 80ms flash
    
    // Swap materials
    this.group.traverse(child => {
      if (child.isMesh && child.name !== 'monster_head' && child.material !== this.eyeMat) {
        child.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      }
    });

    // Alert if hit from behind
    if (this.state === 'idle') {
      this.state = 'chase';
    }

    // Death check
    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.state = 'dead';
    audioManager.playMonsterGrowl(); // Scream

    // Disintegrate animation: drop down, bleed, shrink, delete
    const deathY = -0.3;
    const now = Date.now();
    
    // Drop loot box
    this.worldManager.spawnLootBox(this.group.position);

    // Let UI know we defeated a monster
    const scoreEvent = new CustomEvent('monsterKilled');
    window.dispatchEvent(scoreEvent);

    let progress = 0;
    const animateDeath = () => {
      progress += 0.04;
      
      this.group.position.y -= 0.04; // sink in ground
      this.group.scale.subScalar(0.035); // shrink

      if (progress < 1.0 && this.group.scale.x > 0.01) {
        requestAnimationFrame(animateDeath);
      } else {
        // Remove completely
        this.scene.remove(this.group);
        this.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    };
    animateDeath();
  }

  update(dt) {
    if (this.state === 'dead') return;

    // 1. Attack Cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // 2. Play random ambient growls if chasing
    if (this.state === 'chase') {
      this.growlTimer -= dt;
      if (this.growlTimer <= 0) {
        this.growlTimer = 4.0 + Math.random() * 6.0;
        audioManager.playMonsterGrowl();
      }
    }

    // 3. Visual Hit Flashing Restore
    if (this.isFlashing) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.isFlashing = false;
        // Restore materials
        this.group.traverse(child => {
          if (child.isMesh && child.name !== 'monster_head' && child.material !== this.eyeMat) {
            child.material = this.skinMat;
          }
        });
      }
    }

    // 4. AI Distance Calculations to player
    const playerPos = this.player.position;
    const monsterPos = this.group.position;

    const dx = playerPos.x - monsterPos.x;
    const dz = playerPos.z - monsterPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // AI State machine
    if (this.state === 'idle') {
      if (dist < this.chaseRange) {
        this.state = 'chase';
        audioManager.playMonsterGrowl();
      }
    }

    if (this.state === 'chase') {
      // Look towards player (only rotate on Y axis)
      const angle = Math.atan2(dx, dz);
      this.group.rotation.y = angle;

      // Check if within attack range
      if (dist <= this.attackRange) {
        this.state = 'attack';
      } else {
        // Move towards player
        const dirX = dx / dist;
        const dirZ = dz / dist;
        
        // Simple obstacle navigation: check if going to collide with something
        const testPos = monsterPos.clone().add(new THREE.Vector3(dirX * this.speed * dt, 0, dirZ * this.speed * dt));
        
        // Check collisions with world colliders
        let collided = false;
        for (let i = 0; i < this.worldManager.colliders.length; i++) {
          const col = this.worldManager.colliders[i];
          if (col.type === 'box') {
            const buffer = 0.5; // monster radius
            if (testPos.x >= col.pos.x - col.size.x/2 - buffer && testPos.x <= col.pos.x + col.size.x/2 + buffer &&
                testPos.z >= col.pos.z - col.size.z/2 - buffer && testPos.z <= col.pos.z + col.size.z/2 + buffer) {
              collided = true;
              break;
            }
          }
        }

        if (!collided) {
          this.group.position.x = testPos.x;
          this.group.position.z = testPos.z;
        } else {
          // Slide along obstacle (very simple path offset)
          this.group.position.x += dirZ * this.speed * 0.5 * dt; // slide sideways
          this.group.position.z -= dirX * this.speed * 0.5 * dt;
        }

        // Run animations: swing limbs
        this.animTime += dt * 8.0;
        this.parts.leftLeg.rotation.x = Math.sin(this.animTime) * 0.6;
        this.parts.rightLeg.rotation.x = -Math.sin(this.animTime) * 0.6;
        this.parts.leftArm.rotation.x = -Math.PI / 4 + Math.sin(this.animTime) * 0.3;
        this.parts.rightArm.rotation.x = -Math.PI / 4 - Math.sin(this.animTime) * 0.3;
      }
    }

    if (this.state === 'attack') {
      // Keep facing player
      const angle = Math.atan2(dx, dz);
      this.group.rotation.y = angle;

      if (dist > this.attackRange + 0.5) {
        this.state = 'chase';
      } else {
        // Swipe arms in attack animation
        this.animTime += dt * 15.0;
        this.parts.leftArm.rotation.x = -Math.PI / 2 + Math.sin(this.animTime) * 0.8;
        this.parts.rightArm.rotation.x = -Math.PI / 2 - Math.sin(this.animTime) * 0.8;

        if (this.attackCooldown <= 0) {
          this.attackCooldown = this.attackInterval;
          this.player.takeDamage(15); // Hit player for 15 damage
        }
      }
    }
  }
}

// Spawn Manager to handle lists of active monsters
export class MonsterManager {
  constructor(scene, player, worldManager) {
    this.scene = scene;
    this.player = player;
    this.worldManager = worldManager;
    this.activeMonsters = [];
    this.spawnTimer = 0;
    this.spawnDelay = 8.0; // Spawns every 8s during night
    this.maxSurvivalMonsters = 15;

    // Listen to hitscan bullet hits
    window.addEventListener('projectileHit', (e) => {
      const { object, damage, headshot, isSilent } = e.detail;
      
      // Look up if object belongs to a monster
      if (object.monsterOwner) {
        object.monsterOwner.takeDamage(damage, headshot);
      }

      // If gunshot (not silent), alert all nearby monsters within 35m!
      if (!isSilent) {
        this.alertNearbyMonsters(this.player.position, 35.0);
      }
    });
  }

  // Spawn single monster
  spawn(position) {
    const monster = new Monster(this.scene, this.player, this.worldManager, position);
    this.activeMonsters.push(monster);
    return monster;
  }

  // Alert idle monsters near gunshots
  alertNearbyMonsters(sourcePos, radius) {
    this.activeMonsters.forEach(m => {
      if (m.state === 'idle') {
        const dx = m.group.position.x - sourcePos.x;
        const dz = m.group.position.z - sourcePos.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < radius) {
          m.state = 'chase';
        }
      }
    });
  }

  // Spawn random monsters around perimeter
  spawnSurvivalMonster() {
    if (this.activeMonsters.length >= this.maxSurvivalMonsters) return;

    // Spawn at a circle radius 30-40 units away from player
    const angle = Math.random() * Math.PI * 2;
    const dist = 32 + Math.random() * 8;
    const x = this.player.position.x + Math.cos(angle) * dist;
    const z = this.player.position.z + Math.sin(angle) * dist;
    
    // Clamp to map boundaries
    const clampX = Math.max(-42, Math.min(42, x));
    const clampZ = Math.max(-42, Math.min(42, z));

    const m = this.spawn(new THREE.Vector3(clampX, 0, clampZ));
    // Scale up survival health as night goes on
    m.health = 50;
    m.maxHealth = 50;
  }

  clearAll() {
    this.activeMonsters.forEach(m => {
      this.scene.remove(m.group);
      m.group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.activeMonsters = [];
  }

  update(dt, nightMode) {
    // Update active monsters
    for (let i = this.activeMonsters.length - 1; i >= 0; i--) {
      const m = this.activeMonsters[i];
      if (m.state === 'dead') {
        this.activeMonsters.splice(i, 1);
        continue;
      }
      m.update(dt);
    }

    // Spawn loops during night survival
    if (nightMode) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnDelay) {
        this.spawnTimer = 0;
        this.spawnDelay = Math.max(3.5, this.spawnDelay * 0.95); // Spawns get faster!
        this.spawnSurvivalMonster();
      }
    }
  }
}
export default MonsterManager;
