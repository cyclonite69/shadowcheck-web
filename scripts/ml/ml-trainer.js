// Machine Learning Threat Scoring Model
const LogisticRegression = require('ml-logistic-regression');
const { Matrix } = require('ml-matrix');

class ThreatMLModel {
  constructor() {
    this.model = null;
    this.coefficients = null;
    this.intercept = null;
    this.featureNames = [
      'distance_range_km',
      'unique_days',
      'observation_count',
      'max_signal',
      'unique_locations',
      'seen_both_locations',
    ];
  }

  // Extract features from network data
  extractFeatures(network) {
    return [
      parseFloat(network.distance_range_km) || 0,
      parseInt(network.unique_days) || 0,
      parseInt(network.observation_count) || 0,
      parseFloat(network.max_signal) || -100,
      parseInt(network.unique_locations) || 0,
      network.seen_at_home && network.seen_away_from_home ? 1 : 0,
    ];
  }

  // Train model on tagged networks
  async train(taggedNetworks) {
    console.log('ML train() called with', taggedNetworks.length, 'networks');

    if (taggedNetworks.length < 10) {
      throw new Error('Need at least 10 tagged networks to train');
    }

    // Prepare training data
    const X = []; // Features
    const y = []; // Labels (1 = THREAT, 0 = FALSE_POSITIVE)

    taggedNetworks.forEach((net) => {
      X.push(this.extractFeatures(net));
      y.push([net.tag_type === 'THREAT' ? 1 : 0]);
    });

    console.log('Training with X:', X.length, 'samples, y:', y.length, 'labels');

    // Train logistic regression with Matrix objects
    const XMatrix = new Matrix(X);
    const YMatrix = Matrix.columnVector(y.flat());

    console.log('Created matrices, training...');
    this.model = new LogisticRegression({ numSteps: 1000, learningRate: 0.01 });
    this.model.train(XMatrix, YMatrix);

    // Store coefficients for SQL usage
    console.log('Model keys:', Object.keys(this.model));
    console.log('Model classifiers:', this.model.classifiers);

    // For binary classification, get the first classifier
    const classifier = this.model.classifiers[0];
    console.log('Classifier keys:', Object.keys(classifier));

    if (!classifier.weights) {
      throw new Error('Model training failed: no weights found');
    }

    this.coefficients = Array.from(classifier.weights.to1DArray());
    this.intercept = classifier.bias || 0;

    console.log('Extracted coefficients:', this.coefficients);
    console.log('Extracted intercept:', this.intercept);

    return {
      coefficients: this.coefficients,
      intercept: this.intercept,
      featureNames: this.featureNames,
      trainingSamples: taggedNetworks.length,
      threatCount: y.flat().filter((label) => label === 1).length,
      safeCount: y.flat().filter((label) => label === 0).length,
    };
  }

  // Predict threat score (0-100)
  predict(features) {
    if (!this.model) {
      throw new Error('Model not trained yet');
    }
    const prediction = this.model.predict([features])[0];
    return Math.round(prediction * 100); // Convert to 0-100 scale
  }

  // Generate SQL formula using learned coefficients
  generateSQLFormula() {
    if (!this.coefficients) {
      return null;
    }

    const terms = this.featureNames.map((name, i) => {
      const coef = this.coefficients[i].toFixed(4);
      const sqlField = this.getSQLFieldName(name);
      return `(${coef} * ${sqlField})`;
    });

    return `(${this.intercept.toFixed(4)} + ${terms.join(' + ')}) * 100`;
  }

  getSQLFieldName(featureName) {
    const mapping = {
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

module.exports = ThreatMLModel;
