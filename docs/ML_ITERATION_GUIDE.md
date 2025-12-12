# ML Model Iteration Guide

## Overview

The `ml-iterate.py` script tests multiple machine learning algorithms with hyperparameter tuning to find the best threat detection model.

## Features

- **Multiple Algorithms:**
  - Logistic Regression
  - Random Forest
  - Gradient Boosting

- **Hyperparameter Tuning:**
  - Grid search with 5-fold cross-validation
  - ROC-AUC optimization

- **Comprehensive Evaluation:**
  - Accuracy, ROC-AUC, cross-validation scores
  - Classification reports
  - Feature importance analysis
  - Confusion matrices

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Run ML iteration
python3 ml-iterate.py

# Or make it executable and run directly
chmod +x ml-iterate.py
./ml-iterate.py
```

## Requirements

- At least 10 tagged networks (THREAT or FALSE_POSITIVE)
- PostgreSQL database with tagged data
- `.env` file with database credentials

## Output

The script generates:

- Console output with model comparison
- `ml_iteration_results.json` with detailed results

### Example Output

```
🤖 Starting ML Model Iteration

✓ Fetched 45 tagged networks
  THREAT: 23
  FALSE_POSITIVE: 22

📊 Dataset Split:
  Training: 36 samples
  Testing: 9 samples

🔍 Testing Logistic Regression...
  ✓ Accuracy: 0.889, ROC-AUC: 0.923

🌲 Testing Random Forest...
  ✓ Accuracy: 0.944, ROC-AUC: 0.967

⚡ Testing Gradient Boosting...
  ✓ Accuracy: 0.933, ROC-AUC: 0.956

🏆 Best Model: Random Forest
  ROC-AUC: 0.967
  Accuracy: 0.944
  Best Params: {'max_depth': 5, 'min_samples_split': 2, 'n_estimators': 100}

🎯 Feature Importance:
  distance_range_km: 0.3245
  unique_days: 0.2134
  observation_count: 0.1876
  ...
```

## Hyperparameter Grids

### Logistic Regression

- C: [0.01, 0.1, 1, 10, 100]
- penalty: ['l2']
- max_iter: [1000]

### Random Forest

- n_estimators: [50, 100, 200]
- max_depth: [3, 5, 7, None]
- min_samples_split: [2, 5, 10]

### Gradient Boosting

- n_estimators: [50, 100, 200]
- learning_rate: [0.01, 0.1, 0.2]
- max_depth: [3, 5, 7]

## Features Used

1. **distance_range_km** - Max distance between observations
2. **unique_days** - Days network was observed
3. **observation_count** - Total observations
4. **max_signal** - Strongest signal strength
5. **unique_locations** - Distinct locations
6. **seen_at_home** - Observed near home (binary)
7. **seen_away_from_home** - Observed away from home (binary)

## Integration with Node.js

After finding the best model, you can:

1. Export model coefficients to SQL
2. Update `ml-trainer.js` with best hyperparameters
3. Store results in `app.ml_model_config` table

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

### Import Error

```
ModuleNotFoundError: No module named 'sklearn'
```

**Solution:** Run `pip install -r requirements.txt`

## Advanced Usage

### Custom Hyperparameters

Edit the `param_grid` dictionaries in each test method:

```python
param_grid = {
    'n_estimators': [100, 200, 300],  # Add more values
    'max_depth': [5, 10, 15],
    'min_samples_split': [2, 5]
}
```

### Add New Algorithms

```python
def test_svm(self, X_train, X_test, y_train, y_test):
    from sklearn.svm import SVC

    param_grid = {
        'C': [0.1, 1, 10],
        'kernel': ['rbf', 'linear']
    }

    model = GridSearchCV(SVC(probability=True), param_grid, cv=5)
    model.fit(X_train, y_train)
    # ... rest of implementation
```

## Performance Tips

- More tagged data = better models
- Balance THREAT and FALSE_POSITIVE tags
- Run multiple iterations to verify consistency
- Use cross-validation scores to avoid overfitting

## Next Steps

1. Run iteration script regularly as you tag more networks
2. Compare results over time
3. Deploy best model to production
4. Monitor model performance with real data
