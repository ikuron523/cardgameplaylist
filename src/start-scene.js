import * as Phaser from 'phaser';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
    this.portraitOverlay = null;
  }

  create() {
    // Display the title
    this.add.text(400, 150, 'Card Game Playlist', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Button to enter Daifugo
    this.add.text(400, 290, 'Daifugo (Millionaire)', {
      fontSize: '26px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.scene.start('DaifugoScene'));

    // Button to enter Sevens
    this.add.text(400, 360, 'Sevens (Fan Tan)', {
      fontSize: '26px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.scene.start('SevensScene'));

    // Button to enter Solitaire
    this.add.text(400, 430, 'Solitaire', {
      fontSize: '26px',
      color: '#ffffff',
      backgroundColor: '#27ae60',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.scene.start('SolitaireScene'));

    // Add orientation change monitoring
    this.scale.on('orientationchange', this.handleOrientation, this);
    this.events.once('shutdown', () => {
      this.scale.off('orientationchange', this.handleOrientation, this);
    });
    this.handleOrientation();
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