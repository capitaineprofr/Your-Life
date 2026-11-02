// --- Carte Urbaine 3D Interactive de Ouagadougou (Three.js / WebGL) ---
// Modélisation 3D aérienne stylisée de la capitale du Burkina Faso.
// Intègre les vrais axes, ronds-points, quartiers emblématiques et les bâtiments 3D Kenney City.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Données réelles et culturelles des grands quartiers de Ouagadougou
 */
export const OUAGA_DISTRICTS = [
  {
    id: 'koulouba',
    name: 'Koulouba & Place de la Nation',
    tag: 'Centre Historique',
    color: '#f59e0b',
    coords: { x: 0, z: 0 },
    icon: '🏛️',
    description: "Le cœur vibrant de Ouaga. Abrite la célèbre Place de la Nation, le Palais de Justice et les grands ministères. Lieu de tous les rassemblements civiques.",
    activities: ["Institutions & Démarches", "Monuments Historiques", "Bureaux Administratifs"],
    taxiFare: 300,
    cameraOffset: { x: 0, y: 35, z: 35 }
  },
  {
    id: 'kwame_nkrumah',
    name: 'Avenue Kwame Nkrumah',
    tag: 'Affaires & Sorties',
    color: '#3b82f6',
    coords: { x: 28, z: -16 },
    icon: '☕',
    description: "L'artère légendaire de la capitale bordée de terrasses de cafés, d'hôtels prestigieux, d'agences de voyage et de banques. Pleine de vie jour et nuit.",
    activities: ["Cafés & Restaurants", "Terrasses Sahéliennes", "Boutiques Chic"],
    taxiFare: 400,
    cameraOffset: { x: 28, y: 32, z: 18 }
  },
  {
    id: 'rood_woko',
    name: 'Grand Marché (Rood Woko)',
    tag: 'Commerce & Artisanat',
    color: '#10b981',
    coords: { x: -26, z: 14 },
    icon: '🛍️',
    description: "Le poumon économique de Ouagadougou. Des milliers d'étals colorés d'épices, de tissus Faso Dan Fani tissés main, de mangues séchées et d'artisanat du bronze.",
    activities: ["Négociation & Commerce", "Tissus Faso Dan Fani", "Artisanat d'Art"],
    taxiFare: 350,
    cameraOffset: { x: -26, y: 32, z: 46 }
  },
  {
    id: 'ouaga_2000',
    name: 'Ouaga 2000 & Échangeur Sud',
    tag: 'Quartier Moderne & Diplomatique',
    color: '#8b5cf6',
    coords: { x: 34, z: 48 },
    icon: '🏢',
    description: "Le quartier moderne d'affaires au sud : larges avenues arborées, tours de bureaux, résidences d'ambassades, le Palais des Congrès et le Monument des Martyrs.",
    activities: ["Sièges d'Entreprises", "Ambassades", "Résidences de Prestige"],
    taxiFare: 600,
    cameraOffset: { x: 34, y: 45, z: 85 }
  },
  {
    id: 'gounghin_pissy',
    name: 'Gounghin & Pissy',
    tag: 'Quartiers Populaires & Ateliers',
    color: '#ec4899',
    coords: { x: -44, z: -28 },
    icon: '🛠️',
    description: "Quartiers vivants à l'ouest, connus pour leurs ateliers mécaniques créatifs, leurs maquis conviviaux, leurs menuiseries et la musique en terrasse.",
    activities: ["Ateliers Mécaniques", "Maquis Traditionnels", "Vie de Quartier"],
    taxiFare: 400,
    cameraOffset: { x: -44, y: 34, z: 5 }
  },
  {
    id: 'tanghin',
    name: 'Barrage & Berges de Tanghin',
    tag: 'Zone Verte & Détente',
    color: '#06b6d4',
    coords: { x: -12, z: -56 },
    icon: '🌊',
    description: "Le poumon vert au nord autour des retenues d'eau du barrage de Tanghin. Maraîchage urbain, balades au coucher de soleil et fraîcheur bienvenue.",
    activities: ["Maraîchage & Fraîcheur", "Balades au Crépuscule", "Points de Rencontre"],
    taxiFare: 500,
    cameraOffset: { x: -12, y: 36, z: -20 }
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
    this.cameraDistance = 110;
    this.cameraAngle = Math.PI / 4;
    this.cameraPitch = 0.85;

    this.onTravelCallback = null;
  }

  init(options = {}) {
    this.onTravelCallback = options.onTravel || null;
    this.buildDOM();
    this.initThree();
    this.buildCityTerrain();
    this.buildRoadNetwork();
    this.loadCityBuildings();
    this.buildDistrictMarkers();
    this.bindEvents();
  }

  buildDOM() {
    // 1. Conteneur Overlay Plein Écran
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
              <h1 class="map-city-title">CARTE DE OUAGADOUGOU</h1>
              <span class="map-city-coords">Burkina Faso • 12°22'N 1°31'W • Harmattan</span>
            </div>
          </div>
          <div class="map-weather-pill">
            <span class="weather-temp">34°C</span>
            <span class="weather-condition">Ensoleillé • Poussière Dorée</span>
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
    this.scene.background = new THREE.Color(0xdbeafe); // Ciel sahélien clair et chaud
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0035);

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
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.85); // Ambiance chaude
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.3);
    sunLight.position.set(60, 100, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    const d = 90;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x9a3412, 0.5);
    this.scene.add(hemiLight);
  }

  buildCityTerrain() {
    // 1. Sol Latéritique de Ouagadougou (Terre rouge-orangée de savane)
    const groundGeo = new THREE.PlaneGeometry(280, 280, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);

    // Variation douce de relief latéritique
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dist = Math.sqrt(vx * vx + vz * vz);
      const hill = Math.sin(vx * 0.04) * Math.cos(vz * 0.04) * 1.2;
      pos.setY(i, hill);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({
      color: 0xc2410c, // Latérite rouge burkinabè
      roughness: 0.95
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Le Barrage de Tanghin (Retenue d'eau bleu turquoise)
    const lakeGeo = new THREE.PlaneGeometry(75, 40, 16, 16);
    lakeGeo.rotateX(-Math.PI / 2);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.88
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.position.set(-14, 0.4, -58);
    this.scene.add(lake);

    // Berges verdoyantes de maraîchage de Tanghin
    const parkGeo = new THREE.RingGeometry(22, 38, 24);
    parkGeo.rotateX(-Math.PI / 2);
    const parkMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const park = new THREE.Mesh(parkGeo, parkMat);
    park.position.set(-14, 0.45, -58);
    this.scene.add(park);
  }

  buildRoadNetwork() {
    const roadsGroup = new THREE.Group();

    // Ronds-points emblématiques de Ouaga
    const rCenters = [
      { x: 0, z: 0, r: 12, name: 'Place de la Nation' },
      { x: 28, z: -16, r: 9, name: 'Rond-Point Nations Unies' },
      { x: 34, z: 48, r: 11, name: 'Échangeur Ouaga 2000' },
      { x: -44, z: -28, r: 9, name: 'Échangeur de l’Ouest' }
    ];

    rCenters.forEach(rc => {
      // Anneau de bitume gris
      const rGeo = new THREE.RingGeometry(rc.r - 3.5, rc.r, 32);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const ringMesh = new THREE.Mesh(rGeo, rMat);
      ringMesh.position.set(rc.x, 0.35, rc.z);
      roadsGroup.add(ringMesh);

      // Terre-plein central vert avec gazon et monument
      const cGeo = new THREE.CircleGeometry(rc.r - 3.6, 28);
      cGeo.rotateX(-Math.PI / 2);
      const cMat = new THREE.MeshLambertMaterial({ color: 0x16a34a });
      const centerMesh = new THREE.Mesh(cGeo, cMat);
      centerMesh.position.set(rc.x, 0.4, rc.z);
      roadsGroup.add(centerMesh);

      // Obélisque ou monument symbolique au centre
      const obeliskGeo = new THREE.CylinderGeometry(0.5, 1.2, 8, 8);
      const obeliskMat = new THREE.MeshLambertMaterial({ color: 0xfef08a });
      const obelisk = new THREE.Mesh(obeliskGeo, obeliskMat);
      obelisk.position.set(rc.x, 4.4, rc.z);
      obelisk.castShadow = true;
      roadsGroup.add(obelisk);
    });

    // Grandes Avenues & Boulevards Bitumés
    const roadSegments = [
      // Axe Nord-Sud principal reliant Koulouba à Ouaga 2000
      { x1: 0, z1: 0, x2: 34, z2: 48, width: 4.5 },
      // Avenue Kwame Nkrumah reliant Koulouba à l'Est
      { x1: 0, z1: 0, x2: 28, z2: -16, width: 4.5 },
      // Boulevard Ouest vers Gounghin / Pissy
      { x1: 0, z1: 0, x2: -44, z2: -28, width: 4 },
      // Route du Nord vers Tanghin & Barrage
      { x1: 0, z1: 0, x2: -14, z2: -58, width: 4 },
      // Avenue vers Grand Marché Rood Woko
      { x1: 0, z1: 0, x2: -26, z2: 14, width: 4 },
      // Rocade Est
      { x1: 28, z1: -16, x2: 34, z2: 48, width: 3.5 }
    ];

    roadSegments.forEach(seg => {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);

      const rGeo = new THREE.PlaneGeometry(seg.width, length);
      rGeo.rotateX(-Math.PI / 2);
      rGeo.rotateY(angle);

      const rMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const mesh = new THREE.Mesh(rGeo, rMat);
      mesh.position.set((seg.x1 + seg.x2) / 2, 0.32, (seg.z1 + seg.z2) / 2);
      roadsGroup.add(mesh);
    });

    this.scene.add(roadsGroup);
  }

  loadCityBuildings() {
    const glbList = [
      'building-a.glb', 'building-b.glb', 'building-c.glb', 'building-d.glb',
      'building-e.glb', 'building-f.glb', 'building-g.glb', 'building-h.glb',
      'building-skyscraper-a.glb', 'building-skyscraper-b.glb', 'building-skyscraper-c.glb',
      'low-detail-building-a.glb', 'low-detail-building-b.glb'
    ];

    // Grille d'implantation des bâtiments par quartier
    const buildingPlacements = [
      // 1. Koulouba (Centre administratif)
      { file: 'building-a.glb', x: -8, z: -8, rot: 0, scale: 2.2 },
      { file: 'building-b.glb', x: 8, z: -8, rot: Math.PI / 2, scale: 2.2 },
      { file: 'building-c.glb', x: -8, z: 8, rot: -Math.PI / 2, scale: 2.0 },
      { file: 'building-d.glb', x: 8, z: 8, rot: Math.PI, scale: 2.0 },

      // 2. Avenue Kwame Nkrumah (Hôtels & Banques)
      { file: 'building-e.glb', x: 22, z: -10, rot: -0.4, scale: 2.3 },
      { file: 'building-f.glb', x: 32, z: -12, rot: 0.6, scale: 2.3 },
      { file: 'building-g.glb', x: 26, z: -24, rot: 1.2, scale: 2.2 },
      { file: 'building-skyscraper-a.glb', x: 36, z: -22, rot: 0, scale: 2.0 },

      // 3. Grand Marché Rood Woko (Commerces & Échoppes)
      { file: 'building-h.glb', x: -22, z: 8, rot: 0.3, scale: 2.0 },
      { file: 'building-b.glb', x: -30, z: 12, rot: 1.5, scale: 1.9 },
      { file: 'building-c.glb', x: -24, z: 20, rot: -1.0, scale: 2.0 },
      { file: 'building-d.glb', x: -32, z: 22, rot: 0, scale: 1.9 },

      // 4. Ouaga 2000 (Gratte-ciels, Ministères & Ambassades)
      { file: 'building-skyscraper-a.glb', x: 28, z: 42, rot: 0.2, scale: 2.5 },
      { file: 'building-skyscraper-b.glb', x: 38, z: 44, rot: -0.5, scale: 2.5 },
      { file: 'building-skyscraper-c.glb', x: 32, z: 54, rot: 0.8, scale: 2.5 },
      { file: 'building-skyscraper-a.glb', x: 42, z: 52, rot: -0.2, scale: 2.4 },

      // 5. Gounghin & Pissy (Maisons et Ateliers)
      { file: 'low-detail-building-a.glb', x: -40, z: -22, rot: 0.4, scale: 2.1 },
      { file: 'low-detail-building-b.glb', x: -48, z: -26, rot: -0.8, scale: 2.1 },
      { file: 'building-e.glb', x: -42, z: -34, rot: 1.1, scale: 2.0 },
      { file: 'building-f.glb', x: -50, z: -32, rot: 0, scale: 2.0 },

      // 6. Tanghin (Bord du barrage)
      { file: 'building-g.glb', x: -6, z: -48, rot: 0, scale: 1.9 },
      { file: 'building-h.glb', x: -22, z: -46, rot: 0.7, scale: 1.9 },
      { file: 'low-detail-building-a.glb', x: -4, z: -68, rot: -0.5, scale: 1.9 }
    ];

    const modelCache = new Map();

    buildingPlacements.forEach(bp => {
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
          err => {
            // Repli cubique discret si un fichier précis est manquant
            this.createFallbackBuilding(bp);
          }
        );
      }
    });
  }

  instantiateBuilding(cloneScene, bp) {
    cloneScene.position.set(bp.x, 0.4, bp.z);
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
    mesh.position.set(bp.x, 4 * bp.scale, bp.z);
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

      // Socle lumineux au sol
      const baseGeo = new THREE.RingGeometry(2.5, 4.0, 24);
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

      // Tige verticale
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

    // Mise à jour de l'UI latérale
    document.querySelectorAll('.district-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === district.id);
    });
    this.updateCardUI();

    // Animation de la caméra vers le quartier
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
    // Bouton Fermeture
    const btnClose = document.getElementById('btn-close-map');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    // Bouton Voyager
    const btnTravel = document.getElementById('btn-travel-district');
    if (btnTravel) {
      btnTravel.addEventListener('click', () => {
        if (this.onTravelCallback) {
          this.onTravelCallback(this.activeDistrict);
        }
        this.close();
      });
    }

    // Boutons de contrôle de caméra
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
        this.cameraDistance = 110;
        this.cameraAngle = Math.PI / 4;
        this.cameraPitch = 0.85;
        this.updateCameraOrbit();
      });
    }

    // Interaction Souris sur Canvas (Orbit & Sélection 3D)
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

      // Raycasting sur les balises de quartiers
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

    // Clic 3D sur un point d'intérêt
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

    // Raccourci clavier Échap & M
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

    // Resize
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

      // 1. Interpolation fluide de la caméra
      this.camera.position.lerp(this.targetCameraPos, Math.min(1, delta * 3.5));
      this.camera.lookAt(this.targetCameraLook);

      // 2. Animation flottante des balises 3D
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

// Instance globale unique
export const ouagaMap = new OuagaMap3D();
