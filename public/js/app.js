// --- Point d'Entrée Principal Your-Life (Customisation, Multijoueur & Besoins) ---

import { IsometricEngine } from './engine.js';
import { NetworkClient } from './network.js';
import { UIManager } from './ui.js';

class YourLifeApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.clickMarker = document.getElementById('click-marker');

    // Initialisation Client Réseau
    this.network = new NetworkClient({
      onConnected: () => {
        console.log('[Réseau] Connecté au serveur multijoueur');
      },
      onDisconnected: () => {
        console.warn('[Réseau] Déconnecté du serveur');
        this.ui.showToast('Connexion perdue. Tentative de reconnexion...', 4000);
      },
      onRoomInit: (data) => {
        this.engine.setPlayers(data.players);
        this.engine.setLocalPlayerId(data.selfId);
        this.engine.setIsOwner(data.isOwner);
        this.engine.setFurniture(data.furniture);

        this.ui.setOwnerStatus(data.isOwner);
        this.ui.showToast(data.isOwner
          ? 'Vous êtes le premier connecté : Propriétaire de l\'appartement !'
          : `Bienvenue dans la ${data.roomName} !`, 4000);
      },
      onPlayerJoined: (player) => {
        this.engine.addOrUpdatePlayer(player);
        this.ui.showToast(`${player.username} a rejoint l'appartement.`, 2500);
      },
      onPlayerLeft: (id) => {
        this.engine.removePlayer(id);
      },
      onOwnerAssigned: (ownerId, username) => {
        const isOwner = ownerId === this.network.currentUser?.id;
        this.engine.setIsOwner(isOwner);
        this.ui.setOwnerStatus(isOwner);
        this.ui.showToast(isOwner
          ? 'Vous êtes maintenant le propriétaire de la résidence !'
          : `${username} est le nouveau propriétaire de la salle.`, 4000);
      },
      onFurnitureSync: (furniture) => {
        this.engine.setFurniture(furniture);
      },
      onPlayerMove: (data) => {
        if (data.id !== this.network.currentUser?.id) {
          this.engine.movePlayerTo(data.id, data.targetGx, data.targetGy);
        }
      },
      onPlayerPosition: (data) => {
        if (data.id !== this.network.currentUser?.id) {
          const player = this.engine.players.get(data.id);
          if (player) {
            player.gx = data.gx;
            player.gy = data.gy;
            player.direction = data.direction;
            player.isMoving = data.isMoving;
          }
        }
      },
      onPlayerChat: (data) => {
        this.engine.setPlayerChat(data.id, data.text);
        this.ui.appendChatMessage(data.username, data.text);
      },
      onPlayerAction: (data) => {
        this.engine.setPlayerAction(data.id, data.action);
      },
      onAuthError: (err) => {
        this.ui.showToast(`Erreur d'authentification : ${err}`, 4000);
        this.ui.showAuthModal();
      }
    });

    // Initialisation Moteur Isométrique
    this.engine = new IsometricEngine(this.canvas, {
      onFloorClick: (clickData) => this.handleFloorClick(clickData),
      onPlayerMoveStep: (moveData) => this.handlePlayerMoveStep(moveData),
      onPlaceFurniture: (item) => {
        this.network.sendFurniturePlace(item);
        this.ui.showToast(`Meuble posé : ${item.type}`, 2000);
      },
      onSelectFurniture: (item) => {
        this.ui.showFurnitureSelection(item);
      },
      onDeselectFurniture: () => {
        this.ui.hideFurnitureSelection();
      },
      onFurnitureInteract: (item) => this.handleFurnitureInteraction(item)
    });

    // Initialisation Gestionnaire UI
    this.ui = new UIManager({
      onLogin: async (username, password) => {
        try {
          const res = await this.network.login(username, password);
          this.ui.setUserProfile(res.user);
          this.ui.hideAuthModal();
          this.network.connectWebSocket();
        } catch (err) {
          this.ui.setLoginError(err.message);
        }
      },
      onRegister: async (username, password, avatarConfig) => {
        try {
          const res = await this.network.register(username, password, avatarConfig);
          this.ui.setUserProfile(res.user);
          this.ui.hideAuthModal();
          this.network.connectWebSocket();
        } catch (err) {
          this.ui.setRegisterError(err.message);
        }
      },
      onLogout: () => {
        this.network.logout();
        this.engine.players.clear();
        this.ui.showAuthModal();
      },
      onSendChat: (text) => {
        this.network.sendChat(text);
      },
      onStartPlacing: (itemType) => {
        this.engine.setPlacingItem(itemType);
      },
      onCancelPlacing: () => {
        this.engine.cancelPlacing();
      },
      onDeleteSelectedFurniture: () => {
        if (this.engine.selectedFurniture) {
          this.network.sendFurnitureRemove(this.engine.selectedFurniture.id);
          this.engine.selectedFurniture = null;
          this.ui.hideFurnitureSelection();
          this.ui.showToast('Meuble supprimé', 1500);
        }
      },
      onClearRoom: () => {
        this.network.sendFurnitureClear();
        this.engine.selectedFurniture = null;
        this.ui.hideFurnitureSelection();
        this.ui.showToast('Tous les meubles ont été retirés', 2500);
      },
      onZoom: (factor) => {
        this.engine.userZoom = Math.min(2.5, Math.max(0.65, this.engine.userZoom * factor));
        this.engine.resize();
      },
      onRecenter: () => {
        this.engine.recenter();
        this.ui.showToast('Vue recentrée', 1500);
      },
      onAction: async (action) => {
        if (action === 'work') {
          const res = await this.network.workPC();
          if (res && res.success) {
            this.ui.updateFCFA(res.fcfa);
            this.ui.replenishNeed('energy', -6);
            this.ui.showToast(`+${new Intl.NumberFormat('fr-FR').format(res.gain)} FCFA gagnés !`, 2500);
            this.network.sendChat('*travaille activement sur son projet web*');
          }
        } else if (action === 'drink') {
          this.network.sendAction('drink');
          this.ui.replenishNeed('thirst', 35);
          this.network.sendChat('*déguste un grand verre de Bissap frais*');
        } else if (action === 'dance') {
          this.network.sendAction('dance');
          this.ui.replenishNeed('energy', 10);
          this.network.sendChat('*danse au rythme du Coupé-Décalé et Warba*');
        }
      }
    });

    this.checkInitialSession();
  }

  async checkInitialSession() {
    const user = await this.network.fetchMe();
    if (user) {
      this.ui.setUserProfile(user);
      this.ui.hideAuthModal();
      this.network.connectWebSocket();
    } else {
      this.ui.showAuthModal();
    }
  }

  handleFloorClick(clickData) {
    if (this.clickMarker) {
      this.clickMarker.style.left = `${clickData.windowX}px`;
      this.clickMarker.style.top = `${clickData.windowY}px`;
      this.clickMarker.classList.remove('hidden');

      const ring = this.clickMarker.querySelector('.marker-ring');
      if (ring) {
        ring.style.animation = 'none';
        void ring.offsetWidth;
        ring.style.animation = 'marker-pulse 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
      }

      setTimeout(() => {
        this.clickMarker.classList.add('hidden');
      }, 700);
    }

    if (this.network.isConnected) {
      this.network.sendMove(clickData.gx, clickData.gy);
    }
  }

  handlePlayerMoveStep(moveData) {
    if (this.network.isConnected) {
      this.network.sendPositionSync(
        moveData.gx,
        moveData.gy,
        moveData.direction,
        moveData.isMoving
      );
    }
  }

  handleFurnitureInteraction(item) {
    const id = this.network.currentUser?.id;
    if (!id) return;

    switch (item.interactive) {
      case 'sleep':
        this.engine.setPlayerAction(id, 'sleep');
        this.network.sendAction('sleep');
        this.ui.replenishNeed('energy', 40);
        this.ui.showToast('Vous vous reposez dans le lit... (+Sommeil)', 2500);
        this.network.sendChat('*s\'allonge pour une sieste réparatrice*');
        break;

      case 'sit':
        this.engine.setPlayerAction(id, 'sit');
        this.network.sendAction('sit');
        this.ui.replenishNeed('energy', 15);
        this.ui.showToast('Vous êtes assis confortablement.', 2000);
        break;

      case 'drink':
        this.network.sendAction('drink');
        this.ui.replenishNeed('thirst', 40);
        this.ui.showToast('Vous vous servez une boisson fraîche (+Soif)', 2500);
        this.network.sendChat('*prend une boisson fraîche au réfrigérateur*');
        break;

      case 'cook':
        this.ui.replenishNeed('hunger', 45);
        this.ui.showToast('Vous cuisinez un plat traditionnel (+Faim)', 2500);
        this.network.sendChat('*cuisine un délicieux riz gras au soumbala*');
        break;

      case 'work':
        this.ui.handlers.onAction('work');
        break;

      case 'watch_tv':
        this.network.sendChat('*regarde les informations sur la RTB*');
        this.ui.showToast('Vous regardez la télévision.', 2000);
        break;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new YourLifeApp();
});
