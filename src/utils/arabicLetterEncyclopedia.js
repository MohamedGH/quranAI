import { ARABIC_LETTERS } from "./arabicUtils.js";
import { getLetterAnatomy, getTonguePostureSpec } from "./makharijData.js";

/**
 * Canonical Tajweed & Arabic Graphology sets (Pure immutable sets)
 */
export const SHAMSIYYAH_LETTERS = new Set(["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ل", "ن"]);
export const HAMS_LETTERS = new Set(["ف", "ح", "ث", "ه", "ش", "خ", "ص", "س", "ك", "ت"]);
export const SHIDDAH_LETTERS = new Set(["أ", "ء", "ج", "د", "ق", "ط", "ب", "ك", "ت"]);
export const TAWASSUT_LETTERS = new Set(["ل", "ن", "ع", "م", "ر"]);
export const ISTILA_LETTERS = new Set(["خ", "ص", "ض", "غ", "ط", "ق", "ظ"]);
export const ITBAQ_LETTERS = new Set(["ص", "ض", "ط", "ظ"]);
export const IDHLAQ_LETTERS = new Set(["ف", "ر", "م", "ن", "ل", "ب"]);
export const QALQALAH_LETTERS = new Set(["ق", "ط", "ب", "ج", "د"]);
export const SAFIR_LETTERS = new Set(["ص", "ز", "س"]);
export const LIN_LETTERS = new Set(["و", "ي"]);
export const NON_CONNECTING_LEFT_LETTERS = new Set(["ا", "أ", "د", "ذ", "ر", "ز", "و"]);

export const THROAT_IZHAR_LETTERS = new Set(["أ", "ء", "ه", "ع", "ح", "غ", "خ"]);
export const IDGHAM_GHUNNAH_LETTERS = new Set(["ي", "ن", "م", "و"]);
export const IDGHAM_NO_GHUNNAH_LETTERS = new Set(["ل", "ر"]);
export const IQLAB_LETTERS = new Set(["ب"]);

/**
 * Les 14 lettres lumineuses ouvrant certaines sourates (الحروف المقطعة - صله سحيرا من قطعك)
 */
export const MUQATTAAT_INFO = Object.freeze({
  "ا": { combinations: ["الم", "الر", "المص", "المر"], surahsCount: 13 },
  "ل": { combinations: ["الم", "الر", "المص", "المر"], surahsCount: 13 },
  "م": { combinations: ["الم", "المص", "المر", "حم", "طسم"], surahsCount: 17 },
  "ص": { combinations: ["ص (Sourate 38)", "المص (7)", "كهيعص (19)"], surahsCount: 3 },
  "ر": { combinations: ["الر (10, 11, 12, 14, 15)", "المر (13)"], surahsCount: 6 },
  "ك": { combinations: ["كهيعص (Sourate Maryam 19)"], surahsCount: 1 },
  "ه": { combinations: ["طه (Sourate 20)", "كهيعص (19)"], surahsCount: 2 },
  "ي": { combinations: ["يس (Sourate 36)", "كهيعص (19)"], surahsCount: 2 },
  "ع": { combinations: ["كهيعص (19)", "حم عسق (42)"], surahsCount: 2 },
  "ط": { combinations: ["طه (20)", "طسم (26, 28)", "طس (27)"], surahsCount: 4 },
  "س": { combinations: ["يس (36)", "طسم (26, 28)", "طس (27)", "حم عسق (42)"], surahsCount: 5 },
  "ح": { combinations: ["حم (Les 7 Hawâmîm : Sourates 40 à 46)"], surahsCount: 7 },
  "ق": { combinations: ["ق (Sourate 50)", "حم عسق (42)"], surahsCount: 2 },
  "ن": { combinations: ["ن (Sourate Al-Qalam 68)"], surahsCount: 1 },
});

/**
 * Données encyclopédiques complètes par lettre arabe (29 fiches)
 */
