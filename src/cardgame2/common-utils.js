export function createTextButton(scene, x, y, text, options = {}) {
  const config = {
    fontSize: '20px',
    color: '#ffffff',
    ...options
  };

  return scene.add.text(x, y, text, config)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
}

export function showToast(scene, message, x = 400, y = 90) {
  const toast = scene.add.text(x, y, message, {
    fontSize: '24px',
    color: '#ffec8b',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: { x: 16, y: 12 },
    align: 'center'
  }).setOrigin(0.5).setDepth(1000).setAlpha(0).setScale(0.85);

  scene.tweens.add({
    targets: toast,
    alpha: 1,
    scale: 1,
    y,
    duration: 180,
    ease: 'Back.easeOut'
  });

  scene.tweens.add({
    targets: toast,
    alpha: 0,
    duration: 400,
    delay: 2000,
    ease: 'Power2',
    onComplete: () => toast.destroy()
  });
}
