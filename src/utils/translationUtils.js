/**
 * Utilities for localized Quran translations and intelligent part segmentation.
 * Implements Arabic word boundary detection, translation indexing, sequential
 * part chaining (first word of next part = next word), and missing start/end word fixing.
 */

// Common Quranic multilingual keyword mappings for Arabic roots & terms
const QURAN_KEYWORDS = {
  // Divine names & attributes
  'الله': ['allah', 'dieu', 'god', 'gott', 'dios', 'аллах', 'бог', 'tanrı', 'tuhan'],
  'رحمن': ['miséricordieux', 'merciful', 'barmherzig', 'misericordioso', 'милостив', 'rahîm', 'pengasih', 'gracious'],
  'رحيم': ['très miséricordieux', 'merciful', 'compassionate', 'gnädig', 'милосерд', 'mercy', 'penyayang'],
  'رب': ['seigneur', 'lord', 'herr', 'señor', 'господ', 'rab', 'tuhan'],
  'عالم': ['monde', 'univers', 'worlds', 'welten', 'mundos', 'миров', 'âlemler'],
  'ملك': ['roi', 'maître', 'king', 'master', 'könig', 'rey', 'цар', 'hükümran', 'raj'],
  'يوم': ['jour', 'day', 'tag', 'día', 'день', 'gün', 'hari'],
  'دين': ['jugement', 'rétribution', 'religion', 'judgment', 'gericht', 'juicio', 'суд', 'din'],
  'عبد': ['ador', 'serv', 'worship', 'dienen', 'servir', 'поклоня', 'kulluk', 'sembah'],
  'استعن': ['aid', 'secour', 'help', 'hilfe', 'ayuda', 'помощ', 'yardım', 'pertolongan'],
  'هدي': ['guid', 'führen', 'guiar', 'вести', 'hidayet', 'petunjuk'],
  'صراط': ['chemin', 'voie', 'path', 'weg', 'camino', 'путь', 'sırat', 'jalan'],
  'مستقيم': ['droit', 'straight', 'gerade', 'recto', 'прям', 'dosdoğru', 'lurus'],
  'نعم': ['bienfait', 'grâce', 'favor', 'blessing', 'gnade', 'gracia', 'милость', 'nimet', 'nikmat'],
  'غضب': ['colère', 'courroux', 'anger', 'wrath', 'zorn', 'ira', 'гнев', 'gazap', 'murka'],
  'ضلل': ['égar', 'astray', 'irregang', 'extraviad', 'заблуд', 'sapmış', 'sesat'],
  'كتب': ['livre', 'écrit', 'book', 'scripture', 'buch', 'libro', 'книга', 'kitap', 'kitab'],
  'آمن': ['croi', 'croyant', 'believe', 'believer', 'glaub', 'creer', 'веру', 'iman', 'beriman'],
  'كفر': ['mécréant', 'disbelieve', 'ungläub', 'incrédulo', 'невер', 'kâfir', 'kafir'],
  'سمع': ['entend', 'ouïe', 'hear', 'hör', 'oír', 'слыш', 'işit', 'dengar'],
  'بصر': ['voi', 'vue', 'see', 'sight', 'seh', 'ver', 'вид', 'gör', 'lihat'],
  'علم': ['sav', 'connaît', 'savant', 'know', 'knowing', 'wiss', 'saber', 'зна', 'bilen', 'mengetahui'],
  'خلق': ['cré', 'create', 'schöpf', 'crear', 'сотвор', 'yarat', 'cipta'],
  'أرض': ['terre', 'earth', 'erde', 'tierra', 'земл', 'yer', 'bumi'],
  'سماء': ['ciel', 'cieux', 'heaven', 'sky', 'himmel', 'cielo', 'неб', 'gök', 'langit'],
  'نور': ['lumière', 'light', 'licht', 'luz', 'свет', 'nur', 'cahaya'],
  'نار': ['feu', 'enfer', 'fire', 'hell', 'feuer', 'fuego', 'огонь', 'ateş', 'api'],
  'جنة': ['jardin', 'paradis', 'garden', 'paradise', 'garten', 'paraíso', 'сад', 'ра', 'cennet', 'surga'],
  'قلب': ['cœur', 'heart', 'herz', 'corazón', 'сердц', 'kalp', 'hati'],
  'نفس': ['âme', 'personne', 'soul', 'seele', 'alma', 'душ', 'nefis', 'jiwa'],
  'رسول': ['messager', 'apôtre', 'messenger', 'gesandte', 'mensajero', 'посланник', 'elçi', 'rasul'],
  'نبي': ['prophète', 'prophet', 'profeta', 'пророк', 'peygamber', 'nabi'],
  'آية': ['signe', 'verset', 'sign', 'verse', 'zeichen', 'signo', 'знамение', 'ayet', 'ayat'],
  'حق': ['vérité', 'vrai', 'droit', 'truth', 'wahrheit', 'verdad', 'истина', 'правда', 'hak', 'kebenaran'],
  // Quranic Speech, rulings, social terms
  'قول': ['say', 'said', 'speak', 'spoke', 'dis', 'disent', 'dit', 'parle', 'sag', 'sagte', 'sprich', 'di', 'dijo', 'habla', 'скажи', 'сказал', 'говори', 'de', 'dedi', 'katakan'],
  'قل': ['say', 'dis', 'sag', 'sprich', 'di', 'скажи', 'de', 'katakan'],
  'نسا': ['women', 'woman', 'femme', 'femmes', 'frauen', 'frau', 'mujeres', 'mujer', 'женщин', 'женщина', 'kadın', 'kadınlar', 'wanita', 'perempuan', 'girls', 'girl', 'fille', 'filles', 'orpheline', 'orphelines', 'huerfana', 'huerfanas', 'waisenmadchen'],
  'فتو': ['ruling', 'fatwa', 'consult', 'decision', 'avis', 'juridique', 'jugement', 'decret', 'decrete', 'ordonne', 'urteilsspruch', 'rechtsgutachten', 'dictamen', 'разъяснен', 'hüküm', 'fetva'],
  'يتيم': ['orphan', 'orphans', 'orphelin', 'orphelins', 'orpheline', 'orphelines', 'waise', 'waisen', 'waisenmadchen', 'huerfano', 'huerfanos', 'huerfana', 'huerfanas', 'сирот', 'yetim', 'anak yatim'],
  'يتام': ['orphan', 'orphans', 'orphelin', 'orphelins', 'orpheline', 'orphelines', 'waise', 'waisen', 'waisenmadchen', 'huerfano', 'huerfanos', 'huerfana', 'huerfanas', 'сирот', 'yetim', 'anak yatim'],
  'ولد': ['children', 'child', 'enfant', 'enfants', 'mineur', 'mineurs', 'faible', 'kinder', 'hijos', 'детей', 'çocuk', 'anak'],
  'ولدان': ['children', 'child', 'enfant', 'enfants', 'mineur', 'mineurs', 'faible', 'faibles', 'kinder', 'hijos', 'детей'],
  'ضعف': ['oppressed', 'weak', 'faible', 'faibles', 'mineur', 'mineurs', 'debile', 'schwach', 'unterdruckt', 'debil', 'oprimido', 'слабый', 'zayif'],
  'مستضعف': ['oppressed', 'weak', 'faible', 'faibles', 'mineur', 'mineurs', 'debile', 'schwach', 'unterdruckt', 'debil', 'oprimido'],
  'نكح': ['marry', 'marriage', 'epous', 'marier', 'mariage', 'heiraten', 'ehe', 'casar', 'matrimonio'],
  'كتب': ['prescribed', 'decreed', 'ordained', 'prescrit', 'ecrit', 'decrete', 'vorgeschrieben', 'prescrito', 'escrito'],
  'قسط': ['justice', 'just', 'équité', 'equite', 'gerechtigkeit', 'justicia', 'справедлив', 'adalet', 'keadilan'],
  'خير': ['good', 'better', 'bien', 'meilleur', 'gut', 'gutes', 'mejor', 'добр', 'лучш', 'hayır', 'kebaikan'],
  'حسن': ['good', 'better', 'best', 'righteous', 'bien', 'meilleur', 'gut', 'besser', 'mejor', 'добр', 'лучш', 'iyilik', 'kebaikan'],
  'محسن': ['good', 'doer of good', 'righteous', 'bienfaisant', 'bienfaiteur', 'bien', 'gutes', 'gut', 'rechtschaffen', 'bienhechor', 'добродетель', 'добр', 'muhsin', 'kebaikan'],
  'احسن': ['better', 'best', 'good', 'meilleur', 'mieux', 'bien', 'gut', 'besser', 'mejor', 'лучш', 'en iyi', 'terbaik'],
  'تبع': ['follow', 'follows', 'followed', 'following', 'pursue', 'suit', 'suivre', 'suivi', 'suivent', 'folgen', 'folgt', 'folgte', 'seguir', 'sigue', 'siguió', 'следовать', 'следует', 'tabi', 'uymak', 'mengikuti'],
  'اتبع': ['follow', 'follows', 'followed', 'following', 'pursue', 'suit', 'suivre', 'suivi', 'suivent', 'folgen', 'folgt', 'folgte', 'seguir', 'sigue', 'siguió', 'следовать', 'следует', 'tabi', 'uymak', 'mengikuti'],
  'ملة': ['religion', 'creed', 'faith', 'religion', 'creance', 'foi', 'communaute', 'glaube', 'creencia', 'fe', 'религия', 'вера', 'din', 'millet', 'agama'],
  'حنيف': ['truth', 'inclining toward truth', 'upright', 'monotheist', 'hanif', 'droiture', 'droit', 'vrai croyant', 'monotheiste', 'aufrecht', 'monoteista', 'правоверный', 'hanif'],
  'حنفا': ['truth', 'inclining toward truth', 'upright', 'monotheist', 'hanif', 'droiture', 'droits', 'vrais croyants', 'monotheistes', 'aufrecht', 'monoteistas', 'правоверные', 'hanifler'],
  'اتخذ': ['took', 'take', 'taken', 'choose', 'chosen', 'pris', 'prendre', 'choisi', 'choisir', 'adopté', 'adopter', 'nehmen', 'nahm', 'gewählt', 'tomar', 'tomó', 'elegir', 'взял', 'брать', 'избрал', 'edinmek', 'edindi', 'seçti', 'mengambil'],
  'تخذ': ['took', 'take', 'taken', 'choose', 'pris', 'prendre', 'choisi', 'nehmen', 'nahm', 'tomar', 'tomó', 'взял', 'edinmek'],
  'خليل': ['friend', 'intimate friend', 'companion', 'ami', 'ami intime', 'ami privilegie', 'freund', 'amigo', 'друг', 'dost', 'yakın dost', 'sahabat'],
  'صبر': ['patient', 'patience', 'geduld', 'paciencia', 'терпен', 'sabır', 'sabar'],
  'شكر': ['thank', 'reconnaiss', 'dank', 'gracia', 'благодар', 'şükür', 'syukur'],
  'ظلم': ['injust', 'wrong', 'unrecht', 'injusticia', 'несправедлив', 'zulüm', 'zalim'],
  'عمل': ['work', 'deed', 'oeuvr', 'action', 'tat', 'obra', 'дела', 'amel', 'amal'],
  'صلح': ['œuvres', 'oeuvres', 'bonnes œuvres', 'bonne œuvre', 'bonnes', 'righteous', 'deeds', 'righteous deeds', 'good deeds', 'gute werke', 'buenas obras', 'праведные', 'salih', 'kebajikan'],
  'صالح': ['œuvres', 'oeuvres', 'bonnes', 'righteous', 'deeds', 'werke', 'buenas obras'],
  'صالحات': ['œuvres', 'oeuvres', 'bonnes', 'righteous', 'deeds', 'werke', 'buenas obras'],
  'دخل': ['entrer', 'ferons entrer', 'entreront', 'admit', 'enter', 'eintreten', 'entrar', 'войти', 'ввести', 'girmek', 'masuk'],
  'ادخل': ['entrer', 'ferons entrer', 'entreront', 'admit', 'enter', 'eintreten', 'entrar', 'войти'],
  'ندخل': ['entrer', 'ferons entrer', 'nous les ferons entrer', 'admit', 'enter'],
  'سندخل': ['entrer', 'ferons entrer', 'nous les ferons entrer', 'bientôt', 'admit', 'enter'],
  'خلد': ['demeurer', 'demeureront', 'éternellement', 'immortel', 'abide', 'eternally', 'forever', 'dwell', 'ewig', 'bleiben', 'morar', 'eterno', 'вечно', 'пребывать', 'ebedi', 'kekal'],
  'خالد': ['demeurer', 'demeureront', 'éternellement', 'immortel', 'abide', 'eternally', 'forever', 'ewig', 'morar'],
  'خالدين': ['demeurer', 'demeureront', 'éternellement', 'immortel', 'abide', 'eternally', 'forever', 'ewig', 'morar'],
  'ابد': ['éternellement', 'toujours', 'jamais', 'forever', 'ever', 'eternally', 'ewig', 'immer', 'para siempre', 'jamás', 'вечно', 'ebediyen', 'selamanya'],
  'ابدا': ['éternellement', 'toujours', 'jamais', 'forever', 'ever', 'eternally', 'ewig', 'immer', 'para siempre', 'jamás', 'вечно', 'ebediyen', 'selamanya'],
  'وعد': ['promesse', 'promis', 'promettre', 'promise', 'promised', 'versprechen', 'verheißung', 'promesa', 'обещание', 'обещал', 'vaat', 'söz', 'janji'],
  'صدق': ['véridique', 'vrai', 'vérité', 'sincère', 'truthful', 'true', 'truth', 'sincere', 'wahrhaftig', 'wahr', 'verídico', 'verdadero', 'правдив', 'истинен', 'doğru', 'sadık', 'benar'],
  'اصدق': ['plus véridique', 'véridique', 'vrai', 'more truthful', 'most truthful', 'truthful', 'wahrhaftiger', 'más verídico', 'правдивее'],
  'قيل': ['parole', 'dire', 'propos', 'word', 'saying', 'speech', 'wort', 'rede', 'palabra', 'dicho', 'речь', 'слова', 'söz', 'perkataan'],
  'نهر': ['ruisseaux', 'rivières', 'fleuves', 'rivers', 'streams', 'flüsse', 'bäche', 'ríos', 'реки', 'ırmaklar', 'sungai'],
  'انهار': ['ruisseaux', 'rivières', 'fleuves', 'rivers', 'streams', 'flüsse', 'bäche', 'ríos', 'реки', 'ırmaklar', 'sungai'],
  'تحت': ['sous', 'under', 'beneath', 'unter', 'debajo', 'под', 'altından', 'bawah'],
  'تجر': ['coulent', 'couler', 'flow', 'flows', 'flowing', 'fließen', 'corren', 'текут', 'akan'],
  'جري': ['coulent', 'couler', 'flow', 'flows', 'flowing', 'fließen', 'corren', 'текут', 'akan'],
  'قوم': ['peopl', 'gens', 'volk', 'pueblo', 'народ', 'kavim', 'kaum'],
  // Relative pronouns & connectors
  'التي': ['who', 'whom', 'which', 'that', 'celles', 'auxquelles', 'auxquels', 'dont', 'qui', 'denen', 'die', 'welche', 'quienes', 'las cuales'],
  'الاتي': ['who', 'whom', 'which', 'that', 'celles', 'auxquelles', 'auxquels', 'dont', 'qui', 'denen', 'die', 'welche', 'quienes', 'las cuales'],
  'اللاتي': ['who', 'whom', 'which', 'that', 'celles', 'auxquelles', 'auxquels', 'dont', 'qui', 'denen', 'die', 'welche', 'quienes', 'las cuales'],
  'اللواتي': ['who', 'whom', 'which', 'that', 'celles', 'auxquelles', 'auxquels', 'dont', 'qui', 'denen', 'die', 'welche', 'quienes', 'las cuales'],
  'الذي': ['who', 'whom', 'which', 'that', 'celui', 'qui', 'dont', 'que', 'der', 'die', 'das', 'quien', 'el cual', 'que'],
  'الذين': ['who', 'whom', 'those', 'which', 'ceux', 'qui', 'dont', 'que', 'diejenigen', 'jene', 'quienes', 'los que'],
  // Attached pronouns & prepositions compounds
  'فيهن': ['them', 'her', 'their', 'elles', 'leur', 'ladessus', 'dessus', 'concernant', 'sie', 'ihnen', 'ellas', 'них', 'nim'],
  'فيهم': ['them', 'their', 'eux', 'leur', 'sie', 'ihnen', 'ellos', 'них'],
  'فيها': ['therein', 'it', 'her', 'dans', 'en', 'elle', 'y', 'darin', 'sie', 'ella', 'ней'],
  'فيه': ['therein', 'it', 'him', 'lui', 'en', 'y', 'darin', 'ihn', 'él', 'lo', 'нем'],
  'فيكم': ['you', 'your', 'vous', 'euch', 'ustedes', 'вам'],
  'فينا': ['us', 'our', 'nous', 'uns', 'nosotros', 'нас'],
  'عليهن': ['them', 'upon them', 'to them', 'elles', 'leur', 'sur elles', 'ihnen', 'über sie', 'ellas', 'них'],
  'عليهم': ['them', 'upon them', 'to them', 'eux', 'leur', 'sur eux', 'ihnen', 'über sie', 'ellos', 'них'],
  'عليها': ['her', 'it', 'upon it', 'upon her', 'elle', 'sur elle', 'ihr', 'sie', 'ella', 'ее'],
  'عليه': ['him', 'it', 'upon him', 'upon it', 'lui', 'sur lui', 'ihn', 'ihm', 'él', 'его', 'нем'],
  'عليكم': ['you', 'upon you', 'to you', 'vous', 'sur vous', 'euch', 'ustedes', 'вам', 'вас'],
  'علينا': ['us', 'upon us', 'to us', 'nous', 'sur nous', 'uns', 'nosotros', 'нас', 'нам'],
  'لهم': ['them', 'for them', 'theirs', 'eux', 'leur', 'ihnen', 'ellos', 'les', 'них'],
  'لهن': ['them', 'for them', 'theirs', 'elles', 'leur', 'ihnen', 'ellas', 'les', 'них'],
  'لكم': ['you', 'for you', 'vous', 'euch', 'ustedes', 'вам'],
  'لنا': ['us', 'for us', 'nous', 'uns', 'nosotros', 'нам'],
  'منهم': ['them', 'from them', 'of them', 'eux', 'elles', 'ihnen', 'ellos', 'них'],
  'منهن': ['them', 'from them', 'of them', 'elles', 'ihnen', 'ellas', 'них'],
  'منكم': ['you', 'from you', 'vous', 'euch', 'ustedes', 'вас'],
  'منا': ['us', 'from us', 'nous', 'uns', 'nosotros', 'нас'],
  'اليهم': ['them', 'to them', 'eux', 'à eux', 'ihnen', 'zu ihnen', 'ellos', 'ним'],
  'اليهن': ['them', 'to them', 'elles', 'à elles', 'ihnen', 'zu ihnen', 'ellas', 'ним'],
  'اليكم': ['you', 'to you', 'vous', 'à vous', 'euch', 'zu euch', 'ustedes', 'вам'],
  'الينا': ['us', 'to us', 'nous', 'à nous', 'uns', 'zu uns', 'nosotros', 'нам'],
  // Common Quranic conjunctions & relative particles
  'وما': ['and', 'what', 'whatever', 'that', 'et', 'ce', 'que', 'und', 'was', 'y', 'lo', 'и', 'то'],
  'ما': ['what', 'whatever', 'that', 'ce', 'que', 'was', 'lo', 'что'],
  'وان': ['and', 'if', 'et', 'si', 'und', 'wenn', 'y', 'si', 'и', 'если'],
  'واذا': ['and', 'when', 'et', 'quand', 'lorsque', 'und', 'wenn', 'y', 'cuando', 'и', 'когда'],
  'واذ': ['and', 'when', 'et', 'quand', 'lorsque', 'y', 'cuando'],
  'والذين': ['and', 'those', 'who', 'et', 'ceux', 'qui', 'und', 'jene', 'y', 'los', 'que', 'и', 'те'],
  'وهو': ['he', 'while he', 'and he', 'while being', 'il', 'et il', 'lui', 'alors qu\'il', 'tout en étant', 'er', 'und er', 'während er', 'él', 'y él', 'mientras él', 'он', 'и он', 'o', 've o', 'dia'],
  'وهي': ['she', 'while she', 'and she', 'elle', 'et elle', 'sie', 'und sie', 'ella', 'y ella', 'она', 'и она', 'o', 've o'],
  'وهم': ['they', 'while they', 'and they', 'ils', 'et ils', 'eux', 'sie', 'und sie', 'ellos', 'y ellos', 'они', 'и они', 'onlar', 've onlar'],
  'وقل': ['and', 'say', 'et', 'dis', 'und', 'sag', 'y', 'di', 'и', 'скажи'],
  'فقال': ['so', 'said', 'alors', 'dit', 'da', 'sagte', 'entonces', 'dijo'],
  'تلو': ['recite', 'recited', 'read', 'récite', 'verlesen', 'recita'],
  'يتل': ['recite', 'recited', 'récite', 'verlesen', 'recita'],
  'كتاب': ['book', 'scripture', 'livre', 'buch', 'libro', 'книг'],
};

