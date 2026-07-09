import { isCardPlayable, getSuit, getRank } from './card-utils.js';

export function findFirstPlayableIndex(player, fieldState, fieldPlays, retiredPlays) {
  let bestIndex = -1;
  let bestScore = -Infinity;

  // Create sets grouped by rank to make evaluation easier
  const handRanksBySuit = [new Set(), new Set(), new Set(), new Set()];
  player.hand.forEach(cardId => {
    handRanksBySuit[getSuit(cardId)].add(getRank(cardId));
  });

  // Helper function to make it easier to check the state of the field (cards already played)
  const isPresentOnField = (suit, rank) => {
    const cardId = suit * 13 + (rank - 1);
    return fieldPlays.has(cardId) || retiredPlays.has(cardId);
  };

  for (let i = 0; i < player.hand.length; i++) {
    const cardId = player.hand[i];
    if (isCardPlayable(cardId, fieldState)) {
      const suit = getSuit(cardId);
      const rank = getRank(cardId);
      let score = 0;
      let isSafe = false;

      if (rank > 7) {
        // [Safety check (cases 1, 2, 3)]
        // Find the next playable card (k) that would become available after playing this card
        let k = rank + 1;
        while (k <= 13 && isPresentOnField(suit, k)) {
          k++;
        }
        // The card is safe if the next playable card does not exist (exceeds 13) or is already in the player's hand
        if (k > 13 || handRanksBySuit[suit].has(k)) {
          isSafe = true;
        }

        // Base score (how many higher cards of the same suit are in the hand)
        const count = player.hand.filter(id => getSuit(id) === suit && getRank(id) > rank).length;
        score = count > 0 ? count : -1;
      } else if (rank < 7) {
        // [Safety check (cases 1, 2, 3)]
        let k = rank - 1;
        while (k >= 1 && isPresentOnField(suit, k)) {
          k--;
        }
        if (k < 1 || handRanksBySuit[suit].has(k)) {
          isSafe = true;
        }

        // Base score
        const count = player.hand.filter(id => getSuit(id) === suit && getRank(id) < rank).length;
        score = count > 0 ? count : -1;
      }

      // Safe cards (those that do not assist other players) are prioritized first (score + 100)
      if (isSafe) {
        score += 100;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  // If every playable card is at the lowest priority (score -1) and the player still has pass opportunities left (up to 2 passes), intentionally pass to block the opponent
  if (bestScore === -1 && player.passCount < 2) {
    return -1; // Pass
  }

  return bestIndex;
}
