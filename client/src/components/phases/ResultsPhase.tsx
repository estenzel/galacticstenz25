import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import { WebSocketMessage, Player, Definition, Vote } from "@shared/schema";
import PlayerAvatar from "../PlayerAvatar";
import { useGameStore } from "@/lib/gameState";

// Seeded random number generator for deterministic shuffling
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Deterministic shuffle using a seed (gameId + round)
function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface ResultsPhaseProps {
  gameId: number;
  currentWord: string;
  sendMessage: (message: WebSocketMessage) => void;
  players: Player[];
  definitions: Definition[];
  votes: Vote[];
  round?: number;
}

const ResultsPhase: React.FC<ResultsPhaseProps> = ({
  gameId,
  currentWord,
  sendMessage,
  players,
  definitions,
  votes,
  round = 1,
}) => {
  // Check if current user is admin to enable special controls
  const isAdmin = useGameStore(state => state.isAdmin());
  
  // State for shuffled definitions
  const [shuffledDefinitions, setShuffledDefinitions] = useState<Definition[]>([]);
  
  // Get correct definition (if any)
  const correctDefinition = definitions.find((def) => def.isCorrect);
  
  // Shuffle definitions deterministically so everyone sees the same order
  useEffect(() => {
    if (definitions.length > 0) {
      // Use gameId + round as seed for deterministic shuffle
      // This ensures all players see the same order
      const seed = gameId * 1000 + round;
      const shuffled = deterministicShuffle(definitions, seed);
      setShuffledDefinitions(shuffled);
    }
  }, [definitions, gameId, round]);

  // Get player name by ID
  const getPlayerName = (playerId: number): string => {
    const player = players.find((p) => p.id === playerId);
    return player ? player.name : "Unknown Player";
  };

  // Get players who voted for a definition
  const getVotesForDefinition = (definitionId: number): Vote[] => {
    return votes.filter((vote) => vote.definitionId === definitionId);
  };

  // Count votes for each definition
  const getVoteCount = (definitionId: number): number => {
    return getVotesForDefinition(definitionId).length;
  };

  const handleNewRound = () => {
    sendMessage({
      type: "newRound",
      payload: {
        gameId,
        round,
      },
    });
  };

  return (
    <div className="phase phase-results">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-heading font-semibold text-gray-800 mb-1">
              Results
            </h2>
            <div className="bg-gray-100 rounded-lg py-3 px-4 inline-block mb-3">
              <span className="text-2xl font-medium text-primary">
                {currentWord}
              </span>
            </div>
            {correctDefinition && (
              <>
                <p className="text-gray-700 font-medium">Actual definition:</p>
                <p className="italic text-gray-600">{correctDefinition.text}</p>
              </>
            )}
          </div>

          <h3 className="text-xl font-heading font-medium text-gray-800 mb-4">
            Player Definitions & Votes
          </h3>

          <div className="space-y-4 mb-8">
            {shuffledDefinitions.map((definition) => {
              const votesForDefinition = getVotesForDefinition(definition.id);
              const voteCount = votesForDefinition.length;
              const isCorrect = definition.isCorrect;

              return (
                <div
                  key={definition.id}
                  className={`definition-card border rounded-lg p-4 transition-colors ${
                    isCorrect
                      ? "border-success bg-success/5"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className={`text-gray-800 ${isCorrect ? "font-bold" : ""}`}>
                      {definition.text}
                      {isCorrect && (
                        <Star className="h-4 w-4 text-amber-400 inline-block ml-1 mb-1" />
                      )}
                    </p>
                    <div className="ml-3 flex items-center">
                      <span
                        className={`text-sm font-medium mr-2 ${
                          isCorrect ? "text-success" : "text-gray-700"
                        }`}
                      >
                        {voteCount} {voteCount === 1 ? "vote" : "votes"}
                      </span>
                      {isCorrect && (
                        <Check className="h-5 w-5 text-success" />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm font-medium ${
                        isCorrect ? "text-success" : "text-gray-700"
                      }`}
                    >
                      {isCorrect 
                        ? "" 
                        : `By: ${getPlayerName(definition.playerId)}`}
                    </span>
                    {voteCount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-700">Fooled:</span>
                        <div className="flex -space-x-2">
                          {votesForDefinition.map((vote, idx) => (
                            <PlayerAvatar
                              key={vote.id}
                              name={getPlayerName(vote.playerId)}
                              size="sm"
                              colorIndex={idx % 9}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Player Scores */}
          <div className="mb-8">
            <h3 className="text-xl font-heading font-medium text-gray-800 mb-4">
              Player Scores
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players
                .filter(player => !player.isSpectator) // Filter out spectators
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <PlayerAvatar name={player.name} colorIndex={idx % 9} />
                      <span className="font-medium text-gray-800">{player.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-primary">
                        {player.score} pts
                      </span>
                      
                      {/* EVERYONE FOOLED button - only visible to admin */}
                      {isAdmin && !player.isSpectator && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-primary hover:bg-primary/90 cursor-pointer text-white text-xs px-2 py-1 rounded-md transition-colors"
                          onClick={() => {
                            if (window.confirm(`Award 3 bonus points to ${player.name} for fooling everyone?`)) {
                              sendMessage({
                                type: "awardBonus",
                                payload: {
                                  gameId,
                                  playerId: player.id,
                                  round
                                }
                              });
                            }
                          }}
                          title="Award 3 bonus points when everyone was fooled by this definition"
                        >
                          Everyone Fooled! (+3)
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* New Round Button */}
          <div className="text-center">
            <Button
              className="bg-primary hover:bg-primary/90 text-white font-medium py-3 px-8 rounded-md transition-colors"
              onClick={handleNewRound}
            >
              Start New Round
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsPhase;
