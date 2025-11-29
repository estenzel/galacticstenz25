import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IStorage } from "./storage";
import { WebSocketMessage, GameState, PlayerRole } from "@shared/schema";

// Map to store connections by session ID
const connections = new Map<string, WebSocket>();
// Map to store game rooms (gameId -> set of sessionIds)
const gameRooms = new Map<number, Set<string>>();

export function setupWebSocketServer(server: Server, storage: IStorage) {
  // Create WebSocket server with explicit path for Replit environment
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  wss.on("connection", (ws: WebSocket) => {
    let sessionId: string | null = null;
    let gameId: number | null = null;

    ws.on("message", async (message: string) => {
      try {
        const parsed: WebSocketMessage = JSON.parse(message);
        
        switch (parsed.type) {
          case "join":
            // Join a game room
            sessionId = parsed.payload.sessionId;
            gameId = parsed.payload.gameId;
            
            // Store connection
            if (sessionId) {
              connections.set(sessionId, ws);
            }
            
            // Add to game room
            if (gameId && sessionId) {
              if (!gameRooms.has(gameId)) {
                gameRooms.set(gameId, new Set());
              }
              gameRooms.get(gameId)?.add(sessionId);
              
              // Check if the game exists first to prevent creating players for non-existent games
              const game = await storage.getGame(gameId);
              if (!game) {
                console.error(`Game with ID ${gameId} not found when player tried to join`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Game not found. Please check your game code." }
                });
                return;
              }
              
              // Try to get existing player info first (for this specific game)
              let player = await storage.getPlayerBySessionId(sessionId, gameId);
              
              // If player doesn't exist yet, create a new one
              if (!player) {
                // Use explicit role from payload if available, otherwise derive from isSpectator
                const role = parsed.payload.role || 
                  (parsed.payload.isSpectator === true ? PlayerRole.SPECTATOR : PlayerRole.PLAYER);
                
                const isSpectator = role === PlayerRole.SPECTATOR;
                
                // Check if this is the first player to join this game (to make them admin)
                const existingPlayers = await storage.getPlayersByGameId(gameId);
                const isFirstPlayer = existingPlayers.length === 0;
                
                console.log(`Creating new ${isSpectator ? 'spectator' : 'player'} with sessionId ${sessionId}, role: ${role}, isAdmin: ${isFirstPlayer}`);
                
                // Create a new player/spectator with appropriate name and a more stable player number
                const randomId = Math.floor(Math.random() * 100);
                player = await storage.createPlayer({
                  gameId,
                  name: isSpectator ? `Spectator ${randomId}` : `Player ${randomId}`,
                  sessionId,
                  isSpectator,
                  role,
                  isAdmin: isFirstPlayer // First player to join becomes admin
                });
                
                console.log(`Created new ${role}:`, player);
              } else {
                console.log(`Found existing player with role ${player.role}:`, player);
              }
              
              // Get current game state after player has joined
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // First, send a direct message to the joining player with their full game state
              sendMessage(ws, {
                type: "gameState",
                payload: {
                  ...gameState,
                  currentPlayer: player
                }
              });
              
              // Then use our specialized broadcast function to update all other players
              // Each player will get their own personalized view of the game state
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "removePlayer":
            if (gameId && sessionId) {
              // Get current player info (admin)
              const admin = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!admin) {
                console.error(`Admin with sessionId ${sessionId} not found for removePlayer`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Admin not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is an admin
              if (!admin.isAdmin) {
                console.error(`Non-admin ${admin.name} (ID: ${admin.id}) attempted to remove a player`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Only the game admin can remove players." }
                });
                return;
              }
              
              // Get the player to remove
              const playerIdToRemove = parsed.payload.playerId;
              if (!playerIdToRemove) {
                console.error(`Invalid player ID to remove`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Invalid player ID." }
                });
                return;
              }
              
              // Remove the player
              console.log(`Admin ${admin.name} (ID: ${admin.id}) removing player ID: ${playerIdToRemove}`);
              await storage.removePlayer(playerIdToRemove);
              
              // Get updated game state
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "submitWord":
            if (gameId && sessionId) {
              // Get current player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for submitWord`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is a spectator (either by role or isSpectator flag)
              if (player.role === PlayerRole.SPECTATOR || player.isSpectator) {
                console.error(`Spectator ${player.name} (ID: ${player.id}) attempted to submit a word`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Spectators cannot submit words." }
                });
                return;
              }
              
              if (!parsed.payload.word || typeof parsed.payload.word !== 'string' || !parsed.payload.word.trim()) {
                console.error(`Invalid word submitted by player ${player.name} (ID: ${player.id})`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Please enter a valid word." }
                });
                return;
              }
              
              console.log(`Player ${player.name} (ID: ${player.id}) submitted word: ${parsed.payload.word}`);
              
              // Update game with new word
              await storage.updateGameWord(gameId, parsed.payload.word.trim());
              // Update game phase to definitions
              await storage.updateGamePhase(gameId, 2);
              
              // Get updated game state for submitWord
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "submitDefinition":
            if (gameId && sessionId) {
              // Get current player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for submitDefinition`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is a spectator (either by role or isSpectator flag)
              if (player.role === PlayerRole.SPECTATOR || player.isSpectator) {
                console.error(`Spectator ${player.name} (ID: ${player.id}) attempted to submit a definition`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Spectators cannot submit definitions." }
                });
                return;
              }
              
              console.log(`Player ${player.name} (ID: ${player.id}) submitting definition`);
              
              // Check if player has already submitted a definition for this round
              const round = parsed.payload.round || 1;
              const existingDefinitions = await storage.getDefinitionsByGameId(gameId, round);
              const playerHasSubmitted = existingDefinitions.some(def => def.playerId === player.id);
              
              if (playerHasSubmitted) {
                console.error(`Player ${player.name} (ID: ${player.id}) already submitted a definition for this round`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "You have already submitted a definition for this round." }
                });
                return;
              }
              
              // Create definition
              await storage.createDefinition({
                gameId,
                playerId: player.id, // Use the server's player ID, don't trust client
                text: parsed.payload.text,
                isCorrect: parsed.payload.isCorrect || false,
                round
              });
              
              // Get updated game state
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // Use the specialized game state broadcast function that preserves each player's currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "endSubmissions":
            if (gameId && sessionId) {
              // Get current player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for endSubmissions`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is a spectator (either by role or isSpectator flag)
              if (player.role === PlayerRole.SPECTATOR || player.isSpectator) {
                console.error(`Spectator ${player.name} (ID: ${player.id}) attempted to end submissions phase`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Spectators cannot control game phases." }
                });
                return;
              }
              
              console.log(`Player ${player.name} (ID: ${player.id}) ending submissions phase`);
              
              // Update game phase to voting
              await storage.updateGamePhase(gameId, 3);
              
              // Get updated game state
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "submitVote":
            if (gameId && sessionId) {
              // Get current player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for submitVote`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is a spectator (either by role or isSpectator flag)
              if (player.role === PlayerRole.SPECTATOR || player.isSpectator) {
                console.error(`Spectator ${player.name} (ID: ${player.id}) attempted to submit a vote`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Spectators cannot vote." }
                });
                return;
              }
              
              console.log(`Player ${player.name} (ID: ${player.id}) submitting vote`);
              
              // Check if player has already voted for this round
              const voteRound = parsed.payload.round || 1;
              const existingVotes = await storage.getVotesByGameId(gameId, voteRound);
              const playerHasVoted = existingVotes.some(vote => vote.playerId === player.id);
              
              if (playerHasVoted) {
                console.error(`Player ${player.name} (ID: ${player.id}) already voted for this round`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "You have already voted for this round." }
                });
                return;
              }
              
              // Create vote
              await storage.createVote({
                gameId,
                playerId: player.id, // Use the server's player ID, don't trust client
                definitionId: parsed.payload.definitionId,
                round: voteRound
              });
              
              // Get updated game state
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "endVoting":
            if (gameId && sessionId) {
              // Get current player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for endVoting`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is a spectator (either by role or isSpectator flag)
              if (player.role === PlayerRole.SPECTATOR || player.isSpectator) {
                console.error(`Spectator ${player.name} (ID: ${player.id}) attempted to end voting phase`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Spectators cannot control game phases." }
                });
                return;
              }
              
              console.log(`Player ${player.name} (ID: ${player.id}) ending voting phase`);
              
              // Update game phase to results
              await storage.updateGamePhase(gameId, 4);
              
              // Calculate scores based on votes
              const round = parsed.payload.round || 1;
              const definitions = await storage.getDefinitionsByGameId(gameId, round);
              const votes = await storage.getVotesByGameId(gameId, round);
              
              console.log(`Found ${definitions.length} definitions and ${votes.length} votes for scoring`);
              
              // For each definition, count votes and update player scores
              for (const definition of definitions) {
                const voteCount = votes.filter(vote => vote.definitionId === definition.id).length;
                
                // If this isn't a real definition marked with isCorrect and it got votes, award points to the creator
                if (!definition.isCorrect && voteCount > 0) {
                  // Get the player to check if they're a spectator
                  const player = await storage.getPlayer(definition.playerId);
                  // Only award points if player exists and is not a spectator
                  if (player && !player.isSpectator) {
                    console.log(`Player ${definition.playerId} receives ${voteCount} points for their definition`);
                    await storage.updatePlayerScore(definition.playerId, voteCount);
                  }
                }
              }
              
              // Players who voted for the correct definition (marked as real) get points
              const correctDefinition = definitions.find(d => d.isCorrect);
              if (correctDefinition) {
                const correctVotes = votes.filter(vote => vote.definitionId === correctDefinition.id);
                console.log(`${correctVotes.length} players voted for the real definition`);
                for (const vote of correctVotes) {
                  // Get the player to check if they're a spectator
                  const player = await storage.getPlayer(vote.playerId);
                  // Only award points if player exists and is not a spectator
                  if (player && !player.isSpectator) {
                    console.log(`Player ${vote.playerId} receives 1 point for voting for the real definition`);
                    await storage.updatePlayerScore(vote.playerId, 1); // 1 point for guessing the real definition
                  }
                }
              }
              
              // Get updated game state
              const gameState = await storage.getGameState(gameId, round);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "newRound":
            if (gameId && sessionId) {
              // Get current player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for newRound`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is a spectator (either by role or isSpectator flag)
              if (player.role === PlayerRole.SPECTATOR || player.isSpectator) {
                console.error(`Spectator ${player.name} (ID: ${player.id}) attempted to start a new round`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Spectators cannot control game phases." }
                });
                return;
              }
              
              console.log(`Player ${player.name} (ID: ${player.id}) starting new round`);
              
              // Use our new startNewRound method to properly increment round and reset phase
              const updatedGame = await storage.startNewRound(gameId);
              console.log(`Started new round: ${updatedGame.currentRound}`);
              
              // Get updated game state for the new round
              const gameState = await storage.getGameState(gameId, updatedGame.currentRound)
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "cancelRound":
            if (gameId && sessionId) {
              // Get player info
              const player = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!player) {
                console.error(`Player with sessionId ${sessionId} not found for cancelRound`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Only admins can cancel rounds
              if (!player.isAdmin) {
                console.error(`Non-admin player ${player.name} (ID: ${player.id}) attempted to cancel round`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Only admins can cancel the current round." }
                });
                return;
              }
              
              console.log(`Admin ${player.name} (ID: ${player.id}) cancelling current round`);
              
              // Use the cancelRound method to reset the game without incrementing round
              const updatedGame = await storage.cancelRound(gameId);
              console.log(`Cancelled round. Current phase: ${updatedGame.phase}`);
              
              // Get updated game state with the current round number
              const currentRound = updatedGame.currentRound || 1;
              console.log(`Getting game state for round: ${currentRound} after cancellation`);
              const gameState = await storage.getGameState(gameId, currentRound);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "adjustScore":
            if (gameId && sessionId) {
              // Get admin player info
              const adminPlayer = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!adminPlayer) {
                console.error(`Player with sessionId ${sessionId} not found for adjustScore`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if admin
              if (!adminPlayer.isAdmin) {
                console.error(`Non-admin player ${adminPlayer.name} (ID: ${adminPlayer.id}) attempted to adjust score`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Only admins can adjust player scores." }
                });
                return;
              }
              
              // Get the player to adjust and the adjustment amount
              const targetPlayerId = parsed.payload.playerId;
              const adjustment = parsed.payload.adjustment;
              
              if (!targetPlayerId || adjustment === undefined) {
                console.error(`Missing playerId or adjustment for adjustScore`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Missing player ID or adjustment amount." }
                });
                return;
              }
              
              // Get player to check if they're a spectator
              const targetPlayer = await storage.getPlayer(targetPlayerId);
              
              if (!targetPlayer) {
                console.error(`Player with ID ${targetPlayerId} not found for adjustScore`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Target player not found." }
                });
                return;
              }
              
              // Only adjust points if the player is not a spectator
              if (targetPlayer.isSpectator) {
                console.log(`Cannot adjust score for spectator (ID: ${targetPlayerId})`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Cannot adjust scores for spectators." }
                });
                return;
              }
              
              console.log(`Admin ${adminPlayer.name} (ID: ${adminPlayer.id}) adjusting score for ${targetPlayer.name} (ID: ${targetPlayerId}) by ${adjustment}`);
              
              // Update the player's score
              await storage.updatePlayerScore(targetPlayerId, adjustment);
              
              // Get updated game state
              const game = await storage.getGame(gameId);
              const currentRound = game?.currentRound || 1;
              const gameState = await storage.getGameState(gameId, currentRound);
              
              // Broadcast to all players
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "awardBonus":
            if (gameId && sessionId) {
              // Get admin player info
              const adminPlayer = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!adminPlayer) {
                console.error(`Player with sessionId ${sessionId} not found for awardBonus`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if admin
              if (!adminPlayer.isAdmin) {
                console.error(`Non-admin player ${adminPlayer.name} (ID: ${adminPlayer.id}) attempted to award bonus points`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Only admins can award bonus points." }
                });
                return;
              }
              
              // Get the player to award points to
              const playerId = parsed.payload.playerId;
              if (!playerId) {
                console.error(`No player ID provided for awardBonus`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "No player ID provided." }
                });
                return;
              }
              
              console.log(`Admin ${adminPlayer.name} (ID: ${adminPlayer.id}) awarding 3 bonus points to player ID ${playerId}`);
              
              // Get player to check if they're a spectator
              const playerToAward = await storage.getPlayer(playerId);
              
              // Only award points if the player exists and is not a spectator
              if (playerToAward && !playerToAward.isSpectator) {
                // Award 3 bonus points to the player (even if it's the admin themselves)
                await storage.updatePlayerScore(playerId, 3);
                console.log(`Awarded 3 bonus points to player ${playerToAward.name} (ID: ${playerId})`);
              } else if (playerToAward?.isSpectator) {
                console.log(`Cannot award points to spectator (ID: ${playerId})`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Cannot award points to spectators." }
                });
                return;
              }
              
              // Get updated game state with the current round number
              const game = await storage.getGame(gameId);
              if (!game) {
                throw new Error(`Game with id ${gameId} not found`);
              }
              const currentRound = game.currentRound || 1;
              console.log(`Getting game state for round: ${currentRound} after awarding bonus`);
              const gameState = await storage.getGameState(gameId, currentRound);
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, gameState, storage);
            }
            break;
            
          case "removePlayer":
            if (gameId && sessionId) {
              // Get admin player info
              const adminPlayer = await storage.getPlayerBySessionId(sessionId, gameId!);
              
              if (!adminPlayer) {
                console.error(`Player with sessionId ${sessionId} not found for removePlayer`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found. Please rejoin the game." }
                });
                return;
              }
              
              // Check if the user is an admin
              if (!adminPlayer.isAdmin) {
                console.error(`Non-admin player ${adminPlayer.name} (ID: ${adminPlayer.id}) attempted to remove a player`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Only admins can remove players from the game." }
                });
                return;
              }
              
              const playerIdToRemove = parsed.payload.playerId;
              if (!playerIdToRemove) {
                console.error(`No player ID provided to remove`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "No player ID provided." }
                });
                return;
              }
              
              console.log(`Admin ${adminPlayer.name} (ID: ${adminPlayer.id}) removing player with ID ${playerIdToRemove}`);
              
              // Get the player to be removed
              const playerToRemove = await storage.getPlayer(playerIdToRemove);
              if (!playerToRemove) {
                console.error(`Player with ID ${playerIdToRemove} not found`);
                sendMessage(ws, {
                  type: "error",
                  payload: { message: "Player not found." }
                });
                return;
              }
              
              // Remove player from storage
              await storage.removePlayer(playerIdToRemove);
              
              // Remove the player from the room
              if (gameRooms.has(gameId)) {
                gameRooms.get(gameId)?.delete(playerToRemove.sessionId);
                // Also remove their websocket connection
                if (connections.has(playerToRemove.sessionId)) {
                  const playerWs = connections.get(playerToRemove.sessionId);
                  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    sendMessage(playerWs, {
                      type: "error",
                      payload: { message: "You have been removed from the game by the admin." }
                    });
                    playerWs.close();
                  }
                  connections.delete(playerToRemove.sessionId);
                }
              }
              
              // Get updated game state
              const gameState = await storage.getGameState(gameId, parsed.payload.round || 1);
              
              // Filter out the removed player from game state
              const filteredGameState = {
                ...gameState,
                players: gameState.players.filter(p => p.id !== playerIdToRemove)
              };
              
              // Use the specialized broadcast function to maintain each player's own currentPlayer
              await broadcastGameState(gameId, filteredGameState, storage);
            }
            break;
            
          default:
            console.log("Unknown message type:", parsed.type);
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        sendMessage(ws, {
          type: "error",
          payload: { message: "An error occurred" }
        });
      }
    });

    ws.on("close", () => {
      if (sessionId) {
        // Remove connection
        connections.delete(sessionId);
        
        // Remove from game room
        if (gameId && gameRooms.has(gameId)) {
          gameRooms.get(gameId)?.delete(sessionId);
          
          // If room is empty, remove it
          if (gameRooms.get(gameId)?.size === 0) {
            gameRooms.delete(gameId);
          }
        }
      }
    });
  });
}

