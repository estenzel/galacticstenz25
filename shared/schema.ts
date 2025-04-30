import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Game schema
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  phase: integer("phase").notNull().default(1),
  currentWord: text("current_word"),
  dictionary: boolean("dictionary").notNull().default(true),
  createdAt: text("created_at").notNull(),
  currentRound: integer("current_round").notNull().default(1),
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
});

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

// Define player roles
export const PlayerRole = {
  PLAYER: 'player',
  SPECTATOR: 'spectator',
  ADMIN: 'admin'
} as const;

export type PlayerRoleType = typeof PlayerRole[keyof typeof PlayerRole];

// Player schema (for users in a game)
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  name: text("name").notNull(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull().default(PlayerRole.PLAYER),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSpectator: boolean("is_spectator").notNull().default(false), // Keeping for backward compatibility
  score: integer("score").notNull().default(0),
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  score: true,
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

// Definition schema
export const definitions = pgTable("definitions", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  playerId: integer("player_id").notNull(),
  round: integer("round").notNull().default(1),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

export const insertDefinitionSchema = createInsertSchema(definitions).omit({
  id: true,
});

export type InsertDefinition = z.infer<typeof insertDefinitionSchema>;
export type Definition = typeof definitions.$inferSelect;

// Vote schema
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  playerId: integer("player_id").notNull(),
  definitionId: integer("definition_id").notNull(),
  round: integer("round").notNull().default(1),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
});

export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;

// Types for WebSocket messages
export type GameState = {
  game: Game;
  players: Player[];
  definitions: Definition[];
  votes: Vote[];
  currentPlayer?: Player;
}

export type WebSocketMessage = {
  type: 'join' | 'updatePhase' | 'submitWord' | 'submitDefinition' | 'submitVote' | 'endSubmissions' | 'endVoting' | 'newRound' | 'cancelRound' | 'awardBonus' | 'gameState' | 'playerJoined' | 'removePlayer' | 'error';
  payload?: any;
}
