/**
 * Bot AI for single-player mode
 */
import { triggerMockEvent } from "./socket";

// Default bot names
const BOT_NAMES = [
  "Splatter",
  "BullsEye",
  "ChromeDome",
  "Quickdraw",
  "Trigger",
  "Maverick",
  "DeadEye",
  "Blaster",
  "Phantom",
  "Rogue",
  "Ranger",
  "Sniper",
];

// Bot state
let bots = {};
let updateInterval = null;

/**
 * Initialize bots for single-player mode
 * @param {number} count Number of bots to create
 * @param {Object} options Bot options
 */
export const initializeBots = (count = 2, options = {}) => {
  // Clear existing bots
  stopBots();
  bots = {};

  const { redTeamCount, blueTeamCount } = calculateTeamDistribution(count);

  console.log(
    `Initializing ${count} bots (${redTeamCount} red, ${blueTeamCount} blue)`
  );

  // Create red team bots
  for (let i = 0; i < redTeamCount; i++) {
    const name = options.botNames?.[i] || getRandomBotName();
    const bot = createBot({
      name: `${name}`,
      team: "Red",
      position: getRandomPosition("Red"),
      ...options,
    });
    bots[bot.id] = bot;
  }

  // Create blue team bots
  for (let i = 0; i < blueTeamCount; i++) {
    const name = options.botNames?.[i + redTeamCount] || getRandomBotName();
    const bot = createBot({
      name: `${name}`,
      team: "Blue",
      position: getRandomPosition("Blue"),
      ...options,
    });
    bots[bot.id] = bot;
  }

  // Start bot movement updates
  startBotUpdates();

  return Object.values(bots);
};

/**
 * Create a single bot
 * @param {Object} options Bot options
 * @returns {Object} Bot object
 */
export const createBot = ({
  name = getRandomBotName(),
  team = Math.random() > 0.5 ? "Red" : "Blue",
  position = getRandomPosition(team),
  health = 100,
  skill = "medium", // "easy", "medium", "hard"
}) => {
  const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const bot = {
    id: botId,
    name,
    team,
    position,
    rotation: [0, 0, 0],
    health,
    isBot: true,
    skill,
    lastUpdateTime: Date.now(),
    target: null,
    state: "patrol", // patrol, attack, defend, retreat
    waypoint: getRandomWaypoint(team),
    shootCooldown: 0,
  };

  return bot;
};

/**
 * Start bot update interval
 */
export const startBotUpdates = () => {
  if (updateInterval) return;

  const UPDATE_INTERVAL = 100; // ms

  updateInterval = setInterval(() => {
    updateBots();
  }, UPDATE_INTERVAL);
};

/**
 * Stop bot updates
 */
export const stopBots = () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
};

/**
 * Update all bots positions and actions
 */
function updateBots() {
  const now = Date.now();
  const updatedPositions = {};

  // Update each bot
  Object.values(bots).forEach((bot) => {
    const timeDelta = now - bot.lastUpdateTime;

    // Update bot state based on simple AI
    updateBotState(bot);

    // Move bot based on current state
    updateBotPosition(bot, timeDelta / 1000);

    // Update shooting logic
    if (bot.shootCooldown > 0) {
      bot.shootCooldown -= timeDelta;
    }

    // Track updated position for broadcast
    updatedPositions[bot.id] = {
      position: bot.position,
      rotation: bot.rotation,
      name: bot.name,
      team: bot.team,
      isBot: true,
    };

    bot.lastUpdateTime = now;
  });

  // Broadcast position updates if any bots were updated
  if (Object.keys(updatedPositions).length > 0) {
    triggerMockEvent("players", updatedPositions);
  }
}

/**
 * Update bot state based on simple AI rules
 * @param {Object} bot Bot object to update
 */
function updateBotState(bot) {
  // Simple state machine:
  // 1. If health is low, retreat to base
  // 2. If at flag, try to capture
  // 3. If has flag, return to base
  // 4. Otherwise patrol between waypoints

  // For now, just randomly change state occasionally
  if (Math.random() < 0.01) {
    const states = ["patrol", "attack", "defend"];
    bot.state = states[Math.floor(Math.random() * states.length)];

    // Set a new waypoint when changing to patrol
    if (bot.state === "patrol") {
      bot.waypoint = getRandomWaypoint(bot.team);
    }
  }

  // If reached waypoint, set a new one
  const distToWaypoint = distance(bot.position, bot.waypoint);
  if (distToWaypoint < 5) {
    bot.waypoint = getRandomWaypoint(bot.team);
  }
}

/**
 * Update bot position based on current state and target
 * @param {Object} bot Bot to update
 * @param {number} deltaTime Time since last update in seconds
 */
function updateBotPosition(bot, deltaTime) {
  const moveSpeed = 5; // units per second

  // Calculate movement vector towards waypoint
  const moveVector = [
    bot.waypoint[0] - bot.position[0],
    0, // Bots don't fly
    bot.waypoint[2] - bot.position[2],
  ];

  // Normalize vector
  const length = Math.sqrt(
    moveVector[0] * moveVector[0] + moveVector[2] * moveVector[2]
  );

  if (length > 0) {
    moveVector[0] /= length;
    moveVector[2] /= length;
  }

  // Update position based on movement vector and speed
  bot.position = [
    bot.position[0] + moveVector[0] * moveSpeed * deltaTime,
    bot.position[1],
    bot.position[2] + moveVector[2] * moveSpeed * deltaTime,
  ];

  // Update rotation to face movement direction
  if (length > 0) {
    const angle = Math.atan2(moveVector[0], moveVector[2]);
    bot.rotation = [0, angle, 0];
  }
}

/**
 * Get a random bot name
 * @returns {string} Random bot name
 */
function getRandomBotName() {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

/**
 * Get a random position for the specified team
 * @param {string} team Team name
 * @returns {Array} [x, y, z] position
 */
function getRandomPosition(team) {
  const baseZ = team === "Red" ? -110 : 110;

  return [
    Math.random() * 60 - 30, // x: -30 to 30
    2, // y: standing on ground
    baseZ + (Math.random() * 20 - 10), // z: offset from base
  ];
}

/**
 * Get a random waypoint for the bot to move towards
 * @param {string} team Bot's team
 * @returns {Array} [x, y, z] waypoint position
 */
function getRandomWaypoint(team) {
  // Keep waypoints within a reasonable play area
  // They stay mostly on their half but can venture into the middle

  const teamZ = team === "Red" ? -50 : 50;
  const enemyZ = team === "Red" ? 50 : -50;

  // 70% chance to stay in own territory, 30% to venture toward enemy
  const targetZ = Math.random() < 0.7 ? teamZ : enemyZ;

  return [
    Math.random() * 100 - 50, // x: -50 to 50
    2, // y: on ground
    targetZ + (Math.random() * 60 - 30), // z: team area with some variation
  ];
}

/**
 * Calculate the distance between two positions
 * @param {Array} pos1 First position [x, y, z]
 * @param {Array} pos2 Second position [x, y, z]
 * @returns {number} Distance
 */
function distance(pos1, pos2) {
  return Math.sqrt(
    Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[2] - pos2[2], 2)
  );
}

/**
 * Calculate the number of bots for each team
 * @param {number} totalBots Total number of bots
 * @returns {Object} Object with redTeamCount and blueTeamCount
 */
function calculateTeamDistribution(totalBots) {
  // Ensure even teams if possible
  const redTeamCount = Math.ceil(totalBots / 2);
  const blueTeamCount = totalBots - redTeamCount;

  return { redTeamCount, blueTeamCount };
}
