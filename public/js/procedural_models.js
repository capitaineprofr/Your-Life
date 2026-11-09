// --- Modèles 3D Procéduraux Blockbench (Your-Life) ---
// Fournit des géométries voxel authentiques pour tous les meubles, assises et objets de table

export function getProceduralBedrockGeo(type, item) {
  const sx = item.sizeX || 1;
  const sy = item.sizeY || 1;

  switch (type) {
    // --- Objets de Table (Tabletop) ---
    case 'cup_tea':
      return {
        description: { identifier: 'geometry.cup_tea', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'cup',
          pivot: [0, 0, 0],
          cubes: [
            // Tasse blanche
            { origin: [-2, 0, -2], size: [4, 5, 4], color: '#f8fafc' },
            // Anse
            { origin: [2, 1, -1], size: [1.5, 3, 2], color: '#e2e8f0' },
            // Thé chaud à la menthe / café
            { origin: [-1.5, 4.5, -1.5], size: [3, 0.5, 3], color: '#78350f' }
          ]
        }]
      };

    case 'laptop':
      return {
        description: { identifier: 'geometry.laptop', texture_width: 64, texture_height: 64 },
        bones: [{
          name: 'laptop_base',
          pivot: [0, 0, 0],
          cubes: [
            // Base aluminium gris sidéral
            { origin: [-4.5, 0, -3.5], size: [9, 0.6, 7], color: '#334155' },
            // Clavier sombre
            { origin: [-3.8, 0.6, -2.8], size: [7.6, 0.2, 4.2], color: '#0f172a' },
            // Trackpad
            { origin: [-1.5, 0.6, 1.8], size: [3, 0.1, 1.4], color: '#475569' }
          ]
        }, {
          name: 'laptop_screen',
          pivot: [0, 0.6, -3.5],
          rotation: [-20, 0, 0],
          cubes: [
            // Capot écran
            { origin: [-4.5, 0.6, -3.8], size: [9, 6.5, 0.5], color: '#1e293b' },
            // Écran rétroéclairé bleu Ouaga
            { origin: [-4, 1.1, -3.3], size: [8, 5.5, 0.1], color: '#0284c7' }
          ]
        }]
      };

    case 'table_lamp':
      return {
        description: { identifier: 'geometry.table_lamp', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'lamp',
          pivot: [0, 0, 0],
          cubes: [
            // Socle en laiton
            { origin: [-2, 0, -2], size: [4, 0.8, 4], color: '#ca8a04' },
            // Tige en laiton
            { origin: [-0.5, 0.8, -0.5], size: [1, 7, 1], color: '#eab308' },
            // Abat-jour chaleureux
            { origin: [-3, 7.8, -3], size: [6, 4.5, 6], color: '#fef08a' }
          ]
        }]
      };

    case 'potted_plant':
      return {
        description: { identifier: 'geometry.potted_plant', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'pot',
          pivot: [0, 0, 0],
          cubes: [
            // Pot d'argile cuite
            { origin: [-2.5, 0, -2.5], size: [5, 4.5, 5], color: '#c2410c' },
            // Terreau riche
            { origin: [-2, 4.2, -2], size: [4, 0.4, 4], color: '#451a03' },
            // Feuillage vert tropical
            { origin: [-3.5, 4.6, -3.5], size: [7, 5, 7], color: '#15803d' },
            { origin: [-2, 9.6, -2], size: [4, 2.5, 4], color: '#16a34a' }
          ]
        }]
      };

    case 'canari_pot':
      return {
        description: { identifier: 'geometry.canari_pot', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'canari',
          pivot: [0, 0, 0],
          cubes: [
            // Base du canari
            { origin: [-2, 0, -2], size: [4, 1.5, 4], color: '#9a3412' },
            // Ventre bombé
            { origin: [-3.5, 1.5, -3.5], size: [7, 5, 7], color: '#c2410c' },
            // Col du canari
            { origin: [-2, 6.5, -2], size: [4, 2, 4], color: '#9a3412' },
            // Borde évasé
            { origin: [-2.5, 8.5, -2.5], size: [5, 0.8, 5], color: '#ea580c' }
          ]
        }]
      };

    case 'books_stack':
      return {
        description: { identifier: 'geometry.books_stack', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'books',
          pivot: [0, 0, 0],
          cubes: [
            // Livre du bas (bleu)
            { origin: [-3, 0, -2.5], size: [6, 1.2, 5], color: '#1e3a8a' },
            // Livre du milieu (rouge)
            { origin: [-2.6, 1.2, -2.4], size: [5.2, 1, 4.8], color: '#991b1b' },
            // Livre du haut (doré)
            { origin: [-2.2, 2.2, -2.1], size: [4.4, 0.9, 4.2], color: '#d97706' }
          ]
        }]
      };

    // --- Tables & Surfaces Massives ---
    case 'dining_table':
      return {
        description: { identifier: 'geometry.dining_table', texture_width: 64, texture_height: 64 },
        bones: [{
          name: 'table',
          pivot: [0, 0, 0],
          cubes: [
            // Plateau supérieur 32x32 voxels
            { origin: [-15, 11, -15], size: [30, 1.5, 30], color: '#78350f' },
            // 4 Pieds massifs
            { origin: [-14, 0, -14], size: [2.5, 11, 2.5], color: '#451a03' },
            { origin: [11.5, 0, -14], size: [2.5, 11, 2.5], color: '#451a03' },
            { origin: [-14, 0, 11.5], size: [2.5, 11, 2.5], color: '#451a03' },
            { origin: [11.5, 0, 11.5], size: [2.5, 11, 2.5], color: '#451a03' }
          ]
        }]
      };

    case 'coffee_table':
      return {
        description: { identifier: 'geometry.coffee_table', texture_width: 64, texture_height: 64 },
        bones: [{
          name: 'coffee_table',
          pivot: [0, 0, 0],
          cubes: [
            // Plateau en bois d'acacia
            { origin: [-14, 6.5, -6.5], size: [28, 1.2, 13], color: '#b45309' },
            // Bandeau décoratif Faso Dan Fani central
            { origin: [-4, 7.7, -6.5], size: [8, 0.1, 13], color: '#d97706' },
            // 4 pieds
            { origin: [-13, 0, -5.5], size: [2, 6.5, 2], color: '#451a03' },
            { origin: [11, 0, -5.5], size: [2, 6.5, 2], color: '#451a03' },
            { origin: [-13, 0, 3.5], size: [2, 6.5, 2], color: '#451a03' },
            { origin: [11, 0, 3.5], size: [2, 6.5, 2], color: '#451a03' }
          ]
        }]
      };

    case 'nightstand':
      return {
        description: { identifier: 'geometry.nightstand', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'nightstand',
          pivot: [0, 0, 0],
          cubes: [
            // Corps de chevet
            { origin: [-6, 2, -6], size: [12, 6.5, 12], color: '#78350f' },
            // Tiroir
            { origin: [-5, 3.5, 5.8], size: [10, 3.5, 0.5], color: '#92400e' },
            // Poignée laiton
            { origin: [-1, 5, 6.3], size: [2, 0.6, 0.5], color: '#ca8a04' },
            // 4 petits pieds
            { origin: [-5.5, 0, -5.5], size: [1.8, 2, 1.8], color: '#451a03' },
            { origin: [3.7, 0, -5.5], size: [1.8, 2, 1.8], color: '#451a03' },
            { origin: [-5.5, 0, 3.7], size: [1.8, 2, 1.8], color: '#451a03' },
            { origin: [3.7, 0, 3.7], size: [1.8, 2, 1.8], color: '#451a03' }
          ]
        }]
      };

    // --- Assises & Literie ---
    case 'sofa_faso':
      return {
        description: { identifier: 'geometry.sofa_faso', texture_width: 64, texture_height: 64 },
        bones: [{
          name: 'sofa',
          pivot: [0, 0, 0],
          cubes: [
            // Assise confortable
            { origin: [-14, 2, -6.5], size: [28, 4, 13], color: '#991b1b' },
            // Dossier haut
            { origin: [-14, 6, -6.5], size: [28, 8, 3.5], color: '#b91c1c' },
            // Accoudoir gauche
            { origin: [-15.5, 2, -6.5], size: [2.5, 7, 13], color: '#78350f' },
            // Accoudoir droit
            { origin: [13, 2, -6.5], size: [2.5, 7, 13], color: '#78350f' },
            // Rayures de tissu Faso Dan Fani sur coussins
            { origin: [-12, 6.1, -2.5], size: [24, 0.1, 8], color: '#facc15' },
            // Pieds
            { origin: [-14, 0, -5.5], size: [2, 2, 2], color: '#1e293b' },
            { origin: [12, 0, -5.5], size: [2, 2, 2], color: '#1e293b' },
            { origin: [-14, 0, 3.5], size: [2, 2, 2], color: '#1e293b' },
            { origin: [12, 0, 3.5], size: [2, 2, 2], color: '#1e293b' }
          ]
        }]
      };

    case 'armchair_faso':
      return {
        description: { identifier: 'geometry.armchair_faso', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'armchair',
          pivot: [0, 0, 0],
          cubes: [
            // Assise
            { origin: [-6, 2, -6], size: [12, 4, 12], color: '#991b1b' },
            // Dossier
            { origin: [-6, 6, -6], size: [12, 8, 3], color: '#b91c1c' },
            // Accoudoirs
            { origin: [-7.5, 2, -6], size: [2, 6.5, 12], color: '#78350f' },
            { origin: [5.5, 2, -6], size: [2, 6.5, 12], color: '#78350f' },
            // Pieds
            { origin: [-6.5, 0, -5.5], size: [1.8, 2, 1.8], color: '#1e293b' },
            { origin: [4.7, 0, -5.5], size: [1.8, 2, 1.8], color: '#1e293b' },
            { origin: [-6.5, 0, 3.7], size: [1.8, 2, 1.8], color: '#1e293b' },
            { origin: [4.7, 0, 3.7], size: [1.8, 2, 1.8], color: '#1e293b' }
          ]
        }]
      };

    case 'bed_acajou':
      return {
        description: { identifier: 'geometry.bed_acajou', texture_width: 64, texture_height: 64 },
        bones: [{
          name: 'bed',
          pivot: [0, 0, 0],
          cubes: [
            // Tête de lit en acajou sculpté
            { origin: [-15, 0, -15], size: [30, 14, 2.5], color: '#451a03' },
            // Sommier
            { origin: [-14, 2, -13], size: [28, 4, 27], color: '#78350f' },
            // Matelas blanc confortable
            { origin: [-13, 6, -12], size: [26, 3.5, 25], color: '#f8fafc' },
            // Couvre-lit Faso Dan Fani sur le bas
            { origin: [-13.2, 6.1, 0], size: [26.4, 3.6, 13.2], color: '#b91c1c' },
            // Oreillers blancs
            { origin: [-11, 9.6, -11], size: [9, 2.5, 6], color: '#f1f5f9' },
            { origin: [2, 9.6, -11], size: [9, 2.5, 6], color: '#f1f5f9' }
          ]
        }]
      };

    case 'welcome_mat':
      return {
        description: { identifier: 'geometry.welcome_mat', texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'mat',
          pivot: [0, 0, 0],
          cubes: [
            // Paillasson tissé fin
            { origin: [-7, 0, -5], size: [14, 0.4, 10], color: '#d97706' },
            // Bordure textile
            { origin: [-7.5, 0, -5.5], size: [15, 0.35, 11], color: '#78350f' }
          ]
        }]
      };

    default:
      return {
        description: { identifier: `geometry.${type}`, texture_width: 32, texture_height: 32 },
        bones: [{
          name: 'default_box',
          pivot: [0, 0, 0],
          cubes: [{
            origin: [-(sx * 16) / 2, 0, -(sy * 16) / 2],
            size: [sx * 16, 12, sy * 16],
            color: '#92400e'
          }]
        }]
      };
  }
}

