// --- Catalogue des Meubles 3D & Objets de Table (Your-Life) ---
// Support des Hitbox précises, des surfaces d'accueil et du chevauchement vertical (Stacking)

export const FURNITURE_CATALOG = {
  // --- Bureaux & Surfaces ---
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
    interactive: 'work',
    isSurface: true,
    surfaceHeight: 0.75
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
    interactive: 'work',
    isSurface: true,
    surfaceHeight: 0.75
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
    interactive: 'work',
    isSurface: true,
    surfaceHeight: 0.75
  },
  dining_table: {
    id: 'dining_table',
    name: "Grande Table en Acajou Massif",
    category: 'salon',
    sizeX: 2,
    sizeY: 2,
    height: 46,
    price: 42000,
    isSurface: true,
    surfaceHeight: 0.75
  },
  coffee_table: {
    id: 'coffee_table',
    name: "Table Basse de Salon Ouagais",
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 28,
    price: 20000,
    isSurface: true,
    surfaceHeight: 0.45
  },
  nightstand: {
    id: 'nightstand',
    name: "Table de Chevet en Bois Noble",
    category: 'chambre',
    sizeX: 1,
    sizeY: 1,
    height: 34,
    price: 14000,
    isSurface: true,
    surfaceHeight: 0.55
  },

  // --- Objets de Table (Tabletop / Chevauchement sur meuble) ---
  cup_tea: {
    id: 'cup_tea',
    name: "Tasse de Thé / Café de Bienvenue",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 10,
    price: 1500,
    isTabletop: true
  },
  laptop: {
    id: 'laptop',
    name: "Ordinateur Portable Pro (Télétravail)",
    category: 'bureau',
    sizeX: 1,
    sizeY: 1,
    height: 12,
    price: 45000,
    interactive: 'work',
    isTabletop: true
  },
  table_lamp: {
    id: 'table_lamp',
    name: "Lampe de Bureau Sahélienne",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 24,
    price: 8000,
    isTabletop: true
  },
  potted_plant: {
    id: 'potted_plant',
    name: "Plante Verte en Pot d'Argile",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 22,
    price: 6000,
    isTabletop: true
  },
  canari_pot: {
    id: 'canari_pot',
    name: "Canari Traditionnel en Terre Cuite",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 20,
    price: 7500,
    isTabletop: true
  },
  books_stack: {
    id: 'books_stack',
    name: "Pile de Livres & Carnets",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 10,
    price: 3500,
    isTabletop: true
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
    isTabletop: true
  },

  // --- Assises & Literie (Interactions 'sit') ---
  sofa_faso: {
    id: 'sofa_faso',
    name: "Canapé Salon Faso Dan Fani",
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 38,
    price: 38000,
    interactive: 'sit'
  },
  armchair_faso: {
    id: 'armchair_faso',
    name: "Fauteuil Confort Faso Dan Fani",
    category: 'salon',
    sizeX: 1,
    sizeY: 1,
    height: 38,
    price: 22000,
    interactive: 'sit'
  },
  bed_acajou: {
    id: 'bed_acajou',
    name: "Grand Lit Double en Acajou",
    category: 'chambre',
    sizeX: 2,
    sizeY: 2,
    height: 34,
    price: 65000,
    interactive: 'sit'
  },

  // --- Panneaux & Décoration ---
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
  welcome_mat: {
    id: 'welcome_mat',
    name: "Paillasson d'Entrée Tissé",
    category: 'deco',
    sizeX: 1,
    sizeY: 1,
    height: 1,
    price: 2500,
    isWalkable: true
  }
};

/**
 * Enregistrement dynamique d'un meuble personnalisé importé depuis Blockbench
 */
export function registerCustomFurniture(options) {
  const { id, name, category, sizeX, sizeY, price, interactive, isWalkable, isSurface, isTabletop, surfaceHeight, geoId, textureUrl } = options;
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
    isWalkable: !!isWalkable,
    isSurface: !!isSurface,
    isTabletop: !!isTabletop,
    surfaceHeight: surfaceHeight || (isSurface ? 0.75 : 0)
  };

  return FURNITURE_CATALOG[id];
}
