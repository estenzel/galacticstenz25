import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { WebSocketMessage, Player, Definition, Vote } from "@shared/schema";
import PlayerAvatar from "../PlayerAvatar";
import { Check, Eye } from "lucide-react";
import { useGameStore } from "@/lib/gameState";

interface VotingPhaseProps {
  gameId: number;
  currentWord: string;
  sendMessage: (message: WebSocketMessage) => void;
  round?: number;
  currentPlayer?: Player;
  players: Player[];
  definitions: Definition[];
  votes: Vote[];
}

const VotingPhase: React.FC<VotingPhaseProps> = ({
  gameId,
  currentWord,
  sendMessage,
  round = 1,
  currentPlayer,
  players,
  definitions,
  votes,
}) => {
  const [shuffledDefinitions, setShuffledDefinitions] = useState<Definition[]>([]);
  const [votedDefinitionId, setVotedDefinitionId] = useState<number | null>(null);
  const { toast } = useToast();
  const { isSpectator } = useGameStore();
  
  // Check if the current player is a spectator
  const spectatorMode = isSpectator();

  // Check if the current player has already voted for this round
  const hasVoted = votes.some(vote => 
    vote.playerId === currentPlayer?.id && 
    vote.round === round
  );
  
  // Count how many players have voted in this round
  const currentRoundVotes = votes.filter(vote => vote.round === round);
  const votedCount = new Set(currentRoundVotes.map(vote => vote.playerId)).size;
  // Count only non-spectator players for the total
  const totalPlayers = players.filter(player => !player.isSpectator).length;

  // Shuffle definitions when they change
  useEffect(() => {
    if (definitions.length > 0) {
      // Create copy of definitions to shuffle
      const definitionsCopy = [...definitions];
      // Fisher-Yates shuffle algorithm
      for (let i = definitionsCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [definitionsCopy[i], definitionsCopy[j]] = [definitionsCopy[j], definitionsCopy[i]];
      }
      setShuffledDefinitions(definitionsCopy);
    }
  }, [definitions]);

  // Find current player's vote if they've already voted in this round
  useEffect(() => {
    if (currentPlayer) {
      const playerVote = votes.find(vote => 
        vote.playerId === currentPlayer.id && 
        vote.round === round
      );
      if (playerVote) {
        setVotedDefinitionId(playerVote.definitionId);
      } else {
        setVotedDefinitionId(null); // Reset if no vote for this round
      }
    }
  }, [votes, currentPlayer, round]);

  const handleVote = (definitionId: number) => {
    if (!currentPlayer) {
      toast({
        title: "Error",
        description: "Player information not available",
        variant: "destructive",
      });
      return;
    }

    // Don't allow voting on own definition
    const isOwnDefinition = definitions.some(
      def => def.playerId === currentPlayer.id && def.id === definitionId
    );

    if (isOwnDefinition) {
      toast({
        title: "Can't vote for your own definition",
        description: "Nice try, but you can't vote for your own definition!",
        variant: "destructive",
      });
      return;
    }

    // Send vote to server
    sendMessage({
      type: "submitVote",
      payload: {
        gameId,
        playerId: currentPlayer.id,
        definitionId,
        round,
      },
    });

    setVotedDefinitionId(definitionId);

    toast({
      title: "Vote recorded",
      description: "Your vote has been recorded!",
    });
  };

  const handleEndVoting = () => {
    sendMessage({
      type: "endVoting",
      payload: {
        gameId,
        round,
      },
    });
  };

  // Get player name by ID
  const getPlayerName = (playerId: number): string => {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : "Unknown Player";
  };

  return (
    <div className="phase phase-vote">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-heading font-semibold text-gray-800 mb-1">
              Mystery Word
            </h2>
            <div className="bg-gray-100 rounded-lg py-3 px-4 inline-block">
              <span className="text-2xl font-medium text-primary">
                {currentWord}
              </span>
            </div>
            <p className="mt-3 text-gray-600">
              Vote for the definition you think is correct or most convincing!
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {shuffledDefinitions.map((definition, index) => {
              // Check if this is the definition the current player voted for
              const isVoted = votedDefinitionId === definition.id;
              // Check if this definition belongs to the current player
              const isOwnDefinition = definition.playerId === currentPlayer?.id;

              return (
                <div
                  key={definition.id}
                  className={`definition-card border rounded-lg p-4 hover:border-primary transition-colors ${
                    isVoted ? "bg-primary/5 border-primary" : "border-gray-200"
                  } ${isOwnDefinition ? "bg-gray-50" : ""}`}
                >
                  <p className="text-gray-800 mb-3">{definition.text}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">
                      Definition #{index + 1}
                    </span>
                    {isOwnDefinition ? (
                      <span className="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded-md">
                        Your definition
                      </span>
                    ) : spectatorMode ? (
                      <span className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-md">
                        Spectating
                      </span>
                    ) : (
                      <Button
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          !hasVoted
                            ? "bg-primary hover:bg-primary/90 text-white"
                            : isVoted
                            ? "bg-primary/20 text-primary cursor-default"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        onClick={() => !hasVoted && handleVote(definition.id)}
                        disabled={hasVoted && !isVoted}
                      >
                        {!hasVoted ? "Vote" : isVoted ? "Voted" : "Vote"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* After voting */}
          {hasVoted && (
            <div className="text-center py-4 bg-gray-50 rounded-lg mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-1">
                Vote Recorded!
              </h3>
              <p className="text-gray-700">
                Waiting for other players to vote...
              </p>
            </div>
          )}

          {/* Admin Control */}
          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-gray-800">Voting Status</h4>
                <p className="text-sm text-gray-700">
                  {votedCount}/{totalPlayers} players have voted
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {players
                    .filter(player => !player.isSpectator) // Filter out spectators
                    .map((player, idx) => {
                    const hasVotedPlayer = votes.some(
                      (vote) => vote.playerId === player.id && vote.round === round
                    );
                    return (
                      <div 
                        key={player.id} 
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100"
                        title={hasVotedPlayer ? `${player.name} has voted` : `${player.name} is still deciding`}
                      >
                        <PlayerAvatar name={player.name} size="sm" colorIndex={idx} />
                        <span className="text-xs font-medium text-gray-800">{player.name}</span>
                        {hasVotedPlayer && <Check className="h-3 w-3 text-green-500" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Only show control buttons for non-spectators */}
              {!spectatorMode && (
                <Button
                  className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-6 rounded-md transition-colors"
                  onClick={handleEndVoting}
                  disabled={votedCount === 0}
                >
                  End Voting
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VotingPhase;
