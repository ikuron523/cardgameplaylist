import * as Phaser from 'phaser';
import { showHelpModal } from '../common/help-modal.js';
import helpMarkdown from './solitaire-help.md?raw';

// Card back frame number
const CARD_BACK_FRAME = 52;

/**
 * Create a shuffled deck (randomly reorder card IDs from 0-51)
 */
function createShuffledDeck() {
  const deck = Array.from({ length: 52 }, (_, index) => index);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

/**
 * Get the suit from a card ID (0: Spades, 1: Clubs, 2: Hearts, 3: Diamonds)
 */
function getSuit(cardId) {
  return Math.floor(cardId / 13);
}

/**
 * Get the rank from a card ID (1-13)
 */
function getRank(cardId) {
  return (cardId % 13) + 1;
}

export class SolitaireScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SolitaireScene' });
    this.fieldGroup = null;
    this.deck = []; // Shuffled deck
    this.cards = []; // All card sprites
    this.portraitOverlay = null;
    this.foundations = []; // Four foundations (one per suit)
    this.foundationRectangles = []; // Rectangles for foundations
    this.piles = []; // Seven tableau piles (0-6 from left to right)
    this.pileRectangles = []; // Rectangles for piles
    this.deckCards = []; // Remaining cards in the deck as sprites
    this.wastepile = []; // Cards placed in the waste pile as sprites
    this.lastClickCard = null; // Used to detect double-clicks
    this.lastClickTime = 0; // Used to detect double-clicks
    this.gameOver = false; // Used to track win condition
  }

  preload() {
    // Load the card image as a sprite sheet
    this.load.spritesheet('mycards', 'assets/mycards.png', {
      frameWidth: 100,
      frameHeight: 160,
      margin: 1,
      spacing: 0
    });
  }

  create() {
    // Set the background color to green
    this.cameras.main.setBackgroundColor('#2d7a3e');

    // Display the title
    this.add.text(70, 20, 'Solitaire', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Back to menu button
    this.add.text(700, 15, 'Back to Menu', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 5, y: 3 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('StartScene'));

    // Help Button
    this.add.text(150, 20, 'Help', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2980b9',
      padding: { x: 10, y: 3 }
    })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => showHelpModal(this, helpMarkdown));

    // New Game Button
    this.add.text(400, 15, 'Restart', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#df0a31ff',
      padding: { x: 10, y: 3 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart());

    // Create the game field group
    this.fieldGroup = this.add.group();

    // Create the foundation area
    this.createFoundations();

    // Create the tableau pile area
    this.createPiles();

    // Create the shuffled deck
    this.deck = createShuffledDeck();

    // Create the cards (deck, foundations, and piles)
    this.createCards();

    // Register drag-and-drop events
    this.input.on('dragstart', this.handleDragStart, this);
    this.input.on('drag', this.handleDrag, this);
    this.input.on('dragend', this.handleDragEnd, this);

    // Add orientation change monitoring
    this.scale.on('orientationchange', this.handleOrientation, this);
    this.events.once('shutdown', () => {
      this.scale.off('orientationchange', this.handleOrientation, this);
    });
    this.handleOrientation();
  }

  /**
   * Create the foundation area (one per suit)
   */
  createFoundations() {
    this.foundations = [[], [], [], []]; // 0: Spades, 1: Clubs, 2: Hearts, 3: Diamonds
    this.foundationRectangles = [];

    const foundationXPositions = [320, 440, 560, 680];
    const foundationY = 100;
    const cardWidth = 80;
    const cardHeight = 128;

    for (let i = 0; i < 4; i++) {
      // Draw the foundation rectangle (same size as a card)
      const rect = this.add.rectangle(foundationXPositions[i], foundationY, cardWidth, cardHeight);
      rect.setFillStyle(0x1a5c2a, 0.5); // Fill with a light green tint
      rect.setStrokeStyle(2, 0xffffff); // White border

      this.fieldGroup.add(rect);
      this.foundationRectangles.push(rect);
      this.foundations[i] = [];
    }
  }

  /**
   * Create the tableau pile area (seven piles)
   */
  createPiles() {
    this.piles = [[], [], [], [], [], [], []]; // Seven piles
    this.pileRectangles = [];

    const pileXPositions = [60, 160, 260, 360, 460, 560, 660];
    const pileY = 240;
    const cardWidth = 80;
    const cardHeight = 128;

    for (let i = 0; i < 7; i++) {
      // Draw the pile rectangle (same size as a card)
      const rect = this.add.rectangle(pileXPositions[i], pileY, cardWidth, cardHeight);
      rect.setFillStyle(0x1a4d2e, 0.3); // Fill with a lighter green tint
      rect.setStrokeStyle(2, 0xffffff); // White border

      this.fieldGroup.add(rect);
      this.pileRectangles.push(rect);
      this.piles[i] = [];
    }

    console.log('[Solitaire] Created 7 tableau piles');
  }

  /**
   * Create the card sprites
   */
  createCards() {
    this.cards = [];
    this.deckCards = [];
    this.wastepile = [];

    const deckX = 60;
    const deckY = 100;

    // Clickable deck area placeholder (used when the deck is empty)
    const deckRect = this.add.rectangle(deckX, deckY, 80, 128);
    deckRect.setStrokeStyle(2, 0xffffff);
    deckRect.setFillStyle(0x1a4d2e, 0.5);
    deckRect.setInteractive({ useHandCursor: true });
    deckRect.on('pointerdown', () => this.drawFromDeck());
    this.fieldGroup.add(deckRect);
    const pileXPositions = [60, 160, 260, 360, 460, 560, 660];
    const pileY = 240;
    const foundationXPositions = [320, 440, 560, 680];
    const foundationY = 100;
    const cardSpacing = 20; // Overlap spacing for stacked cards

    let deckCardIndex = 0;

    // Place cards into each pile
    for (let pileIdx = 0; pileIdx < 7; pileIdx++) {
      const cardsInPile = pileIdx + 1; // 1, 2, 3, 4, 5, 6, 7

      for (let cardInPileIdx = 0; cardInPileIdx < cardsInPile; cardInPileIdx++) {
        const cardId = this.deck[deckCardIndex];
        const isLastCard = cardInPileIdx === cardsInPile - 1; // The last card in each pile is face up

        // Create the card (starting from the deck)
        const frame = isLastCard ? cardId : CARD_BACK_FRAME;
        const card = this.add.sprite(deckX, deckY, 'mycards', frame);
        card.setDisplaySize(80, 128);
        card.setData('cardId', cardId);
        card.setData('pileIndex', pileIdx);
        card.setData('positionInPile', cardInPileIdx);
        card.setData('faceUp', isLastCard);

        this.fieldGroup.add(card);
        this.cards.push(card);

        // Animate the move with a tween
        const targetX = pileXPositions[pileIdx];
        const targetY = pileY + cardInPileIdx * cardSpacing;
        const delay = deckCardIndex * 50; // Add a staggered delay to each card

        this.tweens.add({
          targets: card,
          x: targetX,
          y: targetY,
          duration: 300,
          delay: delay,
          ease: 'Power2.inOut'
        });

        // Add interaction to the last card in the pile (face up)
        if (isLastCard) {
          this.makeCardInteractive(card);
        }

        this.piles[pileIdx].push(card);
        deckCardIndex++;
      }
    }

    // Place the remaining 24 cards into the deck
    for (let i = deckCardIndex; i < this.deck.length; i++) {
      const cardId = this.deck[i];

      // Deck card
      const card = this.add.sprite(deckX, deckY, 'mycards', CARD_BACK_FRAME);
      card.setDisplaySize(80, 128);
      card.setData('cardId', cardId);
      card.setData('faceUp', false);
      card.setDepth(100 + i);

      this.fieldGroup.add(card);
      this.cards.push(card);
      this.deckCards.push(card);
    }

    console.log(`[Solitaire] Created ${this.cards.length} cards from shuffled deck`);
    console.log(`[Solitaire] Dealt ${deckCardIndex} cards to piles, ${this.deck.length - deckCardIndex} cards in deck`);
  }

  /**
   * Check whether a card can move to a foundation and move it if valid
   */
  tryMoveToFoundation(card, pileIdx, pileXPositions, foundationXPositions, foundationY) {
    const cardId = card.getData('cardId');
    const suit = getSuit(cardId);
    const rank = getRank(cardId);

    // Foundation suit index: 0: Spades, 1: Clubs, 2: Hearts, 3: Diamonds
    const foundation = this.foundations[suit];

    // Check the current last rank in the foundation
    let canMove = false;
    if (foundation.length === 0) {
      // If the foundation is empty, only an Ace (rank 1) can be moved there
      canMove = rank === 1;
    } else {
      // Check the rank of the last card already in the foundation
      const lastCardInFoundation = foundation[foundation.length - 1];
      const lastRank = getRank(lastCardInFoundation.getData('cardId'));
      // The card can move if its rank is one greater than the last one in the foundation
      canMove = rank === lastRank + 1;
    }

    if (canMove) {
      const pileIdx_data = card.getData('pileIndex');

      // Remove the card from its original location
      if (pileIdx_data === 'wastepile') {
        this.wastepile = this.wastepile.filter(c => c !== card);
      } else {
        this.piles[pileIdx_data] = this.piles[pileIdx_data].filter(c => c !== card);
      }

      // Add the card to the foundation
      foundation.push(card);

      // Stop any in-progress tweens such as drag-cancel return animations
      this.tweens.killTweensOf(card);

      // Disable interaction for the previous top card
      if (foundation.length > 1) {
        foundation[foundation.length - 2].disableInteractive();
      }

      // Mark the card as belonging to the foundation
      card.setData('pileIndex', 'foundation_' + suit);

      // Make the new top card interactive
      this.makeCardInteractive(card);

      this.checkWinCondition();

      // If the card is currently registered as being dragged, clear that state
      if (this.draggedCardsInfo && this.draggedCardsInfo.some(info => info.card === card)) {
        this.draggedCardsInfo = null;
      }

      // Animate the move to the foundation position
      card.setDepth(1000 + foundation.length);
      this.tweens.add({
        targets: card,
        x: foundationXPositions[suit],
        y: foundationY,
        duration: 300,
        ease: 'Power2.inOut'
      });

      // Handle the original location
      if (pileIdx_data === 'wastepile') {
        // If cards remain in the waste pile, make the top one interactive
        if (this.wastepile.length > 0) {
          this.makeCardInteractive(this.wastepile[this.wastepile.length - 1]);
        }
        this.layoutWastepile();
      } else {
        // If cards remain in the pile, reveal the last card face up
        if (this.piles[pileIdx_data].length > 0) {
          const newLastCard = this.piles[pileIdx_data][this.piles[pileIdx_data].length - 1];

          // Skip if the card is already face up
          if (!newLastCard.getData('faceUp')) {
            const newCardId = newLastCard.getData('cardId');

            // Change the frame from face-down to face-up
            newLastCard.setFrame(newCardId);
            newLastCard.setData('faceUp', true);

            // Add a scale animation for visual feedback
            this.tweens.add({
              targets: newLastCard,
              scaleX: 1.1,
              scaleY: 1.1,
              duration: 100,
              yoyo: true,
              ease: 'Power1.inOut'
            });

            // Add double-click and drag interaction
            this.makeCardInteractive(newLastCard);

            console.log(`[Solitaire] Flipped card ${newCardId} in pile ${pileIdx_data}`);
          }
        }
      }

      this.checkWinCondition();
      console.log(`[Solitaire] Moved ${card.getData('cardId')} to foundation ${suit}`);
    }
  }

  /**
   * Draw cards from the deck and move them to the waste pile
   */
  drawFromDeck() {
    const deckX = 60;
    const deckY = 100;
    const drawCount = 3; // Draw three cards by default

    // If the deck is empty, flip all cards from the waste pile back to the deck
    if (this.deckCards.length === 0) {
      if (this.wastepile.length === 0) return;

      while (this.wastepile.length > 0) {
        const card = this.wastepile.pop();
        card.setData('faceUp', false);
        card.setFrame(CARD_BACK_FRAME);
        card.setData('pileIndex', null);
        if (card.input) {
          card.disableInteractive();
        }
        this.deckCards.push(card);
        card.setDepth(100 + this.deckCards.length);

        this.tweens.add({
          targets: card,
          x: deckX,
          y: deckY,
          duration: 200
        });
      }
      return;
    }

    // Disable interaction for the current top card in the waste pile
    if (this.wastepile.length > 0) {
      this.wastepile[this.wastepile.length - 1].disableInteractive();
    }

    // Draw cards from the deck
    const countToDraw = Math.min(drawCount, this.deckCards.length);
    const drawnCards = [];
    for (let i = 0; i < countToDraw; i++) {
      drawnCards.push(this.deckCards.pop());
    }

    // Add the drawn cards to the waste pile
    drawnCards.forEach(card => {
      this.wastepile.push(card);
      card.setData('faceUp', true);
      card.setFrame(card.getData('cardId'));
      card.setData('pileIndex', 'wastepile');
    });

    // Make the new top card in the waste pile interactive
    if (this.wastepile.length > 0) {
      this.makeCardInteractive(this.wastepile[this.wastepile.length - 1]);
    }

    this.layoutWastepile();
  }

  layoutWastepile() {
    const wasteX = 160;
    const wasteY = 100;
    const total = this.wastepile.length;

    this.wastepile.forEach((card, index) => {
      // Offset the top three cards by 15px to the right
      const staggerIndex = Math.max(0, 3 - (total - index));
      const offset = staggerIndex * 15;

      card.setDepth(200 + index);

      this.tweens.add({
        targets: card,
        x: wasteX + offset,
        y: wasteY,
        duration: 150,
        ease: 'Power2.out'
      });
    });
  }


  makeCardInteractive(card) {
    card.setInteractive({ useHandCursor: true, draggable: true });

    // Double-click event
    // Turn it off once to prevent duplicate registrations
    card.off('pointerdown');
    card.on('pointerdown', () => {
      if (!this.lastClickCard || this.lastClickCard !== card || Date.now() - this.lastClickTime > 300) {
        this.lastClickCard = card;
        this.lastClickTime = Date.now();
        return;
      }

      const pileIdx = card.getData('pileIndex');
      if (pileIdx === undefined || pileIdx === null) return;

      const pileXPositions = [60, 160, 260, 360, 460, 560, 660];
      const foundationXPositions = [320, 440, 560, 680];
      const foundationY = 100;

      // Cards can move to a foundation only from the top of a pile or the top of the waste pile
      if (pileIdx === 'wastepile') {
        if (this.wastepile.length > 0 && this.wastepile[this.wastepile.length - 1] === card) {
          this.tryMoveToFoundation(card, pileIdx, pileXPositions, foundationXPositions, foundationY);
        }
      } else {
        const pile = this.piles[pileIdx];
        if (pile && pile[pile.length - 1] === card) {
          this.tryMoveToFoundation(card, pileIdx, pileXPositions, foundationXPositions, foundationY);
        }
      }
    });
  }

  handleDragStart(pointer, gameObject) {
    if (!gameObject.getData('faceUp')) return;

    const pileIdx = gameObject.getData('pileIndex');
    if (pileIdx === undefined || pileIdx === null) return;

    let draggedCards = [];

    if (pileIdx === 'wastepile') {
      if (this.wastepile.length === 0 || this.wastepile[this.wastepile.length - 1] !== gameObject) return;
      draggedCards = [gameObject];
    } else if (typeof pileIdx === 'string' && pileIdx.startsWith('foundation_')) {
      const suit = parseInt(pileIdx.split('_')[1], 10);
      const foundation = this.foundations[suit];
      if (foundation.length === 0 || foundation[foundation.length - 1] !== gameObject) return;
      draggedCards = [gameObject];
    } else {
      if (pileIdx < 0 || pileIdx >= 7) return;
      const pile = this.piles[pileIdx];
      const cardIndex = pile.indexOf(gameObject);
      if (cardIndex === -1) return;
      draggedCards = pile.slice(cardIndex);
    }

    // Save the original position and depth
    this.draggedCardsInfo = draggedCards.map(c => ({
      card: c,
      origX: c.x,
      origY: c.y,
      origDepth: c.depth
    }));

    // Bring the dragged cards to the front
    draggedCards.forEach((c, idx) => {
      c.setDepth(2000 + idx);
    });

    // Save the offset from the pointer
    this.dragOffsetX = gameObject.x - pointer.x;
    this.dragOffsetY = gameObject.y - pointer.y;
  }

  handleDrag(pointer, gameObject, dragX, dragY) {
    if (!this.draggedCardsInfo) return;

    // Move all dragged cards together
    const cardSpacing = 20; // Maintain the usual overlap spacing
    this.draggedCardsInfo.forEach((info, idx) => {
      info.card.x = pointer.x + this.dragOffsetX;
      info.card.y = pointer.y + this.dragOffsetY + (idx * cardSpacing);
    });
  }

  handleDragEnd(pointer, gameObject) {
    if (!this.draggedCardsInfo) return;

    const draggedCardsInfo = this.draggedCardsInfo;
    this.draggedCardsInfo = null;

    const mainCard = gameObject;
    const cardId = mainCard.getData('cardId');
    const suit = getSuit(cardId);
    const rank = getRank(cardId);
    const sourcePileIdx = mainCard.getData('pileIndex');

    const pileXPositions = [60, 160, 260, 360, 460, 560, 660];
    const pileY = 240;

    let targetPileIdx = -1;
    // Determine the target pile based on x-position (roughly 80px wide with 100px spacing)
    for (let i = 0; i < 7; i++) {
      if (Math.abs(pointer.x - pileXPositions[i]) < 50) {
        if (pointer.y > 180) { // If the y-position is below the foundation area
          targetPileIdx = i;
          break;
        }
      }
    }

    let isValidMove = false;

    if (targetPileIdx !== -1 && targetPileIdx !== sourcePileIdx) {
      const targetPile = this.piles[targetPileIdx];

      if (targetPile.length === 0) {
        // Only a King (13) can be placed on an empty pile
        if (rank === 13) {
          isValidMove = true;
        }
      } else {
        // If the pile is not empty, check the top card
        const topCard = targetPile[targetPile.length - 1];
        const topCardId = topCard.getData('cardId');
        const topSuit = getSuit(topCardId);
        const topRank = getRank(topCardId);

        const isRed = (s) => s === 2 || s === 3;
        const mainIsRed = isRed(suit);
        const topIsRed = isRed(topSuit);

        // The colors must alternate and the rank must be one less
        if (mainIsRed !== topIsRed && rank === topRank - 1) {
          isValidMove = true;
        }
      }
    }

    if (isValidMove) {
      const targetPile = this.piles[targetPileIdx];
      const cardsToMove = draggedCardsInfo.map(info => info.card);

      // Remove from the original location
      if (sourcePileIdx === 'wastepile') {
        cardsToMove.forEach(c => {
          const idx = this.wastepile.indexOf(c);
          if (idx !== -1) this.wastepile.splice(idx, 1);
        });
      } else if (typeof sourcePileIdx === 'string' && sourcePileIdx.startsWith('foundation_')) {
        const suit = parseInt(sourcePileIdx.split('_')[1], 10);
        const foundation = this.foundations[suit];
        cardsToMove.forEach(c => {
          const idx = foundation.indexOf(c);
          if (idx !== -1) foundation.splice(idx, 1);
        });
      } else {
        const sourcePile = this.piles[sourcePileIdx];
        cardsToMove.forEach(c => {
          const idx = sourcePile.indexOf(c);
          if (idx !== -1) sourcePile.splice(idx, 1);
        });
      }

      // Add to the new pile and update position and depth
      const cardSpacing = 20;
      cardsToMove.forEach((c, idx) => {
        targetPile.push(c);
        c.setData('pileIndex', targetPileIdx);
        c.setData('positionInPile', targetPile.length - 1);

        const targetX = pileXPositions[targetPileIdx];
        const targetY = pileY + (targetPile.length - 1) * cardSpacing;

        c.setDepth(targetPile.length); // Match the depth to the order within the pile

        this.tweens.add({
          targets: c,
          x: targetX,
          y: targetY,
          duration: 150,
          ease: 'Power2.out'
        });
      });

      // Handle the original location
      if (sourcePileIdx === 'wastepile') {
        if (this.wastepile.length > 0) {
          this.makeCardInteractive(this.wastepile[this.wastepile.length - 1]);
        }
        this.layoutWastepile();
      } else if (typeof sourcePileIdx === 'string' && sourcePileIdx.startsWith('foundation_')) {
        const suit = parseInt(sourcePileIdx.split('_')[1], 10);
        const foundation = this.foundations[suit];
        if (foundation.length > 0) {
          this.makeCardInteractive(foundation[foundation.length - 1]);
        }
      } else {
        const sourcePile = this.piles[sourcePileIdx];
        if (sourcePile.length > 0) {
          const newTopCard = sourcePile[sourcePile.length - 1];
          if (!newTopCard.getData('faceUp')) {
            const newCardId = newTopCard.getData('cardId');
            newTopCard.setFrame(newCardId);
            newTopCard.setData('faceUp', true);

            this.tweens.add({
              targets: newTopCard,
              scaleX: 1.1,
              scaleY: 1.1,
              duration: 100,
              yoyo: true,
              ease: 'Power1.inOut'
            });

            this.makeCardInteractive(newTopCard);
          }
        }
      }

      this.checkWinCondition();
    } else {
      // If the move is invalid, return the cards to their original position
      draggedCardsInfo.forEach(info => {
        info.card.setDepth(info.origDepth);
        this.tweens.add({
          targets: info.card,
          x: info.origX,
          y: info.origY,
          duration: 200,
          ease: 'Power2.out'
        });
      });
    }
  }

  /**
   * Handle orientation changes
   */
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

  checkWinCondition() {
    if (this.gameOver) return;

    let isWin = true;
    for (let i = 0; i < 4; i++) {
      if (this.foundations[i].length < 13) {
        isWin = false;
        break;
      }
    }

    if (isWin) {
      this.gameOver = true;
      this.showWinScreen();
    }
  }

  showWinScreen() {
    const winOverlay = this.add.container(0, 0).setDepth(3000);
    const bg = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.6);
    bg.setInteractive(); // block clicks underneath

    const winText = this.add.text(400, 300, 'YOU WIN!', {
      fontSize: '64px',
      color: '#ffeb3b',
      fontStyle: 'bold',
      stroke: '#ff9800',
      strokeThickness: 8,
      shadow: { blur: 10, color: '#000000', fill: true }
    }).setOrigin(0.5);

    const clickText = this.add.text(400, 400, 'Click anywhere to restart', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Rotating effect for YOU WIN
    this.tweens.add({
      targets: winText,
      angle: '+=360',
      duration: 5000,
      repeat: -1,
    });

    winOverlay.add([bg, winText, clickText]);

    // Create a simple particle texture if it doesn't exist
    if (!this.textures.exists('particle')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture('particle', 8, 8);
      g.destroy();
    }

    // Fireworks particles
    const emitter = this.add.particles(0, 0, 'particle', {
      x: { min: 100, max: 700 },
      y: { min: 100, max: 400 },
      speed: { min: 50, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 1500,
      frequency: 100,
      tint: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff],
      blendMode: 'ADD',
      gravityY: 150,
      quantity: 8
    }).setDepth(3001);

    bg.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
