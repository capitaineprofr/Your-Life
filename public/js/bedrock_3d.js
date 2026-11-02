// --- Moteur de Géométrie Minecraft 3D Isométrique (Three.js / WebGL) ---
// Supporte les fichiers Bedrock .geo.json (format_version 1.12.0 à 1.21.0+) et textures PNG Minecraft

import * as THREE from 'three';

/**
 * Texture cache et loader
 */
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

export function loadMinecraftTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);
  const texture = textureLoader.load(url);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, texture);
  return texture;
}

/**
 * Registre des géométries Bedrock
 */
export class BedrockGeometryRegistry {
  static registry = new Map();

  static register(identifier, data) {
    this.registry.set(identifier, data);
  }

  static get(identifier) {
    return this.registry.get(identifier);
  }

  static has(identifier) {
    return this.registry.has(identifier);
  }

  static getAll() {
    return Array.from(this.registry.entries());
  }
}

/**
 * Parseur universel de géométries Minecraft Bedrock JSON
 */
export function parseBedrockJSON(geoJson) {
  let raw = typeof geoJson === 'string' ? JSON.parse(geoJson) : geoJson;
  const list = raw['minecraft:geometry'] || [];
  if (Array.isArray(list) && list.length > 0) return list[0];
  if (raw.bones) return raw;
  for (const key of Object.keys(raw)) {
    if (raw[key] && raw[key].bones) return raw[key];
  }
  return null;
}

/**
 * Convertit un modèle Bedrock JSON en THREE.Group
 */
export function createBedrockMesh(geoData, options = {}) {
  const group = new THREE.Group();
  const scale = options.scale !== undefined ? options.scale : (1 / 16);
  const texture = options.textureUrl ? loadMinecraftTexture(options.textureUrl) : null;
  const defaultColor = options.defaultColor || 0x8b5a2b;

  // Récupération des dimensions de la texture pour le calcul UV
  const texWidth = geoData.description?.texture_width || 64;
  const texHeight = geoData.description?.texture_height || 64;

  const defaultMaterial = texture
    ? new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.05,
        transparent: true,
        alphaTest: 0.1
      })
    : new THREE.MeshStandardMaterial({
        color: defaultColor,
        roughness: 0.75,
        metalness: 0.1
      });

  // Si le modèle est une liste directe de cubes (modèles enregistrés en dur)
  if (geoData.cubes && Array.isArray(geoData.cubes)) {
    for (const cube of geoData.cubes) {
      const mesh = createCubeMesh(cube, scale, defaultMaterial, texWidth, texHeight, texture);
      if (mesh) group.add(mesh);
    }
    return group;
  }

  // Modèle Bedrock standard avec structure hiérarchique de 'bones'
  const bones = geoData.bones || [];
  const boneMap = new Map();

  for (const bone of bones) {
    const boneGroup = new THREE.Group();
    boneGroup.name = bone.name || 'bone';

    const pivot = bone.pivot || [0, 0, 0];
    const pivotX = pivot[0] * scale;
    const pivotY = pivot[1] * scale;
    const pivotZ = -pivot[2] * scale; // Inversion Z pour repère Three.js

    boneGroup.position.set(pivotX, pivotY, pivotZ);

    if (bone.rotation) {
      const rx = THREE.MathUtils.degToRad(bone.rotation[0] || 0);
      const ry = THREE.MathUtils.degToRad(bone.rotation[1] || 0);
      const rz = THREE.MathUtils.degToRad(bone.rotation[2] || 0);
      boneGroup.rotation.set(-rx, ry, -rz);
    }

    if (bone.cubes && Array.isArray(bone.cubes)) {
      for (const cube of bone.cubes) {
        const mesh = createCubeMesh(cube, scale, defaultMaterial, texWidth, texHeight, texture, pivot);
        if (mesh) boneGroup.add(mesh);
      }
    }

    boneMap.set(bone.name, { group: boneGroup, parent: bone.parent, pivot });
  }

  // Assemblage hiérarchique des bones
  for (const [name, info] of boneMap.entries()) {
    if (info.parent && boneMap.has(info.parent)) {
      const parentInfo = boneMap.get(info.parent);
      // Ajustement de la position relative au parent
      const relX = (info.pivot[0] - parentInfo.pivot[0]) * scale;
      const relY = (info.pivot[1] - parentInfo.pivot[1]) * scale;
      const relZ = -(info.pivot[2] - parentInfo.pivot[2]) * scale;
      info.group.position.set(relX, relY, relZ);
      parentInfo.group.add(info.group);
    } else {
      group.add(info.group);
    }
  }

  return group;
}

