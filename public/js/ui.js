// --- Gestion de l'Interface Utilisateur (UI, Auth & HUD) ---

export class UIManager {
  constructor(handlers = {}) {
    this.handlers = handlers;

    // Éléments du DOM
    this.authOverlay = document.getElementById('auth-modal-overlay');
    this.tabLogin = document.getElementById('tab-login');
    this.tabRegister = document.getElementById('tab-register');
    this.formLogin = document.getElementById('form-login');
    this.formRegister = document.getElementById('form-register');
    this.loginError = document.getElementById('login-error');
    this.regError = document.getElementById('reg-error');

    this.hudTop = document.getElementById('game-hud-top');
    this.hudBottom = document.getElementById('game-hud-bottom');
    this.hudUsername = document.getElementById('hud-username');
    this.playerFcfa = document.getElementById('player-fcfa');
    this.onlineCounter = document.getElementById('online-counter');
    this.hudAvatarPreview = document.getElementById('hud-avatar-preview');

    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');
    this.chatLog = document.getElementById('chat-messages-log');
    this.toastContainer = document.getElementById('toast-container');
    this.btnLogout = document.getElementById('btn-logout');

    // Canvas Aperçu en direct de l'Avatar
    this.avatarLiveCanvas = document.getElementById('avatar-live-preview');
    this.avatarLiveCtx = this.avatarLiveCanvas ? this.avatarLiveCanvas.getContext('2d') : null;

    // État temporaire du créateur d'avatar
    this.avatarConfig = {
      skin: '#8d5524',
      hairStyle: 'afro',
      hairColor: '#1a110b',
      outfitStyle: 'faso_dan_fani',
      shirtColor: '#d97706',
      pantsColor: '#1e293b'
    };

    this.bindEvents();
    this.updateAvatarPreview();
  }

  bindEvents() {
    // Onglets Auth
    this.tabLogin.addEventListener('click', () => this.switchTab('login'));
    this.tabRegister.addEventListener('click', () => this.switchTab('register'));

    // Sélecteur de couleur de peau
    const skinPills = document.querySelectorAll('#skin-palette .color-pill');
    skinPills.forEach(pill => {
      pill.addEventListener('click', () => {
        skinPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.avatarConfig.skin = pill.dataset.color;
        this.updateAvatarPreview();
      });
    });

    // Sélecteur de couleur de tenue
    const outfitPills = document.querySelectorAll('#outfit-palette .color-pill');
    outfitPills.forEach(pill => {
      pill.addEventListener('click', () => {
        outfitPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.avatarConfig.shirtColor = pill.dataset.color;
        this.updateAvatarPreview();
      });
    });

    // Style de tenue
    const outfitSelect = document.getElementById('reg-outfit');
    if (outfitSelect) {
      outfitSelect.addEventListener('change', (e) => {
        this.avatarConfig.outfitStyle = e.target.value;
        this.updateAvatarPreview();
      });
    }

    // Coiffure
    const hairSelect = document.getElementById('reg-hair');
    if (hairSelect) {
      hairSelect.addEventListener('change', (e) => {
        this.avatarConfig.hairStyle = e.target.value;
        this.updateAvatarPreview();
      });
    }

    // Formulaire Connexion
    this.formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      this.loginError.classList.add('hidden');
      if (this.handlers.onLogin) {
        this.handlers.onLogin(username, password);
      }
    });

    // Formulaire Inscription
    this.formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;
      this.regError.classList.add('hidden');
      if (this.handlers.onRegister) {
        this.handlers.onRegister(username, password, this.avatarConfig);
      }
    });

    // Déconnexion
    this.btnLogout.addEventListener('click', () => {
      if (this.handlers.onLogout) this.handlers.onLogout();
    });

    // Chat
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (text && this.handlers.onSendChat) {
        this.handlers.onSendChat(text);
        this.chatInput.value = '';
      }
    });

    // Actions rapides / Émotes
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (this.handlers.onAction) {
          this.handlers.onAction(action);
        }
      });
    });
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
    this.hudTop.classList.add('hidden');
    this.hudBottom.classList.add('hidden');
  }

  hideAuthModal() {
    this.authOverlay.classList.add('hidden');
    this.hudTop.classList.remove('hidden');
    this.hudBottom.classList.remove('hidden');
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

  setOnlineCount(count) {
    this.onlineCounter.textContent = `${count} joueur${count > 1 ? 's' : ''} en ligne`;
  }

  showToast(message, duration = 3500) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  appendChatMessage(username, text) {
    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.innerHTML = `<span class="chat-author">${username} :</span><span class="chat-text">${text}</span>`;
    this.chatLog.appendChild(entry);
    this.chatLog.classList.remove('hidden');
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  // Rendu de l'aperçu dynamique de l'avatar dans le formulaire
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
    ctx.fillRect(8, 12, 20, 20);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(11, 19, 4, 4);
    ctx.fillRect(21, 19, 4, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(13, 20, 2, 2);
    ctx.fillRect(23, 20, 2, 2);

    ctx.fillStyle = hair;
    if (hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(18, 14, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(6, 6, 24, 8);
    }
  }
}
