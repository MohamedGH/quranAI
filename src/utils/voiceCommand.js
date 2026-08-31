// ─── Voice Command Utilities and Surah Mapping ────────────────────────────────

// ─── SURAH NAME MAP (French + Arabic + English for voice recognition) ─────────
export const SURAH_NAMES = {
  "fatiha":1,"al-fatiha":1,"fatihah":1,"ouverture":1,
  "baqara":2,"al-baqara":2,"vache":2,"bakara":2,
  "imran":3,"al-imran":3,"famille d'imran":3,
  "nisa":4,"an-nisa":4,"femmes":4,
  "maida":5,"al-maida":5,"table":5,
  "anam":6,"al-anam":6,"troupeaux":6,
  "araf":7,"al-araf":7,"murailles":7,
  "anfal":8,"al-anfal":8,"dépouilles":8,
  "tawba":9,"at-tawba":9,"repentir":9,
  "yunus":10,"younes":10,"jonas":10,
  "hud":11,"houd":11,
  "yusuf":12,"youssef":12,"joseph":12,
  "rad":13,"ar-rad":13,"tonnerre":13,
  "ibrahim":14,"abraham":14,
  "hijr":15,"al-hijr":15,
  "nahl":16,"an-nahl":16,"abeilles":16,
  "isra":17,"al-isra":17,"voyage nocturne":17,
  "kahf":18,"al-kahf":18,"caverne":18,
  "maryam":19,"marie":19,
  "taha":20,"ta-ha":20,
  "anbiya":21,"al-anbiya":21,"prophètes":21,
  "hajj":22,"pèlerinage":22,
  "muminun":23,"croyants":23,
  "nur":24,"an-nur":24,"lumière":24,
  "furqan":25,"al-furqan":25,"critère":25,
  "shuara":26,"poètes":26,
  "naml":27,"an-naml":27,"fourmis":27,
  "qasas":28,"al-qasas":28,"récits":28,
  "ankabut":29,"araignée":29,
  "rum":30,"ar-rum":30,"romains":30,
  "luqman":31,"lokman":31,
  "sajda":32,"as-sajda":32,"prosternation":32,
  "ahzab":33,"al-ahzab":33,"coalisés":33,
  "saba":34,"saba'":34,
  "fatir":35,"créateur":35,
  "yasin":36,"ya-sin":36,
  "saffat":37,"as-saffat":37,"rangés":37,
  "sad":38,
  "zumar":39,"az-zumar":39,"groupes":39,
  "ghafir":40,"al-ghafir":40,"pardonneur":40,
  "fussilat":41,"explicitement":41,
  "shura":42,"ash-shura":42,"concertation":42,
  "zukhruf":43,"az-zukhruf":43,"ornements":43,
  "dukhan":44,"ad-dukhan":44,"fumée":44,
  "jathiya":45,"al-jathiya":45,"agenouillée":45,
  "ahqaf":46,"al-ahqaf":46,
  "muhammad":47,"combat":47,
  "fath":48,"al-fath":48,"victoire":48,
  "hujurat":49,"al-hujurat":49,"appartements":49,
  "qaf":50,
  "dhariyat":51,"adh-dhariyat":51,"vents":51,
  "tur":52,"at-tur":52,"mont":52,
  "najm":53,"an-najm":53,"étoile":53,
  "qamar":54,"al-qamar":54,"lune":54,
  "rahman":55,"ar-rahman":55,"miséricordieux":55,
  "waqia":56,"al-waqia":56,"événement":56,
  "hadid":57,"al-hadid":57,"fer":57,
  "mujadila":58,"al-mujadila":58,"discussion":58,
  "hashr":59,"al-hashr":59,"rassemblement":59,
  "mumtahana":60,"al-mumtahana":60,"éprouvée":60,
  "saff":61,"as-saff":61,"rang":61,
  "juma":62,"al-juma":62,"vendredi":62,
  "munafiqun":63,"hypocrites":63,
  "taghabun":64,"at-taghabun":64,"tromperie":64,
  "talaq":65,"at-talaq":65,"divorce":65,
  "tahrim":66,"at-tahrim":66,"interdiction":66,
  "mulk":67,"al-mulk":67,"royauté":67,
  "qalam":68,"al-qalam":68,"plume":68,
  "haqqa":69,"al-haqqa":69,"inévitable":69,
  "maarij":70,"al-maarij":70,"degrés":70,
  "nuh":71,"noé":71,
  "jinn":72,"al-jinn":72,"djinns":72,
  "muzzammil":73,"al-muzzammil":73,"enveloppé":73,
  "muddaththir":74,"al-muddaththir":74,"revêtu":74,
  "qiyama":75,"al-qiyama":75,"résurrection":75,
  "insan":76,"al-insan":76,"homme":76,
  "mursalat":77,"al-mursalat":77,"envoyés":77,
  "naba":78,"an-naba":78,"nouvelle":78,
  "naziat":79,"an-naziat":79,"arracheurs":79,
  "abasa":80,"froncement":80,
  "takwir":81,"at-takwir":81,"obscurcissement":81,
  "infitar":82,"al-infitar":82,"fissure":82,
  "mutaffifin":83,"fraudeurs":83,
  "inshiqaq":84,"al-inshiqaq":84,"déchirement":84,
  "buruj":85,"al-buruj":85,"constellations":85,
  "tariq":86,"at-tariq":86,"nocturne":86,
  "ala":87,"al-ala":87,"très-haut":87,
  "ghashiya":88,"al-ghashiya":88,"enveloppante":88,
  "fajr":89,"al-fajr":89,"aube":89,
  "balad":90,"al-balad":90,"cité":90,
  "shams":91,"ash-shams":91,"soleil":91,
  "layl":92,"al-layl":92,"nuit":92,
  "duha":93,"ad-duha":93,"matinée":93,
  "sharh":94,"inshirah":94,"ouverture de cœur":94,
  "tin":95,"at-tin":95,"figuier":95,
  "alaq":96,"al-alaq":96,"adhérence":96,
  "qadr":97,"al-qadr":97,"destin":97,
  "bayyina":98,"al-bayyina":98,"preuve":98,
  "zalzala":99,"az-zalzala":99,"séisme":99,
  "adiyat":100,"al-adiyat":100,"coursiers":100,
  "qaria":101,"al-qaria":101,"fracas":101,
  "takathur":102,"at-takathur":102,"accumulation":102,
  "asr":103,"al-asr":103,"après-midi":103,
  "humaza":104,"al-humaza":104,"calomniateur":104,
  "fil":105,"al-fil":105,"éléphant":105,
  "quraysh":106,"coréishites":106,
  "maun":107,"al-maun":107,"ustensiles":107,
  "kawthar":108,"al-kawthar":108,"abondance":108,
  "kafirun":109,"al-kafirun":109,"infidèles":109,
  "nasr":110,"an-nasr":110,"secours":110,
  "masad":111,"al-masad":111,"fibre":111,
  "ikhlas":112,"al-ikhlas":112,"sincérité":112,
  "falaq":113,"al-falaq":113,"aube naissante":113,
  "nas":114,"an-nas":114,"humanité":114,
};

