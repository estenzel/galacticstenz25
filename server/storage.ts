import { 
  users, type User, type InsertUser, 
  games, type Game, type InsertGame,
  players, type Player, type InsertPlayer,
  definitions, type Definition, type InsertDefinition,
  votes, type Vote, type InsertVote,
  type GameState, PlayerRole
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game methods
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  getGameByCode(code: string): Promise<Game | undefined>;
  updateGamePhase(id: number, phase: number): Promise<Game>;
  updateGameWord(id: number, word: string): Promise<Game>;
  updateGameRound(id: number, round: number): Promise<Game>;
  
  // Player methods
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayerBySessionId(sessionId: string): Promise<Player | undefined>;
  getPlayersByGameId(gameId: number): Promise<Player[]>;
  updatePlayerScore(id: number, scoreIncrement: number): Promise<Player>;
  removePlayer(id: number): Promise<void>;
  
  // Definition methods
  createDefinition(definition: InsertDefinition): Promise<Definition>;
  getDefinitionsByGameId(gameId: number, round: number): Promise<Definition[]>;
  
  // Vote methods
  createVote(vote: InsertVote): Promise<Vote>;
  getVotesByGameId(gameId: number, round: number): Promise<Vote[]>;
  
  // Game state methods
  getGameState(gameId: number, round?: number): Promise<GameState>;
  
  // Round management
  startNewRound(gameId: number): Promise<Game>;
  cancelRound(gameId: number): Promise<Game>;
  clearDefinitionsAndVotesByRound(gameId: number, round: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<number, Game>;
  private players: Map<number, Player>;
  private definitions: Map<number, Definition>;
  private votes: Map<number, Vote>;
  
  private userIdCounter: number;
  private gameIdCounter: number;
  private playerIdCounter: number;
  private definitionIdCounter: number;
  private voteIdCounter: number;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.players = new Map();
    this.definitions = new Map();
    this.votes = new Map();
    
    this.userIdCounter = 1;
    this.gameIdCounter = 1;
    this.playerIdCounter = 1;
    this.definitionIdCounter = 1;
    this.voteIdCounter = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Game methods
  async createGame(game: InsertGame): Promise<Game> {
    const id = this.gameIdCounter++;
    // Ensure all required fields have values
    const newGame: Game = { 
      ...game, 
      id,
      phase: game.phase ?? 1,
      currentWord: game.currentWord ?? null,
      dictionary: game.dictionary ?? true,
      currentRound: game.currentRound ?? 1
    };
    this.games.set(id, newGame);
    return newGame;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getGameByCode(code: string): Promise<Game | undefined> {
    return Array.from(this.games.values()).find(
      (game) => game.code === code,
    );
  }

  async updateGamePhase(id: number, phase: number): Promise<Game> {
    const game = await this.getGame(id);
    if (!game) {
      throw new Error(`Game with id ${id} not found`);
    }
    
    const updatedGame: Game = { ...game, phase };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async updateGameWord(id: number, word: string): Promise<Game> {
    const game = await this.getGame(id);
    if (!game) {
      throw new Error(`Game with id ${id} not found`);
    }
    
    const updatedGame: Game = { ...game, currentWord: word };
    this.games.set(id, updatedGame);
    return updatedGame;
  }
  
  async updateGameRound(id: number, round: number): Promise<Game> {
    const game = await this.getGame(id);
    if (!game) {
      throw new Error(`Game with id ${id} not found`);
    }
    
    const updatedGame: Game = { ...game, currentRound: round };
    this.games.set(id, updatedGame);
    return updatedGame;
  }
  
  async startNewRound(gameId: number): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }
    
    // Increment the round number
    const newRound = (game.currentRound || 1) + 1;
    
    // Reset game to word entry phase and clear current word
    const updatedGame: Game = { 
      ...game, 
      phase: 1, 
      currentWord: "",
      currentRound: newRound
    };
    
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }
  
  async clearDefinitionsAndVotesByRound(gameId: number, round: number): Promise<void> {
    // Find all definitions for this game and round
    const gameDefIds: number[] = [];
    this.definitions.forEach((def, id) => {
      if (def.gameId === gameId && def.round === round) {
        gameDefIds.push(id);
      }
    });
    
    // Remove all matching definitions
    gameDefIds.forEach(id => {
      this.definitions.delete(id);
    });
    
    // Find all votes for this game and round
    const gameVoteIds: number[] = [];
    this.votes.forEach((vote, id) => {
      if (vote.gameId === gameId && vote.round === round) {
        gameVoteIds.push(id);
      }
    });
    
    // Remove all matching votes
    gameVoteIds.forEach(id => {
      this.votes.delete(id);
    });
    
    console.log(`Cleared ${gameDefIds.length} definitions and ${gameVoteIds.length} votes for game ${gameId}, round ${round}`);
  }
  
  async cancelRound(gameId: number): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }
    
    // Get the current round number
    const currentRound = game.currentRound || 1;
    
    // Clear all definitions and votes for this round
    await this.clearDefinitionsAndVotesByRound(gameId, currentRound);
    
    // Reset to word entry phase without changing the round number
    const updatedGame: Game = { 
      ...game, 
      phase: 1, 
      currentWord: ""
    };
    
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  // Player methods
  async createPlayer(player: InsertPlayer): Promise<Player> {
    const id = this.playerIdCounter++;
    const newPlayer: Player = { 
      ...player, 
      id, 
      score: 0,
      role: player.role || PlayerRole.PLAYER, // Use the enum for consistency
      isAdmin: player.isAdmin ?? false,
      isSpectator: player.isSpectator ?? false
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayerBySessionId(sessionId: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(
      (player) => player.sessionId === sessionId,
    );
  }

  async getPlayersByGameId(gameId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(
      (player) => player.gameId === gameId,
    );
  }

  async updatePlayerScore(id: number, scoreIncrement: number): Promise<Player> {
    const player = await this.getPlayer(id);
    if (!player) {
      throw new Error(`Player with id ${id} not found`);
    }
    
    const updatedPlayer: Player = { 
      ...player, 
      score: player.score + scoreIncrement 
    };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }
  
  async removePlayer(id: number): Promise<void> {
    const player = await this.getPlayer(id);
    if (!player) {
      throw new Error(`Player with id ${id} not found`);
    }
    
    // Remove player from storage
    this.players.delete(id);
    
    // Also remove any definitions and votes by this player
    // This prevents errors when trying to reference a deleted player
    const playerDefinitions = Array.from(this.definitions.values())
      .filter(def => def.playerId === id);
      
    for (const def of playerDefinitions) {
      this.definitions.delete(def.id);
    }
    
    const playerVotes = Array.from(this.votes.values())
      .filter(vote => vote.playerId === id);
      
    for (const vote of playerVotes) {
      this.votes.delete(vote.id);
    }
  }

  // Definition methods
  async createDefinition(definition: InsertDefinition): Promise<Definition> {
    const id = this.definitionIdCounter++;
    // Ensure required fields have values
    const newDefinition: Definition = { 
      ...definition, 
      id,
      round: definition.round ?? 1,
      isCorrect: definition.isCorrect ?? false
    };
    this.definitions.set(id, newDefinition);
    return newDefinition;
  }

  async getDefinitionsByGameId(gameId: number, round: number): Promise<Definition[]> {
    return Array.from(this.definitions.values()).filter(
      (definition) => definition.gameId === gameId && definition.round === round,
    );
  }

  // Vote methods
  async createVote(vote: InsertVote): Promise<Vote> {
    const id = this.voteIdCounter++;
    
    // Create a complete vote object with all required fields
    const newVote: Vote = { 
      id,
      gameId: vote.gameId,
      playerId: vote.playerId,
      definitionId: vote.definitionId,
      round: vote.round || 1  // Use default of 1 if not provided
    };
    
    this.votes.set(id, newVote);
    return newVote;
  }

  async getVotesByGameId(gameId: number, round: number): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(
      (vote) => vote.gameId === gameId && vote.round === round,
    );
  }

  // Game state methods
  async getGameState(gameId: number, round?: number): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }
    
    // Use the specified round or the game's current round
    const currentRound = round || game.currentRound || 1;
    
    const players = await this.getPlayersByGameId(gameId);
    const definitions = await this.getDefinitionsByGameId(gameId, currentRound);
    const votes = await this.getVotesByGameId(gameId, currentRound);
    
    return {
      game,
      players,
      definitions,
      votes
    };
  }
}

export const storage = new MemStorage();
