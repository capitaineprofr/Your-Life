// --- Carte Urbaine 3D Interactive de Ouagadougou (Three.js / WebGL) ---
// Calquée à 100% sur la carte réelle de Ouagadougou (Burkina Faso) via projection cartographique
// OpenStreetMap haute définition, coordonnées GPS réelles et modèles 3D Kenney City.

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
 */
export const OUAGA_DISTRICTS = [
  {
    id: 'koulouba',
    name: 'Koulouba & Place de la Nation',
    tag: 'Centre Historique & Administratif',
    color: '#f59e0b',
    coords: geoToWorld(12.3647, -1.5283), // {-22.2, -6.0}
    icon: '🏛️',
    description: "Le centre civique et historique de Ouagadougou. Abrite la vaste Place de la Nation, le Palais de Justice, l'État-Major et les grands ministères.",
    activities: ["Institutions Publiques", "Monuments Historiques", "Bureaux Administratifs"],
    taxiFare: 300,
    cameraOffset: { x: 0, y: 35, z: 35 }
  },
  {
    id: 'kwame_nkrumah',
    name: 'Avenue Kwame Nkrumah',
    tag: 'Affaires & Sorties',
    color: '#3b82f6',
    coords: geoToWorld(12.3618, -1.5168), // {-1.3, -0.6}
    icon: '☕',
    description: "L'artère prestigieuse reliant le centre aux quartiers d'affaires. Célèbre pour ses banques, compagnies aériennes, terrasses de cafés animées et vie nocturne.",
    activities: ["Cafés & Restaurants", "Terrasses Sahéliennes", "Bureaux & Agences"],
    taxiFare: 400,
    cameraOffset: { x: 0, y: 32, z: 30 }
  },
  {
    id: 'rood_woko',
    name: 'Grand Marché (Rood Woko)',
    tag: 'Poumon Économique & Artisanat',
    color: '#10b981',
    coords: geoToWorld(12.3688, -1.5222), // {-11.1, -13.7}
    icon: '🛍️',
    description: "Le plus grand marché du pays. Une effervescence commerciale unique : tissus Faso Dan Fani tissés main, maroquinerie, épices, orfèvrerie et bronzes d'art.",
    activities: ["Négociation & Commerce", "Tissus Faso Dan Fani", "Artisanat d'Art"],
    taxiFare: 350,
    cameraOffset: { x: 0, y: 32, z: 30 }
  },
  {
    id: 'ouaga_2000',
    name: 'Ouaga 2000 & Monument des Martyrs',
    tag: 'Quartier Moderne & Diplomatique',
    color: '#8b5cf6',
    coords: geoToWorld(12.3182, -1.5084), // {13.8, 80.0}
    icon: '🏢',
    description: "Au sud, le quartier moderne d'affaires : tours de bureaux, ambassades internationales, le Monument des Martyrs, le Palais des Congrès et les hôtels 5 étoiles.",
    activities: ["Sièges d'Entreprises", "Ambassades", "Résidences de Prestige"],
    taxiFare: 600,
    cameraOffset: { x: 0, y: 45, z: 45 }
  },
  {
    id: 'gounghin_pissy',
    name: 'Gounghin & Pissy',
    tag: 'Quartiers Populaires & Ateliers',
    color: '#ec4899',
    coords: geoToWorld(12.3585, -1.5521), // {-65.5, 5.5}
    icon: '🛠️',
    description: "Le secteur Ouest vibrant, le long des rails et de la route de Bobo-Dioulasso. Réputé pour ses ateliers de mécanique créative, ses menuiseries et ses maquis chaleureux.",
    activities: ["Ateliers Mécaniques", "Maquis Traditionnels", "Vie Populaire"],
    taxiFare: 400,
    cameraOffset: { x: 0, y: 34, z: 32 }
  },
  {
    id: 'tampouy',
    name: 'Tampouy & Échangeur du Nord',
    tag: 'Pôle Commercial du Nord',
    color: '#eab308',
    coords: geoToWorld(12.3925, -1.5458), // {-54.0, -57.8}
    icon: '🚚',
    description: "Quartier dynamique au nord-ouest au-delà des rails, traversé par la route nationale vers le nord. Carrefour d'échanges, marchés locaux et commerces animés.",
    activities: ["Commerces Locaux", "Carrefour Routier", "Restauration Rapide"],
    taxiFare: 450,
    cameraOffset: { x: 0, y: 34, z: 32 }
  },
  {
    id: 'tanghin',
    name: 'Barrages & Maraîchage de Tanghin',
    tag: 'Zone Lacustre & Fraîcheur',
    color: '#06b6d4',
    coords: geoToWorld(12.3965, -1.5228), // {-12.2, -65.3}
    icon: '🌊',
    description: "Les trois retenues d'eau du barrage de Tanghin au nord de la capitale. Maraîchage urbain, berges arborées, fraîcheur et balades au crépuscule.",
    activities: ["Fraîcheur & Maraîchage", "Balades au Couchant", "Espaces de Détente"],
    taxiFare: 500,
    cameraOffset: { x: 0, y: 36, z: 32 }
  },
  {
    id: 'bangr_weogo',
    name: 'Forêt Classée de Bangr Weogo',
    tag: 'Poumon Vert & Réserve Naturelle',
    color: '#15803d',
    coords: geoToWorld(12.3892, -1.4885), // {50.3, -51.7}
    icon: '🌳',
    description: "La célèbre 'forêt sacrée' au cœur de la ville (240 hectares). Vaste réserve naturelle peuplée de grands arbres de savane, faune protégée et sentiers ombragés.",
    activities: ["Balades Écologiques", "Faune & Flore", "Pique-Nique Sahélien"],
    taxiFare: 500,
    cameraOffset: { x: 0, y: 38, z: 35 }
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
    this.targetCameraPos = new THREE.Vector3(0, 75, 80);
    this.targetCameraLook = new THREE.Vector3(0, 0, 0);

    this.pins = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDragging = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.cameraDistance = 115;
    this.cameraAngle = Math.PI / 4;
    this.cameraPitch = 0.82;

    this.groundMesh = null;
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
        <!-- Barre Supérieure de la Ville -->
        <header class="map-topbar">
          <div class="map-city-identity">
            <span class="flag-icon">🇧🇫</span>
            <div>
              <h1 class="map-city-title">CARTE OFFICIELLE DE OUAGADOUGOU</h1>
              <span class="map-city-coords">Burkina Faso • Cartographie Réelle OpenStreetMap • Harmattan</span>
            </div>
          </div>
          <div class="map-weather-pill">
            <span class="weather-temp">34°C</span>
            <span class="weather-condition">Ensoleillé • Brise d'Harmattan</span>
          </div>
          <button id="btn-close-map" class="btn-close-map" title="Fermer la carte [Échap]">
            ✕ Retour au Domicile
          </button>
        </header>

        <!-- Canvas 3D de la Carte -->
        <canvas id="ouaga-map-canvas" class="ouaga-map-canvas"></canvas>

        <!-- Contrôles Flottants de Caméra -->
        <div class="map-camera-controls">
          <button id="btn-map-zoom-in" class="map-ctrl-btn" title="Zoomer">+</button>
          <button id="btn-map-zoom-out" class="map-ctrl-btn" title="Dézoomer">−</button>
          <button id="btn-map-recenter" class="map-ctrl-btn" title="Vue d'ensemble">Vue Globale</button>
        </div>

        <!-- Panneau Latéral Droit : Détails & Voyage -->
        <aside class="map-sidebar">
          <div class="sidebar-header-box">
            <h2 class="sidebar-map-title">Destinations & Quartiers</h2>
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
    this.scene.background = new THREE.Color(0xdbeafe);
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0028);

    // Caméra Perspective Aérienne
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    this.updateCameraOrbit();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lumière Sahélienne
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.9);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    sunLight.position.set(60, 110, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 350;
    const d = 110;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x9a3412, 0.5);
    this.scene.add(hemiLight);
  }

  /**
   * Construit le sol 3D texturé à partir des véritables tuiles OpenStreetMap de Ouagadougou
   */
  buildRealMapTerrain() {
    const groundGeo = new THREE.PlaneGeometry(MAP_WORLD_SIZE, MAP_WORLD_SIZE, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);

    // Matériau initial avec latérite burkinabè
    const groundMat = new THREE.MeshLambertMaterial({
      color: 0xd97706,
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
        this.groundMesh.material.color.setHex(0xffffff); // Affichage en pleine couleur
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
      compositeCanvas.width = 768; // 3 colonnes de 256px
      compositeCanvas.height = 768; // 3 lignes de 256px
      const ctx = compositeCanvas.getContext('2d');

      // Fond de base chaleureux en attendant le dessin
      ctx.fillStyle = '#e2c59d';
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
            img.onerror = () => resolve(); // En cas d'erreur locale, continuer
            img.src = url;
          });
          tilePromises.push(p);
        }
      }

      await Promise.all(tilePromises);

      // Filtre subtil doré sahélien pour harmoniser les contrastes de la carte
      ctx.fillStyle = 'rgba(217, 119, 6, 0.05)';
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
    // Liste des bâtiments positionnés sur les quartiers réels
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

      // 5. Gounghin & Pissy (Ateliers et maisons le long de la route de Bobo)
      { file: 'low-detail-building-a.glb', coords: geoToWorld(12.3600, -1.5540), scale: 2.1, rot: 0.4 },
      { file: 'low-detail-building-b.glb', coords: geoToWorld(12.3570, -1.5500), scale: 2.1, rot: -0.8 },
      { file: 'building-e.glb', coords: geoToWorld(12.3590, -1.5560), scale: 2.0, rot: 1.1 },

      // 6. Tampouy (Nord-Ouest le long de l'Échangeur du Nord)
      { file: 'low-detail-building-c.glb', coords: geoToWorld(12.3940, -1.5470), scale: 2.0, rot: 0.5 },
      { file: 'low-detail-building-d.glb', coords: geoToWorld(12.3910, -1.5440), scale: 2.0, rot: -0.3 },

      // 7. Tanghin (Bord des barrages)
      { file: 'building-g.glb', coords: geoToWorld(12.3980, -1.5240), scale: 1.9, rot: 0 },
      { file: 'building-h.glb', coords: geoToWorld(12.3950, -1.5210), scale: 1.9, rot: 0.7 }
    ];

    const modelCache = new Map();

    placements.forEach(bp => {
      const glbUrl = `assets/city/glb/${bp.file}`;

      if (modelCache.has(glbUrl)) {
        this.instantiateBuilding(modelCache.get(glbUrl).clone(), bp);
      } else {
        this.loader.load(
          glbUrl,
          gltf => {
            modelCache.set(glbUrl, gltf.scene);
            this.instantiateBuilding(gltf.scene.clone(), bp);
          },
          undefined,
          () => {
            this.createFallbackBuilding(bp);
          }
        );
      }
    });
  }

  instantiateBuilding(cloneScene, bp) {
    cloneScene.position.set(bp.coords.x, 0.4, bp.coords.z);
    cloneScene.rotation.y = bp.rot;
    cloneScene.scale.set(bp.scale, bp.scale, bp.scale);

    cloneScene.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    this.scene.add(cloneScene);
  }

  createFallbackBuilding(bp) {
    const geo = new THREE.BoxGeometry(6 * bp.scale, 8 * bp.scale, 6 * bp.scale);
    const mat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bp.coords.x, 4 * bp.scale, bp.coords.z);
    mesh.rotation.y = bp.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  buildDistrictMarkers() {
    OUAGA_DISTRICTS.forEach(d => {
      const pinGroup = new THREE.Group();
      pinGroup.position.set(d.coords.x, 0, d.coords.z);
      pinGroup.userData = { district: d };

      // Socle lumineux circulaire au sol
      const baseGeo = new THREE.RingGeometry(2.5, 4.2, 24);
      baseGeo.rotateX(-Math.PI / 2);
      const baseMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color),
        side: THREE.DoubleSide
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.5;
      pinGroup.add(baseMesh);

      // Balise 3D flottante (Losange Sims doré / coloré)
      const pinGeo = new THREE.OctahedronGeometry(1.8, 0);
      const pinMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(d.color),
        emissive: new THREE.Color(d.color),
        emissiveIntensity: 0.35,
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
          <span class="district-icon">${d.icon}</span>
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

    // Animation fluide de la caméra vers le quartier
    this.targetCameraLook.set(district.coords.x, 2, district.coords.z);
    this.targetCameraPos.set(
      district.coords.x + district.cameraOffset.x,
      district.cameraOffset.y,
      district.coords.z + district.cameraOffset.z
    );
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
    const btnClose = document.getElementById('btn-close-map');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    const btnTravel = document.getElementById('btn-travel-district');
    if (btnTravel) {
      btnTravel.addEventListener('click', () => {
        if (this.onTravelCallback) {
          this.onTravelCallback(this.activeDistrict);
        }
        this.close();
      });
    }

    const btnZoomIn = document.getElementById('btn-map-zoom-in');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        this.cameraDistance = Math.max(30, this.cameraDistance - 18);
        this.updateCameraOrbit();
      });
    }

    const btnZoomOut = document.getElementById('btn-map-zoom-out');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        this.cameraDistance = Math.min(180, this.cameraDistance + 18);
        this.updateCameraOrbit();
      });
    }

    const btnRecenter = document.getElementById('btn-map-recenter');
    if (btnRecenter) {
      btnRecenter.addEventListener('click', () => {
        this.targetCameraLook.set(0, 0, 0);
        this.cameraDistance = 115;
        this.cameraAngle = Math.PI / 4;
        this.cameraPitch = 0.82;
        this.updateCameraOrbit();
      });
    }

    // Interaction Souris sur Canvas
    this.canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', e => {
      if (!this.isOpen) return;

      if (this.isDragging) {
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.cameraAngle -= dx * 0.006;
        this.cameraPitch = Math.max(0.3, Math.min(1.3, this.cameraPitch + dy * 0.006));
        this.updateCameraOrbit();
        this.prevMousePos = { x: e.clientX, y: e.clientY };
      }

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.cameraDistance = Math.max(30, Math.min(190, this.cameraDistance + e.deltaY * 0.08));
      this.updateCameraOrbit();
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

  updateCameraOrbit() {
    const cx = this.targetCameraLook.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const cy = this.targetCameraLook.y + Math.sin(this.cameraPitch) * this.cameraDistance;
    const cz = this.targetCameraLook.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * this.cameraDistance;
    this.targetCameraPos.set(cx, cy, cz);
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

      // Interpolation fluide de la caméra
      this.camera.position.lerp(this.targetCameraPos, Math.min(1, delta * 3.5));
      this.camera.lookAt(this.targetCameraLook);

      // Animation flottante des balises 3D
      this.pins.forEach((p, idx) => {
        const bounce = Math.sin(time * 0.003 + idx) * 0.5;
        p.pinMesh.position.y = 8.5 + bounce;
        p.pinMesh.rotation.y += delta * 1.2;
      });

      this.renderer.render(this.scene, this.camera);
    };

    this.animId = requestAnimationFrame(animate);
  }
}

export const ouagaMap = new OuagaMap3D();
