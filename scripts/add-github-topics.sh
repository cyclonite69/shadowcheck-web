#!/bin/bash
# save as: scripts/add-github-topics.sh
# usage: ./scripts/add-github-topics.sh

# Your repo details
OWNER="cyclonite69"
REPO="shadowcheck-static"

# Get token from git credentials
TOKEN=$(git config --get credential.https://github.com.username 2>/dev/null || git config --get github.token 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ No GitHub token found. Either:"
    echo "   export GITHUB_TOKEN=your_token"
    echo "   or configure: git config --global github.token your_token"
    exit 1
fi

# All your topics (top 20 most relevant)
TOPICS=(
  "nodejs"
  "postgresql"
  "javascript"
  "mapbox"
  "sigint"
  "wireless-security"
  "network-analysis"
  "cybersecurity"
  "forensics"
  "wigle"
  "wifi-analysis"
  "geospatial"
  "surveillance-detection"
  "machine-learning"
  "threat-detection"
  "visualization"
  "security-tools"
  "pentesting"
  "osint"
  "infosec"
)

# GitHub API call to add topics
curl -X PUT \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  -H "Authorization: token $TOKEN" \
  -d "$(printf '{\"names\": [%s]}' "$(printf '"%s",' "${TOPICS[@]}" | sed 's/,$//')")" \
  https://api.github.com/repos/$OWNER/$REPO/topics

echo "✅ Topics added to $OWNER/$REPO"
