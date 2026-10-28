// --- Catalogue et Rendu Isométrique des Meubles 3D (Style Minecraft) ---
import { MinecraftGeometryRegistry, renderMinecraftModel, MC_CONFIG } from './minecraft_geo.js';

export const FURNITURE_CATALOG = {
  mayor_table: {
    id: 'mayor_table',
    geoId: 'geometry.mayor_table',
    name: "Table de Leader (Jerry's Nations)",
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 48,
    price: 35000,
    interactive: 'work'
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
      rotation: item.rotation || 0,
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
