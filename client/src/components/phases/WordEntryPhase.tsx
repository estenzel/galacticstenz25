import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { WebSocketMessage } from "@shared/schema";
import { useGameStore } from "@/lib/gameState";
import { Eye } from "lucide-react";

interface WordEntryPhaseProps {
  gameId: number;
  sendMessage: (message: WebSocketMessage) => void;
  round?: number;
  currentPlayerId?: number;
}

const WordEntryPhase: React.FC<WordEntryPhaseProps> = ({ 
  gameId, 
  sendMessage,
  round = 1,
  currentPlayerId
}) => {
  const [word, setWord] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { isSpectator } = useGameStore();

  // Check if current player is a spectator
  const spectatorMode = isSpectator();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!word.trim()) {
      toast({
        title: "Error",
        description: "Please enter a word",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Send word to server
    sendMessage({
      type: "submitWord",
      payload: {
        gameId,
        word: word.trim(),
        round,
        playerId: currentPlayerId
      }
    });
    
    toast({
      title: "Word submitted",
      description: "Your word has been submitted!",
    });
  };

  return (
    <div className="phase phase-word">
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-2xl font-heading font-semibold text-gray-800 mb-4">Enter a Mystery Word</h2>
          <p className="text-gray-600 mb-6">Find an obscure word from the dictionary that others might not know the definition of.</p>
          
          {spectatorMode ? (
            <div className="mb-4 p-4 rounded-lg bg-indigo-50 flex items-center gap-3">
              <Eye className="h-5 w-5 text-indigo-500" />
              <p className="text-indigo-700">
                You are in spectator mode. Waiting for a player to submit a word...
              </p>
            </div>
          ) : (
            <form className="mb-4" onSubmit={handleSubmit}>
              <div className="flex flex-col md:flex-row gap-4">
                <Input
                  type="text"
                  className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter a word from the dictionary"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
                  disabled={isSubmitting}
                >
                  Submit Word
                </Button>
              </div>
            </form>
          )}
          
          <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-600">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Choose words that are real but uncommon</li>
              <li>Make sure the word has a clear definition</li>
              <li>Once submitted, everyone will see the same word</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WordEntryPhase;
