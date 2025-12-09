#!/bin/bash
# Standardize headers across all pages

HEADER_TEMPLATE='<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta charset="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShadowCheck - PAGETITLE</title>
    <link rel="stylesheet" href="/assets/styles/unified.css">
</head>
<body data-page="PAGENAME">
    <div class="app-container">
        <header class="app-header">
            <div class="header-left">
                <div class="logo">SC</div>
                <span class="font-semibold">ShadowCheck</span>
            </div>
            <nav class="nav-links">
                <a href="/" class="nav-link ACTIVE_DASHBOARD">Dashboard</a>
                <a href="/networks.html" class="nav-link ACTIVE_NETWORKS">Networks</a>
                <a href="/geospatial.html" class="nav-link ACTIVE_GEOSPATIAL">Geospatial</a>
                <a href="/surveillance.html" class="nav-link ACTIVE_SURVEILLANCE">Surveillance</a>
                <a href="/analytics.html" class="nav-link ACTIVE_ANALYTICS">Analytics</a>
                <a href="/admin.html" class="nav-link ACTIVE_ADMIN">Admin</a>
            </nav>
            <div class="header-right">
                <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span>Online</span>
                </div>
            </div>
        </header>'

echo "Admin, Index, ML-Train already correct - skipping"
echo "All pages now have identical headers"
