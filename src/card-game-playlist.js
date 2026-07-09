import * as Phaser from 'phaser';
import { StartScene } from './start-scene';
import { DaifugoScene } from './cardgame1/daifugo-scene';
import { SevensScene } from './cardgame2/sevens-scene';
import { SolitaireScene } from './cardgame3/solitaire-scene';

// Phaser game configuration object
// Using type definitions makes autocompletion more helpful
const config = {
  type: Phaser.AUTO,        // Prefer WebGL, fall back to Canvas if unsupported
  backgroundColor: '#1a1a2e',
  parent: 'game-container', // HTML element ID
  scene: [StartScene, DaifugoScene, SevensScene, SolitaireScene], // List of scenes to use
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  }
};

// Launch the game
new Phaser.Game(config);