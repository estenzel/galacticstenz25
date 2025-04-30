import React, { useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { useGameStore } from "@/lib/gameState";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import GamePhaseIndicator from "@/components/GamePhaseIndicator";
import WordEntryPhase from "@/components/phases/WordEntryPhase";
import DefinitionPhase from "@/components/phases/DefinitionPhase";
import VotingPhase from "@/components/phases/VotingPhase";
import ResultsPhase from "@/components/phases/ResultsPhase";
import Leaderboard from "@/components/Leaderboard";
import { WebSocketMessage, PlayerRole } from "@shared/schema";
import { Eye } from "lucide-react";

const Game: React.FC = () => {
  const [match, params] = useRoute("/game/:gameId");
  const gameId = parseInt(params?.gameId || "0");
  const { toast } = useToast();
  
  const { 
    sessionId, 
    gameState, 
    updateGameState, 
    setWsConnected,
    getCurrentPhase,
    getCurrentWord,
    getCurrentRound,
    getPlayers,
    getDefinitions,
    getVotes,
    getCurrentPlayer,
    isSpectator,
    isAdmin
  } = useGameStore();

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case "gameState":
        updateGameState(message.payload);
        break;
      case "playerJoined":
        toast({
          title: "Player joined",
          description: `${message.payload.name} has joined the game!`,
        });
        break;
      case "error":
        // Customize error message for common issues
        if (message.payload.message === "Game not found. Please check your game code.") {
          toast({
            title: "Game Not Found",
            description: "The game may have expired. In-memory storage resets on server restart. Please create a new game from the home page.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: message.payload.message,
            variant: "destructive",
          });
        }
        break;
      default:
        // Silently handle unknown message types
    }
  }, [updateGameState, toast]);

  // Set up WebSocket connection
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // Use the current host but with explicit path for WebSocket connection in Replit environment
  const wsUrl = `${wsProtocol}://${window.location.host}/ws`;
  
  const { isConnected, sendMessage } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    reconnectInterval: 2000, // Faster reconnect
    maxReconnectAttempts: 10, // More reconnect attempts
  });

  // Update WebSocket connection status
  useEffect(() => {
    setWsConnected(isConnected);
    
    // If connected, join the game
    if (isConnected && gameId) {
      // Get the latest player ID from the store at the time of connection
      const player = getCurrentPlayer();
      const playerId = player?.id;
      
      // Check URL parameters for spectator mode
      const isSpectatorMode = new URLSearchParams(window.location.search).get('spectator') === 'true';
      
      // Prepare role based on URL parameter
      const role = isSpectatorMode ? PlayerRole.SPECTATOR : PlayerRole.PLAYER;
      
      sendMessage({
        type: "join",
        payload: {
          gameId,
          sessionId,
          playerId,
          role,
          isSpectator: isSpectatorMode, // Keep for backward compatibility
          // If we don't have a playerId yet, this is a new join
          // and the server will create a new player
        },
      });
    }
  }, [isConnected, gameId, sessionId, getCurrentPlayer, sendMessage, setWsConnected]);

  // Get current game state values
  const currentPhase = getCurrentPhase();
  const currentWord = getCurrentWord();
  const currentRound = gameState?.game?.currentRound || 1;
  const players = getPlayers();
  const definitions = getDefinitions();
  const votes = getVotes();
  const currentPlayer = getCurrentPlayer();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">
          Fictionary Dictionary
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Create witty definitions, vote for your favorites, and see if you can fool your friends!
        </p>
        
        {/* Game Code */}
        {gameState?.game?.code && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="bg-primary/10 text-primary font-mono font-bold rounded-lg px-4 py-2 inline-block border border-primary/20">
              Game Code: <span className="text-lg tracking-wider">{gameState.game.code}</span>
            </div>
            
            {/* Actions: Leaderboard, Share Links */}
            <div className="flex flex-wrap justify-center items-center gap-3 mt-2">
              {/* Leaderboard Component */}
              <Leaderboard />
              
              <Button 
                variant="outline" 
                size="sm" 
                className="text-sm flex items-center gap-1 bg-primary/5 text-primary border-primary/20"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/game/${gameId}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast({
                    title: "Player link copied!",
                    description: "Share this with friends so they can join your game as players.",
                  });
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                <span>Copy Player Link</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="text-sm flex items-center gap-1 bg-primary/5 text-primary border-primary/20"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/game/${gameId}?spectator=true`;
                  navigator.clipboard.writeText(shareUrl);
                  toast({
                    title: "Spectator link copied!",
                    description: "Share this with friends who want to watch the game without playing.",
                  });
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="2"></circle>
                  <path d="M22 12c-2.667 4.667-6 7-10 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7"></path>
                </svg>
                <span>Copy Spectator Link</span>
              </Button>
            </div>
          </div>
        )}
        
        {/* Spectator badge */}
        {isSpectator() && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full">
            <Eye className="h-4 w-4" />
            <span className="font-medium">Spectator Mode</span>
          </div>
        )}
      </header>

      {/* Game Phase Indicator */}
      <GamePhaseIndicator currentPhase={currentPhase} />
      
      {/* Admin Controls - only visible to game admin */}
      {isAdmin() && (
        <div className="mb-6 bg-blue-50 rounded-lg shadow-md p-4 border border-blue-200">
          <h3 className="text-lg font-heading font-medium text-blue-800 mb-2">
            Admin Controls
          </h3>
          <div className="text-sm text-blue-700 mb-3">
            As the game creator, you can manage the game and players here.
          </div>
          
          {/* Game Control Buttons */}
          <div className="mb-4">
            <Button
              className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 mr-2"
              onClick={() => {
                if (window.confirm("Are you sure you want to cancel the current round? This will reset the game to the word entry phase.")) {
                  sendMessage({
                    type: "cancelRound",
                    payload: {
                      gameId
                    }
                  });
                  
                  toast({
                    title: "Round Cancelled",
                    description: "The current round has been cancelled and reset to the word entry phase."
                  });
                }
              }}
            >
              Cancel Round
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {players.map((player) => (
              <div 
                key={player.id}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-blue-200"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium text-sm mr-2">
                    {player.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-xs text-gray-500">
                      {player.isAdmin ? 'Admin' : player.role}
                    </div>
                  </div>
                </div>
                
                {!player.isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 px-2 py-1"
                    onClick={() => {
                      // Confirm before removing
                      if (window.confirm(`Are you sure you want to remove ${player.name} from the game?`)) {
                        sendMessage({
                          type: "removePlayer",
                          payload: {
                            gameId,
                            playerId: player.id,
                            round: 1,
                          },
                        });
                        
                        toast({
                          title: "Player removed",
                          description: `${player.name} has been removed from the game.`,
                        });
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Phases */}
      <div className="game-phases">
        {/* Phase 1: Word Entry */}
        {currentPhase === 1 && (
          <WordEntryPhase 
            gameId={gameId} 
            sendMessage={sendMessage}
            currentPlayerId={currentPlayer?.id}
            round={currentRound}
          />
        )}

        {/* Phase 2: Definition Submission */}
        {currentPhase === 2 && (
          <DefinitionPhase 
            gameId={gameId}
            currentWord={currentWord}
            sendMessage={sendMessage}
            currentPlayer={currentPlayer}
            players={players}
            definitions={definitions}
            round={currentRound}
          />
        )}

        {/* Phase 3: Voting */}
        {currentPhase === 3 && (
          <VotingPhase 
            gameId={gameId}
            currentWord={currentWord}
            sendMessage={sendMessage}
            currentPlayer={currentPlayer}
            players={players}
            definitions={definitions}
            votes={votes}
            round={currentRound}
          />
        )}

        {/* Phase 4: Results */}
        {currentPhase === 4 && (
          <ResultsPhase 
            gameId={gameId}
            currentWord={currentWord}
            sendMessage={sendMessage}
            players={players}
            definitions={definitions}
            votes={votes}
            round={currentRound}
          />
        )}
      </div>


      
      {/* Game Info */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-heading font-medium text-gray-800 mb-3">
          How to Play
        </h3>
        <ol className="list-decimal pl-5 space-y-2 text-gray-800">
          <li>Someone picks a word from the dictionary that others might not know.</li>
          <li>Each player invents a definition that sounds believable.</li>
          <li>All definitions (including the real one) are displayed, and players vote for the one they think is correct.</li>
          <li>Points are awarded for guessing correctly or for fooling others with your fake definition.</li>
        </ol>
      </div>
    </div>
  );
};

export default Game;
