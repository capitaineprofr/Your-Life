// --- Modèle Humanoïde 3D d'Avatar Bedrock & Animations (Three.js) ---
// Rendu 3D complet avec textures personnalisées, coiffures burkinabè, tenues Faso Dan Fani et animations

import * as THREE from 'three';

const S = 1 / 16; // 1 unité grille = 16 voxels Minecraft

/**
 * Génère une texture de visage expressive et dynamique
 */
function createFaceTexture(skinColor, eyeColor = '#1e293b') {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Fond couleur de peau
  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, 64, 64);

  // Yeux expressifs
  // Oeil gauche
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(14, 26, 12, 10);
  ctx.fillStyle = eyeColor;
  ctx.fillRect(18, 28, 7, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(18, 28, 3, 3); // Reflet

  // Oeil droit
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(38, 26, 12, 10);
  ctx.fillStyle = eyeColor;
  ctx.fillRect(39, 28, 7, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(39, 28, 3, 3); // Reflet

  // Sourcils
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(14, 21, 13, 3);
  ctx.fillRect(37, 21, 13, 3);

  // Sourire chaleureux
  ctx.strokeStyle = '#3b1c06';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(32, 44, 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

/**
 * Génère une texture textile Faso Dan Fani pour le torse
 */
function createTorsoTexture(baseColor = '#d97706', style = 'faso_dan_fani') {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 64, 64);

  if (style === 'faso_dan_fani') {
    // Rayures tissées traditionnelles Faso Dan Fani
    const stripes = ['#b91c1c', '#eab308', '#15803d', '#ffffff', '#1e293b'];
    for (let x = 6; x < 58; x += 10) {
      ctx.fillStyle = stripes[(x / 10 | 0) % stripes.length];
      ctx.fillRect(x, 0, 4, 64);
    }
    // Col brodé
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(32, 18);
    ctx.lineTo(42, 0);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'boubou') {
    // Grand boubou brodé d'or
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(32, 14, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(32, 14, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export class Avatar3D {
  constructor(config = {}) {
    this.config = {
      skin: config.skin || '#8d5524',
      hairStyle: config.hairStyle || 'afro',
      hairColor: config.hairColor || '#1a110b',
      outfitStyle: config.outfitStyle || 'faso_dan_fani',
      shirtColor: config.shirtColor || '#d97706',
      pantsColor: config.pantsColor || '#1e293b'
    };

    this.group = new THREE.Group();
    this.group.name = 'avatar_root';

    this.walkCycle = 0;
    this.isMoving = false;
    this.targetRotationY = 0;

    this.buildMesh();
  }

  buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.skin),
      roughness: 0.8,
      metalness: 0.05
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.hairColor),
      roughness: 0.9,
      metalness: 0.05
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.pantsColor),
      roughness: 0.85,
      metalness: 0.05
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Sneakers blanches
      roughness: 0.6
    });

    // 1. Bassin & Torso (8x12x4)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 12 * S, 0);

    const torsoGeo = new THREE.BoxGeometry(8 * S, 12 * S, 4 * S);
    const torsoTex = createTorsoTexture(this.config.shirtColor, this.config.outfitStyle);
    const torsoMat = new THREE.MeshStandardMaterial({
      map: torsoTex,
      roughness: 0.8,
      metalness: 0.05
    });
    this.torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    this.torsoMesh.position.set(0, 6 * S, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoGroup.add(this.torsoMesh);

    // 2. Tête (8x8x8) avec pivot au cou
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 12 * S, 0);

    const faceTex = createFaceTexture(this.config.skin);
    const headMatArray = [
      skinMat, // East
      skinMat, // West
      hairMat, // Up
      skinMat, // Down
      skinMat, // South
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }) // North (visage)
    ];

    const headGeo = new THREE.BoxGeometry(8 * S, 8 * S, 8 * S);
    this.headMesh = new THREE.Mesh(headGeo, headMatArray);
    this.headMesh.position.set(0, 4 * S, 0);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headGroup.add(this.headMesh);

    // Coiffure 3D
    this.buildHair(hairMat);
    this.torsoGroup.add(this.headGroup);

    // 3. Bras Gauche (4x12x4) avec pivot à l'épaule
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-6 * S, 11 * S, 0);
    const armGeo = new THREE.BoxGeometry(4 * S, 12 * S, 4 * S);
    this.leftArmMesh = new THREE.Mesh(armGeo, skinMat);
    this.leftArmMesh.position.set(0, -5 * S, 0);
    this.leftArmMesh.castShadow = true;
    this.leftArmGroup.add(this.leftArmMesh);
    this.torsoGroup.add(this.leftArmGroup);

    // 4. Bras Droit (4x12x4) avec pivot à l'épaule
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(6 * S, 11 * S, 0);
    this.rightArmMesh = new THREE.Mesh(armGeo, skinMat);
    this.rightArmMesh.position.set(0, -5 * S, 0);
    this.rightArmMesh.castShadow = true;
    this.rightArmGroup.add(this.rightArmMesh);
    this.torsoGroup.add(this.rightArmGroup);

    // 5. Jambe Gauche (4x12x4) avec pivot à la hanche
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-2 * S, 12 * S, 0);
    const legGeo = new THREE.BoxGeometry(4 * S, 10 * S, 4 * S);
    this.leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    this.leftLegMesh.position.set(0, -5 * S, 0);
    this.leftLegMesh.castShadow = true;
    this.leftLegGroup.add(this.leftLegMesh);

    // Chaussure gauche
    const shoeGeo = new THREE.BoxGeometry(4.2 * S, 2 * S, 4.4 * S);
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(0, -11 * S, -0.2 * S);
    leftShoe.castShadow = true;
    this.leftLegGroup.add(leftShoe);
    this.group.add(this.leftLegGroup);

    // 6. Jambe Droite (4x12x4) avec pivot à la hanche
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(2 * S, 12 * S, 0);
    this.rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    this.rightLegMesh.position.set(0, -5 * S, 0);
    this.rightLegMesh.castShadow = true;
    this.rightLegGroup.add(this.rightLegMesh);

    // Chaussure droite
    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0, -11 * S, -0.2 * S);
    rightShoe.castShadow = true;
    this.rightLegGroup.add(rightShoe);
    this.group.add(this.rightLegGroup);

    this.group.add(this.torsoGroup);
  }

  buildHair(hairMat) {
    const style = this.config.hairStyle;

    if (style === 'afro') {
      // Volume Afro dense et stylisé en 3D
      const afroGeo = new THREE.BoxGeometry(9.4 * S, 9 * S, 9.4 * S);
      const afro = new THREE.Mesh(afroGeo, hairMat);
      afro.position.set(0, 4.8 * S, 0);
      afro.castShadow = true;
      this.headGroup.add(afro);
    } else if (style === 'dreads') {
      // Casque supérieur + mèches tressées retombantes
      const baseGeo = new THREE.BoxGeometry(9 * S, 4 * S, 9 * S);
      const base = new THREE.Mesh(baseGeo, hairMat);
      base.position.set(0, 7 * S, 0);
      this.headGroup.add(base);

      // Mèches le long du visage et du dos
      const lockGeo = new THREE.BoxGeometry(1.6 * S, 7 * S, 1.6 * S);
      const positions = [
        [-4.2 * S, 2 * S, 0],
        [4.2 * S, 2 * S, 0],
        [-3 * S, 2 * S, 4.2 * S],
        [3 * S, 2 * S, 4.2 * S],
        [0, 2 * S, 4.2 * S]
      ];
      for (const pos of positions) {
        const lock = new THREE.Mesh(lockGeo, hairMat);
        lock.position.set(...pos);
        lock.castShadow = true;
        this.headGroup.add(lock);
      }
    } else if (style === 'foulard') {
      // Foulard traditionnel ouagais noué
      const foulardMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.config.shirtColor),
        roughness: 0.8
      });
      const foulardGeo = new THREE.BoxGeometry(9.4 * S, 8.5 * S, 9.4 * S);
      const foulard = new THREE.Mesh(foulardGeo, foulardMat);
      foulard.position.set(0, 4.8 * S, 0);
      foulard.castShadow = true;

      // Noeud arrière
      const knotGeo = new THREE.BoxGeometry(3 * S, 3 * S, 3 * S);
      const knot = new THREE.Mesh(knotGeo, foulardMat);
      knot.position.set(0, 6 * S, 5 * S);
      this.headGroup.add(foulard);
      this.headGroup.add(knot);
    } else {
      // Dégradé court net
      const capGeo = new THREE.BoxGeometry(8.6 * S, 4 * S, 8.6 * S);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.set(0, 6.8 * S, 0);
      this.headGroup.add(cap);
    }
  }

  setDirection(direction) {
    // Conversion direction boussole en radians (Three.js Y-rotation)
    const angleMap = {
      SE: 0,
      SW: Math.PI * 0.5,
      NW: Math.PI,
      NE: -Math.PI * 0.5
    };
    if (angleMap[direction] !== undefined) {
      this.targetRotationY = angleMap[direction];
    }
  }

  update(delta, isMoving = false, speed = 1) {
    this.isMoving = isMoving;

    // Interpolation fluide de la rotation
    let diff = this.targetRotationY - this.group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, delta * 12);

    if (this.isMoving) {
      this.walkCycle += delta * 11 * speed;
      const angle = Math.sin(this.walkCycle) * 0.65;

      // Balancement alterné des jambes et des bras
      this.leftLegGroup.rotation.x = angle;
      this.rightLegGroup.rotation.x = -angle;

      this.leftArmGroup.rotation.x = -angle * 0.85;
      this.rightArmGroup.rotation.x = angle * 0.85;

      // Léger rebond naturel de la tête et du torse
      const bounce = Math.abs(Math.sin(this.walkCycle)) * 0.04;
      this.torsoGroup.position.y = 12 * S + bounce;
    } else {
      // Repos / Respiration fluide
      this.walkCycle += delta * 2;
      const breath = Math.sin(this.walkCycle) * 0.015;

      this.leftLegGroup.rotation.x = 0;
      this.rightLegGroup.rotation.x = 0;
      this.leftArmGroup.rotation.x = breath * 2;
      this.rightArmGroup.rotation.x = -breath * 2;

      this.torsoGroup.position.y = 12 * S + breath;
    }
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