export const LETTER_ENCYCLOPEDIA_MAP = Object.freeze({
  "أ": {
    arabicName: "هَمْزَة / أَلِف",
    alphabetOrder: 1,
    abjadValue: 1,
    dots: "Hamza posée au-dessus de l'Alif (ء)",
    writingSteps: "Tracez une ligne verticale droite de haut en bas, puis ajoutez la petite Hamza (ء) au sommet sans lever le stylet brusquement.",
    childWritingTip: "Fais un grand bâton droit du haut vers le bas, puis pose un petit oiseau magique (ء) tout en haut !",
    solarLunarExample: { arabic: "الْأَرْض", trans: "al-arḍ", meaning: "La Terre" },
    confusionPairs: [
      { letter: "ع", name: "Ayn", difference: "Hamza coupe net aux cordes vocales ; 'Ayn est plus haute et profonde au milieu de la gorge." },
      { letter: "ا", name: "Alif", difference: "Hamza est une consonne nette (coup de glotte) ; Alif sans Hamza est une voyelle longue (Â)." },
    ],
    commonMistake: "Éviter de prononcer la Hamza de façon molle ou de l'avaler en milieu de mot (ex: يَأْكُلُ ne doit pas devenir يَاكُلُ).",
    childMistakeTip: "Ne cache pas le petit 'Ah !' du fond du cou au milieu des mots, dis-le bien nettement !",
    quranFact: "Première lettre de la sourate Al-'Alaq (ٱقْرَأْ - Lis !), premier mot révélé du Saint Coran.",
    childFact: "C'est la toute première lettre de la grande famille des lettres arabes, comme le numéro 1 des champions !",
  },
  "ب": {
    arabicName: "بَاءٌ",
    alphabetOrder: 2,
    abjadValue: 2,
    dots: "1 point en dessous (نُقْطَة تَحْتَهَا)",
    writingSteps: "Tracez une barque plate de droite à gauche sur la ligne d'écriture avec un crochet au début et à la fin, puis placez 1 point dessous.",
    childWritingTip: "Dessine un joli petit bateau plat sur l'eau avec un seul trésor (le point) caché en dessous !",
    solarLunarExample: { arabic: "الْبَيْت", trans: "al-bayt", meaning: "La Maison sacrée" },
    confusionPairs: [
      { letter: "ت", name: "Ta", difference: "Ba a 1 point en dessous (ب) ; Ta a 2 points au-dessus (ت)." },
      { letter: "ن", name: "Nûn", difference: "Nûn est plus arrondi en bol avec 1 point au-dessus (ن)." },
    ],
    commonMistake: "Ne pas oublier la Qalqalah (rebond sonore) quand le Ba porte un soukoun (ex: تَبَّتْ / لَهَبْ), et ne pas le prononcer comme un 'p' sourd.",
    childMistakeTip: "Attention : quand Ba fait une pause (soukoun), elle rebondit légèrement comme une balle : 'eb!'",
    quranFact: "Le Coran commence par le Ba de بِسْمِ اللَّهِ (Bismi-llâh) et la 1ère lettre des deux sourates protectrices.",
    childFact: "C'est la toute première lettre du premier mot du Coran : بِسْمِ اللَّهِ !",
  },
  "ت": {
    arabicName: "تَاءٌ",
    alphabetOrder: 3,
    abjadValue: 400,
    dots: "2 points au-dessus (نُقْطَتَان فَوْقَهَا)",
    writingSteps: "Tracez la barque sur la ligne de droite à gauche puis ajoutez 2 points côte à côte au-dessus.",
    childWritingTip: "Un petit bateau souriant avec deux beaux yeux (points) qui regardent les étoiles !",
    solarLunarExample: { arabic: "التَّوَّاب", trans: "at-tawwāb", meaning: "Celui qui accepte le repentir" },
    confusionPairs: [
      { letter: "ط", name: "Ṭa", difference: "Ta est fine et légère (تَابَ = se repentir) ; Ṭa est très grave et emphatique (طَابَ = être bon)." },
      { letter: "ث", name: "Tha", difference: "Ta a 2 points ; Tha a 3 points et se prononce langue entre les dents." },
    ],
    commonMistake: "Éviter d'ajouter un sifflement 'ts' (affrication) lors du relâchement, et garder le Hams doux sans exagération.",
    childMistakeTip: "Ne fais pas 'Tssss' comme un serpent ! Juste un joli petit souffle doux après 'T' !",
    quranFact: "Dans le Coran, Ta s'écrit parfois ouvert (ت) et parfois fermé (ة - Ta Marbûṭah) en fin de mot féminin.",
    childFact: "Elle adore se déguiser en petite fleur fermée (ة) à la fin de certains mots comme جَنَّة (Paradis) !",
  },
  "ث": {
    arabicName: "ثَاءٌ",
    alphabetOrder: 4,
    abjadValue: 500,
    dots: "3 points au-dessus (ثَلَاث نِقَاط فَوْقَهَا)",
    writingSteps: "Tracez la barque de droite à gauche, puis placez 3 points en triangle au-dessus.",
    childWritingTip: "Le petit bateau porte une couronne de 3 belles étoiles en triangle au-dessus de lui !",
    solarLunarExample: { arabic: "الثَّوَاب", trans: "ath-thawāb", meaning: "La récompense" },
    confusionPairs: [
      { letter: "س", name: "Sîn", difference: "Tha se prononce avec la langue sur le bord des dents ; Sîn siffle derrière les dents." },
      { letter: "ذ", name: "Dhal", difference: "Tha n'a pas de vibration vocale (souffle) ; Dhal vibre avec la voix." },
    ],
    commonMistake: "Ne jamais remplacer Tha par 'S' ou 'T' : la pointe de la langue doit impérativement toucher le bord des incisives supérieures.",
    childMistakeTip: "N'oublie pas de sortir un petit bout de langue sous tes dents du haut, sinon elle se transforme en Sîn !",
    quranFact: "Présente dans le mot كَوْثَر (Al-Kawthar), le fleuve d'abondance au Paradis (Sourate 108).",
    childFact: "C'est la lettre du fleuve magique du Paradis : الكَوْثَر (Al-Kawthar) !",
  },
  "ج": {
    arabicName: "جِيمٌ",
    alphabetOrder: 5,
    abjadValue: 3,
    dots: "1 point à l'intérieur (نُقْطَة فِي بَطْنِهَا)",
    writingSteps: "Tracez une petite vague horizontale vers la droite au-dessus de la ligne, puis descendez en grand croissant sous la ligne avec 1 point dedans.",
    childWritingTip: "Dessine un petit bec d'oiseau en haut et un grand ventre rond en bas avec 1 trésor caché dedans !",
    solarLunarExample: { arabic: "الْجَنَّة", trans: "al-jannah", meaning: "Le Paradis" },
    confusionPairs: [
      { letter: "ح", name: "Ḥa", difference: "Même forme sans aucun point (ح)." },
      { letter: "خ", name: "Kha", difference: "Même forme avec 1 point au-dessus (خ)." },
    ],
    commonMistake: "En récitation coranique (Hafs), le Jîm doit être prononcé 'dj' (bloqué puis relâché), jamais comme un 'j' français mou sans blocage.",
    childMistakeTip: "Dis bien 'DJ' (comme Djinn ou Jannah) en collant le milieu de ta langue en haut, pas un 'j' tout mou !",
    quranFact: "Fait partie des 5 lettres de Qalqalah (قُطْبُ جَدٍّ) qui rebondissent au soukoun, comme dans فَجْر.",
    childFact: "C'est la première lettre du mot الجَنَّة (Al-Jannah = le Paradis) !",
  },
  "ح": {
    arabicName: "حَاءٌ",
    alphabetOrder: 6,
    abjadValue: 8,
    dots: "Sans point (مُهْمَلَة - aucun point)",
    writingSteps: "Même tracé élégant que Jîm, avec une tête en vague et un grand croissant sous la ligne, sans aucun point.",
    childWritingTip: "Elle a exactement le même corps que Jîm, mais son petit ventre est tout vide et propre, sans point !",
    solarLunarExample: { arabic: "الْحَمْد", trans: "al-ḥamd", meaning: "La Louange" },
    confusionPairs: [
      { letter: "خ", name: "Kha", difference: "Ḥa vient du milieu de la gorge sans raclement ; Kha racle plus haut avec Tafkhîm." },
      { letter: "ه", name: "Ha", difference: "Ḥa est resserré et tiède au milieu du cou ; Ha est un souffle léger du bas." },
    ],
    commonMistake: "Ne pas la confondre avec ه (Ha léger) ni la faire racler comme خ (Kha). C'est un souffle pur du milieu pharyngé.",
    childMistakeTip: "Pour bien la faire, fais de la buée chaude sur un miroir sans gratter la gorge !",
    quranFact: "Première lettre de الْحَمْدُ لِلَّهِ (Al-Ḥamdu lillâh) et de الرَّحْمَٰنِ الرَّحِيمِ.",
    childFact: "Elle ouvre la magnifique louange de Sourate Al-Fâtiha : الحَمْدُ لِلَّهِ !",
  },
  "خ": {
    arabicName: "خَاءٌ",
    alphabetOrder: 7,
    abjadValue: 600,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Même forme que Jîm et Ḥa, avec 1 point posé fièrement au-dessus de la tête.",
    childWritingTip: "Même joli dessin que Ḥa, mais avec un chapeau d'une étoile tout en haut de sa tête !",
    solarLunarExample: { arabic: "الْخَالِق", trans: "al-khāliq", meaning: "Le Créateur" },
    confusionPairs: [
      { letter: "ح", name: "Ḥa", difference: "Kha a 1 point dessus et est grave (Tafkhîm) ; Ḥa n'a pas de point et est fine." },
      { letter: "غ", name: "Ghayn", difference: "Même zone haute de la gorge : Ghayn utilise la voix, Kha utilise le souffle." },
    ],
    commonMistake: "Éviter un raclement brutal excessif : la friction doit être douce, grasse et grave au sommet du pharynx.",
    childMistakeTip: "Ne gratte pas fort ta gorge : laisse simplement l'air chaud ronronner doucement comme un petit dragon !",
    quranFact: "Première lettre de la formule des 7 lettres graves (خُصَّ ضَغْطٍ قِظْ).",
    childFact: "Elle est chef de file de la formule secrète des 7 championnes : خُصَّ ضَغْطٍ قِظْ !",
  },
  "د": {
    arabicName: "دَالٌ",
    alphabetOrder: 8,
    abjadValue: 4,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Tracez une petite courbe oblique vers le bas jusqu'à la ligne puis prolongez horizontalement vers la gauche. Ne se relie jamais à la lettre suivante.",
    childWritingTip: "Comme une petite chaise qui regarde à gauche ! Et attention : elle ne donne jamais la main à gauche !",
    solarLunarExample: { arabic: "الدِّين", trans: "ad-dīn", meaning: "La Religion / Le Jugement" },
    confusionPairs: [
      { letter: "ذ", name: "Dhal", difference: "Même forme, mais Dhal a 1 point dessus (ذ)." },
      { letter: "ض", name: "Ḍad", difference: "Dal est fine et antérieure ; Ḍad est très grave et latérale contre les molaires." },
    ],
    commonMistake: "Ne jamais durcir Dal comme un 'T' ou l'emphatiser en Ḍad. Au soukoun final (أَحَدْ), bien marquer le rebond de Qalqalah.",
    childMistakeTip: "N'oublie pas son rebond joyeux quand elle s'arrête : قُلْ هُوَ اللَّهُ أَحَدْ !",
    quranFact: "Clôt chaque verset de Sourate Al-Ikhlâṣ (112) en formant une Qalqalah majeure à l'arrêt.",
    childFact: "C'est la star des rimes de Sourate Al-Ikhlâṣ : أَحَدْ · الصَّمَدْ · يَلِدْ !",
  },
  "ذ": {
    arabicName: "ذَالٌ",
    alphabetOrder: 9,
    abjadValue: 700,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Identique à Dal (د) avec 1 point au-dessus. Ne s'attache jamais à la lettre suivante.",
    childWritingTip: "C'est la jumelle de Dal avec une petite étoile dorée sur la tête !",
    solarLunarExample: { arabic: "الذِّكْر", trans: "adh-dhikr", meaning: "Le Rappel (Coran)" },
    confusionPairs: [
      { letter: "ز", name: "Zay", difference: "Dhal met la langue entre les dents (th doux) ; Zay est un 'z' sifflant derrière les dents." },
      { letter: "ظ", name: "Ẓa", difference: "Dhal est fine et douce (ذَلَّ) ; Ẓa est grave et emphatique (ظَلَّ)." },
    ],
    commonMistake: "Erreur fréquente : la prononcer comme un 'z' français. La langue DOIT effleurer les incisives supérieures.",
    childMistakeTip: "Fais attention à ne pas dire 'Z', sors un tout petit peu la langue comme une gentille abeille !",
    quranFact: "Premier mot de Sourate Al-Baqarah après 'Alif-Lâm-Mîm' : ذَٰلِكَ الْكِتَابُ (Voici le Livre).",
    childFact: "Elle débute le tout premier verset après Alif-Lâm-Mîm dans la plus longue sourate : ذَٰلِكَ الْكِتَابُ !",
  },
  "ر": {
    arabicName: "رَاءٌ",
    alphabetOrder: 10,
    abjadValue: 200,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Partez juste au-dessus de la ligne et tracez une glissade courbe qui descend sous la ligne vers la gauche. Ne se lie pas à gauche.",
    childWritingTip: "Comme un petit toboggan de parc qui descend doucement sous la ligne !",
    solarLunarExample: { arabic: "الرَّحْمَٰن", trans: "ar-raḥmān", meaning: "Le Tout Miséricordieux" },
    confusionPairs: [
      { letter: "ز", name: "Zay", difference: "Ra n'a pas de point ; Zay a 1 point dessus." },
      { letter: "غ", name: "Ghayn", difference: "Ra coranique vibre à la pointe de la langue (jamais grasseyé au fond de la gorge comme le 'r' français) !" },
    ],
    commonMistake: "1) Ne jamais grasseyer le Ra comme en français (c'est la pointe de la langue qui vibre). 2) Ne pas faire rouler excessivement (Takrîr exagéré : 1 à 2 battements suffisent).",
    childMistakeTip: "C'est le bout de ta langue qui fait un mini tour de manège, pas ta gorge ! Et ne la fais pas vibrer trop longtemps !",
    quranFact: "Seule lettre du Tajweed qui alterne entre grave (Tafkhîm avec a/ou) et fine (Tarqîq avec i) selon des règles précises.",
    childFact: "Une vraie magicienne : elle met sa grosse voix avec 'A' et 'Ou' (رَبِّ), et sa petite voix douce avec 'I' (رِزْق) !",
  },
  "ز": {
    arabicName: "زَايٌ",
    alphabetOrder: 11,
    abjadValue: 7,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Identique à Ra (ر) avec 1 point placé juste au-dessus. Ne s'attache jamais à gauche.",
    childWritingTip: "Le même joli toboggan que Ra, mais avec un ballon doré qui flotte au-dessus !",
    solarLunarExample: { arabic: "الزَّكَاة", trans: "az-zakāh", meaning: "L'aumône purificatrice" },
    confusionPairs: [
      { letter: "ذ", name: "Dhal", difference: "Zay reste derrière les dents (sifflement 'z') ; Dhal touche le bord des dents." },
      { letter: "ر", name: "Ra", difference: "Ra n'a pas de point et roule ; Zay a 1 point et siffle." },
    ],
    commonMistake: "Garder le sifflement (Ṣafîr) bien net et continu, sans laisser la langue glisser entre les dents.",
    childMistakeTip: "Garde ta langue bien rangée derrière tes dents pour faire un joli 'Zzzzz' brillant !",
    quranFact: "Donne son nom sonore à Sourate Az-Zalzalah (99 - Le Séisme) et Az-Zumar (39).",
    childFact: "Dans Sourate Az-Zalzalah, on entend son beau son musical : إِذَا زُلْزِلَتِ الْأَرْضُ زِلْزَالَهَا !",
  },
  "س": {
    arabicName: "سِينٌ",
    alphabetOrder: 12,
    abjadValue: 60,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Tracez deux petites dents en vague (3 pointes) sur la ligne de droite à gauche, puis plongez en grand bol arrondi sous la ligne.",
    childWritingTip: "Trois petites dents de scie puis un grand bol arrondi pour recueillir les gouttes de pluie !",
    solarLunarExample: { arabic: "السَّلَام", trans: "as-salām", meaning: "La Paix" },
    confusionPairs: [
      { letter: "ص", name: "Ṣad", difference: "Sîn est fine et souriante (سَيْف = épée) ; Ṣad est grave et profonde (صَيْف = été)." },
      { letter: "ش", name: "Chîn", difference: "Même forme sans point, alors que Chîn porte 3 points." },
    ],
    commonMistake: "Veiller à garder l'arrière de la langue complètement bas devant des lettres graves voisines (ex: مَسْطُورًا).",
    childMistakeTip: "Fais bien un grand sourire pour que Sîn reste toute fine et douce, même à côté d'une lettre championne !",
    quranFact: "Fait partie de l'ouverture de Sourate Yâ-Sîn (يس - 36) et Ash-Shu'arâ' (طسم).",
    childFact: "C'est la lettre du doux mot سَلَام (Salâm = La Paix) !",
  },
  "ش": {
    arabicName: "شِينٌ",
    alphabetOrder: 13,
    abjadValue: 300,
    dots: "3 points au-dessus (ثَلَاث نِقَاط فَوْقَهَا)",
    writingSteps: "Identique à Sîn (س) avec 3 points posés en pyramide au-dessus des dents.",
    childWritingTip: "Les 3 petites vagues + le grand bol avec une couronne de 3 points au-dessus !",
    solarLunarExample: { arabic: "الشَّمْس", trans: "ash-shams", meaning: "Le Soleil" },
    confusionPairs: [
      { letter: "س", name: "Sîn", difference: "Sîn n'a pas de points et siffle finement ; Chîn a 3 points et diffuse l'air dans la bouche." },
      { letter: "ج", name: "Jîm", difference: "Même lieu d'articulation (milieu de la langue), mais Chîn laisse l'air couler largement." },
    ],
    commonMistake: "Ne pas arrondir les lèvres en 'cul de poule' pour prononcer Chîn : seule la langue diffuse l'air (Tafash-shî).",
    childMistakeTip: "Laisse tes lèvres tranquilles et fais simplement 'Chhh' comme une douce brise !",
    quranFact: "Possède un attribut unique à elle seule dans tout l'alphabet : At-Tafash-shî (التَّفَشِّي - large diffusion d'air).",
    childFact: "Elle possède un super-pouvoir unique dans tout l'alphabet : son souffle doux remplit toute la bouche !",
  },
  "ص": {
    arabicName: "صَادٌ",
    alphabetOrder: 14,
    abjadValue: 90,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Tracez une boucle en amande vers la droite sur la ligne, redescendez et formez un grand bol plongeant sous la ligne comme le Sîn.",
    childWritingTip: "Dessine une jolie goutte allongée sur la ligne puis un grand toboggan en bol sans aucun point !",
    solarLunarExample: { arabic: "الصِّرَاط", trans: "aṣ-ṣirāṭ", meaning: "Le droit chemin" },
    confusionPairs: [
      { letter: "س", name: "Sîn", difference: "Ṣad a l'arrière de langue très élevé et le milieu en cuillère ; Sîn garde la langue plate." },
      { letter: "ض", name: "Ḍad", difference: "Même corps, mais Ḍad a 1 point dessus." },
    ],
    commonMistake: "Ne jamais avancer les lèvres en rond pour 'imiter' la gravité : l'emphase se fait au fond du palais, pas avec les lèvres.",
    childMistakeTip: "Ne fais pas de bec de poisson avec tes lèvres ! Le secret du lion est à l'arrière de ta langue !",
    quranFact: "Donne son nom entier à la Sourate 38 (Ṣâd) qui s'ouvre par cette seule lettre isolée : ص ۚ وَالْقُرْآنِ ذِي الذِّكْرِ.",
    childFact: "Elle est si importante qu'une sourate entière du Coran porte juste son nom : Sourate Ṣâd !",
  },
  "ض": {
    arabicName: "ضَادٌ",
    alphabetOrder: 15,
    abjadValue: 800,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Identique à Ṣad (ص) avec 1 point posé au-dessus de la boucle.",
    childWritingTip: "La même belle goutte et le grand bol que Ṣad, avec un joyau doré juste au-dessus !",
    solarLunarExample: { arabic: "الضُّحَىٰ", trans: "aḍ-ḍuḥā", meaning: "Le jour montant" },
    confusionPairs: [
      { letter: "د", name: "Dal", difference: "Dal est fine et vient des incisives ; Ḍad presse les bords de la langue contre les molaires." },
      { letter: "ظ", name: "Ẓa", difference: "Ne pas sortir la langue entre les dents pour Ḍad ! Elle reste à l'intérieur contre les molaires." },
    ],
    commonMistake: "Erreur très fréquente : prononcer Ḍad comme un Ẓa (en sortant la langue entre les dents) ou comme un Dal lourd. L'air NE sort pas entre les dents, mais glisse sur les molaires (Istiṭâlah).",
    childMistakeTip: "Garde ta langue bien à l'intérieur et chatouille tes grosses dents du fond !",
    quranFact: "La langue arabe est surnommée « Lughat aḍ-Ḍâd » (la langue du Ḍâd) car ce son est unique parmi les langues humaines. Elle possède l'attribut exclusif d'Istiṭâlah.",
    childFact: "On appelle l'arabe « la langue du Ḍad » parce que cette lettre magique n'existe nulle part ailleurs !",
  },
  "ط": {
    arabicName: "طَاءٌ",
    alphabetOrder: 16,
    abjadValue: 9,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Tracez une boucle en amande sur la ligne, puis tracez un grand mât vertical de haut en bas venant toucher le haut de la boucle.",
    childWritingTip: "Un joli petit bateau rond avec un grand mât de voilier planté dessus sans point !",
    solarLunarExample: { arabic: "الطَّارِق", trans: "aṭ-ṭāriq", meaning: "L'astre nocturne" },
    confusionPairs: [
      { letter: "ت", name: "Ta", difference: "Ṭa est la plus grave de tout l'alphabet (طَابَ) ; Ta est fine et soufflée (تَابَ)." },
      { letter: "د", name: "Dal", difference: "Ṭa monte l'arrière de la langue au palais ; Dal reste plat." },
    ],
    commonMistake: "Contrairement au Ta, Ṭa ne laisse sortir AUCUN souffle d'air (c'est Jahr + Shiddah). Au soukoun, sa Qalqalah doit être grave.",
    childMistakeTip: "Tape comme un tambour royal tout en haut, sans aucun souffle d'air après !",
    quranFact: "Classée 1ère lettre la plus forte et la plus grave de tout l'alphabet arabe par les savants du Tajweed.",
    childFact: "C'est la championne numéro 1 de force dans tout l'alphabet ! Une vraie reine !",
  },
  "ظ": {
    arabicName: "ظَاءٌ",
    alphabetOrder: 17,
    abjadValue: 900,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Identique à Ṭa (ط) avec 1 point placé à droite du mât vertical.",
    childWritingTip: "Le même beau voilier que Ṭa, avec une petite étoile qui brille à côté de la voile !",
    solarLunarExample: { arabic: "الظَّالِمِين", trans: "aẓ-ẓālimīn", meaning: "Les injustes" },
    confusionPairs: [
      { letter: "ذ", name: "Dhal", difference: "Même sortie sur le bord des dents, mais Ẓa bombe fortement l'arrière de la langue (Tafkhîm)." },
      { letter: "ض", name: "Ḍad", difference: "Ẓa effleure le bord des incisives supérieures ; Ḍad reste caché sur les molaires." },
    ],
    commonMistake: "Ne pas confondre sa prononciation avec un 'Z' emphatique : la pointe doit effleurer les incisives supérieures.",
    childMistakeTip: "Sors un tout petit peu la langue sous les dents avec une grande voix grave de géant !",
    quranFact: "C'est l'une des lettres les plus rares du Coran (environ 853 occurrences), mais elle apparaît dans des mots clés comme عَظِيم (Immense).",
    childFact: "Elle est rare et précieuse comme un diamant dans le Coran, par exemple dans الـعَـظِـيم (Le Très Grand) !",
  },
  "ع": {
    arabicName: "عَيْنٌ",
    alphabetOrder: 18,
    abjadValue: 70,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Tracez un petit croissant ouvert vers la droite au-dessus de la ligne, puis poursuivez par un grand croissant sous la ligne.",
    childWritingTip: "Un petit 'c' en haut suivi d'un grand ventre tout rond en bas comme un chiffre 3 à l'envers !",
    solarLunarExample: { arabic: "الْعَالَمِين", trans: "al-‘ālamīn", meaning: "Les Mondes" },
    confusionPairs: [
      { letter: "أ", name: "Hamza", difference: "Ne jamais remplacer 'Ayn par une simple voyelle 'A' ou Hamza : le milieu de la gorge doit résonner." },
      { letter: "غ", name: "Ghayn", difference: "Même forme sans point, mais 'Ayn est milieu de gorge (non grave) tandis que Ghayn est haut de gorge (grave)." },
    ],
    commonMistake: "Éviter de l'écraser ou de couper brutalement la voix : c'est une lettre intermédiaire (Tawassuṭ) qui coule légèrement au milieu du cou.",
    childMistakeTip: "Laisse sortir une belle voix douce et profonde du milieu de ton cou, sans la bloquer brutalement !",
    quranFact: "C'est une lettre fréquente dans les plus beaux Noms divins : السَّمِيع (L'Audient), الْعَلِيم (L'Omniscient).",
    childFact: "Elle commence le mot العَالَمِين (Les Mondes) dans Sourate Al-Fâtiha !",
  },
  "غ": {
    arabicName: "غَيْنٌ",
    alphabetOrder: 19,
    abjadValue: 1000,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Identique à 'Ayn (ع) avec 1 point placé au-dessus de la petite boucle supérieure.",
    childWritingTip: "Le même joli dessin que 'Ayn, avec un petit trésor tout en haut de sa tête !",
    solarLunarExample: { arabic: "الْغَفُور", trans: "al-ghafūr", meaning: "Le Très Pardonneur" },
    confusionPairs: [
      { letter: "خ", name: "Kha", difference: "Même zone (haut de gorge), mais Ghayn vibre avec la voix sans souffle sec." },
      { letter: "ع", name: "Ayn", difference: "Ghayn a 1 point et est grave (Tafkhîm) ; 'Ayn est fine." },
    ],
    commonMistake: "Ne pas couper le Ghayn par Qalqalah (comme un 'g' dur) ni le confondre avec Qaf devant un 'L' ou au soukoun (ex: مَغْضُوب).",
    childMistakeTip: "Fais couler l'eau doucement au sommet de ta gorge : 'Ghhh', sans faire un 'G' sec !",
    quranFact: "Elle détient la plus grande valeur numérique du système Abjad traditionnel : 1 000.",
    childFact: "C'est la championne de mathématiques de l'alphabet : son chiffre secret vaut 1 000 !",
  },
  "ف": {
    arabicName: "فَاءٌ",
    alphabetOrder: 20,
    abjadValue: 80,
    dots: "1 point au-dessus (نُقْطَة فَوْقَهَا)",
    writingSteps: "Dessinez une petite tête ronde au-dessus de la ligne, descendez sur la ligne puis filez en barque plate vers la gauche, avec 1 point sur la tête.",
    childWritingTip: "Une petite tête ronde qui regarde à droite avec 1 étoile au-dessus, et un corps plat sur la ligne !",
    solarLunarExample: { arabic: "الْفَلَق", trans: "al-falaq", meaning: "L'aube naissante" },
    confusionPairs: [
      { letter: "ق", name: "Qaf", difference: "Fa a 1 point et un corps plat sur la ligne ; Qaf a 2 points et plonge en bol sous la ligne." },
    ],
    commonMistake: "Ne pas mordre fortement la lèvre inférieure : un contact léger entre le bord des dents du haut et l'intérieur humide de la lèvre suffit.",
    childMistakeTip: "Pose doucement tes dents de lapin sans mordre ta lèvre et laisse passer le vent léger !",
    quranFact: "Première lettre de la première sourate : الْفَاتِحَة (Al-Fâtiḥah) et de الْفَلَق (Al-Falaq).",
    childFact: "C'est la lettre d'Al-Fâtiḥah (L'Ouverture) et d'Al-Falaq (L'Aube) !",
  },
  "ق": {
    arabicName: "قَافٌ",
    alphabetOrder: 21,
    abjadValue: 100,
    dots: "2 points au-dessus (نُقْطَتَان فَوْقَهَا)",
    writingSteps: "Dessinez une tête ronde au-dessus de la ligne, puis plongez dans un bol arrondi profond sous la ligne, avec 2 points au-dessus.",
    childWritingTip: "Une petite tête ronde avec 2 jolis yeux et un grand bol profond qui plonge sous la ligne !",
    solarLunarExample: { arabic: "الْقُرْآن", trans: "al-qur'ān", meaning: "Le Coran" },
    confusionPairs: [
      { letter: "ك", name: "Kaf", difference: "Qaf vient du fond du palais mou (grave : قَلْب = cœur) ; Kaf vient du palais dur (fin : كَلْب = chien)." },
      { letter: "ف", name: "Fa", difference: "Qaf a 2 points et plonge sous la ligne ; Fa a 1 point et reste sur la ligne." },
    ],
    commonMistake: "Ne pas la transformer en Kaf fin ni en 'g' dur dialectal. Au soukoun (يَقْطَعُ), elle produit une Qalqalah bien ronde et grave.",
    childMistakeTip: "Va chercher le son tout au fond près de la petite goutte d'eau (luette), bien plus loin que le K !",
    quranFact: "Ouvre la sourate qui porte son nom : Sourate Qâf (50 : ق ۚ وَالْقُرْآنِ الْمَجِيدِ) et débute les mots الْقُرْآن et اقْرَأْ.",
    childFact: "C'est la lettre qui commence le mot القُرْآن (Al-Qur'ân — Le Coran) !",
  },
  "ك": {
    arabicName: "كَافٌ",
    alphabetOrder: 22,
    abjadValue: 20,
    dots: "Sans point (possède une petite marque interne en forme de Kaf isolé)",
    writingSteps: "Tracez une grande barre verticale jusqu'à la ligne, tournez à angle droit vers la gauche, puis ajoutez la petite marque courbe à l'intérieur.",
    childWritingTip: "Comme une belle botte ou une chaise droite qui garde un petit trésor courbe (ء) posé dedans !",
    solarLunarExample: { arabic: "الْكَوْثَر", trans: "al-kawthar", meaning: "L'Abondance" },
    confusionPairs: [
      { letter: "ق", name: "Qaf", difference: "Kaf est fine et soufflée ; Qaf est grave et bloquée plus en arrière." },
      { letter: "ل", name: "Lam", difference: "Lam est plus fine en hameçon et sans signe intérieur ; Kaf a un angle carré et s'aplatit sur la ligne." },
    ],
    commonMistake: "Au soukoun (مُلْك / يَكْتُبُ), laisser sortir un petit souffle final (Hams) sans ajouter une voyelle 'e' parasite.",
    childMistakeTip: "Quand Kaf s'arrête, laisse échapper un mini souffle d'air discret : 'K-h' sans dire 'Ke' !",
    quranFact: "Première lettre du célèbre assemblage mystérieux de Sourate Maryam : كهيعص (19).",
    childFact: "C'est la lettre qui commence كِتَاب (Kitâb = le Livre) et الكَوْثَر (Al-Kawthar) !",
  },
  "ل": {
    arabicName: "لَامٌ",
    alphabetOrder: 23,
    abjadValue: 30,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Tracez une grande barre verticale de haut en bas, puis formez un crochet arrondi sous la ligne qui remonte légèrement à gauche.",
    childWritingTip: "Comme une canne à pêche ou un joli parapluie retourné !",
    solarLunarExample: { arabic: "اللَّيْل", trans: "al-layl", meaning: "La Nuit" },
    confusionPairs: [
      { letter: "ا", name: "Alif", difference: "Alif ne se lie jamais à la lettre suivante ; Lam se lie des deux côtés (لـ ـلـ)." },
      { letter: "ك", name: "Kaf", difference: "Lam plonge sous la ligne en courbe ; Kaf reste sur la ligne." },
    ],
    commonMistake: "Ne jamais rendre le Lam lourd/grave hors du Nom d'Allah (ex: dire اللَّه grave après 'a/ou', mais وَلَا ou صَلَاة avec Lam parfaitement fin).",
    childMistakeTip: "La lettre Lam reste toute douce et souriante, sauf dans le grand nom d'Allah après 'A' ou 'Ou' !",
    quranFact: "Lettre solaire particulière : elle s'assimile à elle-même dans الّليْل. C'est aussi la 2ème lettre la plus fréquente du Coran après Alif.",
    childFact: "C'est l'une des lettres les plus présentes du Coran, toujours présente dans le nom اللَّه !",
  },
  "م": {
    arabicName: "مِيمٌ",
    alphabetOrder: 24,
    abjadValue: 40,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Formez une petite boucle ronde sur la ligne, prolongez horizontalement vers la gauche puis descendez verticalement sous la ligne.",
    childWritingTip: "Un petit rond fermé avec une longue queue qui descend vers le bas comme un cerf-volant !",
    solarLunarExample: { arabic: "الْمُلْك", trans: "al-mulk", meaning: "La Royauté" },
    confusionPairs: [
      { letter: "ه", name: "Ha", difference: "Mîm en fin de mot descend verticalement ; Ha finale forme un cercle fermé." },
    ],
    commonMistake: "Ne pas oublier de laisser le son passer doucement par le nez (Ghunnah) et d'éviter de presser trop durement les lèvres devant و ou ف.",
    childMistakeTip: "Ferme tes deux lèvres tout doux pour que ton petit nez chante 'Mmm' comme une clochette !",
    quranFact: "Initiale du nom du Prophète مُحَمَّد (ﷺ) et des sourates ouvrant par الم et حم.",
    childFact: "C'est la toute première lettre du doux nom de notre Prophète مُحَمَّد (ﷺ) !",
  },
  "ن": {
    arabicName: "نُونٌ",
    alphabetOrder: 25,
    abjadValue: 50,
    dots: "1 point au centre du bol (نُقْطَة فِي وَسَطِهَا)",
    writingSteps: "Tracez un grand bol profond commençant légèrement au-dessus de la ligne et remontant à gauche, avec 1 point placé bien au centre.",
    childWritingTip: "Un grand bol rempli d'eau avec une belle étoile qui flotte juste au milieu !",
    solarLunarExample: { arabic: "النُّور", trans: "an-nūr", meaning: "La Lumière" },
    confusionPairs: [
      { letter: "ب", name: "Ba", difference: "Ba a 1 point EN DESSOUS (ب) et reste plat ; Nûn a 1 point AU MILIEU/DESSUS (ن) et forme un bol." },
      { letter: "ت", name: "Ta", difference: "En début/milieu, Nûn n'a qu'1 point dessus (نـ), Ta en a 2 (تـ)." },
    ],
    commonMistake: "En Tajweed, Nûn Sâkin subit 4 règles majeures selon la lettre suivante (Iẓhâr, Idghâm, Iqlâb, Ikhfâ'). Ne jamais avaler sa Ghunnah quand elle est doublée (إِنَّ).",
    childMistakeTip: "Quand Nûn porte une couronne Chadda (نّ), fais chanter ton petit nez pendant 2 secondes : 'Innn-na' !",
    quranFact: "Ouvre la Sourate Al-Qalam (68) par son serment sacré : ن ۚ وَالْقَلَمِ وَمَا يَسْطُرُونَ.",
    childFact: "Une sourate magique sur la plume commence directement par elle : ن ۚ وَالْقَلَمِ !",
  },
  "ه": {
    arabicName: "هَاءٌ",
    alphabetOrder: 26,
    abjadValue: 5,
    dots: "Sans point (ne pas confondre avec ة qui porte 2 points)",
    writingSteps: "En forme isolée, tracez une petite larme ronde fermée. En médiane (ـهـ), elle forme une jolie double boucle en papillon (8 couché).",
    childWritingTip: "Elle adore changer de costume : une goutte d'eau isolée, et un joli petit nœud papillon (ـهـ) au milieu des mots !",
    solarLunarExample: { arabic: "الْهُدَىٰ", trans: "al-hudā", meaning: "La Guidée" },
    confusionPairs: [
      { letter: "ح", name: "Ḥa", difference: "Ha est un souffle très léger venant du bas de la gorge ; Ḥa vient du milieu avec serrement." },
      { letter: "ة", name: "Ta Marbûṭah", difference: "Sans points c'est Ha (ه) ; avec 2 points dessus (ة) cela se prononce 't' en liaison." },
    ],
    commonMistake: "Veiller à bien faire entendre le Ha final lorsqu'on s'arrête dessus (ex: اللَّهْ / عَلَيْهْ), sans le supprimer par faiblesse (attribut Khafâ').",
    childMistakeTip: "N'oublie pas le petit soupir tout doux même à la toute fin du mot : 'Allâh' !",
    quranFact: "Termine le Nom Suprême اللَّهُ et forme les pronoms d'appartenance avec prolongation (Mad Ṣilah).",
    childFact: "C'est la dernière lettre du plus beau mot de l'univers : اللَّه !",
  },
  "و": {
    arabicName: "وَاوٌ",
    alphabetOrder: 27,
    abjadValue: 6,
    dots: "Sans point (مُهْمَلَة)",
    writingSteps: "Dessinez une petite boucle ronde sur la ligne puis prolongez en courbe tombante sous la ligne comme le Ra. Ne s'attache jamais à gauche.",
    childWritingTip: "Une petite tête ronde sur la ligne avec un joli toboggan en bas ! Et pas de main à gauche !",
    solarLunarExample: { arabic: "الْوَدُود", trans: "al-wadūd", meaning: "Le Très Aimant" },
    confusionPairs: [
      { letter: "ر", name: "Ra", difference: "Ra n'a pas de boucle en haut ; Waw commence par une boucle ronde fermée." },
      { letter: "ف", name: "Fa", difference: "Waw n'a pas de point et plonge sous la ligne ; Fa a 1 point." },
    ],
    commonMistake: "En tant que consonne (وَ), bien arrondir les lèvres sans y mêler de nasalisation nasale (Ghunnah).",
    childMistakeTip: "Fais un cercle tout propre avec tes lèvres sans faire passer l'air par le nez !",
    quranFact: "Sert à la fois de consonne ('W'), de lettre de prolongation longue ('Oû') et de particule de serment coranique (وَالشَّمْسِ / وَالْعَصْرِ).",
    childFact: "Elle est trois fois magique : elle sert à dire 'W', à chanter un long 'Oûuu', et même à dire 'Et' !",
  },
  "ي": {
    arabicName: "يَاءٌ",
    alphabetOrder: 28,
    abjadValue: 10,
    dots: "2 points en dessous (نُقْطَتَان تَحْتَهَا)",
    writingSteps: "Tracez une jolie courbe en S inversé qui plonge sous la ligne en large bol remontant, avec 2 points côte à côte dessous.",
    childWritingTip: "Un joli petit cygne élégant qui glisse sur l'eau avec deux petites perles en dessous !",
    solarLunarExample: { arabic: "الْيَوْم", trans: "al-yawm", meaning: "Le Jour" },
    confusionPairs: [
      { letter: "ى", name: "Alif Maqṣûrah", difference: "Alif Maqṣûrah s'écrit sans aucun point (مُوسَىٰ) et se lit 'â' ; Ya porte 2 points (فِي) et se lit 'y/î'." },
      { letter: "ت", name: "Ta", difference: "En début/milieu, Ya a 2 points EN DESSOUS (يـ), Ta a 2 points AU-DESSUS (تـ)." },
    ],
    commonMistake: "En finale dans le Mushaf (ي sans point sur les copies égyptiennes vs ى), ne jamais confondre Ya (son 'î') et Alif Maqṣûrah (son 'â').",
    childMistakeTip: "Regarde bien en dessous : les 2 points du petit cygne sont toujours cachés sous le bateau (يـ), jamais au-dessus !",
    quranFact: "Ouvre la célèbre sourate Yâ-Sîn (36 : يس) — surnommée le « Cœur du Coran ».",
    childFact: "C'est la première lettre de Sourate Yâ-Sîn (يس), appelée le « Cœur du Coran » !",
  },
  "ا": {
    arabicName: "أَلِفٌ (مَدِّيَّة)",
    alphabetOrder: 29,
    abjadValue: 1,
    dots: "Sans point ni Hamza (bâton vertical pur)",
    writingSteps: "Tracez simplement une ligne verticale bien droite de haut en bas reposant sur la ligne. Ne s'attache jamais à gauche.",
    childWritingTip: "Un grand pilier tout droit et majestueux qui touche les nuages, tout simple et fier !",
    solarLunarExample: { arabic: "اَلْقَمَر", trans: "al-qamar", meaning: "La Lune (Hamzat al-Wasl)" },
    confusionPairs: [
      { letter: "أ", name: "Hamza", difference: "Alif nu (ا) prolonge une voyelle 'A' ; avec Hamza (أ) c'est une consonne glottale." },
      { letter: "ل", name: "Lam", difference: "Alif ne s'attache jamais à gauche ; Lam se lie et descend en crochet." },
    ],
    commonMistake: "L'Alif de prolongation doit prendre la couleur de la lettre qui le précède : grave après ق/ط/ص (قَالَ), fine après ك/ب/س (كَانَ).",
    childMistakeTip: "L'Alif est comme un caméléon gentil : elle chante un grand 'Â' fort après un champion, et un 'Â' doux après une lettre douce !",
    quranFact: "Lettre la plus fréquente de tout le Saint Coran (plus de 48 000 occurrences). Ouvre 'Alif-Lâm-Mîm' (الم) dans 6 sourates.",
    childFact: "C'est la championne des apparitions : la lettre que l'on rencontre le plus souvent dans tout le Coran !",
  },
});

