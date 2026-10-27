// --- Point d'Entrée Principal de l'Application Your-Life ---

import { IsometricEngine } from './engine.js';
import { NetworkClient } from './network.js';
import { UIManager } from './ui.js';

class YourLifeApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.clickMarker = document.getElementById('click-marker');

    // Initialisation du client réseau
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
        this.ui.setOnlineCount(data.players.length);
        this.ui.showToast(`Bienvenue dans la ${data.roomName} !`, 3000);
      },
      onPlayerJoined: (player) => {
        this.engine.addOrUpdatePlayer(player);
        this.ui.setOnlineCount(this.engine.players.size);
        this.ui.showToast(`${player.username} a rejoint l'appartement.`, 2500);
      },
      onPlayerLeft: (id) => {
        this.engine.removePlayer(id);
        this.ui.setOnlineCount(this.engine.players.size);
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

    // Initialisation du moteur isométrique
    this.engine = new IsometricEngine(
      this.canvas,
      (clickData) => this.handleFloorClick(clickData),
      (moveData) => this.handlePlayerMoveStep(moveData)
    );

    // Initialisation du gestionnaire UI
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
      onAction: async (action) => {
        if (action === 'work') {
          // Mini-jeu travail à l'ordinateur
          const res = await this.network.workPC();
          if (res && res.success) {
            this.ui.updateFCFA(res.fcfa);
            this.ui.showToast(`+${new Intl.NumberFormat('fr-FR').format(res.gain)} FCFA gagnés en télétravail !`, 3000);
            this.network.sendChat('*travaille activement sur son projet web*');
          }
        } else if (action === 'drink') {
          this.network.sendAction('drink');
          this.network.sendChat('*déguste un verre de jus de Bissap bien frais*');
        } else if (action === 'wave') {
          this.network.sendAction('wave');
          this.network.sendChat('Salutations tout le monde !');
        } else if (action === 'dance') {
          this.network.sendAction('dance');
          this.network.sendChat('*danse au rythme du Coupé-Décalé et Warba*');
        } else if (action === 'sit') {
          this.network.sendAction('sit');
        }
      }
    });

    // Vérifier si une session active existe déjà
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
    // Afficher le marqueur visuel au sol
    if (this.clickMarker) {
      this.clickMarker.style.left = `${clickData.windowX}px`;
      this.clickMarker.style.top = `${clickData.windowY}px`;
      this.clickMarker.classList.remove('hidden');

      // Réinitialiser l'animation
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

    // Informer le serveur du mouvement demandé
    if (this.network.isConnected) {
      this.network.sendMove(clickData.gx, clickData.gy);
    }

    // Actions automatiques contextuelles
    if (clickData.cellType === 2) {
      this.ui.showToast('Déplacement vers le canapé...', 1500);
    } else if (clickData.cellType === 3) {
      this.ui.showToast('Déplacement vers le bureau...', 1500);
    } else if (clickData.cellType === 4) {
      this.ui.showToast('Déplacement vers le comptoir cuisine...', 1500);
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
}

// Initialisation au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  new YourLifeApp();
});
