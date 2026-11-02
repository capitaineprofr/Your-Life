import { parseMinecraftGeometry, renderMinecraftModel } from './minecraft_geo.js';
import { registerCustomFurniture, FURNITURE_CATALOG } from './furniture.js';
import { parseBedrockJSON, BedrockGeometryRegistry } from './bedrock_3d.js';
// --- Gestionnaire d'Interface Utilisateur (Agencement Utilisateur & Besoins) ---

export class UIManager {
  constructor(handlers = {}) {
    this.handlers = handlers;

    // Éléments Auth
    this.authOverlay = document.getElementById('auth-modal-overlay');
    this.tabLogin = document.getElementById('tab-login');
    this.tabRegister = document.getElementById('tab-register');
    this.formLogin = document.getElementById('form-login');
    this.formRegister = document.getElementById('form-register');
    this.loginError = document.getElementById('login-error');
    this.regError = document.getElementById('reg-error');

    // Racine HUD & Outils
    this.hudRoot = document.getElementById('hud-root');
    this.btnToggleUi = document.getElementById('btn-toggle-ui');
    this.btnShowUi = document.getElementById('btn-show-ui');
    this.btnRecenter = document.getElementById('btn-recenter');
    this.btnOpenMap = document.getElementById('btn-open-map');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnToggleView = document.getElementById('btn-toggle-view');

    // 1. Profil & Solde (Haut Gauche)
    this.profileWidget = document.getElementById('hud-profile-widget');
    this.hudUsername = document.getElementById('hud-username');
    this.hudRoleBadge = document.getElementById('hud-role-badge');
    this.playerFcfa = document.getElementById('player-fcfa');
    this.hudAvatarPreview = document.getElementById('hud-avatar-preview');
    this.btnLogout = document.getElementById('btn-logout');
    this.btnToggleProfileSize = document.getElementById('btn-toggle-profile-size');
    this.tabToggleProfile = document.getElementById('tab-toggle-profile');

    // 2. Tchat Sidebar (Gauche)
    this.chatSidebar = document.getElementById('hud-chat-sidebar');
    this.btnToggleChatSize = document.getElementById('btn-toggle-chat-size');
    this.tabToggleChat = document.getElementById('tab-toggle-chat');
    this.chatLog = document.getElementById('chat-messages-log');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');

    // 3. Customisation Sidebar (Droite)
    this.customSidebar = document.getElementById('hud-custom-sidebar');
    this.btnToggleCustomSize = document.getElementById('btn-toggle-custom-size');
    this.tabToggleCustom = document.getElementById('tab-toggle-custom');
    this.customOwnerContent = document.getElementById('custom-owner-content');
    this.customVisitorNotice = document.getElementById('custom-visitor-notice');
    this.catalogGrid = document.getElementById('catalog-grid');
    this.furnitureSelectionBar = document.getElementById('furniture-selection-bar');
    this.selectedItemName = document.getElementById('selected-item-name');
    this.btnRotateFurniture = document.getElementById('btn-rotate-furniture');
    this.btnDeleteFurniture = document.getElementById('btn-delete-furniture');
    this.btnDeselectFurniture = document.getElementById('btn-deselect-furniture');
    this.btnClearRoom = document.getElementById('btn-clear-room');

    // 4. Widget Besoins Vitaux & Réduction
    this.needsWidget = document.getElementById('hud-needs-widget');
    this.btnToggleNeedsSize = document.getElementById('btn-toggle-needs-size');
    this.tabToggleNeeds = document.getElementById('tab-toggle-needs');

    // 5. Besoins Circulaires (4 Cercles Alignés avec contours de progression)
    this.needsGauges = {
      hunger: {
        ring: document.getElementById('gauge-ring-hunger'),
        val: document.getElementById('need-val-hunger'),
        card: document.getElementById('card-need-hunger')
      },
      thirst: {
        ring: document.getElementById('gauge-ring-thirst'),
        val: document.getElementById('need-val-thirst'),
        card: document.getElementById('card-need-thirst')
      },
      energy: {
        ring: document.getElementById('gauge-ring-energy'),
        val: document.getElementById('need-val-energy'),
        card: document.getElementById('card-need-energy')
      },
      hygiene: {
        ring: document.getElementById('gauge-ring-hygiene'),
        val: document.getElementById('need-val-hygiene'),
        card: document.getElementById('card-need-hygiene')
      }
    };
    this.needsStatus = document.getElementById('needs-overall-status');

    // Valeurs initiales des besoins vitaux
    this.vitalNeeds = {
      hunger: 90,
      thirst: 85,
      energy: 75,
      hygiene: 95
    };

    // Toasts
    this.toastContainer = document.getElementById('toast-container');

    // Aperçu dynamique création avatar
    this.avatarLiveCanvas = document.getElementById('avatar-live-preview');
    this.avatarLiveCtx = this.avatarLiveCanvas ? this.avatarLiveCanvas.getContext('2d') : null;

    this.avatarConfig = {
      skin: '#8d5524',
      hairStyle: 'afro',
      hairColor: '#1a110b',
      outfitStyle: 'faso_dan_fani',
      shirtColor: '#d97706',
      pantsColor: '#1e293b'
    };

    this.currentCategory = 'all';
    this.bindEvents();
    this.updateAvatarPreview();
    this.renderCatalog();
    this.updateNeedsDisplay();

    // Dégénérescence lente des besoins (Simulation de vie)
    setInterval(() => this.decayNeeds(), 10000);
  }