// Trailing prepositions and conjunctions that should NOT remain at the end of a part,
// but should naturally introduce the start of the next part.
const TRAILING_CONNECTORS = new Set([
  // French
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'de', 'du', 'des', 'd\'', 'l\'', 'à', 'au', 'aux',
  'dans', 'en', 'pour', 'par', 'sur', 'sous', 'vers', 'avec', 'sans', 'chez', 'entre', 'que', 'qui',
  'dont', 'où', 'quand', 'lorsque', 'comme', 'si', 'puis', 'afin', 'tandis', 'alors',
  // English
  'and', 'or', 'but', 'nor', 'so', 'for', 'yet', 'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with',
  'on', 'at', 'by', 'from', 'into', 'upon', 'unto', 'that', 'which', 'who', 'whom', 'whose', 'where',
  'when', 'while', 'as', 'if', 'then', 'than',
  // Spanish
  'y', 'e', 'o', 'u', 'pero', 'mas', 'sino', 'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con',
  'sin', 'sobre', 'que', 'cual', 'quien', 'donde', 'cuando', 'como', 'si', 'entonces',
  // German
  'und', 'oder', 'aber', 'denn', 'sondern', 'der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine',
  'eines', 'einem', 'einen', 'von', 'vom', 'zu', 'zum', 'zur', 'in', 'im', 'für', 'mit', 'an', 'am',
  'auf', 'aus', 'über', 'unter', 'vor', 'nach', 'dass', 'daß', 'wer', 'was', 'wo', 'wenn', 'als', 'wie',
  // Russian
  'и', 'а', 'но', 'да', 'или', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'из', 'изо', 'от', 'ото',
  'до', 'по', 'о', 'об', 'обо', 'у', 'за', 'под', 'над', 'при', 'для', 'без', 'что', 'кто', 'где',
  'когда', 'как', 'если', 'то', 'чем',
  // Turkish
  've', 'ile', 'veya', 'yahut', 'ama', 'fakat', 'ancak', 'lakin', 'için', 'göre', 'kadar', 'diye',
  'çünkü', 'ki', 'bu', 'şu', 'o', 'bir',
]);

