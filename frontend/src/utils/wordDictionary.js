// Curated comprehensive English word list for instant offline validation and AI play
const COMMON_WORDS = [
  // 3-letter words
  'ACE', 'ACT', 'ADD', 'AGE', 'AGO', 'AID', 'AIM', 'AIR', 'ALL', 'AND', 'ANT', 'ANY', 'APE', 'APP',
  'ARC', 'ARE', 'ARM', 'ART', 'ASH', 'ASK', 'BAD', 'BAG', 'BAR', 'BAT', 'BAY', 'BED', 'BEE', 'BEG',
  'BET', 'BID', 'BIG', 'BIN', 'BIT', 'BOB', 'BOG', 'BOW', 'BOX', 'BOY', 'BUG', 'BUS', 'BUT', 'BUY',
  'BYE', 'CAB', 'CAM', 'CAN', 'CAP', 'CAR', 'CAT', 'COW', 'CRY', 'CUP', 'CUT', 'DAD', 'DAM', 'DAY',
  'DEN', 'DEW', 'DID', 'DIG', 'DIM', 'DIP', 'DOC', 'DOG', 'DOT', 'DRY', 'DUE', 'DUG', 'EAR', 'EAT',
  'EGG', 'EGO', 'ELM', 'END', 'ERA', 'EYE', 'FAN', 'FAR', 'FAT', 'FAX', 'FED', 'FEE', 'FEW', 'FIT',
  'FIX', 'FLY', 'FOG', 'FOR', 'FOX', 'FRY', 'FUN', 'FUR', 'GAP', 'GAS', 'GAY', 'GEL', 'GEM', 'GET',
  'GOD', 'GOT', 'GUM', 'GUN', 'GUT', 'GUY', 'GYM', 'HAD', 'HAM', 'HAS', 'HAT', 'HAY', 'HEN', 'HER',
  'HEX', 'HEY', 'HID', 'HIM', 'HIP', 'HIS', 'HIT', 'HOP', 'HOT', 'HOW', 'HUB', 'HUG', 'HUM', 'HUT',
  'ICE', 'ILL', 'INK', 'INN', 'ION', 'ITS', 'IVY', 'JAM', 'JAR', 'JAW', 'JAY', 'JET', 'JOB', 'JOG',
  'JOY', 'KEY', 'KID', 'KIN', 'KIT', 'LAB', 'LAD', 'LAP', 'LAW', 'LAY', 'LED', 'LEG', 'LET', 'LID',
  'LIE', 'LIP', 'LIT', 'LOG', 'LOT', 'LOW', 'MAD', 'MAN', 'MAP', 'MAT', 'MAX', 'MAY', 'MEN', 'MET',
  'MID', 'MUD', 'MUG', 'MUM', 'NAB', 'NET', 'NEW', 'NIL', 'NOD', 'NOT', 'NOW', 'NUT', 'OAK', 'OAR',
  'ODD', 'OFF', 'OIL', 'OLD', 'ONE', 'OPT', 'ORB', 'OUR', 'OUT', 'OWL', 'OWN', 'PAD', 'PAN', 'PAY',
  'PEG', 'PEN', 'PET', 'PEW', 'PIE', 'PIG', 'PIN', 'PIT', 'PLY', 'POD', 'POP', 'POT', 'PRO', 'PUB',
  'PUN', 'PUP', 'PUT', 'RAD', 'RAG', 'RAM', 'RAN', 'RAP', 'RAT', 'RAW', 'RAY', 'RED', 'RIB', 'RID',
  'RIG', 'RIM', 'RIP', 'ROB', 'ROD', 'ROT', 'ROW', 'RUB', 'RUG', 'RUN', 'RUT', 'RYE', 'SAD', 'SAG',
  'SAP', 'SAT', 'SAW', 'SAY', 'SEA', 'SEE', 'SET', 'SEW', 'SHY', 'SIN', 'SIP', 'SIR', 'SIT', 'SIX',
  'SKI', 'SKY', 'SLY', 'SOB', 'SON', 'SOW', 'SOY', 'SPA', 'SPY', 'SUM', 'SUN', 'TAB', 'TAG', 'TAN',
  'TAP', 'TAR', 'TAX', 'TEA', 'TEN', 'THE', 'THY', 'TIE', 'TIN', 'TIP', 'TOE', 'TON', 'TOP', 'TOW',
  'TOY', 'TRY', 'TUB', 'TUG', 'TWO', 'URN', 'USE', 'VAN', 'VAT', 'VET', 'VIA', 'VOW', 'WAR', 'WAS',
  'WAX', 'WAY', 'WEB', 'WED', 'WET', 'WHO', 'WHY', 'WIG', 'WIN', 'WIT', 'WON', 'WOW', 'YAK', 'YAP',
  'YAW', 'YEA', 'YES', 'YET', 'YEW', 'YIP', 'YOU', 'ZEN', 'ZIP', 'ZOO',

  // 4-letter words
  'ABLE', 'ACHE', 'ACID', 'ACRE', 'AGED', 'AIDE', 'ALLY', 'ALTO', 'AMEN', 'AMID', 'ANNA', 'APEX',
  'ARCH', 'AREA', 'ARMY', 'ATOM', 'AUNT', 'AUTO', 'BABY', 'BACK', 'BAKE', 'BALL', 'BAND', 'BANK',
  'BARE', 'BARK', 'BARN', 'BASE', 'BATH', 'BEAM', 'BEAN', 'BEAR', 'BEAT', 'BEEF', 'BEER', 'BELL',
  'BELT', 'BEND', 'BEST', 'BETA', 'BIAS', 'BIKE', 'BILL', 'BIND', 'BIRD', 'BITE', 'BLOW', 'BLUE',
  'BOAT', 'BODY', 'BOIL', 'BOLD', 'BOLT', 'BOMB', 'BOND', 'BONE', 'BOOK', 'BOOM', 'BORN', 'BOSS',
  'BOTH', 'BOWL', 'BULK', 'BULL', 'BUMP', 'BURN', 'BUSH', 'BUSY', 'CAFE', 'CAGE', 'CAKE', 'CALL',
  'CALM', 'CAMP', 'CARD', 'CARE', 'CART', 'CASE', 'CASH', 'CAST', 'CAVE', 'CELL', 'CHAT', 'CHEF',
  'CHIP', 'CITY', 'CLAN', 'CLAY', 'CLUB', 'COAL', 'COAT', 'CODE', 'COIN', 'COLD', 'COME', 'COOK',
  'COOL', 'COPE', 'COPY', 'CORD', 'CORE', 'CORN', 'COST', 'CREW', 'CROP', 'CROW', 'CUBE', 'CULT',
  'CURE', 'CYAN', 'DARE', 'DARK', 'DART', 'DASH', 'DATA', 'DATE', 'DAWN', 'DEAD', 'DEAL', 'DEAN',
  'DEAR', 'DEBT', 'DECK', 'DEED', 'DEEP', 'DEER', 'DEMO', 'DENT', 'DESK', 'DIAL', 'DICE', 'DIET',
  'DIRT', 'DISC', 'DISH', 'DISK', 'DOOR', 'DOSE', 'DOWN', 'DRAW', 'DROP', 'DRUG', 'DRUM', 'DUAL',
  'DUCK', 'DUST', 'DUTY', 'EACH', 'EARL', 'EARN', 'EASE', 'EAST', 'EASY', 'EDGE', 'EDIT', 'EMIT',
  'EPIC', 'EVEN', 'EVER', 'EVIL', 'EXAM', 'EXIT', 'FACE', 'FACT', 'FADE', 'FAIL', 'FAIR', 'FALL',
  'FAME', 'FARM', 'FAST', 'FATE', 'FEAR', 'FEED', 'FEEL', 'FEET', 'FELL', 'FELT', 'FILE', 'FILL',
  'FILM', 'FIND', 'FINE', 'FIRE', 'FIRM', 'FISH', 'FIST', 'FLAT', 'FLEE', 'FLEX', 'FLIP', 'FLOW',
  'FOAM', 'FOLK', 'FOOD', 'FOOL', 'FOOT', 'FORD', 'FORK', 'FORM', 'FORT', 'FOUR', 'FREE', 'FROG',
  'FROM', 'FUEL', 'FULL', 'FUND', 'FURY', 'GAIN', 'GAME', 'GANG', 'GATE', 'GEAR', 'GENE', 'GIFT',
  'GIRL', 'GIVE', 'GLAD', 'GLOW', 'GOAL', 'GOAT', 'GOLD', 'GOLF', 'GONE', 'GOOD', 'GRAB', 'GRAY',
  'GREW', 'GRID', 'GRIN', 'GRIP', 'GROW', 'GULF', 'HACK', 'HAIL', 'HAIR', 'HALF', 'HALL', 'HALT',
  'HAND', 'HANG', 'HARD', 'HARM', 'HATE', 'HAVE', 'HAWK', 'HEAD', 'HEAL', 'HEAR', 'HEAT', 'HELD',
  'HELL', 'HELP', 'HERB', 'HERO', 'HIDE', 'HIGH', 'HIKE', 'HILL', 'HINT', 'HIRE', 'HOLD', 'HOLE',
  'HOLY', 'HOME', 'HOOD', 'HOOK', 'HOPE', 'HORN', 'HOST', 'HOUR', 'HUGE', 'HUNG', 'HUNT', 'HURT',
  'ICON', 'IDEA', 'IDLE', 'INCH', 'INFO', 'INTO', 'IRON', 'ITEM', 'JACK', 'JAIL', 'JAZZ', 'JEAN',
  'JUMP', 'JURY', 'JUST', 'KEEN', 'KEEP', 'KICK', 'KILL', 'KIND', 'KING', 'KISS', 'KNEE', 'KNOT',
  'KNOW', 'LACK', 'LADY', 'LAID', 'LAKE', 'LAMB', 'LAMP', 'LAND', 'LANE', 'LAST', 'LATE', 'LEAD',
  'LEAF', 'LEAN', 'LEFT', 'LEND', 'LESS', 'LIFT', 'LIKE', 'LIME', 'LINE', 'LINK', 'LION', 'LISP',
  'LIST', 'LIVE', 'LOAD', 'LOAN', 'LOCK', 'LOGO', 'LONG', 'LOOK', 'LORD', 'LOSE', 'LOSS', 'LOST',
  'LOVE', 'LUCK', 'MADE', 'MAIL', 'MAIN', 'MAKE', 'MALE', 'MALL', 'MANY', 'MARK', 'MASK', 'MASS',
  'MATE', 'MATH', 'MEAL', 'MEAN', 'MEAT', 'MEET', 'MEGA', 'MELT', 'MEMO', 'MENU', 'MESH', 'MESS',
  'MILD', 'MILE', 'MILK', 'MILL', 'MIND', 'MINE', 'MINT', 'MISS', 'MIST', 'MODE', 'MOOD', 'MOON',
  'MORE', 'MOST', 'MOVE', 'MUCH', 'NAME', 'NAVY', 'NEAR', 'NEAT', 'NECK', 'NEED', 'NEON', 'NEST',
  'NEWS', 'NEXT', 'NICE', 'NINE', 'NODE', 'NONE', 'NOON', 'NORM', 'NOSE', 'NOTE', 'NUMB', 'ODDS',
  'ONCE', 'ONLY', 'ONTO', 'OPEN', 'ORAL', 'OVER', 'PACE', 'PACK', 'PAGE', 'PAID', 'PAIN', 'PAIR',
  'PALE', 'PALM', 'PARK', 'PART', 'PASS', 'PAST', 'PATH', 'PEAK', 'PEEL', 'PEER', 'PICK', 'PILE',
  'PILL', 'PINE', 'PINK', 'PIPE', 'PLAN', 'PLAY', 'PLEA', 'PLOT', 'PLUG', 'PLUS', 'POEM', 'POET',
  'POLE', 'POLL', 'POOL', 'POOR', 'PORT', 'POSE', 'POST', 'POUR', 'PRAY', 'PURE', 'PUSH', 'QUIT',
  'RACE', 'RAID', 'RAIL', 'RAIN', 'RANK', 'RARE', 'RATE', 'READ', 'REAL', 'REAR', 'RELY', 'RENT',
  'REST', 'RICE', 'RICH', 'RIDE', 'RING', 'RIOT', 'RISE', 'RISK', 'ROAD', 'ROCK', 'ROLE', 'ROLL',
  'ROOF', 'ROOM', 'ROOT', 'ROPE', 'ROSE', 'RULE', 'RUSH', 'SAFE', 'SAID', 'SAIL', 'SALE', 'SALT',
  'SAME', 'SAND', 'SAVE', 'SCAN', 'SCAR', 'SEAL', 'SEAT', 'SEED', 'SEEK', 'SEEM', 'SEEN', 'SELF',
  'SELL', 'SEND', 'SENT', 'SHED', 'SHIP', 'SHOE', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SICK', 'SIDE',
  'SIGN', 'SILK', 'SITE', 'SIZE', 'SKIN', 'SLAM', 'SLAP', 'SLIP', 'SLOW', 'SNAP', 'SNOW', 'SOAP',
  'SOIL', 'SOLO', 'SOME', 'SONG', 'SOON', 'SOUL', 'SOUP', 'SOUR', 'SPAM', 'SPAN', 'SPIN', 'SPOT',
  'STAR', 'STAY', 'STEM', 'STEP', 'STOP', 'SUCH', 'SUIT', 'SURE', 'SURF', 'SWAP', 'SWIM', 'SYNC',
  'TAIL', 'TAKE', 'TALE', 'TALK', 'TALL', 'TANK', 'TAPE', 'TASK', 'TEAM', 'TEAR', 'TECH', 'TELL',
  'TEND', 'TERM', 'TEST', 'TEXT', 'THAN', 'THAT', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'TIDE',
  'TIDY', 'TIED', 'TIME', 'TINY', 'TOLL', 'TONE', 'TOOK', 'TOOL', 'TOUR', 'TOWN', 'TRAP', 'TREE',
  'TRIP', 'TRUE', 'TUBE', 'TUNE', 'TURN', 'TWIN', 'TYPE', 'UNIT', 'UPON', 'URGE', 'USER', 'VARY',
  'VAST', 'VEIL', 'VENT', 'VERB', 'VERY', 'VIEW', 'VINE', 'VOID', 'VOTE', 'WAGE', 'WAIT', 'WAKE',
  'WALK', 'WALL', 'WANT', 'WARM', 'WARN', 'WASH', 'WAVE', 'WEAK', 'WEAR', 'WEEK', 'WELL', 'WENT',
  'WEST', 'WHAT', 'WHEN', 'WIDE', 'WILD', 'WILL', 'WIND', 'WINE', 'WING', 'WIRE', 'WISE', 'WISH',
  'WITH', 'WOLF', 'WOOD', 'WOOL', 'WORD', 'WORK', 'WORM', 'WRAP', 'YARD', 'YEAR', 'ZERO', 'ZONE',

  // 5-letter words
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE', 'ADAPT', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN',
  'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIEN', 'ALIGN', 'ALIKE', 'ALIVE', 'ALLOW',
  'ALONE', 'ALONG', 'ALTER', 'AMONG', 'ANGEL', 'ANGER', 'ANGLE', 'ANGRY', 'APART', 'APPLE', 'APPLY',
  'ARENA', 'ARGUE', 'ARISE', 'ARRAY', 'ARROW', 'ASIDE', 'ASSET', 'AUDIO', 'AUDIT', 'AVOID', 'AWAIT',
  'AWAKE', 'AWARD', 'AWARE', 'BADGE', 'BASIC', 'BASIS', 'BEACH', 'BEAST', 'BEGIN', 'BEING', 'BELOW',
  'BENCH', 'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST', 'BLAZE', 'BLIND', 'BLOCK', 'BLOOD',
  'BLOOM', 'BLOWN', 'BOARD', 'BOAST', 'BOOST', 'BOUND', 'BRAIN', 'BRAND', 'BRAVE', 'BREAD', 'BREAK',
  'BREED', 'BRICK', 'BRIEF', 'BRING', 'BROAD', 'BROWN', 'BRUSH', 'BUILD', 'BUNCH', 'BURST', 'BUYER',
  'CABLE', 'CANAL', 'CANDY', 'CARGO', 'CARRY', 'CATCH', 'CAUSE', 'CHAIN', 'CHAIR', 'CHAMP', 'CHAOS',
  'CHART', 'CHASE', 'CHEAP', 'CHECK', 'CHEEK', 'CHEER', 'CHEST', 'CHIEF', 'CHILD', 'CIVIL', 'CLAIM',
  'CLASH', 'CLASS', 'CLEAN', 'CLEAR', 'CLERK', 'CLICK', 'CLIFF', 'CLIMB', 'CLOCK', 'CLOSE', 'CLOTH',
  'CLOUD', 'COACH', 'COAST', 'COLOR', 'COMIC', 'CORAL', 'COUCH', 'COUNT', 'COURT', 'COVER', 'CRACK',
  'CRAFT', 'CRANE', 'CRASH', 'CRAWL', 'CRAZY', 'CREAM', 'CREEK', 'CRIME', 'CRISP', 'CROSS', 'CROWD',
  'CROWN', 'CRUSH', 'CYBER', 'CYCLE', 'DAILY', 'DANCE', 'DEATH', 'DEBUT', 'DELAY', 'DELTA', 'DENSE',
  'DEPTH', 'DIARY', 'DIGIT', 'DIRTY', 'DOUBT', 'DRAFT', 'DRAIN', 'DRAMA', 'DREAM', 'DRESS', 'DRIFT',
  'DRILL', 'DRINK', 'DRIVE', 'DROVE', 'DYING', 'EAGER', 'EARLY', 'EARTH', 'EIGHT', 'ELITE', 'EMPTY',
  'ENEMY', 'ENJOY', 'ENTER', 'ENTRY', 'EQUAL', 'ERROR', 'ESSAY', 'EVENT', 'EVERY', 'EXACT', 'EXIST',
  'EXTRA', 'FAINT', 'FAITH', 'FALSE', 'FANCY', 'FAULT', 'FAVOR', 'FEAST', 'FIBER', 'FIELD', 'FIFTH',
  'FIFTY', 'FIGHT', 'FINAL', 'FIRST', 'FLAME', 'FLASH', 'FLEET', 'FLOAT', 'FLOOD', 'FLOOR', 'FLOUR',
  'FLUID', 'FOCUS', 'FORCE', 'FORGE', 'FORTH', 'FORTY', 'FORUM', 'FOUND', 'FRAME', 'FRAUD', 'FRESH',
  'FRONT', 'FROST', 'FRUIT', 'GIANT', 'GIVEN', 'GLASS', 'GLOBE', 'GLORY', 'GRACE', 'GRADE', 'GRAIN',
  'GRAND', 'GRANT', 'GRASS', 'GRAVE', 'GREAT', 'GREEN', 'GREET', 'GRIEF', 'GUEST', 'GUIDE', 'GUILT',
  'HABIT', 'HAPPY', 'HARSH', 'HEART', 'HEAVY', 'HEDGE', 'HELLO', 'HONEY', 'HONOR', 'HORSE', 'HOTEL',
  'HOUSE', 'HUMAN', 'HURRY', 'IDEAL', 'IMAGE', 'INDEX', 'INNER', 'INPUT', 'ISSUE', 'JEWEL', 'JOINT',
  'JUDGE', 'JUICE', 'KNIFE', 'KNOCK', 'LABEL', 'LABOR', 'LARGE', 'LASER', 'LATER', 'LAUGH', 'LAYER',
  'LEARN', 'LEASE', 'LEAST', 'LEAVE', 'LEGAL', 'LEMON', 'LEVEL', 'LEVER', 'LIGHT', 'LIMIT', 'LOCAL',
  'LOGIC', 'LOOSE', 'LOVER', 'LOWER', 'LOYAL', 'LUCKY', 'LUNCH', 'MAGIC', 'MAJOR', 'MAKER', 'MARCH',
  'MATCH', 'MAYOR', 'MEDIA', 'MERIT', 'METAL', 'METER', 'MIDST', 'MIGHT', 'MINOR', 'MODEL', 'MODEM',
  'MONEY', 'MONTH', 'MORAL', 'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVIE', 'MUSIC', 'NAIVE', 'NERVE',
  'NEXUS', 'NIGHT', 'NOBLE', 'NOISE', 'NORTH', 'NOVEL', 'NURSE', 'OCCUR', 'OCEAN', 'OFFER', 'OFTEN',
  'OPERA', 'ORBIT', 'ORDER', 'OTHER', 'OUGHT', 'OUTER', 'OWNER', 'PANEL', 'PANIC', 'PAPER', 'PARTY',
  'PEACE', 'PHASE', 'PHONE', 'PHOTO', 'PIECE', 'PILOT', 'PITCH', 'PIVOT', 'PIXEL', 'PLACE', 'PLAIN',
  'PLANE', 'PLANT', 'PLATE', 'POINT', 'POUND', 'POWER', 'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT',
  'PRIOR', 'PRIZE', 'PULSE', 'PUPIL', 'QUEEN', 'QUERY', 'QUEST', 'QUICK', 'QUIET', 'QUITE', 'RADAR',
  'RADIO', 'RAISE', 'RALLY', 'RANCH', 'RANGE', 'RAPID', 'RATIO', 'REACH', 'REACT', 'READY', 'REALM',
  'REBEL', 'REFER', 'RELAX', 'REPLY', 'RESET', 'RIDER', 'RIDGE', 'RIGHT', 'RIVAL', 'RIVER', 'ROBOT',
  'ROUGH', 'ROUND', 'ROUTE', 'ROYAL', 'RULER', 'SCALE', 'SCENE', 'SCOPE', 'SCORE', 'SCRAP', 'SENSE',
  'SERVE', 'SETUP', 'SEVEN', 'SHADE', 'SHAFT', 'SHAKE', 'SHARE', 'SHARP', 'SHEET', 'SHELF', 'SHELL',
  'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT', 'SHORT', 'SIGHT', 'SKILL', 'SMART', 'SMILE', 'SMOKE',
  'SOLAR', 'SOLID', 'SOLVE', 'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPARK', 'SPEAK', 'SPEED', 'SPEND',
  'SPIKE', 'SPIN', 'SPIRIT', 'SPLIT', 'SPOKE', 'SPORT', 'STAFF', 'STAGE', 'STAKE', 'STAND', 'START',
  'STATE', 'STEAM', 'STEEL', 'STICK', 'STILL', 'STOCK', 'STONE', 'STORE', 'STORM', 'STORY', 'STRIP',
  'STUDY', 'STUFF', 'STYLE', 'SUGAR', 'SUITE', 'SUPER', 'SWEET', 'SWIFT', 'TABLE', 'TASTE', 'TEACH',
  'THANK', 'THEME', 'THICK', 'THING', 'THINK', 'THIRD', 'THREE', 'TIGER', 'TIGHT', 'TIMER', 'TITLE',
  'TODAY', 'TOKEN', 'TOOTH', 'TOPIC', 'TOTAL', 'TOUCH', 'TOWER', 'TRACK', 'TRADE', 'TRAIL', 'TRAIN',
  'TREAT', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRUCK', 'TRULY', 'TRUST', 'TRUTH', 'TWICE', 'UNCLE',
  'UNDER', 'UNION', 'UNITY', 'UPPER', 'UPSET', 'URBAN', 'USAGE', 'VALID', 'VALUE', 'VALVE', 'VAPOR',
  'VAULT', 'VENUE', 'VIRAL', 'VIRUS', 'VISIT', 'VITAL', 'VOICE', 'WASTE', 'WATCH', 'WATER', 'WHEEL',
  'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE', 'WIDOW', 'WOMAN', 'WORLD', 'WORRY', 'WORSE',
  'WORST', 'WORTH', 'WOULD', 'WOUND', 'WRITE', 'WRONG', 'YIELD', 'YOUNG', 'YOUTH',

  // 6+ letter words
  'ACTION', 'ACTIVE', 'ADVICE', 'AFRAID', 'AGENCY', 'AGENDA', 'ALMOST', 'ALWAYS', 'AMOUNT', 'ANIMAL',
  'ANNUAL', 'ANSWER', 'ANYONE', 'APPEAL', 'APPEAR', 'AROUND', 'ARRIVE', 'ARTIST', 'ASPECT', 'ATTACK',
  'AVENUE', 'BATTLE', 'BEAUTY', 'BECOME', 'BEFORE', 'BEHIND', 'BELIEF', 'BELONG', 'BETTER', 'BEYOND',
  'BORDER', 'BOTTLE', 'BOTTOM', 'BRANCH', 'BREATH', 'BRIDGE', 'BRIGHT', 'BROKEN', 'BUDGET', 'BURDEN',
  'CAMERA', 'CAMPUS', 'CANCER', 'CANDLE', 'CANYON', 'CAPITAL', 'CARBON', 'CAREER', 'CASTLE', 'CASUAL',
  'CAUGHT', 'CENTER', 'CHANCE', 'CHANGE', 'CHARGE', 'CHOICE', 'CHURCH', 'CIRCLE', 'CLIENT', 'CLIMATE',
  'CLOSED', 'COFFEE', 'COLUMN', 'COMBAT', 'COMMON', 'COPPER', 'CORNER', 'COUNTY', 'COUPLE', 'COURSE',
  'COUSIN', 'CREDIT', 'CRISIS', 'CUSTOM', 'DAMAGE', 'DANGER', 'DECIDE', 'DEFEAT', 'DEFEND', 'DEGREE',
  'DEMAND', 'DESIGN', 'DESIRE', 'DETAIL', 'DETECT', 'DEVICE', 'DIFFER', 'DINNER', 'DIRECT', 'DIVIDE',
  'DOCTOR', 'DOMAIN', 'DOUBLE', 'DRAGON', 'DRIVEN', 'DRIVER', 'DURING', 'DYNAMIC', 'EASILY', 'EDITOR',
  'EFFECT', 'EFFORT', 'EITHER', 'ELEVEN', 'EMERGE', 'EMPIRE', 'EMPLOY', 'ENGINE', 'ENOUGH', 'ENSURE',
  'ENTIRE', 'EQUITY', 'ESCAPE', 'ESTATE', 'ETHICS', 'EXCEED', 'EXCEPT', 'EXCITE', 'EXCUSE', 'EXPAND',
  'EXPECT', 'EXPERT', 'EXPORT', 'EXTEND', 'EXTENT', 'FABRIC', 'FACTOR', 'FAILED', 'FAMILY', 'FAMOUS',
  'FATHER', 'FEMALE', 'FIGURE', 'FILTER', 'FINALE', 'FINGER', 'FINISH', 'FLIGHT', 'FLOWER', 'FLYING',
  'FOLLOW', 'FOREST', 'FORGET', 'FORMAL', 'FORMAT', 'FORMER', 'FOSTER', 'FOURTH', 'FRIEND', 'FROZEN',
  'FUTURE', 'GALAXY', 'GARDEN', 'GATHER', 'GENDER', 'GLOBAL', 'GOLDEN', 'GOVERN', 'GROUND', 'GROWTH',
  'GUILTY', 'HANDLE', 'HAPPEN', 'HARBOR', 'HARDLY', 'HAZARD', 'HEALTH', 'HEAVEN', 'HEIGHT', 'HIDDEN',
  'HOLDER', 'HONEST', 'HORROR', 'HOSPITAL', 'IMPACT', 'IMPORT', 'IMPOSE', 'INCOME', 'INDEED', 'INFANT',
  'INFORM', 'INJURY', 'INSIDE', 'INTEND', 'INVEST', 'ISLAND', 'ITSELF', 'JACKET', 'JUNGLE', 'JUNIOR',
  'KEEPER', 'KNIGHT', 'LABELED', 'LADDER', 'LATEST', 'LATTER', 'LAWYER', 'LEADER', 'LEAGUE', 'LEGACY',
  'LENGTH', 'LESSON', 'LETTER', 'LIGHTS', 'LIKELY', 'LIQUID', 'LITTLE', 'LIVING', 'LONELY', 'LOVELY',
  'LUXURY', 'MACHINE', 'MAGNET', 'MAINLY', 'MAKING', 'MANAGE', 'MANNER', 'MANUAL', 'MARGIN', 'MARKET',
  'MARRIED', 'MASTER', 'MATRIX', 'MATTER', 'MATURE', 'MEDIUM', 'MEMBER', 'MEMORY', 'MENTAL', 'METHOD',
  'MIDDLE', 'MILLION', 'MINING', 'MINUTE', 'MIRROR', 'MOBILE', 'MODERN', 'MODEST', 'MODULE', 'MOMENT',
  'MONSTER', 'MORTAL', 'MOTION', 'MOTIVE', 'MOUNTAIN', 'MURDER', 'MUSEUM', 'MUTUAL', 'MYTHIC', 'NATION',
  'NATIVE', 'NATURE', 'NEARBY', 'NEEDLE', 'NIGHTS', 'NOBODY', 'NORMAL', 'NOTICE', 'NUMBER', 'OBJECT',
  'OBTAIN', 'OFFICE', 'ONLINE', 'OPTION', 'ORANGE', 'ORIGIN', 'OUTPUT', 'PACIFIC', 'PACKET', 'PALACE',
  'PANTRY', 'PARADE', 'PARENT', 'PARROT', 'PARTLY', 'PATENT', 'PEOPLE', 'PERIOD', 'PERMIT', 'PERSON',
  'PHRASE', 'PLANET', 'PLAYER', 'PLEDGE', 'PLENTY', 'POCKET', 'POETRY', 'POLICE', 'POLICY', 'PORTAL',
  'POSTAL', 'POTATO', 'POWDER', 'PRAISE', 'PRAYER', 'PREFER', 'PRETTY', 'PRINCE', 'PRISON', 'PROFIT',
  'PROMPT', 'PROPER', 'PROVE', 'PUBLIC', 'PURSUE', 'PUZZLE', 'QUARTZ', 'QUENCH', 'QUIETLY', 'RABBIT',
  'RACIAL', 'RADICAL', 'RANDOM', 'RATING', 'READER', 'REASON', 'RECALL', 'RECENT', 'RECORD', 'REDUCE',
  'REFORM', 'REFUGE', 'REGION', 'REGRET', 'RELIEF', 'REMAIN', 'REMOTE', 'REMOVE', 'REPAIR', 'REPEAT',
  'REPORT', 'RESCUE', 'RESIGN', 'RESIST', 'RESORT', 'RESULT', 'RETAIL', 'RETAIN', 'RETURN', 'REVEAL',
  'REWARD', 'RHYTHM', 'RISING', 'ROBUST', 'ROCKET', 'ROLLER', 'ROTATE', 'ROUTER', 'RUNNER', 'SACRED',
  'SAFETY', 'SALARY', 'SAMPLE', 'SAVING', 'SCHEME', 'SCHOOL', 'SCREEN', 'SCRIPT', 'SEARCH', 'SEASON',
  'SECOND', 'SECRET', 'SECTOR', 'SECURE', 'SELECT', 'SELLER', 'SENIOR', 'SERIES', 'SETTLE', 'SEVERE',
  'SHADOW', 'SHIELD', 'SIGNAL', 'SILENT', 'SILVER', 'SIMPLE', 'SINGLE', 'SISTER', 'SLIGHT', 'SMOOTH',
  'SOCIAL', 'SOCKET', 'SOFTLY', 'SOURCE', 'SPEECH', 'SPIRIT', 'SPREAD', 'SPRING', 'SQUARE', 'STABLE',
  'STATUS', 'STEADY', 'STOLEN', 'STREET', 'STRESS', 'STRIKE', 'STRING', 'STRONG', 'STUDIO', 'SUBMIT',
  'SUDDEN', 'SUMMER', 'SUMMIT', 'SUPPER', 'SUPPLY', 'SURELY', 'SURVEY', 'SWITCH', 'SYMBOL', 'SYSTEM',
  'TACTIC', 'TALENT', 'TARGET', 'TASTEFUL', 'TEMPLE', 'TENANT', 'TENDER', 'TENNIS', 'TERROR', 'THANKS',
  'THEORY', 'THREAT', 'TIMBER', 'TIMELY', 'TISSUE', 'TOGETHER', 'TOMATO', 'TONGUE', 'TOPICS', 'TRADED',
  'TRAVEL', 'TREATY', 'TRIBAL', 'TROPHY', 'TWELVE', 'TWENTY', 'UNIQUE', 'UNITED', 'UNLESS', 'UNLIKE',
  'UPDATE', 'URGENT', 'USEFUL', 'VALLEY', 'VALUED', 'VECTOR', 'VERIFY', 'VESSEL', 'VICTIM', 'VICTORY',
  'VIOLIN', 'VIRTUE', 'VISION', 'VISUAL', 'VOLUME', 'WALKER', 'WARMTH', 'WEAPON', 'WEEKLY', 'WEIGHT',
  'WINDOW', 'WINNER', 'WINTER', 'WISDOM', 'WONDER', 'WORKER', 'WORTHY', 'WRITER', 'YELLOW', 'ZENITH',
];

