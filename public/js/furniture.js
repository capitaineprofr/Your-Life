// --- Catalogue et Rendu Isométrique des Meubles 2.5D ---

export const FURNITURE_CATALOG = {
  sofa_3p: {
    id: 'sofa_3p',
    name: 'Canapé 3 Places',
    category: 'salon',
    sizeX: 3,
    sizeY: 1,
    height: 38,
    price: 35000,
    interactive: 'sit'
  },
  sofa_2p: {
    id: 'sofa_2p',
    name: 'Canapé 2 Places',
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 36,
    price: 25000,
    interactive: 'sit'
  },
  armchair: {
    id: 'armchair',
    name: 'Fauteuil Confort',
    category: 'salon',
    sizeX: 1,
    sizeY: 1,
    height: 34,
    price: 15000,
    interactive: 'sit'
  },
  table_coffee: {
    id: 'table_coffee',
    name: 'Table Basse Bois',
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 18,
    price: 12000,
    interactive: null
  },
  tv_stand: {
    id: 'tv_stand',
    name: 'Meuble TV & Écran',
    category: 'salon',
    sizeX: 2,
    sizeY: 1,
    height: 50,
    price: 45000,
    interactive: 'watch_tv'
  },
  rug: {
    id: 'rug',
    name: 'Tapis Faso Dan Fani',
    category: 'salon',
    sizeX: 3,
    sizeY: 2,
    height: 2,
    price: 18000,
    interactive: null,
    isWalkable: true // Les tapis se posent au sol sans bloquer la marche
  },
  bed_double: {
    id: 'bed_double',
    name: 'Grand Lit Double',
    category: 'chambre',
    sizeX: 2,
    sizeY: 3,
    height: 35,
    price: 60000,
    interactive: 'sleep'
  },
  bed_single: {
    id: 'bed_single',
    name: 'Lit Simple',
    category: 'chambre',
    sizeX: 1,
    sizeY: 2,
    height: 32,
    price: 30000,
    interactive: 'sleep'
  },
  wardrobe: {
    id: 'wardrobe',
    name: 'Armoire Penderie',
    category: 'chambre',
    sizeX: 2,
    sizeY: 1,
    height: 70,
    price: 40000,
    interactive: null
  },
  bookshelf: {
    id: 'bookshelf',
    name: 'Bibliothèque Haute',
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 65,
    price: 28000,
    interactive: null
  },
  desk_pc: {
    id: 'desk_pc',
    name: 'Bureau Informatique',
    category: 'bureau',
    sizeX: 2,
    sizeY: 1,
    height: 48,
    price: 55000,
    interactive: 'work'
  },
  chair: {
    id: 'chair',
    name: 'Chaise Confort',
    category: 'bureau',
    sizeX: 1,
    sizeY: 1,
    height: 32,
    price: 8000,
    interactive: 'sit'
  },
  fridge: {
    id: 'fridge',
    name: 'Réfrigérateur',
    category: 'cuisine',
    sizeX: 1,
    sizeY: 1,
    height: 65,
    price: 50000,
    interactive: 'drink'
  },
  kitchen_sink: {
    id: 'kitchen_sink',
    name: 'Évier & Plan Cuisine',
    category: 'cuisine',
    sizeX: 2,
    sizeY: 1,
    height: 42,
    price: 42000,
    interactive: 'cook'
  },
  table_dining: {
    id: 'table_dining',
    name: 'Table à Manger',
    category: 'cuisine',
    sizeX: 2,
    sizeY: 2,
    height: 34,
    price: 32000,
    interactive: null
  }
};