/**
 * Crée le mesh Three.js pour un cube Bedrock individuel
 */
function createCubeMesh(cube, scale, defaultMaterial, texWidth, texHeight, texture, bonePivot = [0, 0, 0]) {
  const origin = cube.origin || [0, 0, 0];
  const size = cube.size || [1, 1, 1];

  const w = Math.max(0.01, size[0] * scale);
  const h = Math.max(0.01, size[1] * scale);
  const d = Math.max(0.01, size[2] * scale);

  const geometry = new THREE.BoxGeometry(w, h, d);

  // Application des UVs si présents
  if (cube.uv && texture) {
    applyBedrockUVs(geometry, cube.uv, size, texWidth, texHeight);
  }

  // Matériau spécifique si le cube a une couleur définie
  let mat = defaultMaterial;
  if (cube.color) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cube.color),
      roughness: 0.75,
      metalness: 0.1
    });
  }

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Calcul du centre du cube relatif au pivot du bone
  const centerX = (origin[0] + size[0] / 2 - bonePivot[0]) * scale;
  const centerY = (origin[1] + size[1] / 2 - bonePivot[1]) * scale;
  const centerZ = -(origin[2] + size[2] / 2 - bonePivot[2]) * scale;

  mesh.position.set(centerX, centerY, centerZ);

  // Rotation locale du cube si définie
  if (cube.rotation) {
    const rx = THREE.MathUtils.degToRad(cube.rotation[0] || 0);
    const ry = THREE.MathUtils.degToRad(cube.rotation[1] || 0);
    const rz = THREE.MathUtils.degToRad(cube.rotation[2] || 0);
    mesh.rotation.set(-rx, ry, -rz);
  }

  return mesh;
}

/**
 * Applique les coordonnées UV Bedrock aux sommets de THREE.BoxGeometry
 * Faces Three.js : 0=+X (east), 1=-X (west), 2=+Y (up), 3=-Y (down), 4=+Z (south), 5=-Z (north)
 */