export const DICTIONARY_SET = new Set(COMMON_WORDS.map((w) => w.toUpperCase()));

export const isAdjacent = (c1, c2) => {
  if (!c1 || !c2) return false;
  const dr = Math.abs(c1.row - c2.row);
  const dc = Math.abs(c1.col - c2.col);
  return dr <= 1 && dc <= 1 && (dr + dc > 0);
};

export const isValidWord = (word) => {
  if (!word || word.length < 3) return false;
  return DICTIONARY_SET.has(word.trim().toUpperCase());
};

export const getWordPoints = (word) => {
  if (!isValidWord(word)) {
    return -1; // penalty
  }
  return word.length >= 7 ? 3 : 2;
};

/**
 * Searches a 10x10 letter grid around a starting cell or general search
 * to find a valid word of length >= 3 for the AI to play.
 */
export const findWordOnGrid = (grid, claimedFingerprints = new Set(), maxLen = 6) => {
  const R = 10;
  const C = 10;

  const getCellLetter = (r, c) => {
    const idx = r * 10 + c;
    return grid[idx]?.letter || '';
  };

  const visited = Array(100).fill(false);
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  // Randomize start cells that have letters
  const cellsWithLetters = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (getCellLetter(r, c)) {
        cellsWithLetters.push({ r, c });
      }
    }
  }

  // Shuffle candidate starts
  cellsWithLetters.sort(() => Math.random() - 0.5);

  let bestResult = null;

  const dfs = (r, c, currentWord, path) => {
    if (bestResult) return;
    if (currentWord.length >= 3) {
      if (DICTIONARY_SET.has(currentWord)) {
        const fp = path.map((p) => `${p.row},${p.col}`).join('->');
        if (!claimedFingerprints.has(fp)) {
          bestResult = { word: currentWord, path: [...path] };
          return;
        }
      }
    }

    if (currentWord.length >= maxLen) return;

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        const nIdx = nr * 10 + nc;
        const letter = getCellLetter(nr, nc);
        if (letter && !visited[nIdx]) {
          visited[nIdx] = true;
          path.push({ row: nr, col: nc });
          dfs(nr, nc, currentWord + letter, path);
          path.pop();
          visited[nIdx] = false;
          if (bestResult) return;
        }
      }
    }
  };

  for (const cell of cellsWithLetters) {
    const idx = cell.r * 10 + cell.c;
    visited[idx] = true;
    dfs(cell.r, cell.c, getCellLetter(cell.r, cell.c), [{ row: cell.r, col: cell.c }]);
    visited[idx] = false;
    if (bestResult) return bestResult;
  }

  return bestResult;
};

export default {
  DICTIONARY_SET,
  isValidWord,
  getWordPoints,
  isAdjacent,
  findWordOnGrid,
};
