import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupWebSocketServer } from "./websocket";
import { insertGameSchema, insertPlayerSchema, insertDefinitionSchema, insertVoteSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { randomBytes } from "crypto";

// Generate a random 6-character code for the game
function generateGameCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Create a new game
  app.post('/api/games', async (req, res) => {
    try {
      const gameData = insertGameSchema.parse({
        code: generateGameCode(),
        phase: 1,
        currentWord: "",
        dictionary: true,
        createdAt: new Date().toISOString(),
      });
      
      const game = await storage.createGame(gameData);
      res.status(201).json(game);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: 'Failed to create game' });
      }
    }
  });

  // Get a game by code
  app.get('/api/games/:code', async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const game = await storage.getGameByCode(code);
      
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch game' });
    }
  });

  // Join a game (create a player)
  app.post('/api/games/:gameId/players', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      const playerData = insertPlayerSchema.parse({
        gameId,
        name: req.body.name,
        sessionId: req.body.sessionId,
        isAdmin: req.body.isAdmin || false,
      });
      
      const player = await storage.createPlayer(playerData);
      res.status(201).json(player);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: 'Failed to join game' });
      }
    }
  });

  // Get all players in a game
  app.get('/api/games/:gameId/players', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const players = await storage.getPlayersByGameId(gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch players' });
    }
  });

  // Submit a definition
  app.post('/api/games/:gameId/definitions', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      const definitionData = insertDefinitionSchema.parse({
        gameId,
        playerId: req.body.playerId,
        round: req.body.round || 1,
        text: req.body.text,
        isCorrect: req.body.isCorrect || false,
      });
      
      const definition = await storage.createDefinition(definitionData);
      res.status(201).json(definition);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: 'Failed to submit definition' });
      }
    }
  });

  // Get all definitions for a game
  app.get('/api/games/:gameId/definitions', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const round = parseInt(req.query.round as string) || 1;
      const definitions = await storage.getDefinitionsByGameId(gameId, round);
      res.json(definitions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch definitions' });
    }
  });

  // Submit a vote
  app.post('/api/games/:gameId/votes', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      const voteData = insertVoteSchema.parse({
        gameId,
        playerId: req.body.playerId,
        definitionId: req.body.definitionId,
        round: req.body.round || 1,
      });
      
      const vote = await storage.createVote(voteData);
      res.status(201).json(vote);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: 'Invalid vote data: ' + validationError.message });
      } else {
        res.status(500).json({ message: 'Failed to submit vote' });
      }
    }
  });

  // Get all votes for a game
  app.get('/api/games/:gameId/votes', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const round = parseInt(req.query.round as string) || 1;
      const votes = await storage.getVotesByGameId(gameId, round);
      res.json(votes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch votes' });
    }
  });

  // Get full game state
  app.get('/api/games/:gameId/state', async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const round = parseInt(req.query.round as string) || 1;
      
      const gameState = await storage.getGameState(gameId, round);
      res.json(gameState);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch game state' });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server
  setupWebSocketServer(httpServer, storage);

  return httpServer;
}