// ─── VOICE COMMAND PARSER ─────────────────────────────────────────────────────
export function parseVoiceCommand(transcript, surahs, ayats, currentSurah) {
  const t = transcript.toLowerCase().trim()
    .replace(/[,;.!?]/g, ' ')
    .replace(/\s+/g, ' ');

  // Play / pause / stop
  if (/\b(play|joue|lecture|lire|lancer|démarrer|start)\b/.test(t)) return { action: 'play' };
  if (/\b(pause|pauser|mettre en pause)\b/.test(t)) return { action: 'pause' };
  if (/\b(stop|arrêter|arrête|stopper)\b/.test(t)) return { action: 'stop' };
  if (/\b(suivant|next|verset suivant)\b/.test(t)) return { action: 'next' };
  if (/\b(précédent|retour|previous|verset précédent)\b/.test(t)) return { action: 'prev' };

  // Surah selection: "sourate fatiha", "ouvre al-baqara", "va à la sourate 2"
  const surahByNum = t.match(/\b(?:sourate|surah|sura|ouvre|va à la sourate|va sourate)\s+(\d+)\b/i);
  if (surahByNum) {
    const n = parseInt(surahByNum[1]);
    if (n >= 1 && n <= 114) return { action: 'surah', number: n };
  }
  // By name
  for (const [key, num] of Object.entries(SURAH_NAMES)) {
    if (t.includes(key)) return { action: 'surah', number: num };
  }

  // Ayat: "verset 5", "ayat 12", "va au verset 7", "commence au verset 3"
  const ayatMatch = t.match(/\b(?:verset|ayat|ayah|aya|commence|va au|aller au verset|aller verset)\s+(\d+)\b/i);
  if (ayatMatch) {
    const n = parseInt(ayatMatch[1]);
    return { action: 'ayat', number: n };
  }

  // Loop range: "boucle versets 2 à 5", "répéter 3 à 7", "loop 1 5"
  const loopMatch = t.match(/\b(?:boucle|loop|répéter|répète|lire en boucle)\s+(?:versets?\s+)?(\d+)\s+(?:à|au|jusqu'à|to|-)\s+(\d+)\b/i);
  if (loopMatch) {
    return { action: 'loop', from: parseInt(loopMatch[1]), to: parseInt(loopMatch[2]) };
  }

  // Loop off: "arrêter la boucle", "stop loop"
  if (/\b(arrêter la boucle|stop loop|désactiver boucle|no loop|sans boucle)\b/.test(t)) {
    return { action: 'loop_off' };
  }

  // Repetitions: "répéter 3 fois", "5 fois"
  const repMatch = t.match(/\b(\d+)\s+fois\b/i);
  if (repMatch) return { action: 'repeat', times: parseInt(repMatch[1]) };

  return null;
}
