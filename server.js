import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// --- Base de données JSON ---
function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = { users: [], sessions: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erreur lecture DB:', err);
    return { users: [], sessions: {} };
  }
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur sauvegarde DB:', err);
  }
}

let db = loadDatabase();

// --- Configuration Serveur Express ---
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware Auth REST
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  const userId = db.sessions[token];
  if (!userId) return res.status(403).json({ error: 'Session invalide' });

  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  req.user = user;
  req.token = token;
  next();
}

// --- Routes Authentification REST ---

// Inscription
app.post('/api/register', async (req, res) => {
  const { username, password, avatar } = req.body;
  const cleanUsername = (username || '').trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Le pseudo doit comporter au moins 3 caractères' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 4 caractères' });
  }

  const existing = db.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Ce pseudo est déjà utilisé' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: 'user_' + crypto.randomUUID().slice(0, 8),
    username: cleanUsername,
    passwordHash,
    avatar: avatar || {
      skin: '#8d5524',
      hairStyle: 'afro',
      hairColor: '#1a110b',
      outfitStyle: 'faso_dan_fani',
      shirtColor: '#d97706',
      pantsColor: '#1e293b'
    },
    fcfa: 15000, // 15 000 FCFA de bienvenue
    createdAt: new Date().toISOString()
  };

  const token = crypto.randomBytes(32).toString('hex');
  db.users.push(newUser);
  db.sessions[token] = newUser.id;
  saveDatabase(db);

  const { passwordHash: _, ...safeUser } = newUser;
  return res.status(201).json({ token, user: safeUser });
});

// Connexion
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim();

  const user = db.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = user.id;
  saveDatabase(db);

  const { passwordHash: _, ...safeUser } = user;
  return res.json({ token, user: safeUser });
});

