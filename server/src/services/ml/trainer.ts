import LogisticRegression from 'ml-logistic-regression';
import { Matrix } from 'ml-matrix';

interface NetworkData {
  distance_range_km: string | number;
  unique_days: string | number;
  observation_count: string | number;
  max_signal: string | number;
  unique_locations: string | number;
  seen_at_home: boolean;
  seen_away_from_home: boolean;
  tag_type: 'THREAT' | 'FALSE_POSITIVE';
}

interface TrainingResult {
  coefficients: number[];
  intercept: number;
  featureNames: string[];
  trainingSamples: number;
  threatCount: number;
  safeCount: number;
}

class ThreatMLModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  private coefficients: number[] | null = null;
  private intercept: number | null = null;
  private readonly featureNames: string[] = [
    'distance_range_km',
    'unique_days',
    'observation_count',
    'max_signal',
    'unique_locations',
    'seen_both_locations',
  ];

  extractFeatures(network: NetworkData): number[] {
    return [
      parseFloat(network.distance_range_km as string) || 0,
      parseInt(network.unique_days as string) || 0,
      parseInt(network.observation_count as string) || 0,
      parseFloat(network.max_signal as string) || -100,
      parseInt(network.unique_locations as string) || 0,
      network.seen_at_home && network.seen_away_from_home ? 1 : 0,
    ];
  }

  async train(taggedNetworks: NetworkData[]): Promise<TrainingResult> {
    if (taggedNetworks.length < 10) {
      throw new Error('Need at least 10 tagged networks to train');
    }

    const X: number[][] = [];
    const y: number[] = [];

    taggedNetworks.forEach((net) => {
      X.push(this.extractFeatures(net));
      y.push(net.tag_type === 'THREAT' ? 1 : 0);
    });

    const xMatrix = new Matrix(X);
    const yMatrix = Matrix.columnVector(y);

    this.model = new LogisticRegression({ numSteps: 1000, learningRate: 0.01 });
    this.model.train(xMatrix, yMatrix);

    const classifier = this.model.classifiers[0];
    if (!classifier.weights) {
      throw new Error('Model training failed: no weights found');
    }

    this.coefficients = Array.from(classifier.weights.to1DArray());
    this.intercept = classifier.bias || 0;

    return {
      coefficients: this.coefficients,
      intercept: this.intercept ?? 0,
      featureNames: this.featureNames,
      trainingSamples: taggedNetworks.length,
      threatCount: y.filter((label) => label === 1).length,
      safeCount: y.filter((label) => label === 0).length,
    };
  }

  predict(features: number[]): number {
    if (!this.model) {
      throw new Error('Model not trained yet');
    }
    const prediction = this.model.predict([features])[0];
    return Math.round(prediction * 100);
  }

  generateSQLFormula(): string | null {
    if (!this.coefficients || this.intercept === null) {
      return null;
    }

    const terms = this.featureNames.map((name, i) => {
      const coef = this.coefficients![i].toFixed(4);
      const sqlField = this.getSQLFieldName(name);
      return `(${coef} * ${sqlField})`;
    });

    return `(${this.intercept.toFixed(4)} + ${terms.join(' + ')}) * 100`;
  }

  private getSQLFieldName(featureName: string): string {
    const mapping: Record<string, string> = {
      distance_range_km: '(ns.max_distance_from_home_km - ns.min_distance_from_home_km)',
      unique_days: 'ns.unique_days',
      observation_count: 'ns.observation_count',
      max_signal: 'COALESCE(ns.max_signal, -100)',
      unique_locations: 'ns.unique_locations',
      seen_both_locations: 'CASE WHEN ns.seen_at_home AND ns.seen_away_from_home THEN 1 ELSE 0 END',
    };
    return mapping[featureName];
  }
}

export default ThreatMLModel;
