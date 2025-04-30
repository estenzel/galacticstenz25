import React from "react";

interface GamePhaseIndicatorProps {
  currentPhase: number;
}

const GamePhaseIndicator: React.FC<GamePhaseIndicatorProps> = ({ currentPhase }) => {
  // Calculate width based on current phase
  const progressWidth = `${currentPhase * 25}%`;
  
  // Phase data
  const phases = [
    { number: 1, name: "Word", isActive: currentPhase >= 1 },
    { number: 2, name: "Define", isActive: currentPhase >= 2 },
    { number: 3, name: "Vote", isActive: currentPhase >= 3 },
    { number: 4, name: "Results", isActive: currentPhase >= 4 },
  ];

  return (
    <div className="relative mb-10">
      <div className="overflow-hidden h-2 mb-6 flex bg-gray-200 rounded">
        <div 
          className="bg-primary h-full rounded transition-all duration-500 ease-in-out" 
          style={{ width: progressWidth }}
        />
      </div>
      <div className="flex justify-between">
        {phases.map((phase) => (
          <div 
            key={phase.number} 
            className={`text-center ${phase.isActive ? 'text-primary' : 'text-gray-400'}`}
          >
            <div 
              className={`rounded-full h-10 w-10 flex items-center justify-center border-2 mx-auto transition-colors ${
                phase.isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-400 border-gray-300'
              }`}
            >
              {phase.number}
            </div>
            <p className="text-sm mt-1 font-medium">{phase.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamePhaseIndicator;
