export function createShuffledDeck() {
  const deck = Array.from({ length: 52 }, (_, index) => index);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function getSuit(cardId) {
  return Math.floor(cardId / 13);
}

export function getRank(cardId) {
  return (cardId % 13) + 1;
}

export function isSeven(cardId) {
  return getRank(cardId) === 7;
}

export function getFieldPosition(suit, rank) {
  const centerX = 400;
  const suitRows = [170, 250, 330, 410];
  const spacingX = 45;
  const x = centerX + (rank - 7) * spacingX;
  const y = suitRows[suit];
  return { x, y };
}

export function computeFieldState(fieldPlays, retiredPlays) {
  const fieldState = [null, null, null, null];

  for (let suit = 0; suit < 4; suit += 1) {
    const present = new Array(14).fill(false);
    for (let rank = 1; rank <= 13; rank += 1) {
      const cardId = suit * 13 + (rank - 1);
      if (fieldPlays.has(cardId) || retiredPlays.has(cardId)) {
        present[rank] = true;
      }
    }

    if (!present[7]) {
      fieldState[suit] = null;
      continue;
    }

    let min = 7;
    let max = 7;
    while (min > 1 && present[min - 1]) {
      min -= 1;
    }
    while (max < 13 && present[max + 1]) {
      max += 1;
    }

    fieldState[suit] = { min, max };
  }

  return fieldState;
}

export function isCardPlayable(cardId, fieldState) {
  const suit = getSuit(cardId);
  const rank = getRank(cardId);
  const state = fieldState[suit];

  if (!state) {
    return rank === 7;
  }

  return rank === state.min - 1 || rank === state.max + 1;
}