const PUNCTUATION_END_RE = /[,;:\.\?!«»\(\)—–\-]$/;
const PUNCTUATION_STRIP_START_RE = /^[\s,;:«»\(\)—–\-]+/;
const PUNCTUATION_STRIP_END_RE = /[\s,;:«»\(\)—–\-]+$/;

/**
 * Checks if a token contains at least one real Arabic letter (excludes waqf signs, punctuation, numbers).
 */
export function isArabicLetterWord(w) {
  if (!w || typeof w !== 'string') return false;
  // Arabic alphabetic letters range (excluding waqf signs \u06D6-\u06ED, digits, etc.)
  return /[\u0621-\u064A\u0671-\u06D3\u06D5]/.test(w);
}

/**
 * Normalizes an Arabic word by removing diacritics / harakat and unifying alef variants.
 * Strips any non-letter marks.
 */
export function cleanArabicWord(w) {
  if (!w) return '';
  return w
    .replace(/\u0670/g, 'ا')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0870-\u08FF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[^\u0621-\u064A]/g, '')
    .trim();
}

/**
 * Cleans a translation token by stripping outer punctuation and symbols.
 */
export function cleanTransToken(w) {
  if (!w) return '';
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\.;:\?!«»\(\)—–\-"'“”\[\]{}–]/g, '')
    .trim();
}

