// --- Carte Urbaine Interactive de Ouagadougou Style Google Maps (Three.js / WebGL) ---
// Calquée à 100% sur la carte réelle de Ouagadougou (Burkina Faso) via projection cartographique
// OpenStreetMap haute définition, coordonnées GPS réelles, vue zénithale sans fuite de perspective
// et modèles 3D Kenney City. Rétractable sur le côté avec zéro zone blanche.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Dimensions du monde 3D
const MAP_WORLD_SIZE = 240; // 240 x 240 unités 3D couvrant l'agglomération de Ouaga

// Bornes géographiques exactes de la grille 3x3 de tuiles OSM (zoom 13)
// Tuiles X: 4060 -> 4062, Y: 3811 -> 3813
const WEST_LON = -1.58203125;
const EAST_LON = -1.4501953125;
const MIN_TILE_Y = 3811;

/**
 * Convertit des coordonnées GPS réelles (Latitude, Longitude) en coordonnées Three.js mondiales (x, z)
 */
export function geoToWorld(lat, lon) {
  const u = (lon - WEST_LON) / (EAST_LON - WEST_LON);
  const latRad = lat * (Math.PI / 180);
  const tileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, 13);
  const v = (tileY - MIN_TILE_Y) / 3;

  const x = (u - 0.5) * MAP_WORLD_SIZE;
  const z = (v - 0.5) * MAP_WORLD_SIZE;
  return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
}

/**
 * Quartiers réels de Ouagadougou géolocalisés avec leurs coordonnées GPS authentiques
 * Icônes vectorielles SVG (sans aucun emoji)
 */
export const OUAGA_DISTRICTS = [
  {
    id: 'koulouba',
    name: 'Koulouba & Place de la Nation',
    tag: 'Centre Historique & Administratif',
    color: '#f59e0b',
    coords: geoToWorld(12.3647, -1.5283),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2L2 7h20L12 2z"/></svg>',
    description: "Le centre civique et historique de Ouagadougou. Abrite la vaste Place de la Nation, le Palais de Justice, l'État-Major et les grands ministères.",
    activities: ["Institutions Publiques", "Monuments Historiques", "Bureaux Administratifs"],
    taxiFare: 300,
    zoomHeight: 52
  },
  {
    id: 'kwame_nkrumah',
    name: 'Avenue Kwame Nkrumah',
    tag: 'Affaires & Sorties',
    color: '#3b82f6',
    coords: geoToWorld(12.3618, -1.5168),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>',
    description: "L'artère prestigieuse reliant le centre aux quartiers d'affaires. Célèbre pour ses banques, compagnies aériennes, terrasses de cafés animées et vie nocturne.",
    activities: ["Cafés & Restaurants", "Terrasses Sahéliennes", "Bureaux & Agences"],
    taxiFare: 400,
    zoomHeight: 48
  },
  {
    id: 'rood_woko',
    name: 'Grand Marché (Rood Woko)',
    tag: 'Poumon Économique & Artisanat',
    color: '#10b981',
    coords: geoToWorld(12.3688, -1.5222),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
    description: "Le plus grand marché du pays. Une effervescence commerciale unique : tissus Faso Dan Fani tissés main, maroquinerie, épices, orfèvrerie et bronzes d'art.",
    activities: ["Négociation & Commerce", "Tissus Faso Dan Fani", "Artisanat d'Art"],
    taxiFare: 350,
    zoomHeight: 46
  },
  {
    id: 'ouaga_2000',
    name: 'Ouaga 2000 & Monument des Martyrs',
    tag: 'Quartier Moderne & Diplomatique',
    color: '#8b5cf6',
    coords: geoToWorld(12.3182, -1.5084),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>',
    description: "Au sud, le quartier moderne d'affaires : tours de bureaux, ambassades internationales, le Monument des Martyrs, le Palais des Congrès et les résidences de standing.",
    activities: ["Sièges d'Entreprises", "Ambassades", "Résidences de Prestige"],
    taxiFare: 600,
    zoomHeight: 56
  },
  {
    id: 'gounghin',
    name: 'Gounghin & Pissy',
    tag: 'Quartiers Populaires & Ateliers',
    color: '#ec4899',
    coords: geoToWorld(12.3550, -1.5550),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    description: "À l'ouest sur la route de Bobo-Dioulasso, le cœur populaire battant : ateliers de mécaniciens deux-roues, menuiseries, menuisiers d'art et maquis conviviaux.",
    activities: ["Ateliers Deux-Roues", "Maquis Traditionnels", "Artisanat Bois & Fer"],
    taxiFare: 400,
    zoomHeight: 52
  },
  {
    id: 'tampouy',
    name: 'Tampouy & Échangeur du Nord',
    tag: 'Pôle Commercial du Nord',
    color: '#f97316',
    coords: geoToWorld(12.3920, -1.5450),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    description: "Porte d'entrée nord de Ouaga. Vaste carrefour d'échanges, terminus de bus, étals de fruits sahéliens et zone marchande dynamique.",
    activities: ["Gares Routières", "Marchés de Fruits", "Commerce de Transit"],
    taxiFare: 450,
    zoomHeight: 54
  },
  {
    id: 'tanghin',
    name: 'Barrages de Tanghin',
    tag: 'Zone Lacustre & Maraîchage',
    color: '#06b6d4',
    coords: geoToWorld(12.3850, -1.5200),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c2.5 0 3-3 6-3s3.5 3 6 3 3.5-3 6-3 3 2 4 3M2 17c2.5 0 3-3 6-3s3.5 3 6 3 3.5-3 6-3 3 2 4 3"/></svg>',
    description: "Les retenues d'eau n°2 et n°3 de la capitale. Espace de fraîcheur, cultures maraîchères de salades et menthe, pêche artisanale et terrasses au bord de l'eau.",
    activities: ["Fraîcheur Lacustre", "Maraîchage Urbain", "Poissons Grillés"],
    taxiFare: 400,
    zoomHeight: 50
  },
  {
    id: 'bangr_weogo',
    name: 'Forêt Classée de Bangr Weogo',
    tag: 'Poumon Vert & Réserve Naturelle',
    color: '#15803d',
    coords: geoToWorld(12.3892, -1.4885),
    iconSvg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 12h5v8h6v-8h5L12 2z"/></svg>',
    description: "La célèbre forêt sacrée au cœur de la ville (240 hectares). Vaste réserve naturelle peuplée de grands arbres de savane, faune protégée et sentiers ombragés.",
    activities: ["Balades Écologiques", "Faune & Flore", "Pique-Nique Sahélien"],
    taxiFare: 500,
    zoomHeight: 55
  }
];

