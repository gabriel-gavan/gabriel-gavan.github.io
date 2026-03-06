/**
 * PuzzleGenerator.js
 * Procedural generation for Neon Mystery Files
 */

const CIPHER_WORDS = [
  "NEON", "CYBER", "GRID", "CORE", "SIGNAL", "ENCRYPT", "DECODE", "TERMINAL",
  "MYSTERY", "ACCESS", "HACKER", "SYSTEM", "NETWORK", "VOID", "PHANTOM",
  "PROTOCOL", "INFOLINK", "DATABASE", "MATRIX", "MAINFRAME"
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Atbash Cipher: A -> Z, B -> Y, etc.
 */
const generateAtbash = () => {
  const word = CIPHER_WORDS[Math.floor(Math.random() * CIPHER_WORDS.length)];
  const reversed = ALPHABET.split('').reverse().join('');
  const encoded = word.split('').map(char => {
    const idx = ALPHABET.indexOf(char);
    return idx !== -1 ? reversed[idx] : char;
  }).join('');

  return {
    type: "cipher",
    title: "Atbash Transmission",
    description: "An ancient mirroring algorithm was detected on the signal.",
    question: encoded,
    answer: word,
    hints: ["Each letter is its counterpart in a reversed alphabet (A=Z, B=Y...)", "Look up 'Atbash Cipher'"]
  };
};

/**
 * Caesar Cipher: Shift by N
 */
const generateCaesar = () => {
  const word = CIPHER_WORDS[Math.floor(Math.random() * CIPHER_WORDS.length)];
  const shift = Math.floor(Math.random() * 5) + 1; // 1-5 shift
  const encoded = word.split('').map(char => {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) return char;
    return ALPHABET[(idx + shift) % 26];
  }).join('');

  return {
    type: "cipher",
    title: "Rotational Signal",
    description: `The encryption seems to have a shift of ${shift} positions.`,
    question: encoded,
    answer: word,
    hints: [`The letters are shifted by ${shift} positions.`, "A classic Caesar cipher."]
  };
};

/**
 * Arithmetic or Geometric Patterns
 */
const generatePattern = () => {
  const isGeometric = Math.random() > 0.5;
  const start = Math.floor(Math.random() * 10) + 1;
  const sequence = [start];
  
  if (isGeometric) {
    const factor = Math.floor(Math.random() * 3) + 2; // 2 or 3
    for (let i = 0; i < 4; i++) {
      sequence.push(sequence[i] * factor);
    }
  } else {
    const diff = Math.floor(Math.random() * 10) + 5;
    for (let i = 0; i < 4; i++) {
      sequence.push(sequence[i] + diff);
    }
  }

  const answer = sequence.pop().toString();
  const question = [...sequence, "?"].join(", ");

  return {
    type: "pattern",
    title: isGeometric ? "Geometric Core Pulse" : "Linear Grid Sync",
    description: "Analyze the sequence and find the missing value to synchronize the core.",
    question: question,
    answer: answer,
    hints: [
      isGeometric ? "Try multiplying each number by a constant factor." : "Try adding a constant difference.",
      "Look at the relationship between consecutive numbers."
    ]
  };
};

/**
 * Binary Conversion Puzzle
 */
const generateBinary = () => {
  const decimal = Math.floor(Math.random() * 63) + 1; // 1 to 63 (up to 6 bits)
  const binary = decimal.toString(2).padStart(6, '0');

  return {
    type: "logic",
    title: "Binary Data Stream",
    description: "A raw bitstream was intercepted. Convert the 6-bit binary value to decimal to unlock the node.",
    question: binary,
    answer: decimal.toString(),
    hints: [
      "Each position represents a power of 2 (32, 16, 8, 4, 2, 1).",
      "Sum the values where the bit is '1'."
    ]
  };
};

/**
 * Word Scramble Puzzle
 */
const generateScramble = () => {
  const word = CIPHER_WORDS[Math.floor(Math.random() * CIPHER_WORDS.length)];
  
  // Scramble the word
  let scrambled = word.split('');
  for (let i = scrambled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
  }
  
  // Ensure it's actually scrambled
  if (scrambled.join('') === word && word.length > 1) {
    return generateScramble();
  }

  return {
    type: "cipher",
    title: "Scrambled Uplink",
    description: "The packet headers are out of order. Reconstruct the original system keyword.",
    question: scrambled.join(' '),
    answer: word,
    hints: [
      "It's a common term used in the Neon Grid systems.",
      `The word starts with '${word[0]}'.`
    ]
  };
};

/**
 * Generates a full week puzzle object
 */
export const generateWeeklyPuzzle = (weekNumber) => {
  const types = [generateAtbash, generateCaesar, generatePattern, generateBinary, generateScramble];
  const generator = types[Math.floor(Math.random() * types.length)];
  const puzzle = generator();

  return {
    id: `week-${weekNumber}`,
    unlockWeek: weekNumber,
    locked: false,
    ...puzzle
  };
};

/**
 * Generates a set of puzzles for the year
 */
export const generateYearlyPuzzles = (count = 52) => {
  const puzzles = [];
  for (let i = 1; i <= count; i++) {
    puzzles.push(generateWeeklyPuzzle(i));
  }
  return puzzles;
};