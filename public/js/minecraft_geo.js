// --- Moteur de Géométrie Minecraft 3D Isométrique & Parseur Bedrock JSON ---
// Compatible avec format_version 1.12.0 / 1.16.0 / 1.21.0 ("minecraft:geometry")

/**
 * Fonctions utilitaires de colorimétrie pour l'éclairage Minecraft
 */
export function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function adjustBrightness(hex, factor) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

/**
 * Constantes de projection et d'échelle isométrique pour blocs Minecraft
 */
export const MC_CONFIG = {
  // Facteur d'échelle d'un bloc Minecraft 16x16x16
  BLOCK_HEIGHT_PX: 38, // Hauteur en pixels d'un cube complet de 16 unités
  // Vecteurs unitaires de la grille isométrique
  TILE_U_X: -29.4,
  TILE_U_Y: 14.4,
  TILE_V_X: 29.4,
  TILE_V_Y: 14.4,
  // Facteur d'échelle global pour corriger le problème d'échelle
  SCALE_FACTOR: 1.55 // Agrandit le mobilier et les blocs pour correspondre au décor
};

/**
 * Parseur de fichiers Bedrock JSON (.geo.json / "minecraft:geometry")
 */
export function parseMinecraftGeometry(geoJson) {
  let rawGeos = null;

  if (typeof geoJson === 'string') {
    try {
      rawGeos = JSON.parse(geoJson);
    } catch (e) {
      console.error('Erreur lors du parsing JSON Minecraft Geometry:', e);
      return null;
    }
  } else {
    rawGeos = geoJson;
  }

  // Format Bedrock standard : "minecraft:geometry" ou "geometry.<identifier>"
  const geoList = rawGeos['minecraft:geometry'] || [];
  let geoObj = null;

  if (Array.isArray(geoList) && geoList.length > 0) {
    geoObj = geoList[0];
  } else if (rawGeos.bones) {
    geoObj = rawGeos;
  } else {
    // Clé directe format v1.8.0 : "geometry.xxx": { bones: [...] }
    const keys = Object.keys(rawGeos);
    for (const k of keys) {
      if (rawGeos[k] && rawGeos[k].bones) {
        geoObj = rawGeos[k];
        break;
      }
    }
  }

  if (!geoObj || !geoObj.bones) {
    console.warn('Structure de géométrie Minecraft invalide ou non reconnue.');
    return null;
  }

  const description = geoObj.description || {};
  const identifier = description.identifier || 'geometry.custom';
  const bones = geoObj.bones || [];

  const parsedCubes = [];

  for (const bone of bones) {
    const pivot = bone.pivot || [0, 0, 0];
    const boneCubes = bone.cubes || [];

    for (const c of boneCubes) {
      if (!c.origin || !c.size) continue;
      parsedCubes.push({
        origin: [...c.origin],
        size: [...c.size],
        pivot: c.pivot ? [...c.pivot] : [...pivot],
        rotation: c.rotation ? [...c.rotation] : (bone.rotation ? [...bone.rotation] : [0, 0, 0]),
        uv: c.uv || [0, 0],
        color: c.color || '#a16207'
      });
    }
  }

  return {
    identifier,
    description,
    cubes: parsedCubes
  };
}

/**
 * Rendu Isométrique 3D Canvas d'un cube Minecraft
 */
