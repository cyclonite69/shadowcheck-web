import React, { useEffect } from 'react';
import { useMLTraining } from '../hooks/useMLTraining';
import { ModelOperationsCard } from './ml/ModelOperationsCard';
import { TrainingDataCard } from './ml/TrainingDataCard';
import { ModelStatusCard } from './ml/ModelStatusCard';

export const MLTrainingTab: React.FC = () => {
  const { mlStatus, mlLoading, mlResult, loadMLStatus, trainModel, recalculateScores } =
    useMLTraining();

  useEffect(() => {
    loadMLStatus();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ModelOperationsCard
        mlLoading={mlLoading}
        mlStatus={mlStatus}
        mlResult={mlResult}
        trainModel={trainModel}
        recalculateScores={recalculateScores}
      />
      <TrainingDataCard mlStatus={mlStatus} />
      <ModelStatusCard mlStatus={mlStatus} />
    </div>
  );
};

export default MLTrainingTab;
