import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { audioManager } from './audio.js';

export class WorldManager {
  constructor(scene) {
    this.scene = scene;

    // Environmental Lights
    this.ambientLight = null;
    this.moonLight = null;
    this.safeHouseLight = null;
    this.sirenLight = null;

    // Assets references
    this.colliders = []; // list of shapes for player collision
    this.interactables = []; // list of meshes that player can pick up / open
    
    // Atmospheric systems
    this.rainParticles = null;
    this.rainCount = 2000;
    this.rainGeometry = null;
    this.rainPositions = [];
    this.isHeavyRain = false;

    // Thunder triggers
    this.thunderTimer = 5.0; // Seconds between thunder
    this.flashActive = false;
    this.flashDuration = 0;

    // Animated objects
    this.rotorsToAnimate = [];
    this.helicopters = [];
    
    // Target board reference
    this.targetMesh = null;
    
    // Gun and Bow instances on table
    this.gunPickupMesh = null;
    this.bowPickupMesh = null;
    
    // Door reference
    this.doorMesh = null;
    this.doorOpened = false;

    // Loot boxes list
    this.lootBoxes = [];

    this.setupAtmosphere();
    this.generateTerrain();
    this.buildSafeHouse();
    this.buildRuinedCity();
    this.setupShootingRange();
  }

  setupAtmosphere() {
    // Fog: Dark post-apocalyptic grey-green fog
    this.scene.background = new THREE.Color(0x06070a);
    this.scene.fog = new THREE.FogExp2(0x06070a, 0.035);

    // Ambient light: Low moonlight fill
    this.ambientLight = new THREE.AmbientLight(0x0f111a, 0.2);
    this.scene.add(this.ambientLight);

    // Directional light: Deep blue moon light casting soft shadows
    this.moonLight = new THREE.DirectionalLight(0x3a4f66, 0.4);
    this.moonLight.position.set(20, 40, -10);
    this.scene.add(this.moonLight);

    // Rain Particle System
    this.rainGeometry = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < this.rainCount; i++) {
      positions.push(
        (Math.random() - 0.5) * 100, // X
        Math.random() * 40,          // Y
        (Math.random() - 0.5) * 100  // Z
      );
    }
    this.rainPositions = new Float32Array(positions);
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    // Nice rain material: small vertical streaks
    const rainMat = new THREE.PointsMaterial({
      color: 0x5a6f80,
      size: 0.15,
      transparent: true,
      opacity: 0.5
    });