// Helper to send message through WebSocket
function sendMessage(ws: WebSocket, message: WebSocketMessage) {
  ws.send(JSON.stringify(message));
}

// Helper to broadcast to all clients in a room
function broadcastToRoom(gameId: number, message: WebSocketMessage, excludeSessionId?: string) {
  const room = gameRooms.get(gameId);
  
  if (room) {
    // Convert Set to Array before iteration to avoid TypeScript issues
    Array.from(room).forEach(sessionId => {
      if (excludeSessionId && sessionId === excludeSessionId) return;
      
      const connection = connections.get(sessionId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        sendMessage(connection, message);
      }
    });
  }
}

// Specialized broadcast for game state that preserves each player's own currentPlayer info
async function broadcastGameState(gameId: number, gameState: GameState, storage: IStorage) {
  const room = gameRooms.get(gameId);
  
  if (room) {
    // Get all session IDs as an array to avoid TypeScript error with Set iteration
    const sessionIds = Array.from(room);
    
    // Process each session ID
    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const connection = connections.get(sessionId);
      
      if (connection && connection.readyState === WebSocket.OPEN) {
        // Get this player's personal info to include in their game state
        const thisPlayer = await storage.getPlayerBySessionId(sessionId, gameId!);
        
        if (thisPlayer) {
          // Send customized game state with this player's own info
          sendMessage(connection, {
            type: "gameState",
            payload: {
              ...gameState,
              currentPlayer: thisPlayer // Each player sees their own player info
            }
          });
        }
      }
    }
  }
}