  bindEvents() {
    // Zoom et Recentrage
    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', () => {
        if (this.handlers.onZoom) this.handlers.onZoom(1.15);
      });
    }
    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', () => {
        if (this.handlers.onZoom) this.handlers.onZoom(0.85);
      });
    }
    if (this.btnRecenter) {
      this.btnRecenter.addEventListener('click', () => {
        if (this.handlers.onRecenter) this.handlers.onRecenter();
      });
    }
    if (this.btnOpenMap) {
      this.btnOpenMap.addEventListener('click', () => {
        if (this.handlers.onOpenMap) this.handlers.onOpenMap();
      });
    }
    if (this.btnToggleView) {
      this.btnToggleView.addEventListener('click', () => {
        if (this.handlers.onToggleView) {
          const mode = this.handlers.onToggleView();
          this.btnToggleView.textContent = mode === 'architectural' ? 'Vue Sims Architecture' : 'Vue Décor Photo';
        }
      });
    }

    // Masquage global de l'UI
    if (this.btnToggleUi) this.btnToggleUi.addEventListener('click', () => this.toggleAllUI());
    if (this.btnShowUi) this.btnShowUi.addEventListener('click', () => this.toggleAllUI());

    window.addEventListener('keydown', (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if ((e.key === 'h' || e.key === 'H') && !isInput) {
        this.toggleAllUI();
      } else if (e.key === 'Escape') {
        if (isInput) document.activeElement.blur();
        if (this.handlers.onCancelPlacing) this.handlers.onCancelPlacing();
      }
    });

    // Réduction / Extension des barres latérales gauches (Animation vers la gauche)
    if (this.btnToggleProfileSize && this.profileWidget) {
      this.btnToggleProfileSize.addEventListener('click', () => {
        this.profileWidget.classList.add('collapsed');
      });
    }
    if (this.tabToggleProfile && this.profileWidget) {
      this.tabToggleProfile.addEventListener('click', () => {
        this.profileWidget.classList.remove('collapsed');
      });
    }

    if (this.btnToggleChatSize && this.chatSidebar) {
      this.btnToggleChatSize.addEventListener('click', () => {
        this.chatSidebar.classList.add('collapsed');
      });
    }
    if (this.tabToggleChat && this.chatSidebar) {
      this.tabToggleChat.addEventListener('click', () => {
        this.chatSidebar.classList.remove('collapsed');
      });
    }

    // Réduction / Extension des barres latérales droites (Animation vers la droite)
    if (this.btnToggleCustomSize && this.customSidebar) {
      this.btnToggleCustomSize.addEventListener('click', () => {
        this.customSidebar.classList.add('collapsed');
      });
    }
    if (this.tabToggleCustom && this.customSidebar) {
      this.tabToggleCustom.addEventListener('click', () => {
        this.customSidebar.classList.remove('collapsed');
      });
    }

    if (this.btnToggleNeedsSize && this.needsWidget) {
      this.btnToggleNeedsSize.addEventListener('click', () => {
        this.needsWidget.classList.add('collapsed');
      });
    }
    if (this.tabToggleNeeds && this.needsWidget) {
      this.tabToggleNeeds.addEventListener('click', () => {
        this.needsWidget.classList.remove('collapsed');
      });
    }

    // Clic sur les 4 cercles de besoins pour basculer icône / pourcentage précis
    for (const [key, obj] of Object.entries(this.needsGauges)) {
      if (obj.card) {
        obj.card.addEventListener('click', () => {
          obj.card.classList.toggle('show-percent');
        });
      }
    }

    // Initialisation de la modale d'importation géométrie Minecraft
    this.initMinecraftGeoModal();

    // Onglets de catégories du catalogue
    const catBtns = document.querySelectorAll('.cat-btn');
    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.cat;
        this.renderCatalog();
      });
    });

    // Actions sur meuble sélectionné
    if (this.btnRotateFurniture) {
      this.btnRotateFurniture.addEventListener('click', () => {
        if (this.handlers.onRotateSelectedFurniture) {
          this.handlers.onRotateSelectedFurniture();
        }
      });
    }
    if (this.btnDeleteFurniture) {
      this.btnDeleteFurniture.addEventListener('click', () => {
        if (this.handlers.onDeleteSelectedFurniture) {
          this.handlers.onDeleteSelectedFurniture();
        }
      });
    }
    if (this.btnDeselectFurniture) {
      this.btnDeselectFurniture.addEventListener('click', () => {
        this.hideFurnitureSelection();
        if (this.handlers.onDeselectFurniture) {
          this.handlers.onDeselectFurniture();
        }
      });
    }
    if (this.btnClearRoom) {
      this.btnClearRoom.addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir vider tous les meubles de la pièce ?')) {
          if (this.handlers.onClearRoom) this.handlers.onClearRoom();
        }
      });
    }

    // Raccourcis d'actions des besoins
    const needActBtns = document.querySelectorAll('.btn-need-act');
    needActBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (this.handlers.onAction) this.handlers.onAction(action);
      });
    });

    // Authentification
    this.tabLogin.addEventListener('click', () => this.switchTab('login'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));

    const skinPills = document.querySelectorAll('#skin-palette .color-pill');
    skinPills.forEach(pill => {
      pill.addEventListener('click', () => {
        skinPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.avatarConfig.skin = pill.dataset.color;
        this.updateAvatarPreview();
      });
    });

    const outfitPills = document.querySelectorAll('#outfit-palette .color-pill');
    outfitPills.forEach(pill => {
      pill.addEventListener('click', () => {
        outfitPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.avatarConfig.shirtColor = pill.dataset.color;
        this.updateAvatarPreview();
      });
    });

    const outfitSelect = document.getElementById('reg-outfit');
    if (outfitSelect) {
      outfitSelect.addEventListener('change', (e) => {
        this.avatarConfig.outfitStyle = e.target.value;
        this.updateAvatarPreview();
      });
    }

    const hairSelect = document.getElementById('reg-hair');
    if (hairSelect) {
      hairSelect.addEventListener('change', (e) => {
        this.avatarConfig.hairStyle = e.target.value;
        this.updateAvatarPreview();
      });
    }

    this.formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      this.loginError.classList.add('hidden');
      if (this.handlers.onLogin) this.handlers.onLogin(username, password);
    });

    this.formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;
      this.regError.classList.add('hidden');
      if (this.handlers.onRegister) this.handlers.onRegister(username, password, this.avatarConfig);
    });

    this.btnLogout.addEventListener('click', () => {
      if (this.handlers.onLogout) this.handlers.onLogout();
    });

    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (text && this.handlers.onSendChat) {
        this.handlers.onSendChat(text);
        this.chatInput.value = '';
      }
    });
  }

  toggleAllUI() {
    const isHidden = this.hudRoot.classList.toggle('ui-hidden');
    if (this.btnShowUi) {
      this.btnShowUi.classList.toggle('hidden', !isHidden);
    }
  }

  renderCatalog() {
    if (!this.catalogGrid) return;
    this.catalogGrid.innerHTML = '';

    const items = Object.values(FURNITURE_CATALOG).filter(item => {
      if (this.currentCategory === 'all') return true;
      return item.category === this.currentCategory;
    });

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'catalog-card';
      card.innerHTML = `
        <div class="card-info">
          <span class="card-title">${item.name}</span>
          <span class="card-dims">${item.sizeX}x${item.sizeY} cases</span>
        </div>
        <button class="btn-place-item" data-id="${item.id}">Poser</button>
      `;

      card.querySelector('.btn-place-item').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.handlers.onStartPlacing) {
          this.handlers.onStartPlacing(item.id);
          this.showToast(`Cliquez sur le sol pour placer : ${item.name}`, 3000);
        }
      });

      this.catalogGrid.appendChild(card);
    }
  }

  showFurnitureSelection(item) {
    if (this.furnitureSelectionBar) {
      this.selectedItemName.textContent = item.name || item.type;
      this.furnitureSelectionBar.classList.remove('hidden');
    }
  }

  hideFurnitureSelection() {
    if (this.furnitureSelectionBar) {
      this.furnitureSelectionBar.classList.add('hidden');
    }
  }

  setOwnerStatus(isOwner) {
    if (this.hudRoleBadge) {
      this.hudRoleBadge.textContent = isOwner ? 'HÔTE' : 'VISITEUR';
      this.hudRoleBadge.style.color = isOwner ? '#facc15' : '#94a3b8';
    }

    if (this.customOwnerContent && this.customVisitorNotice) {
      if (isOwner) {
        this.customOwnerContent.classList.remove('hidden');
        this.customVisitorNotice.classList.add('hidden');
      } else {
        this.customOwnerContent.classList.add('hidden');
        this.customVisitorNotice.classList.remove('hidden');
      }
    }
  }

  // Gestion des Besoins Vitaux
  replenishNeed(need, amount) {
    if (this.vitalNeeds[need] !== undefined) {
      this.vitalNeeds[need] = Math.min(100, this.vitalNeeds[need] + amount);
      this.updateNeedsDisplay();
    }
  }

  decayNeeds() {
    this.vitalNeeds.hunger = Math.max(10, this.vitalNeeds.hunger - 1);
    this.vitalNeeds.thirst = Math.max(10, this.vitalNeeds.thirst - 2);
    this.vitalNeeds.energy = Math.max(10, this.vitalNeeds.energy - 1);
    this.vitalNeeds.hygiene = Math.max(10, this.vitalNeeds.hygiene - 1);
    this.updateNeedsDisplay();
  }

  updateNeedsDisplay() {
    const CIRCUMFERENCE = 138.23; // 2 * PI * 22

    for (const [key, obj] of Object.entries(this.needsGauges)) {
      if (obj.ring && obj.val) {
        const val = this.vitalNeeds[key];
        obj.val.textContent = `${val}%`;

        // Calcul du décalage de contour circulaire (100% -> 0, 0% -> 138.23)
        const offset = CIRCUMFERENCE * (1 - (val / 100));
        obj.ring.style.strokeDashoffset = `${offset}px`;

        // Alerte critique si besoin sous les 25%
        if (val < 25) {
          obj.ring.classList.add('ring-critical');
        } else {
          obj.ring.classList.remove('ring-critical');
        }
      }
    }

    const avg = (this.vitalNeeds.hunger + this.vitalNeeds.thirst + this.vitalNeeds.energy + this.vitalNeeds.hygiene) / 4;
    if (this.needsStatus) {
      if (avg > 70) this.needsStatus.textContent = 'En forme';
      else if (avg > 40) this.needsStatus.textContent = 'Fatigué';
      else this.needsStatus.textContent = 'Épuisé';
    }
  }

  initMinecraftGeoModal() {
    const btnOpen = document.getElementById('btn-import-geo');
    const modal = document.getElementById('modal-geo-import');
    const btnClose = document.getElementById('btn-close-geo-modal');
    const btnCancel = document.getElementById('btn-cancel-geo');
    const btnConfirm = document.getElementById('btn-confirm-geo-import');
    const textarea = document.getElementById('geo-json-textarea');
    const fileInput = document.getElementById('geo-file-input');
    const btnBrowse = document.getElementById('btn-browse-geo-file');
    const fileNameSpan = document.getElementById('geo-file-name');
    const textureInput = document.getElementById('geo-texture-input');
    const btnBrowseTexture = document.getElementById('btn-browse-geo-texture');
    const textureNameSpan = document.getElementById('geo-texture-name');
    const statusMsg = document.getElementById('geo-parse-status');
    const canvas = document.getElementById('geo-preview-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const nameInput = document.getElementById('geo-item-name');
    const catSelect = document.getElementById('geo-item-cat');

    if (!btnOpen || !modal) return;

    let currentParsedModel = null;
    let currentTextureUrl = null;

    const renderPreview = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (currentParsedModel) {
        renderMinecraftModel(ctx, currentParsedModel, { x: 100, y: 130 }, { scale: 2.2 });
      }
    };

    const validateJson = (jsonString) => {
      if (!jsonString || !jsonString.trim()) {
        currentParsedModel = null;
        statusMsg.textContent = 'Prêt pour importation';
        statusMsg.className = 'geo-status-msg';
        btnConfirm.disabled = true;
        renderPreview();
        return;
      }

      const parsed = parseBedrockJSON(jsonString);
      if (parsed && (parsed.bones || (parsed.cubes && parsed.cubes.length > 0))) {
        currentParsedModel = parsed;
        const totalCubes = parsed.cubes?.length || parsed.bones?.reduce((acc, b) => acc + (b.cubes?.length || 0), 0) || 0;
        statusMsg.textContent = `Modèle Blockbench valide (${totalCubes} cubes détectés)`;
        statusMsg.className = 'geo-status-msg success';
        btnConfirm.disabled = false;
        renderPreview();
      } else {
        currentParsedModel = null;
        statusMsg.textContent = 'Erreur : format JSON Blockbench non reconnu';
        statusMsg.className = 'geo-status-msg error';
        btnConfirm.disabled = true;
        renderPreview();
      }
    };

    btnOpen.addEventListener('click', () => {
      modal.classList.remove('hidden');
      validateJson(textarea.value);
    });

    const closeModal = () => modal.classList.add('hidden');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          fileNameSpan.textContent = file.name;
          const reader = new FileReader();
          reader.onload = (ev) => {
            textarea.value = ev.target.result;
            validateJson(ev.target.result);
          };
          reader.readAsText(file);
        }
      });
    }

    if (btnBrowseTexture && textureInput) {
      btnBrowseTexture.addEventListener('click', () => textureInput.click());
      textureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          textureNameSpan.textContent = file.name;
          const reader = new FileReader();
          reader.onload = (ev) => {
            currentTextureUrl = ev.target.result;
            statusMsg.textContent = `Modèle Blockbench & Texture PNG prêts !`;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (textarea) {
      textarea.addEventListener('input', () => validateJson(textarea.value));
    }

    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        if (!currentParsedModel) return;
        const rawName = nameInput.value.trim() || 'Meuble Blockbench';
        const cat = catSelect.value || 'salon';
        const customId = 'custom_' + Date.now();
        const geoId = currentParsedModel.description?.identifier || `geometry.${customId}`;

        // Enregistrer la géométrie et la texture dans le moteur 3D
        BedrockGeometryRegistry.register(geoId, currentParsedModel, currentTextureUrl);

        // Enregistrer dans le catalogue
        registerCustomFurniture({
          id: customId,
          name: rawName,
          category: cat,
          sizeX: 1,
          sizeY: 1,
          price: 25000,
          interactive: null,
          isWalkable: false,
          geoId: geoId,
          textureUrl: currentTextureUrl
        });

        // Actualiser l'affichage du catalogue
        this.renderCatalog();
        this.showToast(`Meuble Blockbench "${rawName}" ajouté avec succès !`, 3000);
        closeModal();
      });
    }
  }

  switchTab(tab) {
    if (tab === 'login') {
      this.tabLogin.classList.add('active');
      this.tabRegister.classList.remove('active');
      this.formLogin.classList.remove('hidden');
      this.formRegister.classList.add('hidden');
    } else {
      this.tabRegister.classList.add('active');
      this.tabLogin.classList.remove('active');
      this.formRegister.classList.remove('hidden');
      this.formLogin.classList.add('hidden');
      this.updateAvatarPreview();
    }
  }

  showAuthModal() {
    this.authOverlay.classList.remove('hidden');
    this.hudRoot.classList.add('hidden');
  }

  hideAuthModal() {
    this.authOverlay.classList.add('hidden');
    this.hudRoot.classList.remove('hidden');
  }

  setLoginError(msg) {
    this.loginError.textContent = msg;
    this.loginError.classList.remove('hidden');
  }

  setRegisterError(msg) {
    this.regError.textContent = msg;
    this.regError.classList.remove('hidden');
  }

  setUserProfile(user) {
    if (!user) return;
    this.hudUsername.textContent = user.username;
    this.updateFCFA(user.fcfa || 0);
    this.drawAvatarThumbnail(this.hudAvatarPreview, user.avatar || this.avatarConfig);
  }

  updateFCFA(amount) {
    const formatted = new Intl.NumberFormat('fr-FR').format(amount);
    this.playerFcfa.textContent = `${formatted} FCFA`;
  }

  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  appendChatMessage(username, text) {
    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.innerHTML = `<span class="chat-author">${username} :</span><span class="chat-text">${text}</span>`;
    this.chatLog.appendChild(entry);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  updateAvatarPreview() {
    if (!this.avatarLiveCtx) return;
    const ctx = this.avatarLiveCtx;
    const w = this.avatarLiveCanvas.width;
    const h = this.avatarLiveCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h - 28;

    // Ombre au sol
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 8, 28, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // 1. Jambes Roblox (Arrondies avec sneakers)
    ctx.fillStyle = this.avatarConfig.pantsColor;
    // Jambe gauche
    ctx.beginPath();
    ctx.roundRect(centerX - 16, centerY - 28, 13, 26, 4);
    ctx.fill();
    // Chaussure gauche
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(centerX - 17, centerY - 6, 15, 8, [0, 0, 4, 4]);
    ctx.fill();

    // Jambe droite
    ctx.fillStyle = this.avatarConfig.pantsColor;
    ctx.beginPath();
    ctx.roundRect(centerX + 3, centerY - 28, 13, 26, 4);
    ctx.fill();
    // Chaussure droite
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(centerX + 2, centerY - 6, 15, 8, [0, 0, 4, 4]);
    ctx.fill();

    // 2. Torse Roblox (Trapézoïdal aux épaules arrondies)
    const torsoY = centerY - 58;
    ctx.fillStyle = this.avatarConfig.shirtColor;
    ctx.beginPath();
    ctx.roundRect(centerX - 17, torsoY, 34, 30, 5);
    ctx.fill();

    // Motifs textiles traditionnels Faso Dan Fani ou Boubou
    if (this.avatarConfig.outfitStyle === 'faso_dan_fani') {
      const stripes = ['#b91c1c', '#facc15', '#15803d', '#ffffff'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = stripes[i % stripes.length];
        ctx.fillRect(centerX - 12 + i * 7, torsoY + 2, 4, 26);
      }
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(centerX - 7, torsoY);
      ctx.lineTo(centerX, torsoY + 12);
      ctx.lineTo(centerX + 7, torsoY);
      ctx.closePath();
      ctx.fill();
    } else if (this.avatarConfig.outfitStyle === 'boubou') {
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(centerX, torsoY + 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(centerX, torsoY + 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Bras Roblox (Épaules sphériques et mains rondes)
    // Bras gauche
    ctx.fillStyle = this.avatarConfig.shirtColor;
    ctx.beginPath();
    ctx.arc(centerX - 23, torsoY + 6, 6, 0, Math.PI * 2); // Épaule arrondie
    ctx.fill();
    ctx.roundRect(centerX - 27, torsoY + 6, 9, 18, 3);
    ctx.fill();
    // Main gauche (peau)
    ctx.fillStyle = this.avatarConfig.skin;
    ctx.beginPath();
    ctx.arc(centerX - 22.5, torsoY + 27, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Bras droit
    ctx.fillStyle = this.avatarConfig.shirtColor;
    ctx.beginPath();
    ctx.arc(centerX + 23, torsoY + 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.roundRect(centerX + 18, torsoY + 6, 9, 18, 3);
    ctx.fill();
    // Main droite (peau)
    ctx.fillStyle = this.avatarConfig.skin;
    ctx.beginPath();
    ctx.arc(centerX + 22.5, torsoY + 27, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Cou & Tête cylindrique Roblox
    // Cou stud
    ctx.fillStyle = this.avatarConfig.skin;
    ctx.beginPath();
    ctx.roundRect(centerX - 5, torsoY - 5, 10, 6, 2);
    ctx.fill();

    // Tête Roblox
    const headY = torsoY - 35;
    ctx.beginPath();
    ctx.roundRect(centerX - 13, headY, 26, 28, [8, 8, 5, 5]);
    ctx.fill();

    // Stud supérieur Roblox
    ctx.beginPath();
    ctx.roundRect(centerX - 5, headY - 4, 10, 5, 2);
    ctx.fill();

    // Visage expressif Roblox (Yeux avec reflets blancs & sourire)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(centerX - 5, headY + 10, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 5, headY + 10, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(centerX - 4.5, headY + 10, 2.2, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 4.5, headY + 10, 2.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX - 5.5, headY + 8.5, 1.2, 0, Math.PI * 2);
    ctx.arc(centerX + 3.5, headY + 8.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Sourire Roblox
    ctx.strokeStyle = '#3b1c06';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, headY + 17, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // 5. Coiffure 3D Roblox
    ctx.fillStyle = this.avatarConfig.hairColor;
    if (this.avatarConfig.hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(centerX, headY + 3, 17, 0, Math.PI * 2);
      ctx.arc(centerX - 9, headY + 1, 10, 0, Math.PI * 2);
      ctx.arc(centerX + 9, headY + 1, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.avatarConfig.hairStyle === 'dreads') {
      ctx.beginPath();
      ctx.roundRect(centerX - 15, headY - 4, 30, 10, 5);
      ctx.fill();
      // Mèches
      for (let x = -13; x <= 13; x += 6) {
        ctx.beginPath();
        ctx.roundRect(centerX + x, headY + 4, 4, 18, 2);
        ctx.fill();
      }
    } else if (this.avatarConfig.hairStyle === 'foulard') {
      ctx.fillStyle = this.avatarConfig.shirtColor;
      ctx.beginPath();
      ctx.roundRect(centerX - 15, headY - 5, 30, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(centerX + 7, headY - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(centerX - 14, headY - 4, 28, 8, 4);
      ctx.fill();
    }
  }

  drawAvatarThumbnail(canvas, avatar) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const skin = avatar.skin || '#8d5524';
    const hair = avatar.hairColor || '#1a110b';
    const hairStyle = avatar.hairStyle || 'afro';

    // Tête Roblox avec stud
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.roundRect(10, 13, 24, 25, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(17, 9, 10, 4, 2);
    ctx.fill();

    // Yeux expressifs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(16, 23, 3, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(27, 23, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(16, 23, 2, 0, Math.PI * 2);
    ctx.arc(27, 23, 2, 0, Math.PI * 2);
    ctx.fill();

    // Sourire
    ctx.strokeStyle = '#3b1c06';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(22, 29, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Coiffure
    ctx.fillStyle = hair;
    if (hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(22, 14, 15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(8, 7, 28, 9, 4);
      ctx.fill();
    }
  }
}
