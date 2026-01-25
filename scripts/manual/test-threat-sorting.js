#!/usr/bin/env node

// Simple test script to verify threat sorting works
// Usage: node test-threat-sorting.js

const BASE_URL = 'http://localhost:3001';

async function testThreatSorting() {
  console.log('🧪 Testing Threat Column Sorting...\n');

  try {
    // Test threat level sorting (descending - CRITICAL first)
    console.log('1. Testing threat level sorting (desc):');
    const threatDescResponse = await fetch(
      `${BASE_URL}/api/explorer/networks-v2?sort=threat&order=desc&limit=10`
    );
    const threatDescData = await threatDescResponse.json();

    if (threatDescData.rows) {
      threatDescData.rows.slice(0, 5).forEach((row, i) => {
        const level = row.threat?.level || 'NONE';
        const score = row.threat?.score || 0;
        console.log(
          `  ${i + 1}. ${row.bssid} - Level: ${level}, Score: ${(score * 100).toFixed(1)}%`
        );
      });
    }

    console.log('\n2. Testing threat level sorting (asc):');
    const threatAscResponse = await fetch(
      `${BASE_URL}/api/explorer/networks-v2?sort=threat&order=asc&limit=10`
    );
    const threatAscData = await threatAscResponse.json();

    if (threatAscData.rows) {
      threatAscData.rows.slice(0, 5).forEach((row, i) => {
        const level = row.threat?.level || 'NONE';
        const score = row.threat?.score || 0;
        console.log(
          `  ${i + 1}. ${row.bssid} - Level: ${level}, Score: ${(score * 100).toFixed(1)}%`
        );
      });
    }

    console.log('\n3. Testing threat score sorting (desc):');
    const scoreDescResponse = await fetch(
      `${BASE_URL}/api/explorer/networks-v2?sort=threat_score&order=desc&limit=10`
    );
    const scoreDescData = await scoreDescResponse.json();

    if (scoreDescData.rows) {
      scoreDescData.rows.slice(0, 5).forEach((row, i) => {
        const level = row.threat?.level || 'NONE';
        const score = row.threat?.score || 0;
        console.log(
          `  ${i + 1}. ${row.bssid} - Level: ${level}, Score: ${(score * 100).toFixed(1)}%`
        );
      });
    }

    console.log('\n✅ Threat sorting test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testThreatSorting();
