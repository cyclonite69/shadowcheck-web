#!/usr/bin/env python3
"""Systematically fix headers across all pages to match admin.html template"""

PAGES = {
    'networks': {'title': 'Networks', 'data_page': 'networks'},
    'analytics': {'title': 'Analytics', 'data_page': 'analytics'},
    'geospatial': {'title': 'Geospatial', 'data_page': 'geospatial'},
    'surveillance': {'title': 'Surveillance', 'data_page': 'surveillance'},
}

HEADER_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShadowCheck - {title}</title>
    <link rel="stylesheet" href="/assets/styles/unified.css">
</head>
<body data-page="{data_page}">
    <div class="app-container">
        <header class="app-header">
            <div class="header-left">
                <div class="logo">SC</div>
                <span class="font-semibold">ShadowCheck</span>
            </div>
            <nav class="nav-links">
                <a href="/" class="nav-link{active_dashboard}">Dashboard</a>
                <a href="/networks.html" class="nav-link{active_networks}">Networks</a>
                <a href="/geospatial.html" class="nav-link{active_geospatial}">Geospatial</a>
                <a href="/surveillance.html" class="nav-link{active_surveillance}">Surveillance</a>
                <a href="/analytics.html" class="nav-link{active_analytics}">Analytics</a>
                <a href="/admin.html" class="nav-link{active_admin}">Admin</a>
            </nav>
            <div class="header-right">
                <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span>Online</span>
                </div>
            </div>
        </header>

        <main class="app-main">'''

for page_name, config in PAGES.items():
    filepath = f'/home/cyclonite01/ShadowCheckStatic/public/{page_name}.html'
    
    # Read current file
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Find where main content starts (after header)
    # Look for common patterns
    markers = ['<div class="main', '<main', '<!-- MAIN', '<div class="panel']
    content_start = -1
    
    for marker in markers:
        pos = content.find(marker)
        if pos > 0:
            content_start = pos
            break
    
    if content_start == -1:
        print(f"❌ {page_name}.html - Could not find content start")
        continue
    
    # Get everything after the header
    main_content = content[content_start:]
    
    # Build active classes
    active_classes = {
        'active_dashboard': '',
        'active_networks': '',
        'active_geospatial': '',
        'active_surveillance': '',
        'active_analytics': '',
        'active_admin': ''
    }
    active_classes[f'active_{page_name}'] = ' active'
    
    # Generate new header
    new_header = HEADER_TEMPLATE.format(
        title=config['title'],
        data_page=config['data_page'],
        **active_classes
    )
    
    # Combine
    new_content = new_header + '\n' + main_content
    
    # Write back
    with open(filepath, 'w') as f:
        f.write(new_content)
    
    print(f"✓ {page_name}.html - Header standardized")

print("\n✓ All headers standardized to match admin.html")
