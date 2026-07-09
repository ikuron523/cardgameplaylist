export function createResultUI(scene, players, finishedPlayers, onStartNextGame) {
  const resultUI = scene.add.container(0, 0).setDepth(1000);
  const rankIconKeys = ['sevens_rank_1', 'sevens_rank_2', 'sevens_rank_3', 'sevens_rank_4'];

  const overlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);
  resultUI.add(overlay);
  resultUI.add(scene.add.text(400, 60, 'GAME RESULT', {
    fontSize: '28px',
    color: '#ffd700',
    fontStyle: 'bold'
  }).setOrigin(0.5));

  const rankLabels = ['Winner', 'Second', 'Third', 'Forth'];
  const colors = ['#ffcc00', '#99ff33', '#0099ff', '#cccccc'];
  let resultY = 120;

  const rankedPlayers = finishedPlayers.filter(playerIndex => !players[playerIndex].eliminated);
  rankedPlayers.forEach((playerIndex, idx) => {
    const player = players[playerIndex];
    const label = rankLabels[idx] || `Place ${idx + 1}`;
    const color = colors[idx] || '#cccccc';
    const iconKey = rankIconKeys[idx] || 'sevens_rank_4';
    const icon = scene.add.image(150, resultY, iconKey).setScale(0.5).setOrigin(0.5);
    resultUI.add(icon);
    resultUI.add(scene.add.text(190, resultY, `${label}: ${player.name}`, {
      fontSize: '24px',
      color,
      fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    resultY += 60;
  });

  const eliminatedPlayers = finishedPlayers.filter(playerIndex => players[playerIndex].eliminated);
  eliminatedPlayers.forEach(playerIndex => {
    const player = players[playerIndex];
    const icon = scene.add.image(150, resultY, 'sevens_eliminated').setScale(0.5).setOrigin(0.5);
    resultUI.add(icon);
    resultUI.add(scene.add.text(190, resultY, `Eliminated: ${player.name}`, {
      fontSize: '24px',
      color: '#888888',
      fontStyle: 'normal'
    }).setOrigin(0, 0.5));
    resultY += 60;
  });

  const statsY = resultY + 20;
  resultUI.add(scene.add.text(400, statsY, 'CUMULATIVE STATS', {
    fontSize: '20px',
    color: '#ffffff'
  }).setOrigin(0.5));

  const statsLines = players.map(player => {
    return `${player.name}: Winner ${player.wins}, Second ${player.seconds}, Third ${player.thirds}, Forth ${player.fourths}, Eliminated ${player.eliminations}`;
  });
  resultUI.add(scene.add.text(400, statsY + 40, statsLines.join('\n'), {
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#ffffff',
    align: 'center',
    lineSpacing: 6
  }).setOrigin(0.5, 0));

  const nextBtn = scene.add.text(400, 540, ' START NEXT GAME ', {
    fontSize: '24px',
    color: '#ffffff',
    backgroundColor: '#27ae60',
    padding: { x: 20, y: 12 },
    fontStyle: 'bold'
  }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onStartNextGame);
  resultUI.add(nextBtn);

  return resultUI;
}
