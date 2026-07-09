export class Player {
  constructor(name, isCPU, x, y, rank = 4, strategy = 'BASIC') {
    this.name = name;
    this.isCPU = isCPU;
    this.pos = { x, y };
    this.rank = rank;
    this.strategy = strategy; // Added: CPU personality (e.g., BASIC, CAUTIOUS)
    this.hand = [];
    this.cardsGroup = null; // Keep a reference to the Phaser group
    this.selectedIndices = new Set(); // Indices of selected hand cards
    this.revolutionCount = 0;    // Total number of revolutions that have occurred
    this.totalDaifugo = 0;       // Total number of times ranked as G.Millionaire
    this.totalFugo = 0;          // Total number of times ranked as Millionaire
    this.totalHinmin = 0;        // Total number of times ranked as Poor
    this.totalDaihinmin = 0;     // Total number of times ranked as V.Poor
  }
}