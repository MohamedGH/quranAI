// ─── Pure Functional Tajweed & Arabic Phonetics Glossary ─────────────────────
// Exhaustive reference of technical terms (Makhârij, Tafkhîm, Sifât, Ahkâm, Madd, Qirâ'ah)

export const GLOSSARY_CATEGORIES = Object.freeze([
  Object.freeze({ id: "all", label: "Tous les termes", childLabel: "Tout voir" }),
  Object.freeze({ id: "tafkhim", label: "Emphase & Résonance", childLabel: "Voix forte & douce" }),
  Object.freeze({ id: "makharij", label: "Points d'articulation", childLabel: "Maisons des lettres" }),
  Object.freeze({ id: "sifat", label: "Attributs (Sifât)", childLabel: "Super-pouvoirs" }),
  Object.freeze({ id: "ahkam", label: "Règles de lecture", childLabel: "Règles magiques" }),
  Object.freeze({ id: "madd_harakat", label: "Voyelles & Madd", childLabel: "Voyelles & signes" }),
  Object.freeze({ id: "quran_sciences", label: "Repères coraniques", childLabel: "Trésors du Coran" }),
]);

const RAW_GLOSSARY_ENTRIES = [
  // ── 1. Emphase & Résonance (Tafkhîm / Tarqîq) ──
  {
    id: "tafkhim",
    term: "Tafkhîm",
    arabic: "تَفْخِيم",
    translit: "Tafkhîm",
    aliases: ["tafkheem", "emphase", "emphatique", "grave", "grossissement"],
    category: "tafkhim",
    shortDef: "Épaississement et résonance grave du son remplissant toute la bouche par élévation du fond de la langue.",
    fullDef:
      "Le Tafkhîm consiste à donner de l'ampleur et de la gravité à une consonne en élevant la racine de la langue vers le voile du palais et en orientant la résonance vers la voûte palatine. Il est permanent pour les 7 lettres d'Isti‘lâ’ (خُصَّ ضَغْطٍ قِظْ) selon 5 degrés décroissants (Ibn al-Jazarî), et contextuel pour le Râ’ (ر), le Lâm de « Allâh » (ل) et l'Alif de prolongation (ا).",
    childDef:
      "C'est le son FORT et GRAVE des lettres championnes ! Tu gonfles la voix dans ta bouche en relevant le fond de ta langue vers le toit de la bouche.",
    letters: ["خ", "ص", "ض", "غ", "ط", "ق", "ظ", "ر", "ل", "ا"],
    example: { arabic: "طَابَ · قَالَ", translit: "Ṭâba · Qâla", meaning: "Son plein et profond (jamais comme un 't' ou 'k' sec)" },
    tip: "Creusez légèrement le centre de la langue (comme une cuillère) et dirigez l'écho vers le palais supérieur.",
    relatedIds: ["tarqiq", "istila", "itbaq", "istiqrar_ra"],
  },
  {
    id: "tarqiq",
    term: "Tarqîq",
    arabic: "تَرْقِيق",
    translit: "Tarqîq",
    aliases: ["tarqeek", "amincissement", "fine", "mince", "douce"],
    category: "tafkhim",
    shortDef: "Prononciation fine, claire et légère d'une lettre sans épaississement, langue détendue vers le bas.",
    fullDef:
      "Le Tarqîq est l'amincissement acoustique d'une consonne. La langue reste abaissée dans le plancher buccal (Istifâl), laissant l'air circuler horizontalement vers l'avant sans résonance gutturale. Toutes les 22 lettres d'Istifâl sont en Tarqîq permanent, sauf cas particuliers de ر, ل et ا.",
    childDef:
      "C'est la voix FINE et DOUCE ! Ta langue reste bien plate et calme en bas de ta bouche, comme un sourire léger.",
    letters: ["ب", "ت", "ث", "ج", "ح", "د", "ذ", "ز", "س", "ش", "ع", "ف", "ك", "م", "ن", "ه", "و", "ي"],
    example: { arabic: "تَابَ · سَمِعَ", translit: "Tâba · Sami‘a", meaning: "Son clair, net et léger vers l'avant" },
    tip: "Ne laissez pas une lettre d'Isti‘lâ’ voisine contaminer une lettre de Tarqîq (ex. évitez d'épaissir le ت dans خَتَمَ).",
    relatedIds: ["tafkhim", "istifal", "infitah"],
  },
  {
    id: "istila",
    term: "Isti‘lâ’",
    arabic: "اسْتِعْلَاء",
    translit: "Isti‘lâ’",
    aliases: ["istila", "elevation", "khussa daghtin qiz"],
    category: "tafkhim",
    shortDef: "Élévation obligatoire de l'arrière de la langue vers le palais mou, cause directe du Tafkhîm.",
    fullDef:
      "Attribut phonétique désignant l'ascension du tiers postérieur de la langue vers le haut du palais lors de l'articulation. Ses 7 lettres sont réunies dans la formule mnémotechnique « خُصَّ ضَغْطٍ قِظْ » (Khuṣṣa ḍaghṭin qiẓ). Contrairement aux lèvres qui ne doivent pas être projetées en avant sans raison, le mouvement se fait à l'intérieur avec la racine linguale.",
    childDef:
      "Quand l'arrière de ta langue monte tout en haut comme un toboggan inversé ! C'est le secret des 7 lettres championnes.",
    letters: ["خ", "ص", "ض", "غ", "ط", "ق", "ظ"],
    example: { arabic: "خُصَّ ضَغْطٍ قِظْ", translit: "Khuṣṣa ḍaghṭin qiẓ", meaning: "Formule des 7 lettres toujours élevées" },
    tip: "Vérifiez dans un miroir que vos lèvres restent naturelles sur une Fatḥa : la lourdeur vient du fond de la bouche, pas d'un arrondissement des lèvres.",
    relatedIds: ["tafkhim", "istifal", "itbaq"],
  },
  {
    id: "istifal",
    term: "Istifâl",
    arabic: "اسْتِفَال",
    translit: "Istifâl",
    aliases: ["abaissement", "langue plate"],
    category: "tafkhim",
    shortDef: "Abaissement naturel de la langue loin du haut du palais, produisant un son fin (Tarqîq).",
    fullDef:
      "Contraire d'Isti‘lâ’, l'Istifâl désigne la posture basse du dos de la langue durant l'émission de 22 lettres de l'alphabet arabe. Le flux sonore sort directement sans compression pharyngienne.",
    childDef:
      "Ta langue reste sagement allongée en bas dans son lit, sans monter toucher le plafond.",
    letters: ["أ", "ب", "ت", "ث", "ج", "ح", "د", "ذ", "ر", "ز", "س", "ش", "ع", "ف", "ك", "ل", "م", "ن", "ه", "و", "ي"],
    example: { arabic: "بِسْمِ اللَّهِ", translit: "Bismi Llâh", meaning: "Le Bâ’ et le Sîn gardent une langue basse et fine" },
    tip: "Maintenez l'arrière de la langue détendu même avant une lettre grave.",
    relatedIds: ["tarqiq", "istila", "infitah"],
  },
  {
    id: "itbaq",
    term: "Itbâq",
    arabic: "إِطْبَاق",
    translit: "Iṭbâq",
    aliases: ["adhesion", "enfermement", "cuillere"],
    category: "tafkhim",
    shortDef: "Enfermement maximal du son entre le plat de la langue relevé en cuillère et le palais dur.",
    fullDef:
      "Degré suprême de l'emphase propre aux 4 lettres « ص ض ط ظ ». En plus de l'élévation de la racine (Isti‘lâ’), la grande partie centrale de la langue s'élève et s'approche étroitement de la voûte palatine, comprimant l'onde acoustique dans une cavité en forme de cuillère. Ces 4 lettres restent très emphatiques même avec une Kasra.",
    childDef:
      "Le super-pouvoir des 4 méga-champions (ص ض ط ظ) ! Ta langue forme une cuillère qui plaque l'écho contre le plafond de la bouche.",
    letters: ["ص", "ض", "ط", "ظ"],
    example: { arabic: "الصِّرَاطَ · عَظِيم", translit: "Aṣ-ṣirâṭa · ‘Aẓîm", meaning: "Emphase maximale maintenue même sous Kasra" },
    tip: "Ne relâchez jamais la cuillère de la langue lorsque ص, ض, ط ou ظ portent une Kasra.",
    relatedIds: ["tafkhim", "istila", "infitah"],
  },
  {
    id: "infitah",
    term: "Infitâḥ",
    arabic: "انْفِتَاح",
    translit: "Infitâḥ",
    aliases: ["ouverture", "detachement"],
    category: "tafkhim",
    shortDef: "Ouverture entre la masse de la langue et le palais permettant à l'air de s'échapper librement.",
    fullDef:
      "Contraire d'Iṭbâq, l'Infitâḥ concerne les 25 autres lettres de l'alphabet arabe (y compris ق, غ, خ qui sont élevées à l'arrière mais ouvertes au milieu/devant). Ainsi, ق, غ et خ s'adoucissent nettement lorsqu'elles portent une Kasra.",
    childDef:
      "Il reste un couloir d'air ouvert entre le milieu de ta langue et le toit de ta bouche.",
    letters: ["ق", "غ", "خ", "ت", "د", "س", "ك"],
    example: { arabic: "قِيلَ · خِيفَة", translit: "Qîla · Khîfah", meaning: "Avec Kasra, ق et خ sont bien moins fermés que ط ou ص" },
    tip: "Comparez قِ (Qaf + Kasra, ouvert) avec طِ (Ta + Kasra, fermé par Itbâq).",
    relatedIds: ["itbaq", "istifal", "tafkhim"],
  },
  {
    id: "istiqrar_ra",
    term: "Tafkhîm / Tarqîq du Râ’",
    arabic: "أَحْكَامُ الرَّاء",
    translit: "Aḥkâm ar-Râ’",
    aliases: ["ra", "ahkam ra", "regle du ra"],
    category: "tafkhim",
    shortDef: "Règle selon laquelle la lettre ر est grave (Fatḥa/Ḍamma) ou fine (Kasra).",
    fullDef:
      "La lettre ر alterne entre Tafkhîm et Tarqîq selon sa voyelle ou la voyelle précédente en cas de Sukûn : grave avec Fatḥa ou Ḍamma (رَ / رُ) ; fine avec Kasra (رِ), après Sukûn précédé d'une Kasra originale sans lettre d'Isti‘lâ’ suivante, ou après un Yâ’ Sâkin (خَيْر).",
    childDef:
      "La lettre R (ر) est un caméléon ! Elle devient forte avec A ou OU, et toute douce avec I.",
    letters: ["ر"],
    example: { arabic: "رَبَّنَا (grave) · رِزْقًا (fine)", translit: "Rabbanâ · Rizqan", meaning: "Le ر change de couleur selon sa voyelle" },
    tip: "Attention au ر Sâkin en fin de mot à l'arrêt : regardez la voyelle de la lettre qui le précède.",
    relatedIds: ["tafkhim", "tarqiq", "takrir"],
  },

  // ── 2. Points d'articulation (Makhârij al-Ḥurûf) ──
  {
    id: "makhraj",
    term: "Makhraj (pl. Makhârij)",
    arabic: "مَخْرَج / مَخَارِج",
    translit: "Makhraj / Makhârij",
    aliases: ["makharij", "makharej", "point d articulation", "sortie"],
    category: "makharij",
    shortDef: "Endroit anatomique exact où l'air et la vibration s'appuient pour donner naissance à une lettre.",
    fullDef:
      "Selon la classification d'Al-Khalîl ibn Aḥmad et d'Ibn al-Jazarî, il existe 5 zones générales (Al-Makhârij al-‘Âmmah) regroupant 17 points d'articulation précis (Al-Makhârij al-Khâṣṣah). Pour repérer le Makhraj exact d'une lettre, prononcez-la avec un Sukûn précédé d'une Hamza : أَبْ · أَتْ · أَقْ.",
    childDef:
      "C'est la « maison » exacte dans ta bouche ou ta gorge d'où sort chaque lettre !",
    letters: ["أ", "ب", "ت", "ق", "ل", "م", "ن"],
    example: { arabic: "أَتْ · أَطْ · أَقْ", translit: "At · Aṭ · Aq", meaning: "Tester avec Hamza + Sukûn révèle la zone exacte" },
    tip: "Astuce d'or : posez un Sukûn sur la lettre et ajoutez « أَ » devant pour sentir exactement où l'organe touche.",
    relatedIds: ["jawf", "halq", "lisan", "shafatayn", "khayshum", "sifat"],
  },
  {
    id: "jawf",
    term: "Al-Jawf",
    arabic: "الجَوْف",
    translit: "Al-Jawf",
    aliases: ["cavite buccale", "vide", "lettres al-madd"],
    category: "makharij",
    shortDef: "Espace vide continu de la gorge et de la bouche d'où sortent les 3 voyelles longues (ا و ي).",
    fullDef:
      "Makhraj estimé (Muqaddar) sans contact physique précis : l'air vibre librement à travers tout le conduit pharyngo-buccal pour produire l'Alif (ا précédé de Fatḥa), le Wâw Maddiyyah (وْ précédé de Ḍamma) et le Yâ’ Maddiyyah (يْ précédé de Kasra).",
    childDef:
      "Le grand toboggan d'air libre entre la gorge et les lèvres pour chanter longuement ÂÂ, OÛÛ, ÎÎ !",
    letters: ["ا", "و", "ي"],
    example: { arabic: "نُوحِيهَا", translit: "Nûḥîhâ", meaning: "Réunit les 3 lettres du Jawf en un seul mot coranique" },
    tip: "Ne coupez pas le son du Madd par un souffle nasal : gardez le passage buccal ouvert sans bloquer.",
    relatedIds: ["makhraj", "madd", "khayshum"],
  },
  {
    id: "halq",
    term: "Al-Ḥalq",
    arabic: "الحَلْق",
    translit: "Al-Ḥalq",
    aliases: ["halq", "gorge", "gutturales"],
    category: "makharij",
    shortDef: "La gorge, divisée en 3 étages pour les 6 lettres gutturales (أ ه / ع ح / غ خ).",
    fullDef:
      "Comprend trois points précis : 1) Fond de gorge (Aqṣâ al-Ḥalq) : أ et ه ; 2) Milieu de gorge / épiglotte (Wasaṭ al-Ḥalq) : ع et ح ; 3) Haut de gorge / luette-racine (Adnâ al-Ḥalq) : غ et خ. Ces 6 lettres déclenchent également la règle d'Iẓhâr après Nûn Sâkin.",
    childDef:
      "La grotte de la gorge avec ses 3 étages : tout en bas (أ ه), au milieu (ع ح) et tout en haut (غ خ).",
    letters: ["أ", "ه", "ع", "ح", "غ", "خ"],
    example: { arabic: "إِنْ هُوَ · أَنْعَمْتَ", translit: "In huwa · An‘amta", meaning: "Lettres gutturales claires sans nasalisation" },
    tip: "Distinguez bien le fond (هـ) du milieu (ح) en pressant légèrement l'épiglotte sur ح et ع.",
    relatedIds: ["makhraj", "izhar", "tafkhim"],
  },
  {
    id: "lisan",
    term: "Al-Lisân",
    arabic: "اللِّسَان",
    translit: "Al-Lisân",
    aliases: ["lisan", "langue"],
    category: "makharij",
    shortDef: "La langue, organe majeur regroupant 10 points d'articulation précis pour 18 lettres arabes.",
    fullDef:
      "Divisé anatomiquement en racine (ق ك), dos médian (ج ش ي), bords latéraux (ض ل) et pointe/apex (ن ر ت ط د ص ز س ظ ذ ث). C'est l'organe dont les nuances millimétriques différencient le plus grand nombre de lettres jumelles.",
    childDef:
      "La langue magicienne ! Elle touche le fond, le milieu, les côtés ou les dents pour créer 18 lettres.",
    letters: ["ق", "ك", "ج", "ش", "ي", "ض", "ل", "ن", "ر", "ت", "ط", "د", "ص", "ز", "س", "ظ", "ذ", "ث"],
    example: { arabic: "ت · ط · د", translit: "Ta · Ṭa · Dal", meaning: "Trois lettres partageant la même pointe de langue sur la gencive" },
    tip: "Appuyez la pointe de la langue aux endroits exacts : base des incisives pour ت/د/ط, bout des incisives pour ث/ذ/ظ.",
    relatedIds: ["makhraj", "itbaq", "istitalah"],
  },
  {
    id: "shafatayn",
    term: "Ash-Shafatân",
    arabic: "الشَّفَتَان",
    translit: "Ash-Shafatân",
    aliases: ["shafatayn", "levres", "labiales"],
    category: "makharij",
    shortDef: "Les deux lèvres, produisant les 4 lettres labiales : ف (lèvre-dents) et ب م و (deux lèvres).",
    fullDef:
      "Deux points précis : 1) L'intérieur de la lèvre inférieure contre le tranchant des incisives supérieures pour ف ; 2) Les deux lèvres ensemble pour ب (occlusion ferme), م (occlusion douce + Khayshûm) et و consonne (arrondissement sans fermeture complète).",
    childDef:
      "Les deux portes des lèvres ! Elles ferment fort pour ب, doucement pour م, font un bisou rond pour و, et les dents mordillent pour ف.",
    letters: ["ف", "ب", "م", "و"],
    example: { arabic: "فَبِمَا · وَالْفَجْرِ", translit: "Fabimâ · Wal-fajr", meaning: "Enchaînement complet des lettres labiales" },
    tip: "Pour و consonne, laissez un petit trou rond entre les lèvres afin que l'air ne reste pas coincé.",
    relatedIds: ["makhraj", "khayshum", "idgham"],
  },
  {
    id: "khayshum",
    term: "Al-Khayshûm",
    arabic: "الخَيْشُوم",
    translit: "Al-Khayshûm",
    aliases: ["cavite nasale", "nez", "nasalisation"],
    category: "makharij",
    shortDef: "Cavité nasale située au-dessus du palais d'où sort le son nasal (Ghunnah) de ن et م.",
    fullDef:
      "Point d'articulation exclusif de la résonance nasale (Ghunnah). Il accompagne systématiquement la lettre ن (y compris Tanwîn) et la lettre م, et s'allonge à 2 temps lors d'Ikhfâ’, Idghâm bi-Ghunnah, Iqlâb et Nûn/Mîm Mushaddadah.",
    childDef:
      "La petite clochette dans ton nez qui vibre doucement quand tu dis N (ن) ou M (م) !",
    letters: ["ن", "م"],
    example: { arabic: "إِنَّ · ثُمَّ", translit: "Inna · Thumma", meaning: "Vibre 2 temps dans le nez" },
    tip: "Pincez brièvement le nez sur إِنَّ : si le son s'arrête, votre Ghunnah vient bien du Khayshûm !",
    relatedIds: ["ghunnah", "ikhfa", "iqlab", "makhraj"],
  },

  // ── 3. Attributs phonétiques (Sifât) ──
  {
    id: "sifat",
    term: "Ṣifât al-Ḥurûf",
    arabic: "صِفَاتُ الحُرُوف",
    translit: "Ṣifât al-Ḥurûf",
    aliases: ["sifat", "attributs", "caracteristiques", "qualites"],
    category: "sifat",
    shortDef: "Qualités phonétiques (souffle, intensité, élévation, vibration) distinguant les lettres d'un même Makhraj.",
    fullDef:
      "Si le Makhraj indique le lieu de naissance du son, les Ṣifât décrivent sa manière d'être produit. Elles se divisent en 10 attributs par paires opposées (ex. Hams/Jahr, Shiddah/Rakhâwah, Isti‘lâ’/Istifâl, Iṭbâq/Infitâḥ, Idhlâq/Iṣmât + Tawassuṭ) et 7 à 9 attributs uniques sans contraire (Qalqalah, Ṣafîr, Lîn, Inḥirâf, Takrîr, Tafash-shî, Istiṭâlah, Ghunnah).",
    childDef:
      "Les « super-pouvoirs » des lettres ! C'est grâce à eux qu'on ne confond pas ت, ط et د même s'ils habitent la même maison.",
    letters: ["ت", "ط", "د", "س", "ص", "ز"],
    example: { arabic: "ت (Hams) vs د (Jahr) vs ط (Tafkhîm)", translit: "Ta / Dal / Ṭa", meaning: "Même Makhraj, Sifât distinctes" },
    tip: "Deux lettres au même Makhraj ne se confondent jamais si l'on respecte leurs Sifât opposées.",
    relatedIds: ["makhraj", "hams", "jahr", "qalqalah", "safir"],
  },
  {
    id: "hams",
    term: "Hams",
    arabic: "هَمْس",
    translit: "Hams",
    aliases: ["souffle", "chuchote", "mahmusah"],
    category: "sifat",
    shortDef: "Écoulement libre du souffle (sans vibration des cordes vocales) pour les 10 lettres « فَحَثَّهُ شَخْصٌ سَكَتْ ».",
    fullDef:
      "Légèreté de l'appui au Makhraj permettant à un filet d'air audible de s'échapper avec la lettre, particulièrement audible sur Sukûn (ex. أَكْ · أَتْ). À doser finement sur ك et ت pour ne pas transformer le Hams en voyelle parasite ou en chuintement exagéré.",
    childDef:
      "Une petite brise d'air doux qui souffle avec la lettre, comme sur F (ف), S (س) ou K (ك) avec Sukûn !",
    letters: ["ف", "ح", "ث", "ه", "ش", "خ", "ص", "س", "ك", "ت"],
    example: { arabic: "فَحَثَّهُ شَخْصٌ سَكَتْ", translit: "Faḥaththahu shakhṣun sakat", meaning: "Les 10 lettres à souffle libre" },
    tip: "Placez la main devant la bouche sur أَكْ et أَتْ : vous devez sentir un souffle bref après le blocage.",
    relatedIds: ["jahr", "shiddah", "sifat"],
  },
  {
    id: "jahr",
    term: "Jahr",
    arabic: "جَهْر",
    translit: "Jahr",
    aliases: ["sonore", "vocalise", "corde vocale"],
    category: "sifat",
    shortDef: "Retenue du souffle par fermeture et vibration nette des cordes vocales (19 lettres opposées au Hams).",
    fullDef:
      "Appui ferme au Makhraj empêchant la fuite d'air brut. Le son est riche en vibration vocale (ex. ب, د, ج, ذ, ز, ط, ض, ع, غ, ق). Ne laissez pas de souffle d'air s'échapper sur ط ou ض !",
    childDef:
      "Ta voix résonne dans ta gorge sans souffler d'air gaspillé !",
    letters: ["أ", "ب", "ج", "د", "ذ", "ر", "ز", "ض", "ط", "ظ", "ع", "غ", "ق", "ل", "م", "ن", "و", "ي"],
    example: { arabic: "ذٰلِكَ · عَظِيم", translit: "Dhâlika · ‘Aẓîm", meaning: "Pas de fuite de souffle : vibration pure" },
    tip: "Sur ط (contrairement au T français), retenez tout souffle : pas de 't-h', mais une vibration franche.",
    relatedIds: ["hams", "qalqalah", "sifat"],
  },
  {
    id: "shiddah",
    term: "Shiddah",
    arabic: "شِدَّة",
    translit: "Shiddah",
    aliases: ["intensite", "occlusion", "ajid qatin bakat"],
    category: "sifat",
    shortDef: "Blocage instantané et complet du flux sonore au point d'articulation (« أَجِدْ قَطٍ بَكَتْ »).",
    fullDef:
      "Fermeture hermétique du passage de l'air durant l'instant articulatoire de ces 8 lettres. Les lettres de Shiddah + Jahr (ق ط ب ج د) nécessitent un Qalqalah pour libérer le son bloqué ; celles de Shiddah + Hams (ك ت) se libèrent par un petit souffle (Hams).",
    childDef:
      "La porte se ferme d'un coup sec ! Le son s'arrête net comme sur B (ب), D (د) ou K (ك).",
    letters: ["أ", "ج", "د", "ق", "ط", "ب", "ك", "ت"],
    example: { arabic: "أَجِدْ قَطٍ بَكَتْ", translit: "Ajid qaṭin bakat", meaning: "Les 8 lettres explosives à arrêt total du son" },
    tip: "Ne faites jamais traîner un بْ ou un دْ comme une voyelle continue : bloquez puis relâchez proprement.",
    relatedIds: ["tawassut", "rakhawah", "qalqalah", "hams"],
  },
  {
    id: "tawassut",
    term: "Tawassuṭ (Bayniyyah)",
    arabic: "تَوَسُّط / بَيْنِيَّة",
    translit: "Tawassuṭ / Bayniyyah",
    aliases: ["intermediaire", "lin umar", "modere"],
    category: "sifat",
    shortDef: "Écoulement partiel et équilibré du son pour les 5 lettres de « لِنْ عُمَرْ » (ل ن ع م ر).",
    fullDef:
      "Position phonétique exactement intermédiaire entre l'arrêt total (Shiddah) et l'écoulement prolongé (Rakhâwah). L'air est partiellement freiné au point d'articulation tout en continuant à vibrer par un passage latéral ou nasal.",
    childDef:
      "Ni tout à fait fermé, ni tout à fait ouvert : la voix glisse juste ce qu'il faut sur L, N, ‘Ayn, M et R !",
    letters: ["ل", "ن", "ع", "م", "ر"],
    example: { arabic: "لِنْ عُمَرْ", translit: "Lin ‘Umar", meaning: "Les 5 lettres à écoulement modéré" },
    tip: "Évitez de couper sèchement un عْ ou un مْ avec un rebond (pas de Qalqalah sur لِنْ عُمَرْ !).",
    relatedIds: ["shiddah", "rakhawah", "ghunnah"],
  },
  {
    id: "rakhawah",
    term: "Rakhâwah",
    arabic: "رَخَاوَة",
    translit: "Rakhâwah",
    aliases: ["fluidite", "frottement", "continu"],
    category: "sifat",
    shortDef: "Écoulement continu et fluide du son le long du Makhraj pour les 16 lettres fricatives/ouvertes.",
    fullDef:
      "Contraire de Shiddah : le canal buccal ne se ferme pas complètement, permettant de prolonger la consonne Sâkinah naturellement sans heurt ni rebond (ex. سْ, شْ, حْ, فْ, ذْ, ضْ). Leur durée sur Sukûn est plus longue que celle de Tawassuṭ et de Shiddah.",
    childDef:
      "Le son coule doucement comme de l'eau qui glisse sans être bloquée !",
    letters: ["ث", "ح", "خ", "ذ", "ز", "س", "ش", "ص", "ض", "ظ", "غ", "ف", "ه", "و", "ي", "ا"],
    example: { arabic: "الْحَمْدُ · وَالضُّحَى", translit: "Al-ḥamdu · Waḍ-ḍuḥâ", meaning: "Le حْ ou le ضّ s'écoule sans coupure" },
    tip: "Sur ضْ ou ذْ portant Sukûn, prenez le temps de laisser résonner la fricative avant la lettre suivante.",
    relatedIds: ["shiddah", "tawassut", "istitalah"],
  },
  {
    id: "qalqalah",
    term: "Qalqalah",
    arabic: "قَلْقَلَة",
    translit: "Qalqalah",
    aliases: ["qalqala", "rebond", "echo", "qutbu jaddin"],
    category: "sifat",
    shortDef: "Vibration / rebond acoustique clair qui libère une des 5 lettres « قُطْبُ جَدّ » lorsqu'elle porte Sukûn.",
    fullDef:
      "Les 5 lettres ق, ط, ب, ج, د réunissent blocage du son (Shiddah) et rétention du souffle (Jahr). Pour qu'elles restent audibles en position Sâkinah, on relâche le Makhraj d'un léger rebond sec sans y ajouter aucune voyelle (ni a, ni i, ni u). On distingue la petite Qalqalah (Ṣughrâ, milieu de mot) de la grande (Kubrâ, à l'arrêt) et majeure (Akbar, sur Shaddah à l'arrêt).",
    childDef:
      "Le petit rebond d'écho comme une balle qui tape une fois ! Marche sur ق ط ب ج د quand elles se reposent (Sukûn).",
    letters: ["ق", "ط", "ب", "ج", "د"],
    example: { arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ (arrêt : أَحَدْ)", translit: "Aḥad(e)", meaning: "Rebond franc sur le د final à l'arrêt" },
    tip: "Le rebond doit rester neutre : ne le colorez ni en Fatḥa, ni en Kasra, ni en Ḍamma.",
    relatedIds: ["shiddah", "jahr", "sukun"],
  },
  {
    id: "safir",
    term: "Ṣafîr",
    arabic: "صَفِير",
    translit: "Ṣafîr",
    aliases: ["safir", "sifflement", "sifflantes"],
    category: "sifat",
    shortDef: "Sifflement aigu et cristallin produit par l'air passant entre la pointe de la langue et les incisives (ص ز س).",
    fullDef:
      "Attribut acoustique spécifique aux 3 lettres sifflantes : ص (sifflement lourd/emphatique), ز (sifflement voisé/vibrant) et س (sifflement fin/clair). L'air passe dans un étroit couloir vers les incisives inférieures et supérieures.",
    childDef:
      "Le bruit de petit serpent qui siffle proprement : ص (gros sifflement), س (fin sifflement), ز (abeille qui vibre).",
    letters: ["ص", "ز", "س"],
    example: { arabic: "الصَّمَدُ · زَكِيًّا · السَّمَاء", translit: "Aṣ-Ṣamad · Zakiyyâ · As-Samâ’", meaning: "Netteté du sifflement sans toucher les dents avec le bout de langue" },
    tip: "Ne placez jamais la pointe de la langue ENTRE les dents pour س/ص/ز (sinon cela devient ث/ظ/ذ).",
    relatedIds: ["sifat", "tafkhim", "lisan"],
  },
  {
    id: "ghunnah",
    term: "Ghunnah",
    arabic: "غُنَّة",
    translit: "Ghunnah",
    aliases: ["ghunna", "nasalisation", "nez", "nasillement"],
    category: "sifat",
    shortDef: "Résonance nasale douce et chantante (2 temps complets sur نّ, مّ, Ikhfâ’, Idghâm et Iqlâb).",
    fullDef:
      "Son harmonique sortant exclusivement du Khayshûm (cavité nasale). Elle est inhérente à ن et م à 4 niveaux d'intensité : maximal (نّ / مّ et Idghâm complet), complet (Ikhfâ’ / Iqlâb, 2 temps), moyen (Sâkin avec Iẓhâr) et léger (voyellisé).",
    childDef:
      "La jolie musique qui passe par le nez pendant 2 petits battements sur نّ et مّ !",
    letters: ["ن", "م"],
    example: { arabic: "مِنَ الْجِنَّةِ وَالنَّاسِ", translit: "Mina l-jinnati wan-nâs", meaning: "Tenir 2 temps sur نَّ" },
    tip: "Comptez deux temps stables (environ 1 seconde calme) sans forcer ni boucher le nez.",
    relatedIds: ["khayshum", "ikhfa", "idgham", "iqlab"],
  },
  {
    id: "istitalah",
    term: "Istiṭâlah",
    arabic: "اسْتِطَالَة",
    translit: "Istiṭâlah",
    aliases: ["istitala", "allongement langue", "dad"],
    category: "sifat",
    shortDef: "Glissement progressif du bord de la langue de l'arrière vers l'avant des molaires, exclusif à la lettre ض.",
    fullDef:
      "Attribut unique de la lettre Ḍâd (ض) qui lui vaut le surnom de « Lughat aḍ-Ḍâd ». Sous la pression de l'air retenu derrière les bords latéraux de la langue contre les molaires supérieures, la langue glisse légèrement vers l'avant jusqu'à atteindre l'origine du Lâm.",
    childDef:
      "Le pouvoir exclusif du champion ض : les côtés de la langue glissent doucement le long des dents du fond !",
    letters: ["ض"],
    example: { arabic: "وَلَا الضَّالِّينَ", translit: "Wa lâ ḍ-ḍâllîn", meaning: "Plénitude latérale sans jamais ressembler à un د ou ظ" },
    tip: "Ne sortez pas la pointe de la langue entre les dents (ce serait ظ) : gardez la pointe à l'intérieur derrière les incisives.",
    relatedIds: ["itbaq", "rakhawah", "lisan"],
  },
  {
    id: "tafashshi",
    term: "Tafash-shî",
    arabic: "تَفَشِّي",
    translit: "Tafash-shî",
    aliases: ["tafashshi", "diffusion air", "shin"],
    category: "sifat",
    shortDef: "Diffusion ample et douce du souffle d'air dans toute la cavité buccale, exclusif à la lettre ش.",
    fullDef:
      "Lors de l'articulation du Shîn (ش) au milieu de la langue, le souffle se répand généreusement vers les incisives supérieures et inférieures avant de sortir. Plus marqué sur شّ (géminé) et شْ (Sukûn).",
    childDef:
      "Le grand « CHHH » doux qui remplit toute la bouche comme le vent dans les feuilles sur ش !",
    letters: ["ش"],
    example: { arabic: "الشَّمْسُ · رُشْدًا", translit: "Ash-shamsu · Rushdâ", meaning: "Souffle diffus et non sifflé" },
    tip: "Veillez à ne pas avancer les lèvres en moue : la diffusion doit se faire dans la bouche, non par les lèvres.",
    relatedIds: ["hams", "rakhawah", "lisan"],
  },
  {
    id: "takrir",
    term: "Takrîr",
    arabic: "تَكْرِير",
    translit: "Takrîr",
    aliases: ["vibration", "roulage", "ra"],
    category: "sifat",
    shortDef: "Légère vibration naturelle de la pointe de la langue sur ر — connue précisément pour éviter d'en abuser.",
    fullDef:
      "La pointe de la langue a tendance à vibrer plusieurs fois contre la gencive lors de la prononciation du Râ’ (ر). En Tajweed, on étudie le Takrîr afin de la limiter à UNE seule légère frappe souple sans jamais rouler un R multiple ni étouffer totalement l'écoulement.",
    childDef:
      "Attention : la pointe de ta langue ne doit vibrer qu'une toute petite fois sur ر, pas comme un moteur !",
    letters: ["ر"],
    example: { arabic: "الرَّحْمٰنِ", translit: "Ar-Raḥmân", meaning: "Un Râ’ net, sans roulement exagéré (2–3 battements interdits)" },
    tip: "Laissez un micro-espace au milieu du bout de la langue (Inḥirâf) pour éviter que l'air ne la fasse rebondir en rafale.",
    relatedIds: ["inhiraf", "tawassut", "istiqrar_ra"],
  },
  {
    id: "inhiraf",
    term: "Inḥirâf",
    arabic: "انْحِرَاف",
    translit: "Inḥirâf",
    aliases: ["deviation", "lam", "ra"],
    category: "sifat",
    shortDef: "Déviation naturelle du flux sonore sur les côtés pour ل ou vers le centre pour ر.",
    fullDef:
      "Lorsqu'on prononce ل, la pointe bloque le centre de la gencive et le son dévie par les bords latéraux de la langue. Inversement, sur ر, les bords appuient et le son passe par un petit creux central à la pointe.",
    childDef:
      "L'air contourne gentiment la langue sur les côtés pour L (ل) ou par le petit tunnel au milieu pour R (ر).",
    letters: ["ل", "ر"],
    example: { arabic: "الْحَمْدُ · رَبِّ", translit: "Al-ḥamdu · Rabbi", meaning: "Fluide sans blocage brutal" },
    tip: "Si le Râ’ est étouffé, desserrez à peine le centre du bout de la langue.",
    relatedIds: ["takrir", "tawassut"],
  },
  {
    id: "lin",
    term: "Lîn",
    arabic: "لِين",
    translit: "Lîn",
    aliases: ["douceur", "diphtongue", "madd lin"],
    category: "sifat",
    shortDef: "Douceur fluide de وْ et يْ Sâkin précédés d'une Fatḥa (ex. خَوْف · بَيْت).",
    fullDef:
      "Qualité d'émission souple et sans effort pour le Wâw et le Yâ’ muets après une voyelle « a » (Fatḥa). À l'arrêt sur le mot suivant (Madd al-Lîn), cette diphtongue peut être allongée de 2, 4 ou 6 temps (ex. قُرَيْشٍ · خَوْفٍ).",
    childDef:
      "Un son tout doux qui glisse comme « AW » et « AY » avant de s'arrêter (خَوْف · بَيْت).",
    letters: ["و", "ي"],
    example: { arabic: "لِإِيلَافِ قُرَيْشٍ · مِنْ خَوْفٍ", translit: "Quraysh · Khawf", meaning: "Allongement doux possible à l'arrêt" },
    tip: "En cours de lecture continue, la lettre de Lîn garde sa durée normale ; on ne l'allonge qu'à l'arrêt (Waqf).",
    relatedIds: ["madd", "waqf", "jawf"],
  },

  // ── 4. Règles de lecture (Aḥkâm an-Nûn / Mîm / Lâms) ──
  {
    id: "izhar",
    term: "Iẓhâr",
    arabic: "إِظْهَار",
    translit: "Iẓhâr",
    aliases: ["izhar", "clair", "nettete", "gutturales"],
    category: "ahkam",
    shortDef: "Prononciation nette et claire de Nûn Sâkin / Tanwîn devant les 6 lettres de la gorge (أ ه ع ح غ خ), ou de Mîm Sâkin devant 26 lettres.",
    fullDef:
      "Signifie « manifester clairement ». Lorsque نْ ou un Tanwîn (ـً ـٍ ـٌ) est suivi d'une des 6 lettres gutturales (أ ه ع ح غ خ), le Nûn est articulé distinctement au bout de la langue avec son Makhraj complet, sans allongement nasal supplémentaire ni pause.",
    childDef:
      "Règle « BIEN CLAIR » ! Quand نْ ou un Tanwîn voit une lettre de la gorge, on prononce le N bien net sans le rallonger.",
    letters: ["أ", "ه", "ع", "ح", "غ", "خ"],
    example: { arabic: "مَنْ آمَنَ · أَنْعَمْتَ", translit: "Man âmana · An‘amta", meaning: "Le N sonne court, franc et net" },
    tip: "Ne faites ni rebond ni coupure de souffle (Saktah) entre le نْ et la lettre gutturale.",
    relatedIds: ["halq", "idgham", "ikhfa", "iqlab"],
  },
  {
    id: "idgham",
    term: "Idghâm",
    arabic: "إِدْغَام",
    translit: "Idghâm",
    aliases: ["fusion", "assimilation", "yarmalun"],
    category: "ahkam",
    shortDef: "Fusion du Nûn Sâkin / Tanwîn dans l'une des 6 lettres de « يَرْمَلُون », avec Ghunnah (ي ن م و) ou sans (ل ر).",
    fullDef:
      "Assimilation consistant à faire entrer une lettre Sâkinah dans une lettre voyellisée suivante pour n'en prononcer qu'une consonne renforcée. Pour Nûn Sâkin/Tanwîn devant يَرْمَلُون : Idghâm bi-Ghunnah (2 temps) avec « ي ن م و », et Idghâm bi-lâ Ghunnah (fusion sèche sans nez) avec « ل ر ». S'applique uniquement entre deux mots distincts.",
    childDef:
      "La FUSION magique ! Le نْ disparaît et se fond dans la lettre suivante de « يَرْمَلُون » (avec musique du nez pour ي ن م و, sans nez pour ل ر).",
    letters: ["ي", "ر", "م", "ل", "و", "ن"],
    example: { arabic: "مَن يَقُولُ · مِن رَّبِّهِمْ", translit: "May-yaqûl · Mir-rabbihim", meaning: "Fusion dans ي avec nez ; fusion dans ر sans nez" },
    tip: "Dans un seul mot (دُنْيَا, قِنْوَان), on ne fusionne jamais : c'est Iẓhâr Muṭlaq !",
    relatedIds: ["izhar", "ikhfa", "ghunnah", "shamsiyyah"],
  },
  {
    id: "iqlab",
    term: "Iqlâb",
    arabic: "إِقْلَاب",
    translit: "Iqlâb",
    aliases: ["iqlab", "transformation", "mim cache"],
    category: "ahkam",
    shortDef: "Transformation du Nûn Sâkin / Tanwîn en Mîm léger nasalisé (2 temps) lorsqu'il précède un ب.",
    fullDef:
      "Signifie « retournement / conversion ». Devant la lettre labiale ب, le نْ (ou Tanwîn) se change en م léger accompagné d'une Ghunnah de 2 temps. Dans le Mushaf, ce repère est signalé par un petit م (مـ) imprimé au-dessus du ن ou remplaçant le second signe du Tanwîn.",
    childDef:
      "Le déguisement ! Quand نْ rencontre ب, il se transforme en un doux M (م) dans le nez pendant 2 temps.",
    letters: ["ب"],
    example: { arabic: "مِنۢ بَعْدِ · سَمِيعٌۢ بَصِير", translit: "Mim-ba‘di · Samî‘um-baṣîr", meaning: "Contact doux des lèvres puis ouverture sur ب" },
    tip: "Ne serrez pas les lèvres excessivement fort pendant le م d'Iqlâb ; effleurez-les doucement avec 2 temps de Ghunnah.",
    relatedIds: ["ghunnah", "shafatayn", "ikhfa"],
  },
  {
    id: "ikhfa",
    term: "Ikhfâ’",
    arabic: "إِخْفَاء",
    translit: "Ikhfâ’",
    aliases: ["ikhfa", "dissimulation", "cache"],
    category: "ahkam",
    shortDef: "Dissimulation du نْ / Tanwîn (ou مْ devant ب) avec résonance nasale de 2 temps devant les 15 autres lettres.",
    fullDef:
      "État phonétique subtil à mi-chemin entre l'Iẓhâr (netteté) et l'Idghâm (fusion), devant les 15 lettres restantes après retrait de la gorge (6), يَرْمَلُون (6) et ب (1). La pointe de la langue NE touche PAS le palais : elle se prépare déjà au Makhraj de la lettre suivante pendant que la Ghunnah résonne 2 temps (épaisse devant les lettres de Tafkhîm, fine devant les lettres de Tarqîq).",
    childDef:
      "Cache-cache ! La langue reste en suspens sans toucher le toit de la bouche pendant que le nez chante 2 temps vers la lettre d'après.",
    letters: ["ت", "ث", "ج", "د", "ذ", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ف", "ق", "ك"],
    example: { arabic: "مِن تَحْتِهَا (fin) · مِن قَبْلُ (grave)", translit: "Mi(n) taḥtihâ · Mi(n) qablu", meaning: "La Ghunnah d'Ikhfâ’ prend la couleur fine ou grave de la lettre suivante" },
    tip: "Attention : la Ghunnah d'Ikhfâ’ devant ق, ط, ظ, ص, ض doit être elle aussi emphatique (Tafkhîm) !",
    relatedIds: ["ghunnah", "izhar", "idgham", "tafkhim"],
  },
  {
    id: "shamsiyyah",
    term: "Lâm Shamsiyyah (Lettre Solaire)",
    arabic: "لَامٌ شَمْسِيَّة",
    translit: "Al-Lâm ash-Shamsiyyah",
    aliases: ["solaire", "lettre solaire", "shamsiya"],
    category: "ahkam",
    shortDef: "Assimilation complète du « ل » de l'article « ال » dans l'une des 14 lettres solaires qui reçoit alors une Shaddah.",
    fullDef:
      "Devant 14 consonnes proches du Makhraj du Lâm (ت ث د ذ ر ز س ش ص ض ط ظ ل ن), le ل de l'article défini « ال » devient muet à l'oral et fusionne (Idghâm) dans la consonne suivante qui est doublée (Shaddah), comme dans « الشَّمْس » (Ash-Shams).",
    childDef:
      "Comme le SOLEIL (الشَّمْس) ! Le L devient invisible à l'oral et double la lettre qui le suit : Ash-Shams.",
    letters: ["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ل", "ن"],
    example: { arabic: "الشَّمْس · النَّاس · الصَّلَاة", translit: "Ash-Shams · An-Nâs · Aṣ-Ṣalâh", meaning: "On ne prononce jamais le L de Al-" },
    tip: "Repérez la petite Shaddah (ّ) placée juste après « ال » dans le Coran : elle signale une lettre solaire.",
    relatedIds: ["qamariyyah", "idgham", "shaddah"],
  },
  {
    id: "qamariyyah",
    term: "Lâm Qamariyyah (Lettre Lunaire)",
    arabic: "لَامٌ قَمَرِيَّة",
    translit: "Al-Lâm al-Qamariyyah",
    aliases: ["lunaire", "lettre lunaire", "qamariya"],
    category: "ahkam",
    shortDef: "Prononciation nette du « لْ » de l'article « ال » devant les 14 lettres lunaires (« اَبْغِ حَجَّكَ وَخَفْ عَقِيمَه »).",
    fullDef:
      "Devant les 14 lettres regroupées dans la phrase « اَبْغِ حَجَّكَ وَخَفْ عَقِيمَه », le Lâm de « ال » reste clairement articulé avec un Sukûn (Iẓhâr Qamariyy), comme dans « الْقَمَر » (Al-Qamar).",
    childDef:
      "Comme la LUNE (الْقَمَر) ! Le L s'entend très clairement : AL-Qamar !",
    letters: ["أ", "ب", "غ", "ح", "ج", "ك", "و", "خ", "ف", "ع", "ق", "ي", "م", "ه"],
    example: { arabic: "الْقَمَر · الْحَمْدُ · الْكِتَاب", translit: "Al-Qamar · Al-Ḥamd · Al-Kitâb", meaning: "Le L portant Sukûn est prononcé nettement" },
    tip: "Ne faites pas de rebond (Qalqalah) sur le لْ lunaire : maintenez la pointe une fraction de seconde (Tawassuṭ).",
    relatedIds: ["shamsiyyah", "izhar", "tawassut"],
  },

  // ── 5. Voyelles, Allongements (Madd) & Signes ──
  {
    id: "madd",
    term: "Madd",
    arabic: "مَدّ",
    translit: "Madd",
    aliases: ["prolongation", "allongement", "voyelle longue", "madd tabii"],
    category: "madd_harakat",
    shortDef: "Allongement vocalique mesuré en temps (ḥarakât) sur ا, و ou ي : 2 temps (naturel) jusqu'à 4–6 temps (secondaire).",
    fullDef:
      "Prolongation de la voix sur une des trois lettres du Jawf (ا après Fatḥa, وْ après Ḍamma, يْ après Kasra). Le Madd Ṭabî‘î (naturel) vaut strictement 2 temps. En présence d'une Hamza ou d'un Sukûn (Madd Muttaṣil, Munfaṣil, Lâzim, ‘Âriḍ lis-Sukûn), la durée passe à 4, 5 ou 6 temps selon les cas.",
    childDef:
      "La voyelle ÉTIRÉE ! Tu comptes 2 temps tranquilles (ou 4 à 6 temps s'il y a la petite vague ~).",
    letters: ["ا", "و", "ي"],
    example: { arabic: "قَالَ (2) · جَاءَ (4–5) · الضَّالِّينَ (6)", translit: "Qâla · Jâ’a · Aḍ-ḍâââllîn", meaning: "Respect précis des temps de prolongation" },
    tip: "Dans le Mushaf, une petite vague (~) au-dessus du ا / و / ي indique un Madd long de 4 à 6 temps.",
    relatedIds: ["jawf", "lin", "muqattaat"],
  },
  {
    id: "harakat",
    term: "Ḥarakât",
    arabic: "حَرَكَات",
    translit: "Ḥarakât",
    aliases: ["voyelles", "fatha", "kasra", "damma", "signes"],
    category: "madd_harakat",
    shortDef: "Les 3 voyelles brèves de l'arabe : Fatḥa (ـَ = a), Kasra (ـِ = i), Ḍamma (ـُ = ou).",
    fullDef:
      "Signes diacritiques donnant à chaque consonne son timbre vocalique court (1 temps) : Fatḥa (ouverture verticale de la mâchoire), Kasra (abaissement de la mâchoire inférieure) et Ḍamma (arrondissement franc des lèvres). Leur précision empêche l'altération (Imâlah ou mélange) des voyelles.",
    childDef:
      "Les 3 petites notes de musique des lettres : Fatḥa (A, en haut), Kasra (I, en bas), Ḍamma (OU, petit boucle).",
    letters: ["ا", "و", "ي"],
    example: { arabic: "بَ · بِ · بُ", translit: "Ba · Bi · Bu", meaning: "Un temps court identique pour chaque voyelle" },
    tip: "Rendez à la Ḍamma un véritable arrondissement des lèvres et à la Kasra un abaissement clair du menton.",
    relatedIds: ["sukun", "tanwin", "madd"],
  },
  {
    id: "sukun",
    term: "Sukûn",
    arabic: "سُكُون",
    translit: "Sukûn",
    aliases: ["sakin", "repos", "muet"],
    category: "madd_harakat",
    shortDef: "Petit cercle (ـْ) indiquant l'absence de voyelle sur une consonne ; révèle son Makhraj exact.",
    fullDef:
      "Signe d'immobilité (ou tête de خ sans point dans la graphie coranique Uthmânî) marquant qu'une consonne est articulée seule sans voyelle suivante. C'est sur la lettre Sâkinah que les Sifât (Qalqalah, Hams, Rakhâwah, Tawassuṭ) s'expriment le plus nettement.",
    childDef:
      "Le panneau STOP / REPOS (ـْ) ! La lettre se prononce toute seule sans A, I ou OU.",
    letters: ["ق", "ط", "ب", "ج", "د"],
    example: { arabic: "مَنْ · قُلْ · أَبْ", translit: "Man · Qul · Ab", meaning: "Consonne finale nette sans voyelle parasite" },
    tip: "Ne rajoutez jamais un léger « eu » après une lettre portant Sukûn.",
    relatedIds: ["qalqalah", "shaddah", "makhraj"],
  },
  {
    id: "shaddah",
    term: "Shaddah",
    arabic: "شَدَّة",
    translit: "Shaddah",
    aliases: ["tashdid", "gemination", "doublement", "mushaddadah"],
    category: "madd_harakat",
    shortDef: "Signe (ـّ) doublant la consonne : première occurrence avec Sukûn appuyé + seconde avec voyelle.",
    fullDef:
      "La Shaddah (Tashdîd) synthétise deux lettres identiques fusionnées : la première immobile (Sâkinah) et la seconde vocalisée. Sur نّ et مّ (Ḥarf Ghunnah Mushaddad), elle impose obligatoirement une tenue nasale de 2 temps. À l'arrêt en fin de verset, son appui reste marqué.",
    childDef:
      "Le petit « w » (ـّ) qui rend la lettre DOUBLE et musclée ! Sur نّ et مّ, le nez chante 2 temps.",
    letters: ["ن", "م"],
    example: { arabic: "إِنَّ · رَبِّ · حَقًّا", translit: "Inna · Rabbi · Ḥaqqâ", meaning: "Appui franc avant de relâcher la voyelle" },
    tip: "Ne précipitez pas la lettre doublée : marquez bien le premier temps d'appui avant la voyelle.",
    relatedIds: ["sukun", "ghunnah", "shamsiyyah"],
  },
  {
    id: "tanwin",
    term: "Tanwîn",
    arabic: "تَنْوِين",
    translit: "Tanwîn",
    aliases: ["tanwin", "double voyelle", "an in un"],
    category: "madd_harakat",
    shortDef: "Double voyelle finale (ـً -an, ـٍ -in, ـٌ -un) prononcée comme une voyelle suivie d'un Nûn Sâkin.",
    fullDef:
      "Marque grammaticale d'indétermination en fin de nom arabe. Phonétiquement, le second son est strictement équivalent à un Nûn Sâkin (نْ) : il obéit donc exactement aux 4 règles du Nûn Sâkin (Iẓhâr, Idghâm, Iqlâb, Ikhfâ’) en liaison, et devient Madd ‘Iwaḍ (-â, 2 temps) à l'arrêt sur ـً.",
    childDef:
      "Les doubles voyelles (ـً ـٍ ـٌ) qui ajoutent un petit « N » caché à la fin du mot : AN, IN, OUN !",
    letters: ["ن"],
    example: { arabic: "عَلِيمًا حَكِيمًا · غَفُورٌ رَحِيمٌ", translit: "‘Alîman Ḥakîman · Ghafûrur-Raḥîm", meaning: "Suit toutes les règles de نْ" },
    tip: "À l'arrêt sur ـً (Fatḥatan), ne prononcez pas « -an » mais prolongez « -â » sur 2 temps (Madd ‘Iwaḍ).",
    relatedIds: ["izhar", "idgham", "iqlab", "ikhfa"],
  },
  {
    id: "waqf",
    term: "Waqf (Arrêt & Reprise)",
    arabic: "الوَقْف وَالِابْتِدَاء",
    translit: "Al-Waqf wal-Ibtidâ’",
    aliases: ["arret", "pause", "madd arid", "ta marbuta"],
    category: "madd_harakat",
    shortDef: "Règles encadrant la pause en fin de verset ou sur un repère : transformation en Sukûn final et adaptation des Madd/Qalqalah.",
    fullDef:
      "Lorsqu'on s'arrête sur un mot coranique, on remplace sa voyelle finale (ou ـٍ/ـٌ) par un Sukûn (sauf ـً qui devient Alif à 2 temps, et ة Tâ’ Marbûṭah qui devient هْ). Si la lettre précédente porte un Madd, celui-ci devient Madd ‘Âriḍ lis-Sukûn (2, 4 ou 6 temps) ; si la consonne finale appartient à قُطْبُ جَدّ, une Qalqalah Kubrâ apparaît.",
    childDef:
      "Comment bien poser sa voix quand on s'arrête à la fin d'un verset pour reprendre sa respiration !",
    letters: ["ة", "ه", "ق", "ط", "ب", "ج", "د"],
    example: { arabic: "الْعَالَمِينَ ← الْعَالَمِينْ · رَحْمَةً ← رَحْمَهْ", translit: "Al-‘âlamîn · Raḥmah", meaning: "Sukûn d'arrêt + Tâ’ Marbûṭah devient Hâ’" },
    tip: "Repérez les petits symboles d'arrêt dans le Mushaf : مـ (obligatoire), لا (ne pas s'arrêter), ج / صلى / قلى.",
    relatedIds: ["sukun", "qalqalah", "madd", "lin"],
  },

  // ── 6. Repères coraniques & écriture ──
  {
    id: "muqattaat",
    term: "Al-Ḥurûf al-Muqaṭṭa‘ât",
    arabic: "الحُرُوفُ المُقَطَّعَة",
    translit: "Al-Ḥurûf al-Muqaṭṭa‘ât",
    aliases: ["lettres lumineuses", "muqattaat", "lettres isolees", "alif lam mim"],
    category: "quran_sciences",
    shortDef: "Combinaisons de 14 lettres mystérieuses ouvrant 29 sourates du Coran, récitées par leur nom complet (ex. Alif-Lâm-Mîm).",
    fullDef:
      "Lettres isolées en début de 29 sourates (réunies dans la formule « نَصٌّ حَكِيمٌ قَاطِعٌ لَهُ سِرّ »). Elles ne se lisent pas comme un mot continu mais lettre par lettre selon trois durées : Alif (sans Madd), les 5 lettres de « حَيٌّ طَهُرْ » (2 temps), et les 8 lettres de « كَمْ عَسَلْ نَقَصْ » (Madd Lâzim Ḥarfî de 6 temps, avec Idghâm ou Ikhfâ’ possible entre lettres).",
    childDef:
      "Les 14 « Lettres Lumineuses » qui ouvrent 29 sourates comme un code précieux : on dit leur nom complet en entier !",
    letters: ["ا", "ل", "م", "ص", "ر", "ك", "ه", "ي", "ع", "ط", "س", "ح", "ق", "ن"],
    example: { arabic: "الم · يس · حم · ق", translit: "Alif-Lâââmm-Mîîîm · Yâ-Sîîîn · Qâââf", meaning: "6 temps sur Lââm, Mîîm, Sîîn, Qââf" },
    tip: "N'oubliez pas la Ghunnah de 2 temps entre « Lâm » (finissant par مْ) et « Mîm » dans الم !",
    relatedIds: ["madd", "ghunnah", "idgham"],
  },
  {
    id: "abjad",
    term: "Ḥisâb al-Jummal (Abjad)",
    arabic: "حِسَابُ الجُمَّل / أَبْجَد",
    translit: "Abjad",
    aliases: ["abjad", "numerologie", "valeur numerique"],
    category: "quran_sciences",
    shortDef: "Système alphabétique historique attribuant une valeur numérique précise (1 à 1000) à chacune des 28 lettres arabes.",
    fullDef:
      "Avant la diffusion des chiffres positionnels, les savants et calligraphes utilisaient l'ordre « أَبْجَدْ هَوَّزْ حُطِّي كَلَمُنْ سَعْفَصْ قَرَشَتْ ثَخَذْ ضَظَغْ » où les lettres représentent les unités (1–9), les dizaines (10–90), les centaines (100–900) et le millier (غ = 1000).",
    childDef:
      "Chaque lettre arabe a aussi un numéro secret ancien utilisé autrefois pour compter et classer les livres !",
    letters: ["أ", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط", "ي"],
    example: { arabic: "أ=1 · ي=10 · ق=100 · غ=1000", translit: "Alif=1, Yâ=10, Qâf=100", meaning: "Échelle décimale historique des lettres" },
    tip: "Utile pour consulter l'ordre traditionnel des manuscrits et la fiche d'identité de chaque lettre.",
    relatedIds: ["muqattaat"],
  },
  {
    id: "hizb_juz",
    term: "Juz’ & Ḥizb",
    arabic: "جُزْء وَحِزْب",
    translit: "Juz’ & Ḥizb",
    aliases: ["juz", "hizb", "rub", "division coran"],
    category: "quran_sciences",
    shortDef: "Subdivisions pratiques du Saint Coran : 30 Juz’ (sections égales) et 60 Ḥizb (2 par Juz’) pour planifier la lecture.",
    fullDef:
      "Ces divisions ne séparent pas les sourates par thème mais équilibrent la quantité de texte pour lire ou réviser le Coran entier en un mois (1 Juz’ par jour) ou deux mois (1 Ḥizb par jour). Chaque Ḥizb est lui-même divisé en 4 quarts (Rub‘, Niṣf, Thalâthat Arbâ‘).",
    childDef:
      "Les chapitres pratiques du Coran : 30 grandes parts (Juz’) et 60 étapes (Ḥizb) pour t'aider à lire un peu chaque jour !",
    letters: [],
    example: { arabic: "الْحِزْبُ الأَوَّل · جُزْءُ عَمَّ", translit: "Al-Ḥizb 1 · Juz’ ‘Amma (30)", meaning: "Repères de progression quotidienne" },
    tip: "Dans l'application, vous pouvez naviguer directement par Sourate, par Page, par Juz’ ou par Ḥizb.",
    relatedIds: ["waqf"],
  },
  {
    id: "mushaf_uthmani",
    term: "Rasm ‘Uthmânî",
    arabic: "الرَّسْمُ العُثْمَانِي",
    translit: "Ar-Rasm al-‘Uthmânî",
    aliases: ["rasm", "uthmani", "calligraphie", "alif khanjariyyah"],
    category: "quran_sciences",
    shortDef: "Orthographe coranique authentique transmise depuis les copies du calife ‘Uthmân, avec signes de lecture précis (Alif suscrit ٰ, Hamzat al-Waṣl ٱ).",
    fullDef:
      "Préserve les graphies historiques du texte coranique (telles que صَلَوٰة avec petit Alif Khanjarîyah ٰ ou ٱلْحَمْدُ avec Hamzat al-Waṣl ٱ). Comprendre ces symboles évite de confondre les lettres muettes graphiques avec celles prononcées.",
    childDef:
      "L'écriture spéciale et précieuse du Coran avec des petits signes en plus pour lire sans aucune faute.",
    letters: ["ٱ", "ا"],
    example: { arabic: "الرَّحْمٰنِ · ٱهْدِنَا", translit: "Ar-Raḥmâni · Ihdinâ", meaning: "Petit Alif ٰ = prolongation 2 temps ; ٱ = liaison fluide" },
    tip: "Le petit trait vertical (ٰ) au-dessus d'une lettre indique un Alif de prolongation de 2 temps à prononcer.",
    relatedIds: ["madd", "waqf"],
  },
];

export const TAJWEED_GLOSSARY = Object.freeze(
  RAW_GLOSSARY_ENTRIES.map((entry) =>
    Object.freeze({
      ...entry,
      aliases: Object.freeze([...(entry.aliases || [])]),
      letters: Object.freeze([...(entry.letters || [])]),
      example: Object.freeze({ ...(entry.example || {}) }),
      relatedIds: Object.freeze([...(entry.relatedIds || [])]),
    })
  )
);

/**
 * Pure normalization helper stripping French accents, Arabic diacritics, apostrophes & spaces
 * for resilient fuzzy matching across transliteration variants.
 */
export const normalizeGlossaryKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[‘’'`´ʾʿ\-_]/g, "")
    .replace(/ḍ/gi, "d")
    .replace(/ṭ/gi, "t")
    .replace(/ẓ/gi, "z")
    .replace(/ṣ/gi, "s")
    .replace(/ḥ/gi, "h")
    .replace(/ā/gi, "a")
    .replace(/ī/gi, "i")
    .replace(/ū/gi, "u")
    .toLowerCase()
    .trim();

const GLOSSARY_INDEX = TAJWEED_GLOSSARY.reduce((acc, entry) => {
  acc[normalizeGlossaryKey(entry.id)] = entry;
  acc[normalizeGlossaryKey(entry.term)] = entry;
  acc[normalizeGlossaryKey(entry.translit)] = entry;
  if (entry.arabic) acc[normalizeGlossaryKey(entry.arabic)] = entry;
  entry.aliases.forEach((alias) => {
    const k = normalizeGlossaryKey(alias);
    if (k && !acc[k]) acc[k] = entry;
  });
  return acc;
}, {});

/**
 * Pure lookup retrieving a glossary entry by exact ID, term name, Arabic word, or alias.
 */
export const getGlossaryTerm = (idOrKeyword) => {
  const key = normalizeGlossaryKey(idOrKeyword);
  if (!key) return null;
  if (GLOSSARY_INDEX[key]) return GLOSSARY_INDEX[key];
  return (
    TAJWEED_GLOSSARY.find(
      (item) =>
        normalizeGlossaryKey(item.id) === key ||
        normalizeGlossaryKey(item.term).includes(key) ||
        item.aliases.some((a) => normalizeGlossaryKey(a) === key)
    ) || null
  );
};

/**
 * Pure functional search & category filter over the complete glossary,
 * ranked by relevance (exact term/ID/alias matches first).
 */
export const searchGlossaryTerms = (query = "", category = "all") => {
  const cleanCat = String(category || "all").trim();
  const cleanQuery = normalizeGlossaryKey(query);
  const rawTrimmed = String(query || "").trim();

  const scoreEntry = (entry) => {
    if (!cleanQuery && !rawTrimmed) return 1;
    const normId = normalizeGlossaryKey(entry.id);
    const normTerm = normalizeGlossaryKey(entry.term);
    const normTrans = normalizeGlossaryKey(entry.translit);
    const normAliases = entry.aliases.map(normalizeGlossaryKey);

    if (normId === cleanQuery || normTerm === cleanQuery || normTrans === cleanQuery || normAliases.includes(cleanQuery)) {
      return 4;
    }
    if (normTerm.includes(cleanQuery) || normTrans.includes(cleanQuery) || normAliases.some((a) => a.includes(cleanQuery))) {
      return 3;
    }
    if (rawTrimmed && entry.letters.includes(rawTrimmed)) {
      return 2;
    }
    const bodyHaystacks = [
      entry.arabic,
      entry.shortDef,
      entry.fullDef,
      entry.childDef,
      entry.tip,
      entry.example?.arabic || "",
      entry.example?.translit || "",
    ].map(normalizeGlossaryKey);

    if (bodyHaystacks.some((h) => h.includes(cleanQuery))) {
      return 1;
    }
    return 0;
  };

  return TAJWEED_GLOSSARY.filter((entry) => cleanCat === "all" || entry.category === cleanCat)
    .map((entry) => ({ entry, score: scoreEntry(entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);
};

/**
 * Pure helper resolving related glossary entries for cross-linking.
 */
export const getRelatedGlossaryTerms = (entryOrId) => {
  const entry = typeof entryOrId === "string" ? getGlossaryTerm(entryOrId) : entryOrId;
  if (!entry || !Array.isArray(entry.relatedIds)) return [];
  return entry.relatedIds.map((rid) => getGlossaryTerm(rid)).filter(Boolean);
};

/**
 * Pure helper returning category metadata for a given category ID.
 */
export const getGlossaryCategoryMeta = (categoryId) =>
  GLOSSARY_CATEGORIES.find((c) => c.id === categoryId) || GLOSSARY_CATEGORIES[0];
