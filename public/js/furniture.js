// --- Catalogue et Rendu Isométrique des Meubles 3D (Style Minecraft) ---
import { MinecraftGeometryRegistry, renderMinecraftModel, MC_CONFIG } from './minecraft_geo.js';

export const FURNITURE_CATALOG = {
  sofa_3p: {
    id: 'sofa_3p',
    geoId: 'geometry.sofa_3p',
    name: 'Canapé 3 Places (Faso Dan Fani)',
    category: 'salon',
    sizeX: 3,
    sizeY: 1,
    height: 52,
    price: 35000,
    interactive: 'sit'
  },
  sofa_2p: {
    id: 'sofa_2p',
    geoId: 'geometry.sofa_2p',
    name: 'Canapé 2 Places',
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 48,
    price: 25000,
    interactive: 'sit'
  },
  armchair: {
    id: 'armchair',
    geoId: 'geometry.armchair',
    name: 'Fauteuil Confort',
    category: 'salon',
    sizeX: 1,
    sizeY: 1,
    height: 46,
    price: 15000,
    interactive: 'sit'
  },
  table_coffee: {
    id: 'table_coffee',
    geoId: 'geometry.table_coffee',
    name: 'Table Basse Bois',
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 24,
    price: 12000,
    interactive: null
  },
  tv_stand: {
    id: 'tv_stand',
    geoId: 'geometry.tv_stand',
    name: 'Meuble TV & Écran Plat',
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 60,
    price: 45000,
    interactive: 'watch_tv'
  },
  rug: {
    id: 'rug',
    geoId: 'geometry.rug',
    name: 'Tapis Faso Dan Fani',
    category: 'salon',
    sizeX: 3,
    sizeY: 2,
    height: 2,
    price: 18000,
    interactive: null,
    isWalkable: true
  },
  bed_double: {
    id: 'bed_double',
    geoId: 'geometry.bed_double',
    name: 'Grand Lit Double',
    category: 'chambre',
    sizeX: 2,
    sizeY: 3,
    height: 45,
    price: 60000,
    interactive: 'sleep'
  },
  bed_single: {
    id: 'bed_single',
    geoId: 'geometry.bed_single',
    name: 'Lit Simple',
    category: 'chambre',
    sizeX: 1,
    sizeY: 2,
    height: 40,
    price: 30000,
    interactive: 'sleep'
  },
  wardrobe: {
    id: 'wardrobe',
    geoId: 'geometry.wardrobe',
    name: 'Armoire Penderie',
    category: 'chambre',
    sizeX: 2,
    sizeY: 1,
    height: 85,
    price: 40000,
    interactive: null
  },
  bookshelf: {
    id: 'bookshelf',
    geoId: 'geometry.bookshelf',
    name: 'Bibliothèque Haute',
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 80,
    price: 28000,
    interactive: null
  },
  desk_pc: {
    id: 'desk_pc',
    geoId: 'geometry.desk_pc',
    name: 'Bureau Informatique',
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 65,
    price: 55000,
    interactive: 'work'
  },
  chair: {
    id: 'chair',
    geoId: 'geometry.chair',
    name: 'Chaise Bureau',
    category: 'bureau',
    sizeX: 1,
    sizeY: 1,
    height: 44,
    price: 8000,
    interactive: 'sit'
  },
  fridge: {
    id: 'fridge',
    geoId: 'geometry.fridge',
    name: 'Réfrigérateur Moderne',
    category: 'cuisine',
    sizeX: 1,
    sizeY: 1,
    height: 85,
    price: 50000,
    interactive: 'drink'
  },
  kitchen_sink: {
    id: 'kitchen_sink',
    geoId: 'geometry.kitchen_sink',
    name: 'Évier & Plan Cuisine',
    category: 'cuisine',
    sizeX: 2,
    sizeY: 1,
    height: 56,
    price: 42000,
    interactive: 'cook'
  },
  table_dining: {
    id: 'table_dining',
    geoId: 'geometry.table_dining',
    name: 'Table à Manger',
    category: 'cuisine',
    sizeX: 2,
    sizeY: 2,
    height: 48,
    price: 32000,
    interactive: null
  }
};

/**
 * Enregistrement dynamique d'un nouveau meuble personnalisé avec géométrie Minecraft
 */
export function registerCustomFurniture(options) {
  const { id, name, category, sizeX, sizeY, price, interactive, isWalkable, geoJson } = options;
  const geoId = `geometry.${id}`;
  
  if (geoJson) {
    MinecraftGeometryRegistry.register(geoId, geoJson);
  }

  FURNITURE_CATALOG[id] = {
    id,
    geoId,
    name: name || id,
    category: category || 'salon',
    sizeX: sizeX || 1,
    sizeY: sizeY || 1,
    height: 45,
    price: price || 20000,
    interactive: interactive || null,
    isWalkable: !!isWalkable
  };

  return FURNITURE_CATALOG[id];
}

/**
 * Rendu du mobilier via le Moteur de Géométrie Minecraft 3D Isométrique
 */
export function renderFurniture(ctx, item, screenPos, isSelected = false) {
  const type = item.type;
  const def = FURNITURE_CATALOG[type] || {};
  const geoId = def.geoId || `geometry.${type}`;
  const model = MinecraftGeometryRegistry.get(geoId);

  if (model) {
    // Rendu haute fidélité Minecraft 3D
    renderMinecraftModel(ctx, model, screenPos, {
      isSelected,
      scale: MC_CONFIG.SCALE_FACTOR
    });
  } else {
    // Rendu de secours cubique standard si aucune géométrie spécifique n'est enregistrée
    renderFallbackIsoBox(ctx, screenPos, def.sizeX || 1, def.sizeY || 1, def.height || 30, isSelected);
  }
}

/**
 * Boîte isométrique de repli si le modèle n'est pas encore chargé
 */
function renderFallbackIsoBox(ctx, screenPos, widthX, widthY, height, isSelected) {
  const { x, y } = screenPos;
  const scale = MC_CONFIG.SCALE_FACTOR;
  const uX = MC_CONFIG.TILE_U_X * scale * (widthX / 2);
  const uY = MC_CONFIG.TILE_U_Y * scale * (widthX / 2);
  const vX = MC_CONFIG.TILE_V_X * scale * (widthY / 2);
  const vY = MC_CONFIG.TILE_V_Y * scale * (widthY / 2);
  const h = height * scale;

  ctx.save();
  if (isSelected) {
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Face gauche
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + uX, y + uY);
  ctx.lineTo(x + uX, y + uY - h);
  ctx.lineTo(x, y - h);
  ctx.closePath();
  ctx.fillStyle = '#78350f';
  ctx.fill();
  ctx.stroke();

  // Face droite
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + vX, y + vY);
  ctx.lineTo(x + vX, y + vY - h);
  ctx.lineTo(x, y - h);
  ctx.closePath();
  ctx.fillStyle = '#92400e';
  ctx.fill();
  ctx.stroke();

  // Face haut
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + uX, y + uY - h);
  ctx.lineTo(x + uX + vX, y + uY + vY - h);
  ctx.lineTo(x + vX, y + vY - h);
  ctx.closePath();
  ctx.fillStyle = '#b45309';
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