/**
 * Finds the last real Arabic word of current part and first real Arabic word of next part.
 * Excludes standalone waqf symbols (ۖ, ۗ, ۘ, ۙ, ۚ, ۜ, etc.) and punctuation.
 */
export function getPartArabicBoundaryWords({
  currentPart,
  nextPart = null,
  arabicWords = [],
  wbwWords = null
}) {
  let firstArWord = '';
  let firstArabicIdx = -1;
  let firstWbw = '';
  let lastArWord = '';
  let lastArabicIdx = -1;
  let lastWbw = '';
  let penultimateArWord = '';
  let penultimateArabicIdx = -1;
  let penultimateWbw = '';
  const skippedSymbols = [];

  const curIndices = (currentPart?.wordIndices && currentPart.wordIndices.length > 0)
    ? [...currentPart.wordIndices].sort((a, b) => a - b)
    : [];

  if (curIndices.length > 0 && arabicWords && arabicWords.length > 0) {
    // First Arabic letter word
    for (let k = 0; k < curIndices.length; k++) {
      const idx = curIndices[k];
      const w = arabicWords?.[idx] || '';
      if (isArabicLetterWord(w)) {
        firstArWord = w;
        firstArabicIdx = idx;
        firstWbw = wbwWords?.[idx] || '';
        break;
      }
    }
    if (firstArabicIdx === -1) {
      firstArabicIdx = curIndices[0];
      firstArWord = arabicWords?.[firstArabicIdx] || '';
      firstWbw = wbwWords?.[firstArabicIdx] || '';
    }

    // Last Arabic letter word (skipping waqf symbols like ۖ, ۗ) and penultimate word
    let foundLast = false;
    for (let k = curIndices.length - 1; k >= 0; k--) {
      const idx = curIndices[k];
      const w = arabicWords?.[idx] || '';
      if (isArabicLetterWord(w)) {
        if (!foundLast) {
          lastArWord = w;
          lastArabicIdx = idx;
          lastWbw = wbwWords?.[idx] || '';
          foundLast = true;
        } else {
          penultimateArWord = w;
          penultimateArabicIdx = idx;
          penultimateWbw = wbwWords?.[idx] || '';
          break;
        }
      } else if (w && !foundLast) {
        skippedSymbols.push(`${w} (#${idx})`);
      }
    }
    if (lastArabicIdx === -1) {
      lastArabicIdx = curIndices[curIndices.length - 1];
      lastArWord = arabicWords?.[lastArabicIdx] || '';
      lastWbw = wbwWords?.[lastArabicIdx] || '';
    }
  }

  // Fallback to currentPart.text if firstArWord or lastArWord still empty
  if ((!firstArWord || !lastArWord) && currentPart?.text) {
    const rawWords = currentPart.text.split(/\s+/).filter(Boolean);
    if (!firstArWord) {
      for (let k = 0; k < rawWords.length; k++) {
        if (isArabicLetterWord(rawWords[k])) {
          firstArWord = rawWords[k];
          if (firstArabicIdx === -1 && curIndices.length > 0) {
            firstArabicIdx = curIndices[Math.min(k, curIndices.length - 1)];
          }
          break;
        }
      }
      if (!firstArWord && rawWords.length > 0) firstArWord = rawWords[0];
    }
    if (!lastArWord) {
      let foundFallbackLast = false;
      for (let k = rawWords.length - 1; k >= 0; k--) {
        if (isArabicLetterWord(rawWords[k])) {
          if (!foundFallbackLast) {
            lastArWord = rawWords[k];
            if (lastArabicIdx === -1 && curIndices.length > 0) {
              lastArabicIdx = curIndices[Math.min(k, curIndices.length - 1)];
            }
            foundFallbackLast = true;
          } else if (!penultimateArWord) {
            penultimateArWord = rawWords[k];
            break;
          }
        } else if (rawWords[k] && !foundFallbackLast) {
          skippedSymbols.push(rawWords[k]);
        }
      }
      if (!lastArWord && rawWords.length > 0) {
        lastArWord = rawWords[rawWords.length - 1];
      }
    }
  }

  let nextArWord = '';
  let nextArabicIdx = -1;
  let nextWbw = '';
  let secondNextArWord = '';
  let secondNextArabicIdx = -1;
  let secondNextWbw = '';

  if (nextPart) {
    const nextIndices = (nextPart.wordIndices && nextPart.wordIndices.length > 0)
      ? [...nextPart.wordIndices].sort((a, b) => a - b)
      : [];

    if (nextIndices.length > 0 && arabicWords && arabicWords.length > 0) {
      let foundNextFirst = false;
      for (let k = 0; k < nextIndices.length; k++) {
        const idx = nextIndices[k];
        const w = arabicWords?.[idx] || '';
        if (isArabicLetterWord(w)) {
          if (!foundNextFirst) {
            nextArWord = w;
            nextArabicIdx = idx;
            nextWbw = wbwWords?.[idx] || '';
            foundNextFirst = true;
          } else {
            secondNextArWord = w;
            secondNextArabicIdx = idx;
            secondNextWbw = wbwWords?.[idx] || '';
            break;
          }
        }
      }
      if (nextArabicIdx === -1) {
        nextArabicIdx = nextIndices[0];
        nextArWord = arabicWords?.[nextArabicIdx] || '';
        nextWbw = wbwWords?.[nextArabicIdx] || '';
      }
    }

    // Fallback to nextPart.text if nextArWord still empty
    if (!nextArWord && nextPart.text) {
      const rawWords = nextPart.text.split(/\s+/).filter(Boolean);
      let foundNextFallback = false;
      for (let k = 0; k < rawWords.length; k++) {
        if (isArabicLetterWord(rawWords[k])) {
          if (!foundNextFallback) {
            nextArWord = rawWords[k];
            if (nextArabicIdx === -1 && nextIndices.length > 0) {
              nextArabicIdx = nextIndices[Math.min(k, nextIndices.length - 1)];
            }
            foundNextFallback = true;
          } else if (!secondNextArWord) {
            secondNextArWord = rawWords[k];
            break;
          }
        }
      }
      if (!nextArWord && rawWords.length > 0) {
        nextArWord = rawWords[0];
      }
    }
  }

  return {
    firstArWord,
    firstArabicIdx,
    firstWbw,
    lastArWord,
    lastArabicIdx,
    lastWbw,
    penultimateArWord,
    penultimateArabicIdx,
    penultimateWbw,
    skippedSymbols,
    nextArWord,
    nextArabicIdx,
    nextWbw,
    secondNextArWord,
    secondNextArabicIdx,
    secondNextWbw,
  };
}

/**
 * Searches for keyword clues of a specific Arabic word or WBW meaning in translation tokens.
 * Supports boundary orientation:
 * - isBoundaryEnd: prioritizes terminal words (e.g. attached pronoun suffixes "them", "you", "her")
 * - isBoundaryStart: prioritizes leading words (e.g. conjunctions "and", "et", "und", "y")
 */