    this.rainParticles = new THREE.Points(this.rainGeometry, rainMat);
    this.scene.add(this.rainParticles);
  }

  // Large metal/concrete textured floor plate
  generateTerrain() {
    const floorGeom = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x141416, 
      roughness: 0.9, 
      metalness: 0.2 
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Adding decorative green mud spots / gravel meshes
    for (let i = 0; i < 40; i++) {
      const gGeom = new THREE.BoxGeometry(2 + Math.random() * 5, 0.02, 2 + Math.random() * 5);
      const gMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.95 });
      const gravel = new THREE.Mesh(gGeom, gMat);
      gravel.position.set(
        (Math.random() - 0.5) * 90,
        0.005,
        (Math.random() - 0.5) * 90
      );
      this.scene.add(gravel);
    }
  }

  buildSafeHouse() {
    const safeHouseGroup = new THREE.Group();
    safeHouseGroup.position.set(0, 0, 15); // Located in positive Z quadrant

    const wallsMat = new THREE.MeshStandardMaterial({ color: 0x423830, roughness: 0.8 }); // wood planks
    const metalRoofMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.7, roughness: 0.4 });

    // House Dimensions: width:8, height:3.5, depth:6
    // Back wall
    const backWallGeom = new THREE.BoxGeometry(8, 3.5, 0.2);
    const backWall = new THREE.Mesh(backWallGeom, wallsMat);
    backWall.position.set(0, 1.75, 3);
    safeHouseGroup.add(backWall);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(0, 1.75, 18), size: new THREE.Vector3(8, 3.5, 0.2) });

    // Left wall
    const leftWallGeom = new THREE.BoxGeometry(0.2, 3.5, 6);
    const leftWall = new THREE.Mesh(leftWallGeom, wallsMat);
    leftWall.position.set(-4, 1.75, 0);
    safeHouseGroup.add(leftWall);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(-4, 1.75, 15), size: new THREE.Vector3(0.2, 3.5, 6) });

    // Right wall
    const rightWallGeom = new THREE.BoxGeometry(0.2, 3.5, 6);
    const rightWall = new THREE.Mesh(rightWallGeom, wallsMat);
    rightWall.position.set(4, 1.75, 0);
    safeHouseGroup.add(rightWall);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(4, 1.75, 15), size: new THREE.Vector3(0.2, 3.5, 6) });

    // Front wall with opening for door (left partition)
    const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 0.2), wallsMat);
    frontWallLeft.position.set(-2.5, 1.75, -3);
    safeHouseGroup.add(frontWallLeft);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(-2.5, 1.75, 12), size: new THREE.Vector3(3, 3.5, 0.2) });

    // Front wall right partition
    const frontWallRight = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 0.2), wallsMat);
    frontWallRight.position.set(2.5, 1.75, -3);
    safeHouseGroup.add(frontWallRight);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(2.5, 1.75, 12), size: new THREE.Vector3(3, 3.5, 0.2) });

    // Header above door
    const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(2, 1.0, 0.2), wallsMat);
    doorHeader.position.set(0, 3.0, -3);
    safeHouseGroup.add(doorHeader);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(0, 3.0, 12), size: new THREE.Vector3(2, 1.0, 0.2) });

    // Roof
    const roofGeom = new THREE.BoxGeometry(8.6, 0.15, 6.6);
    const roof = new THREE.Mesh(roofGeom, metalRoofMat);
    roof.position.set(0, 3.5, 0);
    safeHouseGroup.add(roof);

    // Warm Light inside
    this.safeHouseLight = new THREE.PointLight(0xffaa44, 1.5, 12.0);
    this.safeHouseLight.position.set(0, 2.5, 0);
    safeHouseGroup.add(this.safeHouseLight);

    // Indoor Furnishings: Bed & Table
    // Bed frame
    const bedGeom = new THREE.BoxGeometry(1.2, 0.4, 2.0);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x3d3025, roughness: 0.95 });
    const bed = new THREE.Mesh(bedGeom, bedMat);
    bed.position.set(-2.8, 0.2, 1.8);
    safeHouseGroup.add(bed);
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(-2.8, 0.2, 16.8), size: new THREE.Vector3(1.2, 0.4, 2.0) });

    // Bed pillow
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0xbbbbbb }));
    pillow.position.set(-2.8, 0.45, 2.6);
    safeHouseGroup.add(pillow);

    // Table
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), bedMat);
    tableTop.position.set(2.5, 0.8, 0);
    safeHouseGroup.add(tableTop);
    
    const tableLegGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
    const leg1 = new THREE.Mesh(tableLegGeom, bedMat); leg1.position.set(1.9, 0.4, 0.3); safeHouseGroup.add(leg1);
    const leg2 = new THREE.Mesh(tableLegGeom, bedMat); leg2.position.set(3.1, 0.4, 0.3); safeHouseGroup.add(leg2);
    const leg3 = new THREE.Mesh(tableLegGeom, bedMat); leg3.position.set(1.9, 0.4, -0.3); safeHouseGroup.add(leg3);
    const leg4 = new THREE.Mesh(tableLegGeom, bedMat); leg4.position.set(3.1, 0.4, -0.3); safeHouseGroup.add(leg4);
    
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(2.5, 0.4, 15), size: new THREE.Vector3(1.6, 0.8, 0.9) });

    // Table Interactive Items: Gun & Bow placement
    // 1. Pistol Pickup
    const gunGroup = new THREE.Group();
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.04), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    grip.position.set(0, -0.04, -0.04); grip.rotation.x = -0.3;
    gunGroup.add(slide, grip);
    gunGroup.position.set(2.2, 0.88, 0.1);
    gunGroup.rotation.y = 0.5;
    gunGroup.name = 'pickup_gun';
    safeHouseGroup.add(gunGroup);
    this.gunPickupMesh = gunGroup;
    this.interactables.push({ mesh: gunGroup, type: 'gun', label: 'PRESS E TO TAKE HANDGUN' });

    // 2. Bow Pickup
    const bowGroup = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6), new THREE.MeshStandardMaterial({ color: 0x3d2010 }));
    arch.rotation.x = Math.PI / 2;
    bowGroup.add(arch);
    bowGroup.position.set(2.6, 0.86, -0.2);
    bowGroup.rotation.y = -0.8;
    bowGroup.name = 'pickup_bow';
    safeHouseGroup.add(bowGroup);
    this.bowPickupMesh = bowGroup;
    this.interactables.push({ mesh: bowGroup, type: 'bow', label: 'PRESS E TO TAKE BOW' });

    // Interactable Safe House Entrance Door
    const doorFrame = new THREE.Group();
    doorFrame.position.set(0, 0, -3.0); // local to safehouse, centered at x:0, z: -3 (world z:12)
    
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a2d0c, metalness: 0.1 }));
    door.position.set(0.95, 1.25, 0); // pivot at door left side hinge
    doorFrame.add(door);
    safeHouseGroup.add(doorFrame);
    this.doorMesh = doorFrame;
    this.doorCollider = { type: 'box', pos: new THREE.Vector3(0, 1.25, 12), size: new THREE.Vector3(2, 2.5, 0.3) };
    this.colliders.push(this.doorCollider);
    this.interactables.push({ mesh: door, type: 'door', label: 'PRESS E TO INTERACT DOOR' });

    // Add safehouse group to scene
    this.scene.add(safeHouseGroup);
  }

  // Procedural concrete ruins, street lamps, foliage, helicopters flybys
  buildRuinedCity() {
    const wallSegments = 24;
    const boundaryRadius = 45;
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x4f5259, roughness: 0.95 });
    
    // 1. Boundary Wall Ruins (keeps player inside the level limits)
    for (let i = 0; i < wallSegments; i++) {
      const angle = (i / wallSegments) * Math.PI * 2;
      const x = Math.cos(angle) * boundaryRadius;
      const z = Math.sin(angle) * boundaryRadius;
      
      const width = 8 + Math.random() * 8;
      const height = 4 + Math.random() * 8;
      const depth = 2.0;

      const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), concreteMat);
      block.position.set(x, height / 2, z);
      block.rotation.y = -angle + (Math.random() - 0.5) * 0.5;
      this.scene.add(block);
      
      const rotatedSize = new THREE.Vector3(width, height, depth).applyAxisAngle(new THREE.Vector3(0, 1, 0), block.rotation.y);
      rotatedSize.x = Math.abs(rotatedSize.x);
      rotatedSize.y = Math.abs(rotatedSize.y);
      rotatedSize.z = Math.abs(rotatedSize.z);

      this.colliders.push({
        type: 'box',
        pos: block.position.clone(),
        size: rotatedSize
      });
    }

    // 2. Street Lamps with blinking orange warnings
    const lampGeom = new THREE.CylinderGeometry(0.06, 0.06, 4.0);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x00ff78 });
    
    const lampPositions = [
      new THREE.Vector3(-15, 0, 5),
      new THREE.Vector3(15, 0, 5),
      new THREE.Vector3(-12, 0, -18),
      new THREE.Vector3(12, 0, -18)
    ];

    lampPositions.forEach((pos, idx) => {
      const post = new THREE.Mesh(lampGeom, concreteMat);
      post.position.set(pos.x, 2.0, pos.z);
      this.scene.add(post);
      
      this.colliders.push({ type: 'cylinder', pos: new THREE.Vector3(pos.x, 2, pos.z), radius: 0.15, height: 4.0 });

      // Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), concreteMat);
      arm.position.set(pos.x + 0.35, 4.0, pos.z);
      this.scene.add(arm);

      // Light glow bulb
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), glassMat);
      bulb.position.set(pos.x + 0.7, 3.9, pos.z);
      this.scene.add(bulb);

      // Spotlight down
      const light = new THREE.SpotLight(0x00ffaa, 1.2, 10.0, Math.PI / 4, 0.5, 1);
      light.position.set(pos.x + 0.7, 3.8, pos.z);
      light.target.position.set(pos.x + 0.7, 0, pos.z);
      this.scene.add(light);
      this.scene.add(light.target);
    });

    // 3. Flashing Red Emergency Siren Lamp (On top of Safe House roof)
    const sirenPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), concreteMat);
    sirenPole.position.set(0, 3.8, 15);
    this.scene.add(sirenPole);

    const sirenCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    sirenCap.position.set(0, 4.1, 15);
    this.scene.add(sirenCap);

    this.sirenLight = new THREE.PointLight(0xff0000, 0, 15.0); // start off
    this.sirenLight.position.set(0, 4.15, 15);
    this.scene.add(this.sirenLight);

    // 4. Destroyed concrete blocks / piles of bricks
    for (let i = 0; i < 20; i++) {
      const bx = (Math.random() - 0.5) * 60;
      const bz = (Math.random() - 0.5) * 60;
      
      // Avoid placing debris directly in safe house yard center
      if (Math.sqrt(bx*bx + bz*bz) < 10) continue;

      const size = 1.0 + Math.random() * 2.0;
      const pile = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), concreteMat);
      pile.position.set(bx, size / 2, bz);
      pile.rotation.set(Math.random(), Math.random(), Math.random());
      this.scene.add(pile);
      
      this.colliders.push({ type: 'box', pos: pile.position.clone(), size: new THREE.Vector3(size, size, size) });
    }
  }

  setupShootingRange() {
    // 1. Target Board structure outside
    const standMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const targetGroup = new THREE.Group();
    targetGroup.position.set(0, 0, -12); // placed 12 units in front of safehouse exit

    // Posts
    const postGeom = new THREE.BoxGeometry(0.08, 2.0, 0.08);
    const leftPost = new THREE.Mesh(postGeom, standMat); leftPost.position.set(-0.6, 1.0, 0); targetGroup.add(leftPost);
    const rightPost = new THREE.Mesh(postGeom, standMat); rightPost.position.set(0.6, 1.0, 0); targetGroup.add(rightPost);
    
    // Crossbar
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), standMat);
    crossbar.position.set(0, 1.8, 0);
    targetGroup.add(crossbar);

    // Outer Target ring (Red cylinder)
    const targetRingGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.05);
    targetRingGeom.rotateX(Math.PI / 2);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ringMesh = new THREE.Mesh(targetRingGeom, redMat);
    ringMesh.position.set(0, 1.2, 0);
    ringMesh.name = 'target_board'; // reference name for raycaster
    targetGroup.add(ringMesh);
    this.targetMesh = ringMesh;

    // White ring
    const whiteRingGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.06);
    whiteRingGeom.rotateX(Math.PI / 2);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const whiteMesh = new THREE.Mesh(whiteRingGeom, whiteMat);
    whiteMesh.position.set(0, 1.2, 0.01);
    whiteMesh.name = 'target_board';
    targetGroup.add(whiteMesh);

    // Center Bullseye (Red)
    const bullseyeGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.07);
    bullseyeGeom.rotateX(Math.PI / 2);
    const bullseyeMesh = new THREE.Mesh(bullseyeGeom, redMat);
    bullseyeMesh.position.set(0, 1.2, 0.02);
    bullseyeMesh.name = 'target_board_bullseye';
    targetGroup.add(bullseyeMesh);

    this.scene.add(targetGroup);
    
    this.colliders.push({ type: 'box', pos: new THREE.Vector3(0, 1.0, -12), size: new THREE.Vector3(1.4, 2.0, 0.2) });
  }

  // --- Helicopter Spawn for Cinematic Story ---
  spawnHelicopter() {
    const heliGroup = new THREE.Group();
    heliGroup.position.set(-60, 22, -20); // Fly left-to-right

    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x0c0f14 });

    // Fuselage box silhouette
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.2, 1.0), bodyMat);
    heliGroup.add(body);

    // Tail boom
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.3, 0.3), bodyMat);
    tail.position.set(-3.2, 0.3, 0);
    heliGroup.add(tail);

    // Tail rotor fin
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.3), bodyMat);
    tailFin.position.set(-4.6, 0.6, 0);
    heliGroup.add(tailFin);

    // Main Rotor shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), bodyMat);
    shaft.position.set(0.2, 0.8, 0);
    heliGroup.add(shaft);

    // Rotor blades (line/box)
    const blades = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.02, 0.2), bodyMat);
    blades.position.set(0.2, 1.0, 0);
    heliGroup.add(blades);

    this.rotorsToAnimate.push(blades);

    // Spotlight pointing down
    const heliLight = new THREE.SpotLight(0xffffff, 4.0, 30.0, Math.PI / 8, 0.6, 1.0);
    heliLight.position.set(0.2, -0.4, 0);
    heliLight.target.position.set(10.0, -22.0, 0); // slant forward
    heliGroup.add(heliLight);
    heliGroup.add(heliLight.target);

    this.scene.add(heliGroup);
    this.helicopters.push({ group: heliGroup, velocity: new THREE.Vector3(20, 0, 5), duration: 0 }); // fly speed 20m/s
  }

  // --- Dynamic Loot Drop System ---
  spawnLootBox(position) {
    const boxGroup = new THREE.Group();
    boxGroup.position.copy(position);
    boxGroup.position.y = 0.25;

    // Glowing outline box
    const boxGeom = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const boxMat = new THREE.MeshStandardMaterial({ 
      color: 0x00ff78, 
      emissive: 0x00ff78, 
      emissiveIntensity: 0.5,
      roughness: 0.5 
    });
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);
    boxGroup.add(boxMesh);

    // Pulsating point light
    const glowLight = new THREE.PointLight(0x00ff78, 1.0, 3.0);
    glowLight.position.set(0, 0.3, 0);
    boxGroup.add(glowLight);

    boxGroup.name = 'loot_box';
    this.scene.add(boxGroup);

    // Store loot box object info
    const lootObj = {
      mesh: boxGroup,
      light: glowLight,
      type: Math.random() > 0.4 ? 'ammo' : 'health', // 60% ammo, 40% health medkit
      pulseTimer: 0
    };
    this.lootBoxes.push(lootObj);
    this.interactables.push({ mesh: boxMesh, type: 'loot', reference: lootObj, label: 'PRESS E TO COLLECT SUPPLIES' });
  }

  removeLootBox(lootObj) {
    // Remove from scene and memory
    this.scene.remove(lootObj.mesh);
    lootObj.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    
    // Remove from interactables list
    this.interactables = this.interactables.filter(item => item.reference !== lootObj);
    this.lootBoxes = this.lootBoxes.filter(box => box !== lootObj);
  }

  // Toggle night conditions
  setNightSurvivalMode(enable) {
    this.isHeavyRain = enable;
    this.setRainIntensity(enable);

    if (enable) {
      // Alarm red ambient
      this.ambientLight.color.setHex(0x220505);
      this.moonLight.color.setHex(0x551111); // red moon
      this.moonLight.intensity = 0.3;
    } else {
      this.ambientLight.color.setHex(0x0f111a);
      this.moonLight.color.setHex(0x3a4f66);
      this.moonLight.intensity = 0.4;
      this.sirenLight.intensity = 0;
    }
  }

  update(dt) {
    if (dt > 0.1) dt = 0.1;

    // 1. Update rain particle falling simulation
    if (this.rainParticles) {
      const positions = this.rainGeometry.attributes.position.array;
      const count = this.rainCount;
      const speed = this.isHeavyRain ? 25.0 : 12.0;

      for (let i = 0; i < count; i++) {
        // Fall down
        positions[i * 3 + 1] -= speed * dt;
        
        // Blow slightly in the wind (X axis)
        positions[i * 3] += 1.5 * dt;

        // Reset if hits floor
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 30 + Math.random() * 10;
          positions[i * 3] = (Math.random() - 0.5) * 100;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }

    // 2. Thunder flash trigger timer
    this.thunderTimer -= dt;
    if (this.thunderTimer <= 0) {
      this.thunderTimer = 10.0 + Math.random() * 20.0; // Random interval
      this.flashActive = true;
      this.flashDuration = 0.15 + Math.random() * 0.15; // strike duration
      audioManager.playThunder();
    }

    if (this.flashActive) {
      this.flashDuration -= dt;
      if (this.flashDuration > 0) {
        // Sky flashing bright white lighting
        this.scene.background.setHex(0xbabcc4);
        this.scene.fog.color.setHex(0xbabcc4);
        this.moonLight.intensity = 2.5;
      } else {
        this.flashActive = false;
        // Restore dark sky colors
        const skyColor = this.isHeavyRain ? 0x030305 : 0x06070a;
        this.scene.background.setHex(skyColor);
        this.scene.fog.color.setHex(skyColor);
        this.moonLight.intensity = this.isHeavyRain ? 0.3 : 0.4;
      }
    }

    // 3. Rotating Red Alarm Siren light on Safe House roof
    if (audioManager.sirenActive && this.sirenLight) {
      // Pulse intensity up and down
      const pulse = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;
      this.sirenLight.intensity = 2.0 + pulse * 4.0;
    }

    // 4. Rotor blades rotations
    this.rotorsToAnimate.forEach(r => {
      r.rotation.y += 35 * dt; // Rotate very fast
    });

    // 5. Helicopters trajectories
    for (let i = this.helicopters.length - 1; i >= 0; i--) {
      const heli = this.helicopters[i];
      heli.group.position.addScaledVector(heli.velocity, dt);
      heli.duration += dt;
      
      if (heli.duration > 8.0) { // Despawn after 8 seconds flight
        this.scene.remove(heli.group);
        // dispose structures
        heli.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.helicopters.splice(i, 1);
        
        // Remove blades reference
        this.rotorsToAnimate = this.rotorsToAnimate.filter(r => !heli.group.getObjectById(r.id));
      }
    }

    // 6. Loot box chest glows pulsing animation
    this.lootBoxes.forEach(box => {
      box.pulseTimer += dt * 3.5;
      const intensity = 0.5 + Math.sin(box.pulseTimer) * 0.4;
      box.light.intensity = intensity;
      box.mesh.rotation.y += dt * 0.8;
    });

    // 7. Door swing opening visual transition
    if (this.doorOpened && this.doorMesh) {
      // Swing door open 90 degrees around Y (pivot hinge)
      const targetRot = -Math.PI / 2;
      this.doorMesh.children[0].rotation.y += (targetRot - this.doorMesh.children[0].rotation.y) * 4 * dt;
    }
  }

  // Open Door action
  openDoor() {
    if (this.doorOpened) return;
    this.doorOpened = true;
    audioManager.playDoorInteract();
    
    // Remove door collider from list to let player walk through doorframe!
    this.colliders = this.colliders.filter(c => c !== this.doorCollider);
  }
}
export default WorldManager;