export function renderMinecraftCube(ctx, cube, basePos, options = {}) {
  const {
    scale = MC_CONFIG.SCALE_FACTOR,
    tileUx = MC_CONFIG.TILE_U_X,
    tileUy = MC_CONFIG.TILE_U_Y,
    tileVx = MC_CONFIG.TILE_V_X,
    tileVy = MC_CONFIG.TILE_V_Y,
    blockHeight = MC_CONFIG.BLOCK_HEIGHT_PX,
    showPixelGrid = true
  } = options;

  const { origin, size, color = '#b45309' } = cube;

  // Conversion en coordonnées relatives 16 unités = 1 bloc
  const u0 = (origin[0] / 16) * scale;
  const u1 = ((origin[0] + size[0]) / 16) * scale;
  const v0 = (origin[2] / 16) * scale;
  const v1 = ((origin[2] + size[2]) / 16) * scale;
  const y0 = (origin[1] / 16) * (blockHeight * scale);
  const y1 = ((origin[1] + size[1]) / 16) * (blockHeight * scale);

  // Fonction de projection d'un sommet 3D (u, v, y) -> écran (px, py)
  const project = (u, v, y) => ({
    x: basePos.x + (u * tileUx) + (v * tileVx),
    y: basePos.y + (u * tileUy) + (v * tileVy) - y
  });

  // Calcul des 8 sommets
  const p000 = project(u0, v0, y0);
  const p100 = project(u1, v0, y0);
  const p110 = project(u1, v1, y0);
  const p010 = project(u0, v1, y0);

  const p001 = project(u0, v0, y1);
  const p101 = project(u1, v0, y1);
  const p111 = project(u1, v1, y1);
  const p011 = project(u0, v1, y1);

  // Couleurs ombrées façon Minecraft
  const topColor = cube.topColor || adjustBrightness(color, 1.15);
  const leftColor = cube.leftColor || adjustBrightness(color, 0.85);
  const rightColor = cube.rightColor || adjustBrightness(color, 0.65);
  const strokeColor = 'rgba(0, 0, 0, 0.28)';

  // 1. Face Supérieure (Top)
  if (size[1] >= 0) {
    ctx.beginPath();
    ctx.moveTo(p001.x, p001.y);
    ctx.lineTo(p101.x, p101.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Effet de texture pixelisée Minecraft discret
    if (showPixelGrid && (size[0] >= 6 || size[2] >= 6)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo((p001.x + p101.x) / 2, (p001.y + p101.y) / 2);
      ctx.lineTo((p011.x + p111.x) / 2, (p011.y + p111.y) / 2);
      ctx.moveTo((p001.x + p011.x) / 2, (p001.y + p011.y) / 2);
      ctx.lineTo((p101.x + p111.x) / 2, (p101.y + p111.y) / 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2. Face Gauche (Left / Sud-Ouest)
  if (size[1] > 0) {
    ctx.beginPath();
    ctx.moveTo(p010.x, p010.y);
    ctx.lineTo(p110.x, p110.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 3. Face Droite (Right / Sud-Est)
  if (size[1] > 0) {
    ctx.beginPath();
    ctx.moveTo(p100.x, p100.y);
    ctx.lineTo(p110.x, p110.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p101.x, p101.y);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Rendu complet d'un modèle de géométrie Minecraft
 */
export function renderMinecraftModel(ctx, model, basePos, options = {}) {
  if (!model || !model.cubes || model.cubes.length === 0) return;

  const { isSelected = false } = options;

  ctx.save();

  // Ombre portée au sol façon Minecraft
  const shadowRadius = 24 * (options.scale || MC_CONFIG.SCALE_FACTOR);
  ctx.beginPath();
  ctx.ellipse(basePos.x, basePos.y + 2, shadowRadius, shadowRadius * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fill();

  // Halo de sélection si le meuble est sélectionné par le propriétaire
  if (isSelected) {
    ctx.beginPath();
    ctx.ellipse(basePos.x, basePos.y + 4, shadowRadius * 1.25, shadowRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Tri en profondeur des cubes (Painter's algorithm pour l'isométrie 3D)
  // Les cubes à l'arrière (faible U + V, faible Y) sont dessinés avant les cubes au premier plan
  const sortedCubes = [...model.cubes].sort((a, b) => {
    const depthA = (a.origin[0] + a.size[0] * 0.5) + (a.origin[2] + a.size[2] * 0.5) + (a.origin[1] * 0.05);
    const depthB = (b.origin[0] + b.size[0] * 0.5) + (b.origin[2] + b.size[2] * 0.5) + (b.origin[1] * 0.05);
    return depthA - depthB;
  });

  // Dessin de chaque cube
  for (const cube of sortedCubes) {
    renderMinecraftCube(ctx, cube, basePos, options);
  }

  ctx.restore();
}

/**
 * Registre des Géométries Minecraft
 * Permet d'enregistrer, récupérer et importer dynamiquement des géométries Bedrock JSON
 */
export class MinecraftGeometryRegistry {
  static geometries = new Map();

  static register(identifier, geoDefinition) {
    if (!geoDefinition) return;
    let parsed = geoDefinition;
    if (geoDefinition['minecraft:geometry'] || typeof geoDefinition === 'string') {
      parsed = parseMinecraftGeometry(geoDefinition);
    }
    if (parsed) {
      this.geometries.set(identifier, parsed);
    }
  }

  static get(identifier) {
    return this.geometries.get(identifier) || null;
  }

  static has(identifier) {
    return this.geometries.has(identifier);
  }

  static getAll() {
    return Array.from(this.geometries.entries());
  }
}

// =========================================================================
// CATALOGUE DES MODÈLES MINECRAFT 3D ISOMÉTRIQUES INTÉGRÉS
// Chaque meuble est constitué de blocs & sous-blocs aux dimensions Minecraft (16 unités = 1 bloc)
// =========================================================================

// 1. Canapé 3 Places (geometry.sofa_3p)
MinecraftGeometryRegistry.register('geometry.sofa_3p', {
  identifier: 'geometry.sofa_3p',
  cubes: [
    // Pieds en bois d'acacia
    { origin: [-15, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [12, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [-15, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [12, 0, 5], size: [3, 4, 3], color: '#451a03' },
    // Base principale
    { origin: [-16, 4, -7], size: [32, 6, 14], color: '#78350f' },
    // Dossier arrière
    { origin: [-16, 10, -7], size: [32, 16, 4], color: '#b45309' },
    // Accoudoir gauche
    { origin: [-16, 10, -3], size: [4, 10, 10], color: '#92400e' },
    // Accoudoir droit
    { origin: [12, 10, -3], size: [4, 10, 10], color: '#92400e' },
    // 3 Coussins d'assise aux couleurs Faso Dan Fani (Rouge, Jaune, Vert)
    { origin: [-12, 10, -3], size: [8, 4, 10], color: '#dc2626' },
    { origin: [-4, 10, -3], size: [8, 4, 10], color: '#facc15' },
    { origin: [4, 10, -3], size: [8, 4, 10], color: '#16a34a' }
  ]
});

// 2. Canapé 2 Places (geometry.sofa_2p)
MinecraftGeometryRegistry.register('geometry.sofa_2p', {
  identifier: 'geometry.sofa_2p',
  cubes: [
    { origin: [-11, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [8, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [-11, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [8, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [-12, 4, -7], size: [24, 6, 14], color: '#78350f' },
    { origin: [-12, 10, -7], size: [24, 16, 4], color: '#b45309' },
    { origin: [-12, 10, -3], size: [4, 10, 10], color: '#92400e' },
    { origin: [8, 10, -3], size: [4, 10, 10], color: '#92400e' },
    { origin: [-8, 10, -3], size: [8, 4, 10], color: '#dc2626' },
    { origin: [0, 10, -3], size: [8, 4, 10], color: '#facc15' }
  ]
});

// 3. Fauteuil Confort (geometry.armchair)
MinecraftGeometryRegistry.register('geometry.armchair', {
  identifier: 'geometry.armchair',
  cubes: [
    { origin: [-7, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [4, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [-7, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [4, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [-8, 4, -7], size: [16, 6, 14], color: '#78350f' },
    { origin: [-8, 10, -7], size: [16, 16, 4], color: '#b45309' },
    { origin: [-8, 10, -3], size: [3, 10, 10], color: '#92400e' },
    { origin: [5, 10, -3], size: [3, 10, 10], color: '#92400e' },
    { origin: [-5, 10, -3], size: [10, 4, 10], color: '#dc2626' }
  ]
});

// 4. Table Basse Bois (geometry.table_coffee)
MinecraftGeometryRegistry.register('geometry.table_coffee', {
  identifier: 'geometry.table_coffee',
  cubes: [
    // 4 Pieds type barrières Minecraft
    { origin: [-11, 0, -6], size: [2, 10, 2], color: '#78350f' },
    { origin: [9, 0, -6], size: [2, 10, 2], color: '#78350f' },
    { origin: [-11, 0, 4], size: [2, 10, 2], color: '#78350f' },
    { origin: [9, 0, 4], size: [2, 10, 2], color: '#78350f' },
    // Plateau supérieur en bois poli
    { origin: [-12, 10, -7], size: [24, 2, 14], color: '#b45309' },
    // Petit livre posé sur la table
    { origin: [-3, 12, -2], size: [6, 1.5, 5], color: '#dc2626' }
  ]
});

// 5. Meuble TV & Écran (geometry.tv_stand)
MinecraftGeometryRegistry.register('geometry.tv_stand', {
  identifier: 'geometry.tv_stand',
  cubes: [
    // Meuble bas en bois sombre
    { origin: [-12, 0, -4], size: [24, 10, 8], color: '#3f1f0a' },
    { origin: [-10, 2, 4.1], size: [8, 6, 0.5], color: '#78350f' },
    { origin: [2, 2, 4.1], size: [8, 6, 0.5], color: '#78350f' },
    // Pied du téléviseur
    { origin: [-3, 10, -2], size: [6, 1, 4], color: '#1e293b' },
    { origin: [-1, 11, -1], size: [2, 3, 2], color: '#334155' },
    // Cadre écran noir
    { origin: [-10, 14, -1], size: [20, 14, 2], color: '#0f172a' },
    // Dalle d'affichage allumée
    { origin: [-9, 15, 1.1], size: [18, 12, 0.2], color: '#0284c7' }
  ]
});

// 6. Tapis Faso Dan Fani (geometry.rug)
MinecraftGeometryRegistry.register('geometry.rug', {
  identifier: 'geometry.rug',
  cubes: [
    // Bande rouge
    { origin: [-16, 0, -12], size: [32, 1, 8], color: '#dc2626' },
    // Bande centrale jaune avec étoile
    { origin: [-16, 0, -4], size: [32, 1, 8], color: '#facc15' },
    // Bande verte
    { origin: [-16, 0, 4], size: [32, 1, 8], color: '#16a34a' }
  ]
});

// 7. Grand Lit Double (geometry.bed_double)
MinecraftGeometryRegistry.register('geometry.bed_double', {
  identifier: 'geometry.bed_double',
  cubes: [
    // Cadre et pieds en chêne
    { origin: [-12, 0, -14], size: [24, 6, 28], color: '#78350f' },
    // Tête de lit en bois
    { origin: [-12, 6, -14], size: [24, 16, 3], color: '#92400e' },
    // Matelas en laine blanche
    { origin: [-11, 6, -11], size: [22, 6, 24], color: '#f8fafc' },
    // 2 Oreillers
    { origin: [-10, 12, -10], size: [9, 3, 6], color: '#e2e8f0' },
    { origin: [1, 12, -10], size: [9, 3, 6], color: '#e2e8f0' },
    // Couette Faso Dan Fani recouvrant les 2/3 du lit
    { origin: [-11, 8, -4], size: [22, 5, 17], color: '#b91c1c' },
    { origin: [-11, 8.2, 0], size: [22, 5, 6], color: '#eab308' }
  ]
});

// 8. Lit Simple (geometry.bed_single)
MinecraftGeometryRegistry.register('geometry.bed_single', {
  identifier: 'geometry.bed_single',
  cubes: [
    { origin: [-7, 0, -12], size: [14, 6, 24], color: '#78350f' },
    { origin: [-7, 6, -12], size: [14, 14, 3], color: '#92400e' },
    { origin: [-6, 6, -9], size: [12, 5, 20], color: '#f8fafc' },
    { origin: [-5, 11, -8], size: [10, 3, 5], color: '#e2e8f0' },
    { origin: [-6, 7.5, -3], size: [12, 4.5, 14], color: '#1d4ed8' }
  ]
});

// 9. Armoire Penderie (geometry.wardrobe)
MinecraftGeometryRegistry.register('geometry.wardrobe', {
  identifier: 'geometry.wardrobe',
  cubes: [
    // Corps principal
    { origin: [-12, 0, -6], size: [24, 34, 12], color: '#78350f' },
    // Charnières et corniches
    { origin: [-13, 33, -7], size: [26, 2, 14], color: '#92400e' },
    // Poignées de porte
    { origin: [-2, 16, 6.2], size: [1, 4, 1], color: '#facc15' },
    { origin: [1, 16, 6.2], size: [1, 4, 1], color: '#facc15' }
  ]
});

// 10. Bibliothèque Haute (geometry.bookshelf)
MinecraftGeometryRegistry.register('geometry.bookshelf', {
  identifier: 'geometry.bookshelf',
  cubes: [
    // Structure en bois
    { origin: [-12, 0, -5], size: [24, 32, 10], color: '#78350f' },
    // Étagère 1 (Livres colorés style Minecraft)
    { origin: [-10, 4, 3], size: [5, 7, 3], color: '#dc2626' },
    { origin: [-5, 4, 3], size: [4, 7, 3], color: '#2563eb' },
    { origin: [-1, 4, 3], size: [5, 7, 3], color: '#16a34a' },
    { origin: [4, 4, 3], size: [6, 7, 3], color: '#d97706' },
    // Étagère 2 (Deuxième rangée)
    { origin: [-10, 18, 3], size: [6, 7, 3], color: '#9333ea' },
    { origin: [-4, 18, 3], size: [7, 7, 3], color: '#0d9488' },
    { origin: [3, 18, 3], size: [7, 7, 3], color: '#ea580c' }
  ]
});

// 11. Bureau Informatique (geometry.desk_pc)
MinecraftGeometryRegistry.register('geometry.desk_pc', {
  identifier: 'geometry.desk_pc',
  cubes: [
    // Pieds du bureau
    { origin: [-11, 0, -6], size: [2, 16, 2], color: '#334155' },
    { origin: [9, 0, -6], size: [2, 16, 2], color: '#334155' },
    { origin: [-11, 0, 4], size: [2, 16, 2], color: '#334155' },
    { origin: [9, 0, 4], size: [2, 16, 2], color: '#334155' },
    // Plateau en bois
    { origin: [-12, 16, -7], size: [24, 2, 14], color: '#92400e' },
    // Clavier et souris
    { origin: [-6, 18, 0], size: [8, 0.5, 4], color: '#1e293b' },
    { origin: [4, 18, 1], size: [2, 0.5, 3], color: '#475569' },
    // Écran d'ordinateur
    { origin: [-1, 18, -4], size: [2, 3, 2], color: '#0f172a' },
    { origin: [-6, 21, -4], size: [12, 8, 1], color: '#0f172a' },
    { origin: [-5, 22, -3.2], size: [10, 6, 0.5], color: '#38bdf8' }
  ]
});

// 12. Chaise Confort (geometry.chair)
MinecraftGeometryRegistry.register('geometry.chair', {
  identifier: 'geometry.chair',
  cubes: [
    { origin: [-4, 0, -4], size: [1.5, 10, 1.5], color: '#78350f' },
    { origin: [2.5, 0, -4], size: [1.5, 10, 1.5], color: '#78350f' },
    { origin: [-4, 0, 2.5], size: [1.5, 10, 1.5], color: '#78350f' },
    { origin: [2.5, 0, 2.5], size: [1.5, 10, 1.5], color: '#78350f' },
    // Assise
    { origin: [-5, 10, -5], size: [10, 2, 10], color: '#b45309' },
    // Dossier
    { origin: [-5, 12, -5], size: [10, 10, 1.5], color: '#92400e' }
  ]
});

// 13. Réfrigérateur Moderne (geometry.fridge)
MinecraftGeometryRegistry.register('geometry.fridge', {
  identifier: 'geometry.fridge',
  cubes: [
    // Bloc quartz / acier principal
    { origin: [-7, 0, -6], size: [14, 34, 12], color: '#cbd5e1' },
    // Séparation congélateur haut / frigo bas
    { origin: [-7, 22, 6.1], size: [14, 0.8, 0.2], color: '#64748b' },
    // Poignées verticales métalliques
    { origin: [4, 24, 6.2], size: [1, 6, 1], color: '#475569' },
    { origin: [4, 10, 6.2], size: [1, 8, 1], color: '#475569' },
    // Distributeur d'eau / glaçons
    { origin: [-5, 14, 6.1], size: [4, 5, 0.2], color: '#1e293b' }
  ]
});

// 14. Évier & Plan Cuisine (geometry.kitchen_sink)
MinecraftGeometryRegistry.register('geometry.kitchen_sink', {
  identifier: 'geometry.kitchen_sink',
  cubes: [
    // Meuble bas en bois clair
    { origin: [-12, 0, -6], size: [24, 18, 12], color: '#78350f' },
    // Plan de travail en pierre lisse
    { origin: [-12, 18, -6], size: [24, 2, 12], color: '#94a3b8' },
    // Bac de l'évier en métal
    { origin: [-8, 18.2, -3], size: [9, 1.5, 7], color: '#475569' },
    // Robinet en fer forgé
    { origin: [-4, 20, -4], size: [1, 4, 1], color: '#334155' },
    { origin: [-4, 23, -3], size: [1, 1, 2], color: '#334155' }
  ]
});

// 15. Table à Manger (geometry.table_dining)
MinecraftGeometryRegistry.register('geometry.table_dining', {
  identifier: 'geometry.table_dining',
  cubes: [
    { origin: [-12, 0, -12], size: [2.5, 16, 2.5], color: '#78350f' },
    { origin: [9.5, 0, -12], size: [2.5, 16, 2.5], color: '#78350f' },
    { origin: [-12, 0, 9.5], size: [2.5, 16, 2.5], color: '#78350f' },
    { origin: [9.5, 0, 9.5], size: [2.5, 16, 2.5], color: '#78350f' },
    // Plateau repas
    { origin: [-14, 16, -14], size: [28, 2, 28], color: '#b45309' }
  ]
});