export function findKeywordInTranslation(
  arabicWord,
  wbwWord,
  transTokens,
  windowStart,
  windowEnd,
  { isBoundaryEnd = false, isBoundaryStart = false } = {}
) {
  if (!transTokens || transTokens.length === 0) return -1;
  if (!arabicWord && !wbwWord) return -1;

  const cleanAr = cleanArabicWord(arabicWord);
  const keywordsToMatch = [];

  // 1. Conjunction prefixes (و = and, ف = so/then)
  // Conjunctions introduce clauses, so do not match them when looking for the boundary end of a part
  if (cleanAr && cleanAr.length >= 2 && !isBoundaryEnd) {
    if (cleanAr.startsWith('و')) {
      const conjTokens = ['and', 'et', 'und', 'y', 'e', 'и', 've'];
      if (isBoundaryStart) {
        keywordsToMatch.unshift(...conjTokens);
      } else {
        keywordsToMatch.push(...conjTokens);
      }
    } else if (cleanAr.startsWith('ف') && !cleanAr.startsWith('في')) {
      const conjTokens = ['so', 'then', 'alors', 'donc', 'dann', 'así'];
      if (isBoundaryStart) {
        keywordsToMatch.unshift(...conjTokens);
      } else {
        keywordsToMatch.push(...conjTokens);
      }
    }

    // 2. Attached personal pronouns (هن, هم, كم, نا, ها, ه)
    if (cleanAr.endsWith('هن')) {
      const pron = ['them', 'her', 'their', 'elles', 'leur', 'sie', 'ihnen', 'ellas', 'них', 'nim'];
      if (isBoundaryEnd) keywordsToMatch.unshift(...pron);
      else keywordsToMatch.push(...pron);
    } else if (cleanAr.endsWith('هم')) {
      const pron = ['them', 'their', 'eux', 'leur', 'sie', 'ihnen', 'ellos', 'них'];
      if (isBoundaryEnd) keywordsToMatch.unshift(...pron);
      else keywordsToMatch.push(...pron);
    } else if (cleanAr.endsWith('كم')) {
      const pron = ['you', 'your', 'vous', 'euch', 'ustedes', 'вам', 'вас'];
      if (isBoundaryEnd) keywordsToMatch.unshift(...pron);
      else keywordsToMatch.push(...pron);
    } else if (cleanAr.endsWith('نا')) {
      const pron = ['us', 'our', 'nous', 'uns', 'nosotros', 'нас', 'нам'];
      if (isBoundaryEnd) keywordsToMatch.unshift(...pron);
      else keywordsToMatch.push(...pron);
    } else if (cleanAr.endsWith('ها')) {
      const pron = ['it', 'her', 'elle', 'sie', 'ella', 'ее'];
      if (isBoundaryEnd) keywordsToMatch.unshift(...pron);
      else keywordsToMatch.push(...pron);
    } else if (cleanAr.endsWith('ه')) {
      const pron = ['him', 'it', 'his', 'lui', 'ihn', 'él', 'его'];
      if (isBoundaryEnd) keywordsToMatch.unshift(...pron);
      else keywordsToMatch.push(...pron);
    }

    // 3. Generate Arabic prefix variants (e.g. "النساء" -> "النساء", "نساء", "قُلِ" -> "قل", "قول")
    const arVariants = [cleanAr];
    if (cleanAr.endsWith('ي') || cleanAr.endsWith('ا') || cleanAr.endsWith('ه')) {
      arVariants.push(cleanAr.slice(0, -1));
    }
    if (cleanAr.startsWith('ال') && cleanAr.length >= 4) {
      const withoutAl = cleanAr.slice(2);
      arVariants.push(withoutAl);
      if (withoutAl.endsWith('ي') || withoutAl.endsWith('ا') || withoutAl.endsWith('ه')) {
        arVariants.push(withoutAl.slice(0, -1));
      }
    }
    if ((cleanAr.startsWith('و') || cleanAr.startsWith('ف') || cleanAr.startsWith('ب') || cleanAr.startsWith('ل')) && cleanAr.length >= 3) {
      const stripped = cleanAr.slice(1);
      arVariants.push(stripped);
      if (stripped.endsWith('ي') || stripped.endsWith('ا') || stripped.endsWith('ه')) {
        arVariants.push(stripped.slice(0, -1));
      }
      if (stripped.startsWith('ال') && stripped.length >= 4) {
        const strippedNoAl = stripped.slice(2);
        arVariants.push(strippedNoAl);
        if (strippedNoAl.endsWith('ي') || strippedNoAl.endsWith('ا') || strippedNoAl.endsWith('ه')) {
          arVariants.push(strippedNoAl.slice(0, -1));
        }
      }
    }

    // Check direct Arabic root / term keyword mapping
    for (const [arKey, terms] of Object.entries(QURAN_KEYWORDS)) {
      for (const variant of arVariants) {
        if (variant === arKey || variant.includes(arKey) || (variant.length >= 3 && arKey.includes(variant))) {
          if (isBoundaryStart && arKey === 'قل') {
            keywordsToMatch.unshift(...terms);
          } else {
            keywordsToMatch.push(...terms);
          }
          break;
        }
      }
    }
  }

  // 4. Check WBW English meaning
  if (wbwWord && typeof wbwWord === 'string') {
    const wbwTokens = wbwWord.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const STOP_WORDS = new Set(['the', 'for', 'with', 'from', 'into', 'unto', 'upon']);
    for (const tok of wbwTokens) {
      if (tok.length >= 2) {
        if (!STOP_WORDS.has(tok)) {
          keywordsToMatch.push(tok);
        }
      }
    }
  }

  if (keywordsToMatch.length === 0) return -1;

  let bestIdx = -1;
  let bestScore = -Infinity;
  const center = (windowStart + windowEnd) / 2;

  for (let j = Math.max(0, windowStart); j <= Math.min(transTokens.length - 1, windowEnd); j++) {
    const rawWord = transTokens[j];
    const cleanTrans = cleanTransToken(rawWord);
    if (!cleanTrans) continue;

    for (let ki = 0; ki < keywordsToMatch.length; ki++) {
      const kw = keywordsToMatch[ki];
      if (!kw || kw.length < 2) continue;

      let matchType = 0; // 0=none, 1=partial, 2=prefix/stem, 3=exact
      if (cleanTrans === kw) {
        matchType = 3;
      } else if (cleanTrans.startsWith(kw) || kw.startsWith(cleanTrans)) {
        matchType = 2;
      } else if (cleanTrans.includes(kw) && kw.length >= 4) {
        matchType = 1;
      }

      if (matchType > 0) {
        const hasPunctuation = PUNCTUATION_END_RE.test(rawWord);
        // Base score: match strength + punctuation bonus
        let score = (matchType * 12) + (hasPunctuation ? 5 : 0) - Math.abs(j - center) * 0.25 - (ki * 0.1);
        // Positional bias for phrase boundary:
        // isBoundaryEnd prefers later token in phrase (e.g. "them" after "about")
        if (isBoundaryEnd) {
          score += (j * 0.15);
        }
        // isBoundaryStart prefers earlier token in phrase (e.g. "and" before "what")
        if (isBoundaryStart) {
          score -= (j * 0.15);
        }

        if (score > bestScore) {
          bestScore = score;
          bestIdx = j;
        }
      }
    }
  }

  return bestIdx;
}

/**
 * Shared core engine for translation segmentation across parts.
 * Solves the boundary cut point so that:
 * - Special non-letter characters (like waqf signs ۖ, ۗ) are filtered out.
 * - Both the last Arabic word of the current part and first Arabic word of the next part are checked.
 * - The next part starts with its first word ("Say", etc.), and current part ends with its word ("women.").
 * - Chaining ensures seamless coverage without overlapping or gaps.
 */
