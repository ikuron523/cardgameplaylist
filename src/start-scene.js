import * as Phaser from 'phaser';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
    this.portraitOverlay = null;
  }

  preload() {
    // Fallback for missing images so the scene still works before images are added
    this.load.on('loaderror', (file) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x333333);
      g.fillRect(0, 0, 512, 512);
      g.fillStyle(0x555555);
      g.fillTriangle(200, 150, 200, 350, 350, 250); // Simple placeholder icon
      g.generateTexture(file.key, 512, 512);
    });

    this.load.image('playlist-cover', 'assets/playlist-cover.png');
    this.load.image('daifugo-icon', 'assets/daifugo-icon.png');
    this.load.image('sevens-icon', 'assets/sevens-icon.png');
    this.load.image('solitaire-icon', 'assets/solitaire-icon.png');
    this.load.audio('uguisu', 'assets/uguisu.mp3');
  }

  create() {
    // Dark background
    this.cameras.main.setBackgroundColor('#121212');

    // Gradient background effect (subtle glow on top)
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x333333, 0x333333, 0x121212, 0x121212, 1, 1, 1, 1);
    gradient.fillRect(0, 0, 800, 300);
    gradient.setAlpha(0.5);

    // --- Header Section ---
    // Playlist Cover Image
    const cover = this.add.image(50, 50, 'playlist-cover').setOrigin(0);
    cover.setDisplaySize(200, 200);

    // Playlist Info Text
    this.add.text(280, 80, 'PLAYLIST', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 2
    });

    this.add.text(280, 100, 'Card Game Playlist', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif'
    });

    this.add.text(280, 160, 'CURATED FOR YOU • 3 GAMES', {
      fontSize: '14px',
      color: '#a0a0a0',
      fontFamily: 'Arial, sans-serif'
    });

    // Play All / Shuffle Button
    const playBtnGroup = this.add.container(310, 220);
    const playCircle = this.add.circle(0, 0, 28, 0x1db954);

    // Play icon (triangle)
    const playTriangle = this.add.triangle(10, 10, -8, -11, -8, 11, 15, 0, 0x000000);
    // Pause icon (two bars), initially hidden
    const pauseBars = this.add.container(0, 0);
    pauseBars.add(this.add.rectangle(-4, 0, 6, 20, 0x000000));
    pauseBars.add(this.add.rectangle(4, 0, 6, 20, 0x000000));
    pauseBars.setVisible(false);

    playBtnGroup.add([playCircle, playTriangle, pauseBars]);

    let isPlayingInfo = false;
    let activeBalloon = null;

    // --- Track List Section ---
    const tracks = [
      { id: 1, key: 'DaifugoScene', title: 'Daifugo', subtitle: 'Trick-taking • Japanese', icon: 'daifugo-icon' },
      { id: 2, key: 'SevensScene', title: 'Sevens', subtitle: 'Shedding • Parliament', icon: 'sevens-icon' },
      { id: 3, key: 'SolitaireScene', title: 'Solitaire', subtitle: 'Single Player • Classic', icon: 'solitaire-icon' }
    ];

    const tracksData = [];
    let startY = 300;
    tracks.forEach((track, index) => {
      const row = this.createTrackRow(track, 50, startY + (index * 70));
      tracksData.push({ track, rowGroup: row });
    });

    playBtnGroup.setSize(56, 56)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => playCircle.setFillStyle(0x1ed760))
      .on('pointerout', () => playCircle.setFillStyle(0x1db954))
      .on('pointerdown', () => {
        if (isPlayingInfo) {
          // Stop currently playing music and sequence
          isPlayingInfo = false;
          playTriangle.setVisible(true);
          pauseBars.setVisible(false);
          if (this.currentMusic) {
            this.currentMusic.stop();
          }
          if (activeBalloon) {
            this.tweens.killTweensOf(activeBalloon);
            activeBalloon.destroy();
            activeBalloon = null;
          }
          return;
        }
        isPlayingInfo = true;

        playTriangle.setVisible(false);
        pauseBars.setVisible(true);

        this.currentMusic = this.sound.add('uguisu');
        this.currentMusic.play();

        const descriptions = [
          "Daifugo (Millionaire)\nGoal: Be the first to get rid of all cards!\nClassic card game with strategies like revolutions and escapes.",
          "Sevens\nArrange cards in ascending/descending order of 7.\nA psychological game where you can block opponents by using pass effectively.",
          "Solitaire (Klondike)\nClassic single player game.\nArrange cards in order of color and number\nAim for full clearing!"
        ];

        // Sequence timing (42s total -> 14s each)
        const durationPerBalloon = 14000;

        const showBalloon = (index) => {
          if (index >= tracksData.length) return;

          const yPos = tracksData[index].rowGroup.y;

          // Create balloon
          const balloon = this.add.container(250, yPos - 20); // Align to the left/center of the row
          const bg = this.add.graphics();
          bg.fillStyle(0xffffff, 0.95);
          bg.fillRoundedRect(-150, -45, 300, 75, 10);
          bg.fillTriangle(-20, 30, 20, 30, 0, 45); // Pointing down

          const text = this.add.text(0, -8, descriptions[index], {
            fontSize: '13px', color: '#121212', align: 'center', wordWrap: { width: 280 }
          }).setOrigin(0.5);

          balloon.add([bg, text]);
          balloon.setAlpha(0);
          activeBalloon = balloon;

          this.tweens.add({
            targets: balloon,
            alpha: { from: 0, to: 1 },
            duration: 500,
            yoyo: true,
            hold: durationPerBalloon - 1000,
            onComplete: () => {
              if (activeBalloon === balloon && isPlayingInfo) {
                balloon.destroy();
                activeBalloon = null;
                showBalloon(index + 1);
              }
            }
          });
        };

        showBalloon(0);

        this.currentMusic.once('complete', () => {
          if (!isPlayingInfo) return;
          isPlayingInfo = false;
          playTriangle.setVisible(true);
          pauseBars.setVisible(false);
          if (activeBalloon) {
            activeBalloon.destroy();
            activeBalloon = null;
          }
        });
      });

    // Divider Line
    const line = this.add.graphics();
    line.lineStyle(1, 0x333333, 1);
    line.beginPath();
    line.moveTo(50, 280);
    line.lineTo(750, 280);
    line.strokePath();

    // Add orientation change monitoring
    this.scale.on('orientationchange', this.handleOrientation, this);
    this.events.once('shutdown', () => {
      this.scale.off('orientationchange', this.handleOrientation, this);
    });
    this.handleOrientation();
  }

  createTrackRow(track, x, y) {
    const rowGroup = this.add.container(x, y);

    // Hit area for the row
    const bg = this.add.rectangle(350, 25, 700, 60, 0xffffff, 0).setInteractive({ useHandCursor: true });

    // Number
    const numText = this.add.text(10, 25, track.id.toString(), { fontSize: '16px', color: '#b3b3b3' }).setOrigin(0.5);

    // Icon
    const icon = this.add.image(40, 25, track.icon).setOrigin(0.5);
    icon.setDisplaySize(40, 40);

    // Title & Subtitle
    const titleText = this.add.text(80, 10, track.title, { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' });
    const subText = this.add.text(80, 32, track.subtitle, { fontSize: '14px', color: '#b3b3b3' });

    // Play icon on hover (right side)
    const playHover = this.add.triangle(670, 25, -6, -8, -6, 8, 8, 0, 0xffffff).setAlpha(0);

    rowGroup.add([bg, numText, icon, titleText, subText, playHover]);

    // Interactions
    bg.on('pointerover', () => {
      bg.setFillStyle(0xffffff, 0.1);
      numText.setAlpha(0);
      playHover.setAlpha(1);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0xffffff, 0);
      numText.setAlpha(1);
      playHover.setAlpha(0);
    });

    bg.on('pointerdown', () => {
      this.scene.start(track.key);
    });

    return rowGroup;
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