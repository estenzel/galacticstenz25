import { create } from "zustand";
import { WebSocketMessage, GameState, Player, Definition, Game, Vote, PlayerRole, PlayerRoleType } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

interface GameStateStore {
  // Session ID for the current player
  sessionId: string;
  
  // Game data
  gameState: GameState | null;
  
  // WebSocket connection
  wsConnected: boolean;
  
  // Set the session ID
  setSessionId: (sessionId: string) => void;
  
  // Update game state from WebSocket
  updateGameState: (gameState: GameState) => void;
  
  // Set WebSocket connection status
  setWsConnected: (connected: boolean) => void;
  
  // Reset game state
  resetGameState: () => void;
  
  // Getters for game state
  getCurrentPhase: () => number;
  getCurrentWord: () => string;
  getCurrentRound: () => number;
  getPlayers: () => Player[];
  getDefinitions: () => Definition[];
  getVotes: () => Vote[];
  getCurrentPlayer: () => Player | undefined;
  isSpectator: () => boolean;
  isAdmin: () => boolean;
  hasPlayerSubmittedDefinition: () => boolean;
  hasPlayerVoted: () => boolean;
  getVotedDefinitionId: () => number | null;
}

export const useGameStore = create<GameStateStore>((set, get) => ({
  // Initialize with a random session ID if none exists
  sessionId: localStorage.getItem("sessionId") || uuidv4(),
  gameState: null,
  wsConnected: false,
  
  setSessionId: (sessionId: string) => {
    localStorage.setItem("sessionId", sessionId);
    set({ sessionId });
  },
  
  updateGameState: (gameState: GameState) => {
    set({ gameState });
  },
  
  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },
  
  resetGameState: () => {
    set({ gameState: null });
  },
  
  // Getters
  getCurrentPhase: () => {
    return get().gameState?.game.phase || 1;
  },
  
  getCurrentWord: () => {
    return get().gameState?.game.currentWord || "";
  },
  
  getCurrentRound: () => {
    return get().gameState?.game.currentRound || 1;
  },
  
  getPlayers: () => {
    return get().gameState?.players || [];
  },
  
  getDefinitions: () => {
    return get().gameState?.definitions || [];
  },
  
  getVotes: () => {
    return get().gameState?.votes || [];
  },
  
  getCurrentPlayer: () => {
    return get().gameState?.currentPlayer;
  },
  
  isSpectator: () => {
    const currentPlayer = get().getCurrentPlayer();
    // Check both the legacy isSpectator flag and the new role field
    return currentPlayer?.isSpectator === true || currentPlayer?.role === PlayerRole.SPECTATOR;
  },
  
  isAdmin: () => {
    const currentPlayer = get().getCurrentPlayer();
    return currentPlayer?.isAdmin === true;
  },
  
  hasPlayerSubmittedDefinition: () => {
    const currentPlayer = get().getCurrentPlayer();
    const definitions = get().getDefinitions();
    const currentRound = get().getCurrentRound();
    
    if (!currentPlayer) return false;
    
    // Only check definitions for the current round
    return definitions.some(def => 
      def.playerId === currentPlayer.id && 
      def.round === currentRound
    );
  },
  
  hasPlayerVoted: () => {
    const currentPlayer = get().getCurrentPlayer();
    const votes = get().getVotes();
    const currentRound = get().getCurrentRound();
    
    if (!currentPlayer) return false;
    
    // Only check votes for the current round
    return votes.some(vote => 
      vote.playerId === currentPlayer.id && 
      vote.round === currentRound
    );
  },
  
  getVotedDefinitionId: () => {
    const currentPlayer = get().getCurrentPlayer();
    const votes = get().getVotes();
    const currentRound = get().getCurrentRound();
    
    if (!currentPlayer) return null;
    
    const playerVote = votes.find(vote => 
      vote.playerId === currentPlayer.id && 
      vote.round === currentRound
    );
    return playerVote ? playerVote.definitionId : null;
  }
}));
