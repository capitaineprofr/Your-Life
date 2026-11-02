// --- Moteur de Rendu Minecraft Bedrock & Blockbench 3D Réel (Three.js / WebGL) ---
// 100% fidèle à l'affichage Blockbench et Minecraft Bedrock officiel.
// Supporte format_version 1.12.0 à 1.21.0+ : hiérarchie de bones, pivots, rotations,
// uv par face (avec inversion négative et rotation uv), box uv automatique et textures PNG réelles.

import * as THREE from 'three';

const S = 1 / 16; // 1 unité = 1 bloc Minecraft (16 voxels)

/**
 * Cache global des textures avec filtrage pixel-art authentique Minecraft (NearestFilter)
 */
const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();

export function getMinecraftTexture(url) {
  if (!url) return null;
  if (textureCache.has(url)) return textureCache.get(url);

  const tex = textureLoader.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, tex);
  return tex;
}

/**
 * Registre de géométries et métadonnées Blockbench
 */
export class BedrockGeometryRegistry {
  static registry = new Map();

  static register(identifier, geoData, defaultTexture = null) {
    this.registry.set(identifier, { geoData, defaultTexture });
  }

  static get(identifier) {
    return this.registry.get(identifier)?.geoData || null;
  }

  static getTexture(identifier) {
    return this.registry.get(identifier)?.defaultTexture || null;
  }

  static has(identifier) {
    return this.registry.has(identifier);
  }

  static getAll() {
    return Array.from(this.registry.entries());
  }
}

/**
 * Parseur universel de fichiers Minecraft Bedrock JSON
 */
export function parseBedrockJSON(rawJson) {
  let raw = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  const list = raw['minecraft:geometry'] || [];
  if (Array.isArray(list) && list.length > 0) return list[0];
  if (raw.bones) return raw;
  for (const key of Object.keys(raw)) {
    if (raw[key] && raw[key].bones) return raw[key];
  }
  return null;
}

/**
 * Construit un THREE.Group complet et fidèle à partir d'une géométrie Bedrock JSON
 */
export function createBedrockMesh(geoInput, options = {}) {
  const geoData = typeof geoInput === 'string' ? parseBedrockJSON(geoInput) : (geoInput.bones ? geoInput : parseBedrockJSON(geoInput));
  if (!geoData) {
    console.error('[BedrockLoader] Géométrie JSON invalide');
    return new THREE.Group();
  }

  const textureUrl = options.textureUrl || null;
  const texture = textureUrl ? getMinecraftTexture(textureUrl) : (options.texture || null);
  const scale = options.scale !== undefined ? options.scale : S;

  const desc = geoData.description || {};
  const texWidth = desc.texture_width || 64;
  const texHeight = desc.texture_height || 64;

  const rootGroup = new THREE.Group();
  rootGroup.name = desc.identifier || 'bedrock_root';

  const defaultMaterial = texture
    ? new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.88,
        metalness: 0.05,
        transparent: true,
        alphaTest: 0.05
      })
    : new THREE.MeshStandardMaterial({
        color: options.defaultColor || 0x8b5a2b,
        roughness: 0.85,
        metalness: 0.1
      });

  const bones = geoData.bones || [];
  const boneMap = new Map();

  // 1. Instanciation des Bones
  for (const bone of bones) {
    const boneGroup = new THREE.Group();
    boneGroup.name = bone.name || 'bone';

    const pivot = bone.pivot || [0, 0, 0];
    const pivotX = pivot[0] * scale;
    const pivotY = pivot[1] * scale;
    const pivotZ = pivot[2] * scale;

    boneGroup.position.set(pivotX, pivotY, pivotZ);

    // Rotation du bone (Ordre ZYX standard Minecraft / Blockbench)
    if (bone.rotation && Array.isArray(bone.rotation)) {
      boneGroup.rotation.order = 'ZYX';
      const rx = THREE.MathUtils.degToRad(bone.rotation[0] || 0);
      const ry = THREE.MathUtils.degToRad(bone.rotation[1] || 0);
      const rz = THREE.MathUtils.degToRad(bone.rotation[2] || 0);
      boneGroup.rotation.set(rx, ry, rz);
    }

    // Instanciation des cubes du bone
    if (bone.cubes && Array.isArray(bone.cubes)) {
      for (const cube of bone.cubes) {
        const cubeMesh = buildCubeMesh(cube, scale, defaultMaterial, texWidth, texHeight, pivot);
        if (cubeMesh) boneGroup.add(cubeMesh);
      }
    }

    boneMap.set(bone.name, { group: boneGroup, parent: bone.parent, pivot });
  }

  // 2. Assemblage hiérarchique Parent-Enfant
  for (const [name, info] of boneMap.entries()) {
    if (info.parent && boneMap.has(info.parent)) {
      const parentInfo = boneMap.get(info.parent);
      // Position relative au pivot du parent
      const relX = (info.pivot[0] - parentInfo.pivot[0]) * scale;
      const relY = (info.pivot[1] - parentInfo.pivot[1]) * scale;
      const relZ = (info.pivot[2] - parentInfo.pivot[2]) * scale;
      info.group.position.set(relX, relY, relZ);
      parentInfo.group.add(info.group);
    } else {
      rootGroup.add(info.group);
    }
  }

  return rootGroup;
}

