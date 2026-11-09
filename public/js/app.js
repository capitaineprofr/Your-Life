// --- Point d'Entrée Principal Your-Life (Customisation, Multijoueur & Architecture) ---

import { IsometricEngine } from './engine.js';
import { NetworkClient } from './network.js';
import { UIManager } from './ui.js';
import { ouagaMap } from './ouaga_map_3d.js';

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
        if (data.architecture) {
          this.engine.buildRoom(data.architecture);
          this.ui.setArchitecture(data.architecture);
        }
        this.engine.setPlayers(data.players || []);
        this.engine.setLocalPlayerId(data.selfId);
        this.engine.setIsOwner(data.isOwner);
        this.engine.setFurniture(data.furniture || []);

        this.ui.setOwnerStatus(data.isOwner, data.roomName);
        this.ui.showToast(data.isOwner
          ? 'Bienvenue dans votre logement personnel !'
          : `Bienvenue dans la ${data.roomName || 'résidence'} !`, 3500);
      },
      onHouseArchitectureSync: (architecture) => {
        this.engine.buildRoom(architecture);
        this.ui.setArchitecture(architecture);
        this.ui.showToast("L'architecture de la pièce a été modifiée !", 2000);
      },
      onPlayerJoined: (player) => {
        this.engine.addOrUpdatePlayer(player);
        this.ui.showToast(`${player.username} est entré dans le logement.`, 2500);
      },
      onPlayerLeft: (id) => {
        this.engine.removePlayer(id);
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
      onToast: (msg, dur) => this.ui.showToast(msg, dur),
      onPlaceFurniture: (item) => {
        this.network.sendFurniturePlace(item);
        const stackMention = item.elevation > 0 ? ' (posé sur table)' : '';
        this.ui.showToast(`Objet posé : ${item.type}${stackMention}`, 2000);
      },
      onSelectFurniture: (item) => {
        this.ui.showFurnitureSelection(item);
      },
      onDeselectFurniture: () => {
        this.ui.hideFurnitureSelection();
      },
      onRotateFurniture: (id) => {
        this.network.sendFurnitureRotate(id);
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
      onToggleView: () => {
        const mode = this.engine.toggleViewMode();
        this.ui.showToast(mode === 'architectural' ? 'Vue Architecture Sims active' : 'Vue Photo active', 2000);
        return mode;
      },
      onRotateSelectedFurniture: () => {
        if (this.engine.selectedFurniture) {
          this.engine.rotateSelectedFurniture();
          this.ui.showToast('Meuble pivoté de 90°', 1200);
        }
      },
      onDeselectFurniture: () => {
        this.engine.selectedFurniture = null;
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
      onArchitectureChange: (archChanges) => {
        this.network.sendHouseArchitectureUpdate(archChanges);
      },
      onFetchHouses: async () => {
        return await this.network.fetchPublicHouses();
      },
      onSwitchHouse: (targetOwnerId) => {
        this.network.sendSwitchHouse(targetOwnerId);
        this.ui.showToast(targetOwnerId ? 'Téléportation chez votre voisin...' : 'Retour à votre logement...', 2000);
      },
      onZoom: (factor) => {
        this.engine.userZoom = Math.min(2.5, Math.max(0.45, this.engine.userZoom * factor));
        this.engine.resize();
      },
      onRecenter: () => {
        this.engine.recenter();
        this.ui.showToast('Vue recentrée', 1500);
      },
      onOpenMap: () => {
        ouagaMap.open();
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
          this.network.sendChat('*danse au rythme du Warba et Coupé-Décalé*');
        }
      }
    });

    // Initialisation Carte 3D de Ouagadougou
    ouagaMap.init({
      onTravel: (district) => {
        this.ui.showToast(`Déplacement en taxi vers ${district.name} (-${district.taxiFare} FCFA)...`, 4000);
        this.network.sendChat(`*prend un taxi vert vers le quartier ${district.name}*`);
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
