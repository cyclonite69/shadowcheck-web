#!/bin/bash
# Audit ShadowCheck pages for layout compliance

echo "=== ShadowCheck Page Layout Audit ==="
echo ""

for file in public/*.html; do
    [ -f "$file" ] || continue
    echo "📄 $file"
    
    # Check for unified.css
    if grep -q "unified.css" "$file"; then
        echo "  ✅ Uses unified.css"
    else
        echo "  ❌ Missing unified.css"
    fi
    
    # Check for inline styles
    if grep -q "<style>" "$file"; then
        echo "  ⚠️  Has inline <style> tags"
    fi
    
    # Check for app-container
    if grep -q "app-container" "$file"; then
        echo "  ✅ Uses app-container"
    else
        echo "  ❌ Missing app-container"
    fi
    
    # Check for old CSS
    if grep -q "main.css\|theme.css\|components.css\|layout.css" "$file"; then
        echo "  ⚠️  Uses old CSS files"
    fi
    
    echo ""
done

echo "=== Summary ==="
echo "Run: ./refactor-page.sh <filename> to fix a page"
