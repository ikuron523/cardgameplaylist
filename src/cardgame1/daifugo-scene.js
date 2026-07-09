import * as Phaser from 'phaser';
import { getBaseStrength, sortHand, canPlayCards, isStairs, isSameNumber, getSuit, isForbiddenFinish } from './card-utils';
import { Player } from './player';
import { getCPUMove } from './cpu-strategy';
import { showHelpModal } from '../common/help-modal';

import helpMarkdown from './daifugo-help.md?raw';

export class DaifugoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DaifugoScene' });
    this.players = [];
    this.playerTexts = [];
    this.playerRankIcons = [];
    this.currentPlayerIndex = 0;
    this.currentTurnIndicator = null;
    this.fieldGroup = null;
    this.lastPlayedCards = [];
    this.passedPlayers = new Set();
    this.finishedPlayers = [];
    this.lastPlayerToPlayIndex = null;
    this.passButton = null;
    this.playButton = null;
    this.isRevolution = false;
    this.playedCardsMemory = new Array(52).fill(false);
    this.roundRevolutionCount = 0;
    this.resultUI = null;
    this.revolutionText = null;
    this.revolutionIcon = null;
    this.portraitOverlay = null;
    this.helpOverlay = null;
  }

  preload() {
    this.load.spritesheet('mycards', 'assets/mycards.png', {
      frameWidth: 100,
      frameHeight: 160,
      margin: 1,
      spacing: 0
    });
    // Load rank icons as placeholders (rank_icon_0.png ~ rank_icon_4.png)
    // 0: G.Millionaire, 1: Millionaire, 2: Poor, 3: V.Poor, 4: Commoner
    for (let i = 0; i < 5; i++) {
      this.load.image(`rank_icon_${i}`, `assets/rank_icon_${i}.png`);
    }
    // Load the revolution icon
    this.load.image('revolution_icon', 'assets/revolution_icon.png');
  }

  create() {
    this.add.text(720, 15, 'Back to Menu', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 5, y: 3 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('StartScene'));

    // Help Button
    this.add.text(20, 560, 'Help', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2980b9',
      padding: { x: 10, y: 3 }
    })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => showHelpModal(this, helpMarkdown));

    const cpuConfigs = [
      { name: 'CPU 1', x: 110, y: 265 },
      { name: 'CPU 2', x: 400, y: 135 },
      { name: 'CPU 3', x: 700, y: 265 }
    ];

    this.players = [new Player('Player', false, 400, 515)];

    // Each CPU has a 1/3 chance to become a CAUTIOUS candidate, and at most one of them is chosen (all could remain BASIC)
    const candidates = cpuConfigs.map((_, i) => i).filter(() => Math.random() < 1 / 3);
    const cautiousIdx = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : -1;

    cpuConfigs.forEach((config, i) => {
      const strategy = (i === cautiousIdx) ? 'CAUTIOUS' : 'BASIC';
      const cpu = new Player(config.name, true, config.x, config.y, 4, strategy);
      this.players.push(cpu);
      console.log(`[DEBUG] ${cpu.name} strategy: ${cpu.strategy}`);
    });

    this.fieldGroup = this.add.group();

    this.passButton = this.add.text(250, 435, 'PASS', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#cc0000',
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .setVisible(false)
      .on('pointerdown', () => this.passTurn(0));

    this.playButton = this.add.text(550, 435, 'PLAY', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .setVisible(false)
      .on('pointerdown', () => this.handlePlayButtonClick());

    // Add orientation change monitoring
    this.scale.on('orientationchange', this.handleOrientation, this);
    this.events.once('shutdown', () => {
      this.scale.off('orientationchange', this.handleOrientation, this);
    });
    this.handleOrientation();

    this.startNewGame(true);
  }

  // Start a new game (including reset logic)
  startNewGame(isFirstGame = false) {
    // 1. Reset state
    if (this.resultUI) {
      this.resultUI.destroy();
      this.resultUI = null;
    }
    this.fieldGroup.clear(true, true);
    this.lastPlayedCards = [];
    this.lastPlayerToPlayIndex = null;
    this.passedPlayers.clear();
    this.isRevolution = false;
    this.playedCardsMemory.fill(false);
    this.roundRevolutionCount = 0;

    // 2. Prepare the next game
    this.finishedPlayers = [];

    // 3. Create and deal the deck
    this.players.forEach(p => p.hand = []);
    let deck = Phaser.Utils.Array.NumberArray(0, 51);
    Phaser.Utils.Array.Shuffle(deck);
    this.dealCards(deck);

    // 4. Exchange cards (from the second game onward)
    if (!isFirstGame) {
      this.performCardExchange();
    }

    // 5. Determine the first player
    if (isFirstGame) {
      this.currentPlayerIndex = Phaser.Math.Between(0, this.players.length - 1);
    } else {
      // The V.Poor player starts the round
      this.currentPlayerIndex = this.players.findIndex(p => p.rank === 3);
    }

    this.processTurn();
  }

  // Card exchange logic
  performCardExchange() {
    const daifugo = this.players.find(p => p.rank === 0);
    const fugo = this.players.find(p => p.rank === 1);
    const hinmin = this.players.find(p => p.rank === 2);
    const daihinmin = this.players.find(p => p.rank === 3);

    const fromDaihinmin = daihinmin.hand.splice(-2, 2);
    const fromDaifugo = daifugo.hand.splice(0, 2);
    daifugo.hand.push(...fromDaihinmin);
    daihinmin.hand.push(...fromDaifugo);

    const fromHinmin = hinmin.hand.splice(-1, 1);
    const fromFugo = fugo.hand.splice(0, 1);
    fugo.hand.push(...fromHinmin);
    hinmin.hand.push(...fromFugo);

    this.players.forEach(p => sortHand(p.hand));
  }

  // Deal cards to players
  dealCards(deck) {
    for (let i = 0; i < deck.length; i++) {
      const playerIndex = i % 4;
      this.players[playerIndex].hand.push(deck[i]);
    }
    this.players.forEach(player => {
      sortHand(player.hand);
    });
  }

  // Display the player's hand
  displayPlayerHand(playerIndex) {
    const player = this.players[playerIndex];
    if (!player.cardsGroup) {
      player.cardsGroup = this.add.group();
    }
    player.cardsGroup.clear(true, true);

    if (this.finishedPlayers.includes(playerIndex)) return;

    const isHuman = (playerIndex === 0);
    const isVertical = (playerIndex === 1 || playerIndex === 3);
    const cardScale = isHuman ? 0.6 : 0.4;
    const spacing = isHuman ? 40 : 15;

    const startX = isVertical ? player.pos.x : player.pos.x - ((player.hand.length - 1) * spacing) / 2;
    const startY = isVertical ? player.pos.y - ((player.hand.length - 1) * spacing) / 2 : player.pos.y;

    player.hand.forEach((cardId, index) => {
      const x = isVertical ? startX : startX + (index * spacing);
      const y = isVertical ? startY + (index * spacing) : startY;
      const frame = isHuman ? cardId : 52;
      const card = this.add.sprite(x, y, 'mycards', frame);
      card.setScale(cardScale);
      if (isVertical) card.setAngle(90);

      if (isHuman) {
        card.setInteractive();
        if (player.selectedIndices.has(index)) {
          card.y -= 30;
        }
        card.on('pointerdown', () => {
          if (this.currentPlayerIndex === 0) {
            if (player.selectedIndices.has(index)) {
              player.selectedIndices.delete(index);
            } else {
              player.selectedIndices.add(index);
            }
            this.displayPlayerHand(0);
            this.updatePlayButtonVisibility();
          }
        });
      }
      player.cardsGroup.add(card);
    });
  }

  // Update the play button state
  updatePlayButtonVisibility() {
    const player = this.players[0];
    const selectedIds = Array.from(player.selectedIndices).map(idx => player.hand[idx]);
    const canPlay = canPlayCards(selectedIds, this.lastPlayedCards, this.isRevolution);
    const isForbidden = isForbiddenFinish(player.hand, selectedIds, this.isRevolution);

    if (this.currentPlayerIndex === 0 && canPlay && !isForbidden) {
      this.playButton.setVisible(true);
    } else {
      this.playButton.setVisible(false);
    }
  }

  handlePlayButtonClick() {
    const player = this.players[0];
    const indices = Array.from(player.selectedIndices).sort((a, b) => b - a);
    this.playCards(0, indices);
    player.selectedIndices.clear();
    this.playButton.setVisible(false);
  }

  // Advance the turn
  nextTurn() {
    this.updatePlayerUI();

    if (this.finishedPlayers.length >= 3) {
      const lastIdx = this.players.findIndex((_, i) => !this.finishedPlayers.includes(i));
      if (lastIdx !== -1 && !this.finishedPlayers.includes(lastIdx)) this.finishedPlayers.push(lastIdx);
      this.updatePlayerUI();

      const rankNames = ["G.Millionaire", "Millionaire", "Poor", "V.Poor"];
      this.finishedPlayers.forEach((pIdx, i) => {
        const p = this.players[pIdx];
        p.rank = i;
        if (i === 0) p.totalDaifugo++;
        else if (i === 1) p.totalFugo++;
        else if (i === 2) p.totalHinmin++;
        else if (i === 3) p.totalDaihinmin++;
      });

      // Create the UI container for the result screen
      this.resultUI = this.add.container(0, 0).setDepth(300);

      // Darken the background
      const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.90);
      this.resultUI.add(overlay);

      // CURRENT GAME RESULT section
      this.resultUI.add(this.add.text(400, 60, '--- CURRENT GAME RESULT ---', { fontSize: '24px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5));

      const fontSizes = ['42px', '32px', '24px', '20px'];
      const colors = ['#ffcc00', '#99ff33', '#0080ff', '#808080'];

      this.finishedPlayers.forEach((pIdx, i) => {
        const p = this.players[pIdx];
        const yPos = 135 + i * 55;

        // Rank icon
        const icon = this.add.image(280, yPos, `rank_icon_${i}`).setScale(0.5);
        this.resultUI.add(icon);

        // Rank name + player name
        const rankText = this.add.text(320, yPos, `${rankNames[i]} : ${p.name}`, {
          fontSize: fontSizes[i],
          color: colors[i],
          fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.resultUI.add(rankText);
      });

      // CUMULATIVE STATS section (table format)
      this.resultUI.add(this.add.text(400, 365, '--- CUMULATIVE STATS ---', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5));

      let table = " +--------------+--------+--------+--------+--------+-----+\n";
      table += " | NAME         | G.MIL  |  MIL.  |  POOR  | V.POOR | REV |\n";
      table += " +--------------+--------+--------+--------+--------+-----+\n";
      this.players.forEach(p => {
        const n = p.name.padEnd(12).substring(0, 12);
        const df = String(p.totalDaifugo).padStart(6);
        const f = String(p.totalFugo).padStart(6);
        const h = String(p.totalHinmin).padStart(6);
        const dh = String(p.totalDaihinmin).padStart(6);
        const rv = String(p.revolutionCount).padStart(3);
        table += ` | ${n} | ${df} | ${f} | ${h} | ${dh} | ${rv} |\n`;
      });
      table += " +--------------+--------+--------+--------+--------+-----+";

      const tableText = this.add.text(400, 450, table, {
        fontSize: '15px',
        fontFamily: 'monospace',
        color: '#ffffff',
        lineSpacing: 2
      }).setOrigin(0.5);
      this.resultUI.add(tableText);

      // Place the Next Game button independently
      const nextBtn = this.add.text(400, 550, ' START NEXT GAME ', {
        fontSize: '26px',
        color: '#ffffff',
        backgroundColor: '#27ae60',
        padding: { x: 20, y: 10 },
        fontStyle: 'bold'
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.startNewGame(false));
      this.resultUI.add(nextBtn);

      return;
    }

    const nextIndex = (this.currentPlayerIndex + 1) % 4;
    if (this.lastPlayerToPlayIndex !== null && nextIndex === this.lastPlayerToPlayIndex) {
      this.time.delayedCall(1000, () => {
        if (this.roundRevolutionCount % 2 !== 0) {
          this.isRevolution = !this.isRevolution;
          const revMsg = this.isRevolution ? "REVOLUTION!" : "REVOLUTION OVER";
          const revText = this.add.text(400, 215, revMsg, { fontSize: '48px', color: '#e74c3c' }).setOrigin(0.5).setDepth(100).setAlpha(1).setStroke('#000', 4);
          this.tweens.add({ targets: revText, alpha: 0, duration: 1500, delay: 1000, onComplete: () => revText.destroy() });
        }
        this.roundRevolutionCount = 0;
        this.fieldGroup.clear(true, true);
        this.lastPlayedCards = [];
        this.lastPlayerToPlayIndex = null;
        this.passedPlayers.clear();
        this.currentPlayerIndex = nextIndex;
        while (this.finishedPlayers.includes(this.currentPlayerIndex)) {
          this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
        }
        this.processTurn();
      });
      return;
    }

    this.currentPlayerIndex = nextIndex;
    this.processTurn();
  }

  // Process the current turn
  processTurn() {
    if (this.passedPlayers.has(this.currentPlayerIndex) || this.finishedPlayers.includes(this.currentPlayerIndex)) {
      this.nextTurn();
      return;
    }

    this.highlightCurrentPlayer();
    this.updatePlayerUI();

    const currentPlayer = this.players[this.currentPlayerIndex];
    this.passButton.setVisible(!currentPlayer.isCPU && this.lastPlayedCards.length > 0);
    if (!currentPlayer.isCPU) {
      this.updatePlayButtonVisibility();
    }

    if (currentPlayer.isCPU && currentPlayer.hand.length > 0) {
      this.time.delayedCall(1000, () => {
        const foundIndices = getCPUMove(currentPlayer, this.players, this.finishedPlayers, this.lastPlayedCards, this.isRevolution, this.playedCardsMemory);
        if (foundIndices) {
          this.playCards(this.currentPlayerIndex, foundIndices.sort((a, b) => b - a));
        } else {
          this.passTurn(this.currentPlayerIndex);
        }
      });
    }
  }

  // Pass the turn
  passTurn(playerIndex) {
    console.log(`${this.players[playerIndex].name} passed`);
    this.passedPlayers.add(playerIndex);
    this.passButton.setVisible(false);
    this.nextTurn();
  }

  // Play cards onto the field
  playCards(playerIndex, cardIndices) {
    const player = this.players[playerIndex];
    const playedIds = cardIndices.map(idx => player.hand.splice(idx, 1)[0]);

    if (playedIds.length >= 4 && isSameNumber(playedIds)) {
      this.roundRevolutionCount++;
      player.revolutionCount++;
    }

    this.lastPlayedCards = playedIds;
    this.lastPlayerToPlayIndex = playerIndex;
    playedIds.forEach(id => { this.playedCardsMemory[id] = true; });

    if (player.hand.length === 0) {
      if (!this.finishedPlayers.includes(playerIndex)) {
        this.finishedPlayers.push(playerIndex);
      }
    }

    this.fieldGroup.clear(true, true);
    playedIds.forEach((id, i) => {
      const cardSprite = this.add.sprite(player.pos.x, player.pos.y, 'mycards', id);
      cardSprite.setScale(0.6);
      this.fieldGroup.add(cardSprite);
      this.tweens.add({
        targets: cardSprite,
        x: 400 - (i - (playedIds.length - 1) / 2) * 30,
        y: 265,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          if (i === playedIds.length - 1) this.nextTurn();
        }
      });
    });
  }

  // Update the UI for each player
  updatePlayerUI() {
    this.playerTexts.forEach(text => text.destroy());
    this.playerTexts = [];
    this.playerRankIcons.forEach(icon => icon.destroy());
    this.playerRankIcons = [];

    // Update revolution display and background color
    if (this.revolutionText) {
      this.revolutionText.destroy();
      this.revolutionText = null;
    }
    if (this.revolutionIcon) {
      this.revolutionIcon.destroy();
      this.revolutionIcon = null;
    }

    if (this.isRevolution) {
      this.cameras.main.setBackgroundColor('#3d1414');

      // Display the revolution text in the upper-left corner
      this.revolutionText = this.add.text(30, 10, '★ REVOLUTION ★', {
        fontSize: '22px',
        color: '#ff4d4d',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      });

      // Display the revolution icon in the upper-right corner (assets/revolution_icon.png)
      this.revolutionIcon = this.add.image(150, 65, 'revolution_icon').setScale(0.5).setOrigin(1, 0.5);
    } else {
      this.cameras.main.setBackgroundColor('#1a1a2e');
    }

    this.players.forEach((player, index) => {
      const rankNames = ["G.Millionaire", "Millionaire", "Poor", "V.Poor", "Commoner"];
      let rankDisplay = rankNames[player.rank] !== undefined ? rankNames[player.rank] : "Commoner";
      let textContent = `${player.name}\n${rankDisplay}`;
      let textColor = '#ffffff';

      const finishedRank = this.finishedPlayers.indexOf(index);
      if (finishedRank !== -1) {
        const rankNames = ["G.Millionaire", "Millionaire", "Poor", "V.Poor"];
        textContent = `${player.name}\nFinished\n${rankNames[finishedRank] || 'Done'}`;
        textColor = '#00ff00';
      } else {
        if (this.passedPlayers.has(index)) {
          textContent += '\n[PASS]';
          textColor = '#ff0000';
        }
      }

      const isVertical = (index === 1 || index === 3);
      let textX = player.pos.x;
      let textY = player.pos.y;

      if (isVertical) {
        textY -= 130;
      } else if (index === 2) {
        // CPU 2 (slightly lower so the icon does not get clipped off-screen)
        textY -= 65;
      } else {
        // Player
        textY -= 80;
      }

      const playerText = this.add.text(textX, textY, textContent, {
        align: 'center',
        fontSize: '16px',
        color: textColor
      }).setOrigin(0.5);
      this.playerTexts.push(playerText);

      // Display the rank icon
      const rankIndex = typeof player.rank === 'number' ? player.rank : 4;
      const rankIcon = this.add.image(0, 0, `rank_icon_${rankIndex}`).setScale(0.4);

      if (isVertical) {
        // CPU 1, CPU 3 (positioned on the left)
        rankIcon.x = textX - (playerText.width / 2) - 25;
        rankIcon.y = textY;
      } else {
        // Player, CPU 2 (positioned above)
        rankIcon.x = textX;
        rankIcon.y = textY - (playerText.height / 2) - 20;
      }
      this.playerRankIcons.push(rankIcon);

      this.displayPlayerHand(index);
    });
  }

  // Highlight the current player
  highlightCurrentPlayer() {
    if (this.currentTurnIndicator) {
      this.currentTurnIndicator.destroy();
    }
    const currentPlayer = this.players[this.currentPlayerIndex];
    const textX = currentPlayer.pos.x;
    const isVertical = (this.currentPlayerIndex === 1 || this.currentPlayerIndex === 3);

    let textY;
    if (isVertical) {
      textY = currentPlayer.pos.y - 160;
    } else if (this.currentPlayerIndex === 2) {
      // CPU 2: place the turn indicator below the player info/cards to avoid clipping at the top of the screen
      textY = currentPlayer.pos.y + 55;
    } else {
      // Player: place the turn indicator higher to avoid overlapping the rank icon
      textY = currentPlayer.pos.y - 160;
    }

    this.currentTurnIndicator = this.add.text(textX, textY, '◀ YOUR TURN ▶', {
      fontSize: '18px',
      color: '#ffeb3b',
      backgroundColor: '#333333',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
  }

  handleOrientation() {
    if (this.scale.isPortrait) {
      if (!this.portraitOverlay) {
        this.portraitOverlay = this.add.container(0, 0).setDepth(1000);
        const bg = this.add.rectangle(400, 300, 800, 600, 0x111122, 0.95);
        const warningText = this.add.text(400, 300, "Please rotate your device\nto landscape mode", {
          fontSize: '24px',
          color: '#ffeb3b',
          align: 'center',
          fontStyle: 'bold',
          lineSpacing: 10
        }).setOrigin(0.5);
        this.portraitOverlay.add([bg, warningText]);
      }
    } else {
      if (this.portraitOverlay) {
        this.portraitOverlay.destroy();
        this.portraitOverlay = null;
      }
    }
  }
}