/**
 * Pure helper resolving exact contextual shapes (respecting non-left-connecting letters!)
 */
export const getAccurateContextualForms = (letterChar, fallbackBase) => {
  const iso = fallbackBase?.isolated || letterChar;
  if (NON_CONNECTING_LEFT_LETTERS.has(letterChar)) {
    return Object.freeze({
      isolated: iso,
      initial: iso,
      medial: `ـ${iso}`,
      final: `ـ${iso}`,
      connectsLeft: false,
      connectivityLabel: "Ne se lie jamais à gauche (حرف قطع)",
      childConnectivityLabel: "Ne donne pas la main à gauche !",
    });
  }
  return Object.freeze({
    isolated: iso,
    initial: fallbackBase?.initial || `${iso}ـ`,
    medial: fallbackBase?.medial || `ـ${iso}ـ`,
    final: fallbackBase?.final || `ـ${iso}`,
    connectsLeft: true,
    connectivityLabel: "Se lie des 2 côtés (droite & gauche)",
    childConnectivityLabel: "Donne la main à droite et à gauche !",
  });
};

/**
 * Pure helper computing all Tajweed Sifat (characteristics) for any letter
 */
export const getLetterSifat = (letterChar) => {
  const airflow = HAMS_LETTERS.has(letterChar)
    ? { name: "Hams (هَمْس)", meaning: "Avec écoulement de souffle", childMeaning: "🌬️ Avec un petit souffle d'air", isBreath: true }
    : { name: "Jahr (جَهْر)", meaning: "Son clair sans souffle parasite", childMeaning: "🔊 Voix claire sans fuite d'air", isBreath: false };

  let duration;
  if (SHIDDAH_LETTERS.has(letterChar)) {
    duration = { name: "Shiddah (شِدَّة)", meaning: "Coupure nette du son", childMeaning: "🛑 Son bref et net", code: "shiddah" };
  } else if (TAWASSUT_LETTERS.has(letterChar)) {
    duration = { name: "Tawassuṭ (تَوَسُّط)", meaning: "Durée intermédiaire équilibrée", childMeaning: "⚖️ Son moyen équilibré", code: "tawassut" };
  } else {
    duration = { name: "Rakhâwah (رَخَاوَة)", meaning: "Son continu et fluide", childMeaning: "🌊 Son qui glisse doucement", code: "rakhawah" };
  }

  let elevation;
  if (ISTILA_LETTERS.has(letterChar)) {
    elevation = { name: "Isti'lâ' (اِسْتِعْلَاء)", meaning: "Langue élevée → Toujours Grave (Tafkhîm)", childMeaning: "🦁 Langue haute → Toujours Grave !", isHeavy: true };
  } else if (letterChar === "ر" || letterChar === "ل" || letterChar === "ا") {
    elevation = { name: "Istifâl (conditionnel)", meaning: "Fine par défaut, grave selon le contexte", childMeaning: "🎭 Change selon ses voisines !", isHeavy: "conditional" };
  } else {
    elevation = { name: "Istifâl (اِسْتِفَال)", meaning: "Langue basse → Toujours Fine (Tarqîq)", childMeaning: "🪶 Langue plate → Toujours Douce !", isHeavy: false };
  }

  const adhesion = ITBAQ_LETTERS.has(letterChar)
    ? { name: "Itbâq (إِطْبَاق)", meaning: "Adhérence haute créant une caisse de résonance", childMeaning: "🥣 Forme une cuillère au palais", isItbaq: true }
    : { name: "Infitâḥ (اِنْفِتَاح)", meaning: "Espace ouvert entre langue et palais", childMeaning: "📖 Bouche ouverte normalement", isItbaq: false };

  const fluency = IDHLAQ_LETTERS.has(letterChar)
    ? { name: "Idhlâq (إِذْلَاق)", meaning: "Prononciation agile et rapide (bout des lèvres/langue)", childMeaning: "⚡ Très facile et rapide à dire" }
    : { name: "Iṣmât (إِصْمَات)", meaning: "Articulation posée et ferme", childMeaning: "🏛️ Lettre solide et bien posée" };

  const unique = [];
  if (QALQALAH_LETTERS.has(letterChar)) {
    unique.push({ name: "Qalqalah (قَلْقَلَة)", desc: "Rebond sonore lorsque la lettre porte un Soukoun", childDesc: "🏀 Rebondit au stop !" });
  }
  if (SAFIR_LETTERS.has(letterChar)) {
    unique.push({ name: "Ṣafîr (صَفِير)", desc: "Sifflement aigu ou grave caractéristique", childDesc: "🎵 Petit sifflement musical" });
  }
  if (LIN_LETTERS.has(letterChar)) {
    unique.push({ name: "Lîn (لِين)", desc: "Son très doux au soukoun après Fatḥa (خَوْف / بَيْت)", childDesc: "☁️ Douce comme un nuage après 'A'" });
  }
  if (letterChar === "ل" || letterChar === "ر") {
    unique.push({ name: "Inḥirâf (اِنْحِرَاف)", desc: "Déviation latérale ou centrale du flux sonore", childDesc: "↪️ Le son contourne la langue" });
  }
  if (letterChar === "ر") {
    unique.push({ name: "Takrîr (تَكْرِير)", desc: "Vibration contrôlée (1 à 2 battements légers)", childDesc: "🎠 Petit roulement doux" });
  }
  if (letterChar === "ش") {
    unique.push({ name: "Tafash-shî (تَفَشِّي)", desc: "Large diffusion du souffle dans toute la bouche", childDesc: "🌬️ Souffle qui remplit la bouche" });
  }
  if (letterChar === "ض") {
    unique.push({ name: "Istiṭâlah (اِسْتِطَالَة)", desc: "Élongation du son le long des bords latéraux jusqu'aux molaires", childDesc: "📏 Son qui glisse jusqu'aux molaires" });
  }
  if (letterChar === "ن" || letterChar === "م") {
    unique.push({ name: "Ghunnah (غُنَّة)", desc: "Résonance nasale douce inhérente à la lettre", childDesc: "🔔 Chante dans le nez !" });
  }

  return Object.freeze({
    airflow,
    duration,
    elevation,
    adhesion,
    fluency,
    unique: Object.freeze(unique),
  });
};

