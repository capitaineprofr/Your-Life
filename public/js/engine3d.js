// --- Moteur 3D Isométrique (Three.js / WebGL) pour Your-Life ---
// Vue isométrique réelle (OrthographicCamera), personnalisation d'architecture (Sims 4),
// collisions A* rigoureuses, hitboxes exactes et chevauchement d'objets sur surface (Stacking).

import * as THREE from 'three';
import { BedrockGeometryRegistry, createBedrockMesh, parseBedrockJSON, initDefaultBedrockModels } from './bedrock_3d.js';
import { Avatar3D } from './avatar_3d.js';
import { FURNITURE_CATALOG } from './furniture.js';
import { getProceduralBedrockGeo } from './procedural_models.js';

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
    this.scene.background = new THREE.Color('#0f172a'); // Fond sombre élégant

    // 3. Architecture & Grille dynamique
    this.architecture = {
      gridSize: 16,
      wallColor: 'plaster_ochre',
      floorType: 'acacia_parquet',
      rugType: 'sahelian_red',
      windowType: 'large_bay',
      wallHeight: 5.5
    };
    this.gridSize = 16;
    this.gridOffset = this.gridSize / 2;

    // 4. Caméra Isométrique Réelle (OrthographicCamera)
    this.baseFrustum = 11;
    this._userZoom = 1.0;
    this.aspect = this.width / this.height;

    this.camera = new THREE.OrthographicCamera(
      -this.baseFrustum * this.aspect,
      this.baseFrustum * this.aspect,
      this.baseFrustum,
      -this.baseFrustum,
      -50,
      120
    );

    this.cameraDistance = 30;
    this.cameraElevation = this.cameraDistance * 0.8165;
    this.cameraLookAt = new THREE.Vector3(0, 0.5, 0);
    this.cameraOffset = new THREE.Vector3(0, 0, 0);
    this.updateCameraTransform();

    // 5. Éclairage
    this.setupLighting();

    // 6. Gestion du Mobilier 3D (Initialisé avant la construction de la pièce)
    this.furnitureGroup = new THREE.Group();
    this.furnitureGroup.name = 'furniture_group';
    this.scene.add(this.furnitureGroup);

    this.furniture = [];
    this.furnitureMeshes = new Map();
    this.selectedFurniture = null;
    this.placingItemType = null;
    this.placingRotation = 0;
    this.placingGhost = null;

    // Grille de collisions dynamique (gridSize x gridSize)
    this.collisionGrid = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0));

    // 7. Construction de la pièce 3D
    this.roomGroup = new THREE.Group();
    this.roomGroup.name = 'room_group';
    this.scene.add(this.roomGroup);
    this.buildRoom(this.architecture);

    // 8. Gestion des Avatars 3D & Multijoueur
    this.avatarGroup = new THREE.Group();
    this.avatarGroup.name = 'avatar_group';
    this.scene.add(this.avatarGroup);

    this.players = new Map();
    this.localPlayerId = null;
    this.isOwner = false;

    // 9. Raycaster & Interactions au sol
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeIntersectPoint = new THREE.Vector3();

    this.isPanning = false;
    this.lastPointer = { x: 0, y: 0 };
    this.hoverGrid = { gx: 8, gy: 8 };

    // 10. Overlay HTML
    this.setupOverlayContainer();

    // 11. Horloge & Boucle de rendu
    this.clock = new THREE.Clock();
    this.setupEventListeners();
    this.resize();
    this.animate();

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
    this._userZoom = Math.min(2.5, Math.max(0.45, v));
    this.updateCameraFrustum();
  }

  updateCameraFrustum() {
    const f = (this.baseFrustum * (this.gridSize / 16)) / this._userZoom;
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
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.78);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.45);
    sunLight.position.set(22, 35, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 90;

    const d = 22;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;

    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x78350f, 0.45);
    this.scene.add(hemiLight);
  }

  // --- Construction Paramétrique de la Pièce (Mode Architecture Sims) ---

  buildRoom(arch = {}) {
    this.architecture = { ...this.architecture, ...arch };
    this.gridSize = this.architecture.gridSize || 16;
    this.gridOffset = this.gridSize / 2;

    // Ajustement de la caméra selon la taille
    this.cameraDistance = this.gridSize * 1.85;
    this.cameraElevation = this.cameraDistance * 0.8165;
    this.updateCameraTransform();
    this.updateCameraFrustum();

    // Vider l'ancien groupe
    while (this.roomGroup.children.length > 0) {
      const c = this.roomGroup.children[0];
      this.roomGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    }

    // A. Sol texturé personnalisable
    const floorGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
    floorGeo.rotateX(-Math.PI / 2);

    const floorTex = this.createFloorTexture(this.architecture.floorType);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.65,
      metalness: 0.05
    });

    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.receiveShadow = true;
    this.roomGroup.add(this.floorMesh);

    // B. Tapis central personnalisable
    if (this.architecture.rugType && this.architecture.rugType !== 'none') {
      const rugWidth = Math.min(10, Math.max(6, this.gridSize - 6));
      const rugDepth = Math.min(8, Math.max(5, this.gridSize - 8));
      const rugGeo = new THREE.PlaneGeometry(rugWidth, rugDepth);
      rugGeo.rotateX(-Math.PI / 2);

      const rugTex = this.createRugTexture(this.architecture.rugType);
      const rugMat = new THREE.MeshStandardMaterial({
        map: rugTex,
        roughness: 0.9,
        transparent: true
      });
      const rugMesh = new THREE.Mesh(rugGeo, rugMat);
      rugMesh.position.set(0, 0.005, 0);
      rugMesh.receiveShadow = true;
      this.roomGroup.add(rugMesh);
    }

    // C. Murs porteurs (Vue en coupe Sims)
    const wallColorHex = this.getWallColorHex(this.architecture.wallColor);
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColorHex,
      roughness: 0.82
    });

    const wallHeight = this.architecture.wallHeight || 5.5;
    const wallThick = 0.45;

    // 1. Mur Arrière (Nord-Ouest, z = -gridOffset)
    const backWallZ = -this.gridOffset;
    const backWallGeo = new THREE.BoxGeometry(this.gridSize, wallHeight, wallThick);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, wallHeight / 2, backWallZ - wallThick / 2);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    this.roomGroup.add(backWall);

    // Fenêtres paramétriques
    this.buildWindows(backWallZ, wallThick, wallHeight);

    // 2. Mur Gauche (Nord-Est, x = -gridOffset)
    const leftWallX = -this.gridOffset;
    const leftWallGeo = new THREE.BoxGeometry(wallThick, wallHeight, this.gridSize);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(leftWallX - wallThick / 2, wallHeight / 2, 0);
    leftWall.receiveShadow = true;
    leftWall.castShadow = true;
    this.roomGroup.add(leftWall);

    // 3. Demi-murs avant en coupe basse (Sud-Est et Sud-Ouest)
    const frontWallHeight = 0.38;
    const frontWallMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });

    const frontWallZGeo = new THREE.BoxGeometry(this.gridSize + wallThick, frontWallHeight, wallThick);
    const frontWallZ = new THREE.Mesh(frontWallZGeo, frontWallMat);
    frontWallZ.position.set(0, frontWallHeight / 2, this.gridOffset + wallThick / 2);
    this.roomGroup.add(frontWallZ);

    const frontWallXGeo = new THREE.BoxGeometry(wallThick, frontWallHeight, this.gridSize + wallThick);
    const frontWallX = new THREE.Mesh(frontWallXGeo, frontWallMat);
    frontWallX.position.set(this.gridOffset + wallThick / 2, frontWallHeight / 2, 0);
    this.roomGroup.add(frontWallX);

    // Grille de sélection subtile
    const gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0xd97706, 0xcbd5e1);
    gridHelper.position.set(0, 0.002, 0);
    gridHelper.material.opacity = 0.22;
    gridHelper.material.transparent = true;
    this.roomGroup.add(gridHelper);

    // Reconstruire les collisions selon la nouvelle taille
    this.rebuildCollisionGrid();
  }

  buildWindows(backWallZ, wallThick, wallHeight) {
    const type = this.architecture.windowType || 'large_bay';
    if (type === 'none') return;

    if (type === 'large_bay') {
      const windowWidth = Math.min(8, this.gridSize - 4);
      const windowGeo = new THREE.BoxGeometry(windowWidth, 3.2, 0.48);
      const windowMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.15,
        metalness: 0.85,
        transparent: true,
        opacity: 0.65
      });
      const windowMesh = new THREE.Mesh(windowGeo, windowMat);
      windowMesh.position.set(0, 3.2, backWallZ - wallThick / 2);
      this.roomGroup.add(windowMesh);

      // Cadre bois
      const frameGeo = new THREE.BoxGeometry(windowWidth + 0.3, 3.4, 0.5);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(0, 3.2, backWallZ - wallThick / 2);
      this.roomGroup.add(frameMesh);
    } else if (type === 'wooden_louver') {
      // Persiennes sahéliennes en bois chaleureux
      const louverMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
      const wSpan = 2.4;
      for (const ox of [-3.5, 3.5]) {
        const louverGeo = new THREE.BoxGeometry(wSpan, 2.8, 0.5);
        const louver = new THREE.Mesh(louverGeo, louverMat);
        louver.position.set(ox, 3.2, backWallZ - wallThick / 2);
        this.roomGroup.add(louver);
      }
    } else if (type === 'double_modern') {
      // Doubles fenêtres modernes
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, transparent: true, opacity: 0.6 });
      for (const ox of [-3, 3]) {
        const wGeo = new THREE.BoxGeometry(2.5, 3, 0.48);
        const wMesh = new THREE.Mesh(wGeo, glassMat);
        wMesh.position.set(ox, 3.2, backWallZ - wallThick / 2);
        this.roomGroup.add(wMesh);
      }
    }
  }

  getWallColorHex(wallColor) {
    switch (wallColor) {
      case 'brick_adobe': return 0xb45309; // Brique de terre crue latéritique
      case 'modern_white': return 0xf8fafc; // Blanc moderne épuré
      case 'indigo_sahara': return 0x1e3a8a; // Bleu indigo saharien
      case 'green_faso': return 0x15803d; // Vert Faso Dan Fani
      case 'wood_boiserie': return 0x78350f; // Boiserie chaleureuse
      case 'plaster_ochre':
      default:
        return 0xf3eee3; // Plâtre ocre doux ouagalais
    }
  }

  // --- Génération Procédurale des Textures de Sol ---

  createFloorTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (type === 'white_tile') {
      // Carrelage céramique blanc brillant
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      const tileSize = 64;
      for (let x = 0; x <= 512; x += tileSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      for (let y = 0; y <= 512; y += tileSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }
    } else if (type === 'marble') {
      // Marbre luxueux crème
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.bezierCurveTo(Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512);
        ctx.stroke();
      }
    } else if (type === 'terracotta') {
      // Terre cuite latéritique traditionnelle
      ctx.fillStyle = '#c2410c';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 4;
      const s = 64;
      for (let x = 0; x <= 512; x += s) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      for (let y = 0; y <= 512; y += s) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }
    } else if (type === 'carpet_soft') {
      // Moquette sahélienne douce
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 2000; i++) {
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
    } else {
      // Parquet d'acacia par défaut
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, 512, 512);
      const plankH = 32;
      const plankW = 128;
      const tones = ['#b45309', '#92400e', '#78350f', '#d97706'];

      for (let y = 0; y < 512; y += plankH) {
        const offsetX = ((y / plankH) % 2) * (plankW / 2);
        for (let x = -plankW; x < 512 + plankW; x += plankW) {
          ctx.fillStyle = tones[((x + y * 7) & 3)];
          ctx.fillRect(x + offsetX + 1, y + 1, plankW - 2, plankH - 2);
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(x + offsetX + 4, y + 6, plankW - 8, 2);
          ctx.fillRect(x + offsetX + 10, y + 20, plankW - 20, 2);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    const rep = Math.round(this.gridSize / 4);
    tex.repeat.set(rep, rep);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  createRugTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    if (type === 'faso_dan_fani') {
      // Rayures traditionnelles Faso Dan Fani
      const stripes = ['#b91c1c', '#facc15', '#15803d', '#ffffff', '#1e293b'];
      const stW = 512 / 16;
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = stripes[i % stripes.length];
        ctx.fillRect(i * stW, 0, stW, 384);
      }
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 492, 364);
    } else if (type === 'berbere') {
      // Tapis berbère losanges
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 384);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 6;
      for (let x = 64; x < 512; x += 128) {
        for (let y = 64; y < 384; y += 128) {
          ctx.beginPath();
          ctx.moveTo(x, y - 40);
          ctx.lineTo(x + 40, y);
          ctx.lineTo(x, y + 40);
          ctx.lineTo(x - 40, y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else {
      // Tapis rouge sahélien classique
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(0, 0, 512, 384);

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 14;
      ctx.strokeRect(12, 12, 488, 360);

      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 6;
      ctx.strokeRect(26, 26, 460, 332);

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

  // --- Gestion du Mobilier 3D & Empilement Vertical (Stacking) ---

  setFurniture(furnitureList = []) {
    this.furniture = furnitureList;

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

    // Modèle procédural Blockbench si pas de fichier .geo.json
    if (!geoData) {
      geoData = getProceduralBedrockGeo(item.type, { ...catalogItem, ...item });
    }

    const meshGroup = createBedrockMesh(geoData, {
      scale: 1 / 16,
      textureUrl
    });

    meshGroup.name = `furniture_${item.id}`;
    meshGroup.userData = { id: item.id, item };

    // Position dans le monde 3D (avec prise en compte de l'élévation sur table)
    const pos = this.gridToWorld(item.gx + (item.sizeX || 1) / 2, item.gy + (item.sizeY || 1) / 2);
    const elevation = item.elevation || 0;
    meshGroup.position.set(pos.x, elevation, pos.z);

    // Rotation
    const rotDeg = item.rotation || 0;
    meshGroup.rotation.y = THREE.MathUtils.degToRad(-rotDeg);

    this.furnitureGroup.add(meshGroup);
    this.furnitureMeshes.set(item.id, meshGroup);

    this.markFurnitureCollisions(item, 1);
  }

  rebuildCollisionGrid() {
    this.collisionGrid = Array.from({ length: this.gridSize || 16 }, () => Array(this.gridSize || 16).fill(0));
    if (Array.isArray(this.furniture)) {
      for (const item of this.furniture) {
        this.markFurnitureCollisions(item, 1);
      }
    }
  }

  markFurnitureCollisions(item, val) {
    // Les paillassons/tapis ou les objets posés SUR une table ne bloquent pas le sol
    if (item.isWalkable) return;
    if (item.elevation && item.elevation > 0.4) return;

    const rot = (item.rotation || 0) % 360;
    const isRotated = rot === 90 || rot === 270;
    const sx = isRotated ? (item.sizeY || 1) : (item.sizeX || 1);
    const sy = isRotated ? (item.sizeX || 1) : (item.sizeY || 1);

    for (let x = 0; x < sx; x++) {
      for (let y = 0; y < sy; y++) {
        const gx = Math.floor(item.gx + x);
        const gy = Math.floor(item.gy + y);
        if (gx >= 0 && gx < this.gridSize && gy >= 0 && gy < this.gridSize) {
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
    let geoData = BedrockGeometryRegistry.get(geoId);
    if (!geoData) {
      geoData = getProceduralBedrockGeo(itemType, catalogItem);
    }

    if (geoData) {
      this.placingGhost = createBedrockMesh(geoData, {
        scale: 1 / 16,
        textureUrl
      });
      this.placingGhost.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.65;
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

    const mesh = this.furnitureMeshes.get(this.selectedFurniture.id);
    if (mesh) {
      mesh.rotation.y = THREE.MathUtils.degToRad(-this.selectedFurniture.rotation);
    }
    this.rebuildCollisionGrid();

    if (this.callbacks.onRotateFurniture) {
      this.callbacks.onRotateFurniture(this.selectedFurniture.id);
    }
  }

  // --- Gestion des Avatars & Pathfinding ---

  setPlayers(playersList) {
    this.players.clear();
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
        gx: playerData.gx || (this.gridSize / 2),
        gy: playerData.gy || (this.gridSize / 2),
        targetGx: playerData.gx || (this.gridSize / 2),
        targetGy: playerData.gy || (this.gridSize / 2),
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
      p.path = path.slice(1);
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
    return 'architectural';
  }

  recenter() {
    this.cameraOffset.set(0, 0, 0);
    this._userZoom = 1.0;
    this.updateCameraFrustum();
    this.updateCameraTransform();
  }

  // --- Algorithme A* avec évitement strict des meubles solides ---

  findPathAStar(start, goal) {
    let target = { ...goal };
    if (this.collisionGrid[target.x]?.[target.y] === 1) {
      const neighbors = [
        { x: target.x + 1, y: target.y },
        { x: target.x - 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 }
      ];
      const valid = neighbors.find(n => n.x >= 0 && n.x < this.gridSize && n.y >= 0 && n.y < this.gridSize && this.collisionGrid[n.x][n.y] === 0);
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
        if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
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

  // --- Projections Grille / Monde 3D Dynamiques ---

  gridToWorld(gx, gy) {
    return {
      x: gx - this.gridOffset,
      z: gy - this.gridOffset
    };
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.floor(wx + this.gridOffset),
      gy: Math.floor(wz + this.gridOffset)
    };
  }

  // --- Interactions Souris & Placement avec Stacking ---

  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());

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

  findSurfaceAtGrid(gx, gy) {
    return this.furniture.find(f => {
      if (!f.isSurface) return false;
      const rot = (f.rotation || 0) % 360;
      const isRot = rot === 90 || rot === 270;
      const sx = isRot ? (f.sizeY || 1) : (f.sizeX || 1);
      const sy = isRot ? (f.sizeX || 1) : (f.sizeY || 1);
      return gx >= f.gx && gx < f.gx + sx && gy >= f.gy && gy < f.gy + sy;
    });
  }

  onPointerDown(e) {
    this.updateRaycaster(e);
    this.lastPointer = { x: e.clientX, y: e.clientY };

    if (e.button === 2 || e.button === 1) {
      this.isPanning = true;
      return;
    }

    if (e.button === 0) {
      // 1. Mode Pose de Meuble ou Objet Tabletop
      if (this.placingItemType) {
        if (this.raycaster.ray.intersectPlane(this.floorPlane, this.planeIntersectPoint)) {
          const grid = this.worldToGrid(this.planeIntersectPoint.x, this.planeIntersectPoint.z);
          if (grid.gx >= 0 && grid.gx < this.gridSize && grid.gy >= 0 && grid.gy < this.gridSize) {
            const catalogItem = FURNITURE_CATALOG[this.placingItemType] || {};
            const surfaceItem = this.findSurfaceAtGrid(grid.gx, grid.gy);

            // Vérification de validité de placement
            if (surfaceItem && !catalogItem.isTabletop) {
              if (this.callbacks.onToast) this.callbacks.onToast("Impossible de placer un gros meuble sur une table !", 2500);
              return;
            }
            if (!surfaceItem && this.collisionGrid[grid.gx]?.[grid.gy] === 1 && !catalogItem.isWalkable) {
              if (this.callbacks.onToast) this.callbacks.onToast("Cet emplacement est déjà occupé !", 2000);
              return;
            }

            const elevation = (surfaceItem && catalogItem.isTabletop)
              ? (surfaceItem.surfaceHeight || 0.75)
              : 0;

            const newItem = {
              id: 'f_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
              type: this.placingItemType,
              gx: grid.gx,
              gy: grid.gy,
              sizeX: catalogItem.sizeX || 1,
              sizeY: catalogItem.sizeY || 1,
              rotation: this.placingRotation,
              elevation: elevation,
              surfaceParentId: (surfaceItem && catalogItem.isTabletop) ? surfaceItem.id : null,
              isSurface: !!catalogItem.isSurface,
              surfaceHeight: catalogItem.surfaceHeight || 0,
              isTabletop: !!catalogItem.isTabletop,
              isWalkable: !!catalogItem.isWalkable,
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
        if (grid.gx >= 0 && grid.gx < this.gridSize && grid.gy >= 0 && grid.gy < this.gridSize) {
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
        const surfaceItem = this.findSurfaceAtGrid(grid.gx, grid.gy);

        let elevation = 0;
        let isValid = true;

        if (surfaceItem) {
          if (catalogItem.isTabletop) {
            elevation = surfaceItem.surfaceHeight || 0.75;
            isValid = true;
          } else {
            isValid = false; // meuble lourd sur meuble
          }
        } else {
          if (this.collisionGrid[grid.gx]?.[grid.gy] === 1 && !catalogItem.isWalkable) {
            isValid = false;
          }
        }

        const pos = this.gridToWorld(grid.gx + (catalogItem.sizeX || 1) / 2, grid.gy + (catalogItem.sizeY || 1) / 2);
        this.placingGhost.position.set(pos.x, elevation, pos.z);

        // Teinte verte ou rouge selon la validité
        this.placingGhost.traverse(child => {
          if (child.isMesh && child.material && child.material.color) {
            child.material.color.set(isValid ? 0x86efac : 0xf87171);
          }
        });
      }
    }
  }

  onPointerUp() {
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

    this.updatePlayers(delta);
    this.renderer.render(this.scene, this.camera);
    this.updateOverlays();
  }

  updatePlayers(delta) {
    const moveSpeed = 4.8;

    for (const [id, p] of this.players.entries()) {
      if (p.path && p.path.length > 0 && p.pathIdx < p.path.length) {
        p.isMoving = true;
        const target = p.path[p.pathIdx];
        const dx = target.x - p.gx;
        const dy = target.y - p.gy;
        const dist = Math.sqrt(dx * dx + dy * dy);

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
        p.avatar3d.group.position.y + 2.4,
        p.avatar3d.group.position.z
      );

      tempVec.project(this.camera);
      if (tempVec.z > 1) continue;

      const screenX = (tempVec.x * 0.5 + 0.5) * this.width;
      const screenY = (-(tempVec.y * 0.5) + 0.5) * this.height;

      html += `
        <div style="position: absolute; left: ${screenX}px; top: ${screenY}px; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
          ${p.chatText ? `
            <div style="background: rgba(15, 23, 42, 0.92); color: #fff; padding: 6px 12px; border-radius: 12px; font-size: 13px; font-weight: 500; margin-bottom: 6px; border: 1px solid rgba(217, 119, 6, 0.6); box-shadow: 0 4px 12px rgba(0,0,0,0.4); max-width: 220px; text-align: center; word-break: break-word;">
              ${escapeHtml(p.chatText)}
            </div>
          ` : ''}
          <div style="background: rgba(15, 23, 42, 0.75); color: #f8fafc; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
            <span>${escapeHtml(p.data.username || 'Joueur')}</span>
            ${p.data.isOwner ? '<span style="color: #facc15; font-size: 10px;">★ Hôte</span>' : ''}
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
