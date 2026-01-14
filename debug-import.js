#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read one JSON file and examine the first network
const jsonFile = path.join(__dirname, 'wigle api v2 responses', 'response_1768305506364.json');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const network = data.results[0];

console.log('First network data:');
console.log(JSON.stringify(network, null, 2));

console.log('\nParameter values:');
console.log('1. bssid:', network.netid);
console.log('2. ssid:', network.ssid);
console.log('3. qos:', network.qos);
console.log('4. transid:', network.transid);
console.log('5. firsttime:', network.firsttime);
console.log('6. lasttime:', network.lasttime);
console.log('7. lastupdt:', network.lastupdt);
console.log('8. housenumber:', network.housenumber);
console.log('9. road:', network.road);
console.log('10. city:', network.city);
console.log('11. region:', network.region);
console.log('12. country:', network.country);
console.log('13. postalcode:', network.postalcode);
console.log('14. trilat:', parseFloat(network.trilat), typeof parseFloat(network.trilat));
console.log('15. trilong:', parseFloat(network.trilong), typeof parseFloat(network.trilong));
console.log('16. dhcp:', network.dhcp);
console.log('17. paynet:', network.paynet);
console.log('18. userfound:', network.userfound === true, typeof (network.userfound === true));
console.log('19. channel:', network.channel);
console.log('20. encryption:', network.encryption);
console.log('21. freenet:', network.freenet);
console.log('22. comment:', network.comment);
console.log('23. wep:', network.wep);
console.log('24. bcninterval:', network.bcninterval);
console.log('25. type:', network.type);
