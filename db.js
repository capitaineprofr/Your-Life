import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Résolution DNS pour éviter les erreurs SRV sur certains réseaux
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignorer si les droits DNS locaux ne le permettent pas
}

// --- Schémas Mongoose ---
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  avatar: {
    skin: { type: String, default: '#8d5524' },
    hairStyle: { type: String, default: 'afro' },
    hairColor: { type: String, default: '#1a110b' },
    outfitStyle: { type: String, default: 'faso_dan_fani' },
    shirtColor: { type: String, default: '#d97706' },
    pantsColor: { type: String, default: '#1e293b' }
  },
  fcfa: { type: Number, default: 15000 },
  createdAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' }
});

// Schéma du Logement Personnel & Architecture (Instance par Joueur)
const houseSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, unique: true, index: true },
  ownerUsername: { type: String, default: 'Joueur' },
  roomName: { type: String, default: 'Résidence Ouaga 2000' },
  architecture: {
    gridSize: { type: Number, default: 16 },
    wallColor: { type: String, default: 'plaster_ochre' }, // plaster_ochre, brick_adobe, modern_white, indigo_sahara, green_faso, wood_boiserie
    floorType: { type: String, default: 'acacia_parquet' }, // acacia_parquet, white_tile, marble, terracotta, carpet_soft
    rugType: { type: String, default: 'sahelian_red' }, // sahelian_red, faso_dan_fani, berbere, none
    windowType: { type: String, default: 'large_bay' }, // large_bay, wooden_louver, double_modern, none
    wallHeight: { type: Number, default: 5.5 }
  },
  furniture: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
const SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);
const HouseModel = mongoose.models.House || mongoose.model('House', houseSchema);

let isConnectedToMongo = false;
let localDb = { users: [], sessions: {}, houses: {} };

const DEFAULT_FURNITURE = [
  { id: 'f_leader_table', type: 'mayor_table', gx: 6, gy: 6, sizeX: 2, sizeY: 1, rotation: 0, interactive: 'work', isSurface: true, surfaceHeight: 0.75 },
  { id: 'f_tea_cup', type: 'cup_tea', gx: 6, gy: 6, sizeX: 1, sizeY: 1, rotation: 0, elevation: 0.75, surfaceParentId: 'f_leader_table' }
];

const DEFAULT_ARCHITECTURE = {
  gridSize: 16,
  wallColor: 'plaster_ochre',
  floorType: 'acacia_parquet',
  rugType: 'sahelian_red',
  windowType: 'large_bay',
  wallHeight: 5.5
};

// --- Gestion DB Locale (Fallback hors-ligne) ---
function loadLocalDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { users: [], sessions: {}, houses: {} };
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.houses) parsed.houses = {};
    return parsed;
  } catch (err) {
    console.error('[DB Local] Erreur lecture:', err.message);
    return { users: [], sessions: {}, houses: {} };
  }
}

function saveLocalDatabase() {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB Local] Erreur sauvegarde:', err.message);
  }
}

// Migration automatique des données locales vers MongoDB au premier démarrage
async function autoMigrateLocalData() {
  try {
    localDb = loadLocalDatabase();
    if (localDb.users && localDb.users.length > 0) {
      const count = await UserModel.countDocuments();
      if (count === 0) {
        console.log(`[MongoDB] Migration de ${localDb.users.length} utilisateur(s) local/locaux vers MongoDB...`);
        for (const u of localDb.users) {
          await UserModel.updateOne(
            { id: u.id },
            { $setOnInsert: u },
            { upsert: true }
          );
        }
        for (const [token, userId] of Object.entries(localDb.sessions || {})) {
          await SessionModel.updateOne(
            { token },
            { $setOnInsert: { token, userId } },
            { upsert: true }
          );
        }
        console.log('[MongoDB] Migration locale terminée avec succès.');
      }
    }
  } catch (err) {
    console.error('[MongoDB] Erreur lors de la migration locale:', err.message);
  }
}

export async function initDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] Aucun MONGODB_URI configuré. Mode local database.json actif.');
    localDb = loadLocalDatabase();
    return false;
  }

  try {
    console.log('[DB] Connexion à MongoDB Atlas en cours...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000
    });
    isConnectedToMongo = true;
    console.log('[DB] Connexion à MongoDB Atlas réussie.');
    await autoMigrateLocalData();
    return true;
  } catch (err) {
    console.error('[DB] Échec de la connexion à MongoDB Atlas:', err.message);
    console.warn('[DB] Basculement de secours sur data/database.json local.');
    localDb = loadLocalDatabase();
    isConnectedToMongo = false;
    return false;
  }
}

// --- Opérations Utilisateurs ---

export async function findUserById(id) {
  if (isConnectedToMongo) {
    const doc = await UserModel.findOne({ id }).lean();
    return doc || null;
  }
  return localDb.users.find(u => u.id === id) || null;
}

export async function findUserByUsername(username) {
  const clean = (username || '').trim().toLowerCase();
  if (isConnectedToMongo) {
    const doc = await UserModel.findOne({ username: new RegExp(`^${clean}$`, 'i') }).lean();
    return doc || null;
  }
  return localDb.users.find(u => u.username.toLowerCase() === clean) || null;
}

