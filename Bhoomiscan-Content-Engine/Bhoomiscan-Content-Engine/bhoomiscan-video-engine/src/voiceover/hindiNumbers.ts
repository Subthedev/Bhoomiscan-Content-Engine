/**
 * Hindi number-to-words converter for natural TTS pronunciation.
 *
 * Hindi has unique words for every number 1-99 (not composable like English).
 * This lookup table ensures proper pronunciation.
 *
 * Example: 780000 → "सात लाख अस्सी हज़ार"
 */

/** Every Hindi number 0-99 has its own unique word */
const HINDI_1_TO_99: string[] = [
  "",          // 0
  "एक",        // 1
  "दो",        // 2
  "तीन",       // 3
  "चार",       // 4
  "पाँच",      // 5
  "छह",        // 6
  "सात",       // 7
  "आठ",        // 8
  "नौ",        // 9
  "दस",        // 10
  "ग्यारह",     // 11
  "बारह",      // 12
  "तेरह",      // 13
  "चौदह",      // 14
  "पंद्रह",     // 15
  "सोलह",      // 16
  "सत्रह",      // 17
  "अठारह",     // 18
  "उन्नीस",     // 19
  "बीस",       // 20
  "इक्कीस",     // 21
  "बाईस",      // 22
  "तेईस",      // 23
  "चौबीस",     // 24
  "पच्चीस",     // 25
  "छब्बीस",    // 26
  "सत्ताईस",    // 27
  "अट्ठाईस",    // 28
  "उनतीस",     // 29
  "तीस",       // 30
  "इकतीस",     // 31
  "बत्तीस",     // 32
  "तैंतीस",     // 33
  "चौंतीस",     // 34
  "पैंतीस",     // 35
  "छत्तीस",     // 36
  "सैंतीस",     // 37
  "अड़तीस",     // 38
  "उनतालीस",    // 39
  "चालीस",     // 40
  "इकतालीस",    // 41
  "बयालीस",    // 42
  "तैंतालीस",    // 43
  "चवालीस",    // 44
  "पैंतालीस",    // 45
  "छियालीस",   // 46
  "सैंतालीस",    // 47
  "अड़तालीस",   // 48
  "उनचास",     // 49
  "पचास",      // 50
  "इक्यावन",    // 51
  "बावन",      // 52
  "तिरपन",     // 53
  "चौवन",      // 54
  "पचपन",      // 55
  "छप्पन",     // 56
  "सत्तावन",    // 57
  "अट्ठावन",    // 58
  "उनसठ",      // 59
  "साठ",       // 60
  "इकसठ",      // 61
  "बासठ",      // 62
  "तिरसठ",     // 63
  "चौंसठ",      // 64
  "पैंसठ",      // 65
  "छियासठ",    // 66
  "सड़सठ",      // 67
  "अड़सठ",      // 68
  "उनहत्तर",    // 69
  "सत्तर",      // 70
  "इकहत्तर",    // 71
  "बहत्तर",     // 72
  "तिहत्तर",    // 73
  "चौहत्तर",    // 74
  "पचहत्तर",    // 75
  "छिहत्तर",    // 76
  "सतहत्तर",    // 77
  "अठहत्तर",    // 78
  "उनासी",     // 79
  "अस्सी",     // 80
  "इक्यासी",    // 81
  "बयासी",     // 82
  "तिरासी",     // 83
  "चौरासी",     // 84
  "पचासी",     // 85
  "छियासी",    // 86
  "सत्तासी",    // 87
  "अट्ठासी",    // 88
  "नवासी",     // 89
  "नब्बे",      // 90
  "इक्यानवे",   // 91
  "बानवे",     // 92
  "तिरानवे",    // 93
  "चौरानवे",    // 94
  "पचानवे",    // 95
  "छियानवे",   // 96
  "सत्तानवे",   // 97
  "अट्ठानवे",   // 98
  "निन्यानवे",  // 99
];

const CRORE = 10_000_000;
const LAKH = 100_000;
const HAZAAR = 1_000;
const SAU = 100;

