import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { audioManager } from './audio.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { WorldManager } from './world.js';
import { MonsterManager } from './monsters.js';
import { UIManager } from './ui.js';

class Game {
  constructor() {
    this.state = 'MENU'; // 'MENU', 'DEV_INTRO', 'CINEMATIC', 'BRIEFING', 'GAMEPLAY', 'GAMEOVER', 'VICTORY'
    this.clock = new THREE.Clock();
    
    // Core Graphics
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Game systems
    this.audio = audioManager;
    this.worldManager = new WorldManager(this.scene);
    this.player = new Player(this.camera, this.renderer.domElement);
    this.weaponSystem = new WeaponSystem(this.camera, this.scene);
    this.monsterManager = new MonsterManager(this.scene, this.player, this.worldManager);
    this.uiManager = new UIManager(this);

    // Give player reference of colliders
    this.player.setColliders(this.worldManager.colliders);

    // Inventory status counts
    this.medkitsCount = 0;
    this.suppliesCount = 0;

    // Survival Mode timing
    this.nightModeActive = false;
    this.simulatedHour = 18;
    this.simulatedMinute = 0;
    this.survivalTimer = 0;
    this.monstersKilled = 0;

    // Tutorial Progression State
    this.tutorialActive = false;
    this.currentTutorialStep = 1; // 1 to 15
    this.tutorialChecklist = {
      moved: false,
      looked: false,
      jumped: false,
      sprinted: false,
      crouched: false,
      openedDoor: false,
      pickedGun: false,
      reloaded: false,
      shotTarget: false,
      pickedBow: false,
      shotArrow: false,
      killedMonster: false,
      pickedLoot: false,
      openedInventory: false,
      escaped: false
    };

    // Keep track of target monster for tutorial step 12
    this.tutorialMonster = null;

    // Handle Window Resizing
    window.addEventListener('resize', () => this.onWindowResize());

    // Setup input routing
    this.setupControls();
    
    // Setup event routing from subsystems
    this.setupEvents();
  }

  // Window resize handler
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupControls() {
    // 1. Start Button click
    document.getElementById('start-btn').addEventListener('click', () => {
      this.startIntroSequence();
    });

    // 2. Skip Cinematic click
    document.getElementById('skip-cinematic-btn').addEventListener('click', () => {
      this.skipCinematic();
    });

    // 3. Accept Mission click
    document.getElementById('accept-mission-btn').addEventListener('click', () => {
      this.acceptMission();
    });

    // 4. Try Again Game Over Restart click
    document.getElementById('restart-btn').addEventListener('click', () => {
      this.restartGame();
    });

    // 5. Escape Key listener for Pointer Lock toggling
    document.addEventListener('pointerlockchange', () => {
      const cover = document.getElementById('pointerlock-cover');
      if (document.pointerLockElement === this.renderer.domElement) {
        // Pointer Locked! Resume gameplay
        if (this.state === 'GAMEPLAY' && !this.uiManager.invOverlay.classList.contains('active')) {
          cover.classList.remove('active');
        }
      } else {
        // Pointer Released! Pause view if during gameplay (and inventory is closed)
        if (this.state === 'GAMEPLAY' && !this.uiManager.invOverlay.classList.contains('active')) {
          cover.classList.add('active');
        }
      }
    });

    // Resume click
    document.getElementById('pointerlock-cover').addEventListener('click', () => {
      if (this.state === 'GAMEPLAY' && !this.uiManager.invOverlay.classList.contains('active')) {
        this.renderer.domElement.requestPointerLock();
      }
    });

    // 6. Gameplay triggers: Shoot & Interact keys
    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'GAMEPLAY') return;
      if (document.pointerLockElement !== this.renderer.domElement) return;

      if (e.button === 0) { // Left Click
        this.weaponSystem.inputPress();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.state !== 'GAMEPLAY') return;

