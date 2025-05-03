import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, Eye, Info } from "lucide-react";
import { WebSocketMessage, Player, Definition } from "@shared/schema";
import PlayerAvatar from "../PlayerAvatar";
import { useGameStore } from "@/lib/gameState";
import { Checkbox } from "@/components/ui/checkbox";

interface DefinitionPhaseProps {
  gameId: number;
  currentWord: string;
  sendMessage: (message: WebSocketMessage) => void;
  round?: number;
  currentPlayer?: Player;
  players: Player[];
  definitions: Definition[];
}

const DefinitionPhase: React.FC<DefinitionPhaseProps> = ({
  gameId,
  currentWord,
  sendMessage,
  round = 1,
  currentPlayer,
  players,
  definitions,
}) => {
  const [definition, setDefinition] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRealDefinition, setIsRealDefinition] = useState(
    currentPlayer?.submittedWord || false // Default to true if the player submitted the word
  );
  const { toast } = useToast();
  const { isSpectator, hasPlayerSubmittedDefinition } = useGameStore();
  
  // Check if the current player is a spectator
  const spectatorMode = isSpectator();

  // Don't rely on any state methods - do a direct check against the current player's ID
  // This ensures we're only checking the CURRENT player's submission status for the CURRENT round
  const hasSubmitted = (() => {
    // If no current player info, they haven't submitted
    if (!currentPlayer) return false;
    
    // Get the current player's ID
    const playerId = currentPlayer.id;
    
    // Check if there's a definition from this specific player FOR THIS ROUND
    return definitions.some(def => 
      def.playerId === playerId && 
      def.round === round
    );
  })();
    
  // Check for player's definition has been moved to hasSubmitted variable

  // Count how many players have submitted definitions
  const submittedCount = definitions.length;
  // Count only non-spectator players for the total
  const totalPlayers = players.filter(player => !player.isSpectator).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!definition.trim()) {
      toast({
        title: "Error",
        description: "Please enter a definition",
        variant: "destructive",
      });
      return;
    }

    if (!currentPlayer) {
      toast({
        title: "Error",
        description: "Player information not available. Try refreshing the page.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Send definition to server
      sendMessage({
        type: "submitDefinition",
        payload: {
          gameId,
          playerId: currentPlayer.id,
          text: definition.trim(),
          round,
          isCorrect: isRealDefinition, // Use the checkbox value
        },
      });

      toast({
        title: "Definition submitted",
        description: isRealDefinition 
          ? "Your real definition has been submitted!" 
          : "Your definition has been submitted!",
      });
    } catch (error) {
      console.error("Error submitting definition:", error);
      toast({
        title: "Error",
        description: "Failed to submit definition. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleEndSubmissions = () => {
    sendMessage({
      type: "endSubmissions",
      payload: {
        gameId,
        round,
      },
    });
  };

  return (
    <div className="phase phase-define">
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
          </div>

          {spectatorMode ? (
            <>
              <h3 className="text-xl font-heading font-medium text-gray-800 mb-4">
                Spectator Mode
              </h3>
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <div className="mb-4">
                  <Eye className="h-16 w-16 mx-auto text-primary/80" />
                </div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">
                  You are watching this game
                </h3>
                <p className="text-gray-700">
                  Players are currently creating their definitions for the word above.
                </p>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-heading font-medium text-gray-800 mb-4">
                Create Your Definition
              </h3>
              <p className="text-gray-700 mb-6">
                Make up a believable definition that might fool other players. Be creative!
              </p>

              {!hasSubmitted && currentPlayer ? (
                <form className="mb-6" onSubmit={handleSubmit}>
                  <div className="bg-amber-50 text-amber-800 p-3 mb-3 rounded-md text-sm border border-amber-200">
                    <strong>Player {currentPlayer.name}:</strong> Create your definition below.
                  </div>
                  <Textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                    placeholder="Write your definition here..."
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  
                  <div className="mt-3 flex items-center gap-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                    <Checkbox 
                      id="real-definition" 
                      checked={isRealDefinition}
                      onCheckedChange={(checked) => setIsRealDefinition(checked as boolean)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="real-definition"
                        className="text-sm font-medium text-gray-900 cursor-pointer"
                      >
                        THIS IS THE REAL DEFINITION
                      </label>
                      <p className="text-xs text-gray-700 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        <span>Mark if you're providing the actual definition for this word. Special scoring rules apply.</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="submit"
                      className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-6 rounded-md transition-colors"
                      disabled={isSubmitting}
                    >
                      Submit Definition
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <div className="mb-4 text-success">
                    <Check className="h-16 w-16 mx-auto text-green-500" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">
                    {currentPlayer ? 
                      `${currentPlayer.name}, your definition has been submitted!` : 
                      'Definition Submitted!'}
                  </h3>
                  <p className="text-gray-700 mb-6">
                    Waiting for other players to submit their definitions...
                  </p>
                  <div className="bg-green-50 text-green-800 p-3 mb-3 rounded-md text-sm border border-green-200">
                    Your definition was successfully recorded for this round.
                  </div>
                </div>
              )}
            </>
          )}

          {/* Player Status Section */}
          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-gray-800">Player Status</h4>
                <p className="text-sm text-gray-700">
                  {submittedCount}/{totalPlayers} players have submitted definitions
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {players
                    .filter(player => !player.isSpectator) // Filter out spectators
                    .map((player, idx) => {
                    const hasSubmittedDef = definitions.some(
                      (def) => def.playerId === player.id && def.round === round
                    );
                    return (
                      <div 
                        key={player.id} 
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100"
                        title={hasSubmittedDef ? `${player.name} has submitted` : `${player.name} is still writing`}
                      >
                        <PlayerAvatar name={player.name} size="sm" colorIndex={idx} />
                        <span className="text-xs font-medium text-gray-800">{player.name}</span>
                        {hasSubmittedDef && <Check className="h-3 w-3 text-green-500" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Only show control buttons for non-spectators */}
              {!spectatorMode && (
                <Button
                  className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-6 rounded-md transition-colors"
                  onClick={handleEndSubmissions}
                  disabled={submittedCount === 0}
                >
                  End Submissions
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DefinitionPhase;
