const CARDS_PER_SUIT = 13; // A, 2, 3, ..., K

/**
 * Get the base strength of a card (3=0, ..., K=10, A=11, 2=12)
 */
export const getBaseStrength = (cardId) => {
  const num = cardId % CARDS_PER_SUIT; // 0:A, 1:2, 2:3, ..., 12:K
  if (num === 0) return 11; // A
  if (num === 1) return 12; // 2
  return num - 2;           // 3 is 0, 4 is 1...
};

/**
 * Get the suit of a card (0: Spades, 1: Hearts, 2: Diamonds, 3: Clubs)
 */
export const getSuit = (cardId) => Math.floor(cardId / CARDS_PER_SUIT);

/**
 * Determine whether a set is a pair (or single) with the same number
 */
export const isSameNumber = (ids) => {
  if (ids.length === 0) return false;
  const num = ids[0] % CARDS_PER_SUIT;
  return ids.every(id => id % CARDS_PER_SUIT === num);
};

/**
 * Determine whether a set is a straight (same suit and consecutive rank) with at least three cards
 */
export const isStairs = (ids) => {
  if (ids.length < 3) return false;
  
  // Check that all cards are the same suit
  const suit = getSuit(ids[0]);
  if (!ids.every(id => getSuit(id) === suit)) return false;

  // Check that the ranks are consecutive in ascending order
  const strengths = ids.map(id => getBaseStrength(id)).sort((a, b) => a - b);
  for (let i = 0; i < strengths.length - 1; i++) {
    if (strengths[i + 1] !== strengths[i] + 1) return false;
  }
  return true;
};

/**
 * Determine whether the selected cards can be played onto the field
 */
export const canPlayCards = (selectedIds, fieldIds, isRevolution) => {
  if (selectedIds.length === 0) return false;

  const isSelectedStairs = isStairs(selectedIds);
  const isSelectedSameNum = isSameNumber(selectedIds);

  // A play is invalid unless it is a straight or a pair/single
  if (!isSelectedStairs && !isSelectedSameNum) return false;

  // A play is allowed if the field is empty
  if (!fieldIds || fieldIds.length === 0) return true;

  if (selectedIds.length !== fieldIds.length) return false;

  const isFieldStairs = isStairs(fieldIds);
  const isFieldSameNum = isSameNumber(fieldIds);

  // The play must match the type of the current field
  if (isFieldStairs && !isSelectedStairs) return false;
  if (isFieldSameNum && !isSelectedSameNum) return false;

  // Compare strength using the weakest card in the play (for both stairs and pairs)
  const newStrength = Math.min(...selectedIds.map(id => getBaseStrength(id)));
  const fieldStrength = Math.min(...fieldIds.map(id => getBaseStrength(id)));

  // Strength comparison is reversed during a revolution
  return isRevolution ? newStrength < fieldStrength : newStrength > fieldStrength;
};

/**
 * Determine whether finishing with the strongest card is forbidden
 */
export const isForbiddenFinish = (handIds, selectedIds, isRevolution) => {
  const strongestStrength = isRevolution ? 0 : 12; // Revolution: 3 (0), normal: 2 (12)

  // 1. If the current play would finish the hand, using the strongest card is forbidden
  if (selectedIds.length === handIds.length) {
    return selectedIds.some(id => getBaseStrength(id) === strongestStrength);
  }

  // 2. Also forbid cases where the remaining hand would consist only of the strongest card
  // This prevents situations where that strongest card would be left over and block a win
  const remainingIds = handIds.filter(id => !selectedIds.includes(id));
  if (remainingIds.length > 0) {
    return remainingIds.every(id => getBaseStrength(id) === strongestStrength);
  }

  return false;
};

/**
 * Sort the hand by strength
 */
export const sortHand = (hand) => {
  return hand.sort((a, b) => getBaseStrength(a) - getBaseStrength(b));
};