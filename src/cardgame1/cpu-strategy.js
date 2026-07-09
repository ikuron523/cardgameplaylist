import { isStairs, canPlayCards, getSuit, getBaseStrength, isForbiddenFinish } from './card-utils';

/**
 * Basic decision routine:
 * Search playable cards from weakest to strongest and play the first one found.
 * Prioritize straights, then pairs/singles.
 */
const basicStrategy = (currentPlayer, allPlayers, finishedPlayers, lastPlayedCards, isRevolution, playedCardsMemory = null) => {
  const fieldSize = lastPlayedCards.length;
  const isFieldStairs = fieldSize > 0 && isStairs(lastPlayedCards);
  let foundIndices = null;

  // Identify the current strongest strength
  let strongestStrength = -1;
  let strongestIdsInHand = [];
  if (playedCardsMemory) {
    const hand = currentPlayer.hand; // Get the current player's hand
    strongestStrength = getStrongestOtherHas(hand, playedCardsMemory, isRevolution);
    strongestIdsInHand = hand.filter(id => getBaseStrength(id) === strongestStrength);
  }

  const hand = currentPlayer.hand; // The hand is needed within basicStrategy

  // 1. Look for a straight (if the field is empty or already a straight)
  if (fieldSize === 0 || isFieldStairs) {
    const suitGroups = [[], [], [], []];
    hand.forEach((id, idx) => suitGroups[getSuit(id)].push({ id, idx }));

    for (let suit = 0; suit < 4; suit++) {
      const suitCards = suitGroups[suit];
      // Search lengths: if leading, try longer straights first (5 -> 3); otherwise match the field size
      const lengths = fieldSize === 0 ? [5, 4, 3] : [fieldSize];
      
      for (let len of lengths) {
        if (suitCards.length < len) continue;

        const stairStartIndices = [];
        for (let i = 0; i <= suitCards.length - len; i++) stairStartIndices.push(i);
        if (isRevolution) stairStartIndices.reverse(); // During a revolution, search from the stronger (weaker) end first

        for (let i of stairStartIndices) {
          const subset = suitCards.slice(i, i + len);
          const ids = subset.map(c => c.id);
          
          const canPlay = canPlayCards(ids, lastPlayedCards, isRevolution);
          const isForbidden = isForbiddenFinish(hand, ids, isRevolution);
          // Avoid consuming the strongest card by mixing it into a straight
          const containsStrongest = ids.some(id => getBaseStrength(id) === strongestStrength);

          if (isStairs(ids) && canPlay && !isForbidden && !containsStrongest) {
            console.log(`[DEBUG: ${currentPlayer.name}] Found Stairs: ${ids}`); // DEBUG
            foundIndices = subset.map(c => c.idx);
            break;
          }
        }
        if (foundIndices) break;
      }
      if (foundIndices) break;
    }
  }

  // 2. Look for pairs/sets if no straight was found and the field is empty or a pair/single
  if (!foundIndices && (fieldSize === 0 || !isFieldStairs)) {
    const numGroups = {};
    hand.forEach((id, idx) => {
      const num = id % 13; // Rank value (0-12)
      if (!numGroups[num]) numGroups[num] = [];
      numGroups[num].push(idx);
    });

    // Search sizes: if leading, try larger sets first (4 -> 1); otherwise match the field size
    const counts = fieldSize === 0 ? [4, 3, 2, 1] : [fieldSize];

    // Special strategy: if the player holds many strong cards, play them aggressively to take control of the turn
    if (fieldSize > 0 && strongestIdsInHand.length > 0) {
      const otherCards = hand.filter(id => getBaseStrength(id) !== strongestStrength);
      const normStrongest = isRevolution ? (12 - strongestStrength) : strongestStrength;
      // Check whether all other cards are at least half as strong as the strongest card
      const areOtherCardsStrongEnough = otherCards.length === 0 || otherCards.every(id => {
        const normStr = isRevolution ? (12 - getBaseStrength(id)) : getBaseStrength(id);
        return normStr >= normStrongest / 2;
      });

      // If the strongest cards are dominant, or the remaining cards are strong enough, play them
      if (strongestIdsInHand.length >= hand.length / 2 || areOtherCardsStrongEnough) {
        const canBeatWithStrongest = canPlayCards(strongestIdsInHand.slice(0, fieldSize), lastPlayedCards, isRevolution);
        if (canBeatWithStrongest) {
          console.log(`[DEBUG: ${currentPlayer.name}] Dominating with strongest cards: ${strongestIdsInHand.slice(0, fieldSize)}`); // DEBUG
          // Identify the indices of the strongest cards and return them
          return strongestIdsInHand.slice(0, fieldSize).map(id => hand.indexOf(id));
        }
      }
    }

    const searchIndices = [];
    for (let i = 0; i < hand.length; i++) searchIndices.push(i);
    if (isRevolution) searchIndices.reverse(); // During a revolution, search from the back of the hand (2s and Aces) first

    for (let count of counts) {
      // New strategy: if this player is leading and every other player has exactly one card left, play the strongest card
      // This check runs at the start of the count === 1 loop so that it only applies if no straight or pair was found first
      if (fieldSize === 0 && count === 1) {
        let allOthersHaveOneCard = true;
        for (let i = 0; i < allPlayers.length; i++) {
          const p = allPlayers[i];
          // Skip the current player and any players who have already finished
          if (p.name === currentPlayer.name || finishedPlayers.includes(i)) continue;
          if (p.hand.length !== 1) {
            allOthersHaveOneCard = false;
            break;
          }
        }

        if (allOthersHaveOneCard) {
          // Sort the hand by current strength order (strongest first normally, weakest first during revolution)
          const sortedHandByActualStrength = [...hand].sort((a, b) => {
            const strengthA = getBaseStrength(a);
            const strengthB = getBaseStrength(b);
            return isRevolution ? strengthA - strengthB : strengthB - strengthA;
          });
          console.log(`[DEBUG: ${currentPlayer.name}] Opponents have 1 card. Playing strongest to block: ${sortedHandByActualStrength[0]}`); // DEBUG
          // Play the strongest single card to prevent a win
          return [hand.indexOf(sortedHandByActualStrength[0])];
        }
      }

      for (let i of searchIndices) {
        const num = hand[i] % 13;
        const strength = getBaseStrength(hand[i]);
        console.log(`[DEBUG: ${currentPlayer.name}] Checking card ${hand[i]} (num=${num}, strength=${strength}) for count=${count} strongest=${strongestStrength}`); // DEBUG

        // Restrict the strongest cards from being played as part of a pair or larger set; prioritize using them as singles
        if (count > 1 && strength >= strongestStrength) continue;

        if (numGroups[num] && numGroups[num].length >= count) {
          const candidateIndices = numGroups[num].slice(0, count);
          const ids = candidateIndices.map(idx => hand[idx]);

          const canPlay = canPlayCards(ids, lastPlayedCards, isRevolution);
          const isForbidden = isForbiddenFinish(hand, ids, isRevolution);
          if (canPlay && !isForbidden) {
            console.log(`[DEBUG: ${currentPlayer.name}] Found Pair/Single (count=${count}): ${ids}`); // DEBUG
            foundIndices = candidateIndices;
            break;
          }
        }
      }
      if (foundIndices) break;
    }
  }

  // --- Special strategy when 3 cards remain in hand ---
  // Apply only when the chosen play is a single card (foundIndices.length === 1)
  if (hand.length === 3 && fieldSize > 0 && playedCardsMemory && foundIndices && foundIndices.length === 1) {
    console.log(`[DEBUG: ${currentPlayer.name}] Hand size 3 special strategy check.`); // DEBUG
    const normStrongestOther = isRevolution ? (12 - strongestStrength) : strongestStrength;
    // The remaining two cards after excluding the card being played
    const playedCardIdx = foundIndices[0];
    const remainingHandIds = hand.filter((_, idx) => idx !== playedCardIdx);

    const normRem1Str = isRevolution ? (12 - getBaseStrength(remainingHandIds[0])) : getBaseStrength(remainingHandIds[0]);
    const normRem2Str = isRevolution ? (12 - getBaseStrength(remainingHandIds[1])) : getBaseStrength(remainingHandIds[1]);

    const weakThreshold = normStrongestOther / 3; // 1/3
    const strongThreshold = normStrongestOther * 2 / 3; // 2/3

    // 1. If a play is available and both remaining cards are at most one-third as strong as the strongest card, hold back and pass
    if (normRem1Str <= weakThreshold && normRem2Str <= weakThreshold) {
      console.log(`[DEBUG: ${currentPlayer.name}] Hand size 3: Remaining 2 cards are very weak (${normRem1Str.toFixed(1)}, ${normRem2Str.toFixed(1)} <= ${weakThreshold.toFixed(1)}). Passing.`); // DEBUG
      foundIndices = null; // Pass
    }
    // 2. If a play is available and at least one remaining card is at least two-thirds as strong as the strongest card, play it
    else if (normRem1Str >= strongThreshold || normRem2Str >= strongThreshold) {
      console.log(`[DEBUG: ${currentPlayer.name}] Hand size 3: At least one remaining card is strong (${normRem1Str.toFixed(1)}, ${normRem2Str.toFixed(1)} >= ${strongThreshold.toFixed(1)}). Playing.`); // DEBUG
      // Keep foundIndices as-is (play the cards)
    }
    // 3. If neither condition applies, play randomly with a 50% chance
    else {
      if (Math.random() < 0.5) {
        console.log(`[DEBUG: ${currentPlayer.name}] Hand size 3: Randomly decided to play (50%).`); // DEBUG
        // Keep foundIndices as-is (play the cards)
      } else {
        console.log(`[DEBUG: ${currentPlayer.name}] Hand size 3: Randomly decided to pass (50%).`); // DEBUG
        foundIndices = null; // Pass
      }
    }
  }

  // --- Special strategy when 2 cards remain in hand ---
  if (hand.length === 2 && fieldSize > 0 && playedCardsMemory) {
    const normStrongestOther = isRevolution ? (12 - strongestStrength) : strongestStrength;

    // 1. If the player holds the current strongest card, prioritize playing it to seize the lead as a single card
    if (fieldSize === 1) {
      const bestCardIdx = hand.findIndex(id => {
        const normStr = isRevolution ? (12 - getBaseStrength(id)) : getBaseStrength(id);
        return normStr >= normStrongestOther;
      });
      if (bestCardIdx !== -1) {
        const cardId = hand[bestCardIdx];
        if (canPlayCards([cardId], lastPlayedCards, isRevolution) && !isForbiddenFinish(hand, [cardId], isRevolution)) {
          console.log(`[DEBUG: ${currentPlayer.name}] Hand size 2: Using strongest card to take control.`); // DEBUG
          // Prioritize taking the lead with the strongest card over the weaker card that the normal search would select
          foundIndices = [bestCardIdx];
          return foundIndices; // If the strongest card is chosen, return immediately
        }
      }
    }

    // 2. If a playable card exists, check whether the remaining card is not too weak
    if (foundIndices && foundIndices.length === 1) {
      const playIdx = foundIndices[0];
      const remCardId = (playIdx === 0) ? hand[1] : hand[0];
      const cardToPlayId = hand[playIdx];

      const weakThreshold = Math.max(0, normStrongestOther) / 2;
      const normStrengthToPlay = isRevolution ? (12 - getBaseStrength(cardToPlayId)) : getBaseStrength(cardToPlayId);
      const normStrengthToRemain = isRevolution ? (12 - getBaseStrength(remCardId)) : getBaseStrength(remCardId);

      // If both remaining cards are at or below half the strength of the strongest card, play normally.
      // Pass only when the remaining card is weak and the card being played is not weak enough to justify saving it.
      if (normStrengthToRemain < weakThreshold && normStrengthToPlay >= weakThreshold) {
        console.log(`[DEBUG: ${currentPlayer.name}] Hand size 2: Passing to avoid weak last card.`); // DEBUG
        foundIndices = null;
      }
    }
  }

  return foundIndices;
};

