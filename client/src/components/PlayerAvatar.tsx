import React from "react";

interface PlayerAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  colorIndex?: number;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ 
  name, 
  size = "md",
  colorIndex = 0 
}) => {
  // Define size classes
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };
  
  // Define colors for avatars
  const colors = [
    "bg-primary text-white",
    "bg-secondary text-white",
    "bg-accent text-white",
    "bg-emerald-500 text-white",
    "bg-red-500 text-white",
    "bg-amber-500 text-white",
    "bg-indigo-500 text-white",
    "bg-pink-500 text-white",
    "bg-teal-500 text-white",
  ];
  
  // Get initial letter from name
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  
  // Use a consistent color based on the name (hash the name to get a number)
  const nameHash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = colors[colorIndex || nameHash % colors.length];

  return (
    <div 
      className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center font-medium`}
      title={name}
    >
      {initial}
    </div>
  );
};

export default PlayerAvatar;
