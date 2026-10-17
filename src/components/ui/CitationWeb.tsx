import React from 'react';
import { motion } from 'motion/react';
import { SemanticNode } from '../../types';

const getNodeColor = (type: string) => {
  switch (type) {
    case 'primary': return '#ec4899'; // pink
    case 'government': return '#10b981'; // emerald
    case 'academic': return '#3b82f6'; // blue
    case 'official_doc': return '#8b5cf6'; // purple
    case 'industry': return '#f59e0b'; // amber
    case 'news': return '#06b6d4'; // cyan
    case 'foundational': return '#6366f1'; // indigo
    case 'draft': return '#ec4899';
    default: return '#22d3ee';
  }
};

export const CitationWeb = ({ nodes }: { nodes: SemanticNode[] }) => {
  if (!nodes || nodes.length === 0) return null;

  const width = 400;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;

  const nodePositions = nodes.map((node, index) => {
    if (index === 0) return { ...node, x: centerX, y: centerY };
    
    // Distribute around the center
    const angle = (index / (nodes.length - 1)) * Math.PI * 2;
    const radius = 95;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  return (
    <div className="relative w-full overflow-hidden flex flex-col items-center justify-center p-4 min-h-[300px]">
      <svg width="100%" height={260} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Draw connections */}
        {nodePositions.map(node => (
          node.connections.map(connId => {
            const target = nodePositions.find(n => n.id === connId);
            if (!target) return null;
            return (
              <motion.line
                key={`${node.id}-${connId}`}
                x1={node.x}
                y1={node.y}
                x2={target.x}
                y2={target.y}
                stroke="rgba(34, 211, 238, 0.35)"
                strokeWidth={1.5}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2 }}
              />
            );
          })
        ))}
        {/* Draw nodes */}
        {nodePositions.map((node, i) => (
          <motion.g 
            key={node.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15, type: 'spring' }}
            className="cursor-pointer group"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.type === 'primary' || node.type === 'draft' ? 12 : 8}
              fill={getNodeColor(node.type)}
              className="drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all group-hover:r-14"
            />
            <text
              x={node.x}
              y={node.y + 22}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              className="text-[10px] font-mono group-hover:fill-white group-hover:font-bold"
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={node.y + 32}
              textAnchor="middle"
              fill="rgba(255,255,255,0.4)"
              className="text-[8px] font-mono uppercase"
            >
              {node.type}
            </text>
          </motion.g>
        ))}
      </svg>

      {/* Semantic Category Legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-white/5 w-full text-[9px] font-mono text-white/50">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ec4899]" /> Primary</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Academic</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10b981]" /> Government</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> Official Doc</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Industry</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#06b6d4]" /> News</span>
      </div>
    </div>
  );
};
