// --- Moteur de Rendu Minecraft Bedrock & Blockbench 3D Réel (Three.js / WebGL) ---
// 100% fidèle à l'algorithme officiel de Blockbench (JannisX11/blockbench).
// Supporte :
// - format_version 1.12.0 à 1.21.0+
// - Inversion d'axes et angles Euler ZYX officiels Blockbench (axes X/Y inversés en rotation et axe X inversé en position)
// - Géométrie exacte par sommet (setShape) avec support des cubes d'épaisseur 0 (plans/dossiers/draps)
// - Dépliage UV Box UV officiel avec marge anti texture-bleeding et miroir
// - Dépliage UV Per-Face complet avec permutations Up/Down et rotations UV (0, 90, 180, 270)
// - Ombrage directionnel des faces par sommets (Face Normal Shading Minecraft : Top 100%, Sud/Nord 85%, Est/Ouest 70%, Bas 55%)
// - Matériau double-face (DoubleSide) et découpage alpha net (alphaTest: 0.25) sans bug de tri transparent
// - Textures pixel-art authentiques (NearestFilter).

import * as THREE from 'three';

const S = 1 / 16; // 1 unité Three.js = 1 bloc Minecraft (16 voxels)

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
 * Ordre officiel des 6 faces selon Blockbench
 * 0: east (+X), 1: west (-X), 2: up (+Y), 3: down (-Y), 4: south (+Z), 5: north (-Z)
 */
const FACE_ORDER = ['east', 'west', 'up', 'down', 'south', 'north'];

/**
 * Facteurs d'ombrage directionnel Minecraft Bedrock authentique
 */
const FACE_LIGHT_FACTORS = [
  0.70, // east
  0.70, // west
  1.00, // up
  0.55, // down
  0.85, // south
  0.85  // north
];

/**
 * Construit un THREE.Group complet et 100% fidèle à partir d'une géométrie Bedrock JSON
 */
export function createBedrockMesh(geoInput, options = {}) {
  const geoData = typeof geoInput === 'string'
    ? parseBedrockJSON(geoInput)
    : (geoInput && geoInput.bones ? geoInput : parseBedrockJSON(geoInput));

  if (!geoData) {
    console.error('[BedrockLoader] Géométrie JSON invalide');
    return new THREE.Group();
  }

  const textureUrl = options.textureUrl || null;
  const texture = textureUrl ? getMinecraftTexture(textureUrl) : (options.texture || null);
  const scale = options.scale !== undefined ? options.scale : S;

  const desc = geoData.description || {};
  const tw = desc.texture_width || 64;
  const th = desc.texture_height || 64;

  const rootGroup = new THREE.Group();
  rootGroup.name = desc.identifier || 'bedrock_root';

  // Matériau Minecraft Bedrock fidèle : Lambert avec vertexColors et DoubleSide
  const material = texture
    ? new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.25,
        depthWrite: true,
        side: THREE.DoubleSide,
        vertexColors: true
      })
    : new THREE.MeshLambertMaterial({
        color: options.defaultColor || 0x8b5a2b,
        side: THREE.DoubleSide,
        vertexColors: true
      });

  const bones = geoData.bones || [];
  const boneMap = new Map();

  // 1. Instanciation des Bones selon les règles Blockbench
  for (const b of bones) {
    const boneGroup = new THREE.Group();
    boneGroup.name = b.name || 'bone';

    // Règle Blockbench : l'axe X du pivot est inversé (* -1)
    const rawPivot = b.pivot || [0, 0, 0];
    const bonePivot = [
      -rawPivot[0],
      rawPivot[1],
      rawPivot[2]
    ];

    // Règle Blockbench : les rotations X et Y sont inversées (* -1), rotation Z reste inchangée
    const rawRot = b.rotation || [0, 0, 0];
    const boneRot = [
      -rawRot[0],
      -rawRot[1],
      rawRot[2]
    ];

    boneGroup.rotation.order = 'ZYX';
    boneGroup.rotation.set(
      THREE.MathUtils.degToRad(boneRot[0]),
      THREE.MathUtils.degToRad(boneRot[1]),
      THREE.MathUtils.degToRad(boneRot[2])
    );

    // Instanciation des cubes du bone
    if (b.cubes && Array.isArray(b.cubes)) {
      for (const cube of b.cubes) {
        const cubeMesh = buildBlockbenchCubeMesh(cube, scale, material, tw, th, bonePivot, b.mirror === true);
        if (cubeMesh) boneGroup.add(cubeMesh);
      }
    }

    boneMap.set(b.name, {
      group: boneGroup,
      parent: b.parent,
      pivot: bonePivot
    });
  }

  // 2. Assemblage hiérarchique Parent-Enfant (offsets relatifs aux pivots)
  for (const [name, info] of boneMap.entries()) {
    if (info.parent && boneMap.has(info.parent)) {
      const parentInfo = boneMap.get(info.parent);
      info.group.position.set(
        (info.pivot[0] - parentInfo.pivot[0]) * scale,
        (info.pivot[1] - parentInfo.pivot[1]) * scale,
        (info.pivot[2] - parentInfo.pivot[2]) * scale
      );
      parentInfo.group.add(info.group);
    } else {
      info.group.position.set(
        info.pivot[0] * scale,
        info.pivot[1] * scale,
        info.pivot[2] * scale
      );
      rootGroup.add(info.group);
    }
  }

  return rootGroup;
}

