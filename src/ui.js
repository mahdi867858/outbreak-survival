import { audioManager } from './audio.js';

export class UIManager {
  constructor(game) {
    this.game = game;

    // Elements cache
    this.hud = document.getElementById('hud');
    this.healthBar = document.getElementById('health-bar');
    this.healthVal = document.getElementById('health-value');
    this.staminaBar = document.getElementById('stamina-bar');
    this.staminaVal = document.getElementById('stamina-value');
    
    this.weaponName = document.getElementById('weapon-name');
    this.ammoClip = document.getElementById('ammo-clip');
    this.ammoReserve = document.getElementById('ammo-reserve');
    this.reloadPrompt = document.getElementById('reload-prompt');
    this.bowChargeContainer = document.getElementById('bow-charge-container');
    this.bowChargeBar = document.getElementById('bow-charge-bar');

    this.tutorialPanel = document.getElementById('tutorial-panel');
    this.objectiveDesc = document.getElementById('current-objective-desc');
    this.helpTipText = document.getElementById('help-tip-text');
    this.timeClock = document.getElementById('time-clock');

    // Inventory elements
    this.invOverlay = document.getElementById('inventory-overlay');
    this.invPistol = document.getElementById('inv-pistol-count');
    this.invBow = document.getElementById('inv-bow-count');
    this.invAmmo = document.getElementById('inv-ammo-count');
    this.invArrows = document.getElementById('inv-arrows-count');
    this.invMedkit = document.getElementById('inv-medkit-count');
    this.invSupplies = document.getElementById('inv-supplies-count');
    this.itemDetails = document.getElementById('item-details-content');

    // Overlays cache
    this.overlays = {
      interaction: document.getElementById('interaction-overlay'),
      devIntro: document.getElementById('dev-intro-overlay'),
      cinematic: document.getElementById('cinematic-overlay'),
      briefing: document.getElementById('briefing-overlay'),
      pointerlock: document.getElementById('pointerlock-cover'),
      inventory: document.getElementById('inventory-overlay'),
      alerts: document.getElementById('cinematic-alerts'),
      gameover: document.getElementById('gameover-overlay')
    };

    // Story cinematic text variables
    this.storyTextElem = document.getElementById('story-text');
    this.storySentences = [
      "A mysterious virus has spread across the world.",
      "Cities have fallen.",
      "Most of humanity is gone.",
      "Monsters now dominate the world.",
      "You are one of the last survivors.",
      "The mission is simple:",
      "Survive. Fight. Escape.",
      "Discover the truth."
    ];

    // Help tips rotational content
    this.tips = [
      "Headshots deal extra damage.",
      "Gunshots attract nearby monsters.",
      "Bow attacks are silent.",
      "Search abandoned buildings for supplies.",
      "Always keep enough ammunition."
    ];
    this.tipTimer = 0;
    this.tipIdx = 0;

    // Inventory selection state
    this.selectedItem = null;

    // Headshot visual HUD popup timeout
    this.headshotTimeout = null;

    this.setupInventoryListeners();
  }

  // Hide/Show overlays utility
  showOverlay(name) {
    Object.keys(this.overlays).forEach(k => {
      this.overlays[k].classList.remove('active');
    });
    if (this.overlays[name]) {
      this.overlays[name].classList.add('active');
    }
  }

  hideAllOverlays() {
    Object.keys(this.overlays).forEach(k => {
      this.overlays[k].classList.remove('active');
    });
  }

  // --- Story Cinematic typewriter presentation ---
  playStoryCinematic(onComplete) {
    this.showOverlay('cinematic');
    audioManager.startWind();
    audioManager.startRain();
    
    let sentenceIdx = 0;
    
    const showNextSentence = () => {
      if (sentenceIdx >= this.storySentences.length) {
        // Completed cinematic!
        this.storyTextElem.classList.remove('visible');
        setTimeout(() => {
          onComplete();
        }, 1000);
        return;
      }

      this.storyTextElem.textContent = this.storySentences[sentenceIdx];
      this.storyTextElem.classList.add('visible');

      // Random lightning flash during middle stories
      if (sentenceIdx === 2 || sentenceIdx === 5) {
        setTimeout(() => {
          this.game.worldManager.thunderTimer = 0; // Trigger lightning flash!
        }, 500);
      }

      sentenceIdx++;

      // Wait 3.5s then fade out
      setTimeout(() => {
        this.storyTextElem.classList.remove('visible');
        // Wait 1s fade-out transition then trigger next
        setTimeout(showNextSentence, 1000);
      }, 3500);
    };

    // First delay before story starts
    setTimeout(showNextSentence, 1500);
  }

  // --- Giant alert text overlays ("Night falls...") ---
  triggerAlert(title, subtitle, duration = 4000) {
    const alertOverlay = this.overlays.alerts;
    const titleEl = document.getElementById('alert-title');
    const subtitleEl = document.getElementById('alert-subtitle');
    
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
    
    alertOverlay.classList.add('active');
    
    setTimeout(() => {
      alertOverlay.classList.remove('active');
    }, duration);
  }

