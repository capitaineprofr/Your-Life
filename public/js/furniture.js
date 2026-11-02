// --- Catalogue des Meubles 3D Isométriques (Style Minecraft Bedrock) ---

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
  },
  sofa_3p: {
    id: 'sofa_3p',
    geoId: 'geometry.sofa_3p',
    name: "Canapé 3P Faso Dan Fani",
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 32,
    price: 25000,
    interactive: 'sit'
  },
  bed_double: {
    id: 'bed_double',
    geoId: 'geometry.bed_double',
    name: "Grand Lit Double Sahélien",
    category: 'chambre',
    sizeX: 2,
    sizeY: 2,
    height: 30,
    price: 45000,
    interactive: 'sleep'
  },
  desk_pc: {
    id: 'desk_pc',
    geoId: 'geometry.desk_pc',
    name: "Bureau Développeur & PC",
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 35,
    price: 30000,
    interactive: 'work'
  },
  rug: {
    id: 'rug',
    geoId: 'geometry.rug',
    name: "Tapis Tissé Faso Dan Fani",
    category: 'deco',
    sizeX: 2,
    sizeY: 2,
    height: 2,
    price: 12000,
    isWalkable: true
  },
  tv_stand: {
    id: 'tv_stand',
    geoId: 'geometry.tv_stand',
    name: "Meuble TV & Écran",
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 32,
    price: 32000,
    interactive: 'watch_tv'
  }
};

/**
 * Enregistrement dynamique d'un meuble personnalisé
 */
export function registerCustomFurniture(options) {
  const { id, name, category, sizeX, sizeY, price, interactive, isWalkable } = options;
  const geoId = `geometry.${id}`;

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
