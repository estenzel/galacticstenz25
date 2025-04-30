import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameStore } from "@/lib/gameState";
import { apiRequest } from "@/lib/queryClient";
import { v4 as uuidv4 } from "uuid";

const Home: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { sessionId, setSessionId } = useGameStore();
  const [playerName, setPlayerName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

  // Ensure we have a valid sessionId
  React.useEffect(() => {
    if (!sessionId) {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
    }
  }, [sessionId, setSessionId]);

  const createNewGame = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      // Create new game
      const gameResponse = await apiRequest("POST", "/api/games", {});
      const game = await gameResponse.json();

      // Join as admin
      const playerResponse = await apiRequest("POST", `/api/games/${game.id}/players`, {
        name: playerName,
        sessionId,
        isAdmin: true,
      });
      const player = await playerResponse.json();

      // Navigate to game
      setLocation(`/game/${game.id}`);
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const joinGame = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    if (!gameCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a game code",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsJoining(true);

      // Find game by code
      const gameResponse = await apiRequest("GET", `/api/games/${gameCode}`);
      const game = await gameResponse.json();

      // Join as player
      const playerResponse = await apiRequest("POST", `/api/games/${game.id}/players`, {
        name: playerName,
        sessionId,
        isAdmin: false,
      });
      const player = await playerResponse.json();

      // Navigate to game
      setLocation(`/game/${game.id}`);
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Error",
        description: "Failed to join game. Please check the game code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <header className="text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-heading font-bold text-primary mb-4">
          Fictionary Dictionary
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          A game of witty definitions and clever deception
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Create Game Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-heading font-semibold text-gray-800 mb-4">
              Create New Game
            </h2>
            <p className="text-gray-600 mb-6">
              Start a new game and invite your friends to join with your game code.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <Input
                  id="create-name"
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              <Button
                className="w-full bg-primary hover:bg-indigo-700 text-white"
                onClick={createNewGame}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Game"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Join Game Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-heading font-semibold text-gray-800 mb-4">
              Join Existing Game
            </h2>
            <p className="text-gray-600 mb-6">
              Join a game using the code provided by the game creator.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="join-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <Input
                  id="join-name"
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="game-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Game Code
                </label>
                <Input
                  id="game-code"
                  type="text"
                  placeholder="Enter game code"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                />
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white"
                onClick={joinGame}
                disabled={isJoining}
              >
                {isJoining ? "Joining..." : "Join Game"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Game Instructions */}
      <div className="mt-12 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-heading font-semibold text-gray-800 mb-4">
          How to Play
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-primary text-white mx-auto mb-3">
              1
            </div>
            <h3 className="font-medium text-lg mb-2">Choose a Word</h3>
            <p className="text-gray-600 text-sm">Someone picks an obscure word from the dictionary.</p>
          </div>
          <div className="text-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-primary text-white mx-auto mb-3">
              2
            </div>
            <h3 className="font-medium text-lg mb-2">Create Definitions</h3>
            <p className="text-gray-600 text-sm">Each player invents a believable definition.</p>
          </div>
          <div className="text-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-primary text-white mx-auto mb-3">
              3
            </div>
            <h3 className="font-medium text-lg mb-2">Vote</h3>
            <p className="text-gray-600 text-sm">Everyone votes for the definition they think is correct.</p>
          </div>
          <div className="text-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-primary text-white mx-auto mb-3">
              4
            </div>
            <h3 className="font-medium text-lg mb-2">Score Points</h3>
            <p className="text-gray-600 text-sm">Earn points for guessing correctly or fooling others.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