/**
 * Pure helper computing Quranic Tajweed rules for any letter (Solar/Lunar, Nun Sakin, Mim Sakin, Muqatta'at)
 */
export const getLetterQuranRules = (letterChar, entry) => {
  const isShamsiyyah = SHAMSIYYAH_LETTERS.has(letterChar);
  const solarLunar = isShamsiyyah
    ? {
        type: "Solaire (الشَّمْسِيَّة)",
        isSolar: true,
        desc: "Le Lâm de 'Al-' (ال) s'efface et s'assimile dans cette lettre doublée d'une Chadda.",
        childDesc: "☀️ Lettre Soleil : elle fait disparaître le 'L' de 'Al-' pour briller deux fois plus fort !",
        example: entry?.solarLunarExample || null,
      }
    : {
        type: "Lunaire (الْقَمَرِيَّة)",
        isSolar: false,
        desc: "Le Lâm de 'Al-' (ال) se prononce clairement avec un Soukoun.",
        childDesc: "🌙 Lettre Lune : on entend bien le 'L' de 'Al-' tout clair avant elle !",
        example: entry?.solarLunarExample || null,
      };

  let nunSakinRule;
  if (letterChar === "ا") {
    nunSakinRule = {
      rule: "Prolongation / Wasl",
      desc: "L'Alif nu ne débute pas de mot après Nûn Sâkin ; s'il suit directement (نَا), il prolonge 'Â'.",
      childDesc: "✨ Prolonge la voix quand elle suit le Nûn !",
    };
  } else if (THROAT_IZHAR_LETTERS.has(letterChar)) {
    nunSakinRule = {
      rule: "Iẓhâr Ḥalqî (إِظْهَار حَلْقِي)",
      desc: "Après Nûn Sâkin ou Tanwîn, le son 'N' reste parfaitement clair sans nasalisation longue.",
      childDesc: "☀️ Soleil clair : le son 'N' reste tout net devant cette lettre de la gorge !",
    };
  } else if (IDGHAM_GHUNNAH_LETTERS.has(letterChar)) {
    nunSakinRule = {
      rule: "Idghâm avec Ghunnah (إِدْغَام بِغُنَّة)",
      desc: "Le Nûn Sâkin / Tanwîn fusionne dans cette lettre avec une résonance nasale de 2 temps.",
      childDesc: "🧲 Aimant chantant : le 'N' se colle dedans avec la clochette du nez (2 temps) !",
    };
  } else if (IDGHAM_NO_GHUNNAH_LETTERS.has(letterChar)) {
    nunSakinRule = {
      rule: "Idghâm sans Ghunnah (إِدْغَام بِغَيْرِ غُنَّة)",
      desc: "Fusion totale du Nûn Sâkin dans cette lettre sans passage par le nez.",
      childDesc: "🧲 Aimant rapide : le 'N' disparaît complètement dedans sans passer par le nez !",
    };
  } else if (IQLAB_LETTERS.has(letterChar)) {
    nunSakinRule = {
      rule: "Iqlâb (إِقْلَاب)",
      desc: "Transforme le Nûn Sâkin / Tanwîn précédent en un 'M' doux nasalisé (2 temps).",
      childDesc: "🔄 Caméléon rigolo : devant Ba, le 'N' se déguise en 'M' qui chante du nez !",
    };
  } else {
    nunSakinRule = {
      rule: "Ikhfâ' Haqîqî (إِخْفَاء حَقِيقِي)",
      desc: "Dissimule le Nûn Sâkin / Tanwîn précédent en une résonance nasale douce (2 temps) préparant cette lettre.",
      childDesc: "🥷 Ninja secret : le 'N' se cache en bourdonnant doucement avant cette lettre !",
    };
  }

  let mimSakinRule;
  if (letterChar === "م") {
    mimSakinRule = {
      rule: "Idghâm Shafawî (إِدْغَام شَفَوِي)",
      desc: "Deux Mîm qui se suivent fusionnent en un seul Mîm long avec Ghunnah (2 temps).",
      childDesc: "🧲 Deux Mîm amis se donnent la main avec une belle chanson du nez !",
    };
  } else if (letterChar === "ب") {
    mimSakinRule = {
      rule: "Ikhfâ' Shafawî (إِخْفَاء شَفَوِي)",
      desc: "Devant Ba, le Mîm Sâkin s'adoucit avec Ghunnah nasale de 2 temps (ex: تَرْمِيهِم بِحِجَارَة).",
      childDesc: "🥷 Devant Ba, le Mîm chante doucement 2 temps dans le nez !",
    };
  } else if (letterChar === "و" || letterChar === "ف") {
    mimSakinRule = {
      rule: "Iẓhâr Shafawî Strict (أَشَدّ إِظْهَار)",
      desc: "Prononcer le Mîm Sâkin très nettement sans fusion ni dissimulation malgré la proximité des lèvres !",
      childDesc: "⚠️ Attention : prononce le Mîm bien clair avant cette lettre voisine des lèvres !",
    };
  } else {
    mimSakinRule = {
      rule: "Iẓhâr Shafawî (إِظْهَار شَفَوِي)",
      desc: "Après un Mîm Sâkin, le son 'M' reste clair et net sans allongement nasal.",
      childDesc: "☀️ Le 'M' reste tout clair et propre devant cette lettre !",
    };
  }

  const muqattaat = MUQATTAAT_INFO[letterChar] || null;

  return Object.freeze({
    solarLunar,
    nunSakinRule,
    mimSakinRule,
    muqattaat,
  });
};

