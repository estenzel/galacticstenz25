import React, { useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/lib/gameState';
import PlayerAvatar from './PlayerAvatar';
import { Player } from '@shared/schema';

// Create a custom modal component
// Define the type for our modal props
interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
}

// Create the modal component
const LeaderboardModal = ({ isOpen, onClose, players }: LeaderboardModalProps) => {
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
                  <div className="text-lg font-semibold text-primary">
                    {player.score} <span className="text-sm text-gray-500">pts</span>
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

const Leaderboard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { getPlayers } = useGameStore();
  const players = getPlayers();

  return (
    <>
      <Button 
        variant="default" 
        size="sm" 
        className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white"
        onClick={() => setIsOpen(true)}
      >
        <Trophy size={16} />
        <span>Leaderboard</span>
      </Button>
      
      <LeaderboardModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        players={players}
      />
    </>
  );
};

export default Leaderboard;