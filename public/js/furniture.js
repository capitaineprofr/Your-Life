// --- Catalogue des Meubles 3D Isométriques Authentiques Blockbench ---

export const FURNITURE_CATALOG = {
  mayor_table: {
    id: 'mayor_table',
    geoId: 'geometry.mayor_table',
    textureUrl: 'assets/mayortable.png',
    name: "Table de Leader (Jerry's Nations)",
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 48,
    price: 35000,
    interactive: 'work'
  },
  blueprint_table: {
    id: 'blueprint_table',
    geoId: 'geometry.blueprint_table',
    textureUrl: 'assets/blueprintTable.png',
    name: "Table de Plans d'Architecte",
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 46,
    price: 28000,
    interactive: 'work'
  },
  tax_table: {
    id: 'tax_table',
    geoId: 'geometry.tax_table',
    textureUrl: 'assets/taxTable.png',
    name: "Comptoir Trésor & Douane",
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 48,
    price: 32000,
    interactive: 'work'
  },
  bounty_board: {
    id: 'bounty_board',
    geoId: 'geometry.bounty_board',
    textureUrl: 'assets/bounty_board.png',
    name: "Panneau de Primes & Missions",
    category: 'deco',
    sizeX: 2,
    sizeY: 1,
    height: 52,
    price: 22000,
    interactive: 'work'
  },
  globe: {
    id: 'globe',
    geoId: 'geometry.globe',
    textureUrl: 'assets/globe.png',
    name: "Globe Terrestre Colonial",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 32,
    price: 15000,
    interactive: 'work'
  }
};

/**
 * Enregistrement dynamique d'un meuble personnalisé importé depuis Blockbench
 */
export function registerCustomFurniture(options) {
  const { id, name, category, sizeX, sizeY, price, interactive, isWalkable, geoId, textureUrl } = options;
  const finalGeoId = geoId || `geometry.${id}`;

  FURNITURE_CATALOG[id] = {
    id,
    geoId: finalGeoId,
    textureUrl: textureUrl || null,
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