export class OuagaMap3D {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.loader = new GLTFLoader();

    this.isOpen = false;
    this.animId = null;

    this.activeDistrict = OUAGA_DISTRICTS[0];

    // Position de la caméra style Google Maps (Vue Zénithale par défaut)
    this.is3DMode = false; // Par défaut, vue Google Maps 2D/3D zénithale sans ciel
    this.cameraCenter = new THREE.Vector3(0, 0, 0); // Point regardé au sol (x, 0, z)
    this.targetCameraCenter = new THREE.Vector3(0, 0, 0);
    this.cameraHeight = 88; // Altitude de vue (zoom)
    this.targetCameraHeight = 88;

    // Angle d'inclinaison pour le mode 3D aérien optionnel
    this.cameraAngle = 0;
    this.cameraPitch = Math.PI / 2 - 0.0001; // 89.99° = regard droit vers le bas (zéro ciel visible)

    this.pins = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDragging = false;
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragStartCenter = { x: 0, z: 0 };

    this.groundMesh = null;
    this.outerGroundMesh = null;
    this.onTravelCallback = null;
  }

  init(options = {}) {
    this.onTravelCallback = options.onTravel || null;
    this.buildDOM();
    this.initThree();
    this.buildRealMapTerrain();
    this.loadRealCityBuildings();
    this.buildDistrictMarkers();
    this.bindEvents();
  }

  buildDOM() {
    let overlay = document.getElementById('ouaga-map-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ouaga-map-overlay';
      overlay.className = 'ouaga-map-overlay hidden';

      overlay.innerHTML = `
        <!-- Barre Supérieure de la Ville Style Google Maps Épurée -->
        <header class="map-topbar">
          <div class="map-city-identity">
            <div class="flag-badge-svg" title="Burkina Faso">
              <svg viewBox="0 0 32 20" width="28" height="18">
                <rect width="32" height="10" fill="#ef4444"/>
                <rect y="10" width="32" height="10" fill="#16a34a"/>
                <polygon points="16,6 17.5,9.5 21,9.5 18,12 19.5,15.5 16,13 12.5,15.5 14,12 11,9.5 14.5,9.5" fill="#facc15"/>
              </svg>
            </div>
            <div>
              <h1 class="map-city-title">CARTE DE OUAGADOUGOU</h1>
              <span class="map-city-coords">Burkina Faso • Cartographie Réelle OpenStreetMap</span>
            </div>
          </div>

          <div class="map-topbar-center">
            <div class="map-weather-pill">
              <span class="weather-temp">34°C</span>
              <span class="weather-condition">Ensoleillé • Harmattan</span>
            </div>
          </div>

          <div class="map-topbar-right">
            <button id="btn-close-map" class="btn-close-map" title="Fermer la carte [Échap]">
              Fermer la carte
            </button>
          </div>
        </header>

        <!-- Canvas 3D de la Carte (100% plein écran) -->
        <canvas id="ouaga-map-canvas" class="ouaga-map-canvas"></canvas>

        <!-- Contrôles Flottants Google Maps (Bas Gauche) -->
        <div class="map-camera-controls">
          <button id="btn-map-zoom-in" class="map-ctrl-btn" title="Zoom avant">+</button>
          <button id="btn-map-zoom-out" class="map-ctrl-btn" title="Zoom arrière">−</button>
          <button id="btn-map-recenter" class="map-ctrl-btn" title="Recentrer sur le Grand Marché">Centre-Ville</button>
          <button id="btn-map-toggle-3d" class="map-ctrl-btn btn-mode-3d" title="Basculer Vue Zénithale / Perspective 3D">Vue 3D</button>
        </div>

        <!-- Panneau Latéral Droit : Rétractable avec onglet -->
        <aside class="map-sidebar" id="map-sidebar">
          <!-- Onglet de réouverture sur le bord droit de l'écran -->
          <button class="panel-edge-tab" id="tab-toggle-map-sidebar" title="Ouvrir Destinations">
            <span class="tab-arrow">‹</span>
            <span class="tab-text">Quartiers</span>
          </button>

          <div class="sidebar-header-box">
            <div class="sidebar-title-row">
              <h2 class="sidebar-map-title">Destinations & Quartiers</h2>
              <button id="btn-toggle-map-sidebar" class="btn-sidebar-toggle" title="Masquer le panneau vers la droite">›</button>
            </div>
            <span class="sidebar-map-subtitle">Sélectionnez un point d'intérêt</span>
          </div>

          <div class="districts-list" id="districts-list"></div>

          <!-- Fiche d'information du Quartier Sélectionné -->
          <div class="district-info-card" id="district-info-card">
            <div class="card-badge-row">
              <span class="district-badge" id="card-district-tag">Centre Historique</span>
              <span class="taxi-badge" id="card-district-fare">Taxi : 300 FCFA</span>
            </div>
            <h3 class="district-card-title" id="card-district-name">Koulouba & Place de la Nation</h3>
            <p class="district-card-desc" id="card-district-desc"></p>
            <div class="district-activities-box">
              <span class="activities-label">Opportunités & Activités :</span>
              <ul class="activities-list" id="card-district-activities"></ul>
            </div>
            <div class="card-actions-row">
              <button id="btn-travel-district" class="btn-primary btn-travel">
                Prendre le Taxi & Voyager
              </button>
            </div>
          </div>
        </aside>
      `;

      document.body.appendChild(overlay);
    }

    this.container = overlay;
    this.canvas = document.getElementById('ouaga-map-canvas');
  }

  initThree() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();

    // Fond sablonneux doux parfaitement identique à la bordure OSM (Zéro blanc / zéro ciel bleu)
    const bgColor = new THREE.Color(0xeedfc8);
    this.scene.background = bgColor;

    // Caméra Perspective avec champ de vision resserré pour minimiser la distorsion
    this.camera = new THREE.PerspectiveCamera(40, width / height, 1, 1500);
    this.updateCameraTransform();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Éclairage zénithal naturel style cartographique
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.15);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.1);
    sunLight.position.set(40, 140, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const d = 120;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0xd4c2a5, 0.4);
    this.scene.add(hemiLight);
  }

  /**
   * Construit le sol cartographique 3D texturé à partir des tuiles réelles OpenStreetMap
   * et ajoute un sol de savane périphérique étendu (1200x1200) pour garantir zéro bordure vide
   */
  buildRealMapTerrain() {
    // 1. Sol périphérique géant pour éviter toute zone blanche en dézoomant
    const outerGeo = new THREE.PlaneGeometry(1200, 1200);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshLambertMaterial({
      color: 0xeedfc8,
      roughness: 1.0
    });
    this.outerGroundMesh = new THREE.Mesh(outerGeo, outerMat);
    this.outerGroundMesh.position.y = -0.2;
    this.outerGroundMesh.receiveShadow = false;
    this.scene.add(this.outerGroundMesh);

    // 2. Sol central cartographique haute définition (240 x 240 unités)
    const groundGeo = new THREE.PlaneGeometry(MAP_WORLD_SIZE, MAP_WORLD_SIZE, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMat = new THREE.MeshLambertMaterial({
      color: 0xeedfc8,
      roughness: 0.95
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Assemblage composite des 9 tuiles OSM de Ouagadougou en texture 768x768
    this.assembleOSMCompositeTexture().then(mapTexture => {
      if (mapTexture) {
        mapTexture.colorSpace = THREE.SRGBColorSpace;
        this.groundMesh.material.map = mapTexture;
        this.groundMesh.material.color.setHex(0xffffff);
        this.groundMesh.material.needsUpdate = true;
      }
    });
  }

  /**
   * Assemble en mémoire les 9 tuiles OSM locales de Ouagadougou en un canvas composite
   */
  async assembleOSMCompositeTexture() {
    try {
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = 768;
      compositeCanvas.height = 768;
      const ctx = compositeCanvas.getContext('2d');

      // Fond de base sableux burkinabè
      ctx.fillStyle = '#eedfc8';
      ctx.fillRect(0, 0, 768, 768);

      const tilePromises = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const tileY = 3811 + row;
          const tileX = 4060 + col;
          const url = `assets/city/tiles/tile_13_${tileX}_${tileY}.png`;

          const p = new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              ctx.drawImage(img, col * 256, row * 256, 256, 256);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          });
          tilePromises.push(p);
        }
      }

      await Promise.all(tilePromises);

      // Filtre subtil ambré sahélien pour adoucir les contrastes
      ctx.fillStyle = 'rgba(217, 119, 6, 0.04)';
      ctx.fillRect(0, 0, 768, 768);

      const texture = new THREE.CanvasTexture(compositeCanvas);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    } catch (err) {
      console.warn('[OuagaMap] Erreur assemblage texture OSM:', err);
      return null;
    }
  }

  /**
   * Charge et implante les bâtiments 3D Kenney GLB aux emplacements réels des quartiers
   */
  loadRealCityBuildings() {
    const placements = [
      // 1. Koulouba (Centre historique et administratif)
      { file: 'building-a.glb', coords: geoToWorld(12.3660, -1.5295), scale: 2.2, rot: 0.1 },
      { file: 'building-b.glb', coords: geoToWorld(12.3640, -1.5265), scale: 2.2, rot: 1.5 },
      { file: 'building-c.glb', coords: geoToWorld(12.3630, -1.5300), scale: 2.0, rot: -0.8 },
      { file: 'building-d.glb', coords: geoToWorld(12.3655, -1.5260), scale: 2.0, rot: 3.1 },

      // 2. Avenue Kwame Nkrumah (Hôtels & Banques le long de l'artère)
      { file: 'building-e.glb', coords: geoToWorld(12.3630, -1.5180), scale: 2.3, rot: -0.4 },
      { file: 'building-f.glb', coords: geoToWorld(12.3610, -1.5160), scale: 2.3, rot: 0.6 },
      { file: 'building-g.glb', coords: geoToWorld(12.3595, -1.5150), scale: 2.2, rot: 1.2 },
      { file: 'building-skyscraper-a.glb', coords: geoToWorld(12.3580, -1.5140), scale: 2.0, rot: -0.2 },

      // 3. Grand Marché Rood Woko (Commerces denses et échoppes)
      { file: 'building-h.glb', coords: geoToWorld(12.3695, -1.5235), scale: 2.0, rot: 0.3 },
      { file: 'building-b.glb', coords: geoToWorld(12.3680, -1.5210), scale: 1.9, rot: 1.5 },
      { file: 'building-c.glb', coords: geoToWorld(12.3675, -1.5240), scale: 2.0, rot: -1.0 },
      { file: 'building-d.glb', coords: geoToWorld(12.3700, -1.5215), scale: 1.9, rot: 0 },

      // 4. Ouaga 2000 (Gratte-ciels, Ministères & Ambassades)
      { file: 'building-skyscraper-a.glb', coords: geoToWorld(12.3200, -1.5100), scale: 2.6, rot: 0.2 },
      { file: 'building-skyscraper-b.glb', coords: geoToWorld(12.3160, -1.5070), scale: 2.6, rot: -0.5 },
      { file: 'building-skyscraper-c.glb', coords: geoToWorld(12.3220, -1.5060), scale: 2.6, rot: 0.8 },
      { file: 'building-skyscraper-d.glb', coords: geoToWorld(12.3150, -1.5120), scale: 2.5, rot: -0.2 },
      { file: 'building-skyscraper-e.glb', coords: geoToWorld(12.3240, -1.5090), scale: 2.5, rot: 1.1 },

      // 5. Gounghin & Pissy (Ateliers et maisons)
      { file: 'building-c.glb', coords: geoToWorld(12.3560, -1.5570), scale: 1.8, rot: 0.5 },
      { file: 'building-e.glb', coords: geoToWorld(12.3530, -1.5530), scale: 1.8, rot: -0.9 },
      { file: 'building-f.glb', coords: geoToWorld(12.3570, -1.5520), scale: 1.8, rot: 1.8 },

      // 6. Tampouy & Échangeur du Nord
      { file: 'building-a.glb', coords: geoToWorld(12.3930, -1.5470), scale: 2.0, rot: 0.2 },
      { file: 'building-b.glb', coords: geoToWorld(12.3900, -1.5430), scale: 2.0, rot: -1.4 },
      { file: 'building-h.glb', coords: geoToWorld(12.3940, -1.5420), scale: 1.9, rot: 0.8 },

      // 7. Tanghin (Pavillons lacustres)
      { file: 'building-c.glb', coords: geoToWorld(12.3860, -1.5180), scale: 1.7, rot: -0.3 },
      { file: 'building-d.glb', coords: geoToWorld(12.3830, -1.5220), scale: 1.7, rot: 1.1 },

      // 8. Bangr Weogo (Éco-pavillons)
      { file: 'building-e.glb', coords: geoToWorld(12.3880, -1.4860), scale: 1.6, rot: 0.7 },
      { file: 'building-f.glb', coords: geoToWorld(12.3910, -1.4910), scale: 1.6, rot: -0.5 }
    ];

    const modelCache = new Map();

    placements.forEach(p => {
      const url = `assets/city/glb/${p.file}`;
      if (modelCache.has(url)) {
        this.instantiateBuilding(modelCache.get(url), p);
      } else {
        this.loader.load(
          url,
          gltf => {
            modelCache.set(url, gltf.scene);
            this.instantiateBuilding(gltf.scene, p);
          },
          undefined,
          err => {
            console.warn(`[OuagaMap] Fichier GLB ${p.file} non chargé:`, err);
          }
        );
      }
    });
  }

  instantiateBuilding(templateScene, p) {
    const clone = templateScene.clone(true);
    clone.position.set(p.coords.x, 0, p.coords.z);
    clone.scale.set(p.scale, p.scale, p.scale);
    clone.rotation.y = p.rot || 0;

    clone.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.85;
        }
      }
    });

    this.scene.add(clone);
  }

  /**
   * Crée des balises de quartier 3D flottantes et interactives
   */
  buildDistrictMarkers() {
    OUAGA_DISTRICTS.forEach(d => {
      const pinGroup = new THREE.Group();
      pinGroup.position.set(d.coords.x, 0, d.coords.z);
      pinGroup.userData = { district: d };

      // Anneau au sol
      const ringGeo = new THREE.RingGeometry(2.4, 3.2, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.2;
      pinGroup.add(ring);

      // Losange 3D flottant
      const pinGeo = new THREE.OctahedronGeometry(1.9, 0);
      const pinMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(d.color),
        emissive: new THREE.Color(d.color),
        emissiveIntensity: 0.4,
        roughness: 0.2
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.y = 8.5;
      pinMesh.name = `pin_${d.id}`;
      pinGroup.add(pinMesh);

      // Mât vertical
      const rodGeo = new THREE.CylinderGeometry(0.12, 0.12, 7.5, 8);
      const rodMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.y = 4.2;
      pinGroup.add(rod);

      this.scene.add(pinGroup);
      this.pins.push({ group: pinGroup, pinMesh, district: d });
    });
  }

  renderDistrictsUI() {
    const listContainer = document.getElementById('districts-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    OUAGA_DISTRICTS.forEach(d => {
      const item = document.createElement('div');
      item.className = `district-item ${d.id === this.activeDistrict.id ? 'active' : ''}`;
      item.dataset.id = d.id;

      item.innerHTML = `
        <div class="district-item-left">
          <span class="district-icon">${d.iconSvg}</span>
          <div class="district-texts">
            <span class="district-name">${d.name}</span>
            <span class="district-tag">${d.tag}</span>
          </div>
        </div>
        <span class="district-fare">${d.taxiFare} F</span>
      `;

      item.addEventListener('click', () => {
        this.selectDistrict(d);
      });

      listContainer.appendChild(item);
    });

    this.updateCardUI();
  }

  selectDistrict(district) {
    this.activeDistrict = district;

    document.querySelectorAll('.district-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === district.id);
    });
    this.updateCardUI();

    // Animation fluide vers le quartier ciblé
    this.targetCameraCenter.set(district.coords.x, 0, district.coords.z);
    this.targetCameraHeight = district.zoomHeight || 50;
  }

  updateCardUI() {
    const d = this.activeDistrict;
    if (!d) return;

    const elTag = document.getElementById('card-district-tag');
    const elFare = document.getElementById('card-district-fare');
    const elName = document.getElementById('card-district-name');
    const elDesc = document.getElementById('card-district-desc');
    const elActivities = document.getElementById('card-district-activities');

    if (elTag) elTag.textContent = d.tag;
    if (elFare) elFare.textContent = `Taxi : ${d.taxiFare} FCFA`;
    if (elName) elName.textContent = d.name;
    if (elDesc) elDesc.textContent = d.description;

    if (elActivities) {
      elActivities.innerHTML = d.activities.map(act => `<li>${act}</li>`).join('');
    }
  }

  bindEvents() {
    // Fermeture de la carte
    const btnClose = document.getElementById('btn-close-map');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    // Bouton Taxi & Voyage
    const btnTravel = document.getElementById('btn-travel-district');
    if (btnTravel) {
      btnTravel.addEventListener('click', () => {
        if (this.onTravelCallback) {
          this.onTravelCallback(this.activeDistrict);
        }
        this.close();
      });
    }

    // Volet latéral rétractable
    const sidebar = document.getElementById('map-sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-map-sidebar');
    const tabToggleSidebar = document.getElementById('tab-toggle-map-sidebar');

    if (btnToggleSidebar && sidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
      });
    }
    if (tabToggleSidebar && sidebar) {
      tabToggleSidebar.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
      });
    }

    // Zoom avant Google Maps
    const btnZoomIn = document.getElementById('btn-map-zoom-in');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        this.targetCameraHeight = Math.max(30, this.targetCameraHeight - 18);
      });
    }

    // Zoom arrière Google Maps
    const btnZoomOut = document.getElementById('btn-map-zoom-out');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        this.targetCameraHeight = Math.min(150, this.targetCameraHeight + 18);
      });
    }

    // Recentrer au centre-ville de Ouaga
    const btnRecenter = document.getElementById('btn-map-recenter');
    if (btnRecenter) {
      btnRecenter.addEventListener('click', () => {
        this.targetCameraCenter.set(-11.1, 0, -13.7); // Rood Woko
        this.targetCameraHeight = 85;
      });
    }

    // Basculer mode 2D Google Maps <-> 3D Aérien
    const btnToggle3D = document.getElementById('btn-map-toggle-3d');
    if (btnToggle3D) {
      btnToggle3D.addEventListener('click', () => {
        this.is3DMode = !this.is3DMode;
        if (this.is3DMode) {
          btnToggle3D.textContent = 'Vue 2D';
          btnToggle3D.classList.add('active');
          this.cameraPitch = 0.95; // Inclinaison à ~55° pour apprécier les bâtiments 3D
          this.cameraAngle = Math.PI / 4;
        } else {
          btnToggle3D.textContent = 'Vue 3D';
          btnToggle3D.classList.remove('active');
          this.cameraPitch = Math.PI / 2 - 0.0001; // Vue zénithale parfaite 90°
          this.cameraAngle = 0;
        }
      });
    }

    // Panning direct 1:1 style Google Maps au clic-glisser
    this.canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.dragStartMouse = { x: e.clientX, y: e.clientY };
      this.dragStartCenter = { x: this.cameraCenter.x, z: this.cameraCenter.z };
    });

    window.addEventListener('mousemove', e => {
      if (!this.isOpen) return;

      if (this.isDragging) {
        const dx = e.clientX - this.dragStartMouse.x;
        const dy = e.clientY - this.dragStartMouse.y;

        if (this.is3DMode) {
          // En mode 3D, drag permet de faire orbiter la vue
          this.cameraAngle -= dx * 0.006;
          this.cameraPitch = Math.max(0.4, Math.min(1.4, this.cameraPitch + dy * 0.006));
          this.dragStartMouse = { x: e.clientX, y: e.clientY };
        } else {
          // En mode Google Maps, pan direct 1:1 sous le curseur
          const fovRad = (this.camera.fov * Math.PI) / 180;
          const factor = (2 * Math.tan(fovRad / 2) * this.cameraHeight) / window.innerHeight;

          let newX = this.dragStartCenter.x - dx * factor;
          let newZ = this.dragStartCenter.z - dy * factor;

          // Clamping strict dans les limites de Ouagadougou (aucun vide possible)
          const clampBound = 90;
          newX = Math.max(-clampBound, Math.min(clampBound, newX));
          newZ = Math.max(-clampBound, Math.min(clampBound, newZ));

          this.cameraCenter.x = newX;
          this.cameraCenter.z = newZ;
          this.targetCameraCenter.x = newX;
          this.targetCameraCenter.z = newZ;
        }
      }

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Zoom molette fluide Google Maps
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.06;
      this.targetCameraHeight = Math.max(30, Math.min(150, this.targetCameraHeight + zoomDelta));
    }, { passive: false });

    // Clic 3D sur un quartier
    this.canvas.addEventListener('click', e => {
      if (!this.isOpen) return;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshesToTest = this.pins.map(p => p.pinMesh);
      const hits = this.raycaster.intersectObjects(meshesToTest, false);
      if (hits.length > 0) {
        const hitGroup = hits[0].object.parent;
        if (hitGroup && hitGroup.userData.district) {
          this.selectDistrict(hitGroup.userData.district);
        }
      }
    });

    // Raccourcis clavier Échap & M
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      } else if ((e.key === 'm' || e.key === 'M') && !this.isTypingInInput()) {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
    });

    window.addEventListener('resize', () => {
      if (this.isOpen) this.handleResize();
    });
  }

  isTypingInInput() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  updateCameraTransform() {
    if (!this.camera) return;

    if (!this.is3DMode) {
      // Vue Google Maps 2D/3D zénithale directe (aucun horizon fuyant, aucun ciel)
      this.camera.position.set(this.cameraCenter.x, this.cameraHeight, this.cameraCenter.z);
      this.camera.lookAt(this.cameraCenter.x, 0, this.cameraCenter.z);
    } else {
      // Vue Perspective 3D aérienne
      const dist = this.cameraHeight * 1.15;
      const cx = this.cameraCenter.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * dist;
      const cy = Math.sin(this.cameraPitch) * dist;
      const cz = this.cameraCenter.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * dist;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.cameraCenter.x, 0, this.cameraCenter.z);
    }
  }

  open() {
    if (!this.container) return;
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.handleResize();
    this.renderDistrictsUI();
    this.startLoop();
  }

  close() {
    if (!this.container) return;
    this.isOpen = false;
    this.container.classList.add('hidden');
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  startLoop() {
    let lastTime = performance.now();

    const animate = (time) => {
      if (!this.isOpen) return;
      this.animId = requestAnimationFrame(animate);

      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Interpolation fluide vers le centre et le zoom ciblés
      if (!this.isDragging) {
        this.cameraCenter.lerp(this.targetCameraCenter, Math.min(1, delta * 4.5));
      }
      this.cameraHeight += (this.targetCameraHeight - this.cameraHeight) * Math.min(1, delta * 6.0);

      this.updateCameraTransform();

      // Animation subtile des balises flottantes
      this.pins.forEach((p, idx) => {
        const bounce = Math.sin(time * 0.003 + idx) * 0.4;
        p.pinMesh.position.y = 8.5 + bounce;
        p.pinMesh.rotation.y += delta * 1.0;
      });

      this.renderer.render(this.scene, this.camera);
    };

    this.animId = requestAnimationFrame(animate);
  }
}

export const ouagaMap = new OuagaMap3D();
