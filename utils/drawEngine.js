/**
 * Draw Engine — handles random and algorithmic draw logic
 */

// Generate random winning numbers (5 unique numbers from 1-45)
function generateRandomNumbers() {
  const numbers = new Set();
  while (numbers.size < 5) {
    numbers.add(Math.floor(Math.random() * 45) + 1);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// Generate algorithmic numbers weighted by score frequency
function generateAlgorithmicNumbers(allScores) {
  if (!allScores || allScores.length === 0) {
    return generateRandomNumbers();
  }

  // Count frequency of each score
  const frequency = {};
  allScores.forEach(score => {
    frequency[score] = (frequency[score] || 0) + 1;
  });

  // Weight: combine most and least frequent scores
  const entries = Object.entries(frequency).map(([num, count]) => ({
    number: parseInt(num),
    weight: count,
  }));

  // Mix: 3 most frequent + 2 least frequent for balance
  entries.sort((a, b) => b.weight - a.weight);
  const mostFrequent = entries.slice(0, Math.min(3, entries.length));
  const leastFrequent = entries.slice(-Math.min(2, entries.length));

  const pool = [...mostFrequent, ...leastFrequent];
  const selected = new Set();

  // Pick from weighted pool
  for (const item of pool) {
    if (selected.size < 5) selected.add(item.number);
  }

  // Fill remaining with random if needed
  while (selected.size < 5) {
    selected.add(Math.floor(Math.random() * 45) + 1);
  }

  return Array.from(selected).sort((a, b) => a - b);
}

// Count matching numbers between user scores and winning numbers
function countMatches(userScores, winningNumbers) {
  const winSet = new Set(winningNumbers);
  return userScores.filter(s => winSet.has(s)).length;
}

// Calculate prize pool distribution
function calculatePrizePool(totalPool, jackpotRollover = 0) {
  return {
    pool5Match: totalPool * 0.40 + jackpotRollover, // 40% + jackpot rollover
    pool4Match: totalPool * 0.35,                     // 35%
    pool3Match: totalPool * 0.25,                     // 25%
  };
}

module.exports = {
  generateRandomNumbers,
  generateAlgorithmicNumbers,
  countMatches,
  calculatePrizePool,
};