/**
 * Pure functional aggregator returning ALL possible information for a given Arabic letter.
 */
export const getCompleteLetterProfile = (letterChar) => {
  if (!letterChar) return null;

  const base = ARABIC_LETTERS.find((x) => x.letter === letterChar) || null;
  const anatomy = getLetterAnatomy(letterChar);
  const posture = getTonguePostureSpec(letterChar);
  const entry = LETTER_ENCYCLOPEDIA_MAP[letterChar] || null;

  if (!base && !anatomy && !entry) return null;

  const forms = getAccurateContextualForms(letterChar, base);
  const sifat = getLetterSifat(letterChar);
  const quranRules = getLetterQuranRules(letterChar, entry);

  const codePoint = letterChar.codePointAt(0);
  const unicodeHex = codePoint ? `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}` : "";

  const maddaForms = Object.freeze([
    { arabic: `${letterChar}َا`, label: "Madd Alif (Â)", synth: `${letterChar}َا`, desc: "Prolongation 2 temps en 'Â'" },
    { arabic: `${letterChar}ِي`, label: "Madd Ya (Î)", synth: `${letterChar}ِي`, desc: "Prolongation 2 temps en 'Î'" },
    { arabic: `${letterChar}ُو`, label: "Madd Waw (Oû)", synth: `${letterChar}ُو`, desc: "Prolongation 2 temps en 'Oû'" },
  ]);

  const advancedHarakatForms = Object.freeze([
    { arabic: `${letterChar}ّ`, label: "Chadda (Doublée)", synth: `${letterChar}َّ`, desc: "Lettre appuyée et doublée" },
    { arabic: `${letterChar}ًا`, label: "Tanwîn Fatḥ (-an)", synth: `${letterChar}ًا`, desc: "Terminaison indéfinie 'an'" },
    { arabic: `${letterChar}ٍ`, label: "Tanwîn Kasr (-in)", synth: `${letterChar}ٍ`, desc: "Terminaison indéfinie 'in'" },
    { arabic: `${letterChar}ٌ`, label: "Tanwîn Ḍamm (-oun)", synth: `${letterChar}ٌ`, desc: "Terminaison indéfinie 'oun'" },
  ]);

  return Object.freeze({
    letter: letterChar,
    name: base?.name || anatomy?.name || "",
    arabicName: entry?.arabicName || letterChar,
    trans: base?.trans || anatomy?.trans || "",
    alphabetOrder: entry?.alphabetOrder || null,
    abjadValue: entry?.abjadValue || null,
    unicodeHex,
    dots: entry?.dots || "",
    forms,
    anatomy,
    posture,
    sifat,
    quranRules,
    writingSteps: entry?.writingSteps || "",
    childWritingTip: entry?.childWritingTip || "",
    confusionPairs: Object.freeze(entry?.confusionPairs || []),
    commonMistake: entry?.commonMistake || "",
    childMistakeTip: entry?.childMistakeTip || "",
    quranFact: entry?.quranFact || "",
    childFact: entry?.childFact || "",
    maddaForms,
    advancedHarakatForms,
  });
};