export function computePartsSegmentation({
  parts = [],
  totalWords = 0,
  ayatTranslation = "",
  translationLang = "fr",
  wbwWords = null,
  arabicWords = []
}) {
  const cleanFull = (ayatTranslation || "").trim();
  const transTokens = cleanFull ? cleanFull.split(/\s+/).filter(Boolean) : [];
  const numTrans = transTokens.length;

  if (!parts || parts.length === 0) {
    return {
      transTokens,
      numTrans,
      numArabic: 0,
      cutIndices: [],
      partRanges: [],
      step1Data: [],
      step2Data: [],
      segments: {},
    };
  }

  // Sort parts by minimum Arabic word index
  const sortedParts = [...parts].map((p, origIdx) => {
    const minIdx = p.wordIndices?.length ? Math.min(...p.wordIndices) : origIdx;
    const maxIdx = p.wordIndices?.length ? Math.max(...p.wordIndices) : minIdx;
    return { ...p, minIdx, maxIdx, origIdx };
  }).sort((a, b) => a.minIdx - b.minIdx);

  const numArabic = totalWords > 0 ? totalWords : (arabicWords?.length || Math.max(...sortedParts.map(p => p.maxIdx), 0) + 1);

  const hasRemainingWordsAfterPart = (maxIdx) => {
    if (arabicWords && arabicWords.length > 0) {
      return arabicWords.slice(maxIdx + 1).some(w => isArabicLetterWord(w));
    }
    return totalWords > 0 && maxIdx < totalWords - 1;
  };

  // Single part: gets full translation ONLY if it covers the entire ayah
  if ((sortedParts.length === 1 && !hasRemainingWordsAfterPart(sortedParts[0].maxIdx)) || numTrans === 0) {
    const singleSegment = cleanFull;
    const singleRange = { start: 0, end: Math.max(0, numTrans - 1) };
    const segments = { [sortedParts[0].id]: singleSegment };
    const step1Data = [{
      partId: sortedParts[0].id,
      origIdx: sortedParts[0].origIdx,
      arabicRange: [sortedParts[0].minIdx, sortedParts[0].maxIdx],
      lastArabicWord: arabicWords?.[sortedParts[0].maxIdx] || "",
      lastArabicIdx: sortedParts[0].maxIdx,
      skippedSymbols: [],
      nextArabicWord: "",
      nextArabicIdx: -1,
      matchedMethod: "Verset complet (partie unique)",
      expectedTransIdx: numTrans - 1,
      cutIndex: Math.max(0, numTrans - 1),
      cutWord: transTokens[numTrans - 1] || "",
      nextPartStartWord: "",
    }];
    const step2Data = [{
      partId: sortedParts[0].id,
      origIdx: sortedParts[0].origIdx,
      startTokenIdx: 0,
      endTokenIdx: Math.max(0, numTrans - 1),
      tokenCount: numTrans,
      tokens: transTokens,
      nextPartStartsAt: numTrans,
      connectorShifted: false,
      shiftedWord: "",
      finalSegment: singleSegment,
      rawPartText: sortedParts[0].text || "",
    }];
    return {
      transTokens,
      numTrans,
      numArabic,
      cutIndices: [Math.max(0, numTrans - 1)],
      partRanges: [singleRange],
      step1Data,
      step2Data,
      segments,
    };
  }

  // Step 1: Boundary detection using dual Arabic words (last of current part & first of next part)
  const cutIndices = [];
  const step1Data = [];

  for (let i = 0; i < sortedParts.length; i++) {
    const part = sortedParts[i];
    const hasRemainingWords = hasRemainingWordsAfterPart(part.maxIdx);

    // The final part only ends at the last translation token if it genuinely reaches the end of the ayah
    if (i === sortedParts.length - 1 && !hasRemainingWords) {
      const { firstArWord, firstArabicIdx } = getPartArabicBoundaryWords({
        currentPart: part,
        nextPart: null,
        arabicWords,
        wbwWords,
      });
      cutIndices[i] = numTrans - 1;
      step1Data.push({
        partId: part.id,
        origIdx: part.origIdx,
        arabicRange: [part.minIdx, part.maxIdx],
        firstArabicWord: firstArWord || arabicWords?.[part.minIdx] || "",
        firstArabicIdx: firstArabicIdx >= 0 ? firstArabicIdx : part.minIdx,
        lastArabicWord: arabicWords?.[part.maxIdx] || "",
        lastArabicIdx: part.maxIdx,
        skippedSymbols: [],
        nextArabicWord: "",
        nextArabicIdx: -1,
        matchedMethod: "Fin du verset (dernière partie)",
        expectedTransIdx: numTrans - 1,
        cutIndex: numTrans - 1,
        cutWord: transTokens[numTrans - 1] || "",
        nextPartStartWord: "",
      });
      continue;
    }

    const nextPart = (i < sortedParts.length - 1)
      ? sortedParts[i + 1]
      : {
          id: '__unassigned_remainder__',
          minIdx: part.maxIdx + 1,
          maxIdx: (arabicWords?.length || totalWords) - 1,
          wordIndices: Array.from(
            { length: Math.max(0, (arabicWords?.length || totalWords) - 1 - part.maxIdx) },
            (_, k) => part.maxIdx + 1 + k
          ),
          text: (arabicWords || []).slice(part.maxIdx + 1).join(" ")
        };

    // Find the real Arabic letter words (ignoring non-letter signs like ۖ, ۗ, etc.)
    const {
      firstArWord,
      firstArabicIdx,
      firstWbw,
      lastArWord,
      lastArabicIdx,
      lastWbw,
      penultimateArWord,
      penultimateArabicIdx,
      penultimateWbw,
      skippedSymbols,
      nextArWord,
      nextArabicIdx,
      nextWbw,
      secondNextArWord,
      secondNextArabicIdx,
      secondNextWbw,
    } = getPartArabicBoundaryWords({
      currentPart: part,
      nextPart,
      arabicWords,
      wbwWords,
    });

    const effectiveLastIdx = lastArabicIdx >= 0 ? lastArabicIdx : part.maxIdx;
    const effectiveNextIdx = nextArabicIdx >= 0 ? nextArabicIdx : (effectiveLastIdx + 1);

    // Ensure strictly valid non-decreasing boundary allowing at least 1 token per remaining part
    const prevCut = i > 0 ? cutIndices[i - 1] : -1;
    const minCut = prevCut + 1;
    const maxCut = numTrans - (sortedParts.length - i);

    // Expected proportional position
    const ratioLast = Math.min(1, (effectiveLastIdx + 1) / numArabic);
    const expectedLastTransIdx = Math.max(minCut, Math.min(maxCut - 1, Math.round(ratioLast * numTrans) - 1));

    const ratioNext = Math.min(1, effectiveNextIdx / numArabic);
    const expectedNextTransIdx = Math.max(minCut + 1, Math.min(maxCut, Math.round(ratioNext * numTrans)));

    // Search window: MUST NOT look back into tokens already assigned to previous parts
    const windowSpan = Math.max(5, Math.round(numTrans / (sortedParts.length * 1.2)));
    const winStartLast = Math.max(minCut, expectedLastTransIdx - windowSpan);
    const winEndLast = Math.min(numTrans - 1, expectedLastTransIdx + windowSpan);

    const winStartNext = Math.max(minCut, expectedNextTransIdx - windowSpan);
    const winEndNext = Math.min(numTrans - 1, expectedNextTransIdx + windowSpan);

    // Search translation tokens for both words with boundary-aware orientation
    let idxLast = findKeywordInTranslation(lastArWord, lastWbw, transTokens, winStartLast, winEndLast, { isBoundaryEnd: true });
    if (idxLast === -1 && penultimateArWord) {
      // If last word didn't match (e.g. compound phrase like "يتامى النساء" where French/English translates the whole idafa into "orphelines" / "orphan girls")
      const pIdx = findKeywordInTranslation(penultimateArWord, penultimateWbw, transTokens, winStartLast, winEndLast, { isBoundaryEnd: true });
      if (pIdx !== -1) {
        idxLast = pIdx;
      }
    }

    let idxNext = findKeywordInTranslation(nextArWord, nextWbw, transTokens, winStartNext, winEndNext, { isBoundaryStart: true });
    if (idxNext === -1 && secondNextArWord) {
      const sIdx = findKeywordInTranslation(secondNextArWord, secondNextWbw, transTokens, winStartNext, winEndNext, { isBoundaryStart: true });
      if (sIdx !== -1) {
        idxNext = sIdx;
      }
    }

    // If next Arabic word starts with conjunction و, check if an "and" conjunction exists near expectedNextTransIdx
    const cleanNext = cleanArabicWord(nextArWord);
    if (cleanNext.startsWith('و') && cleanNext.length >= 2) {
      const AND_CONJUNCTIONS = new Set(['and', 'et', 'und', 'y', 'e', 'и', 've']);
      if (idxNext > minCut && AND_CONJUNCTIONS.has(cleanTransToken(transTokens[idxNext - 1]))) {
        idxNext = idxNext - 1;
      } else {
        const searchS = Math.max(minCut, idxLast !== -1 ? (idxLast + 1) : Math.min(winStartLast, winStartNext));
        const searchE = Math.min(numTrans - 1, Math.max(winEndLast, winEndNext));
        let bestAndIdx = -1;
        let bestAndDist = Infinity;
        for (let j = searchS; j <= searchE; j++) {
          const cln = cleanTransToken(transTokens[j]);
          if (AND_CONJUNCTIONS.has(cln)) {
            const dist = Math.abs(j - expectedNextTransIdx);
            if (dist < bestAndDist) {
              bestAndDist = dist;
              bestAndIdx = j;
            }
          }
        }
        if (bestAndIdx !== -1 && (idxNext === -1 || bestAndIdx <= idxNext || idxNext <= idxLast)) {
          idxNext = bestAndIdx;
        }
      }
    }

    let matchedIdx = -1;
    let matchMethod = "";

    if (idxLast !== -1 && idxNext !== -1) {
      if (idxLast < idxNext) {
        // Both found in logical order (e.g. last: "them" #7, next: "and" #8)
        if (PUNCTUATION_END_RE.test(transTokens[idxLast])) {
          // If current part's terminal token has punctuation (comma, period),
          // the clause cleanly concludes here, and following connective words introduce the next part
          matchedIdx = idxLast;
        } else {
          let cutCandidate = idxNext - 1;
          while (cutCandidate > idxLast && /^["'«“\(\[\s\.]+$/.test(transTokens[cutCandidate])) {
            cutCandidate--;
          }
          if (cutCandidate >= idxLast) {
            matchedIdx = cutCandidate;
          } else {
            matchedIdx = idxLast;
          }
        }
        matchMethod = `Double concordance arabe : fin "${transTokens[idxLast]}" (#${idxLast}) & début suivant "${transTokens[idxNext]}" (#${idxNext})`;
      } else {
        // Overlap or same token: fallback safely to last word match
        const hasLastPunct = PUNCTUATION_END_RE.test(transTokens[idxLast]);
        matchedIdx = idxLast;
        matchMethod = hasLastPunct
          ? `Dernier mot arabe avec ponctuation ("${transTokens[idxLast]}")`
          : `Dernier mot partie courante ("${transTokens[idxLast]}" #${idxLast})`;
      }
    } else if (idxNext !== -1) {
      // ONLY the next part's first word was matched! (e.g. "Say" at token 12)
      let proposedCut = idxNext - 1;
      while (proposedCut > minCut && /^["'«“\(\[\s\.]+$/.test(transTokens[proposedCut])) {
        proposedCut -= 1;
      }
      matchedIdx = Math.max(minCut, proposedCut);
      matchMethod = `Premier mot partie suivante ("${transTokens[idxNext]}" #${idxNext}) -> coupure avant`;
    } else if (idxLast !== -1) {
      // ONLY the current part's last word was matched! (e.g. "them" at token 7)
      matchedIdx = idxLast;
      matchMethod = `Dernier mot partie courante ("${transTokens[idxLast]}" #${idxLast})`;
    } else {
      // Neither matched: clause punctuation snap or proportional fallback
      let bestPunctIdx = -1;
      let bestDist = Infinity;
      const searchWinStart = Math.min(winStartLast, winStartNext);
      const searchWinEnd = Math.max(winEndLast, winEndNext);

      for (let j = searchWinStart; j <= searchWinEnd; j++) {
        const token = transTokens[j];
        if (PUNCTUATION_END_RE.test(token)) {
          const dist = Math.abs(j - expectedLastTransIdx);
          if (dist < bestDist) {
            bestDist = dist;
            bestPunctIdx = j;
          }
        }
      }

      if (bestPunctIdx !== -1) {
        matchedIdx = bestPunctIdx;
        matchMethod = `Ponctuation naturelle ("${transTokens[bestPunctIdx]}")`;
      } else {
        matchedIdx = expectedLastTransIdx;
        matchMethod = `Proportionnel (${Math.round(ratioLast * 100)}%)`;
      }
    }

    let cut = Math.max(minCut, Math.min(maxCut, matchedIdx));
    cutIndices[i] = cut;

    step1Data.push({
      partId: part.id,
      origIdx: part.origIdx,
      arabicRange: [part.minIdx, part.maxIdx],
      firstArabicWord: firstArWord || arabicWords?.[part.minIdx] || "",
      firstArabicIdx: firstArabicIdx >= 0 ? firstArabicIdx : part.minIdx,
      lastArabicWord: lastArWord,
      lastArabicIdx,
      skippedSymbols,
      nextArabicWord: nextArWord,
      nextArabicIdx,
      matchedMethod: matchMethod,
      expectedTransIdx: expectedLastTransIdx,
      window: [winStartLast, winEndLast],
      cutIndex: cut,
      cutWord: transTokens[cut] || "",
      nextPartStartWord: transTokens[cut + 1] || "",
    });
  }

  // Step 2: Fixing start/end words and chaining
  const partRanges = [];
  const step2Data = [];
  const segments = {};
  let currentStart = 0;

  for (let i = 0; i < sortedParts.length; i++) {
    const part = sortedParts[i];
    let cutEnd = cutIndices[i];
    let connectorShifted = false;
    let shiftedWord = "";

    const isActuallyLastInAyah = (i === sortedParts.length - 1) && !hasRemainingWordsAfterPart(part.maxIdx);

    // Trailing connector shifting (so next part does not miss its starting connector)
    if (!isActuallyLastInAyah) {
      const endToken = transTokens[cutEnd]?.toLowerCase().replace(/[,\.;:\?!«»\(\)—–\-']/g, '').trim();
      if (endToken && TRAILING_CONNECTORS.has(endToken) && cutEnd > currentStart) {
        connectorShifted = true;
        shiftedWord = transTokens[cutEnd];
        cutEnd = cutEnd - 1;
        cutIndices[i] = cutEnd;
      }
    }

    const range = { start: currentStart, end: cutEnd };
    partRanges.push(range);

    const rawSlice = transTokens.slice(range.start, Math.max(range.start + 1, range.end + 1));
    let cleaned = rawSlice.join(" ").trim().replace(PUNCTUATION_STRIP_START_RE, "").trim();
    if (!isActuallyLastInAyah) {
      cleaned = cleaned.replace(/[,;:\s]+$/, "").trim();
    }

    step2Data.push({
      partId: part.id,
      origIdx: part.origIdx,
      startTokenIdx: range.start,
      endTokenIdx: range.end,
      tokenCount: Math.max(0, range.end - range.start + 1),
      tokens: rawSlice,
      nextPartStartsAt: cutEnd + 1,
      connectorShifted,
      shiftedWord,
      finalSegment: cleaned,
      rawPartText: part.text || "",
    });

    segments[part.id] = cleaned || cleanFull;
    currentStart = cutEnd + 1;
  }

  return {
    transTokens,
    numTrans,
    numArabic,
    cutIndices,
    partRanges,
    step1Data,
    step2Data,
    segments,
  };
}

/**
 * Segments the entire verse translation text across all parts using the sequential boundary algorithm:
 * 1. Filters non-letter symbols (e.g. ۖ, ۗ) from Arabic word detection.
 * 2. Compares last Arabic word of current part & first Arabic word of next part to cut cleanly.
 * 3. Chaining: next part starts at the immediate next token.
 * 4. Trailing connector & orphan punctuation adjustment.
 *
 * @param {Object} params
 * @param {Array} params.parts - Array of part objects for the verse
 * @param {number} params.totalWords - Total Arabic words count in the verse
 * @param {string} params.ayatTranslation - Full translation of the verse
 * @param {string} [params.translationLang] - Selected language
 * @param {string[]} [params.wbwWords] - Array of WBW translations
 * @param {string[]} [params.arabicWords] - Array of Arabic words
 * @returns {Object} Map of { [partId]: "translated segment" }
 */
export function segmentAllPartsTranslations({
  parts = [],
  totalWords = 0,
  ayatTranslation = "",
  translationLang = "fr",
  wbwWords = null,
  arabicWords = []
}) {
  const { segments } = computePartsSegmentation({
    parts,
    totalWords,
    ayatTranslation,
    translationLang,
    wbwWords,
    arabicWords,
  });
  return segments || {};
}

/**
 * Intelligently segments an ayah full translation string for a single part.
 *
 * @param {string} ayatTranslation - Full verse translation text
 * @param {number[]} wordIndices - Indices of the Arabic words in the current part
 * @param {number} totalWords - Total number of Arabic words in the verse
 * @param {Array} [allParts] - Optional array of all parts for the ayah
 * @param {string[]} [wbwWords] - Array of WBW translations
 * @param {string[]} [arabicWords] - Array of Arabic words
 * @returns {string} The segmented translation for this part
 */
export function segmentAyatTranslation(
  ayatTranslation,
  wordIndices,
  totalWords,
  allParts = null,
  wbwWords = null,
  arabicWords = [],
  translationLang = "fr"
) {
  if (!ayatTranslation || typeof ayatTranslation !== 'string') return "";
  const cleanFull = ayatTranslation.trim();
  if (!cleanFull) return "";

  if (!wordIndices || wordIndices.length === 0 || !totalWords || totalWords <= 0) {
    return cleanFull;
  }

  // If allParts is supplied, execute the multi-part sequential algorithm
  if (allParts && allParts.length > 0) {
    const partObj = allParts.find(p =>
      p.wordIndices === wordIndices ||
      (Array.isArray(p.wordIndices) && Array.isArray(wordIndices) &&
       p.wordIndices.length === wordIndices.length &&
       p.wordIndices.every((val, idx) => val === wordIndices[idx]))
    );
    const partsToUse = partObj ? allParts : [...allParts, { id: '__current_part__', wordIndices }];
    const targetId = partObj ? partObj.id : '__current_part__';
    const segments = segmentAllPartsTranslations({
      parts: partsToUse,
      totalWords,
      ayatTranslation,
      translationLang,
      wbwWords,
      arabicWords,
    });
    if (segments[targetId]) return segments[targetId];
  }

  // Fallback single-part calculation with start/end fixing
  const startIdx = Math.min(...wordIndices);
  const endIdx = Math.max(...wordIndices);

  if (startIdx <= 0 && endIdx >= totalWords - 1) {
    return cleanFull;
  }

  const transWords = cleanFull.split(/\s+/).filter(Boolean);
  if (transWords.length <= 1) return cleanFull;

  const ratioStart = Math.max(0, startIdx / totalWords);
  const ratioEnd = Math.min(1, (endIdx + 1) / totalWords);

  let startW = Math.round(ratioStart * transWords.length);
  let endW = Math.round(ratioEnd * transWords.length);

  // Check last Arabic word keyword match near endW
  const lastAr = arabicWords?.[endIdx] || '';
  const lastWbw = wbwWords?.[endIdx] || '';
  const matchedEnd = findKeywordInTranslation(lastAr, lastWbw, transWords, endW - 2, endW + 2);
  if (matchedEnd !== -1) {
    endW = matchedEnd + 1;
  }

  // If startIdx > 0, align after punctuation
  if (startIdx > 0) {
    for (let offset = 0; offset <= 2; offset++) {
      if (startW - 1 - offset >= 0 && PUNCTUATION_END_RE.test(transWords[startW - 1 - offset])) {
        startW = startW - offset;
        break;
      }
      if (startW - 1 + offset < transWords.length && PUNCTUATION_END_RE.test(transWords[startW - 1 + offset])) {
        startW = startW + offset + 1;
        break;
      }
    }
  } else {
    startW = 0;
  }

  // If endIdx < totalWords - 1, snap to clause punctuation
  if (endIdx < totalWords - 1) {
    for (let offset = 0; offset <= 2; offset++) {
      if (endW - 1 + offset < transWords.length && PUNCTUATION_END_RE.test(transWords[endW - 1 + offset])) {
        endW = endW + offset + 1;
        break;
      }
      if (endW - 1 - offset >= startW && PUNCTUATION_END_RE.test(transWords[endW - 1 - offset])) {
        endW = endW - offset;
        break;
      }
    }
  } else {
    endW = transWords.length;
  }

  startW = Math.max(0, Math.min(startW, transWords.length - 1));
  endW = Math.max(startW + 1, Math.min(endW, transWords.length));

  // Trailing connector fix: do not leave a trailing connector at the end of a non-final part
  if (endIdx < totalWords - 1 && endW > startW + 1) {
    const lastToken = transWords[endW - 1]?.toLowerCase().replace(/[,\.;:\?!«»\(\)—–\-']/g, '').trim();
    if (lastToken && TRAILING_CONNECTORS.has(lastToken)) {
      endW = endW - 1;
    }
  }

  let segment = transWords.slice(startW, endW).join(" ").trim();
  segment = segment.replace(PUNCTUATION_STRIP_START_RE, "");
  if (endIdx < totalWords - 1) {
    segment = segment.replace(/[,;:\s]+$/, "");
  }

  return segment || cleanFull;
}

/**
 * Resolves the appropriate translation for a learning part in the currently active language.
 *
 * @param {Object} params
 * @param {Object} params.part - The part object ({ id, wordIndices, text, translations, translation })
 * @param {Array} [params.allParts] - All parts of the current ayah
 * @param {number} params.totalWords - Total words count in the verse
 * @param {string} [params.ayatTranslation] - Full verse translation in current language
 * @param {string} [params.translationLang] - Active translation language code ('fr', 'de', 'es', 'ru', etc.)
 * @param {string[]} [params.wbwWords] - Array of word-by-word translations
 * @param {string[]} [params.words] - Array of Arabic words
 * @returns {string} Localized translation
 */
export function getPartTranslation({
  part,
  allParts = null,
  totalWords = 0,
  ayatTranslation = "",
  translationLang = null,
  wbwWords = null,
  words = []
}) {
  if (!part) return "";

  // If no translation language is selected, return any manually written text or empty
  if (!translationLang) {
    return (typeof part.translation === 'string' ? part.translation : "");
  }

  // 1. Explicit user manual edit for this language (e.g. edited via pencil modal)
  const customLang = (part.customTranslations && part.customTranslations[translationLang])
    || (part.manualTranslations && part.manualTranslations[translationLang]);
  if (customLang && typeof customLang === 'string' && customLang.trim()) {
    return customLang.trim();
  }

  // 2. Dynamic multi-part or single-part sequential segmentation in the selected language
  if (ayatTranslation) {
    if (allParts && allParts.length > 0) {
      const segments = segmentAllPartsTranslations({
        parts: allParts,
        totalWords: totalWords || words.length,
        ayatTranslation,
        translationLang,
        wbwWords,
        arabicWords: words,
      });
      if (segments[part.id]) return segments[part.id];
    }

    const segmented = segmentAyatTranslation(
      ayatTranslation,
      part.wordIndices,
      totalWords || words.length,
      allParts,
      wbwWords,
      words,
      translationLang
    );
    if (segmented) return segmented;
  }

  // 3. Fallback to stored translation snapshot (if offline or ayatTranslation not yet loaded)
  const storedLang = part.translations && part.translations[translationLang];
  if (storedLang && typeof storedLang === 'string' && storedLang.trim()) {
    return storedLang.trim();
  }

  // 3. Word-by-word fallback (specifically useful if language is English or WBW exists)
  if (translationLang === 'en' && wbwWords && part.wordIndices?.length) {
    const wbwText = part.wordIndices.map(i => wbwWords[i]).filter(Boolean).join(" ").trim();
    if (wbwText) return wbwText;
  }

  // 4. Default fallback to general translation field if it is a string
  return (typeof part.translation === 'string' ? part.translation : "");
}

/**
 * Detailed step-by-step diagnostic function for the Debug UI.
 * Returns comprehensive telemetry for every step of the translation segmentation
 * using the exact same dual Arabic word boundary and chaining engine as the application.
 */
export function debugAnalyzeSegmentation({
  parts = [],
  totalWords = 0,
  ayatTranslation = "",
  translationLang = "fr",
  wbwWords = null,
  arabicWords = []
}) {
  const comp = computePartsSegmentation({
    parts,
    totalWords,
    ayatTranslation,
    translationLang,
    wbwWords,
    arabicWords,
  });

  const { transTokens, numTrans, numArabic, step1Data, step2Data, partRanges = [] } = comp;

  // Coverage validation
  let coveredCount = 0;
  let hasGaps = false;
  let hasOverlaps = false;

  for (let i = 0; i < partRanges.length; i++) {
    const { start, end } = partRanges[i];
    coveredCount += Math.max(0, end - start + 1);
    if (i > 0) {
      const prevEnd = partRanges[i - 1].end;
      if (start > prevEnd + 1) hasGaps = true;
      if (start <= prevEnd) hasOverlaps = true;
    }
  }

  return {
    transTokens,
    numTrans,
    numArabic,
    step1Data,
    step2Data,
    coverageMetrics: {
      totalTokens: numTrans,
      coveredTokens: coveredCount,
      isFullCoverage: coveredCount === numTrans && !hasGaps && !hasOverlaps,
      hasGaps,
      hasOverlaps,
    }
  };
}
