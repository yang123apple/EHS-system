import { CheckCircle, Circle, XCircle, Clock } from 'lucide-react';
import { WorkflowStepConfig, WorkflowStatus } from '@/types/workflow';

interface Props {
  steps: WorkflowStepConfig[];
  currentStepIndex: number;
  status: string;
}

export default function WorkflowSteps({ steps, currentStepIndex, status }: Props) {
  return (
    <div className="flex items-center justify-between w-full px-4 py-6 bg-slate-50 mb-4 rounded-lg overflow-x-auto">
      {steps.map((step, idx) => {
        let state = 'waiting'; // waiting, current, finished, error
        if (status === WorkflowStatus.REJECTED && idx === currentStepIndex) state = 'error';
        else if (status === WorkflowStatus.APPROVED) state = 'finished';
        else if (idx < currentStepIndex) state = 'finished';
        else if (idx === currentStepIndex) state = 'current';

        return (
          <div key={step.stepIndex} className="flex flex-col items-center relative flex-1 min-w-[80px]">
            {/* 连接线 */}
            {idx !== 0 && (
              <div className={`absolute top-3 right-[50%] w-full h-[2px] -z-10 
                ${idx <= currentStepIndex ? 'bg-blue-500' : 'bg-slate-200'}`} 
              />
            )}
            
            <div className="mb-2 bg-white z-10">
              {state === 'finished' && <CheckCircle className="text-green-500" size={24} />}
              {state === 'error' && <XCircle className="text-red-500" size={24} />}
              {state === 'current' && <Clock className="text-blue-600 animate-pulse" size={24} />}
              {state === 'waiting' && <Circle className="text-slate-300" size={24} />}
            </div>
            
            <span className={`text-xs font-medium text-center ${state === 'current' ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
              {step.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}