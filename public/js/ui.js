// --- Gestionnaire d'Interface Utilisateur (Agencement Utilisateur & Besoins) ---

import { FURNITURE_CATALOG } from './furniture.js';

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
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');

    // 1. Profil & Solde (Haut Gauche)
    this.hudUsername = document.getElementById('hud-username');
    this.hudRoleBadge = document.getElementById('hud-role-badge');
    this.playerFcfa = document.getElementById('player-fcfa');
    this.hudAvatarPreview = document.getElementById('hud-avatar-preview');
    this.btnLogout = document.getElementById('btn-logout');

    // 2. Tchat Sidebar (Gauche)
    this.chatSidebar = document.getElementById('hud-chat-sidebar');
    this.btnToggleChatSize = document.getElementById('btn-toggle-chat-size');
    this.chatLog = document.getElementById('chat-messages-log');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');

    // 3. Customisation Sidebar (Droite)
    this.customSidebar = document.getElementById('hud-custom-sidebar');
    this.btnToggleCustomSize = document.getElementById('btn-toggle-custom-size');
    this.customOwnerContent = document.getElementById('custom-owner-content');
    this.customVisitorNotice = document.getElementById('custom-visitor-notice');
    this.catalogGrid = document.getElementById('catalog-grid');
    this.furnitureSelectionBar = document.getElementById('furniture-selection-bar');
    this.selectedItemName = document.getElementById('selected-item-name');
    this.btnDeleteFurniture = document.getElementById('btn-delete-furniture');
    this.btnDeselectFurniture = document.getElementById('btn-deselect-furniture');
    this.btnClearRoom = document.getElementById('btn-clear-room');

    // 4. Besoins Naturels (Bas Droite)
    this.needsBars = {
      hunger: { bar: document.getElementById('need-bar-hunger'), val: document.getElementById('need-val-hunger') },
      thirst: { bar: document.getElementById('need-bar-thirst'), val: document.getElementById('need-val-thirst') },
      energy: { bar: document.getElementById('need-bar-energy'), val: document.getElementById('need-val-energy') },
      hygiene: { bar: document.getElementById('need-bar-hygiene'), val: document.getElementById('need-val-hygiene') }
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

    // Réduction / Extension des barres latérales
    if (this.btnToggleChatSize) {
      this.btnToggleChatSize.addEventListener('click', () => {
        this.chatSidebar.classList.toggle('collapsed');
      });
    }
    if (this.btnToggleCustomSize) {
      this.btnToggleCustomSize.addEventListener('click', () => {
        this.customSidebar.classList.toggle('collapsed');
      });
    }

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
    for (const [key, obj] of Object.entries(this.needsBars)) {
      if (obj.bar && obj.val) {
        const val = this.vitalNeeds[key];
        obj.val.textContent = `${val}%`;
        obj.bar.style.width = `${val}%`;

        // Changement de couleur selon le niveau
        if (val < 25) {
          obj.bar.className = 'need-fill bar-red';
        } else if (val < 50) {
          obj.bar.className = 'need-fill bar-yellow';
        } else {
          obj.bar.className = `need-fill bar-${key === 'thirst' ? 'blue' : (key === 'hygiene' ? 'cyan' : 'green')}`;
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
    const centerY = h - 30;

    // Ombre
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 6, 24, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Pieds
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(centerX - 12, centerY - 6, 9, 7);
    ctx.fillRect(centerX + 3, centerY - 6, 9, 7);

    // Pantalon
    ctx.fillStyle = this.avatarConfig.pantsColor;
    ctx.fillRect(centerX - 10, centerY - 24, 8, 20);
    ctx.fillRect(centerX + 2, centerY - 24, 8, 20);

    // Buste
    const torsoY = centerY - 52;
    ctx.fillStyle = this.avatarConfig.shirtColor;
    ctx.fillRect(centerX - 16, torsoY, 32, 30);

    // Motifs Faso Dan Fani ou Boubou
    if (this.avatarConfig.outfitStyle === 'faso_dan_fani') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(centerX - 8, torsoY, 4, 30);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(centerX + 4, torsoY, 4, 30);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(centerX - 2, torsoY, 4, 30);
    } else if (this.avatarConfig.outfitStyle === 'boubou') {
      ctx.beginPath();
      ctx.moveTo(centerX - 22, torsoY + 30);
      ctx.lineTo(centerX - 16, torsoY);
      ctx.lineTo(centerX + 16, torsoY);
      ctx.lineTo(centerX + 22, torsoY + 30);
      ctx.closePath();
      ctx.fillStyle = this.avatarConfig.shirtColor;
      ctx.fill();

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - 6, torsoY + 4, 12, 14);
    }

    // Bras
    ctx.fillStyle = this.avatarConfig.skin;
    ctx.fillRect(centerX - 22, torsoY + 4, 6, 18);
    ctx.fillRect(centerX + 16, torsoY + 4, 6, 18);

    // Cou
    ctx.fillRect(centerX - 4, torsoY - 8, 8, 8);

    // Tête
    const headY = torsoY - 34;
    ctx.fillRect(centerX - 13, headY, 26, 26);

    // Yeux
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - 8, headY + 10, 5, 5);
    ctx.fillRect(centerX + 3, headY + 10, 5, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(centerX - 6, headY + 12, 3, 3);
    ctx.fillRect(centerX + 5, headY + 12, 3, 3);

    // Coiffure
    ctx.fillStyle = this.avatarConfig.hairColor;
    if (this.avatarConfig.hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(centerX, headY + 3, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.avatarConfig.hairStyle === 'dreads') {
      ctx.fillRect(centerX - 16, headY - 6, 32, 12);
      ctx.fillRect(centerX - 18, headY + 4, 6, 20);
      ctx.fillRect(centerX + 12, headY + 4, 6, 20);
    } else if (this.avatarConfig.hairStyle === 'foulard') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(centerX - 16, headY - 8, 32, 14);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(centerX - 4, headY - 12, 8, 8);
    } else {
      ctx.fillRect(centerX - 14, headY - 5, 28, 8);
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

    ctx.fillStyle = skin;
    ctx.fillRect(10, 14, 24, 24);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 22, 5, 5);
    ctx.fillRect(25, 22, 5, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 24, 3, 3);
    ctx.fillRect(27, 24, 3, 3);

    ctx.fillStyle = hair;
    if (hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(22, 16, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(8, 8, 28, 10);
    }
  }
}
