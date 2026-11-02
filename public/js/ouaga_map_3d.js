// --- Carte Urbaine & Périphérique Totale de Ouagadougou (Three.js / WebGL) ---
// Couverture intégrale du Grand Ouagadougou : 12 Arrondissements (55 secteurs),
// tous les quartiers historiques, résidentiels, populaires et non-lotis,
// ainsi que les communes périphériques (Saaba, Komsilga, Koubri, Pabré, Loumbila, Tanghin-Dassouri).
// 182 tuiles OpenStreetMap Zoom 14 haute définition (3328 x 3584 px).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Grille de 182 tuiles OSM Zoom 14 (13 colonnes x 14 lignes)
const OSM_ZOOM = 14;
const TILE_X0 = 8116;
const TILE_X1 = 8128;
const TILE_Y0 = 7618;
const TILE_Y1 = 7631;
const TILES_W = TILE_X1 - TILE_X0 + 1; // 13 tuiles Est-Ouest (~28.5 km)
const TILES_H = TILE_Y1 - TILE_Y0 + 1; // 14 tuiles Nord-Sud (~31 km)

// Dimensions 3D du monde cartographique (30 unités par tuile)
const TILE_UNIT_SIZE = 30;
const MAP_WIDTH = TILES_W * TILE_UNIT_SIZE; // 390 unités (-195 à +195)
const MAP_DEPTH = TILES_H * TILE_UNIT_SIZE; // 420 unités (-210 à +210)

/**
 * Convertit des coordonnées GPS réelles (Latitude, Longitude) en coordonnées Three.js mondiales (x, z)
 * Calibré sur la projection Web Mercator exacte de la grille Z=14 (X: 8116..8128, Y: 7618..7631)
 */
export function geoToWorld(lat, lon) {
  const n = Math.pow(2, OSM_ZOOM);
  const tileX = ((lon + 180) / 360) * n;
  const latRad = lat * (Math.PI / 180);
  const tileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const u = (tileX - TILE_X0) / TILES_W;
  const v = (tileY - TILE_Y0) / TILES_H;

  const x = (u - 0.5) * MAP_WIDTH;
  const z = (v - 0.5) * MAP_DEPTH;
  return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
}

// Icônes vectorielles SVG par typologie urbaine (Zéro Emoji)
const ICONS_SVG = {
  admin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2L2 7h20L12 2z"/></svg>',
  business: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="14" y1="14" x2="16" y2="14"/></svg>',
  market: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
  residential: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z"/></svg>',
  craft: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  hub: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  water: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c2.5 0 3-3 6-3s3.5 3 6 3 3.5-3 6-3 3 2 4 3M2 17c2.5 0 3-3 6-3s3.5 3 6 3 3.5-3 6-3 3 2 4 3"/></svg>',
  nature: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 12h5v8h6v-8h5L12 2z"/></svg>',
  campus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/></svg>',
  periphery: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/></svg>'
};

/**
 * Répertoire intégral des 85 Quartiers, Secteurs des 12 Arrondissements et Communes Périphériques
 * de Ouagadougou avec coordonnées GPS réelles.
 */
