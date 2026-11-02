// --- Moteur 3D Isométrique (Three.js / WebGL) pour Your-Life ---
// Vue isométrique réelle (OrthographicCamera), ombres portées, Z-buffer matériel,
// géométries Minecraft Bedrock et navigation 3D point-and-click.

import * as THREE from 'three';
import { BedrockGeometryRegistry, createBedrockMesh, parseBedrockJSON, initDefaultBedrockModels } from './bedrock_3d.js';
import { Avatar3D } from './avatar_3d.js';
import { FURNITURE_CATALOG } from './furniture.js';

// Taille de la grille de l'appartement (16x16 cases)
const GRID_SIZE = 16;
// Conversion grille -> monde 3D : centre en (0, 0, 0)
const GRID_OFFSET = GRID_SIZE / 2; // 8

export class IsometricEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    // Dimensions
    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || window.innerHeight;

    // 1. Initialisation Three.js WebGL
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // 2. Scène 3D
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f172a'); // Fond sombre élégant hors-cadre

    // 3. Caméra Isométrique Réelle (OrthographicCamera)
    // Angle canonique isométrique : élévation = 35.264°, azimut = 45°
    this.baseFrustum = 11;
    this._userZoom = 1.0;
    this.aspect = this.width / this.height;

    this.camera = new THREE.OrthographicCamera(
      -this.baseFrustum * this.aspect,
      this.baseFrustum * this.aspect,
      this.baseFrustum,
      -this.baseFrustum,
      -50,
      100
    );

    // Positionnement isométrique (distance égale sur X et Z, élévation Y = D * sqrt(2/3))
    this.cameraDistance = 30;
    this.cameraElevation = this.cameraDistance * 0.8165; // ~24.5
    this.cameraLookAt = new THREE.Vector3(0, 0.5, 0);

    this.cameraOffset = new THREE.Vector3(0, 0, 0);
    this.updateCameraTransform();

    // 4. Éclairage
    this.setupLighting();

    // 5. Construction de la pièce 3D (Sol et Murs d'architecte)
    this.roomGroup = new THREE.Group();
    this.roomGroup.name = 'room_group';
    this.scene.add(this.roomGroup);
    this.buildRoom();

    // 6. Gestion du Mobilier 3D
    this.furnitureGroup = new THREE.Group();
    this.furnitureGroup.name = 'furniture_group';
    this.scene.add(this.furnitureGroup);

    this.furniture = []; // Données brutes
    this.furnitureMeshes = new Map(); // id -> THREE.Group
    this.selectedFurniture = null;
    this.placingItemType = null;
    this.placingRotation = 0;
    this.placingGhost = null;

    // Grille de collisions (16x16)
    this.collisionGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

    // 7. Gestion des Avatars 3D & Multijoueur
    this.avatarGroup = new THREE.Group();
    this.avatarGroup.name = 'avatar_group';
    this.scene.add(this.avatarGroup);

    this.players = new Map(); // id -> { data, avatar3d, path, isMoving, ... }
    this.localPlayerId = null;
    this.isOwner = false;

    // 8. Raycaster & Interactions au sol
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeIntersectPoint = new THREE.Vector3();

    // Panning & Navigation souris
    this.isPanning = false;
    this.lastPointer = { x: 0, y: 0 };
    this.hoverGrid = { gx: 8, gy: 8 };

    // 9. Overlay HTML pour badges pseudos & bulles de chat
    this.setupOverlayContainer();

    // 10. Horloge & Boucle de rendu
    this.clock = new THREE.Clock();
    this.setupEventListeners();
    this.resize();
    this.animate();

    // Initialisation des modèles Blockbench et rechargement des textures
    initDefaultBedrockModels().then(() => {
      if (this.furniture && this.furniture.length > 0) {
        this.setFurniture(this.furniture);
      }
    });
  }

  get userZoom() {
    return this._userZoom;
  }

  set userZoom(v) {
    this._userZoom = Math.min(2.5, Math.max(0.5, v));
    this.updateCameraFrustum();
  }

  updateCameraFrustum() {
    const f = this.baseFrustum / this._userZoom;
    this.camera.left = -f * this.aspect;
    this.camera.right = f * this.aspect;
    this.camera.top = f;
    this.camera.bottom = -f;
    this.camera.updateProjectionMatrix();
  }

  updateCameraTransform() {
    this.camera.position.set(
      this.cameraDistance + this.cameraOffset.x,
      this.cameraElevation + this.cameraOffset.y,
      this.cameraDistance + this.cameraOffset.z
    );
    this.camera.lookAt(
      this.cameraLookAt.x + this.cameraOffset.x,
      this.cameraLookAt.y + this.cameraOffset.y,
      this.cameraLookAt.z + this.cameraOffset.z
    );
  }

  setupLighting() {
    // Lumière ambiante chaude sahélienne
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.75);
    this.scene.add(ambientLight);

    // Soleil directionnel avec ombres douces
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(18, 30, 16);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;

    const d = 16;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;

    this.scene.add(sunLight);

    // Lumière hémisphérique pour déboucher les ombres avec nuance terreuse
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x78350f, 0.45);
    this.scene.add(hemiLight);
  }

  buildRoom() {
    // A. Sol texturé en bois d'acacia & tapis géométrique
    const floorGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    floorGeo.rotateX(-Math.PI / 2);

    const floorTex = this.createAcaciaFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.65,
      metalness: 0.05
    });

    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.receiveShadow = true;
    this.roomGroup.add(this.floorMesh);

    // B. Tapis central géométrique sahélien
    const rugGeo = new THREE.PlaneGeometry(8, 6);
    rugGeo.rotateX(-Math.PI / 2);
    const rugTex = this.createSahelianRugTexture();
    const rugMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      roughness: 0.9,
      transparent: true
    });
    const rugMesh = new THREE.Mesh(rugGeo, rugMat);
    rugMesh.position.set(0, 0.005, 0); // Légèrement au-dessus du sol pour éviter le z-fighting
    rugMesh.receiveShadow = true;
    this.roomGroup.add(rugMesh);

    // C. Murs architecturaux (Vue en coupe de plain-pied style Les Sims)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf3eee3, // Plâtre ocre doux ouagais
      roughness: 0.85
    });

    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x451a03, // Plinthes bois noble
      roughness: 0.7
    });

    // 1. Mur Nord-Ouest (Arrière, z = -GRID_OFFSET)
    const backWallZ = -GRID_OFFSET;
    const wallHeight = 5.5;
    const wallThick = 0.4;

    const backWallGeo = new THREE.BoxGeometry(GRID_SIZE, wallHeight, wallThick);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, wallHeight / 2, backWallZ - wallThick / 2);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    this.roomGroup.add(backWall);

    // Baie vitrée sur le mur Nord-Ouest
    const windowGeo = new THREE.BoxGeometry(7, 3, 0.45);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.6
    });
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(0, 3.2, backWallZ - wallThick / 2);
    this.roomGroup.add(windowMesh);

    // 2. Mur Nord-Est (Gauche, x = -GRID_OFFSET)
    const leftWallX = -GRID_OFFSET;
    const leftWallGeo = new THREE.BoxGeometry(wallThick, wallHeight, GRID_SIZE);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(leftWallX - wallThick / 2, wallHeight / 2, 0);
    leftWall.receiveShadow = true;
    leftWall.castShadow = true;
    this.roomGroup.add(leftWall);

    // 3. Murs avant en coupe basse (Sud-Est et Sud-Ouest) pour une visibilité totale sans obstacle
    const frontWallHeight = 0.35;
    const frontWallMat = new THREE.MeshStandardMaterial({ color: 0x54300e, roughness: 0.7 });

    // Mur Sud (z = +GRID_OFFSET)
    const frontWallZGeo = new THREE.BoxGeometry(GRID_SIZE + wallThick, frontWallHeight, wallThick);
    const frontWallZ = new THREE.Mesh(frontWallZGeo, frontWallMat);
    frontWallZ.position.set(0, frontWallHeight / 2, GRID_OFFSET + wallThick / 2);
    this.roomGroup.add(frontWallZ);

    // Mur Est (x = +GRID_OFFSET)
    const frontWallXGeo = new THREE.BoxGeometry(wallThick, frontWallHeight, GRID_SIZE + wallThick);
    const frontWallX = new THREE.Mesh(frontWallXGeo, frontWallMat);
    frontWallX.position.set(GRID_OFFSET + wallThick / 2, frontWallHeight / 2, 0);
    this.roomGroup.add(frontWallX);

    // C. Grille de sélection de sol subtile
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0xd97706, 0xcbd5e1);
    gridHelper.position.set(0, 0.002, 0);
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    this.roomGroup.add(gridHelper);
  }

  createAcaciaFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 512, 512);

    // Lames de parquet
    const plankH = 32;
    const plankW = 128;
    const tones = ['#b45309', '#92400e', '#78350f', '#d97706'];

    for (let y = 0; y < 512; y += plankH) {
      const offsetX = ((y / plankH) % 2) * (plankW / 2);
      for (let x = -plankW; x < 512 + plankW; x += plankW) {
        ctx.fillStyle = tones[((x + y * 7) & 3)];
        ctx.fillRect(x + offsetX + 1, y + 1, plankW - 2, plankH - 2);

        // Rainures de bois
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + offsetX + 4, y + 6, plankW - 8, 2);
        ctx.fillRect(x + offsetX + 10, y + 20, plankW - 20, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  createSahelianRugTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    // Tissu de fond rouge terre
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 512, 384);

    // Bordure Faso Dan Fani dorée & verte
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, 488, 360);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 6;
    ctx.strokeRect(26, 26, 460, 332);

    // Losanges et motifs géométriques traditionnels
    ctx.fillStyle = '#facc15';
    for (let x = 64; x < 480; x += 64) {
      for (let y = 64; y < 350; y += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y - 18);
        ctx.lineTo(x + 18, y);
        ctx.lineTo(x, y + 18);
        ctx.lineTo(x - 18, y);
        ctx.closePath();
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  setupOverlayContainer() {
    this.overlayContainer = document.getElementById('engine-3d-overlay');
    if (!this.overlayContainer) {
      this.overlayContainer = document.createElement('div');
      this.overlayContainer.id = 'engine-3d-overlay';
      this.overlayContainer.style.position = 'absolute';
      this.overlayContainer.style.top = '0';
      this.overlayContainer.style.left = '0';
      this.overlayContainer.style.width = '100%';
      this.overlayContainer.style.height = '100%';
      this.overlayContainer.style.pointerEvents = 'none';
      this.overlayContainer.style.overflow = 'hidden';
      this.canvas.parentElement.appendChild(this.overlayContainer);
    }
  }

  // --- Gestion du Mobilier 3D ---

  setFurniture(furnitureList = []) {
    this.furniture = furnitureList;

    // Suppression des anciens mesh
    for (const [id, mesh] of this.furnitureMeshes.entries()) {
      this.furnitureGroup.remove(mesh);
    }
    this.furnitureMeshes.clear();
    this.rebuildCollisionGrid();

    for (const item of furnitureList) {
      this.spawnFurnitureMesh(item);
    }
  }

  spawnFurnitureMesh(item) {
    const catalogItem = FURNITURE_CATALOG[item.type] || {};
    const geoId = catalogItem.geoId || `geometry.${item.type}`;
    const textureUrl = catalogItem.textureUrl || BedrockGeometryRegistry.getTexture(geoId) || null;
    let geoData = BedrockGeometryRegistry.get(geoId);

    if (!geoData) {
      // Modèle cubique générique de repli
      geoData = {
        cubes: [{
          origin: [-(item.sizeX * 16) / 2, 0, -(item.sizeY * 16) / 2],
          size: [item.sizeX * 16, 16, item.sizeY * 16],
          color: '#78350f'
        }]
      };
    }

    const meshGroup = createBedrockMesh(geoData, {
      scale: 1 / 16,
      textureUrl
    });

    meshGroup.name = `furniture_${item.id}`;
    meshGroup.userData = { id: item.id, item };

    // Position dans le monde 3D
    const pos = this.gridToWorld(item.gx + (item.sizeX || 1) / 2, item.gy + (item.sizeY || 1) / 2);
    meshGroup.position.set(pos.x, 0, pos.z);

    // Rotation (en radians)
    const rotDeg = item.rotation || 0;
    meshGroup.rotation.y = THREE.MathUtils.degToRad(-rotDeg);

    this.furnitureGroup.add(meshGroup);
    this.furnitureMeshes.set(item.id, meshGroup);

    this.markFurnitureCollisions(item, 1);
  }

  rebuildCollisionGrid() {
    this.collisionGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (const item of this.furniture) {
      this.markFurnitureCollisions(item, 1);
    }
  }

  markFurnitureCollisions(item, val) {
    const rot = (item.rotation || 0) % 360;
    const isRotated = rot === 90 || rot === 270;
    const sx = isRotated ? (item.sizeY || 1) : (item.sizeX || 1);
    const sy = isRotated ? (item.sizeX || 1) : (item.sizeY || 1);

    for (let x = 0; x < sx; x++) {
      for (let y = 0; y < sy; y++) {
        const gx = Math.floor(item.gx + x);
        const gy = Math.floor(item.gy + y);
        if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
          this.collisionGrid[gx][gy] = val;
        }
      }
    }
  }

  setPlacingItem(itemType) {
    this.placingItemType = itemType;
    this.placingRotation = 0;

    if (this.placingGhost) {
      this.scene.remove(this.placingGhost);
      this.placingGhost = null;
    }

    const catalogItem = FURNITURE_CATALOG[itemType] || {};
    const geoId = catalogItem.geoId || `geometry.${itemType}`;
    const textureUrl = catalogItem.textureUrl || BedrockGeometryRegistry.getTexture(geoId) || null;
    const geoData = BedrockGeometryRegistry.get(geoId);

    if (geoData) {
      this.placingGhost = createBedrockMesh(geoData, {
        scale: 1 / 16,
        textureUrl
      });
      // Effet fantôme transparent
      this.placingGhost.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.6;
        }
      });
      this.scene.add(this.placingGhost);
    }
  }

  cancelPlacing() {
    this.placingItemType = null;
    if (this.placingGhost) {
      this.scene.remove(this.placingGhost);
      this.placingGhost = null;
    }
  }

  rotateSelectedFurniture() {
    if (!this.selectedFurniture) return;
    this.selectedFurniture.rotation = ((this.selectedFurniture.rotation || 0) + 90) % 360;

    // Mise à jour visuelle immédiate du mesh
    const mesh = this.furnitureMeshes.get(this.selectedFurniture.id);
    if (mesh) {
      mesh.rotation.y = THREE.MathUtils.degToRad(-this.selectedFurniture.rotation);
    }
    this.rebuildCollisionGrid();

    if (this.callbacks.onRotateFurniture) {
      this.callbacks.onRotateFurniture(this.selectedFurniture.id);
    }
  }

  // --- Gestion des Avatars 3D & Déplacements ---

  setPlayers(playersList) {
    this.players.clear();
    // Nettoyer anciens mesh
    while (this.avatarGroup.children.length > 0) {
      const child = this.avatarGroup.children[0];
      this.avatarGroup.remove(child);
    }
    for (const p of playersList) {
      this.addOrUpdatePlayer(p);
    }
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
  }

  setIsOwner(isOwner) {
    this.isOwner = isOwner;
  }

  addOrUpdatePlayer(playerData) {
    let p = this.players.get(playerData.id);
    if (!p) {
      const avatar3d = new Avatar3D(playerData.avatar);
      this.avatarGroup.add(avatar3d.group);

      p = {
        data: playerData,
        avatar3d,
        gx: playerData.gx || 8,
        gy: playerData.gy || 8,
        targetGx: playerData.gx || 8,
        targetGy: playerData.gy || 8,
        path: [],
        pathIdx: 0,
        isMoving: false,
        chatText: null,
        chatTimeout: null
      };
      this.players.set(playerData.id, p);
    } else {
      p.data = { ...p.data, ...playerData };
    }

    const pos = this.gridToWorld(p.gx, p.gy);
    p.avatar3d.group.position.set(pos.x, 0, pos.z);
    if (playerData.direction) {
      p.avatar3d.setDirection(playerData.direction);
    }
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (p) {
      this.avatarGroup.remove(p.avatar3d.group);
      p.avatar3d.dispose();
      this.players.delete(id);
    }
  }

  movePlayerTo(id, targetGx, targetGy) {
    const p = this.players.get(id);
    if (!p) return;

    const start = { x: Math.round(p.gx), y: Math.round(p.gy) };
    const goal = { x: Math.round(targetGx), y: Math.round(targetGy) };
    const path = this.findPathAStar(start, goal);

    if (path.length > 1) {
      p.path = path.slice(1); // Exclure le point de départ
      p.pathIdx = 0;
      p.isMoving = true;
    }
  }

  setPlayerChat(id, text) {
    const p = this.players.get(id);
    if (!p) return;
    p.chatText = text;
    if (p.chatTimeout) clearTimeout(p.chatTimeout);
    p.chatTimeout = setTimeout(() => {
      p.chatText = null;
    }, 5000);
  }

  setPlayerAction(id, action) {
    const p = this.players.get(id);
    if (!p) return;
    p.data.currentAction = action;
  }

  toggleViewMode() {
    // Conservation de la compatibilité API
    return 'architectural';
  }

  recenter() {
    this.cameraOffset.set(0, 0, 0);
    this._userZoom = 1.0;
    this.updateCameraFrustum();
    this.updateCameraTransform();
  }

  // --- Algorithme de Pathfinding A* ---

  findPathAStar(start, goal) {
    // Si la cible est hors limites ou bloquée, chercher la case valide la plus proche
    let target = { ...goal };
    if (this.collisionGrid[target.x]?.[target.y] === 1) {
      const neighbors = [
        { x: target.x + 1, y: target.y },
        { x: target.x - 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 }
      ];
      const valid = neighbors.find(n => n.x >= 0 && n.x < GRID_SIZE && n.y >= 0 && n.y < GRID_SIZE && this.collisionGrid[n.x][n.y] === 0);
      if (valid) target = valid;
      else return [start];
    }

    const openSet = [{ ...start, g: 0, h: this.heuristic(start, target), f: this.heuristic(start, target), parent: null }];
    const closedSet = new Set();
    const key = (p) => `${p.x},${p.y}`;

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      if (current.x === target.x && current.y === target.y) {
        const path = [];
        let curr = current;
        while (curr) {
          path.unshift({ x: curr.x, y: curr.y });
          curr = curr.parent;
        }
        return path;
      }

      closedSet.add(key(current));

      const directions = [
        { x: 0, y: -1 }, { x: 0, y: 1 },
        { x: -1, y: 0 }, { x: 1, y: 0 }
      ];

      for (const d of directions) {
        const nx = current.x + d.x;
        const ny = current.y + d.y;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        if (this.collisionGrid[nx][ny] === 1) continue;
        if (closedSet.has(`${nx},${ny}`)) continue;

        const g = current.g + 1;
        const h = this.heuristic({ x: nx, y: ny }, target);
        const f = g + h;

        const existing = openSet.find(p => p.x === nx && p.y === ny);
        if (!existing) {
          openSet.push({ x: nx, y: ny, g, h, f, parent: current });
        } else if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      }
    }

    return [start];
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  // --- Coordonnées et Projections ---

  gridToWorld(gx, gy) {
    return {
      x: gx - GRID_OFFSET,
      z: gy - GRID_OFFSET
    };
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.floor(wx + GRID_OFFSET),
      gy: Math.floor(wz + GRID_OFFSET)
    };
  }

  // --- Gestion des Événements & Interaction Souris ---

  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());

    // Touche R pour faire pivoter le meuble sélectionné ou en cours de pose
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (this.placingItemType && this.placingGhost) {
          this.placingRotation = (this.placingRotation + 90) % 360;
          this.placingGhost.rotation.y = THREE.MathUtils.degToRad(-this.placingRotation);
        } else if (this.selectedFurniture) {
          this.rotateSelectedFurniture();
        }
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateRaycaster(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  onPointerDown(e) {
    this.updateRaycaster(e);
    this.lastPointer = { x: e.clientX, y: e.clientY };

    // Clic droit ou molette = Déplacement caméra (pan)
    if (e.button === 2 || e.button === 1) {
      this.isPanning = true;
      return;
    }

    if (e.button === 0) {
      // 1. Mode Pose de Meuble
      if (this.placingItemType) {
        if (this.raycaster.ray.intersectPlane(this.floorPlane, this.planeIntersectPoint)) {
          const grid = this.worldToGrid(this.planeIntersectPoint.x, this.planeIntersectPoint.z);
          if (grid.gx >= 0 && grid.gx < GRID_SIZE && grid.gy >= 0 && grid.gy < GRID_SIZE) {
            const catalogItem = FURNITURE_CATALOG[this.placingItemType] || {};
            const newItem = {
              id: 'f_' + Date.now().toString(36),
              type: this.placingItemType,
              gx: grid.gx,
              gy: grid.gy,
              sizeX: catalogItem.sizeX || 1,
              sizeY: catalogItem.sizeY || 1,
              rotation: this.placingRotation,
              interactive: catalogItem.interactive || null
            };

            if (this.callbacks.onPlaceFurniture) {
              this.callbacks.onPlaceFurniture(newItem);
            }
            this.cancelPlacing();
          }
        }
        return;
      }

      // 2. Clic sur Meuble existant
      const intersects = this.raycaster.intersectObjects(this.furnitureGroup.children, true);
      if (intersects.length > 0) {
        // Trouver le groupe parent porteur du meuble
        let root = intersects[0].object;
        while (root && root.parent !== this.furnitureGroup) {
          root = root.parent;
        }
        if (root && root.userData?.item) {
          this.selectedFurniture = root.userData.item;
          if (this.callbacks.onSelectFurniture) {
            this.callbacks.onSelectFurniture(this.selectedFurniture);
          }
          if (this.selectedFurniture.interactive && this.callbacks.onFurnitureInteract) {
            this.callbacks.onFurnitureInteract(this.selectedFurniture);
          }
          return;
        }
      }

      // 3. Clic au sol = Déplacement Joueur
      if (this.raycaster.ray.intersectPlane(this.floorPlane, this.planeIntersectPoint)) {
        const grid = this.worldToGrid(this.planeIntersectPoint.x, this.planeIntersectPoint.z);
        if (grid.gx >= 0 && grid.gx < GRID_SIZE && grid.gy >= 0 && grid.gy < GRID_SIZE) {
          if (this.selectedFurniture) {
            this.selectedFurniture = null;
            if (this.callbacks.onDeselectFurniture) {
              this.callbacks.onDeselectFurniture();
            }
          }

          if (this.localPlayerId) {
            this.movePlayerTo(this.localPlayerId, grid.gx, grid.gy);
          }

          if (this.callbacks.onFloorClick) {
            this.callbacks.onFloorClick({
              gx: grid.gx,
              gy: grid.gy,
              windowX: e.clientX,
              windowY: e.clientY
            });
          }
        }
      }
    }
  }

  onPointerMove(e) {
    if (this.isPanning) {
      const dx = (e.clientX - this.lastPointer.x) * (this.baseFrustum / (this._userZoom * 350));
      const dy = (e.clientY - this.lastPointer.y) * (this.baseFrustum / (this._userZoom * 350));

      // Décalage dans l'axe isométrique de l'écran
      this.cameraOffset.x -= (dx - dy);
      this.cameraOffset.z -= (-dx - dy);
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.updateCameraTransform();
      return;
    }

    this.updateRaycaster(e);
    if (this.raycaster.ray.intersectPlane(this.floorPlane, this.planeIntersectPoint)) {
      const grid = this.worldToGrid(this.planeIntersectPoint.x, this.planeIntersectPoint.z);
      this.hoverGrid = grid;

      if (this.placingGhost) {
        const catalogItem = FURNITURE_CATALOG[this.placingItemType] || {};
        const pos = this.gridToWorld(grid.gx + (catalogItem.sizeX || 1) / 2, grid.gy + (catalogItem.sizeY || 1) / 2);
        this.placingGhost.position.set(pos.x, 0, pos.z);
      }
    }
  }

  onPointerUp(e) {
    this.isPanning = false;
  }

  onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    this.userZoom *= zoomFactor;
  }

  resize() {
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.aspect = this.width / this.height;

    this.renderer.setSize(this.width, this.height, false);
    this.updateCameraFrustum();
    this.updateCameraTransform();
  }

  // --- Boucle Principale de Rendu ---

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    // 1. Mise à jour des déplacements des joueurs
    this.updatePlayers(delta);

    // 2. Rendu de la scène Three.js
    this.renderer.render(this.scene, this.camera);

    // 3. Mise à jour des overlays 2D (Badges pseudos & Bulles chat)
    this.updateOverlays();
  }

  updatePlayers(delta) {
    const moveSpeed = 4.8; // Vitesse de marche en cases/seconde

    for (const [id, p] of this.players.entries()) {
      if (p.path && p.path.length > 0 && p.pathIdx < p.path.length) {
        p.isMoving = true;
        const target = p.path[p.pathIdx];
        const dx = target.x - p.gx;
        const dy = target.y - p.gy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Direction d'orientation
        if (Math.abs(dx) > Math.abs(dy)) {
          p.data.direction = dx > 0 ? 'SE' : 'NW';
        } else {
          p.data.direction = dy > 0 ? 'SW' : 'NE';
        }
        p.avatar3d.setDirection(p.data.direction);

        const step = moveSpeed * delta;
        if (dist <= step) {
          p.gx = target.x;
          p.gy = target.y;
          p.pathIdx++;
          if (p.pathIdx >= p.path.length) {
            p.path = [];
            p.isMoving = false;
          }
        } else {
          p.gx += (dx / dist) * step;
          p.gy += (dy / dist) * step;
        }

        const pos = this.gridToWorld(p.gx, p.gy);
        p.avatar3d.group.position.set(pos.x, 0, pos.z);

        if (id === this.localPlayerId && this.callbacks.onPlayerMoveStep) {
          this.callbacks.onPlayerMoveStep({
            gx: p.gx,
            gy: p.gy,
            direction: p.data.direction,
            isMoving: p.isMoving
          });
        }
      } else {
        p.isMoving = false;
      }

      p.avatar3d.update(delta, p.isMoving, 1);
    }
  }

  updateOverlays() {
    if (!this.overlayContainer) return;

    let html = '';
    const tempVec = new THREE.Vector3();

    for (const [id, p] of this.players.entries()) {
      tempVec.set(
        p.avatar3d.group.position.x,
        p.avatar3d.group.position.y + 2.4, // Au-dessus de la tête de l'avatar
        p.avatar3d.group.position.z
      );

      tempVec.project(this.camera);

      // Si derrière la caméra ou hors écran
      if (tempVec.z > 1) continue;

      const screenX = (tempVec.x * 0.5 + 0.5) * this.width;
      const screenY = (-(tempVec.y * 0.5) + 0.5) * this.height;

      const isSelf = id === this.localPlayerId;
      const badgeClass = isSelf ? 'badge-self' : (p.data.isOwner ? 'badge-owner' : 'badge-guest');

      html += `
        <div style="position: absolute; left: ${screenX}px; top: ${screenY}px; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
          ${p.chatText ? `
            <div style="background: rgba(15, 23, 42, 0.92); color: #fff; padding: 6px 12px; border-radius: 12px; font-size: 13px; font-weight: 500; margin-bottom: 6px; border: 1px solid rgba(217, 119, 6, 0.6); box-shadow: 0 4px 12px rgba(0,0,0,0.4); max-width: 220px; text-align: center; word-break: break-word;">
              ${escapeHtml(p.chatText)}
            </div>
          ` : ''}
          <div style="background: rgba(15, 23, 42, 0.75); color: #f8fafc; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
            <span>${escapeHtml(p.data.username || 'Joueur')}</span>
            ${p.data.isOwner ? '<span style="color: #facc15; font-size: 10px;">★</span>' : ''}
          </div>
        </div>
      `;
    }

    this.overlayContainer.innerHTML = html;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

