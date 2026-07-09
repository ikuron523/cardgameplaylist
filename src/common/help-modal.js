export function showHelpModal(scene, helpMarkdown) {
  if (scene.helpOverlay) return;

  scene.helpOverlay = scene.add.container(0, 0).setDepth(2000);

  // Modal Background (semi-transparent)
  const bg = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
  bg.setInteractive(); // block clicks
  scene.helpOverlay.add(bg);

  // Modal Window
  const modalBg = scene.add.rectangle(400, 300, 600, 500, 0x222222, 1);
  modalBg.setStrokeStyle(4, 0xffffff);
  scene.helpOverlay.add(modalBg);

  // Mask for scrolling text
  const maskShape = scene.add.graphics();
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(110, 60, 580, 480);
  const mask = maskShape.createGeometryMask();
  scene.helpOverlay.add(maskShape);

  // Container for text content
  const contentContainer = scene.add.container(0, 0);
  contentContainer.setMask(mask);
  scene.helpOverlay.add(contentContainer);

  // Close Button
  const closeBtn = scene.add.text(665, 50, 'X', {
    fontSize: '24px',
    color: '#ffffff',
    backgroundColor: '#cc0000',
    padding: { x: 10, y: 5 }
  }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
    scene.helpOverlay.destroy();
    scene.helpOverlay = null;
  });
  scene.helpOverlay.add(closeBtn).setDepth(2001);

  // Parse simple markdown
  let y = 80;
  const lines = helpMarkdown.split('\n');
  lines.forEach(line => {
    let fontSize = '18px';
    let fontStyle = 'normal';
    let color = '#000000';
    let text = line;
    let x = 130;

    if (line.startsWith('# ')) {
      fontSize = '28px';
      fontStyle = 'bold';
      color = '#ffcc00';
      text = line.substring(2);
      y += 10;
    } else if (line.startsWith('## ')) {
      fontSize = '22px';
      fontStyle = 'bold';
      color = '#44ccff';
      text = line.substring(3);
      y += 5;
    } else if (line.startsWith('- ')) {
      text = '・' + line.substring(2);
      x = 150;
    }

    if (text.trim() === '') {
      y += 10;
      return;
    }

    const textObj = scene.add.text(x, y, text, {
      fontSize,
      fontStyle,
      color,
      wordWrap: { width: 540 }
    });
    contentContainer.add(textObj);
    y += textObj.height + 8;
  });

  const maxScroll = Math.max(0, y - 540); // 540 is the bottom bound

  // Scroll interaction
  modalBg.setInteractive({ draggable: true });

  modalBg.on('wheel', (pointer, deltaX, deltaY) => {
    let newY = contentContainer.y - deltaY;
    if (newY > 0) newY = 0;
    if (newY < -maxScroll) newY = -maxScroll;
    contentContainer.y = newY;
  });

  modalBg.on('drag', (pointer, dragX, dragY) => {
    let newY = contentContainer.y + (pointer.position.y - pointer.prevPosition.y);
    if (newY > 0) newY = 0;
    if (newY < -maxScroll) newY = -maxScroll;
    contentContainer.y = newY;
  });
}