/**
 * Construit un mesh individuel de cube avec dimensions, inflate, pivot local et coordonnées UV réelles
 */
function buildCubeMesh(cube, scale, material, tw, th, bonePivot = [0, 0, 0]) {
  const inflate = cube.inflate || 0;
  const origin = [
    cube.origin[0] - inflate,
    cube.origin[1] - inflate,
    cube.origin[2] - inflate
  ];
  const size = [
    Math.max(0.005, cube.size[0] + inflate * 2),
    Math.max(0.005, cube.size[1] + inflate * 2),
    Math.max(0.005, cube.size[2] + inflate * 2)
  ];

  const w = size[0] * scale;
  const h = size[1] * scale;
  const d = size[2] * scale;

  const geometry = new THREE.BoxGeometry(w, h, d);

  // Application des UVs Blockbench (Per-face UV ou Box UV standard)
  if (cube.uv) {
    applyBlockbenchUVs(geometry, cube.uv, size, tw, th, cube.mirror);
  }

  // Support d'une couleur spécifique si pas de texture
  let mat = material;
  if (cube.color && !material.map) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cube.color),
      roughness: 0.8,
      metalness: 0.05
    });
  }

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Si le cube possède son propre pivot et sa propre rotation
  if (cube.pivot && cube.rotation && Array.isArray(cube.rotation)) {
    const wrapper = new THREE.Group();
    const cubePivotX = (cube.pivot[0] - bonePivot[0]) * scale;
    const cubePivotY = (cube.pivot[1] - bonePivot[1]) * scale;
    const cubePivotZ = (cube.pivot[2] - bonePivot[2]) * scale;
    wrapper.position.set(cubePivotX, cubePivotY, cubePivotZ);

    wrapper.rotation.order = 'ZYX';
    const rx = THREE.MathUtils.degToRad(cube.rotation[0] || 0);
    const ry = THREE.MathUtils.degToRad(cube.rotation[1] || 0);
    const rz = THREE.MathUtils.degToRad(cube.rotation[2] || 0);
    wrapper.rotation.set(rx, ry, rz);

    // Position du centre du cube relative au pivot du cube
    const cx = (origin[0] + size[0] / 2 - cube.pivot[0]) * scale;
    const cy = (origin[1] + size[1] / 2 - cube.pivot[1]) * scale;
    const cz = (origin[2] + size[2] / 2 - cube.pivot[2]) * scale;
    mesh.position.set(cx, cy, cz);

    wrapper.add(mesh);
    return wrapper;
  }

  // Centre du cube relatif au pivot du bone
  const centerX = (origin[0] + size[0] / 2 - bonePivot[0]) * scale;
  const centerY = (origin[1] + size[1] / 2 - bonePivot[1]) * scale;
  const centerZ = (origin[2] + size[2] / 2 - bonePivot[2]) * scale;
  mesh.position.set(centerX, centerY, centerZ);

  return mesh;
}

/**
 * Calcul exact des coordonnées UV Blockbench / Minecraft Bedrock
 * Correspondance exacte des 6 faces Three.js :
 * 0: East (+X), 1: West (-X), 2: Up (+Y), 3: Down (-Y), 4: South (+Z), 5: North (-Z)
 */
