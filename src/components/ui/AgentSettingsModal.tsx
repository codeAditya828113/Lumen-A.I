import React from 'react';
import { Settings, Sliders, X, Sparkles, BookOpen, Layers, Check, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentSettings } from '../../types';
import { cn } from '../../lib/utils';

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AgentSettings;
  onSave: (newSettings: AgentSettings) => void;
  theme?: 'dark' | 'light';
}

export const AgentSettingsModal: React.FC<AgentSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  theme = 'dark',
}) => {
  const [localSettings, setLocalSettings] = React.useState<AgentSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={cn(
          "w-full max-w-lg rounded-2xl border backdrop-blur-2xl p-6 shadow-2xl relative space-y-6 overflow-hidden",
          theme === 'light'
            ? "bg-white/95 border-slate-200 text-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
            : "bg-black/90 border-cyan-500/30 text-white shadow-[0_0_50px_rgba(6,182,212,0.2)]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg tracking-wide uppercase">
                Agentic Engine Configuration
              </h3>
              <p className="text-xs font-mono text-cyan-400/80">Configure research depth, loop iterations & criteria</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 text-xs font-mono">
          {/* Research Depth */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="uppercase text-white/60 dark:text-white/60 font-bold">Research Depth Profile</span>
              <span className="text-cyan-400 uppercase font-bold">{localSettings.depth}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'quick', label: 'Quick', desc: 'Max 4 iterations', iter: 4 },
                { id: 'standard', label: 'Standard', desc: 'Max 6 iterations', iter: 6 },
                { id: 'deep', label: 'Deep', desc: 'Max 8 iterations', iter: 8 },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLocalSettings({
                    ...localSettings,
                    depth: opt.id as any,
                    maxIterations: opt.iter,
                  })}
                  className={cn(
                    "p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer text-center",
                    localSettings.depth === opt.id
                      ? (theme === 'light'
                        ? "bg-cyan-50 border-cyan-500 text-cyan-900 font-bold shadow-sm"
                        : "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]")
                      : (theme === 'light' ? "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10")
                  )}
                >
                  <span className="text-xs font-bold uppercase">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Source Preference */}
          <div className="space-y-2">
            <span className="uppercase text-white/60 dark:text-white/60 font-bold block">Source Preference Filter</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'general', label: 'General Authoritative', desc: 'Broad authoritative sources' },
                { id: 'academic', label: 'Peer-Reviewed / DOI', desc: 'Strict journal papers' },
                { id: 'authoritative', label: 'Gov / Standards', desc: 'OECD, WHO, IEEE, NIST' },
                { id: 'industry', label: 'Tech & Industry', desc: 'Patents, benchmarks, industry' },
              ].map((src) => (
                <button
                  key={src.id}
                  onClick={() => setLocalSettings({ ...localSettings, sourcePreference: src.id as any })}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    localSettings.sourcePreference === src.id
                      ? (theme === 'light'
                        ? "bg-purple-50 border-purple-500 text-purple-900 font-bold"
                        : "bg-purple-500/20 border-purple-400 text-purple-300 font-bold shadow-[0_0_15px_rgba(168,85,247,0.2)]")
                      : (theme === 'light' ? "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10")
                  )}
                >
                  <div className="font-bold">{src.label}</div>
                  <div className="text-[10px] opacity-70 font-sans mt-0.5">{src.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-white/10 dark:border-white/10">
            {/* Require Real Quantitative Data */}
            <label className="flex items-center justify-between p-3 rounded-xl border bg-white/5 dark:bg-white/5 border-white/10 cursor-pointer hover:border-cyan-500/40 transition-colors">
              <div>
                <div className="font-bold text-white/90 dark:text-white/90">Require Quantitative Metrics</div>
                <div className="text-[10px] text-white/50 dark:text-white/50 font-sans">
                  Forces agent to search empirical statistics before generating visualizations.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.requireQuantitativeData}
                onChange={(e) => setLocalSettings({ ...localSettings, requireQuantitativeData: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            {/* Recent Sources Only */}
            <label className="flex items-center justify-between p-3 rounded-xl border bg-white/5 dark:bg-white/5 border-white/10 cursor-pointer hover:border-cyan-500/40 transition-colors">
              <div>
                <div className="font-bold text-white/90 dark:text-white/90">Prioritize Recent Publications</div>
                <div className="text-[10px] text-white/50 dark:text-white/50 font-sans">
                  Focus query grounding on current findings and literature (past 2-3 years).
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.recentSourcesOnly}
                onChange={(e) => setLocalSettings({ ...localSettings, recentSourcesOnly: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10 dark:border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
          >
            Apply Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
};