// Profil courant
app.get('/api/me', authenticateToken, (req, res) => {
  const { passwordHash: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Mise à jour de l'avatar
app.post('/api/avatar', authenticateToken, (req, res) => {
  const { avatar } = req.body;
  if (avatar) {
    req.user.avatar = { ...req.user.avatar, ...avatar };
    saveDatabase(db);
  }
  const { passwordHash: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Récompense mini-job (travailler sur l'ordinateur)
app.post('/api/work', authenticateToken, (req, res) => {
  const gain = 2500; // 2 500 FCFA
  req.user.fcfa = (req.user.fcfa || 0) + gain;
  saveDatabase(db);
  res.json({ success: true, gain, fcfa: req.user.fcfa });
});

// --- Serveur HTTP & WebSockets Multijoueur ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// État de la salle (Appartement Ouagadougou)
const connectedPlayers = new Map(); // ws -> playerData
let roomOwnerId = null;

// Mobilier dynamique de la pièce (Géré et modifiable par le Propriétaire)
let roomFurniture = [
  { id: 'f_bed', type: 'bed_double', gx: 4, gy: 3, sizeX: 2, sizeY: 3, interactive: 'sleep' },
  { id: 'f_sofa', type: 'sofa_3p', gx: 7, gy: 6, sizeX: 3, sizeY: 1, interactive: 'sit' },
  { id: 'f_table', type: 'table_coffee', gx: 8, gy: 8, sizeX: 2, sizeY: 1, interactive: null },
  { id: 'f_rug', type: 'rug', gx: 6, gy: 7, sizeX: 3, sizeY: 2, interactive: null, isWalkable: true },
  { id: 'f_tv', type: 'tv_stand', gx: 10, gy: 9, sizeX: 2, sizeY: 1, interactive: 'watch_tv' },
  { id: 'f_desk', type: 'desk_pc', gx: 3, gy: 7, sizeX: 2, sizeY: 1, interactive: 'work' },
  { id: 'f_fridge', type: 'fridge', gx: 12, gy: 5, sizeX: 1, sizeY: 1, interactive: 'drink' },
  { id: 'f_sink', type: 'kitchen_sink', gx: 12, gy: 7, sizeX: 2, sizeY: 1, interactive: 'cook' }
];

// Point de spawn initial par défaut
const DEFAULT_SPAWN = { gx: 10, gy: 6 };

function broadcast(data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  let authenticatedUser = null;

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      if (msg.type === 'auth') {
        const userId = db.sessions[msg.token];
        const user = db.users.find(u => u.id === userId);
        if (!user) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Session invalide' }));
          return;
        }

        authenticatedUser = user;

        // Le premier joueur connecté devient propriétaire de l'appartement
        if (!roomOwnerId || connectedPlayers.size === 0) {
          roomOwnerId = user.id;
        }

        const isOwner = user.id === roomOwnerId;
        const playerData = {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          isOwner,
          gx: DEFAULT_SPAWN.gx + (Math.random() * 1.5 - 0.75),
          gy: DEFAULT_SPAWN.gy + (Math.random() * 1.5 - 0.75),
          targetGx: null,
          targetGy: null,
          direction: 'SE',
          isMoving: false,
          isSitting: false,
          currentAction: 'idle'
        };

        connectedPlayers.set(ws, playerData);

        // Envoyer la liste de tous les joueurs et l'état complet au nouveau joueur
        const currentPlayersList = Array.from(connectedPlayers.values());
        ws.send(JSON.stringify({
          type: 'room_init',
          selfId: user.id,
          isOwner,
          ownerId: roomOwnerId,
          players: currentPlayersList,
          furniture: roomFurniture,
          roomName: 'Résidence Ouaga 2000'
        }));

        // Informer les autres joueurs de l'arrivée de ce joueur
        broadcast({
          type: 'player_joined',
          player: playerData
        }, ws);

        console.log(`[Joueur Connecté] ${user.username} (${user.id}) - Propriétaire: ${isOwner}`);
      }

      // Déplacement du joueur
      else if (msg.type === 'move') {
        const player = connectedPlayers.get(ws);
        if (!player) return;

        player.targetGx = Math.max(0, Math.min(15, msg.targetGx));
        player.targetGy = Math.max(0, Math.min(15, msg.targetGy));
        player.isMoving = true;
        player.isSitting = false;
        player.currentAction = 'walking';
        if (msg.direction) player.direction = msg.direction;

        broadcast({
          type: 'player_move',
          id: player.id,
          targetGx: player.targetGx,
          targetGy: player.targetGy,
          direction: player.direction
        });
      }

      // Synchronisation de position
      else if (msg.type === 'position_sync') {
        const player = connectedPlayers.get(ws);
        if (!player) return;

        player.gx = msg.gx;
        player.gy = msg.gy;
        player.isMoving = msg.isMoving;
        if (msg.direction) player.direction = msg.direction;

        broadcast({
          type: 'player_position',
          id: player.id,
          gx: player.gx,
          gy: player.gy,
          direction: player.direction,
          isMoving: player.isMoving
        }, ws);
      }

      // Message de chat dans la pièce
      else if (msg.type === 'chat') {
        const player = connectedPlayers.get(ws);
        if (!player) return;

        const cleanText = (msg.text || '').trim().slice(0, 120);
        if (!cleanText) return;

        broadcast({
          type: 'player_chat',
          id: player.id,
          username: player.username,
          text: cleanText,
          timestamp: Date.now()
        });
      }

      // Action spécifique (s'asseoir, saluer, danser, etc.)
      else if (msg.type === 'action') {
        const player = connectedPlayers.get(ws);
        if (!player) return;

        player.currentAction = msg.action;
        if (msg.action === 'sit') {
          player.isSitting = true;
          player.isMoving = false;
        } else if (msg.action === 'stand') {
          player.isSitting = false;
        }

        broadcast({
          type: 'player_action',
          id: player.id,
          action: msg.action,
          isSitting: player.isSitting
        });
      }

      // Customisation du mobilier (Réservé au Propriétaire)
      else if (msg.type === 'furniture_place') {
        const player = connectedPlayers.get(ws);
        if (!player || player.id !== roomOwnerId) return;

        const newItem = {
          id: 'f_' + crypto.randomUUID().slice(0, 8),
          type: msg.item.type,
          gx: Math.round(msg.item.gx),
          gy: Math.round(msg.item.gy),
          sizeX: msg.item.sizeX || 1,
          sizeY: msg.item.sizeY || 1,
          interactive: msg.item.interactive || null,
          isWalkable: !!msg.item.isWalkable
        };

        roomFurniture.push(newItem);
        broadcast({ type: 'furniture_sync', furniture: roomFurniture });
      }

      else if (msg.type === 'furniture_move') {
        const player = connectedPlayers.get(ws);
        if (!player || player.id !== roomOwnerId) return;

        const item = roomFurniture.find(f => f.id === msg.id);
        if (item) {
          item.gx = Math.round(msg.gx);
          item.gy = Math.round(msg.gy);
          broadcast({ type: 'furniture_sync', furniture: roomFurniture });
        }
      }

      else if (msg.type === 'furniture_remove') {
        const player = connectedPlayers.get(ws);
        if (!player || player.id !== roomOwnerId) return;

        roomFurniture = roomFurniture.filter(f => f.id !== msg.id);
        broadcast({ type: 'furniture_sync', furniture: roomFurniture });
      }

      // Réinitialisation des meubles (Supprimer tout)
      else if (msg.type === 'furniture_clear') {
        const player = connectedPlayers.get(ws);
        if (!player || player.id !== roomOwnerId) return;

        roomFurniture = [];
        broadcast({ type: 'furniture_sync', furniture: roomFurniture });
      }
    } catch (e) {
      console.error('Erreur traitement message WebSocket:', e);
    }
  });

  ws.on('close', () => {
    const player = connectedPlayers.get(ws);
    if (player) {
      connectedPlayers.delete(ws);
      console.log(`[Joueur Déconnecté] ${player.username}`);
      broadcast({
        type: 'player_left',
        id: player.id
      });

      // Si le propriétaire quitte, céder la propriété au joueur restant
      if (player.id === roomOwnerId) {
        const remaining = Array.from(connectedPlayers.values());
        if (remaining.length > 0) {
          roomOwnerId = remaining[0].id;
          remaining[0].isOwner = true;
          broadcast({
            type: 'owner_assigned',
            ownerId: roomOwnerId,
            username: remaining[0].username
          });
          console.log(`[Nouveau Propriétaire] ${remaining[0].username}`);
        } else {
          roomOwnerId = null;
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Your-Life] Serveur opérationnel sur http://localhost:${PORT}`);
});