/**
 * Get the maximum possible strength among cards that other players may still hold
 */
const getStrongestOtherHas = (hand, playedCardsMemory, isRevolution) => {
  const counts = new Array(13).fill(0); // Count how many cards of each strength (0-12) are visible
  
  // Count cards already played
  for (let i = 0; i < 52; i++) {
    if (playedCardsMemory[i]) counts[getBaseStrength(i)]++;
  }
  // Count cards in the player's hand
  hand.forEach(id => counts[getBaseStrength(id)]++);

  if (isRevolution) {
    // During revolution: strength 0 (3) is strongest; scan from 0 upward to find a strength that is not fully represented
    for (let s = 0; s <= 12; s++) {
      if (counts[s] < 4) return s;
    }
    return 13; // All cards have been exhausted
  } else {
    // Normally: strength 12 (2) is strongest; scan from 12 downward to find a strength that is not fully represented
    for (let s = 12; s >= 0; s--) {
      if (counts[s] < 4) return s;
    }
    return -1; // All cards have been exhausted
  }
};

/**
 * Cautious decision routine (example):
 * - If the player's cards are currently the strongest and can clear the field, play them aggressively.
 * - Otherwise, if the field cards are weak, save stronger cards for later.
 */
const cautiousStrategy = (currentPlayer, allPlayers, finishedPlayers, lastPlayedCards, isRevolution, playedCardsMemory) => {
  const foundIndices = basicStrategy(currentPlayer, allPlayers, finishedPlayers, lastPlayedCards, isRevolution, playedCardsMemory);

  const hand = currentPlayer.hand; // The hand is also needed inside cautiousStrategy
  const fieldSize = lastPlayedCards.length;

  // If no playable cards exist, or the player is leading (field is empty), return the basic strategy result as-is
  if (!foundIndices || fieldSize === 0) {
    return foundIndices;
  }

  // If only three cards remain, avoid holding back and prioritize winning
  if (hand.length <= 3) {
    return foundIndices;
  }

  const playedIds = foundIndices.map(idx => hand[idx]);
  const playStrength = Math.min(...playedIds.map(id => getBaseStrength(id)));
  const fieldStrength = Math.min(...lastPlayedCards.map(id => getBaseStrength(id)));

  // The strongest card strength others may still hold
  const strongestOther = getStrongestOtherHas(hand, playedCardsMemory, isRevolution);

  // Determine whether the card being played could be beaten by someone else
  const canBeBeaten = isRevolution ? strongestOther <= playStrength : strongestOther >= playStrength;

  // 1. If the player's card is guaranteed to pass (it is the strongest), play it without hesitation to take control of the field
  if (!canBeBeaten) {
    console.log(`[DEBUG: ${currentPlayer.name}] Absolute strongest in context. Playing.`); // DEBUG
    return foundIndices;
  }

  // Evaluate the average strength of the remaining hand to decide whether to save cards or play them
  const otherHandCards = hand.filter((_, idx) => !foundIndices.includes(idx));
  if (otherHandCards.length > 0) {
    const normStrongestOther = isRevolution ? (12 - strongestOther) : strongestOther;
    const sumStrength = otherHandCards.reduce((acc, id) => {
      const normStr = isRevolution ? (12 - getBaseStrength(id)) : getBaseStrength(id);
      return acc + normStr;
    }, 0);
    const avgStrength = sumStrength / otherHandCards.length;
    const avgHandThreshold = normStrongestOther / 2;

    // Normalized strength of the card being played
    const normPlayStrength = isRevolution ? (12 - playStrength) : playStrength;
    // Threshold for whether the card being played is stronger than three-fourths of the strongest card
    const playCardStrengthThreshold = normStrongestOther / 4 * 3;

    // Only consider saving the card if it is relatively strong and the average remaining hand strength suggests it is worth holding back
    if (normPlayStrength > playCardStrengthThreshold) {
      if (avgStrength <= avgHandThreshold) {
        console.log(`[DEBUG: ${currentPlayer.name}] Cautious: Passing. Avg remaining hand strength (${avgStrength.toFixed(1)}) is low (threshold: ${avgHandThreshold.toFixed(1)}) AND current play strength (${normPlayStrength}) is relatively high (>${playCardStrengthThreshold.toFixed(1)}).`); // DEBUG
        return null;
      } else {
        console.log(`[DEBUG: ${currentPlayer.name}] Cautious: Playing. Avg remaining hand strength (${avgStrength.toFixed(1)}) is sufficient (>${avgHandThreshold.toFixed(1)}).`); // DEBUG
      }
    } else {
      // If the card being played is relatively weak (at most one-quarter of the strongest card), play it without saving it
      console.log(`[DEBUG: ${currentPlayer.name}] Cautious: Playing. Current play strength (${normPlayStrength}) is relatively low (<=${playCardStrengthThreshold.toFixed(1)}), so not passing.`); // DEBUG
    }
  }

  // Before making the final decision, confirm that the play is not a forbidden finish (using the strongest card to win or leaving only the strongest card behind)
  if (foundIndices) {
    const player = currentPlayer;
    const playedIds = foundIndices.map(idx => player.hand[idx]);
    if (isForbiddenFinish(player.hand, playedIds, isRevolution)) {
      console.log(`[DEBUG: ${player.name}] Cautious: Preventing forbidden finish. Passing.`); // DEBUG
      return null; // If it would be a forbidden finish, pass
    }
  }

  return foundIndices;
};

export const getCPUMove = (player, allPlayers, finishedPlayers, lastPlayedCards, isRevolution, playedCardsMemory) => {
  switch (player.strategy) {
    case 'CAUTIOUS':
      return cautiousStrategy(player, allPlayers, finishedPlayers, lastPlayedCards, isRevolution, playedCardsMemory);
    case 'BASIC':
    default:
      return basicStrategy(player, allPlayers, finishedPlayers, lastPlayedCards, isRevolution, playedCardsMemory);
  }
};