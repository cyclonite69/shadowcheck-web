# Header Standardization Plan

## Problem
Pages have inconsistent headers due to:
1. Custom CSS conflicting with unified.css
2. Different HTML structures
3. JavaScript injection attempts

## Solution
Copy the EXACT header structure from admin.html to all pages.

## Working Template (from admin.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShadowCheck - [PAGE TITLE]</title>
    <link rel="stylesheet" href="/assets/styles/unified.css">
</head>
<body data-page="[pagename]">
    <div class="app-container">
        <header class="app-header">
            <div class="header-left">
                <div class="logo">SC</div>
                <span class="font-semibold">ShadowCheck</span>
            </div>
            <nav class="nav-links">
                <a href="/" class="nav-link">Dashboard</a>
                <a href="/networks.html" class="nav-link">Networks</a>
                <a href="/geospatial.html" class="nav-link">Geospatial</a>
                <a href="/surveillance.html" class="nav-link">Surveillance</a>
                <a href="/analytics.html" class="nav-link">Analytics</a>
                <a href="/admin.html" class="nav-link [active if this page]">Admin</a>
            </nav>
            <div class="header-right">
                <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span>Online</span>
                </div>
            </div>
        </header>

        <main class="app-main">
            <!-- PAGE CONTENT HERE -->
        </main>
    </div>
```

## Pages Status
- ✅ index.html - CORRECT
- ✅ admin.html - CORRECT (template source)
- ✅ ml-train.html - CORRECT
- ❌ networks.html - needs fix
- ❌ analytics.html - needs fix
- ❌ geospatial.html - needs fix
- ❌ surveillance.html - needs fix

## Fix Steps
For each broken page:
1. Remove ALL custom CSS in <style> tags
2. Keep ONLY: `<link rel="stylesheet" href="/assets/styles/unified.css">`
3. Replace header HTML with exact template above
4. Ensure body structure is: `<div class="app-container">` → `<header>` → `<main class="app-main">`
5. Close with `</main></div>`

## Key Rules
- NO custom CSS for layout/header
- NO JavaScript header injection
- NO duplicate unified.css links
- Header is HARDCODED in HTML
- All pages use IDENTICAL header HTML (only active class differs)