  // --- Tutorial Steps Checklist state updater ---
  setTutorialStepActive(stepNum) {
    const listItems = document.querySelectorAll('#tutorial-steps-list li');
    listItems.forEach(li => {
      li.classList.remove('active');
      const idx = parseInt(li.getAttribute('data-step'));
      if (idx === stepNum) {
        li.classList.add('active');
        this.objectiveDesc.textContent = li.innerText.replace('[ ]', '');
        
        // Scroll panel automatically to focus step
        li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  markTutorialStepCompleted(stepNum) {
    const listItems = document.querySelectorAll('#tutorial-steps-list li');
    listItems.forEach(li => {
      const idx = parseInt(li.getAttribute('data-step'));
      if (idx === stepNum) {
        li.classList.remove('active');
        li.classList.add('completed');
        const chk = li.querySelector('.chk');
        if (chk) chk.textContent = '[x]';
        
        // Play quick chime blip
        audioManager.playPickup();
      }
    });
  }

  hideTutorialPanel() {
    this.tutorialPanel.style.display = 'none';
  }

  // --- Inventory System & Backpack Click Handlers ---
  setupInventoryListeners() {
    const slots = [
      { id: 'slot-pistol', name: 'pistol' },
      { id: 'slot-bow', name: 'bow' },
      { id: 'slot-ammo', name: 'ammo' },
      { id: 'slot-arrows', name: 'arrows' },
      { id: 'slot-medkit', name: 'medkit' },
      { id: 'slot-supplies', name: 'supplies' }
    ];

    slots.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) {
        el.addEventListener('click', () => {
          // Highlight selection
          slots.forEach(x => document.getElementById(x.id).classList.remove('selected'));
          el.classList.add('selected');
          this.selectedItem = s.name;
          this.updateItemDetails(s.name);
        });
      }
    });

    // Close button
    document.getElementById('close-inventory-btn').addEventListener('click', () => {
      this.game.toggleInventory();
    });
  }

  updateItemDetails(itemName) {
    let title = "";
    let desc = "";
    let actionBtn = "";

    const weapons = this.game.weaponSystem;

    if (itemName === 'pistol') {
      title = "9mm Tactical Handgun";
      desc = weapons.gunUnlocked 
        ? "Unlocked. A reliable sidearm that deals instant hitscan damage. Loud gunshots attract zombies."
        : "LOCKED. Gather weapon in Safe House Yard.";
      if (weapons.gunUnlocked) {
        actionBtn = `<button id="equip-pistol-btn" class="btn primary-btn use-item-btn">EQUIP WEAPON</button>`;
      }
    } else if (itemName === 'bow') {
      title = "Survival Bow";
      desc = weapons.bowUnlocked
        ? "Unlocked. A silent archery bow. Hold left click to draw and charge. Deals high damage silently."
        : "LOCKED. Gather weapon in Safe House Yard.";
      if (weapons.bowUnlocked) {
        actionBtn = `<button id="equip-bow-btn" class="btn primary-btn use-item-btn">EQUIP WEAPON</button>`;
      }
    } else if (itemName === 'ammo') {
      title = "9mm Ammunition";
      desc = `Pack of tactical pistol cartridges. Unlocks firearm reloading capacities.\n\nQuantity: ${weapons.ammoReserve} rounds.`;
    } else if (itemName === 'arrows') {
      title = "Composite Arrows";
      desc = `Fletched hunting arrows. Necessary to fire bow shots.\n\nQuantity: ${weapons.arrowsReserve} arrows.`;
    } else if (itemName === 'medkit') {
      title = "Tactical Medkit";
      desc = "Restores 50 HP. Use in emergencies to cure infection wounds.";
      if (this.game.player.health < this.game.player.maxHealth && this.game.medkitsCount > 0) {
        actionBtn = `<button id="use-medkit-btn" class="btn primary-btn use-item-btn red-btn">USE MEDKIT (+50 HP)</button>`;
      } else if (this.game.medkitsCount === 0) {
        desc += "\n\n(OUT OF STOCK)";
      } else {
        desc += "\n\n(VITALS FULLY STABLE)";
      }
    } else if (itemName === 'supplies') {
      title = "Survival Rations";
      desc = `Canned provisions. Standard rations. Keep to survive.\n\nQuantity: ${this.game.suppliesCount} crates.`;
    }

    this.itemDetails.innerHTML = `
      <div class="details-content">
        <p class="details-name">${title}</p>
        <p>${desc.replace(/\n/g, '<br>')}</p>
        ${actionBtn}
      </div>
    `;

    // Hook button events
    if (document.getElementById('equip-pistol-btn')) {
      document.getElementById('equip-pistol-btn').addEventListener('click', () => {
        weapons.selectWeapon('pistol');
        this.game.toggleInventory();
        audioManager.playReload();
      });
    }
    if (document.getElementById('equip-bow-btn')) {
      document.getElementById('equip-bow-btn').addEventListener('click', () => {
        weapons.selectWeapon('bow');
        this.game.toggleInventory();
        audioManager.playDoorInteract();
      });
    }
    if (document.getElementById('use-medkit-btn')) {
      document.getElementById('use-medkit-btn').addEventListener('click', () => {
        this.game.player.heal(50);
        this.game.medkitsCount--;
        audioManager.playPickup();
        
        // Refresh inventory screen view
        this.updateInventoryCounts();
        this.updateItemDetails('medkit');
      });
    }
  }

  updateInventoryCounts() {
    const weapons = this.game.weaponSystem;
    this.invPistol.textContent = weapons.gunUnlocked ? "UNLOCKED" : "LOCKED";
    this.invBow.textContent = weapons.bowUnlocked ? "UNLOCKED" : "LOCKED";
    this.invAmmo.textContent = weapons.ammoReserve;
    this.invArrows.textContent = weapons.arrowsReserve;
    this.invMedkit.textContent = this.game.medkitsCount;
    this.invSupplies.textContent = this.game.suppliesCount;
  }

  // --- Main HUD Frame Update Loop ---
  update(dt, player, weapons) {
    if (this.hud.classList.contains('hidden')) return;

    // 1. Health Bar
    const healthPercent = Math.max(0, player.health);
    this.healthBar.style.width = `${healthPercent}%`;
    this.healthVal.textContent = Math.round(healthPercent);

    // Vitals warning flashing red if health < 30
    const healthWrapper = this.healthBar.parentElement;
    if (healthPercent < 30) {
      healthWrapper.style.borderColor = '#ff0000';
      if (Math.sin(Date.now() * 0.01) > 0) {
        this.healthBar.style.backgroundColor = '#ff5555';
      } else {
        this.healthBar.style.backgroundColor = '#990000';
      }
    } else {
      healthWrapper.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      this.healthBar.style.backgroundColor = ''; // default CSS gradient
    }

    // 2. Stamina Bar
    const staminaPercent = Math.max(0, player.stamina);
    this.staminaBar.style.width = `${staminaPercent}%`;
    this.staminaVal.textContent = Math.round(staminaPercent);

    // 3. Ammo Displays
    if (weapons.activeType === 'unarmed') {
      this.weaponName.textContent = "UNARMED";
      this.ammoClip.textContent = "-";
      this.ammoReserve.textContent = "-";
      this.reloadPrompt.classList.add('hidden');
    } else if (weapons.activeType === 'pistol') {
      this.weaponName.textContent = "HANDGUN";
      this.ammoClip.textContent = weapons.ammoClip;
      this.ammoReserve.textContent = weapons.ammoReserve;

      // Toggle reload flashing warning prompt
      if (weapons.ammoClip === 0 && weapons.ammoReserve > 0 && !weapons.isReloading) {
        this.reloadPrompt.classList.remove('hidden');
      } else {
        this.reloadPrompt.classList.add('hidden');
      }
    } else if (weapons.activeType === 'bow') {
      this.weaponName.textContent = "BOW";
      this.ammoClip.textContent = weapons.arrowsReserve > 0 ? "1" : "0";
      this.ammoReserve.textContent = weapons.arrowsReserve;
      this.reloadPrompt.classList.add('hidden');
    }

    // 4. Bow Draw Charge overlay updates
    if (weapons.activeType === 'bow' && weapons.isDrawing) {
      this.bowChargeContainer.classList.remove('hidden');
      const progress = weapons.chargeLevel * 100;
      this.bowChargeBar.style.width = `${progress}%`;
      
      // Color shifts to green when fully drawn
      if (progress >= 100) {
        this.bowChargeBar.style.backgroundColor = '#00ff78';
        this.bowChargeBar.style.boxShadow = '0 0 10px #00ff78';
      } else {
        this.bowChargeBar.style.backgroundColor = '#ffdd44';
        this.bowChargeBar.style.boxShadow = '0 0 6px #ffdd44';
      }
    } else {
      this.bowChargeContainer.classList.add('hidden');
    }

    // 5. Help Tips Rotations (changes tips text every 8 seconds)
    this.tipTimer += dt;
    if (this.tipTimer >= 8.0) {
      this.tipTimer = 0;
      this.tipIdx = (this.tipIdx + 1) % this.tips.length;
      this.helpTipText.textContent = this.tips[this.tipIdx];
    }

    // 6. Time Display Simulation (advances clock to simulate approaching dawn!)
    const hours = this.game.simulatedHour;
    const minutes = Math.floor(this.game.simulatedMinute);
    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    this.timeClock.textContent = `${hStr}:${mStr}`;
  }
}
export default UIManager;
