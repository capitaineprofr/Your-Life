import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import {
  initDatabase,
  findUserById,
  findUserByUsername,
  createUser,
  updateUserAvatar,
  addFcfa,
  createSession,
  getUserIdByToken,
  getOrCreateHouse,
  saveHouseArchitecture,
  saveHouseFurniture,
  listAllHouses
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// --- Configuration Serveur Express ---
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/libs/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.use('/libs/three/addons', express.static(path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm')));

// Middleware Auth REST
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const userId = await getUserIdByToken(token);
    if (!userId) return res.status(403).json({ error: 'Session invalide' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Erreur authenticateToken:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// --- Routes Authentification & Profil ---

// Inscription
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, avatar } = req.body;
    const cleanUsername = (username || '').trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Le pseudo doit comporter au moins 3 caractères' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 4 caractères' });
    }

    const existing = await findUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Ce pseudo est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      username: cleanUsername,
      passwordHash,
      avatar
    });

    // Créer d'office l'instance de logement de l'utilisateur
    await getOrCreateHouse(newUser.id, newUser.username);

    const token = crypto.randomBytes(32).toString('hex');
    await createSession(token, newUser.id);

    const { passwordHash: _, ...safeUser } = newUser;
    return res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('Erreur inscription:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Connexion
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();

    const user = await findUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Assurer l'existence du logement
    await getOrCreateHouse(user.id, user.username);

    const token = crypto.randomBytes(32).toString('hex');
    await createSession(token, user.id);

    const { passwordHash: _, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Erreur connexion:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Profil courant
app.get('/api/me', authenticateToken, (req, res) => {
  const { passwordHash: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Mise à jour de l'avatar
app.post('/api/avatar', authenticateToken, async (req, res) => {
  try {
    const { avatar } = req.body;
    let updatedUser = req.user;
    if (avatar) {
      updatedUser = await updateUserAvatar(req.user.id, avatar);
    }
    const { passwordHash: _, ...safeUser } = updatedUser;
    res.json({ user: safeUser });
  } catch (err) {
    console.error('Erreur mise à jour avatar:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récompense mini-job
app.post('/api/work', authenticateToken, async (req, res) => {
  try {
    const gain = 2500;
    const updated = await addFcfa(req.user.id, gain);
    res.json({ success: true, gain, fcfa: updated.fcfa });
  } catch (err) {
    console.error('Erreur travail mini-job:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Liste des résidences publiques pour exploration
app.get('/api/houses', authenticateToken, async (req, res) => {
  try {
    const houses = await listAllHouses();
    const housesWithOccupancy = houses.map(h => {
      const activeRoom = houseRooms.get(h.ownerId);
      const onlineVisitors = activeRoom ? activeRoom.clients.size : 0;
      return {
        ...h,
        onlineVisitors,
        isSelf: h.ownerId === req.user.id
      };
    });
    res.json({ houses: housesWithOccupancy });
  } catch (err) {
    console.error('Erreur list houses:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// --- Serveur HTTP & WebSockets Multijoueur Multi-Instances ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Instances de logements en mémoire vive : ownerId -> { ownerId, ownerUsername, roomName, architecture, furniture, clients: Map(ws -> playerData) }
const houseRooms = new Map();

// Récupère ou instancie une pièce de logement
async function getOrInitHouseRoom(ownerId, fallbackUsername = 'Joueur') {
  if (houseRooms.has(ownerId)) {
    return houseRooms.get(ownerId);
  }

  const houseData = await getOrCreateHouse(ownerId, fallbackUsername);
  const room = {
    ownerId: houseData.ownerId,
    ownerUsername: houseData.ownerUsername || fallbackUsername,
    roomName: houseData.roomName || `Résidence de ${fallbackUsername}`,
    architecture: houseData.architecture,
    furniture: houseData.furniture || [],
    clients: new Map() // ws -> playerData
  };

  houseRooms.set(ownerId, room);
  return room;
}

function broadcastToHouse(houseOwnerId, data, excludeWs = null) {
  const room = houseRooms.get(houseOwnerId);
  if (!room) return;

  const payload = JSON.stringify(data);
  for (const clientWs of room.clients.keys()) {
    if (clientWs.readyState === WebSocket.OPEN && clientWs !== excludeWs) {
      clientWs.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  let authenticatedUser = null;
  let currentHouseOwnerId = null;

  function leaveCurrentHouse() {
    if (!currentHouseOwnerId) return;
    const room = houseRooms.get(currentHouseOwnerId);
    if (room && room.clients.has(ws)) {
      const p = room.clients.get(ws);
      room.clients.delete(ws);
      console.log(`[Joueur Déconnecté] ${p.username} de la maison de ${room.ownerUsername}`);
      broadcastToHouse(currentHouseOwnerId, {
        type: 'player_left',
        id: p.id
      });

      // Libérer la mémoire vive si la pièce est vide et n'est pas sauvegardée
      if (room.clients.size === 0) {
        // Laisser en cache ou conserver pour persistance rapide
      }
    }
    currentHouseOwnerId = null;
  }

  ws.on('message', async (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      // 1. Authentification & Connexion au Logement (par défaut son propre logement)
      if (msg.type === 'auth') {
        const userId = await getUserIdByToken(msg.token);
        const user = userId ? await findUserById(userId) : null;
        if (!user) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Session invalide' }));
          return;
        }

        authenticatedUser = user;
        const targetHouseOwnerId = msg.targetHouseId || user.id;
        await joinHouse(targetHouseOwnerId);
      }

      // 2. Bascule / Visite d'un autre Logement
      else if (msg.type === 'switch_house') {
        if (!authenticatedUser) return;
        const targetHouseOwnerId = msg.targetHouseId || authenticatedUser.id;
        if (targetHouseOwnerId === currentHouseOwnerId) return;

        leaveCurrentHouse();
        await joinHouse(targetHouseOwnerId);
      }

      // 3. Mise à jour de l'Architecture (Murs, Sols, Fenêtres, Taille) - Réservé au Propriétaire
      else if (msg.type === 'house_architecture_update') {
        if (!authenticatedUser || !currentHouseOwnerId) return;
        if (authenticatedUser.id !== currentHouseOwnerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Seul le propriétaire peut modifier l\'architecture.' }));
          return;
        }

        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        room.architecture = { ...room.architecture, ...msg.architecture };
        await saveHouseArchitecture(currentHouseOwnerId, room.architecture);

        broadcastToHouse(currentHouseOwnerId, {
          type: 'house_architecture_sync',
          architecture: room.architecture
        });

        console.log(`[Architecture] Mise à jour de la résidence de ${room.ownerUsername}`);
      }

      // 4. Déplacement du Joueur dans le Logement
      else if (msg.type === 'move') {
        if (!currentHouseOwnerId) return;
        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const player = room.clients.get(ws);
        if (!player) return;

        const maxCoord = (room.architecture?.gridSize || 16) - 1;
        player.targetGx = Math.max(0, Math.min(maxCoord, msg.targetGx));
        player.targetGy = Math.max(0, Math.min(maxCoord, msg.targetGy));
        player.isMoving = true;
        player.isSitting = false;
        player.currentAction = 'walking';
        if (msg.direction) player.direction = msg.direction;

        broadcastToHouse(currentHouseOwnerId, {
          type: 'player_move',
          id: player.id,
          targetGx: player.targetGx,
          targetGy: player.targetGy,
          direction: player.direction
        });
      }

      // Synchronisation de Position
      else if (msg.type === 'position_sync') {
        if (!currentHouseOwnerId) return;
        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const player = room.clients.get(ws);
        if (!player) return;

        player.gx = msg.gx;
        player.gy = msg.gy;
        player.isMoving = msg.isMoving;
        if (msg.direction) player.direction = msg.direction;

        broadcastToHouse(currentHouseOwnerId, {
          type: 'player_position',
          id: player.id,
          gx: player.gx,
          gy: player.gy,
          direction: player.direction,
          isMoving: player.isMoving
        }, ws);
      }

      // Chat de la pièce
      else if (msg.type === 'chat') {
        if (!currentHouseOwnerId) return;
        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const player = room.clients.get(ws);
        if (!player) return;

        const cleanText = (msg.text || '').trim().slice(0, 120);
        if (!cleanText) return;

        broadcastToHouse(currentHouseOwnerId, {
          type: 'player_chat',
          id: player.id,
          username: player.username,
          text: cleanText,
          timestamp: Date.now()
        });
      }

      // Action spécifique (s'asseoir, etc.)
      else if (msg.type === 'action') {
        if (!currentHouseOwnerId) return;
        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const player = room.clients.get(ws);
        if (!player) return;

        player.currentAction = msg.action;
        if (msg.action === 'sit') {
          player.isSitting = true;
          player.isMoving = false;
        } else if (msg.action === 'stand') {
          player.isSitting = false;
        }

        broadcastToHouse(currentHouseOwnerId, {
          type: 'player_action',
          id: player.id,
          action: msg.action,
          isSitting: player.isSitting
        });
      }

      // --- Customisation du Mobilier (Réservé au Propriétaire du Logement) ---
      else if (msg.type === 'furniture_place') {
        if (!authenticatedUser || !currentHouseOwnerId) return;
        if (authenticatedUser.id !== currentHouseOwnerId) return;

        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const newItem = {
          id: msg.item.id || ('f_' + crypto.randomUUID().slice(0, 8)),
          type: msg.item.type,
          gx: Math.round(msg.item.gx),
          gy: Math.round(msg.item.gy),
          sizeX: msg.item.sizeX || 1,
          sizeY: msg.item.sizeY || 1,
          rotation: msg.item.rotation || 0,
          elevation: msg.item.elevation || 0,
          surfaceParentId: msg.item.surfaceParentId || null,
          isSurface: !!msg.item.isSurface,
          surfaceHeight: msg.item.surfaceHeight || 0,
          isTabletop: !!msg.item.isTabletop,
          isWalkable: !!msg.item.isWalkable,
          interactive: msg.item.interactive || null
        };

        room.furniture.push(newItem);
        await saveHouseFurniture(currentHouseOwnerId, room.furniture);
        broadcastToHouse(currentHouseOwnerId, { type: 'furniture_sync', furniture: room.furniture });
      }

      else if (msg.type === 'furniture_rotate') {
        if (!authenticatedUser || !currentHouseOwnerId) return;
        if (authenticatedUser.id !== currentHouseOwnerId) return;

        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const item = room.furniture.find(f => f.id === msg.id);
        if (item) {
          item.rotation = ((item.rotation || 0) + 90) % 360;
          await saveHouseFurniture(currentHouseOwnerId, room.furniture);
          broadcastToHouse(currentHouseOwnerId, { type: 'furniture_sync', furniture: room.furniture });
        }
      }

      else if (msg.type === 'furniture_move') {
        if (!authenticatedUser || !currentHouseOwnerId) return;
        if (authenticatedUser.id !== currentHouseOwnerId) return;

        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        const item = room.furniture.find(f => f.id === msg.id);
        if (item) {
          item.gx = Math.round(msg.gx);
          item.gy = Math.round(msg.gy);
          await saveHouseFurniture(currentHouseOwnerId, room.furniture);
          broadcastToHouse(currentHouseOwnerId, { type: 'furniture_sync', furniture: room.furniture });
        }
      }

      else if (msg.type === 'furniture_remove') {
        if (!authenticatedUser || !currentHouseOwnerId) return;
        if (authenticatedUser.id !== currentHouseOwnerId) return;

        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        // Supprimer aussi les objets qui étaient posés sur ce meuble
        room.furniture = room.furniture.filter(f => f.id !== msg.id && f.surfaceParentId !== msg.id);
        await saveHouseFurniture(currentHouseOwnerId, room.furniture);
        broadcastToHouse(currentHouseOwnerId, { type: 'furniture_sync', furniture: room.furniture });
      }

      else if (msg.type === 'furniture_clear') {
        if (!authenticatedUser || !currentHouseOwnerId) return;
        if (authenticatedUser.id !== currentHouseOwnerId) return;

        const room = houseRooms.get(currentHouseOwnerId);
        if (!room) return;

        room.furniture = [];
        await saveHouseFurniture(currentHouseOwnerId, room.furniture);
        broadcastToHouse(currentHouseOwnerId, { type: 'furniture_sync', furniture: room.furniture });
      }
    } catch (e) {
      console.error('Erreur traitement message WebSocket:', e);
    }
  });

  async function joinHouse(targetHouseOwnerId) {
    const room = await getOrInitHouseRoom(targetHouseOwnerId, authenticatedUser.username);
    currentHouseOwnerId = targetHouseOwnerId;

    const isOwner = authenticatedUser.id === room.ownerId;
    const defaultCenter = Math.floor((room.architecture?.gridSize || 16) / 2);

    const playerData = {
      id: authenticatedUser.id,
      username: authenticatedUser.username,
      avatar: authenticatedUser.avatar,
      isOwner,
      gx: defaultCenter + (Math.random() * 1.5 - 0.75),
      gy: defaultCenter + (Math.random() * 1.5 - 0.75),
      targetGx: null,
      targetGy: null,
      direction: 'SE',
      isMoving: false,
      isSitting: false,
      currentAction: 'idle'
    };

    room.clients.set(ws, playerData);

    // Initialisation chez le client
    const currentPlayersList = Array.from(room.clients.values());
    ws.send(JSON.stringify({
      type: 'room_init',
      selfId: authenticatedUser.id,
      isOwner,
      ownerId: room.ownerId,
      ownerUsername: room.ownerUsername,
      roomName: room.roomName,
      architecture: room.architecture,
      furniture: room.furniture,
      players: currentPlayersList
    }));

    // Informer les autres visiteurs de cette maison
    broadcastToHouse(currentHouseOwnerId, {
      type: 'player_joined',
      player: playerData
    }, ws);

    console.log(`[Logement] ${authenticatedUser.username} a rejoint la résidence de ${room.ownerUsername} (Hôte: ${isOwner})`);
  }

  ws.on('close', () => {
    leaveCurrentHouse();
  });
});

// Démarrage initial et chargement des données
async function startServer() {
  await initDatabase();

  server.listen(PORT, () => {
    console.log(`[Your-Life] Serveur opérationnel sur http://localhost:${PORT}`);
  });
}

startServer();