      if (e.button === 0) { // Left Click
        this.weaponSystem.inputRelease();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (this.state !== 'GAMEPLAY') return;

      // E Key - Interact
      if (e.code === 'KeyE') {
        this.handleInteraction();
      }

      // R Key - Reload
      if (e.code === 'KeyR') {
        this.weaponSystem.reload();
      }

      // Tab or I Key - Toggle Inventory Backpack
      if (e.code === 'Tab' || e.code === 'KeyI') {
        e.preventDefault();
        this.toggleInventory();
      }
    });
  }

  setupEvents() {
    // 1. Raycast collision events for target hit scoring or headshots
    window.addEventListener('projectileHit', (e) => {
      const { object, damage, headshot } = e.detail;
      
      // If we are shooting the target range board
      if (object.name === 'target_board' || object.name === 'target_board_bullseye') {
        // If center bulls eye, give double scoring
        const isCenter = object.name === 'target_board_bullseye';
        
        // Show hit spark/text alert on target
        if (this.tutorialActive && this.currentTutorialStep === 9) {
          this.tutorialChecklist.shotTarget = true;
        }

        // Trigger brief visual crosshair red scale
        const crosshair = document.getElementById('crosshair');
        crosshair.className = 'crosshair-target';
        setTimeout(() => crosshair.className = 'crosshair-normal', 150);
      }
    });

    // 2. Headshot score popups
    window.addEventListener('headshotAlert', (e) => {
      const { dmg } = e.detail;
      this.uiManager.triggerAlert("HEADSHOT!", `CRITICAL HIT DEALT: ${dmg} DMG`, 1500);
    });

    // 3. Monsters killed callbacks
    window.addEventListener('monsterKilled', () => {
      this.monstersKilled++;
      
      if (this.tutorialActive && this.currentTutorialStep === 12) {
        this.tutorialChecklist.killedMonster = true;
      }
    });
  }

  // --- State Transitions Controllers ---

  startIntroSequence() {
    this.state = 'DEV_INTRO';
    this.audio.init();
    this.audio.resume();

    // Hide Start Screen
    this.uiManager.showOverlay('devIntro');

    // Wait 4 seconds for Developer Credits to play
    setTimeout(() => {
      if (this.state === 'DEV_INTRO') {
        this.startCinematic();
      }
    }, 4500);
  }

  startCinematic() {
    this.state = 'CINEMATIC';
    this.uiManager.showOverlay('cinematic');

    // Spawn flight of helicopters inside cinematic background sky
    setTimeout(() => {
      if (this.state === 'CINEMATIC') {
        this.worldManager.spawnHelicopter();
      }
    }, 2000);
    
    setTimeout(() => {
      if (this.state === 'CINEMATIC') {
        this.worldManager.spawnHelicopter();
      }
    }, 4500);

    // Play storytelling typewriter lines
    this.uiManager.playStoryCinematic(() => {
      this.showMissionBriefing();
    });
  }

  skipCinematic() {
    this.state = 'BRIEFING';
    this.showMissionBriefing();
  }

  showMissionBriefing() {
    this.state = 'BRIEFING';
    this.uiManager.showOverlay('briefing');
    this.audio.startAmbientMusic(); // Pulses tense music pads
  }

  acceptMission() {
    this.state = 'GAMEPLAY';
    this.uiManager.hideAllOverlays();
    
    // Show HUD
    document.getElementById('hud').classList.remove('hidden');

    // Request pointer lock
    this.renderer.domElement.requestPointerLock();

    // Trigger waking up inside safe house cabin bed
    this.player.triggerWakeUpAnimation(() => {
      this.startTutorial();
    });
  }

  startTutorial() {
    this.tutorialActive = true;
    this.currentTutorialStep = 1;
    this.uiManager.setTutorialStepActive(1);
  }

  // --- Interactive Tutorial Steps checking ---
  checkTutorialProgression(dt) {
    if (!this.tutorialActive) return;

    switch (this.currentTutorialStep) {
      case 1: // WASD move
        if (this.player.keys.w || this.player.keys.a || this.player.keys.s || this.player.keys.d) {
          this.tutorialChecklist.moved = true;
          this.completeTutorialStep(1, 2);
        }
        break;
        
      case 2: // Look mouse
        // check if pitch or yaw moved
        if (Math.abs(this.player.pitch) > 0.05 || Math.abs(this.player.yaw - Math.PI) > 0.05) {
          this.tutorialChecklist.looked = true;
          this.completeTutorialStep(2, 3);
        }
        break;
        
      case 3: // Jump Space
        if (this.player.keys.Space) {
          this.tutorialChecklist.jumped = true;
          this.completeTutorialStep(3, 4);
        }
        break;
        
      case 4: // Sprint Shift
        if (this.player.isSprinting) {
          this.tutorialChecklist.sprinted = true;
          this.completeTutorialStep(4, 5);
        }
        break;
        
      case 5: // Crouch C
        if (this.player.isCrouching) {
          this.tutorialChecklist.crouched = true;
          this.completeTutorialStep(5, 6);
        }
        break;
        
      case 6: // Interact door
        // Checking if door is opened (via E click near door)
        if (this.worldManager.doorOpened) {
          this.tutorialChecklist.openedDoor = true;
          this.completeTutorialStep(6, 7);
        }
        break;
        
      case 7: // Pick up Gun
        if (this.weaponSystem.gunUnlocked) {
          this.tutorialChecklist.pickedGun = true;
          // Set starting clip ammo to 3, forcing reload check next!
          this.weaponSystem.ammoClip = 3;
          this.completeTutorialStep(7, 8);
        }
        break;
        
      case 8: // Reload R
        // Trigger reload when ammo is fully replenished
        if (this.weaponSystem.ammoClip === this.weaponSystem.ammoClipMax) {
          this.tutorialChecklist.reloaded = true;
          this.completeTutorialStep(8, 9);
        }
        break;
        
      case 9: // Shoot Target
        if (this.tutorialChecklist.shotTarget) {
          this.completeTutorialStep(9, 10);
        }
        break;
        
      case 10: // Pick up Bow
        if (this.weaponSystem.bowUnlocked) {
          this.tutorialChecklist.pickedBow = true;
          this.completeTutorialStep(10, 11);
        }
        break;
        
      case 11: // Charge and shoot arrow
        // Check if arrows in flight are spawned
        if (this.weaponSystem.arrowsInFlight.length > 0) {
          this.tutorialChecklist.shotArrow = true;
          this.completeTutorialStep(11, 12);
          
          // Spawn the tutorial monster in the yard yard center!
          this.tutorialMonster = this.monsterManager.spawn(new THREE.Vector3(0, 0, -2));
          this.tutorialMonster.health = 25; // weaker
        }
        break;
        
      case 12: // Defeat first monster
        if (this.tutorialChecklist.killedMonster || this.tutorialMonster.health <= 0) {
          this.completeTutorialStep(12, 13);
        }
        break;
        
      case 13: // Collect loot
        if (this.tutorialChecklist.pickedLoot) {
          this.completeTutorialStep(13, 14);
        }
        break;
        
      case 14: // Open inventory
        if (this.uiManager.invOverlay.classList.contains('active')) {
          this.tutorialChecklist.openedInventory = true;
          
          // Prompt user to close it to progress
          this.uiManager.objectiveDesc.textContent = "Close inventory backpack (Tab / I).";
        } else if (this.tutorialChecklist.openedInventory && !this.uiManager.invOverlay.classList.contains('active')) {
          this.completeTutorialStep(14, 15);
        }
        break;
        
      case 15: // Reach Safe House
        // Check if player position is back inside coordinates of safehouse cabin
        const dx = this.player.position.x;
        const dz = this.player.position.z;
        if (dz > 12.5 && dz < 17.5 && dx > -3.5 && dx < 3.5) {
          this.tutorialChecklist.escaped = true;
          this.completeTutorialStep(15, null);
          this.endTutorialStartNight();
        }
        break;
    }
  }

  completeTutorialStep(stepNum, nextStepNum) {
    this.uiManager.markTutorialStepCompleted(stepNum);
    
    if (nextStepNum) {
      this.currentTutorialStep = nextStepNum;
      this.uiManager.setTutorialStepActive(nextStepNum);
    } else {
      this.tutorialActive = false;
    }
  }

  // --- Transition: Night Outbreak Outfall siren ---
  endTutorialStartNight() {
    this.uiManager.hideTutorialPanel();
    this.uiManager.objectiveDesc.style.color = '#ff2828';
    this.uiManager.objectiveDesc.textContent = "SURVIVE UNTIL DAWN!";
    
    // Play alert siren!
    this.audio.playSiren();
    
    // Set night aesthetic
    this.worldManager.setNightSurvivalMode(true);
    
    // Display giant cinematic warning text
    this.uiManager.triggerAlert("NIGHT HAS FALLEN...", "SURVIVE UNTIL DAWN", 5000);

    // After 8s, siren sound finishes and real waves spawn begins
    setTimeout(() => {
      this.audio.stopSiren();
      this.nightModeActive = true;
      this.simulatedHour = 23; // midnight falls
      this.simulatedMinute = 0;
    }, 8000);
  }

  // --- Interaction (E key handler) ---
  handleInteraction() {
    // Check closest interactable within 2.5m
    let closest = null;
    let minDist = 2.5;

    this.worldManager.interactables.forEach(item => {
      // Find distance on XZ plane
      const dx = item.mesh.position.x - this.player.position.x;
      // Adjusting local vs world position for safehouse table meshes
      const worldPos = new THREE.Vector3();
      item.mesh.getWorldPosition(worldPos);

      const dX = worldPos.x - this.player.position.x;
      const dZ = worldPos.z - this.player.position.z;
      const dist = Math.sqrt(dX * dX + dZ * dZ);

      if (dist < minDist) {
        minDist = dist;
        closest = item;
      }
    });

    if (closest) {
      if (closest.type === 'door') {
        // Only allow opening door on tutorial step 6
        if (this.tutorialActive && this.currentTutorialStep < 6) return;
        this.worldManager.openDoor();
      } 
      else if (closest.type === 'gun') {
        if (this.tutorialActive && this.currentTutorialStep !== 7) return;
        this.weaponSystem.unlockWeapon('pistol');
        this.scene.remove(this.worldManager.gunPickupMesh); // remove mesh from table
        this.worldManager.interactables = this.worldManager.interactables.filter(i => i.type !== 'gun');
        
        this.weaponSystem.ammoReserve = 14; // Give starting ammo
        audioManager.playPickup();
      } 
      else if (closest.type === 'bow') {
        if (this.tutorialActive && this.currentTutorialStep !== 10) return;
        this.weaponSystem.unlockWeapon('bow');
        this.scene.remove(this.worldManager.bowPickupMesh); // remove from table
        this.worldManager.interactables = this.worldManager.interactables.filter(i => i.type !== 'bow');
        
        this.weaponSystem.arrowsReserve = 5; // Give arrows
        audioManager.playPickup();
      } 
      else if (closest.type === 'loot') {
        const box = closest.reference;
        
        if (box.type === 'ammo') {
          this.weaponSystem.ammoReserve += 14;
          this.weaponSystem.arrowsReserve += 3;
          this.uiManager.triggerAlert("SUPPLIES COLLECTED", "+14 Pistol Ammo, +3 Arrows", 2000);
        } else {
          this.medkitsCount++;
          this.uiManager.triggerAlert("MEDKIT COLLECTED", "+1 Survivor Medkit", 2000);
        }

        // Play sound and complete tutorial check step 13
        audioManager.playPickup();
        
        if (this.tutorialActive && this.currentTutorialStep === 13) {
          this.tutorialChecklist.pickedLoot = true;
        }

        this.worldManager.removeLootBox(box);
      }
    }
  }

  // Show / Hide Inventory
  toggleInventory() {
    const inv = this.uiManager.invOverlay;
    const isVisible = inv.classList.contains('active');

    if (this.state !== 'GAMEPLAY') return;

    if (isVisible) {
      inv.classList.remove('active');
      this.renderer.domElement.requestPointerLock();
    } else {
      inv.classList.add('active');
      document.exitPointerLock();
      
      // Update inventory screen contents count
      this.uiManager.updateInventoryCounts();
      this.uiManager.updateItemDetails('pistol');
    }
  }

  // --- Game Over Trigger ---
  triggerGameOver() {
    this.state = 'GAMEOVER';
    document.exitPointerLock();
    
    // Set death overlay
    document.getElementById('stat-monsters-killed').textContent = this.monstersKilled;
    
    // Survival time formatted
    const min = Math.floor(this.survivalTimer / 60);
    const sec = Math.floor(this.survivalTimer % 60);
    document.getElementById('stat-time-survived').textContent = `${min}m ${sec}s`;

    this.uiManager.showOverlay('gameover');
    this.audio.stopAmbientMusic();
  }

  // --- Victory Trigger (Surviving until Dawn 06:00) ---
  triggerVictory() {
    this.state = 'VICTORY';
    document.exitPointerLock();

    // Reuse GameOver panel styling for victory
    const deathPanel = document.querySelector('.death-panel');
    const deathHeader = deathPanel.querySelector('h1');
    const timeDesc = deathPanel.querySelector('.survival-time-desc');

    deathHeader.textContent = "YOU SURVIVED";
    deathHeader.className = "glitch-text"; // green color
    deathHeader.style.color = '#00ff78';
    deathHeader.style.textShadow = '0 0 25px rgba(0, 255, 120, 0.6)';
    
    timeDesc.textContent = "Dawn has broken. You survived the outbreak.";
    document.getElementById('stat-monsters-killed').textContent = this.monstersKilled;
    
    const min = Math.floor(this.survivalTimer / 60);
    const sec = Math.floor(this.survivalTimer % 60);
    document.getElementById('stat-time-survived').textContent = `${min}m ${sec}s`;

    this.uiManager.showOverlay('gameover');
    this.audio.stopAmbientMusic();
  }

  restartGame() {
    location.reload(); // Quick refresh is safest/cleanest way to reset ThreeJS contexts and models!
  }

  // --- Core Game loop update ---
  run() {
    const loop = () => {
      requestAnimationFrame(loop);
      
      const dt = this.clock.getDelta();

      if (this.state === 'GAMEPLAY') {
        // 1. Advance simulated time clock during survival mode
        if (this.nightModeActive) {
          this.survivalTimer += dt;
          
          // simulated time goes from 23:00 to 06:00 (dawn)
          // 23:00 is 11:00 PM. We have 7 simulated hours.
          // Let's make the night last 3 minutes (180 seconds).
          // 7 hours / 180 seconds = 0.0388 hours per second.
          const hrsPerSec = 7.0 / 180.0;
          this.simulatedMinute += (hrsPerSec * 60) * dt;
          if (this.simulatedMinute >= 60) {
            this.simulatedMinute = 0;
            this.simulatedHour = (this.simulatedHour + 1) % 24;
          }

          // Dawn victory check (06:00 AM)
          if (this.simulatedHour === 6) {
            this.triggerVictory();
          }
        } else {
          // Tutorial afternoon clock slow tick
          this.simulatedMinute += 0.8 * dt;
          if (this.simulatedMinute >= 60) {
            this.simulatedMinute = 0;
            this.simulatedHour = (this.simulatedHour + 1) % 24;
          }
        }

        // 2. Update subsystems
        const isPaused = document.pointerLockElement !== this.renderer.domElement && !this.uiManager.invOverlay.classList.contains('active');
        
        if (!isPaused) {
          this.player.update(dt);
          this.weaponSystem.update(dt, this.player);
          this.monsterManager.update(dt, this.nightModeActive);
          
          // Death check
          if (this.player.health <= 0) {
            this.triggerGameOver();
          }
        }
        
        this.worldManager.update(dt);
        this.uiManager.update(dt, this.player, this.weaponSystem);
        
        // 3. Check tutorial step progress triggers
        this.checkTutorialProgression(dt);

        // 4. Highlight interactables prompts on screen
        this.updateInteractHUD();
      }

      // Render the scene frame
      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }

  // Update hover interaction hud texts
  updateInteractHUD() {
    let closestLabel = "";
    let minDist = 2.5;

    this.worldManager.interactables.forEach(item => {
      const worldPos = new THREE.Vector3();
      item.mesh.getWorldPosition(worldPos);

      const dX = worldPos.x - this.player.position.x;
      const dZ = worldPos.z - this.player.position.z;
      const dist = Math.sqrt(dX * dX + dZ * dZ);

      if (dist < minDist) {
        minDist = dist;
        closestLabel = item.label;
      }
    });

    const crosshair = document.getElementById('crosshair');
    if (closestLabel !== "") {
      // Prompt interaction tip on center
      this.uiManager.objectiveDesc.textContent = closestLabel;
      this.uiManager.objectiveDesc.style.color = '#00ff78';
      crosshair.style.borderColor = '#00ff78'; // Green crosshair
    } else {
      // Revert to normal checklist instructions
      if (this.tutorialActive) {
        this.uiManager.setTutorialStepActive(this.currentTutorialStep);
      } else if (this.nightModeActive) {
        this.uiManager.objectiveDesc.textContent = "SURVIVE UNTIL DAWN!";
        this.uiManager.objectiveDesc.style.color = '#ff2828';
      }
      crosshair.style.borderColor = ''; // White crosshair
    }
  }
}

// Instantiate and start
const game = new Game();
game.run();