export async function createUser({ username, passwordHash, avatar, fcfa }) {
  const newUser = {
    id: 'user_' + crypto.randomUUID().slice(0, 8),
    username: username.trim(),
    passwordHash,
    avatar: avatar || {
      skin: '#8d5524',
      hairStyle: 'afro',
      hairColor: '#1a110b',
      outfitStyle: 'faso_dan_fani',
      shirtColor: '#d97706',
      pantsColor: '#1e293b'
    },
    fcfa: typeof fcfa === 'number' ? fcfa : 15000,
    createdAt: new Date()
  };

  if (isConnectedToMongo) {
    await UserModel.create(newUser);
  } else {
    localDb.users.push(newUser);
    saveLocalDatabase();
  }

  return newUser;
}

export async function updateUserAvatar(userId, avatar) {
  if (isConnectedToMongo) {
    const updated = await UserModel.findOneAndUpdate(
      { id: userId },
      { $set: { avatar } },
      { new: true }
    ).lean();
    return updated;
  }
  const u = localDb.users.find(user => user.id === userId);
  if (u) {
    u.avatar = { ...u.avatar, ...avatar };
    saveLocalDatabase();
  }
  return u;
}

export async function addFcfa(userId, amount) {
  if (isConnectedToMongo) {
    const updated = await UserModel.findOneAndUpdate(
      { id: userId },
      { $inc: { fcfa: amount } },
      { new: true }
    ).lean();
    return updated;
  }
  const u = localDb.users.find(user => user.id === userId);
  if (u) {
    u.fcfa = (u.fcfa || 0) + amount;
    saveLocalDatabase();
  }
  return u;
}

// --- Opérations Sessions ---

export async function createSession(token, userId) {
  if (isConnectedToMongo) {
    await SessionModel.create({ token, userId });
  } else {
    localDb.sessions[token] = userId;
    saveLocalDatabase();
  }
}

export async function getUserIdByToken(token) {
  if (!token) return null;
  if (isConnectedToMongo) {
    const session = await SessionModel.findOne({ token }).lean();
    return session ? session.userId : null;
  }
  return localDb.sessions[token] || null;
}

// --- Opérations Logements Personnels (Instances par Joueur) ---

export async function getOrCreateHouse(ownerId, ownerUsername = 'Joueur') {
  if (isConnectedToMongo) {
    try {
      let house = await HouseModel.findOne({ ownerId }).lean();
      if (!house) {
        const newHouse = {
          ownerId,
          ownerUsername,
          roomName: `Résidence de ${ownerUsername}`,
          architecture: { ...DEFAULT_ARCHITECTURE },
          furniture: [...DEFAULT_FURNITURE],
          updatedAt: new Date()
        };
        const created = await HouseModel.create(newHouse);
        return created.toObject();
      }
      return house;
    } catch (e) {
      console.error('[DB] Erreur getOrCreateHouse Mongo:', e.message);
    }
  }

  // Fallback local
  if (!localDb.houses) localDb.houses = {};
  if (!localDb.houses[ownerId]) {
    localDb.houses[ownerId] = {
      ownerId,
      ownerUsername,
      roomName: `Résidence de ${ownerUsername}`,
      architecture: { ...DEFAULT_ARCHITECTURE },
      furniture: [...DEFAULT_FURNITURE],
      updatedAt: new Date().toISOString()
    };
    saveLocalDatabase();
  }
  return localDb.houses[ownerId];
}

export async function saveHouseArchitecture(ownerId, architecture) {
  if (isConnectedToMongo) {
    try {
      const updated = await HouseModel.findOneAndUpdate(
        { ownerId },
        { $set: { architecture, updatedAt: new Date() } },
        { new: true, upsert: true }
      ).lean();
      return updated.architecture;
    } catch (e) {
      console.error('[DB] Erreur saveHouseArchitecture Mongo:', e.message);
    }
  }

  if (localDb.houses && localDb.houses[ownerId]) {
    localDb.houses[ownerId].architecture = { ...localDb.houses[ownerId].architecture, ...architecture };
    localDb.houses[ownerId].updatedAt = new Date().toISOString();
    saveLocalDatabase();
    return localDb.houses[ownerId].architecture;
  }
  return architecture;
}

export async function saveHouseFurniture(ownerId, furniture) {
  if (isConnectedToMongo) {
    try {
      await HouseModel.updateOne(
        { ownerId },
        { $set: { furniture, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error('[DB] Erreur saveHouseFurniture Mongo:', e.message);
    }
  }

  if (localDb.houses && localDb.houses[ownerId]) {
    localDb.houses[ownerId].furniture = furniture;
    localDb.houses[ownerId].updatedAt = new Date().toISOString();
    saveLocalDatabase();
  }
}

export async function listAllHouses() {
  if (isConnectedToMongo) {
    try {
      const houses = await HouseModel.find({}, 'ownerId ownerUsername roomName architecture updatedAt')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean();
      return houses;
    } catch (e) {
      console.error('[DB] Erreur listAllHouses Mongo:', e.message);
    }
  }

  return Object.values(localDb.houses || {}).map(h => ({
    ownerId: h.ownerId,
    ownerUsername: h.ownerUsername,
    roomName: h.roomName,
    architecture: h.architecture,
    updatedAt: h.updatedAt
  }));
}
