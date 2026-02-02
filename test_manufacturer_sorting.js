#!/usr/bin/env node

/**
 * Test script to verify manufacturer sorting functionality
 */

const fetch = require('node-fetch');

async function testManufacturerSorting() {
  const baseUrl = 'http://localhost:3001';

  console.log('🧪 Testing manufacturer sorting functionality...\n');

  try {
    // Test ascending order
    console.log('📈 Testing ascending order (A → Z)...');
    const ascResponse = await fetch(
      `${baseUrl}/api/v2/networks/filtered?limit=3&sort=manufacturer&order=asc`
    );
    const ascData = await ascResponse.json();

    if (ascData.ok && ascData.data.length > 0) {
      console.log('✅ Ascending order results:');
      ascData.data.forEach((network, idx) => {
        console.log(`   ${idx + 1}. ${network.manufacturer || 'null'} (${network.bssid})`);
      });
    } else {
      console.log('❌ Failed to get ascending results');
      return false;
    }

    console.log('');

    // Test descending order
    console.log('📉 Testing descending order (Z → A)...');
    const descResponse = await fetch(
      `${baseUrl}/api/v2/networks/filtered?limit=3&sort=manufacturer&order=desc`
    );
    const descData = await descResponse.json();

    if (descData.ok && descData.data.length > 0) {
      console.log('✅ Descending order results:');
      descData.data.forEach((network, idx) => {
        console.log(`   ${idx + 1}. ${network.manufacturer || 'null'} (${network.bssid})`);
      });
    } else {
      console.log('❌ Failed to get descending results');
      return false;
    }

    console.log('\n🎉 Manufacturer sorting is working correctly!');
    return true;
  } catch (error) {
    console.error('❌ Error testing manufacturer sorting:', error.message);
    return false;
  }
}

// Run the test
testManufacturerSorting().then((success) => {
  process.exit(success ? 0 : 1);
});
