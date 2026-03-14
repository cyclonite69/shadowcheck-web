# Machine Learning

**Docs references (repo):** [docs/FEATURES.md](../../docs/FEATURES.md)

> **ML-powered threat detection system**

---

## Overview

ShadowCheck includes multi-algorithm threat detection with model training and hyperparameter optimization.

---

## Training Endpoint

```bash
# Train model on tagged networks
curl -X POST http://localhost:3001/api/ml/train \
  -H "x-api-key: your-key"
```

**Response:**

```json
{
  "ok": true,
  "model": {
    "type": "logistic_regression",
    "accuracy": 0.92,
    "precision": 0.88,
    "recall": 0.95,
    "f1": 0.91,
    "rocAuc": 0.94
  },
  "trainingData": {
    "totalNetworks": 45,
    "threats": 18,
    "falsePositives": 27
  }
}
```

---

## ML Model Iteration

Test multiple algorithms with hyperparameter tuning:

```bash
pip install -r scripts/ml/requirements.txt
python3 scripts/ml/ml-iterate.py
```

### Supported Algorithms

- **Logistic Regression**
- **Random Forest**
- **Gradient Boosting**

### Hyperparameter Tuning

- Grid search with 5-fold cross-validation
- ROC-AUC optimization

---

## Features Used for Training

| Feature               | Description                       |
| --------------------- | --------------------------------- |
| `distance_range_km`   | Max distance between observations |
| `unique_days`         | Days network was observed         |
| `observation_count`   | Total observations                |
| `max_signal`          | Strongest signal strength         |
| `unique_locations`    | Distinct locations                |
| `seen_at_home`        | Observed near home (binary)       |
| `seen_away_from_home` | Observed away from home (binary)  |

---

## Model Status

```bash
curl http://localhost:3001/api/ml/status
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "model_trained": true,
    "last_training": "2025-12-02T06:00:00Z",
    "training_samples": 156,
    "tagged_networks": {
      "LEGIT": 89,
      "FALSE_POSITIVE": 12,
      "INVESTIGATE": 34,
      "THREAT": 21
    }
  }
}
```

---

## Predict Threat

```bash
curl http://localhost:3001/api/ml/predict/:bssid
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "bssid": "AA:BB:CC:DD:EE:FF",
    "ml_prediction": 0.87,
    "classification": "THREAT",
    "confidence": "HIGH",
    "features": {
      "distance_range": 2.5,
      "observation_count": 45,
      "unique_days": 8
    }
  }
}
```

---

## Tagging Networks

Networks must be tagged for training:

```bash
# Tag as threat
curl -X POST http://localhost:3001/api/network-tags/AA:BB:CC:DD:EE:FF \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{
    "threat_tag": "THREAT",
    "threat_confidence": 0.9,
    "notes": "Confirmed tracking device"
  }'
```

**Tag Types:**

- `THREAT` - Confirmed threat
- `FALSE_POSITIVE` - Incorrectly flagged
- `INVESTIGATE` - Requires investigation
- `LEGIT` - Known safe network

---

## Requirements

- Minimum 10 tagged networks
- At least 2 different tag types (LEGIT vs THREAT/INVESTIGATE)

---

## Troubleshooting

### Not Enough Data

```
❌ Need at least 10 tagged networks, found 5
```

**Solution:** Tag more networks using the UI or API

### Database Connection Error

```
psycopg2.OperationalError: could not connect to server
```

**Solution:** Check `.env` file and database credentials

---

## Related Documentation

- [ML Iteration Guide](https://github.com/cyclonite69/shadowcheck-web/blob/main/docs/ML_ITERATION_GUIDE.md) - Detailed ML guide
- [API Reference](API-Reference) - ML API endpoints