// Fonctions utilitaires de dessin isométrique
export function drawIsoBox(ctx, x, y, widthX, widthY, height, colors) {
  const { top, left, right, stroke = 'rgba(0,0,0,0.5)' } = colors;

  // Calcul des sommets isométriques
  const vX_x = -29.4 * (widthX / 2);
  const vX_y = 14.4 * (widthX / 2);
  const vY_x = 29.4 * (widthY / 2);
  const vY_y = 14.4 * (widthY / 2);

  const baseBottom = { x, y };
  const baseLeft = { x: x + vX_x, y: y + vX_y };
  const baseRight = { x: x + vY_x, y: y + vY_y };
  const baseTop = { x: x + vX_x + vY_x, y: y + vX_y + vY_y };

  const topBottom = { x: baseBottom.x, y: baseBottom.y - height };
  const topLeft = { x: baseLeft.x, y: baseLeft.y - height };
  const topRight = { x: baseRight.x, y: baseRight.y - height };
  const topTop = { x: baseTop.x, y: baseTop.y - height };

  // Face Gauche
  if (height > 0) {
    ctx.beginPath();
    ctx.moveTo(baseBottom.x, baseBottom.y);
    ctx.lineTo(baseLeft.x, baseLeft.y);
    ctx.lineTo(topLeft.x, topLeft.y);
    ctx.lineTo(topBottom.x, topBottom.y);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Face Droite
    ctx.beginPath();
    ctx.moveTo(baseBottom.x, baseBottom.y);
    ctx.lineTo(baseRight.x, baseRight.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(topBottom.x, topBottom.y);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  // Face Supérieure
  ctx.beginPath();
  ctx.moveTo(topBottom.x, topBottom.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(topTop.x, topTop.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Dessin spécifique par meuble
export function renderFurniture(ctx, item, screenPos, isSelected = false) {
  const { x, y } = screenPos;
  const type = item.type;

  ctx.save();

  // Halo de sélection si sélectionné par le propriétaire
  if (isSelected) {
    ctx.beginPath();
    ctx.ellipse(x, y, 40, 20, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  switch (type) {
    case 'sofa_3p': {
      // Base
      drawIsoBox(ctx, x, y, 3, 1, 16, { top: '#b45309', left: '#78350f', right: '#92400e' });
      // Dossier arrière
      drawIsoBox(ctx, x - 15, y - 8, 3, 0.3, 38, { top: '#d97706', left: '#92400e', right: '#b45309' });
      // Coussins avec motifs Faso Dan Fani
      drawIsoBox(ctx, x - 15, y - 5, 0.9, 0.8, 10, { top: '#dc2626', left: '#991b1b', right: '#b91c1c' });
      drawIsoBox(ctx, x, y + 2, 0.9, 0.8, 10, { top: '#facc15', left: '#ca8a04', right: '#eab308' });
      drawIsoBox(ctx, x + 15, y + 9, 0.9, 0.8, 10, { top: '#16a34a', left: '#15803d', right: '#16a34a' });
      break;
    }

    case 'sofa_2p': {
      drawIsoBox(ctx, x, y, 2, 1, 16, { top: '#b45309', left: '#78350f', right: '#92400e' });
      drawIsoBox(ctx, x - 10, y - 5, 2, 0.3, 36, { top: '#d97706', left: '#92400e', right: '#b45309' });
      drawIsoBox(ctx, x - 8, y - 2, 0.9, 0.8, 10, { top: '#dc2626', left: '#991b1b', right: '#b91c1c' });
      drawIsoBox(ctx, x + 8, y + 6, 0.9, 0.8, 10, { top: '#facc15', left: '#ca8a04', right: '#eab308' });
      break;
    }

    case 'armchair': {
      drawIsoBox(ctx, x, y, 1, 1, 16, { top: '#b45309', left: '#78350f', right: '#92400e' });
      drawIsoBox(ctx, x - 5, y - 3, 1, 0.3, 34, { top: '#d97706', left: '#92400e', right: '#b45309' });
      drawIsoBox(ctx, x, y, 0.8, 0.8, 8, { top: '#dc2626', left: '#991b1b', right: '#b91c1c' });
      break;
    }

    case 'bed_double': {
      // Cadre de lit bois
      drawIsoBox(ctx, x, y, 2, 3, 14, { top: '#573318', left: '#3b220e', right: '#472a13' });
      // Matelas
      drawIsoBox(ctx, x, y - 5, 1.9, 2.8, 12, { top: '#f8fafc', left: '#cbd5e1', right: '#e2e8f0' });
      // Couette Faso Dan Fani
      drawIsoBox(ctx, x + 8, y + 2, 1.9, 1.8, 13, { top: '#d97706', left: '#92400e', right: '#b45309' });
      // Oreillers blancs
      drawIsoBox(ctx, x - 12, y - 14, 0.8, 0.7, 6, { top: '#ffffff', left: '#e2e8f0', right: '#f1f5f9' });
      drawIsoBox(ctx, x + 2, y - 7, 0.8, 0.7, 6, { top: '#ffffff', left: '#e2e8f0', right: '#f1f5f9' });
      // Tête de lit en bois
      drawIsoBox(ctx, x - 18, y - 18, 2, 0.2, 38, { top: '#472a13', left: '#2d1808', right: '#3b220e' });
      break;
    }

    case 'bed_single': {
      drawIsoBox(ctx, x, y, 1, 2, 12, { top: '#573318', left: '#3b220e', right: '#472a13' });
      drawIsoBox(ctx, x, y - 4, 0.9, 1.9, 10, { top: '#f8fafc', left: '#cbd5e1', right: '#e2e8f0' });
      drawIsoBox(ctx, x + 4, y + 2, 0.9, 1.2, 11, { top: '#2563eb', left: '#1d4ed8', right: '#1e40af' });
      drawIsoBox(ctx, x - 6, y - 8, 0.7, 0.6, 5, { top: '#ffffff', left: '#e2e8f0', right: '#f1f5f9' });
      drawIsoBox(ctx, x - 8, y - 10, 1, 0.2, 32, { top: '#472a13', left: '#2d1808', right: '#3b220e' });
      break;
    }

    case 'desk_pc': {
      // Plateau bureau
      drawIsoBox(ctx, x, y, 2, 1, 30, { top: '#78350f', left: '#451a03', right: '#572204' });
      // Tour PC
      drawIsoBox(ctx, x - 16, y - 20, 0.4, 0.6, 22, { top: '#1e293b', left: '#0f172a', right: '#1e293b' });
      // Écran PC
      drawIsoBox(ctx, x + 2, y - 24, 0.8, 0.2, 18, { top: '#334155', left: '#1e293b', right: '#38bdf8' });
      // Clavier
      drawIsoBox(ctx, x, y - 21, 0.8, 0.4, 2, { top: '#0f172a', left: '#020617', right: '#0f172a' });
      break;
    }

    case 'chair': {
      drawIsoBox(ctx, x, y, 0.8, 0.8, 16, { top: '#78350f', left: '#451a03', right: '#572204' });
      drawIsoBox(ctx, x - 5, y - 4, 0.8, 0.2, 28, { top: '#92400e', left: '#572204', right: '#78350f' });
      break;
    }

    case 'tv_stand': {
      // Meuble bas
      drawIsoBox(ctx, x, y, 2, 1, 20, { top: '#472a13', left: '#2d1808', right: '#3b220e' });
      // Écran TV moderne
      drawIsoBox(ctx, x, y - 14, 1.8, 0.2, 28, { top: '#0f172a', left: '#020617', right: '#1e293b' });
      // Écran allumé avec image bleue
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x - 12, y - 36, 24, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px sans-serif';
      ctx.fillText('RTB', x - 6, y - 26);
      break;
    }

    case 'table_coffee': {
      drawIsoBox(ctx, x, y, 2, 1, 14, { top: '#92400e', left: '#572204', right: '#78350f' });
      break;
    }

    case 'table_dining': {
      drawIsoBox(ctx, x, y, 2, 2, 28, { top: '#78350f', left: '#451a03', right: '#572204' });
      break;
    }

    case 'fridge': {
      drawIsoBox(ctx, x, y, 1, 1, 62, { top: '#e2e8f0', left: '#94a3b8', right: '#cbd5e1' });
      // Poignées
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 4, y - 48, 2, 8);
      ctx.fillRect(x + 4, y - 28, 2, 12);
      break;
    }

    case 'kitchen_sink': {
      drawIsoBox(ctx, x, y, 2, 1, 32, { top: '#cbd5e1', left: '#64748b', right: '#94a3b8' });
      // Double bac évier
      ctx.fillStyle = '#475569';
      ctx.fillRect(x - 8, y - 28, 7, 7);
      ctx.fillRect(x + 1, y - 24, 7, 7);
      // Robinet chrome
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 1, y - 28);
      ctx.lineTo(x - 1, y - 35);
      ctx.stroke();
      break;
    }

    case 'wardrobe': {
      drawIsoBox(ctx, x, y, 2, 1, 68, { top: '#573318', left: '#2d1808', right: '#3b220e' });
      // Ligne séparation portes
      ctx.strokeStyle = '#1e1106';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 56);
      ctx.lineTo(x, y);
      ctx.stroke();
      break;
    }

    case 'bookshelf': {
      drawIsoBox(ctx, x, y, 2, 1, 64, { top: '#573318', left: '#2d1808', right: '#3b220e' });
      // Étagères de livres colorés
      const bookColors = ['#dc2626', '#16a34a', '#2563eb', '#facc15', '#ea580c'];
      for (let shelf = 0; shelf < 3; shelf++) {
        const sy = y - 18 - shelf * 14;
        for (let b = 0; b < 6; b++) {
          ctx.fillStyle = bookColors[b % bookColors.length];
          ctx.fillRect(x - 14 + b * 5, sy, 3, 9);
        }
      }
      break;
    }

    case 'rug': {
      // Tapis plat au sol
      drawIsoBox(ctx, x, y, 3, 2, 2, { top: '#d97706', left: '#92400e', right: '#b45309' });
      // Motifs géométriques sahéliens
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 14, y - 8, 28, 14);
      break;
    }

    default:
      drawIsoBox(ctx, x, y, item.sizeX || 1, item.sizeY || 1, 20, { top: '#94a3b8', left: '#475569', right: '#64748b' });
  }

  ctx.restore();
}
