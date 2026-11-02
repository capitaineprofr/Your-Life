// --- Modèle Humanoïde 3D Style Roblox (Three.js / WebGL) ---
// Rendu 3D fidèle aux proportions et à l'esthétique Roblox (tête cylindrique à stud,
// torse trapézoïdal, membres arrondis et articulés, textures de vêtements et coiffures 3D).

import * as THREE from 'three';

/**
 * Génère la texture faciale expressive style Roblox sur la tête
 */
function createRobloxFaceTexture(skinHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Fond de la peau
  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 128, 128);

  // Yeux expressifs stylisés Roblox
  // Oeil gauche
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(38, 52, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(40, 52, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Reflet blanc signature Roblox
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(38, 47, 4, 0, Math.PI * 2);
  ctx.fill();

  // Oeil droit
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(90, 52, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(88, 52, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Reflet blanc signature Roblox
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(86, 47, 4, 0, Math.PI * 2);
  ctx.fill();

  // Sourcils stylisés
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(26, 26, 26, 6, 3);
  ctx.roundRect(76, 26, 26, 6, 3);
  ctx.fill();

  // Grand sourire amical Roblox
  ctx.strokeStyle = '#3b1c06';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(64, 84, 22, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Joues subtiles chaleureuses
  ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
  ctx.beginPath();
  ctx.ellipse(28, 74, 10, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(100, 74, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Génère la texture du torse (Tissu traditionnel Faso Dan Fani ou Boubou brodé)
 */
function createRobloxShirtTexture(shirtColor = '#d97706', style = 'faso_dan_fani') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Couleur de base
  ctx.fillStyle = shirtColor;
  ctx.fillRect(0, 0, 128, 128);

  if (style === 'faso_dan_fani') {
    // Motifs de tissage traditionnels sahéliens
    const stripes = ['#b91c1c', '#facc15', '#15803d', '#ffffff', '#1e293b'];
    for (let x = 8; x < 120; x += 18) {
      ctx.fillStyle = stripes[Math.floor(x / 18) % stripes.length];
      ctx.fillRect(x, 0, 8, 128);
    }

    // Col en V brodé
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(64, 38);
    ctx.lineTo(84, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (style === 'boubou') {
    // Grand plastron brodé d'or
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(64, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.arc(64, 32, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(64, 32, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ombrage discret des coutures
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 124, 128, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
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
    this.group.name = 'roblox_avatar';

    this.walkCycle = 0;
    this.isMoving = false;
    this.targetRotationY = 0;

    this.buildRobloxModel();
  }

  buildRobloxModel() {
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.skin),
      roughness: 0.65,
      metalness: 0.05
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.hairColor),
      roughness: 0.85,
      metalness: 0.05
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.pantsColor),
      roughness: 0.8,
      metalness: 0.05
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Semelles blanches sneakers
      roughness: 0.5
    });

    // 1. TÊTE STYLE ROBLOX (Tête cylindrique avec studs emblématiques)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.48, 0);

    // Cylindre de tête principal (radius 0.36, hauteur 0.52)
    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.52, 24);
    const faceTex = createRobloxFaceTexture(this.config.skin);

    // Matériaux du cylindre : 0=pourtour (face avant porte la texture), 1=dessus, 2=dessous
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.65,
      metalness: 0.05
    });

    const headMatArray = [faceMat, skinMat, skinMat];
    this.headMesh = new THREE.Mesh(headGeo, headMatArray);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headGroup.add(this.headMesh);

    // Stud supérieur signature Roblox
    const studGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16);
    const topStud = new THREE.Mesh(studGeo, skinMat);
    topStud.position.set(0, 0.28, 0);
    topStud.castShadow = true;
    this.headGroup.add(topStud);

    // Cou stud inférieur reliant la tête au torse
    const neckGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, -0.28, 0);
    neck.castShadow = true;
    this.headGroup.add(neck);

    // Coiffure 3D personnalisée
    this.buildRobloxHair(hairMat);
    this.group.add(this.headGroup);

    // 2. TORSE STYLE ROBLOX (Torse trapézoïdal aux épaules légèrement incurvées)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.95, 0);

    // Torse principal (largeur 0.88, hauteur 0.96, profondeur 0.44)
    const torsoGeo = new THREE.BoxGeometry(0.88, 0.96, 0.44);
    const shirtTex = createRobloxShirtTexture(this.config.shirtColor, this.config.outfitStyle);
    const shirtMat = new THREE.MeshStandardMaterial({
      map: shirtTex,
      roughness: 0.75,
      metalness: 0.05
    });

    this.torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoGroup.add(this.torsoMesh);

    this.group.add(this.torsoGroup);

    // 3. BRAS GAUCHE ROBLOX (Articulé avec épaule arrondie)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.62, 1.35, 0); // Pivot à l'épaule
    this.leftArmGroup.rotation.z = 0.08; // Légèrement écarté au repos (pose classique Roblox)

    const armGeo = new THREE.BoxGeometry(0.34, 0.88, 0.36);
    const leftArmMesh = new THREE.Mesh(armGeo, shirtMat);
    leftArmMesh.position.set(0, -0.42, 0);
    leftArmMesh.castShadow = true;
    this.leftArmGroup.add(leftArmMesh);

    // Épaule demi-sphérique
    const shoulderGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const leftShoulder = new THREE.Mesh(shoulderGeo, shirtMat);
    leftShoulder.position.set(0, 0.02, 0);
    leftShoulder.castShadow = true;
    this.leftArmGroup.add(leftShoulder);

    // Main Roblox (Couleur de peau)
    const handGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 14);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(0, -0.88, 0);
    leftHand.castShadow = true;
    this.leftArmGroup.add(leftHand);

    this.group.add(this.leftArmGroup);

    // 4. BRAS DROIT ROBLOX (Articulé avec épaule arrondie)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.62, 1.35, 0);
    this.rightArmGroup.rotation.z = -0.08;

    const rightArmMesh = new THREE.Mesh(armGeo, shirtMat);
    rightArmMesh.position.set(0, -0.42, 0);
    rightArmMesh.castShadow = true;
    this.rightArmGroup.add(rightArmMesh);

    const rightShoulder = new THREE.Mesh(shoulderGeo, shirtMat);
    rightShoulder.position.set(0, 0.02, 0);
    rightShoulder.castShadow = true;
    this.rightArmGroup.add(rightShoulder);

    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.set(0, -0.88, 0);
    rightHand.castShadow = true;
    this.rightArmGroup.add(rightHand);

    this.group.add(this.rightArmGroup);

    // 5. JAMBE GAUCHE ROBLOX (Articulée avec chaussure sneaker)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.23, 0.95, 0); // Pivot à la hanche

    const legGeo = new THREE.BoxGeometry(0.38, 0.82, 0.4);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.position.set(0, -0.38, 0);
    leftLegMesh.castShadow = true;
    this.leftLegGroup.add(leftLegMesh);

    // Chaussure sneaker
    const shoeGeo = new THREE.BoxGeometry(0.4, 0.16, 0.44);
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(0, -0.86, 0.02);
    leftShoe.castShadow = true;
    this.leftLegGroup.add(leftShoe);

    this.group.add(this.leftLegGroup);

    // 6. JAMBE DROITE ROBLOX (Articulée avec chaussure sneaker)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.23, 0.95, 0);

    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rightLegMesh.position.set(0, -0.38, 0);
    rightLegMesh.castShadow = true;
    this.rightLegGroup.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0, -0.86, 0.02);
    rightShoe.castShadow = true;
    this.rightLegGroup.add(rightShoe);

    this.group.add(this.rightLegGroup);
  }

  buildRobloxHair(hairMat) {
    const style = this.config.hairStyle;

    if (style === 'afro') {
      // Volume Afro en lobes sphériques stylisés (style Roblox UGC)
      const afroGroup = new THREE.Group();
      afroGroup.position.set(0, 0.22, 0);

      const mainPuffGeo = new THREE.SphereGeometry(0.42, 16, 16);
      const mainPuff = new THREE.Mesh(mainPuffGeo, hairMat);
      mainPuff.scale.set(1.1, 0.9, 1.1);
      mainPuff.castShadow = true;
      afroGroup.add(mainPuff);

      const sidePuffGeo = new THREE.SphereGeometry(0.24, 12, 12);
      const p1 = new THREE.Mesh(sidePuffGeo, hairMat);
      p1.position.set(-0.25, 0.12, 0);
      const p2 = new THREE.Mesh(sidePuffGeo, hairMat);
      p2.position.set(0.25, 0.12, 0);
      afroGroup.add(p1, p2);

      this.headGroup.add(afroGroup);
    } else if (style === 'dreads') {
      // Dreads stylisées retombant sur les épaules
      const dreadsGroup = new THREE.Group();
      dreadsGroup.position.set(0, 0.24, 0);

      const topGeo = new THREE.CylinderGeometry(0.38, 0.39, 0.2, 16);
      const topCap = new THREE.Mesh(topGeo, hairMat);
      dreadsGroup.add(topCap);

      const strandGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.55, 8);
      const strandPositions = [
        [-0.34, -0.2, -0.1],
        [-0.36, -0.22, 0.1],
        [0.34, -0.2, -0.1],
        [0.36, -0.22, 0.1],
        [-0.2, -0.24, -0.32],
        [0.2, -0.24, -0.32],
        [0, -0.25, -0.34]
      ];

      for (const pos of strandPositions) {
        const strand = new THREE.Mesh(strandGeo, hairMat);
        strand.position.set(...pos);
        strand.castShadow = true;
        dreadsGroup.add(strand);
      }
      this.headGroup.add(dreadsGroup);
    } else if (style === 'foulard') {
      // Foulard traditionnel noué autour de la tête
      const foulardMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.config.shirtColor),
        roughness: 0.75
      });

      const wrapGeo = new THREE.TorusGeometry(0.38, 0.09, 12, 24);
      wrapGeo.rotateX(Math.PI / 2);
      const wrap = new THREE.Mesh(wrapGeo, foulardMat);
      wrap.position.set(0, 0.18, 0);
      wrap.castShadow = true;
      this.headGroup.add(wrap);

      // Noeud volumineux traditionnel
      const knotGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const knot = new THREE.Mesh(knotGeo, foulardMat);
      knot.position.set(0.24, 0.32, -0.22);
      knot.castShadow = true;
      this.headGroup.add(knot);
    } else {
      // Dégradé court net
      const capGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.22, 20);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.set(0, 0.24, 0);
      cap.castShadow = true;
      this.headGroup.add(cap);
    }
  }

  setDirection(direction) {
    // Conversion de direction boussole vers rotation Three.js Y
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
      this.walkCycle += delta * 10 * speed;
      const angle = Math.sin(this.walkCycle) * 0.75; // Balancement classique Roblox R6

      this.leftLegGroup.rotation.x = angle;
      this.rightLegGroup.rotation.x = -angle;

      this.leftArmGroup.rotation.x = -angle * 0.85;
      this.rightArmGroup.rotation.x = angle * 0.85;

      // Rebond caractéristique de marche Roblox
      const bounce = Math.abs(Math.sin(this.walkCycle)) * 0.055;
      this.torsoGroup.position.y = 0.95 + bounce;
      this.headGroup.position.y = 1.48 + bounce;
    } else {
      // Pose de repos Roblox : bras légèrement écartés, respiration douce
      this.walkCycle += delta * 2;
      const breath = Math.sin(this.walkCycle) * 0.015;

      this.leftLegGroup.rotation.x = 0;
      this.rightLegGroup.rotation.x = 0;

      this.leftArmGroup.rotation.x = breath * 1.5;
      this.rightArmGroup.rotation.x = -breath * 1.5;

      this.torsoGroup.position.y = 0.95 + breath;
      this.headGroup.position.y = 1.48 + breath;
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
