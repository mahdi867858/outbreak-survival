import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { audioManager } from './audio.js';

export class WeaponSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    // Active weapon state
    this.activeType = 'unarmed'; // 'unarmed', 'pistol', 'bow'
    this.gunUnlocked = false;
    this.bowUnlocked = false;

    // Weapon Meshes
    this.weaponGroup = new THREE.Group();
    this.camera.add(this.weaponGroup); // Attach to camera for automatic FPS tracking

    this.pistolMesh = null;
    this.bowMesh = null;
    this.bowString = null;
    this.arrowInBow = null;

    // Gun Stats
    this.ammoClip = 7;
    this.ammoClipMax = 7;
    this.ammoReserve = 14;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 1.2;

    // Bow Stats
    this.arrowsReserve = 5;
    this.isDrawing = false;
    this.drawTime = 0;
    this.drawDuration = 1.0; // 1 second for full charge
    this.chargeLevel = 0;

    // Bobbing & Sway
    this.bobTime = 0;
    this.recoilOffset = new THREE.Vector3();
    this.recoilRotation = new THREE.Vector3();

    // Arrows in flight
    this.arrowsInFlight = [];

    this.createWeapons();
  }

  // Create 3D geometry for Pistol and Bow using standard primitives
  createWeapons() {
    // 1. Pistol Mesh
    this.pistolMesh = new THREE.Group();
    
    // Slide (top barrel)
    const slideGeom = new THREE.BoxGeometry(0.06, 0.06, 0.35);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.8, roughness: 0.3 });
    const slideMesh = new THREE.Mesh(slideGeom, metalMat);
    slideMesh.position.set(0, 0.05, -0.1);
    this.pistolMesh.add(slideMesh);

    // Body/Grip
    const gripGeom = new THREE.BoxGeometry(0.05, 0.15, 0.06);
    const gripMesh = new THREE.Mesh(gripGeom, metalMat);
    gripMesh.position.set(0, -0.05, -0.05);
    gripMesh.rotation.x = -0.3; // angled grip
    this.pistolMesh.add(gripMesh);

    // Laser Sight (Green cylinder under barrel)
    const laserGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.15);
    laserGeom.rotateX(Math.PI / 2);
    const glowGreenMat = new THREE.MeshBasicMaterial({ color: 0x00ff78 });
    const laserMesh = new THREE.Mesh(laserGeom, glowGreenMat);
    laserMesh.position.set(0, 0.01, -0.15);
    this.pistolMesh.add(laserMesh);

    // Position gun on camera right side
    this.pistolMesh.position.set(0.2, -0.22, -0.45);
    this.pistolMesh.visible = false;
    this.weaponGroup.add(this.pistolMesh);

    // 2. Bow Mesh
    this.bowMesh = new THREE.Group();
    
    // Arch curves (using torus or segmented boxes)
    const archGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7 });
    
    // Segmented limbs to create a curved bow shape
    const limbSegments = 8;
    const limbLength = 0.08;
    
    // Upper limb
    let prevPart = archGroup;
    for (let i = 0; i < limbSegments; i++) {
      const partGeom = new THREE.BoxGeometry(0.02, limbLength, 0.03);
      const part = new THREE.Mesh(partGeom, woodMat);
      part.position.set(0, limbLength / 2, -limbLength * 0.15);
      part.rotation.z = -0.12; // curve
      prevPart.add(part);
      prevPart = part;
    }
    
    // Lower limb
    prevPart = archGroup;
    for (let i = 0; i < limbSegments; i++) {
      const partGeom = new THREE.BoxGeometry(0.02, limbLength, 0.03);
      const part = new THREE.Mesh(partGeom, woodMat);
      part.position.set(0, -limbLength / 2, -limbLength * 0.15);
      part.rotation.z = 0.12; // curve
      prevPart.add(part);
      prevPart = part;
    }
    
    this.bowMesh.add(archGroup);

    // Bow String (thin line)
    const stringMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
    const stringPoints = [
      new THREE.Vector3(0, 0.32, 0),
      new THREE.Vector3(0, 0, 0), // Pulled center
      new THREE.Vector3(0, -0.32, 0)
    ];
    const stringGeom = new THREE.BufferGeometry().setFromPoints(stringPoints);
    this.bowString = new THREE.Line(stringGeom, stringMat);
    this.bowMesh.add(this.bowString);

    // Bow loaded arrow preview
    const arrowGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.4);
    arrowGeom.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const arrowMesh = new THREE.Mesh(arrowGeom, arrowMat);
    arrowMesh.position.set(0, 0, -0.1);
    
    // Arrow tip
    const tipGeom = new THREE.ConeGeometry(0.015, 0.04, 4);
    tipGeom.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
    const tipMesh = new THREE.Mesh(tipGeom, tipMat);
    tipMesh.position.set(0, 0, -0.22);
    arrowMesh.add(tipMesh);

    // Arrow fletching (feathers)
    const featherGeom = new THREE.BoxGeometry(0.002, 0.03, 0.05);
    const featherMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const feather1 = new THREE.Mesh(featherGeom, featherMat);
    feather1.position.set(0, 0.015, 0.18);
    arrowMesh.add(feather1);
    const feather2 = feather1.clone();
    feather2.rotation.z = Math.PI / 2;
    feather2.position.set(0.015, 0, 0.18);
    arrowMesh.add(feather2);

    this.arrowInBow = arrowMesh;
    this.bowMesh.add(this.arrowInBow);

    // Position bow on camera
    this.bowMesh.position.set(0.18, -0.2, -0.4);
    this.bowMesh.rotation.y = -0.15;
    this.bowMesh.visible = false;
    this.weaponGroup.add(this.bowMesh);
  }

  unlockWeapon(type) {
    if (type === 'pistol') {
      this.gunUnlocked = true;
      this.selectWeapon('pistol');
    } else if (type === 'bow') {
      this.bowUnlocked = true;
      this.selectWeapon('bow');
    }
  }

  selectWeapon(type) {
    if (type === 'pistol' && !this.gunUnlocked) return;
    if (type === 'bow' && !this.bowUnlocked) return;

    this.activeType = type;

    // Reset draw states
    this.isDrawing = false;
    this.drawTime = 0;
    this.chargeLevel = 0;
    audioManager.stopBowDraw();

    // Hide all
    this.pistolMesh.visible = false;
    this.bowMesh.visible = false;

    // Show selected
    if (type === 'pistol') {
      this.pistolMesh.visible = true;
    } else if (type === 'bow') {
      this.bowMesh.visible = true;
      this.arrowInBow.visible = this.arrowsReserve > 0;
      this.updateBowString(0);
    }
  }

  // Reload gun
  reload() {
    if (this.activeType !== 'pistol' || this.isReloading) return;
    if (this.ammoClip === this.ammoClipMax || this.ammoReserve === 0) return;

    this.isReloading = true;
    this.reloadTimer = 0;
    audioManager.playReload();
  }

  // Fire Gun / Draw Bow input
  inputPress() {
    if (this.activeType === 'pistol') {
      this.firePistol();
    } else if (this.activeType === 'bow' && this.arrowsReserve > 0 && !this.isDrawing) {
      this.isDrawing = true;
      this.drawTime = 0;
      this.chargeLevel = 0;
      this.arrowInBow.visible = true;
      audioManager.playBowDraw(this.drawDuration);
    }
  }

  // Release Bow input
  inputRelease() {
    if (this.activeType === 'bow' && this.isDrawing) {
      this.releaseBow();
    }
  }

  firePistol() {
    if (this.isReloading) return;
    if (this.ammoClip <= 0) {
      this.reload();
      return;
    }

    // Fire!
    this.ammoClip--;
    audioManager.playGunshot();

    // Visual Recoil (kick back and rotate)
    this.recoilOffset.set(0, 0.04, 0.08);
    this.recoilRotation.set(0.18, 0, 0);

    // Muzzle Flash particle
    this.triggerMuzzleFlash();

    // Raycast hitscan check
    this.triggerRaycastHit(15); // Bullet damage: 15
  }

  triggerMuzzleFlash() {
    const flashGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const flash = new THREE.Mesh(flashGeom, flashMat);
    flash.position.set(0.2, -0.17, -0.65); // Just in front of the barrel
    this.camera.add(flash);

    // Create a temporary flash light
    const flashLight = new THREE.PointLight(0xffaa44, 4.0, 3.0);
    flashLight.position.copy(flash.position);
    this.camera.add(flashLight);

    setTimeout(() => {
      this.camera.remove(flash);
      this.camera.remove(flashLight);
    }, 50);
  }

  triggerRaycastHit(damage) {
    // Fire ray from center of screen
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0); // screen center
    raycaster.setFromCamera(center, this.camera);

    // Event hooks handle target scoring / monster hitting
    // Find all intersections
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    // Find first collidable object that is not player/weapon itself
    let targetHit = null;
    let hitPoint = null;
    let hitNormal = null;

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;
      
      // Skip player, bow, gun structures
      if (obj.ancestorIsPlayer || this.camera.getObjectById(obj.id)) {
        continue;
      }
      
      targetHit = intersects[i];
      hitPoint = intersects[i].point;
      hitNormal = intersects[i].face.normal;
      break;
    }

    if (targetHit) {
      // Trigger visual hit effect
      this.createHitImpact(hitPoint, hitNormal, 0xffffff);

      // Trigger custom callback event for monsters or targets
      const hitEvent = new CustomEvent('projectileHit', {
        detail: {
          object: targetHit.object,
          point: hitPoint,
          damage: damage,
          headshot: targetHit.object.name === 'monster_head',
          isSilent: false // Gunfire alerts nearby monsters!
        }
      });
      window.dispatchEvent(hitEvent);
    }
  }

  // Draw Bow charge string visual updates
  updateBowString(drawAmt) {
    if (!this.bowString) return;
    const positions = this.bowString.geometry.attributes.position.array;
    // Pull the center coordinate (index 3, 4, 5) back on Z-axis
    positions[3] = 0;       // X
    positions[4] = 0;       // Y
    positions[5] = drawAmt * 0.15; // Z (pulling back)
    this.bowString.geometry.attributes.position.needsUpdate = true;
    
    if (this.arrowInBow) {
      this.arrowInBow.position.z = -0.1 + drawAmt * 0.15;
    }
  }

  releaseBow() {
    this.isDrawing = false;
    audioManager.stopBowDraw();
    audioManager.playBowRelease();

    this.arrowsReserve--;
    this.arrowInBow.visible = false;
    this.updateBowString(0);

    // Calculate Arrow velocity based on charge
    const charge = Math.min(1.0, this.chargeLevel);
    const speed = 15.0 + charge * 25.0; // 15 to 40 m/s
    const damage = Math.round(10.0 + charge * 20.0); // 10 to 30 damage

    // Spawn 3D Arrow projectile in world scene
    this.spawnArrowProjectile(speed, damage);
  }

  spawnArrowProjectile(speed, damage) {
    const arrowGroup = new THREE.Group();

    // Create arrow shaft
    const shaftGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.5);
    shaftGeom.rotateX(Math.PI / 2);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const shaft = new THREE.Mesh(shaftGeom, shaftMat);
    arrowGroup.add(shaft);

    // Arrow metal tip
    const tipGeom = new THREE.ConeGeometry(0.02, 0.05, 4);
    tipGeom.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.position.set(0, 0, -0.27);
    arrowGroup.add(tip);

    // Place arrow at camera origin
    arrowGroup.position.copy(this.camera.position);
    // Offset forward slightly to avoid self collision
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    arrowGroup.position.addScaledVector(dir, 0.5);

    // Align arrow rotation with camera direction
    arrowGroup.quaternion.copy(this.camera.quaternion);

    this.scene.add(arrowGroup);

    // Projectile object logic
    const arrowObj = {
      mesh: arrowGroup,
      velocity: dir.clone().multiplyScalar(speed),
      damage: damage,
      gravity: 9.8,
      lifeTimer: 0,
      isStuck: false
    };

    this.arrowsInFlight.push(arrowObj);
  }

  // Visual bullet or arrow impact particle effect
  createHitImpact(point, normal, colorCode) {
    const particleCount = 10;
    const particlesGeom = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions.push(point.x, point.y, point.z);
      // Explode outwards based on normal vector
      const spread = 0.5;
      positions.push();
      velocities.push(
        (normal.x + (Math.random() - 0.5) * spread) * (1 + Math.random() * 2),
        (normal.y + (Math.random() - 0.5) * spread) * (1 + Math.random() * 2),
        (normal.z + (Math.random() - 0.5) * spread) * (1 + Math.random() * 2)
      );
    }

    particlesGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: colorCode, size: 0.06, transparent: true, opacity: 0.8 });
    const pSystem = new THREE.Points(particlesGeom, pMat);
    this.scene.add(pSystem);

    let frames = 0;
    const updateParticles = () => {
      frames++;
      const posArr = pSystem.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3] += velocities[i * 3] * 0.016;
        posArr[i * 3 + 1] += velocities[i * 3 + 1] * 0.016;
        posArr[i * 3 + 2] += velocities[i * 3 + 2] * 0.016;
        
        // Gravity pull
        velocities[i * 3 + 1] -= 9.8 * 0.016;
      }
      pSystem.geometry.attributes.position.needsUpdate = true;
      pSystem.material.opacity -= 0.02;

      if (frames < 45 && pSystem.material.opacity > 0) {
        requestAnimationFrame(updateParticles);
      } else {
        this.scene.remove(pSystem);
        pSystem.geometry.dispose();
        pSystem.material.dispose();
      }
    };
    updateParticles();
  }

  // Update loop
  update(dt, player) {
    // 1. Recoil recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), dt * 10);
    this.recoilRotation.lerp(new THREE.Vector3(0, 0, 0), dt * 10);

    // Apply offset back to meshes
    if (this.activeType === 'pistol') {
      this.pistolMesh.position.set(0.2 - this.recoilOffset.x, -0.22 + this.recoilOffset.y, -0.45 + this.recoilOffset.z);
      this.pistolMesh.rotation.set(this.recoilRotation.x, -this.recoilRotation.y, this.recoilRotation.z);
    }

    // 2. Weapon Bobbing (Sway) when walking
    const isMoving = Math.abs(player.velocity.x) > 0.1 || Math.abs(player.velocity.z) > 0.1;
    if (isMoving && player.isGrounded) {
      const speedMult = player.isSprinting ? 2.2 : (player.isCrouching ? 0.6 : 1.2);
      this.bobTime += dt * 10 * speedMult;
      
      const bobY = Math.sin(this.bobTime * 2) * 0.018;
      const bobX = Math.cos(this.bobTime) * 0.01;
      
      if (this.activeType === 'pistol') {
        this.pistolMesh.position.y += bobY;
        this.pistolMesh.position.x += bobX;
      } else if (this.activeType === 'bow') {
        this.bowMesh.position.y += bobY;
        this.bowMesh.position.x += bobX;
      }
    }

    // 3. Reload Timer gun
    if (this.isReloading) {
      this.reloadTimer += dt;
      // Gun lowers and rises animation
      const halfReload = this.reloadDuration / 2;
      let yOffset = 0;
      if (this.reloadTimer < halfReload) {
        yOffset = -0.25 * (this.reloadTimer / halfReload); // drop down
      } else {
        yOffset = -0.25 * (1.0 - (this.reloadTimer - halfReload) / halfReload); // raise back
      }
      this.pistolMesh.position.y = -0.22 + yOffset;

      if (this.reloadTimer >= this.reloadDuration) {
        this.isReloading = false;
        // Refill clip
        const needed = this.ammoClipMax - this.ammoClip;
        const transferred = Math.min(needed, this.ammoReserve);
        this.ammoClip += transferred;
        this.ammoReserve -= transferred;
      }
    }

    // 4. Bow Draw Charge rate
    if (this.activeType === 'bow' && this.isDrawing) {
      this.drawTime += dt;
      this.chargeLevel = Math.min(1.0, this.drawTime / this.drawDuration);
      this.updateBowString(this.chargeLevel);
    }

    // 5. Update Projectile Arrows physics
    for (let i = this.arrowsInFlight.length - 1; i >= 0; i--) {
      const arrow = this.arrowsInFlight[i];
      if (arrow.isStuck) {
        arrow.lifeTimer += dt;
        if (arrow.lifeTimer > 10.0) { // Despawn stuck arrows after 10s
          this.scene.remove(arrow.mesh);
          // dispose arrow geometries
          arrow.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          this.arrowsInFlight.splice(i, 1);
        }
        continue;
      }

      // Projectile motion physics
      const prevPos = arrow.mesh.position.clone();
      arrow.mesh.position.addScaledVector(arrow.velocity, dt);
      arrow.velocity.y -= arrow.gravity * dt; // gravity drag
      
      // Orient arrow rotation along its velocity vector
      const targetDir = arrow.velocity.clone().normalize();
      const mx = new THREE.Matrix4().lookAt(new THREE.Vector3(), targetDir, new THREE.Vector3(0, 1, 0));
      const qt = new THREE.Quaternion().setFromRotationMatrix(mx);
      arrow.mesh.quaternion.copy(qt);

      // Boundary limits check
      if (arrow.mesh.position.y < 0) {
        // Stuck in ground!
        arrow.mesh.position.y = 0.02;
        arrow.isStuck = true;
        arrow.velocity.set(0, 0, 0);
        continue;
      }

      // Check collision with obstacles and enemies
      const arrowRay = new THREE.Raycaster(prevPos, targetDir, 0, prevPos.distanceTo(arrow.mesh.position));
      const intersects = arrowRay.intersectObjects(this.scene.children, true);
      
      let stuckHit = null;
      for (let j = 0; j < intersects.length; j++) {
        const obj = intersects[j].object;
        
        // Skip player, weapons and other active arrows
        if (obj.ancestorIsPlayer || this.camera.getObjectById(obj.id) || obj.id === arrow.mesh.id) {
          continue;
        }
        stuckHit = intersects[j];
        break;
      }

      if (stuckHit) {
        // Hit! Stop arrow movement and stick it
        arrow.mesh.position.copy(stuckHit.point);
        arrow.isStuck = true;
        arrow.velocity.set(0, 0, 0);
        
        this.createHitImpact(stuckHit.point, stuckHit.face.normal, 0x8b5a2b); // Brown wood dust particles

        // Dispath damage event
        const hitEvent = new CustomEvent('projectileHit', {
          detail: {
            object: stuckHit.object,
            point: stuckHit.point,
            damage: arrow.damage,
            headshot: stuckHit.object.name === 'monster_head',
            isSilent: true // Silent bow hits!
          }
        });
        window.dispatchEvent(hitEvent);
      }
    }
  }
}
export default WeaponSystem;