const RAW_DISTRICTS = [
  // ================= ARRONDISSEMENT 1 (CENTRE HISTORIQUE & ADMINISTRATIF) =================
  { id: 'koulouba', name: 'Koulouba & Place de la Nation', arr: 'Arr. 1', zone: 'centre', lat: 12.3647, lon: -1.5220, color: '#f59e0b', icon: 'admin', fare: 300, tag: 'Arr. 1 • Centre Historique & Ministères', desc: 'Cœur civique et administratif de la capitale : Place de la Nation, Palais de Justice, ministères et avenues ombragées.', acts: ['Institutions Publiques', 'Place de la Nation', 'Bureaux Administratifs'] },
  { id: 'rood_woko', name: 'Grand Marché (Rood Woko)', arr: 'Arr. 1', zone: 'centre', lat: 12.3688, lon: -1.5222, color: '#10b981', icon: 'market', fare: 300, tag: 'Arr. 1 • Poumon Commercial Central', desc: 'Le plus grand marché du pays : tissus Faso Dan Fani, épices, maroquinerie, orfèvrerie et commerce de gros.', acts: ['Grand Commerce', 'Tissus Faso Dan Fani', 'Artisanat & Épices'] },
  { id: 'kwame_nkrumah', name: 'Avenue Kwame Nkrumah (Zangouettin)', arr: 'Arr. 1', zone: 'centre', lat: 12.3612, lon: -1.5168, color: '#3b82f6', icon: 'business', fare: 350, tag: 'Arr. 1 • Quartier d\'Affaires & Sorties', desc: 'L\'artère prestigieuse reliant le centre aux hôtels internationaux, sièges de banques, glaciers et terrasses animées.', acts: ['Sièges Bancaires', 'Restaurants & Cafés', 'Hôtels & Galeries'] },
  { id: 'bilbalogho', name: 'Bilbalogho', arr: 'Arr. 1', zone: 'centre', lat: 12.3595, lon: -1.5315, color: '#f59e0b', icon: 'residential', fare: 300, tag: 'Arr. 1 • Quartier Historique Ouest-Centre', desc: 'Quartier résidentiel ancien à l\'ouest de Koulouba, connu pour ses concessions familiales et ses ateliers.', acts: ['Cours Familiales', 'Artisanat Urbain', 'Commerces de Proximité'] },
  { id: 'saint_leon', name: 'Saint-Léon & Cathédrale', arr: 'Arr. 1', zone: 'centre', lat: 12.3622, lon: -1.5262, color: '#eab308', icon: 'admin', fare: 300, tag: 'Arr. 1 • Patrimoine & Écoles Historiques', desc: 'Autour de la Cathédrale de l\'Immaculée-Conception en briques de latérite, écoles historiques et centres culturels.', acts: ['Patrimoine Architectural', 'Établissements Scolaires', 'Librairies'] },
  { id: 'tiedpalogo', name: 'Tiedpalogo', arr: 'Arr. 1', zone: 'centre', lat: 12.3682, lon: -1.5175, color: '#10b981', icon: 'market', fare: 300, tag: 'Arr. 1 • Quartier Marchand Central', desc: 'Quartier commerçant dense entourant l\'est du Grand Marché, boutiques d\'électronique et grossistes.', acts: ['Grossistes', 'Boutiques Électronique', 'Import-Export'] },
  { id: 'kamsaoghin', name: 'Kamsaoghin', arr: 'Arr. 1', zone: 'centre', lat: 12.3650, lon: -1.5348, color: '#f97316', icon: 'residential', fare: 300, tag: 'Arr. 1 • Quartier Populaire Central', desc: 'Quartier historique animé entre Bilbalogho et Nemnin, réputé pour sa convivialité et ses petits métiers.', acts: ['Maquis & Grillades', 'Couture & Coiffure', 'Vie de Quartier'] },
  { id: 'samandin', name: 'Samandin', arr: 'Arr. 1', zone: 'centre', lat: 12.3525, lon: -1.5295, color: '#f97316', icon: 'residential', fare: 350, tag: 'Arr. 1 • Sud du Centre-Ville', desc: 'Grand quartier populaire au sud de Bilbalogho, bordant la Maison du Peuple et l\'axe vers Cissin.', acts: ['Marché de Samandin', 'Espaces Culturels', 'Restauration Populaire'] },

  // ================= ARRONDISSEMENT 2 (CENTRE-OUEST & TRADITION MOSSI) =================
  { id: 'gounghin', name: 'Gounghin (Nord & Sud)', arr: 'Arr. 2', zone: 'ouest', lat: 12.3575, lon: -1.5520, color: '#ec4899', icon: 'craft', fare: 400, tag: 'Arr. 2 • Stade du 4-Août & Ateliers', desc: 'Grand quartier sur la RN1 abritant le Stade du 4-Août, l\'ENAREF, le camp Sangoulé Lamizana et de nombreux maquis.', acts: ['Stade du 4-Août', 'Ateliers Mécaniques', 'Maquis & Musique Live'] },
  { id: 'ouidi', name: 'Ouidi', arr: 'Arr. 2', zone: 'centre', lat: 12.3750, lon: -1.5365, color: '#d97706', icon: 'admin', fare: 350, tag: 'Arr. 2 • Fief Traditionnel du Larlé Naaba', desc: 'Quartier coutumier emblématique de l\'histoire mossi de Ouagadougou, palais du Larlé Naaba et traditions.', acts: ['Chefferie Coutumière', 'Histoire & Culture', 'Marché Local'] },
  { id: 'larle', name: 'Larlé', arr: 'Arr. 2', zone: 'centre', lat: 12.3788, lon: -1.5415, color: '#10b981', icon: 'market', fare: 350, tag: 'Arr. 2 • Grand Marché de Larlé', desc: 'Connu dans toute la capitale pour son marché vivrier très actif, ses céréales et produits frais.', acts: ['Marché de Larlé', 'Commerce Vivrier', 'Artisanat Traditionnel'] },
  { id: 'dapoya', name: 'Dapoya (I & II)', arr: 'Arr. 2', zone: 'centre', lat: 12.3775, lon: -1.5210, color: '#f59e0b', icon: 'craft', fare: 350, tag: 'Arr. 2 • Fondeurs de Bronze & Culture', desc: 'Quartier historique au nord de la voie ferrée, célèbre pour ses maîtres bronziers et son ambiance culturelle.', acts: ['Fonderie de Bronze', 'Galeries d\'Art', 'Maquis Historiques'] },
  { id: 'paspanga', name: 'Paspanga', arr: 'Arr. 2', zone: 'centre', lat: 12.3755, lon: -1.5270, color: '#3b82f6', icon: 'residential', fare: 350, tag: 'Arr. 2 • Entre Gare & Barrages', desc: 'Situé entre la gare ferroviaire et le barrage n°1, abritant écoles, centres de santé et résidences.', acts: ['Écoles & Lycées', 'Services Urbains', 'Résidences Centrales'] },
  { id: 'kologh_naba', name: 'Kologh-Naba', arr: 'Arr. 2', zone: 'nord', lat: 12.3825, lon: -1.5345, color: '#ec4899', icon: 'market', fare: 350, tag: 'Arr. 2 • Pôle Marchand Nord-Centre', desc: 'Quartier très fréquenté au nord d\'Ouidi avec un marché dynamique et des commerces le long de la RN2.', acts: ['Marché Kologh-Naba', 'Quincailleries', 'Boutiques Textiles'] },
  { id: 'nemnin', name: 'Nemnin', arr: 'Arr. 2', zone: 'centre', lat: 12.3712, lon: -1.5335, color: '#f97316', icon: 'residential', fare: 300, tag: 'Arr. 2 • Quartier Central Dense', desc: 'Quartier résidentiel et populaire reliant Kamsaoghin à Ouidi et Larlé.', acts: ['Commerce de Rue', 'Artisans Tailleurs', 'Vie Associative'] },
  { id: 'baoghin', name: 'Baoghin', arr: 'Arr. 2', zone: 'nord', lat: 12.3812, lon: -1.5265, color: '#06b6d4', icon: 'water', fare: 350, tag: 'Arr. 2 • Rive Sud du Barrage n°1', desc: 'Quartier bordant la retenue d\'eau n°1 et la digue vers Tanghin, jardins maraîchers et habitations.', acts: ['Maraîchage Urbain', 'Traversée du Barrage', 'Pépinières'] },

  // ================= ARRONDISSEMENT 3 (NORD-OUEST : TAMPOUY, KILWIN, RIMKIÉTA) =================
  { id: 'tampouy', name: 'Tampouy & Échangeur du Nord', arr: 'Arr. 3', zone: 'nord', lat: 12.3965, lon: -1.5465, color: '#f97316', icon: 'hub', fare: 450, tag: 'Arr. 3 • Grand Carrefour du Nord-Ouest', desc: 'Pôle économique majeur du nord-ouest : grand marché de Tampouy, échangeur du Nord, gares et banques.', acts: ['Marché de Tampouy', 'Gares Routières Nord', 'Paul VI & Cliniques'] },
  { id: 'kilwin', name: 'Kilwin', arr: 'Arr. 3', zone: 'nord', lat: 12.3985, lon: -1.5635, color: '#8b5cf6', icon: 'residential', fare: 500, tag: 'Arr. 3 • Vaste Secteur Nord-Ouest', desc: 'Grand secteur résidentiel et commercial s\'étendant à l\'ouest de Tampouy vers Bissighin.', acts: ['Marché de Kilwin', 'Lycées & Collèges', 'Ateliers & Quincailleries'] },
  { id: 'rimkieta', name: 'Rimkiéta', arr: 'Arr. 3', zone: 'ouest', lat: 12.3845, lon: -1.5695, color: '#ec4899', icon: 'residential', fare: 500, tag: 'Arr. 3 • Pôle Populaire Ouest-Nord-Ouest', desc: 'L\'un des plus vastes quartiers de l\'ouest de Ouagadougou, très vivant avec ses marchés et centres sociaux.', acts: ['Marché de Rimkiéta', 'Artisanat & Menuiserie', 'Centres Sportifs'] },
  { id: 'nonsin', name: 'Nonsin', arr: 'Arr. 3', zone: 'ouest', lat: 12.3805, lon: -1.5515, color: '#f59e0b', icon: 'residential', fare: 400, tag: 'Arr. 3 • Entre Larlé & Rimkiéta', desc: 'Quartier résidentiel animé assurant la jonction entre Gounghin-Nord, Larlé et Rimkiéta.', acts: ['Boulangeries & Maquis', 'Écoles de Quartier', 'Petits Commerces'] },
  { id: 'yaoghin', name: 'Yaoghin', arr: 'Arr. 3', zone: 'nord', lat: 12.4065, lon: -1.5540, color: '#10b981', icon: 'residential', fare: 500, tag: 'Arr. 3 • Nord de Tampouy (Axe RN2)', desc: 'Secteur nord de l\'Arrondissement 3 sur l\'axe menant vers Ouahigouya.', acts: ['Entrepôts & Négoce', 'Transport Régional', 'Habitat Urbain'] },

  // ================= ARRONDISSEMENT 4 (NORD : TANGHIN, SOMGANDÉ, PAZANI) =================
  { id: 'tanghin', name: 'Tanghin (Centre & Barrages)', arr: 'Arr. 4', zone: 'nord', lat: 12.3915, lon: -1.5185, color: '#06b6d4', icon: 'water', fare: 400, tag: 'Arr. 4 • Rive Nord des Barrages n°2 & n°3', desc: 'Quartier historique au nord des barrages, célèbre pour son marché de Tanghin, son centre médical et sa vie culturelle.', acts: ['Marché de Tanghin', 'Berges des Barrages', 'Poissons Grillés'] },
  { id: 'sambin_barrage', name: 'Sambin-Barrage', arr: 'Arr. 4', zone: 'nord', lat: 12.3848, lon: -1.5130, color: '#06b6d4', icon: 'water', fare: 400, tag: 'Arr. 4 • Jardins Maraîchers Lacustres', desc: 'Ceinture verte le long des retenues d\'eau centrales : cultures de fraises, salades, menthe et fleurs.', acts: ['Maraîchage & Fraises', 'Horticulture', 'Fraîcheur du Lac'] },
  { id: 'somgande', name: 'Somgandé', arr: 'Arr. 4', zone: 'nord', lat: 12.4015, lon: -1.4950, color: '#f97316', icon: 'craft', fare: 450, tag: 'Arr. 4 • Nord de Bangr Weogo', desc: 'Grand quartier populaire et semi-industriel situé au nord de la forêt classée et à l\'ouest de Kossodo.', acts: ['Ateliers & Dépôts', 'Marché de Somgandé', 'Vie Populaire'] },
  { id: 'polesgo', name: 'Polesgo', arr: 'Arr. 4', zone: 'nord', lat: 12.4165, lon: -1.5120, color: '#10b981', icon: 'residential', fare: 500, tag: 'Arr. 4 • Extension Nord de Tanghin', desc: 'Quartier résidentiel au nord de Tanghin, en plein essor le long de la route de Kongoussi.', acts: ['Nouvelles Résidences', 'Marché Local', 'Écoles & Centres'] },
  { id: 'pazani', name: 'Pazani', arr: 'Arr. 4', zone: 'peripherie', lat: 12.4265, lon: -1.5045, color: '#8b5cf6', icon: 'periphery', fare: 550, tag: 'Arr. 4 • Périphérie Nord', desc: 'Zone d\'extension nord de l\'Arrondissement 4, mêlant nouvelles cités et espaces périurbains.', acts: ['Foncier & Construction', 'Élevage & Vergers', 'Cités Périurbaines'] },
  { id: 'toeghin_peulh', name: 'Toéghin-Peulh', arr: 'Arr. 4', zone: 'nord', lat: 12.4190, lon: -1.4915, color: '#eab308', icon: 'nature', fare: 500, tag: 'Arr. 4 • Nord-Est & Tradition Pastorale', desc: 'Secteur nord-est entre Somgandé et Pazani, réputé pour son marché à bétail et ses produits laitiers.', acts: ['Laiterie Traditionnelle', 'Élevage Urbain', 'Commerce Nord-Est'] },

  // ================= ARRONDISSEMENT 5 (CENTRE-EST : ZOGONA, WEMTENGA, 1200 LOGEMENTS) =================
  { id: 'zone_du_bois', name: 'Zone du Bois', arr: 'Arr. 5', zone: 'est', lat: 12.3745, lon: -1.4965, color: '#10b981', icon: 'business', fare: 400, tag: 'Arr. 5 • Quartier Résidentiel & Gastronomique', desc: 'Quartier verdoyant prisé pour ses avenues arborées, ses restaurants du monde, ses ONG et représentations.', acts: ['Restaurants & Lounges', 'Sièges d\'ONG', 'Villas Arborées'] },
  { id: 'zogona', name: 'Zogona & Université Joseph Ki-Zerbo', arr: 'Arr. 5', zone: 'est', lat: 12.3715, lon: -1.5030, color: '#3b82f6', icon: 'campus', fare: 350, tag: 'Arr. 5 • Cœur Universitaire & Étudiant', desc: 'Abrite le grand campus de l\'Université Joseph Ki-Zerbo, le CHU Yalgado Ouédraogo et les cités universitaires.', acts: ['Campus Universitaire', 'CHU Yalgado', 'Librairies & Cybercafés'] },
  { id: 'logements_1200', name: '1200 Logements (Cité An III)', arr: 'Arr. 5', zone: 'est', lat: 12.3645, lon: -1.5015, color: '#8b5cf6', icon: 'residential', fare: 350, tag: 'Arr. 5 • Cité Emblématique de la Révolution', desc: 'Cité planifiée moderne aux rues structurées, abritant cliniques, cabinets, cafés, pharmacies et villas.', acts: ['Cliniques & Cabinets', 'Pâtisseries & Cafés', 'Habitat Moderne'] },
  { id: 'wemtenga', name: 'Wemtenga', arr: 'Arr. 5', zone: 'est', lat: 12.3635, lon: -1.4910, color: '#f59e0b', icon: 'market', fare: 400, tag: 'Arr. 5 • Artère Commerciale de l\'Est', desc: 'Quartier très animé traversé par l\'avenue Charles de Gaulle et le canal de Wemtenga, boutiques et maquis.', acts: ['Avenue Charles de Gaulle', 'Marché de Wemtenga', 'Vie Nocturne Est'] },
  { id: 'dagnoen', name: 'Dagnoën', arr: 'Arr. 5', zone: 'est', lat: 12.3575, lon: -1.4845, color: '#ec4899', icon: 'market', fare: 400, tag: 'Arr. 5 • Grand Quartier Populaire Est', desc: 'Quartier dense et commerçant au sud de Wemtenga, célèbre pour son marché et son ambiance chaleureuse.', acts: ['Marché de Dagnoën', 'Couture & Mode', 'Maquis & Brochettes'] },
  { id: 'kalgodin', name: 'Kalgodin', arr: 'Arr. 5', zone: 'centre', lat: 12.3575, lon: -1.5060, color: '#3b82f6', icon: 'business', fare: 350, tag: 'Arr. 5 • Flanc Est de l\'Aéroport', desc: 'Situé le long de la clôture est de l\'aéroport international, siège d\'institutions et d\'hôtels.', acts: ['Bureaux & Services', 'Axe Aéroportuaire', 'Hôtellerie'] },
  { id: 'petit_paris', name: 'Petit Paris', arr: 'Arr. 5', zone: 'est', lat: 12.3605, lon: -1.4970, color: '#8b5cf6', icon: 'residential', fare: 350, tag: 'Arr. 5 • Secteur Résidentiel Chic', desc: 'Quartier résidentiel calme niché entre les 1200 Logements, Kalgodin et Dagnoën.', acts: ['Villas & Résidences', 'Restaurants Calmes', 'Bureaux d\'Études'] },
  { id: 'ronsin', name: 'Ronsin', arr: 'Arr. 5', zone: 'est', lat: 12.3670, lon: -1.4860, color: '#10b981', icon: 'residential', fare: 400, tag: 'Arr. 5 • Entre Wemtenga & Dassasgho', desc: 'Quartier résidentiel agréable reliant la Zone du Bois et Wemtenga vers Dassasgho.', acts: ['Habitat Résidentiel', 'Écoles Privées', 'Commerces'] },
  { id: 'bangr_weogo', name: 'Parc Urbain Bangr Weogo', arr: 'Arr. 5', zone: 'est', lat: 12.3892, lon: -1.4885, color: '#15803d', icon: 'nature', fare: 450, tag: 'Arr. 5 • Forêt Classée de 240 Hectares', desc: 'La forêt sacrée au cœur de Ouagadougou : faune sauvage en liberté (biches, crocodiles, oiseaux), musée et sport.', acts: ['Randonnée & Jogging', 'Observation Faune', 'Pique-Nique Botanique'] },

  // ================= ARRONDISSEMENT 6 (SUD-OUEST : PISSY, CISSIN, KOURITENGA) =================
  { id: 'pissy', name: 'Pissy', arr: 'Arr. 6', zone: 'ouest', lat: 12.3455, lon: -1.5645, color: '#f97316', icon: 'hub', fare: 450, tag: 'Arr. 6 • Carrefour Ouest RN1 & Marché', desc: 'Nœud névralgique de la sortie Ouest (route de Bobo-Dioulasso) : grand marché de Pissy, CMA et gares routières.', acts: ['Marché de Pissy', 'Gares Routières Ouest', 'Carrières de Granit'] },
  { id: 'cissin', name: 'Cissin', arr: 'Arr. 6', zone: 'sud', lat: 12.3405, lon: -1.5420, color: '#ec4899', icon: 'residential', fare: 400, tag: 'Arr. 6 • Grand Pôle Résidentiel Sud-Ouest', desc: 'Vaste quartier dynamique entre Samandin, Pissy et la Patte d\'Oie, réputé pour sa jeunesse et ses terrains de sport.', acts: ['Vie Nocturne & Maquis', 'Terrains de Football', 'Commerces Actifs'] },
  { id: 'kouritenga', name: 'Kouritenga', arr: 'Arr. 6', zone: 'ouest', lat: 12.3335, lon: -1.5555, color: '#10b981', icon: 'residential', fare: 450, tag: 'Arr. 6 • Sud de Pissy', desc: 'Quartier résidentiel paisible assurant la transition entre Pissy, Cissin et Bonheur-Ville.', acts: ['Habitat Familial', 'Écoles & Lycées', 'Artisanat Local'] },
  { id: 'gounghin_sud_6', name: 'Secteur 25 (Sankaryaré / Brasserie)', arr: 'Arr. 6', zone: 'ouest', lat: 12.3515, lon: -1.5470, color: '#f59e0b', icon: 'craft', fare: 400, tag: 'Arr. 6 • Zone d\'Ateliers & Commerce', desc: 'Zone d\'activités intenses reliant le sud de Gounghin au nord de Cissin.', acts: ['Menuiserie Métallique', 'Pièces Détachées', 'Dépôts Boissons'] },

  // ================= ARRONDISSEMENT 7 (SUD-OUEST PÉRIPHÉRIQUE : BONHEUR-VILLE, NAGRIN, BOASSA) =================
  { id: 'bonheur_ville', name: 'Bonheur-Ville (Belleville)', arr: 'Arr. 7', zone: 'sud', lat: 12.3265, lon: -1.5525, color: '#8b5cf6', icon: 'residential', fare: 500, tag: 'Arr. 7 • Cité Moderne du Sud-Ouest', desc: 'Grand quartier résidentiel loti au sud de Cissin, apprécié pour ses nouvelles villas et ses avenues larges.', acts: ['Villas Modernes', 'Supermarchés & Pharmacies', 'Espaces Détente'] },
  { id: 'nagrin', name: 'Nagrin', arr: 'Arr. 7', zone: 'sud', lat: 12.3135, lon: -1.5565, color: '#10b981', icon: 'residential', fare: 550, tag: 'Arr. 7 • Sud de Bonheur-Ville', desc: 'Vaste secteur du sud-ouest en pleine urbanisation en direction de Komsilga.', acts: ['Nouveaux Lotissements', 'Marché de Nagrin', 'Fermes Urbaines'] },
  { id: 'sandogo', name: 'Sandogo', arr: 'Arr. 7', zone: 'ouest', lat: 12.3340, lon: -1.5840, color: '#f97316', icon: 'market', fare: 550, tag: 'Arr. 7 • Axe Ouest après Pissy', desc: 'Quartier très peuplé au sud de la RN1 entre Pissy et Zagtouli, doté d\'un marché très actif.', acts: ['Marché de Sandogo', 'Artisanat & BTP', 'Commerce Périurbain'] },
  { id: 'boassa', name: 'Boassa', arr: 'Arr. 7', zone: 'peripherie', lat: 12.3210, lon: -1.5920, color: '#ec4899', icon: 'periphery', fare: 600, tag: 'Arr. 7 • Grand Pôle Périphérique Sud-Ouest', desc: 'Importante agglomération périphérique au sud de Sandogo, mêlant habitat dense et culture périurbaine.', acts: ['Marché de Boassa', 'Maraîchage & Élevage', 'Construction'] },
  { id: 'siafoman', name: 'Siafoman & Kamboinsin-Sud', arr: 'Arr. 7', zone: 'peripherie', lat: 12.3395, lon: -1.5980, color: '#eab308', icon: 'periphery', fare: 600, tag: 'Arr. 7 • Front Ouest de l\'Arr. 7', desc: 'Secteur d\'extension ouest entre Sandogo et Zagtouli.', acts: ['Quincailleries BTP', 'Ateliers Bois', 'Habitat Périurbain'] },

  // ================= ARRONDISSEMENT 8 (OUEST & NORD-OUEST PÉRIPHÉRIQUE : ZAGTOULI, BASSINKO) =================
  { id: 'zagtouli', name: 'Zagtouli', arr: 'Arr. 8', zone: 'peripherie', lat: 12.3295, lon: -1.6150, color: '#f59e0b', icon: 'hub', fare: 650, tag: 'Arr. 8 • Porte de l\'Ouest (RN1) & Centrale Solaire', desc: 'Porte d\'entrée ouest de la capitale sur la route de Bobo-Dioulasso, abritant la grande centrale solaire photovoltaïque.', acts: ['Centrale Solaire Zagtouli', 'Corridor RN1', 'Marché Fruitier'] },
  { id: 'bassinko', name: 'Cité de Bassinko', arr: 'Arr. 8', zone: 'peripherie', lat: 12.4120, lon: -1.6080, color: '#3b82f6', icon: 'residential', fare: 650, tag: 'Arr. 8 • Grande Cité des Logements Sociaux', desc: 'Immense pôle résidentiel moderne du nord-ouest regroupant des milliers de logements sociaux et économiques.', acts: ['Logements Sociaux', 'Marché de Bassinko', 'Nouvelles Écoles'] },
  { id: 'zongo', name: 'Zongo (Nabitenga)', arr: 'Arr. 8', zone: 'ouest', lat: 12.3525, lon: -1.6020, color: '#10b981', icon: 'residential', fare: 550, tag: 'Arr. 8 • Entre Rimkiéta & Zagtouli', desc: 'Grand quartier de l\'ouest reliant Rimkiéta au nord et Zagtouli au sud.', acts: ['Marché de Zongo', 'Briqueteries', 'Vie Communautaire'] },
  { id: 'bissighin', name: 'Bissighin', arr: 'Arr. 8', zone: 'nord', lat: 12.3980, lon: -1.5880, color: '#8b5cf6', icon: 'residential', fare: 550, tag: 'Arr. 8 • Axe Nord-Ouest RN2', desc: 'Quartier dynamique situé entre Kilwin et Bassinko sur l\'axe menant au nord-ouest.', acts: ['Commerce RN2', 'Écoles & Collèges', 'Habitat en Expansion'] },
  { id: 'dar_es_salam', name: 'Dar-Es-Salam & Gantin', arr: 'Arr. 8', zone: 'peripherie', lat: 12.3780, lon: -1.5980, color: '#ec4899', icon: 'periphery', fare: 600, tag: 'Arr. 8 • Ouest de Rimkiéta', desc: 'Quartier périphérique ouest très peuplé assurant la continuité urbaine entre Rimkiéta, Zongo et Bassinko.', acts: ['Petits Métiers', 'Marché de Quartier', 'Entraide Sociale'] },

  // ================= ARRONDISSEMENT 9 (NORD PÉRIPHÉRIQUE : MARCOUSSIS, KAMBOINSIN, SAKOULA) =================
  { id: 'marcoussis', name: 'Marcoussis', arr: 'Arr. 9', zone: 'nord', lat: 12.4125, lon: -1.5320, color: '#ec4899', icon: 'residential', fare: 500, tag: 'Arr. 9 • Nord de l\'Échangeur (RN22)', desc: 'Quartier très vivant au nord de Tampouy et Tanghin, célèbre pour ses maquis et son dynamisme commercial.', acts: ['Axe Route de Kongoussi', 'Maquis & Grillades', 'Commerces Nord'] },
  { id: 'silmiyiri', name: 'Silmiyiri', arr: 'Arr. 9', zone: 'peripherie', lat: 12.4310, lon: -1.5380, color: '#f59e0b', icon: 'periphery', fare: 550, tag: 'Arr. 9 • Nord de Marcoussis', desc: 'Quartier résidentiel périphérique sur la RN22 en direction de Kamboinsin et Pabré.', acts: ['Villas Périurbaines', 'Jardins & Vergers', 'Commerce RN22'] },
  { id: 'kamboinsin', name: 'Kamboinsin & Campus 2iE', arr: 'Arr. 9', zone: 'peripherie', lat: 12.4450, lon: -1.5540, color: '#3b82f6', icon: 'campus', fare: 650, tag: 'Arr. 9 • Pôle Scientifique & Universitaire Nord', desc: 'Siège de l\'institut international d\'ingénierie 2iE, du centre de recherche CNRST/IRSS, barrage et vergers.', acts: ['Campus International 2iE', 'Centres de Recherche', 'Barrage de Kamboinsin'] },
  { id: 'sakoula', name: 'Sakoula', arr: 'Arr. 9', zone: 'peripherie', lat: 12.4290, lon: -1.4780, color: '#10b981', icon: 'periphery', fare: 600, tag: 'Arr. 9 • Périphérie Nord-Est', desc: 'Grand secteur périphérique nord-est situé au nord de Kossodo et Somgandé.', acts: ['Marché de Sakoula', 'Agriculture Urbaine', 'Extensions Résidentielles'] },
  { id: 'roumtenga', name: 'Roumtenga', arr: 'Arr. 9', zone: 'peripherie', lat: 12.4180, lon: -1.4660, color: '#eab308', icon: 'periphery', fare: 550, tag: 'Arr. 9 • Nord de Kossodo', desc: 'Secteur nord-est jouxtant la zone industrielle de Kossodo et la sortie vers Loumbila.', acts: ['Logistique & Dépôts', 'Habitat Périurbain', 'Ateliers'] },

  // ================= ARRONDISSEMENT 10 (EST : KOSSODO, WAYALGHIN, DASSASGHO, BENDOGO) =================
  { id: 'kossodo', name: 'Zone Industrielle de Kossodo', arr: 'Arr. 10', zone: 'est', lat: 12.4045, lon: -1.4710, color: '#f97316', icon: 'craft', fare: 500, tag: 'Arr. 10 • Poumon Industriel & Énergétique', desc: 'Principal pôle industriel de Ouagadougou : centrale thermique SONABEL, brasseries, usines, abattoir et échangeur.', acts: ['Usines & Industries', 'Centrale Électrique', 'Parc Logistique'] },
  { id: 'wayalghin', name: 'Wayalghin & Échangeur de l\'Est', arr: 'Arr. 10', zone: 'est', lat: 12.3825, lon: -1.4695, color: '#3b82f6', icon: 'hub', fare: 450, tag: 'Arr. 10 • Carrefour Nord-Est', desc: 'Quartier stratégique au pied de l\'échangeur de l\'Est, reliant le centre-ville à Kossodo et Dassasgho.', acts: ['Gares Routières Est', 'Marché de Wayalghin', 'Hôtels & Cliniques'] },
  { id: 'dassasgho', name: 'Dassasgho', arr: 'Arr. 10', zone: 'est', lat: 12.3725, lon: -1.4685, color: '#10b981', icon: 'market', fare: 450, tag: 'Arr. 10 • Grand Quartier Résidentiel & Marchand Est', desc: 'Quartier majeur sur la RN4 (route de Fada N\'Gourma), doté d\'un grand marché, de banques et de cités arborées.', acts: ['Marché de Dassasgho', 'Banques & Supermarchés', 'Cités Résidentielles'] },
  { id: 'bendogo', name: 'Bendogo', arr: 'Arr. 10', zone: 'est', lat: 12.3710, lon: -1.4385, color: '#8b5cf6', icon: 'residential', fare: 500, tag: 'Arr. 10 • Porte Est vers Saaba', desc: 'Grand quartier de l\'Est situé après le SIAO, faisant le trait d\'union entre Dassasgho et la commune de Saaba.', acts: ['Marché de Bendogo', 'Cités Universitaires Est', 'Commerces RN4'] },
  { id: 'taabtenga', name: 'Taabtenga', arr: 'Arr. 10', zone: 'est', lat: 12.3680, lon: -1.4520, color: '#ec4899', icon: 'residential', fare: 450, tag: 'Arr. 10 • Entre Dassasgho & Bendogo', desc: 'Secteur résidentiel et populaire au cœur de l\'Arrondissement 10.', acts: ['Écoles & Lycées', 'Artisanat Local', 'Vie de Quartier'] },
  { id: 'godin', name: 'Godin', arr: 'Arr. 10', zone: 'est', lat: 12.3885, lon: -1.4610, color: '#f59e0b', icon: 'residential', fare: 450, tag: 'Arr. 10 • Est de Wayalghin', desc: 'Quartier résidentiel situé au nord-est de Wayalghin et Dassasgho.', acts: ['Habitat Urbain', 'Petits Commerces', 'Services'] },
  { id: 'benogo', name: 'Benogo (Nioko I)', arr: 'Arr. 10', zone: 'est', lat: 12.3860, lon: -1.4450, color: '#10b981', icon: 'residential', fare: 500, tag: 'Arr. 10 • Extension Nord-Est', desc: 'Quartier en fort développement situé au nord de Bendogo et à l\'ouest de Nioko II.', acts: ['Nouvelles Cités', 'Marché de Benogo', 'Quincailleries'] },

  // ================= ARRONDISSEMENT 11 (SUD-EST : KARPALA, BALKUY, YAMTENGA, SIAO) =================
  { id: 'siao_paglayiri', name: 'Paglayiri & Site du SIAO', arr: 'Arr. 11', zone: 'sud', lat: 12.3465, lon: -1.5015, color: '#f59e0b', icon: 'market', fare: 400, tag: 'Arr. 11 • Salon International de l\'Artisanat (SIAO)', desc: 'Abrite le célèbre parc d\'exposition du SIAO, le musée national à proximité, le boulevard circulaire et Paglayiri.', acts: ['Pavillons du SIAO', 'Marché de Paglayiri', 'Boulevard des Tansoba'] },
  { id: 'karpala', name: 'Karpala', arr: 'Arr. 11', zone: 'sud', lat: 12.3335, lon: -1.4820, color: '#ec4899', icon: 'residential', fare: 450, tag: 'Arr. 11 • Grand Quartier Populaire & Résidentiel Sud-Est', desc: 'L\'un des plus grands et plus célèbres quartiers du sud-est de Ouagadougou, extrêmement vivant jour et nuit.', acts: ['Avenues Animées', 'Maquis & Restaurants', 'Commerces Multiples'] },
  { id: 'balkuy', name: 'Balkuy', arr: 'Arr. 11', zone: 'sud', lat: 12.3085, lon: -1.4660, color: '#8b5cf6', icon: 'residential', fare: 550, tag: 'Arr. 11 • Sud de Karpala & Est de Ouaga 2000', desc: 'Vaste secteur résidentiel du sud-est jouxtant Ouaga 2000, très prisé pour ses nouvelles constructions.', acts: ['Cités de Balkuy', 'Centres Médicaux', 'Supermarchés Sud-Est'] },
  { id: 'yamtenga', name: 'Yamtenga', arr: 'Arr. 11', zone: 'est', lat: 12.3525, lon: -1.4615, color: '#f97316', icon: 'craft', fare: 450, tag: 'Arr. 11 • Est du Canal & Artisanat', desc: 'Quartier populaire très dense situé entre Dagnoën, Dassasgho et Rayongo.', acts: ['Marché de Yamtenga', 'Tissage & Teinture', 'Ateliers Populaires'] },
  { id: 'katr_yaar', name: 'Katr-Yaar', arr: 'Arr. 11', zone: 'sud', lat: 12.3430, lon: -1.4710, color: '#10b981', icon: 'market', fare: 450, tag: 'Arr. 11 • Pôle Marchand entre Dagnoën & Karpala', desc: 'Carrefour commercial très fréquenté au nord de Karpala.', acts: ['Marché Katr-Yaar', 'Boutiques & Services', 'Restauration'] },
  { id: 'rayongo', name: 'Rayongo', arr: 'Arr. 11', zone: 'est', lat: 12.3380, lon: -1.4520, color: '#3b82f6', icon: 'residential', fare: 500, tag: 'Arr. 11 • Secteur Est de Karpala', desc: 'Quartier en pleine croissance à l\'est de Karpala vers la commune de Saaba.', acts: ['Nouvelles Résidences', 'Écoles & Terrains', 'Commerces'] },
  { id: 'silmissin', name: 'Silmissin & Cité Azimo', arr: 'Arr. 11', zone: 'sud', lat: 12.3420, lon: -1.5080, color: '#eab308', icon: 'residential', fare: 400, tag: 'Arr. 11 • Sud de l\'Aéroport', desc: 'Quartier résidentiel situé entre la piste de l\'aéroport, Paglayiri et la Patte d\'Oie.', acts: ['Cité Azimo', 'Hôtels & Bureaux', 'Vie Résidentielle'] },
  { id: 'dayongo', name: 'Dayongo & Ouidtenga', arr: 'Arr. 11', zone: 'peripherie', lat: 12.3180, lon: -1.4420, color: '#15803d', icon: 'periphery', fare: 600, tag: 'Arr. 11 • Périphérie Sud-Est vers Koubri', desc: 'Zone périurbaine sud-est mêlant nouvelles villas, jardins et fermes vers Koubri.', acts: ['Vergers & Jardins', 'Résidences Périurbaines', 'Aviculture'] },

  // ================= ARRONDISSEMENT 12 (SUD : PATTE D'OIE, OUAGA 2000 A/B/C, TRAME D'ACCUEIL) =================
  { id: 'patte_doie', name: 'Patte d\'Oie', arr: 'Arr. 12', zone: 'sud', lat: 12.3325, lon: -1.5225, color: '#f59e0b', icon: 'hub', fare: 400, tag: 'Arr. 12 • Échangeur de Ouaga 2000 & Carrefour Sud', desc: 'Point de convergence des grands boulevards du Sud : échangeur monumental, gares, hôtels et centres commerciaux.', acts: ['Échangeur de Ouaga 2000', 'Centres Commerciaux', 'Cliniques & Banques'] },
  { id: 'ouaga_2000_a', name: 'Ouaga 2000 • Zone A (Kosyam & Ambassades)', arr: 'Arr. 12', zone: 'sud', lat: 12.3120, lon: -1.5085, color: '#8b5cf6', icon: 'admin', fare: 550, tag: 'Arr. 12 • Palais de Kosyam & Monument des Martyrs', desc: 'Le quartier diplomatique et présidentiel : Palais de Kosyam, Mémorial des Martyrs, ambassades et avenues royales.', acts: ['Monument des Martyrs', 'Palais de Kosyam', 'Ambassades & Consulats'] },
  { id: 'ouaga_2000_b', name: 'Ouaga 2000 • Zone B (Palais des Sports & Congrès)', arr: 'Arr. 12', zone: 'sud', lat: 12.3025, lon: -1.4950, color: '#3b82f6', icon: 'business', fare: 600, tag: 'Arr. 12 • Tours Ministérielles & Palais des Sports', desc: 'Cœur moderne abritant le Palais des Sports, les salles de conférences internationales, hôtels 5 étoiles et ministères.', acts: ['Palais des Sports', 'Hôtels 5 Étoiles', 'Sièges Internationaux'] },
  { id: 'ouaga_2000_c', name: 'Ouaga 2000 • Zone C (Extension Sud)', arr: 'Arr. 12', zone: 'sud', lat: 12.2920, lon: -1.5180, color: '#10b981', icon: 'residential', fare: 600, tag: 'Arr. 12 • Résidences Modernes & Cités Sud', desc: 'Extension méridionale de Ouaga 2000 avec complexes résidentiels contemporains et centres d\'affaires.', acts: ['Villas Haut Standing', 'Restaurants Chic', 'Promenades Urbaines'] },
  { id: 'trame_accueil', name: 'Trame d\'Accueil de Ouaga 2000', arr: 'Arr. 12', zone: 'sud', lat: 12.3185, lon: -1.5310, color: '#ec4899', icon: 'residential', fare: 500, tag: 'Arr. 12 • Quartier Vivant Ouest-Ouaga 2000', desc: 'Situé entre la Patte d\'Oie, Bonheur-Ville et Ouaga 2000, très prisé pour ses commerces, écoles et maquis.', acts: ['Commerces & Maquis', 'Écoles Internationales', 'Vie de Quartier Sud'] },
  { id: 'garghin', name: 'Garghin', arr: 'Arr. 12', zone: 'peripherie', lat: 12.2830, lon: -1.4880, color: '#eab308', icon: 'periphery', fare: 650, tag: 'Arr. 12 • Front Sud de la Capitale', desc: 'Secteur périphérique sud au-delà de Ouaga 2000 et Balkuy, vers la sortie de Pô.', acts: ['Nouvelles Cités Sud', 'Foncier Résidentiel', 'Espaces Aérés'] },

  // ================= GRAND OUAGA : COMMUNES PÉRIPHÉRIQUES & COURONNE PÉRIURBAINE =================
  { id: 'saaba', name: 'Saaba (Centre & Cités Universitaires)', arr: 'Grand Ouaga Est', zone: 'peripherie', lat: 12.3765, lon: -1.4120, color: '#3b82f6', icon: 'campus', fare: 700, tag: 'Périphérie Est • Commune de Saaba & Univ. Thomas Sankara', desc: 'Grande commune périurbaine à l\'Est : abrite l\'Université Thomas Sankara, de vastes cités immobilières et marchés.', acts: ['Université Thomas Sankara', 'Cités Immobilières', 'Marché Central de Saaba'] },
  { id: 'nioko_2', name: 'Nioko II (Saaba-Nord)', arr: 'Grand Ouaga Est', zone: 'peripherie', lat: 12.4020, lon: -1.4320, color: '#f97316', icon: 'periphery', fare: 650, tag: 'Périphérie Nord-Est • Carrefour Kossodo-Saaba', desc: 'Zone périurbaine très dense reliant l\'échangeur de Kossodo à la commune de Saaba.', acts: ['Marché de Nioko II', 'Ateliers & Matériaux', 'Habitat Populaire'] },
  { id: 'gampela', name: 'Gampéla', arr: 'Grand Ouaga Est', zone: 'peripherie', lat: 12.4150, lon: -1.4080, color: '#15803d', icon: 'nature', fare: 750, tag: 'Périphérie Est • Sortie RN4 vers Koupéla', desc: 'Pôle agro-écologique et station de recherche agronomique à la sortie Est du Grand Ouaga.', acts: ['Station Agronomique', 'Élevage & Vergers', 'Corridor RN4'] },
  { id: 'tengandogo', name: 'Tengandogo & CHU Blaise Compaoré', arr: 'Grand Ouaga Sud', zone: 'peripherie', lat: 12.2750, lon: -1.5120, color: '#06b6d4', icon: 'admin', fare: 650, tag: 'Périphérie Sud • Grand Hôpital Universitaire & RN5', desc: 'Pôle hospitalier de référence (CHU de Tengandogo) et zone résidentielle sur la route de Saponé/Pô.', acts: ['CHU de Tengandogo', 'Pharmacies & Hôtels', 'Axe Sud RN5'] },
  { id: 'komsilga', name: 'Komsilga (Tingandogo / Kièmné)', arr: 'Grand Ouaga Sud-Ouest', zone: 'peripherie', lat: 12.2650, lon: -1.5580, color: '#10b981', icon: 'periphery', fare: 750, tag: 'Périphérie Sud-Ouest • Commune de Komsilga', desc: 'Commune périurbaine du sud-ouest prisée pour ses résidences secondaires, ses fermes avicoles et ses jardins.', acts: ['Fermes & Aviculture', 'Villas Périurbaines', 'Nature & Calme'] },
  { id: 'koubri', name: 'Koubri (Entrée Nord / Naba-Zana)', arr: 'Grand Ouaga Sud-Est', zone: 'peripherie', lat: 12.2450, lon: -1.4550, color: '#15803d', icon: 'nature', fare: 800, tag: 'Périphérie Sud-Est • Monastère, Barrages & Vergers', desc: 'Célèbre pour son monastère bénédictin, ses produits laitiers (yaourts de Koubri), ses barrages et ses manguiers.', acts: ['Monastère de Koubri', 'Fromagerie & Yaourts', 'Retenues d\'Eau'] },
  { id: 'pabre', name: 'Pabré (Katabtenga / Gaskaye)', arr: 'Grand Ouaga Nord', zone: 'peripherie', lat: 12.4820, lon: -1.5550, color: '#06b6d4', icon: 'water', fare: 800, tag: 'Périphérie Nord • Commune de Pabré & Grand Barrage', desc: 'Au nord de Kamboinsin sur la RN22 : vaste barrage entouré de manguiers, séminaire historique et maraîchage.', acts: ['Barrage de Pabré', 'Vergers de Manguiers', 'Excursions Nature'] },
  { id: 'loumbila', name: 'Loumbila (Axe RN3 & Barrage)', arr: 'Grand Ouaga Nord-Est', zone: 'peripherie', lat: 12.4850, lon: -1.4180, color: '#06b6d4', icon: 'water', fare: 800, tag: 'Périphérie Nord-Est • Plage de Loumbila & Axe Ziniaré', desc: 'Lieu de villégiature favori des Ouagalais le week-end : retenue d\'eau de Loumbila, complexes hôteliers et pêche.', acts: ['Barrage de Loumbila', 'Détente & Nautisme', 'Poissons Braisés'] },
  { id: 'tanghin_dassouri', name: 'Tanghin-Dassouri (Axe Ouest / Bazoulé)', arr: 'Grand Ouaga Ouest', zone: 'peripherie', lat: 12.3150, lon: -1.6480, color: '#f59e0b', icon: 'periphery', fare: 800, tag: 'Périphérie Ouest • Après Zagtouli vers Bazoulé', desc: 'Commune périurbaine de l\'Ouest sur la RN1, porte d\'accès aux célèbres crocodiles sacrés de Bazoulé.', acts: ['Route de Bazoulé', 'Marché Paysan', 'Écotourisme Sahélien'] }
];