function applyBedrockUVs(geometry, uvDef, size, tw, th) {
  const uvAttr = geometry.attributes.uv;
  const facesMap = {
    0: 'east',
    1: 'west',
    2: 'up',
    3: 'down',
    4: 'south',
    5: 'north'
  };

  // Format UV par face : { north: { uv: [u, v], uv_size: [w, h] }, ... }
  if (typeof uvDef === 'object' && !Array.isArray(uvDef)) {
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const faceName = facesMap[faceIdx];
      const fUV = uvDef[faceName];
      if (!fUV) continue;

      const [u, v] = fUV.uv;
      const [uw, vh] = fUV.uv_size || [size[0], size[1]];

      const u0 = u / tw;
      const u1 = (u + uw) / tw;
      const v0 = 1 - (v + vh) / th;
      const v1 = 1 - v / th;

      const base = faceIdx * 4;
      uvAttr.setXY(base + 0, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;
    return;
  }

  // Format standard Box UV : [u, v]
  if (Array.isArray(uvDef) && uvDef.length >= 2) {
    const [u, v] = uvDef;
    const [sx, sy, sz] = size;

    // Définition standard de déroulement Minecraft Bedrock
    const uvCoords = {
      up: [u + sz, v, sx, sz],
      down: [u + sz + sx, v, sx, sz],
      north: [u + sz, v + sz, sx, sy],
      south: [u + 2 * sz + sx, v + sz, sx, sy],
      west: [u, v + sz, sz, sy],
      east: [u + sz + sx, v + sz, sz, sy]
    };

    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const faceName = facesMap[faceIdx];
      const boxFace = uvCoords[faceName];
      if (!boxFace) continue;

      const [fu, fv, fw, fh] = boxFace;
      const u0 = fu / tw;
      const u1 = (fu + fw) / tw;
      const v0 = 1 - (fv + fh) / th;
      const v1 = 1 - fv / th;

      const base = faceIdx * 4;
      uvAttr.setXY(base + 0, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;
  }
}

// --- Modèles Minecraft Pré-enregistrés pour le mobilier de base ---

// Table de Leader (Jerry's Nations) - Modèle géométrique d'origine
BedrockGeometryRegistry.register('geometry.mayor_table', {
  identifier: 'geometry.mayor_table',
  cubes: [
    { origin: [-15, 12, -8], size: [30, 2, 16], color: '#78350f' },
    { origin: [-14, 0, -4], size: [7, 12, 8], color: '#451a03' },
    { origin: [7, 0, -4], size: [7, 12, 8], color: '#451a03' },
    { origin: [0, 14.6, -5], size: [7, 2, 10], color: '#991b1b' },
    { origin: [0, 16.1, -5], size: [7, 1, 10], color: '#fef08a' },
    { origin: [6, 15, -5], size: [1, 1, 10], color: '#ca8a04' },
    { origin: [-5, 14, -2], size: [1, 1, 5], color: '#e2e8f0' }
  ]
});

// Canapé 3 Places Faso Dan Fani
BedrockGeometryRegistry.register('geometry.sofa_3p', {
  identifier: 'geometry.sofa_3p',
  cubes: [
    { origin: [-15, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [12, 0, -6], size: [3, 4, 3], color: '#451a03' },
    { origin: [-15, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [12, 0, 5], size: [3, 4, 3], color: '#451a03' },
    { origin: [-16, 4, -7], size: [32, 6, 14], color: '#78350f' },
    { origin: [-16, 10, -7], size: [32, 16, 4], color: '#b45309' },
    { origin: [-16, 10, -3], size: [4, 10, 10], color: '#92400e' },
    { origin: [12, 10, -3], size: [4, 10, 10], color: '#92400e' },
    { origin: [-12, 10, -3], size: [8, 4, 10], color: '#dc2626' },
    { origin: [-4, 10, -3], size: [8, 4, 10], color: '#facc15' },
    { origin: [4, 10, -3], size: [8, 4, 10], color: '#16a34a' }
  ]
});

// Grand Lit Double
BedrockGeometryRegistry.register('geometry.bed_double', {
  identifier: 'geometry.bed_double',
  cubes: [
    { origin: [-12, 0, -14], size: [24, 6, 28], color: '#78350f' },
    { origin: [-12, 6, -14], size: [24, 16, 3], color: '#92400e' },
    { origin: [-11, 6, -11], size: [22, 6, 24], color: '#f8fafc' },
    { origin: [-10, 12, -10], size: [9, 3, 6], color: '#e2e8f0' },
    { origin: [1, 12, -10], size: [9, 3, 6], color: '#e2e8f0' },
    { origin: [-11, 8, -4], size: [22, 5, 17], color: '#b91c1c' },
    { origin: [-11, 8.2, 0], size: [22, 5, 6], color: '#eab308' }
  ]
});

// Bureau & PC
BedrockGeometryRegistry.register('geometry.desk_pc', {
  identifier: 'geometry.desk_pc',
  cubes: [
    { origin: [-11, 0, -6], size: [2, 16, 2], color: '#334155' },
    { origin: [9, 0, -6], size: [2, 16, 2], color: '#334155' },
    { origin: [-11, 0, 4], size: [2, 16, 2], color: '#334155' },
    { origin: [9, 0, 4], size: [2, 16, 2], color: '#334155' },
    { origin: [-12, 16, -7], size: [24, 2, 14], color: '#92400e' },
    { origin: [-6, 18, 0], size: [8, 0.5, 4], color: '#1e293b' },
    { origin: [4, 18, 1], size: [2, 0.5, 3], color: '#475569' },
    { origin: [-1, 18, -4], size: [2, 3, 2], color: '#0f172a' },
    { origin: [-6, 21, -4], size: [12, 8, 1], color: '#0f172a' },
    { origin: [-5, 22, -3.4], size: [10, 6, 0.2], color: '#0284c7' }
  ]
});

// Tapis Faso Dan Fani
BedrockGeometryRegistry.register('geometry.rug', {
  identifier: 'geometry.rug',
  cubes: [
    { origin: [-16, 0, -12], size: [32, 0.4, 8], color: '#dc2626' },
    { origin: [-16, 0, -4], size: [32, 0.4, 8], color: '#facc15' },
    { origin: [-16, 0, 4], size: [32, 0.4, 8], color: '#16a34a' }
  ]
});

// Meuble Télévision
BedrockGeometryRegistry.register('geometry.tv_stand', {
  identifier: 'geometry.tv_stand',
  cubes: [
    { origin: [-12, 0, -4], size: [24, 10, 8], color: '#3f1f0a' },
    { origin: [-10, 2, 4.1], size: [8, 6, 0.5], color: '#78350f' },
    { origin: [2, 2, 4.1], size: [8, 6, 0.5], color: '#78350f' },
    { origin: [-3, 10, -2], size: [6, 1, 4], color: '#1e293b' },
    { origin: [-1, 11, -1], size: [2, 3, 2], color: '#334155' },
    { origin: [-10, 14, -1], size: [20, 14, 2], color: '#0f172a' },
    { origin: [-9, 15, 1.1], size: [18, 12, 0.2], color: '#0284c7' }
  ]
});