/**
 * Convert a positive integer to Hindi words.
 * Supports values up to 99,99,99,999 (99 crore).
 */
export function numberToHindi(n: number): string {
  if (n === 0) return "शून्य";
  if (n < 0) return `माइनस ${numberToHindi(-n)}`;

  n = Math.round(n);
  const parts: string[] = [];

  if (n >= CRORE) {
    parts.push(`${HINDI_1_TO_99[Math.floor(n / CRORE)]} करोड़`);
    n %= CRORE;
  }

  if (n >= LAKH) {
    parts.push(`${HINDI_1_TO_99[Math.floor(n / LAKH)]} लाख`);
    n %= LAKH;
  }

  if (n >= HAZAAR) {
    parts.push(`${HINDI_1_TO_99[Math.floor(n / HAZAAR)]} हज़ार`);
    n %= HAZAAR;
  }

  if (n >= SAU) {
    parts.push(`${HINDI_1_TO_99[Math.floor(n / SAU)]} सौ`);
    n %= SAU;
  }

  if (n > 0 && n < 100) {
    parts.push(HINDI_1_TO_99[n]);
  }

  return parts.join(" ").trim();
}

/**
 * Price in rupees → natural Hindi speech.
 *
 * 780000   → "सात लाख अस्सी हज़ार रुपये"
 * 11000000 → "एक करोड़ दस लाख रुपये"
 * 1250000  → "बारह लाख पचास हज़ार रुपये"
 */
export function priceToHindiWords(price: number): string {
  return `${numberToHindi(price)} रुपये`;
}

/**
 * Returns display + spoken forms for SSML <sub> tag.
 */
export function priceForSSML(price: number): { display: string; spoken: string } {
  const spoken = priceToHindiWords(price);

  let display: string;
  if (price >= CRORE) {
    const val = price / CRORE;
    display = val === Math.floor(val) ? `${val} करोड़ रुपये` : `${val.toFixed(1)} करोड़ रुपये`;
  } else if (price >= LAKH) {
    const val = price / LAKH;
    display = val === Math.floor(val) ? `${val} लाख रुपये` : `${val.toFixed(1)} लाख रुपये`;
  } else if (price >= HAZAAR) {
    display = `${Math.round(price / HAZAAR)} हज़ार रुपये`;
  } else {
    display = `${price} रुपये`;
  }

  return { display, spoken };
}

export function rateToHindiWords(rate: number): string {
  return `${numberToHindi(Math.round(rate))} रुपये`;
}

export function areaToHindiWords(size: number, unit: string): string {
  if (unit === "sq.ft" && size >= 43560) {
    return `${(size / 43560).toFixed(1)} एकड़`;
  }
  // Handle Indian land measurement units
  if (unit === "acre" || unit === "एकड़") {
    return `${numberToHindi(Math.round(size))} एकड़`;
  }
  if (unit === "bigha" || unit === "बीघा") {
    return `${numberToHindi(Math.round(size))} बीघा`;
  }
  if (unit === "guntha" || unit === "गुंठा") {
    return `${numberToHindi(Math.round(size))} गुंठा`;
  }
  if (unit === "decimal" || unit === "डेसिमल") {
    return `${numberToHindi(Math.round(size))} डेसिमल`;
  }
  return `${numberToHindi(size)} स्क्वेयर फ़ीट`;
}

/** Convert road width to Hindi words (e.g., "30 feet road" → "तीस फ़ीट रोड") */
export function roadWidthToHindi(width: number, unit: string = "feet"): string {
  return `${numberToHindi(width)} ${unit === "feet" ? "फ़ीट" : unit} रोड`;
}

/** Convert dimensions to Hindi words (e.g., "30x40" → "तीस बाय चालीस") */
export function dimensionsToHindi(dimensions: string): string {
  const match = dimensions.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (!match) return dimensions;
  return `${numberToHindi(parseInt(match[1]))} बाय ${numberToHindi(parseInt(match[2]))}`;
}