// Enrichissement automatique avec projection 3D et icônes SVG
export const OUAGA_DISTRICTS = RAW_DISTRICTS.map(d => ({
  id: d.id,
  name: d.name,
  arr: d.arr,
  zone: d.zone,
  tag: d.tag,
  color: d.color,
  coords: geoToWorld(d.lat, d.lon),
  lat: d.lat,
  lon: d.lon,
  iconSvg: ICONS_SVG[d.icon] || ICONS_SVG.residential,
  description: d.desc,
  activities: d.acts,
  taxiFare: d.fare,
  zoomHeight: d.zone === 'peripherie' ? 58 : 44
}));

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
    this.activeZoneFilter = 'all';
    this.searchQuery = '';
    this.showLabels = true;

    // Position de la caméra style Google Maps (Vue Zénithale par défaut)
    this.is3DMode = false;
    this.cameraCenter = new THREE.Vector3(0, 0, 0);
    this.targetCameraCenter = new THREE.Vector3(0, 0, 0);
    this.cameraHeight = 110;
    this.targetCameraHeight = 110;

    this.cameraAngle = 0;
    this.cameraPitch = Math.PI / 2 - 0.0001;

    this.pins = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDragging = false;
    this.dragMoved = false;
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
              <h1 class="map-city-title">GRAND OUAGADOUGOU & PÉRIPHÉRIES (12 ARRONDISSEMENTS)</h1>
              <span class="map-city-coords">${OUAGA_DISTRICTS.length} Quartiers & Communes Périurbaines • Cartographie HD OpenStreetMap</span>
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
          <button id="btn-map-recenter" class="map-ctrl-btn btn-map-wide" title="Recentrer sur le Centre-Ville">Centre-Ville</button>
          <button id="btn-map-overview" class="map-ctrl-btn btn-map-wide" title="Vue d'ensemble Grand Ouaga">Grand Ouaga</button>
          <button id="btn-map-toggle-3d" class="map-ctrl-btn btn-mode-3d" title="Basculer Vue Zénithale 2D / Perspective 3D">Vue 3D</button>
          <button id="btn-map-toggle-labels" class="map-ctrl-btn btn-mode-3d active" title="Afficher/Masquer les noms des quartiers sur la carte">Noms</button>
        </div>

        <!-- Panneau Latéral Droit : Rétractable avec recherche et filtres -->
        <aside class="map-sidebar" id="map-sidebar">
          <button class="panel-edge-tab" id="tab-toggle-map-sidebar" title="Ouvrir la liste des ${OUAGA_DISTRICTS.length} quartiers">
            <span class="tab-arrow">‹</span>
            <span class="tab-text">Quartiers</span>
          </button>

          <div class="sidebar-header-box">
            <div class="sidebar-title-row">
              <h2 class="sidebar-map-title">Quartiers & Périphéries (<span id="districts-count">${OUAGA_DISTRICTS.length}</span>)</h2>
              <button id="btn-toggle-map-sidebar" class="btn-sidebar-toggle" title="Masquer le panneau vers la droite">›</button>
            </div>
            <!-- Barre de Recherche Instantanée -->
            <div class="map-search-box">
              <input type="text" id="map-district-search" class="map-search-input" placeholder="Rechercher un quartier, Arr. 1..12, Saaba..." autocomplete="off">
            </div>
            <!-- Filtres par Zone Géographique -->
            <div class="map-zone-tabs" id="map-zone-tabs">
              <button class="zone-tab-btn active" data-zone="all">Tous</button>
              <button class="zone-tab-btn" data-zone="centre">Centre</button>
              <button class="zone-tab-btn" data-zone="nord">Nord</button>
              <button class="zone-tab-btn" data-zone="est">Est</button>
              <button class="zone-tab-btn" data-zone="sud">Sud</button>
              <button class="zone-tab-btn" data-zone="ouest">Ouest</button>
              <button class="zone-tab-btn" data-zone="peripherie">Périphérie</button>
            </div>
          </div>

          <div class="districts-list" id="districts-list"></div>

          <!-- Fiche d'information du Quartier Sélectionné -->
          <div class="district-info-card" id="district-info-card">
            <div class="card-badge-row">
              <span class="district-badge" id="card-district-tag">Arr. 1 • Centre Historique</span>
              <span class="taxi-badge" id="card-district-fare">Taxi : 300 FCFA</span>
            </div>
            <h3 class="district-card-title" id="card-district-name">Koulouba & Place de la Nation</h3>
            <p class="district-card-desc" id="card-district-desc"></p>
            <div class="district-activities-box">
              <span class="activities-label">Points d'intérêt & Activités :</span>
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

    // Fond sablonneux doux identique au fond cartographique OSM (Zéro zone blanche)
    const bgColor = new THREE.Color(0xeedfc8);
    this.scene.background = bgColor;

    this.camera = new THREE.PerspectiveCamera(40, width / height, 1, 2200);
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

    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.2);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.05);
    sunLight.position.set(60, 220, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 600;
    const d = 220;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0xd4c2a5, 0.4);
    this.scene.add(hemiLight);
  }

  /**
   * Construit le sol cartographique 3D texturé à partir des 182 tuiles réelles OpenStreetMap Zoom 14
   * (13 x 14 tuiles = 3328 x 3584 px) avec mise à jour progressive en temps réel.
   */
  buildRealMapTerrain() {
    // 1. Sol périphérique étendu (2400 x 2400) pour empêcher toute bordure vide même au dézoom maximal
    const outerGeo = new THREE.PlaneGeometry(2400, 2400);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshLambertMaterial({
      color: 0xeedfc8,
      roughness: 1.0
    });
    this.outerGroundMesh = new THREE.Mesh(outerGeo, outerMat);
    this.outerGroundMesh.position.y = -0.2;
    this.scene.add(this.outerGroundMesh);

    // 2. Terrain cartographique intégral du Grand Ouagadougou (390 x 420 unités)
    const groundGeo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = TILES_W * 256;  // 3328 px
    compositeCanvas.height = TILES_H * 256; // 3584 px
    const ctx = compositeCanvas.getContext('2d');

    // Fond initial sable sahélien
    ctx.fillStyle = '#eedfc8';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    const mapTexture = new THREE.CanvasTexture(compositeCanvas);
    mapTexture.colorSpace = THREE.SRGBColorSpace;
    mapTexture.magFilter = THREE.LinearFilter;
    mapTexture.minFilter = THREE.LinearMipmapLinearFilter;
    if (this.renderer) {
      mapTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }

    const groundMat = new THREE.MeshLambertMaterial({
      map: mapTexture,
      color: 0xffffff,
      roughness: 0.95
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Chargement prioritaire du centre vers la périphérie pour affichage instantané
    const coordsList = [];
    const centerCol = Math.floor(TILES_W / 2);
    const centerRow = Math.floor(TILES_H / 2);

    for (let row = 0; row < TILES_H; row++) {
      for (let col = 0; col < TILES_W; col++) {
        const dist = Math.hypot(col - centerCol, row - centerRow);
        coordsList.push({ row, col, dist });
      }
    }
    coordsList.sort((a, b) => a.dist - b.dist);

    let loadedCount = 0;
    coordsList.forEach(({ row, col }) => {
      const tileX = TILE_X0 + col;
      const tileY = TILE_Y0 + row;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, col * 256, row * 256, 256, 256);
        loadedCount++;
        if (loadedCount % 16 === 0 || loadedCount === coordsList.length) {
          mapTexture.needsUpdate = true;
        }
      };
      img.src = `assets/city/tiles14/tile_${OSM_ZOOM}_${tileX}_${tileY}.png`;
    });
  }

  /**
   * Implante les bâtiments 3D Kenney GLB dans tous les arrondissements et communes périphériques
   */
  loadRealCityBuildings() {
    const buildingModels = [
      'building-a.glb', 'building-b.glb', 'building-c.glb', 'building-d.glb',
      'building-e.glb', 'building-f.glb', 'building-g.glb', 'building-h.glb',
      'building-skyscraper-a.glb', 'building-skyscraper-b.glb', 'building-skyscraper-c.glb',
      'building-skyscraper-d.glb', 'building-skyscraper-e.glb'
    ];

    const placements = [];
    // Génération d'un ensemble de bâtiments représentatifs autour de chacun des 85 quartiers
    OUAGA_DISTRICTS.forEach((d, idx) => {
      const isSkyscraperZone = d.id.startsWith('ouaga_2000') || d.id === 'kwame_nkrumah' || d.id === 'koulouba' || d.id === 'patte_doie';
      const count = d.zone === 'centre' ? 3 : 2;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + idx * 0.7;
        const radius = 3.2 + (i % 2) * 1.8;
        const bx = d.coords.x + Math.cos(angle) * radius;
        const bz = d.coords.z + Math.sin(angle) * radius;

        let file;
        if (isSkyscraperZone && i === 0) {
          file = buildingModels[8 + (idx % 5)];
        } else {
          file = buildingModels[(idx + i) % 8];
        }

        placements.push({
          file,
          coords: { x: bx, z: bz },
          scale: isSkyscraperZone ? 2.1 : 1.65,
          rot: (idx * 1.3 + i) % Math.PI
        });
      }
    });

    const modelCache = new Map();
    const pendingByUrl = new Map();

    placements.forEach(p => {
      const url = `assets/city/glb/${p.file}`;
      if (modelCache.has(url)) {
        this.instantiateBuilding(modelCache.get(url), p);
      } else if (pendingByUrl.has(url)) {
        pendingByUrl.get(url).push(p);
      } else {
        pendingByUrl.set(url, [p]);
        this.loader.load(
          url,
          gltf => {
            modelCache.set(url, gltf.scene);
            const list = pendingByUrl.get(url) || [];
            list.forEach(item => this.instantiateBuilding(gltf.scene, item));
            pendingByUrl.delete(url);
          },
          undefined,
          () => {}
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
      }
    });

    this.scene.add(clone);
  }

  /**
   * Crée un Sprite 3D d'étiquette de texte net pour afficher le nom du quartier sur la carte
   */
  createDistrictLabelSprite(name, colorHex) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const shortName = name.split(' (')[0].split(' • ')[0];

    ctx.font = '700 22px Outfit, sans-serif';
    const textWidth = ctx.measureText(shortName).width;
    canvas.width = Math.ceil(textWidth + 32);
    canvas.height = 42;

    // Fond pilule sombre lisible
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.beginPath();
    ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 10);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colorHex;
    ctx.stroke();

    ctx.font = '700 21px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shortName, canvas.width / 2, canvas.height / 2 + 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(2.3 * aspect, 2.3, 1);
    sprite.position.y = 11.2;
    sprite.renderOrder = 10;
    return sprite;
  }

  /**
   * Crée les balises 3D et étiquettes pour les 85 quartiers et communes périphériques
   */
  buildDistrictMarkers() {
    const ringGeo = new THREE.RingGeometry(1.6, 2.3, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const pinGeo = new THREE.OctahedronGeometry(1.35, 0);
    const rodGeo = new THREE.CylinderGeometry(0.1, 0.1, 6.0, 6);
    const rodMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    OUAGA_DISTRICTS.forEach(d => {
      const pinGroup = new THREE.Group();
      pinGroup.position.set(d.coords.x, 0, d.coords.z);
      pinGroup.userData = { district: d };

      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.2;
      pinGroup.add(ring);

      const pinMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(d.color),
        emissive: new THREE.Color(d.color),
        emissiveIntensity: 0.45,
        roughness: 0.25
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.y = 6.8;
      pinMesh.name = `pin_${d.id}`;
      pinGroup.add(pinMesh);

      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.y = 3.2;
      pinGroup.add(rod);

      const labelSprite = this.createDistrictLabelSprite(d.name, d.color);
      pinGroup.add(labelSprite);

      this.scene.add(pinGroup);
      this.pins.push({ group: pinGroup, pinMesh, labelSprite, district: d });
    });
  }

  getFilteredDistricts() {
    const q = this.searchQuery.trim().toLowerCase();
    return OUAGA_DISTRICTS.filter(d => {
      const matchZone = this.activeZoneFilter === 'all' || d.zone === this.activeZoneFilter;
      if (!matchZone) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.arr.toLowerCase().includes(q) ||
        d.tag.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      );
    });
  }

  renderDistrictsUI() {
    const listContainer = document.getElementById('districts-list');
    const countEl = document.getElementById('districts-count');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const filtered = this.getFilteredDistricts();
    if (countEl) countEl.textContent = filtered.length;

    // Synchroniser aussi la visibilité des pins sur la carte selon le filtre actif
    const visibleIds = new Set(filtered.map(d => d.id));
    this.pins.forEach(p => {
      p.group.visible = visibleIds.has(p.district.id);
    });

    filtered.forEach(d => {
      const item = document.createElement('div');
      item.className = `district-item ${d.id === this.activeDistrict.id ? 'active' : ''}`;
      item.dataset.id = d.id;

      item.innerHTML = `
        <div class="district-item-left">
          <span class="district-icon" style="color:${d.color}">${d.iconSvg}</span>
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
      if (el.dataset.id === district.id) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
    this.updateCardUI();

    this.targetCameraCenter.set(district.coords.x, 0, district.coords.z);
    this.targetCameraHeight = district.zoomHeight || 46;
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

    // Recherche instantanée de quartier
    const searchInput = document.getElementById('map-district-search');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        this.searchQuery = e.target.value;
        this.renderDistrictsUI();
      });
    }

    // Onglets de filtrage par zone géographique
    const zoneButtons = document.querySelectorAll('.zone-tab-btn');
    zoneButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        zoneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeZoneFilter = btn.dataset.zone || 'all';
        this.renderDistrictsUI();
      });
    });

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

    const btnZoomIn = document.getElementById('btn-map-zoom-in');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        this.targetCameraHeight = Math.max(22, this.targetCameraHeight - 22);
      });
    }

    const btnZoomOut = document.getElementById('btn-map-zoom-out');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        this.targetCameraHeight = Math.min(340, this.targetCameraHeight + 28);
      });
    }

    // Recentrer sur le Centre-Ville (Rood Woko / Place de la Nation)
    const btnRecenter = document.getElementById('btn-map-recenter');
    if (btnRecenter) {
      btnRecenter.addEventListener('click', () => {
        const center = geoToWorld(12.3665, -1.5220);
        this.targetCameraCenter.set(center.x, 0, center.z);
        this.targetCameraHeight = 75;
      });
    }

    // Vue d'ensemble du Grand Ouagadougou & Périphéries
    const btnOverview = document.getElementById('btn-map-overview');
    if (btnOverview) {
      btnOverview.addEventListener('click', () => {
        this.targetCameraCenter.set(0, 0, 0);
        this.targetCameraHeight = 290;
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
          this.cameraPitch = 0.95;
          this.cameraAngle = Math.PI / 4;
        } else {
          btnToggle3D.textContent = 'Vue 3D';
          btnToggle3D.classList.remove('active');
          this.cameraPitch = Math.PI / 2 - 0.0001;
          this.cameraAngle = 0;
        }
      });
    }

    // Afficher/Masquer les étiquettes de noms de quartiers sur la carte
    const btnToggleLabels = document.getElementById('btn-map-toggle-labels');
    if (btnToggleLabels) {
      btnToggleLabels.addEventListener('click', () => {
        this.showLabels = !this.showLabels;
        btnToggleLabels.classList.toggle('active', this.showLabels);
        this.pins.forEach(p => {
          if (p.labelSprite) p.labelSprite.visible = this.showLabels;
        });
      });
    }

    // Panning direct 1:1 style Google Maps au clic-glisser
    this.canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartMouse = { x: e.clientX, y: e.clientY };
      this.dragStartCenter = { x: this.cameraCenter.x, z: this.cameraCenter.z };
    });

    window.addEventListener('mousemove', e => {
      if (!this.isOpen) return;

      if (this.isDragging) {
        const dx = e.clientX - this.dragStartMouse.x;
        const dy = e.clientY - this.dragStartMouse.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          this.dragMoved = true;
        }

        if (this.is3DMode && e.buttons === 2) {
          this.cameraAngle -= dx * 0.006;
          this.cameraPitch = Math.max(0.4, Math.min(1.4, this.cameraPitch + dy * 0.006));
          this.dragStartMouse = { x: e.clientX, y: e.clientY };
        } else {
          const fovRad = (this.camera.fov * Math.PI) / 180;
          const factor = (2 * Math.tan(fovRad / 2) * this.cameraHeight) / window.innerHeight;

          let newX = this.dragStartCenter.x - dx * factor;
          let newZ = this.dragStartCenter.z - dy * factor;

          // Clamping sur toute l'étendue du Grand Ouagadougou et ses communes périphériques
          const clampX = MAP_WIDTH * 0.46;
          const clampZ = MAP_DEPTH * 0.46;
          newX = Math.max(-clampX, Math.min(clampX, newX));
          newZ = Math.max(-clampZ, Math.min(clampZ, newZ));

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

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.08;
      this.targetCameraHeight = Math.max(22, Math.min(340, this.targetCameraHeight + zoomDelta));
    }, { passive: false });

    // Clic 3D sur un quartier (balise ou étiquette)
    this.canvas.addEventListener('click', () => {
      if (!this.isOpen || this.dragMoved) return;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const targets = [];
      this.pins.forEach(p => {
        if (p.group.visible) {
          targets.push(p.pinMesh);
          if (p.labelSprite && p.labelSprite.visible) targets.push(p.labelSprite);
        }
      });
      const hits = this.raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const hitGroup = hits[0].object.parent;
        if (hitGroup && hitGroup.userData.district) {
          this.selectDistrict(hitGroup.userData.district);
        }
      }
    });

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
      this.camera.position.set(this.cameraCenter.x, this.cameraHeight, this.cameraCenter.z);
      this.camera.lookAt(this.cameraCenter.x, 0, this.cameraCenter.z);
    } else {
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

      if (!this.isDragging) {
        this.cameraCenter.lerp(this.targetCameraCenter, Math.min(1, delta * 4.5));
      }
      this.cameraHeight += (this.targetCameraHeight - this.cameraHeight) * Math.min(1, delta * 6.0);

      this.updateCameraTransform();

      this.pins.forEach((p, idx) => {
        if (!p.group.visible) return;
        const bounce = Math.sin(time * 0.003 + idx) * 0.35;
        p.pinMesh.position.y = 6.8 + bounce;
        p.pinMesh.rotation.y += delta * 0.9;
      });

      this.renderer.render(this.scene, this.camera);
    };

    this.animId = requestAnimationFrame(animate);
  }
}

export const ouagaMap = new OuagaMap3D();
