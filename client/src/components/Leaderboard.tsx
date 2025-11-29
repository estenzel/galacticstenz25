import React, { useState } from 'react';
import { X, Trophy, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/lib/gameState';
import PlayerAvatar from './PlayerAvatar';
import { Player, WebSocketMessage } from '@shared/schema';

// Define the type for our modal props
interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  isAdmin: boolean;
  onAdjustScore?: (playerId: number, adjustment: number) => void;
}

// Create the modal component
const LeaderboardModal = ({ isOpen, onClose, players, isAdmin, onAdjustScore }: LeaderboardModalProps) => {
  if (!isOpen) return null;

  // Sort players by score in descending order
  const sortedPlayers = [...players]
    .filter(player => !player.isSpectator) // Filter out spectators
    .sort((a, b) => b.score - a.score);

  return (
    <>
      {/* Modal background overlay */}
      <div 
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-lg shadow-lg z-50 overflow-hidden">
        {/* Header */}
        <div className="py-4 px-6 border-b relative">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="text-yellow-500" size={20} />
            <h2 className="text-xl font-semibold">Leaderboard</h2>
          </div>
          
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 focus:outline-none"
            aria-label="Close leaderboard"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {sortedPlayers.length > 0 ? (
            <div className="space-y-3">
              {sortedPlayers.map((player, index) => (
                <div 
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-md ${
                    index === 0 ? 'bg-yellow-50 border border-yellow-200' : 
                    index === 1 ? 'bg-gray-50 border border-gray-200' : 
                    index === 2 ? 'bg-amber-50 border border-amber-200' : 
                    'bg-white border border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {index < 3 && (
                        <div className={`absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-500' : 
                          'bg-amber-600'
                        }`}>
                          {index + 1}
                        </div>
                      )}
                      <PlayerAvatar 
                        name={player.name} 
                        size="md" 
                        colorIndex={index} 
                      />
                    </div>
                    <div>
                      <div className="font-medium">{player.name}</div>
                      {player.isAdmin && (
                        <div className="text-xs text-gray-500">Game Admin</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && onAdjustScore && (
                      <button
                        onClick={() => onAdjustScore(player.id, -1)}
                        className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                        title="Subtract 1 point"
                        data-testid={`btn-minus-score-${player.id}`}
                      >
                        <Minus size={14} />
                      </button>
                    )}
                    <div className="text-lg font-semibold text-primary min-w-[60px] text-center">
                      {player.score} <span className="text-sm text-gray-500">pts</span>
                    </div>
                    {isAdmin && onAdjustScore && (
                      <button
                        onClick={() => onAdjustScore(player.id, 1)}
                        className="w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors"
                        title="Add 1 point"
                        data-testid={`btn-plus-score-${player.id}`}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No players in the game yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface LeaderboardProps {
  sendMessage?: (message: WebSocketMessage) => void;
  gameId?: number;
}

const Leaderboard = ({ sendMessage, gameId }: LeaderboardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { getPlayers, isAdmin } = useGameStore();
  const players = getPlayers();
  const userIsAdmin = isAdmin();

  const handleAdjustScore = (playerId: number, adjustment: number) => {
    if (sendMessage && gameId) {
      sendMessage({
        type: "adjustScore",
        payload: {
          gameId,
          playerId,
          adjustment,
        },
      });
    }
  };

  return (
    <>
      <Button 
        variant="default" 
        size="sm" 
        className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white"
        onClick={() => setIsOpen(true)}
        data-testid="btn-leaderboard"
      >
        <Trophy size={16} />
        <span>Leaderboard</span>
      </Button>
      
      <LeaderboardModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        players={players}
        isAdmin={userIsAdmin}
        onAdjustScore={sendMessage && gameId ? handleAdjustScore : undefined}
      />
    </>
  );
};

export default Leaderboard;