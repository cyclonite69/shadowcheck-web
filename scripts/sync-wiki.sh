#!/bin/bash
set -e

echo "🚀 ShadowCheck Wiki Sync Script"
echo "================================"
echo ""

# Check if wiki is initialized
echo "📋 Step 1: Checking if GitHub wiki is initialized..."
if git ls-remote https://github.com/cyclonite69/shadowcheck-web.wiki.git &>/dev/null; then
    echo "✅ Wiki repository found"
else
    echo "❌ Wiki not initialized yet!"
    echo ""
    echo "Please initialize the wiki first:"
    echo "1. Go to: https://github.com/cyclonite69/shadowcheck-web"
    echo "2. Click the 'Wiki' tab"
    echo "3. Click 'Create the first page'"
    echo "4. Add any content and save"
    echo "5. Run this script again"
    exit 1
fi

# Clone wiki repo
echo ""
echo "📥 Step 2: Cloning wiki repository..."
cd /tmp
rm -rf shadowcheck-web.wiki
git clone https://github.com/cyclonite69/shadowcheck-web.wiki.git
cd shadowcheck-web.wiki

# Copy wiki files
echo ""
echo "📝 Step 3: Copying wiki files..."
cp /home/cyclonite01/ShadowCheckStatic/.github/wiki/*.md .
echo "✅ Copied $(ls -1 *.md | wc -l) markdown files"

# Commit and push
echo ""
echo "📤 Step 4: Pushing to GitHub..."
git add .
git commit -m "Add comprehensive wiki with 50+ diagrams

- Architecture diagrams (system, component, deployment)
- Data flow visualizations (13+ diagrams)
- Deployment guides (local, Docker, AWS)
- API reference with flow diagrams
- Feature catalog with visual explanations
- Quick reference navigation guide"

git push origin master

echo ""
echo "✅ Wiki sync complete!"
echo ""
echo "View your wiki at: https://github.com/cyclonite69/shadowcheck-web/wiki"