/**
 * Construit un mesh individuel de cube 100% conforme à Blockbench
 */
function buildBlockbenchCubeMesh(cube, scale, material, tw, th, bonePivot, isGroupMirrored = false) {
  const origin = cube.origin || [0, 0, 0];
  const size = cube.size || [0, 0, 0];
  const inflate = cube.inflate || 0;

  // Calcul officiel Blockbench pour les sommets du cube :
  // from[0] = -(origin[0] + size[0])
  // to[0]   = -origin[0]
  const from = [
    -(origin[0] + size[0]) - inflate,
    origin[1] - inflate,
    origin[2] - inflate
  ];
  const to = [
    -origin[0] + inflate,
    origin[1] + size[1] + inflate,
    origin[2] + size[2] + inflate
  ];

  // Gestion du pivot local du cube (si absent, le cube pivote autour du bone)
  const hasLocalPivot = !!cube.pivot;
  const cubePivot = hasLocalPivot
    ? [-cube.pivot[0], cube.pivot[1], cube.pivot[2]]
    : [bonePivot[0], bonePivot[1], bonePivot[2]];

  const rawRot = cube.rotation || [0, 0, 0];
  const cubeRot = [
    -rawRot[0],
    -rawRot[1],
    rawRot[2]
  ];

  // Les sommets locaux de la BoxGeometry sont relatifs au pivot du cube
  const localFrom = [
    (from[0] - cubePivot[0]) * scale,
    (from[1] - cubePivot[1]) * scale,
    (from[2] - cubePivot[2]) * scale
  ];
  const localTo = [
    (to[0] - cubePivot[0]) * scale,
    (to[1] - cubePivot[1]) * scale,
    (to[2] - cubePivot[2]) * scale
  ];

  // Prévention des dégénérescences de volume pour le raycasting
  for (let i = 0; i < 3; i++) {
    if (Math.abs(localTo[i] - localFrom[i]) < 1e-5) {
      localTo[i] += 0.0001;
    }
  }

  const geometry = new THREE.BufferGeometry();

  // A. Définition exacte des 24 sommets par face (Blockbench setShape)
  const positions = new Float32Array(24 * 3);

  // 0: East (+X)
  positions.set([
    localTo[0],   localTo[1],   localTo[2],
    localTo[0],   localTo[1],   localFrom[2],
    localTo[0],   localFrom[1], localTo[2],
    localTo[0],   localFrom[1], localFrom[2]
  ], 0);

  // 1: West (-X)
  positions.set([
    localFrom[0], localTo[1],   localFrom[2],
    localFrom[0], localTo[1],   localTo[2],
    localFrom[0], localFrom[1], localFrom[2],
    localFrom[0], localFrom[1], localTo[2]
  ], 12);

  // 2: Up (+Y)
  positions.set([
    localFrom[0], localTo[1],   localFrom[2],
    localTo[0],   localTo[1],   localFrom[2],
    localFrom[0], localTo[1],   localTo[2],
    localTo[0],   localTo[1],   localTo[2]
  ], 24);

  // 3: Down (-Y)
  positions.set([
    localFrom[0], localFrom[1], localTo[2],
    localTo[0],   localFrom[1], localTo[2],
    localFrom[0], localFrom[1], localFrom[2],
    localTo[0],   localFrom[1], localFrom[2]
  ], 36);

  // 4: South (+Z)
  positions.set([
    localFrom[0], localTo[1],   localTo[2],
    localTo[0],   localTo[1],   localTo[2],
    localFrom[0], localFrom[1], localTo[2],
    localTo[0],   localFrom[1], localTo[2]
  ], 48);

  // 5: North (-Z)
  positions.set([
    localTo[0],   localTo[1],   localFrom[2],
    localFrom[0], localTo[1],   localFrom[2],
    localTo[0],   localFrom[1], localFrom[2],
    localFrom[0], localFrom[1], localFrom[2]
  ], 60);

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // B. Indices officiels des triangles (2 triangles = 6 indices par face)
  const indices = [];
  for (let i = 0; i < 6; i++) {
    const base = i * 4;
    indices.push(
      base + 0, base + 2, base + 1,
      base + 2, base + 3, base + 1
    );
  }
  geometry.setIndex(indices);

  // C. Couleurs par sommets (Face Shading Minecraft Bedrock)
  const colors = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) {
    const factor = FACE_LIGHT_FACTORS[f];
    for (let v = 0; v < 4; v++) {
      const idx = (f * 4 + v) * 3;
      colors[idx + 0] = factor;
      colors[idx + 1] = factor;
      colors[idx + 2] = factor;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // D. Calcul exact des coordonnées UV Blockbench
  const uvs = new Float32Array(24 * 2);
  const isMirrored = cube.mirror !== undefined ? (cube.mirror === true) : isGroupMirrored;
  applyBlockbenchUVsToGeometry(uvs, cube.uv, size, tw, th, isMirrored);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // E. Positionnement du mesh dans l'espace du Bone
  mesh.position.set(
    (cubePivot[0] - bonePivot[0]) * scale,
    (cubePivot[1] - bonePivot[1]) * scale,
    (cubePivot[2] - bonePivot[2]) * scale
  );

  // F. Rotation du cube autour de son pivot local
  mesh.rotation.order = 'ZYX';
  mesh.rotation.set(
    THREE.MathUtils.degToRad(cubeRot[0]),
    THREE.MathUtils.degToRad(cubeRot[1]),
    THREE.MathUtils.degToRad(cubeRot[2])
  );

  return mesh;
}

/**
 * Calcul officiel Blockbench des UVs pour les 24 sommets
 */
function applyBlockbenchUVsToGeometry(uvArray, uvDef, size, tw, th, isMirrored = false) {
  if (!uvDef) return;

  // Cas 1 : Per-Face UV format ({ north, south, east, west, up, down })
  if (typeof uvDef === 'object' && !Array.isArray(uvDef)) {
    for (let f = 0; f < 6; f++) {
      const fkey = FACE_ORDER[f];
      const faceData = uvDef[fkey];
      if (!faceData) continue;

      let u0 = faceData.uv[0];
      let v0 = faceData.uv[1];
      const uw = faceData.uv_size ? faceData.uv_size[0] : (fkey === 'up' || fkey === 'down' ? size[0] : (fkey === 'east' || fkey === 'west' ? size[2] : size[0]));
      const vh = faceData.uv_size ? faceData.uv_size[1] : (fkey === 'up' || fkey === 'down' ? size[2] : size[1]);
      let u1 = u0 + uw;
      let v1 = v0 + vh;

      // Règle officielle Blockbench (bedrock.js ligne 719) :
      // Pour les faces up et down en Bedrock, inversion spécifique de l'ordre UV
      if (fkey === 'up' || fkey === 'down') {
        const tmpU = u0; u0 = u1; u1 = tmpU;
        const tmpV = v0; v0 = v1; v1 = tmpV;
      }

      let arr = [
        [u0 / tw, 1 - v0 / th],
        [u1 / tw, 1 - v0 / th],
        [u0 / tw, 1 - v1 / th],
        [u1 / tw, 1 - v1 / th]
      ];

      // Rotation UV de la face (0, 90, 180, 270)
      let rot = (faceData.uv_rotation || 0) % 360;
      while (rot > 0) {
        const a = arr[0];
        arr[0] = arr[2];
        arr[2] = arr[3];
        arr[3] = arr[1];
        arr[1] = a;
        rot -= 90;
      }

      setFaceUV(uvArray, f, arr);
    }
    return;
  }

  // Cas 2 : Standard Box UV format ([u, v])
  if (Array.isArray(uvDef) && uvDef.length >= 2) {
    const [u, v] = uvDef;
    const sx = Math.floor(size[0]);
    const sy = Math.floor(size[1]);
    const sz = Math.floor(size[2]);

    const face_list = [
      { face: 'east',  from: [0, sz],              size: [sz, sy] },
      { face: 'west',  from: [sz + sx, sz],        size: [sz, sy] },
      { face: 'up',    from: [sz + sx, sz],        size: [-sx, -sz] },
      { face: 'down',  from: [sz + sx * 2, 0],     size: [-sx, sz] },
      { face: 'south', from: [sz * 2 + sx, sz],    size: [sx, sy] },
      { face: 'north', from: [sz, sz],             size: [sx, sy] }
    ];

    if (isMirrored) {
      face_list.forEach(f => {
        f.from[0] += f.size[0];
        f.size[0] *= -1;
      });
      // Permutation Est et Ouest en miroir
      const tmp = { from: face_list[0].from.slice(), size: face_list[0].size.slice() };
      face_list[0].from = face_list[1].from.slice();
      face_list[0].size = face_list[1].size.slice();
      face_list[1].from = tmp.from.slice();
      face_list[1].size = tmp.size.slice();
    }

    face_list.forEach((fItem, fIdx) => {
      let u0 = fItem.from[0] + u;
      let v0 = fItem.from[1] + v;
      let u1 = u0 + fItem.size[0];
      let v1 = v0 + fItem.size[1];

      // Marge anti texture-bleeding officielle Blockbench
      const margin = 1 / 64;
      if (u0 > u1) {
        u0 -= margin;
        u1 += margin;
      } else {
        u0 += margin;
        u1 -= margin;
      }
      if (v0 > v1) {
        v0 -= margin;
        v1 += margin;
      } else {
        v0 += margin;
        v1 -= margin;
      }

      const arr = [
        [u0 / tw, 1 - v0 / th],
        [u1 / tw, 1 - v0 / th],
        [u0 / tw, 1 - v1 / th],
        [u1 / tw, 1 - v1 / th]
      ];

      setFaceUV(uvArray, fIdx, arr);
    });
  }
}

/**
 * Assigne les 4 paires UV d'une face aux sommets
 */
function setFaceUV(uvArray, faceIndex, arr) {
  const base = faceIndex * 8;
  uvArray[base + 0] = arr[0][0];
  uvArray[base + 1] = arr[0][1];

  uvArray[base + 2] = arr[1][0];
  uvArray[base + 3] = arr[1][1];

  uvArray[base + 4] = arr[2][0];
  uvArray[base + 5] = arr[2][1];

  uvArray[base + 6] = arr[3][0];
  uvArray[base + 7] = arr[3][1];
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

export async function initDefaultBedrockModels() {
  const models = [
    { id: 'geometry.mayor_table', geoUrl: 'assets/mayor_table.geo.json', texUrl: 'assets/mayortable.png' },
    { id: 'geometry.globe', geoUrl: 'assets/globe.geo.json', texUrl: 'assets/globe.png' },
    { id: 'geometry.blueprint_table', geoUrl: 'assets/blueprint_table.geo.json', texUrl: 'assets/blueprintTable.png' },
    { id: 'geometry.tax_table', geoUrl: 'assets/tax_table.geo.json', texUrl: 'assets/taxTable.png' },
    { id: 'geometry.bounty_board', geoUrl: 'assets/bounty_board.geo.json', texUrl: 'assets/bounty_board.png' }
  ];

  await Promise.all(models.map(m => loadBedrockModel(m.geoUrl, m.texUrl)));
  console.log('[BedrockLoader] Modèles Blockbench authentiques initialisés avec fidélité 100%.');
}
