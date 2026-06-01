import React from 'react';
import { motion } from 'motion/react';
import { FileText, Shield, CreditCard, Check } from 'lucide-react';
import { STAGES } from './constants';

interface Props {
  currentStage: number;
  currentSubStep: number;
  completedStages: number[];
  theme: string;
}

const stageIcons = [FileText, Shield, CreditCard];

export default function ProgressStepper({ currentStage, currentSubStep, completedStages, theme }: Props) {
  return (
    <div className="mb-6">
      {/* Stage indicators */}
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {STAGES.map((stage, idx) => {
          const stageNum = stage.number;
          const isActive = currentStage === stageNum;
          const isCompleted = completedStages.includes(stageNum);
          const isPending = !isActive && !isCompleted;
          const Icon = stageIcons[idx];

          return (
            <React.Fragment key={stageNum}>
              {idx > 0 && (
                <div className="flex-1 h-0.5 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: isCompleted || (currentStage > stageNum)
                      ? 'var(--accent-color)'
                      : 'var(--border-subtle)',
                  }}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: isCompleted
                      ? 'rgba(34,197,94,0.15)'
                      : isActive
                        ? 'var(--accent-glow)'
                        : 'rgba(255,255,255,0.05)',
                    border: isActive ? '2px solid var(--accent-color)' : '1px solid var(--border-subtle)',
                    color: isCompleted
                      ? '#22c55e'
                      : isActive
                        ? 'var(--accent-color)'
                        : 'var(--text-tertiary)',
                  }}
                  animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                </motion.div>
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs font-semibold leading-tight"
                    style={{ color: isActive ? 'var(--accent-color)' : isCompleted ? '#22c55e' : 'var(--text-tertiary)' }}>
                    {stage.label}
                  </p>
                  <p className="text-[9px] sm:text-[10px] leading-tight mt-0.5 hidden sm:block"
                    style={{ color: 'var(--text-tertiary)' }}>
                    {stage.sublabel}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Sub-step progress bar (only for Stage 1 which has 6 sub-steps) */}
      {currentStage === 1 && (
        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: STAGES[0].subSteps }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{
                backgroundColor: i < currentSubStep
                  ? 'var(--accent-color)'
                  : i === currentSubStep - 1
                    ? 'var(--accent-color)'
                    : 'var(--border-subtle)',
                opacity: i < currentSubStep ? 1 : 0.4,
              }}
            />
          ))}
          <span className="text-[10px] ml-1 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {currentSubStep}/6
          </span>
        </div>
      )}
    </div>
  );
}
