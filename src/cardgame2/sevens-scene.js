// Sevens (Fan Tan) scene
import * as Phaser from 'phaser';
import { computeFieldState, createShuffledDeck, getFieldPosition as getFieldPositionForCard, getRank as getRankForCard, getSuit as getSuitForCard, isSeven as isSevenCard, isCardPlayable as isCardPlayableInField } from './card-utils.js';
import { findFirstPlayableIndex } from './cpu-strategy.js';
import { createTextButton, showToast } from './common-utils.js';
import { canPlayerPass, createInitialPlayers, findNextActivePlayer, getDiamondSevenOwner, resetPlayersForNewRound, updateCumulativeResults } from './game-state.js';
import { createResultUI } from './result-ui.js';
import { showHelpModal } from '../common/help-modal.js';
import helpMarkdown from './sevens-help.md?raw';

const CARD_BACK_FRAME = 52;
const CLOCKWISE_ORDER = [0, 1, 2, 3];
const MAX_PASS_COUNT = 4;

export class SevensScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SevensScene' });
    this.players = [];
    this.fieldGroup = null;
    this.labelGroup = null;
    this.portraitOverlay = null;
    this.currentTurnIndex = 0;
    this.fieldState = [null, null, null, null];
    // Tracks cardIds that were played normally (by active turns)
    this.fieldPlays = new Set();
    // Tracks cardIds that were placed when a player retired (should not
    // immediately count toward legal sequence until connected)
    this.retiredPlays = new Set();
    this.resultUI = null;
    this.finishedPlayers = [];
    this.gameOver = false;
    this.passButton = null;
    this.turnText = null;
  }

  preload() {
    this.load.spritesheet('mycards', 'assets/mycards.png', {
      frameWidth: 100,
      frameHeight: 160,
      margin: 1,
      spacing: 0
    });
    this.load.image('sevens_rank_1', 'assets/sevens_rank_1.png');
    this.load.image('sevens_rank_2', 'assets/sevens_rank_2.png');
    this.load.image('sevens_rank_3', 'assets/sevens_rank_3.png');
    this.load.image('sevens_rank_4', 'assets/sevens_rank_4.png');
    this.load.image('sevens_eliminated', 'assets/sevens_eliminated.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#452010');

    this.add.text(70, 20, 'Sevens\n(Fan Tan)', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(700, 30, 'Back to Menu', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 20, y: 10 }
    })
      .setOrigin(0.5)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('StartScene'));

    // Help Button
    this.add.text(20, 580, 'Help', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2980b9',
      padding: { x: 10, y: 3 }
    })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => showHelpModal(this, helpMarkdown));

    this.fieldGroup = this.add.group();
    this.labelGroup = this.add.group();

    this.passButton = createTextButton(this, 100, 530, 'PASS', {
      backgroundColor: '#c0392b',
      padding: { x: 16, y: 10 }
    }).on('pointerdown', () => this.handlePlayerPass());

    this.turnText = this.add.text(400, 30, '', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.scale.on('orientationchange', this.handleOrientation, this);
    this.events.once('shutdown', () => {
      this.scale.off('orientationchange', this.handleOrientation, this);
    });
    this.handleOrientation();

    this.players = createInitialPlayers();

    const deck = Phaser.Utils.Array.NumberArray(0, 51);
    Phaser.Utils.Array.Shuffle(deck);
    this.dealCards(deck);

    this.displayPlayerHands();
    this.playInitialSevens();
  }

  dealCards(deck) {
    for (let i = 0; i < deck.length; i++) {
      const playerIndex = i % 4;
      this.players[playerIndex].hand.push(deck[i]);
    }

    this.players.forEach(player => {
      player.hand.sort((a, b) => a - b);
    });
  }

  getSuit(cardId) {
    return getSuitForCard(cardId);
  }

  getRank(cardId) {
    return getRankForCard(cardId);
  }

  isSeven(cardId) {
    return isSevenCard(cardId);
  }

  getFieldPosition(suit, rank) {
    return getFieldPositionForCard(suit, rank);
  }

  getDiamondSevenOwner() {
    return getDiamondSevenOwner(this.players);
  }

  playInitialSevens() {
    this.fieldState = [null, null, null, null];
    this.fieldPlays.clear();
    this.retiredPlays.clear();
    this.finishedPlayers = [];
    this.gameOver = false;
    this.players.forEach(player => {
      player.finished = false;
      player.eliminated = false;
      player.passCount = 0;
    });

    const ownerIndex = this.getDiamondSevenOwner();
    this.currentTurnIndex = ownerIndex >= 0 ? ownerIndex : 0;

    const moveDuration = 400;
    let animationCount = 0;

    this.players.forEach((player, playerIndex) => {
      const sevens = [];
      player.hand.forEach((cardId, cardIndex) => {
        if (this.isSeven(cardId)) {
          sevens.push({ cardId, cardIndex });
        }
      });

      sevens.reverse().forEach(({ cardId, cardIndex }) => {
        const cardSprite = player.cardSprites?.[cardIndex];
        if (cardSprite) {
          player.cardsGroup.remove(cardSprite, true, true);
        }
        player.hand.splice(cardIndex, 1);
        this.updateFieldState(cardId);

        const startX = cardSprite ? cardSprite.x : player.pos.x;
        const startY = cardSprite ? cardSprite.y : player.pos.y;
        const target = this.getFieldPosition(this.getSuit(cardId), this.getRank(cardId));
        const movingCard = this.add.sprite(startX, startY, 'mycards', cardId).setScale(0.45).setAngle(0);
        this.fieldGroup.add(movingCard);
        animationCount += 1;

        this.tweens.add({
          targets: movingCard,
          x: target.x,
          y: target.y,
          duration: moveDuration,
          ease: 'Power2',
          onComplete: () => {
            animationCount -= 1;
            if (animationCount === 0) {
              this.displayPlayerHands();
              this.updateTurnText();
              if (this.currentTurnIndex !== 0) {
                this.time.delayedCall(600, () => this.processTurn());
              }
            }
          }
        });
      });

      if (player.hand.length === 0 && !player.finished && !player.eliminated) {
        player.finished = true;
        this.finishedPlayers.push(playerIndex);
      }
    });

    if (animationCount === 0) {
      this.displayPlayerHands();
      this.updateTurnText();
      if (this.currentTurnIndex !== 0) {
        this.time.delayedCall(600, () => this.processTurn());
      }
    }
  }

  updateFieldState(cardId, active = true) {
    if (active) {
      this.fieldPlays.add(cardId);
    } else {
      this.retiredPlays.add(cardId);
    }
    this.recomputeFieldState();
  }

  recomputeFieldState() {
    this.fieldState = computeFieldState(this.fieldPlays, this.retiredPlays);
  }

  isCardPlayable(cardId) {
    return isCardPlayableInField(cardId, this.fieldState);
  }

  displayPlayerHands() {
    this.labelGroup.clear(true, true);

    this.players.forEach((player, index) => {
      if (!player.cardsGroup) {
        player.cardsGroup = this.add.group();
      }
      player.cardsGroup.clear(true, true);
      player.cardSprites = [];

      const isHorizontal = (index === 0 || index === 2);
      const spacing = player.isCPU ? 30 : 40;
      const scale = player.isCPU ? 0.45 : 0.6;
      const count = player.hand.length;
      const startX = isHorizontal ? player.pos.x - ((count - 1) * spacing) / 2 : player.pos.x;
      const startY = isHorizontal ? player.pos.y : player.pos.y - ((count - 1) * spacing) / 2;

      player.hand.forEach((cardId, cardIndex) => {
        const x = isHorizontal ? startX + cardIndex * spacing : player.pos.x;
        const y = isHorizontal ? player.pos.y : startY + cardIndex * spacing;
        const frame = player.isCPU ? CARD_BACK_FRAME : cardId;
        const card = this.add.sprite(x, y, 'mycards', frame).setScale(scale);

        if (!isHorizontal) {
          card.setAngle(90);
        }

        const playable = !player.isCPU && index === this.currentTurnIndex && this.isCardPlayable(cardId);
        if (!player.isCPU && index === this.currentTurnIndex) {
          if (!playable) {
            card.setTint(0x999999);
            card.setAlpha(0.6);
          } else {
            card.setInteractive({ useHandCursor: true });
            card.on('pointerdown', () => this.playCard(index, cardIndex));
          }
        } else if (player.isCPU || index !== this.currentTurnIndex) {
          if (!player.isCPU) {
            card.setTint(0x999999);
            card.setAlpha(0.6);
          }
        }

        card.setData('cardId', cardId);
        card.setData('handIndex', cardIndex);
        player.cardSprites.push(card);
        player.cardsGroup.add(card);
      });

      const labelOffsetY = index === 2 ? -50 : (index === 0 ? -70 : -220);
      const labelOffsetX = index === 1 ? 20 : (index === 3 ? -20 : 0);
      const labelText = player.eliminated ? `${player.name} (OUT)` : `${player.name} (P:${player.passCount})`;
      const isCurrentTurn = index === this.currentTurnIndex && !player.eliminated && player.hand.length > 0;
      const labelStyle = {
        fontSize: '18px',
        color: isCurrentTurn ? '#000000' : '#ffffff',
        align: 'center',
        fontStyle: isCurrentTurn ? 'bold' : 'normal',
        backgroundColor: isCurrentTurn ? '#ffec8b' : undefined,
        padding: isCurrentTurn ? { x: 10, y: 6 } : undefined
      };
      this.labelGroup.add(this.add.text(player.pos.x + labelOffsetX, player.pos.y + labelOffsetY, labelText, labelStyle).setOrigin(0.5));

    });

    this.updateTurnText();
  }

  hasPlayableCard(player) {
    return player.hand.some(cardId => this.isCardPlayable(cardId));
  }

  updateTurnText() {
    // Current turn is highlighted by the player label instead of a separate text.
    this.turnText.setText('');

    const currentPlayer = this.players[this.currentTurnIndex];
    const isHumanTurn = this.currentTurnIndex === 0 && !currentPlayer.eliminated && currentPlayer.hand.length > 0;
    if (!isHumanTurn) {
      this.passButton.setVisible(false);
      return;
    }

    const canPass = canPlayerPass(currentPlayer, this.hasPlayableCard(currentPlayer));
    this.passButton.setVisible(true);
    this.passButton.setAlpha(canPass ? 1 : 0.5);
    if (canPass) {
      this.passButton.setInteractive({ useHandCursor: true });
    } else {
      this.passButton.disableInteractive();
    }
  }

  showToast(message, x = 400, y = 90) {
    showToast(this, message, x, y);
  }

  handlePlayerPass() {
    if (this.currentTurnIndex !== 0) {
      return;
    }

    const player = this.players[0];
    if (!canPlayerPass(player, this.hasPlayableCard(player))) {
      return;
    }
    player.passCount += 1;
    this.showToast(`${player.name} passed! (${Math.min(player.passCount, MAX_PASS_COUNT - 1)}/${MAX_PASS_COUNT - 1})`, player.pos.x, player.pos.y - 80);
    if (player.passCount >= MAX_PASS_COUNT) {
      player.eliminated = true;
      player.eliminations += 1;
      this.showToast(`${player.name} is eliminated!`, player.pos.x, player.pos.y - 80);
      this.retirePlayerCards(player);
    }
    this.nextTurn();
  }

  retirePlayerCards(player) {
    const cardPositions = player.hand.map((cardId, cardIndex) => {
      const sprite = player.cardSprites?.[cardIndex];
      return {
        cardId,
        x: sprite ? sprite.x : player.pos.x,
        y: sprite ? sprite.y : player.pos.y
      };
    });

    if (!player.finished) {
      player.finished = true;
      this.finishedPlayers.push(this.players.indexOf(player));
    }

    if (player.cardsGroup) {
      player.cardsGroup.clear(true, true);
    }

    cardPositions.forEach(({ cardId, x, y }) => {
      const target = this.getFieldPosition(this.getSuit(cardId), this.getRank(cardId));
      const retiringCard = this.add.sprite(x, y, 'mycards', cardId).setScale(0.45).setAngle(0);
      this.fieldGroup.add(retiringCard);
      // Retired cards should be visible on the field. Track them so they
      // can later be merged into legal sequences when connected.
      this.retiredPlays.add(cardId);
      this.tweens.add({
        targets: retiringCard,
        x: target.x,
        y: target.y,
        duration: 350,
        ease: 'Power2'
      });
    });
    // Recompute field sequences after registering retired cards.
    this.recomputeFieldState();

    player.hand = [];
  }

  playCard(playerIndex, cardIndex) {
    const player = this.players[playerIndex];
    const cardId = player.hand[cardIndex];
    if (!this.isCardPlayable(cardId)) {
      return;
    }

    const cardSprite = player.cardSprites?.[cardIndex];
    if (cardSprite) {
      player.cardsGroup.remove(cardSprite, true, true);
    }

    player.hand.splice(cardIndex, 1);
    this.updateFieldState(cardId);

    if (player.hand.length === 0 && !player.finished && !player.eliminated) {
      player.finished = true;
      this.finishedPlayers.push(playerIndex);
    }

    const startX = cardSprite ? cardSprite.x : player.pos.x;
    const startY = cardSprite ? cardSprite.y : player.pos.y;
    const target = this.getFieldPosition(this.getSuit(cardId), this.getRank(cardId));
    const movingCard = this.add.sprite(startX, startY, 'mycards', cardId).setScale(0.45).setAngle(0);
    this.fieldGroup.add(movingCard);

    this.tweens.add({
      targets: movingCard,
      x: target.x,
      y: target.y,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.displayPlayerHands();
        this.nextTurn();
      }
    });
  }

  findFirstPlayableIndex(player) {
    return findFirstPlayableIndex(player, this.fieldState, this.fieldPlays, this.retiredPlays);
  }

  processTurn() {
    const player = this.players[this.currentTurnIndex];
    if (player.eliminated || player.hand.length === 0) {
      this.nextTurn();
      return;
    }

    if (player.isCPU) {
      const playableIndex = this.findFirstPlayableIndex(player);
      if (playableIndex >= 0) {
        this.time.delayedCall(500, () => this.playCard(this.currentTurnIndex, playableIndex));
      } else {
        this.time.delayedCall(500, () => {
          player.passCount += 1;
          this.showToast(`${player.name}\npassed!\n(${Math.min(player.passCount, MAX_PASS_COUNT - 1)}/${MAX_PASS_COUNT - 1})`, player.pos.x, player.pos.y - 20);
          if (player.passCount >= MAX_PASS_COUNT) {
            player.eliminated = true;
            player.eliminations += 1;
            this.showToast(`${player.name}\neliminated!`, player.pos.x, player.pos.y - 40);
            this.retirePlayerCards(player);
          }
          this.nextTurn();
        });
      }
    }
  }

  findNextActivePlayer(fromIndex) {
    return findNextActivePlayer(this.players, fromIndex);
  }

  nextTurn() {
    const nextIndex = this.findNextActivePlayer(this.currentTurnIndex);
    if (nextIndex === null) {
      this.passButton.setVisible(false);
      if (!this.gameOver) {
        this.gameOver = true;
        this.updateCumulativeResults();
        this.showGameResult();
      }
      return;
    }
    this.currentTurnIndex = nextIndex;
    this.displayPlayerHands();
    if (this.currentTurnIndex !== 0) {
      this.processTurn();
    }
  }

  updateCumulativeResults() {
    updateCumulativeResults(this.players, this.finishedPlayers);
  }

  showGameResult() {
    if (this.resultUI) {
      this.resultUI.destroy();
    }
    this.resultUI = createResultUI(this, this.players, this.finishedPlayers, () => this.startNextGame());
  }

  startNextGame() {
    if (this.resultUI) {
      this.resultUI.destroy();
      this.resultUI = null;
    }
    this.fieldGroup.clear(true, true);
    this.labelGroup.clear(true, true);
    resetPlayersForNewRound(this.players);
    this.currentTurnIndex = 0;
    this.fieldState = [null, null, null, null];
    this.fieldPlays.clear();
    this.retiredPlays.clear();
    this.finishedPlayers = [];
    this.gameOver = false;

    const deck = createShuffledDeck();
    this.dealCards(deck);
    this.displayPlayerHands();
    this.playInitialSevens();
  }

  handleOrientation() {
    if (this.scale.isPortrait) {
      if (!this.portraitOverlay) {
        this.portraitOverlay = this.add.container(0, 0).setDepth(1000);
        const bg = this.add.rectangle(400, 300, 800, 600, 0x111122, 0.95);
        const warningText = this.add.text(400, 300, 'Please rotate your device\nto landscape mode', {
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
