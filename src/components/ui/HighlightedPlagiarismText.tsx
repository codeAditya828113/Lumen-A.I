import React from 'react';
import { cn } from '../../lib/utils';
import { ShieldAlert, AlertTriangle, AlertCircle } from 'lucide-react';

interface Match {
  source: string;
  url: string;
  similarity: number;
  explanation: string;
  matchedText: string;
  severity: 'low' | 'medium' | 'high';
}

interface HighlightedPlagiarismTextProps {
  text: string;
  matches?: Match[];
}

export const HighlightedPlagiarismText = ({ text, matches }: HighlightedPlagiarismTextProps) => {
  if (!matches || matches.length === 0) {
    return <p className="text-white/80 whitespace-pre-wrap font-mono text-sm leading-relaxed">{text}</p>;
  }

  let parts: { type: string; content: string; classes?: string; match?: Match }[] = [{ type: 'text', content: text, classes: '' }];
  
  matches.forEach(match => {
    if (!match.matchedText || match.matchedText.length < 5) return;
    const newParts: { type: string, content: string, classes?: string, match?: Match }[] = [];
    
    parts.forEach(part => {
      if (part.type !== 'text') {
        newParts.push(part);
        return;
      }
      
      // Simple case-insensitive search to be more forgiving
      const lowerPart = part.content.toLowerCase();
      const lowerSearch = match.matchedText.toLowerCase();
      const idx = lowerPart.indexOf(lowerSearch);
      
      if (idx !== -1) {
        if (idx > 0) newParts.push({ type: 'text', content: part.content.substring(0, idx) });
        
        let severityClass = "bg-red-500/30 text-red-100 border-red-500/50";
        if (match.severity === 'medium') severityClass = "bg-orange-500/30 text-orange-100 border-orange-500/50";
        if (match.severity === 'low') severityClass = "bg-yellow-500/30 text-yellow-100 border-yellow-500/50";

        newParts.push({ 
          type: 'highlight', 
          content: part.content.substring(idx, idx + match.matchedText.length), 
          classes: severityClass,
          match: match
        });
        
        if (idx + match.matchedText.length < part.content.length) {
          newParts.push({ type: 'text', content: part.content.substring(idx + match.matchedText.length) });
        }
      } else {
        newParts.push(part);
      }
    });
    parts = newParts;
  });

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'high': return <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />;
      case 'medium': return <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-orange-500" />;
      case 'low': return <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 bg-black/40 rounded-2xl border border-white/10 font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
      {parts.map((p, i) => {
         if (p.type === 'highlight' && p.match) {
           return (
             <span key={i} className={cn("inline-flex items-baseline px-1 mx-0.5 rounded border border-b-2 cursor-help transition-all hover:brightness-125 hover:-translate-y-0.5 relative group gap-1", p.classes)}>
               <span className="self-center">{getSeverityIcon(p.match.severity)}</span>
               <span className="inline-block">{p.content}</span>
               
               {/* Tooltip */}
               <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-4 bg-black/95 backdrop-blur-xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:-translate-y-1 translate-y-1 transition-all duration-300 z-[60] w-max max-w-[320px] flex flex-col gap-3 font-sans text-left">
                 
                 {/* Tooltip Header */}
                 <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                   <strong className="text-white text-xs font-display flex-1 truncate">{p.match.source}</strong>
                   <span className={cn(
                     "text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold self-start mt-0.5",
                     p.match.severity === 'high' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' :
                     p.match.severity === 'medium' ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50' :
                     'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50'
                   )}>
                     {p.match.severity} Match
                   </span>
                 </div>

                 {/* Tooltip URL */}
                 {p.match.url && (
                   <a 
                     href={p.match.url} 
                     target="_blank" 
                     rel="noreferrer"
                     className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline truncate transition-colors flex items-center gap-1.5"
                     onClick={(e) => e.stopPropagation()}
                   >
                     {p.match.url}
                   </a>
                 )}

                 {/* Tooltip Snippet */}
                 <div className="text-white/60 text-[11px] italic bg-white/5 p-3 rounded-lg border border-white/5 relative">
                   <div className="absolute top-0 bottom-0 left-0 w-1 bg-current opacity-30 rounded-l-lg" />
                   "...{p.match.matchedText}..."
                 </div>

                 {/* Tooltip Explanation */}
                 {p.match.explanation && (
                   <div className="text-white/80 text-[11.5px] leading-relaxed mt-1">
                     {p.match.explanation}
                   </div>
                 )}

                 {/* Tooltip Arrow */}
                 <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-white/20" />
                 <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-[7px] border-transparent border-t-black/95" />
               </span>
             </span>
           );
         }
         return <span key={i} className="text-white/80">{p.content}</span>;
      })}
    </div>
  );
};
