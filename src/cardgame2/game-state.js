const CLOCKWISE_ORDER = [0, 1, 2, 3];
const MAX_PASS_COUNT = 4;

export function createInitialPlayers() {
  return [
    { name: 'Player', isCPU: false, pos: { x: 400, y: 540 }, hand: [], cardsGroup: null, passCount: 0, eliminated: false, finished: false, wins: 0, seconds: 0, thirds: 0, fourths: 0, eliminations: 0 },
    { name: 'CPU 1', isCPU: true, pos: { x: 50, y: 300 }, hand: [], cardsGroup: null, passCount: 0, eliminated: false, finished: false, wins: 0, seconds: 0, thirds: 0, fourths: 0, eliminations: 0 },
    { name: 'CPU 2', isCPU: true, pos: { x: 400, y: 70 }, hand: [], cardsGroup: null, passCount: 0, eliminated: false, finished: false, wins: 0, seconds: 0, thirds: 0, fourths: 0, eliminations: 0 },
    { name: 'CPU 3', isCPU: true, pos: { x: 750, y: 300 }, hand: [], cardsGroup: null, passCount: 0, eliminated: false, finished: false, wins: 0, seconds: 0, thirds: 0, fourths: 0, eliminations: 0 }
  ];
}

export function resetPlayersForNewRound(players) {
  players.forEach(player => {
    player.hand = [];
    player.cardsGroup = null;
    player.passCount = 0;
    player.eliminated = false;
    player.finished = false;
  });
}

export function findNextActivePlayer(players, fromIndex) {
  const current = CLOCKWISE_ORDER.indexOf(fromIndex);
  for (let offset = 1; offset <= CLOCKWISE_ORDER.length; offset += 1) {
    const nextIndex = CLOCKWISE_ORDER[(current + offset) % CLOCKWISE_ORDER.length];
    const nextPlayer = players[nextIndex];
    if (!nextPlayer.eliminated && nextPlayer.hand.length > 0) {
      return nextIndex;
    }
  }
  return null;
}

export function updateCumulativeResults(players, finishedPlayers) {
  let position = 0;
  finishedPlayers.forEach(playerIndex => {
    const player = players[playerIndex];
    if (player.eliminated) {
      return;
    }
    if (position === 0) player.wins += 1;
    else if (position === 1) player.seconds += 1;
    else if (position === 2) player.thirds += 1;
    else if (position === 3) player.fourths += 1;
    position += 1;
  });
}

export function getResultGroups(players, finishedPlayers) {
  const rankedPlayers = finishedPlayers.filter(playerIndex => !players[playerIndex].eliminated);
  const eliminatedPlayers = finishedPlayers.filter(playerIndex => players[playerIndex].eliminated);
  return { rankedPlayers, eliminatedPlayers };
}

export function getDiamondSevenOwner(players) {
  return players.findIndex(player => player.hand.includes(45));
}

export function canPlayerPass(player, hasPlayableCard = false) {
  if (player.passCount < MAX_PASS_COUNT - 1) {
    return true;
  }

  return !hasPlayableCard;
}