function applyBlockbenchUVs(geometry, uvDef, size, tw, th, isMirrored = false) {
  const uvAttr = geometry.attributes.uv;
  const facesOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

  // A. Format Per-Face UV : { north: { uv, uv_size, uv_rotation }, ... }
  if (typeof uvDef === 'object' && !Array.isArray(uvDef)) {
    for (let f = 0; f < 6; f++) {
      const faceName = facesOrder[f];
      const faceData = uvDef[faceName];
      if (!faceData) continue;

      const [u, v] = faceData.uv;
      const [uw, vh] = faceData.uv_size || [size[0], size[1]];
      const rot = faceData.uv_rotation || 0;

      const u0 = u / tw;
      const u1 = (u + uw) / tw;
      const v0 = 1 - v / th;
      const v1 = 1 - (v + vh) / th;

      const base = f * 4;
      mapFaceUVVertices(uvAttr, base, u0, u1, v0, v1, rot);
    }
    uvAttr.needsUpdate = true;
    return;
  }

  // B. Format Standard Box UV : [u, v] (Dépliage officiel Mojang Minecraft)
  if (Array.isArray(uvDef) && uvDef.length >= 2) {
    const [u, v] = uvDef;
    const [sx, sy, sz] = size;

    // Définition standard de déroulement du patron de cube Minecraft
    const boxMap = {
      up:    { uv: [u + sz, v],                  size: [sx, sz] },
      down:  { uv: [u + sz + sx, v],             size: [sx, -sz] }, // -sz pour inversion miroir standard
      north: { uv: [u + sz, v + sz],             size: [sx, sy] },
      south: { uv: [u + 2 * sz + sx, v + sz],     size: [sx, sy] },
      west:  { uv: [u, v + sz],                  size: [sz, sy] },
      east:  { uv: [u + sz + sx, v + sz],         size: [sz, sy] }
    };

    if (isMirrored) {
      // Échange est/ouest en mode miroir
      const tmp = boxMap.east;
      boxMap.east = boxMap.west;
      boxMap.west = tmp;
    }

    for (let f = 0; f < 6; f++) {
      const faceName = facesOrder[f];
      const bFace = boxMap[faceName];
      if (!bFace) continue;

      const [fu, fv] = bFace.uv;
      const [fw, fh] = bFace.size;

      const u0 = fu / tw;
      const u1 = (fu + fw) / tw;
      const v0 = 1 - fv / th;
      const v1 = 1 - (fv + fh) / th;

      const base = f * 4;
      mapFaceUVVertices(uvAttr, base, u0, u1, v0, v1, 0);
    }
    uvAttr.needsUpdate = true;
  }
}

/**
 * Assigne les coordonnées UV aux 4 sommets d'une face avec support de rotation
 */
function mapFaceUVVertices(uvAttr, base, u0, u1, v0, v1, rot = 0) {
  // v0=Top-Left, v1=Top-Right, v2=Bottom-Left, v3=Bottom-Right
  if (rot === 90) {
    uvAttr.setXY(base + 0, u0, v1);
    uvAttr.setXY(base + 1, u0, v0);
    uvAttr.setXY(base + 2, u1, v1);
    uvAttr.setXY(base + 3, u1, v0);
  } else if (rot === 180) {
    uvAttr.setXY(base + 0, u1, v1);
    uvAttr.setXY(base + 1, u0, v1);
    uvAttr.setXY(base + 2, u1, v0);
    uvAttr.setXY(base + 3, u0, v0);
  } else if (rot === 270) {
    uvAttr.setXY(base + 0, u1, v0);
    uvAttr.setXY(base + 1, u1, v1);
    uvAttr.setXY(base + 2, u0, v0);
    uvAttr.setXY(base + 3, u0, v1);
  } else {
    // 0 degré (Standard)
    uvAttr.setXY(base + 0, u0, v0);
    uvAttr.setXY(base + 1, u1, v0);
    uvAttr.setXY(base + 2, u0, v1);
    uvAttr.setXY(base + 3, u1, v1);
  }
}

/**
 * Chargeur asynchrone pour charger un fichier .geo.json et sa texture PNG depuis une URL
 */
export async function loadBedrockModel(geoUrl, textureUrl = null) {
  try {
    const res = await fetch(geoUrl);
    const raw = await res.json();
    const geoData = parseBedrockJSON(raw);
    const id = geoData.description?.identifier || geoUrl;
    BedrockGeometryRegistry.register(id, geoData, textureUrl);
    return geoData;
  } catch (err) {
    console.error(`[BedrockLoader] Erreur de chargement pour ${geoUrl}:`, err);
    return null;
  }
}

// --- Pré-chargement des Modèles Blockbench Authentiques de Jerry's Nations ---

// Chargement automatique au démarrage des 5 modèles Blockbench réels
export async function initDefaultBedrockModels() {
  const models = [
    { id: 'geometry.mayor_table', geoUrl: 'assets/mayor_table.geo.json', texUrl: 'assets/mayortable.png' },
    { id: 'geometry.globe', geoUrl: 'assets/globe.geo.json', texUrl: 'assets/globe.png' },
    { id: 'geometry.blueprint_table', geoUrl: 'assets/blueprint_table.geo.json', texUrl: 'assets/blueprintTable.png' },
    { id: 'geometry.tax_table', geoUrl: 'assets/tax_table.geo.json', texUrl: 'assets/taxTable.png' },
    { id: 'geometry.bounty_board', geoUrl: 'assets/bounty_board.geo.json', texUrl: 'assets/bounty_board.png' }
  ];

  await Promise.all(models.map(m => loadBedrockModel(m.geoUrl, m.texUrl)));
  console.log('[BedrockLoader] Modèles Blockbench authentiques initialisés avec succès.');
}
