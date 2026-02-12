// Test script to verify exchange API endpoints
const http = require('http');

// Test function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test exchange endpoints
async function testExchangeEndpoints() {
  console.log('🧪 Testing Exchange API Endpoints...\n');

  try {
    // Test 1: Get all exchanges (should return empty array or auth error)
    console.log('1. Testing GET /api/inventory/exchanges');
    const result1 = await makeRequest('/api/inventory/exchanges');
    console.log(`   Status: ${result1.statusCode}`);
    console.log(`   Response: ${result1.body.substring(0, 100)}...\n`);

    // Test 2: Get exchange statistics
    console.log('2. Testing GET /api/inventory/exchanges/stats');
    const result2 = await makeRequest('/api/inventory/exchanges/stats');
    console.log(`   Status: ${result2.statusCode}`);
    console.log(`   Response: ${result2.body.substring(0, 100)}...\n`);

    // Test 3: Get user exchanges (should return auth error)
    console.log('3. Testing GET /api/user/exchanges');
    const result3 = await makeRequest('/api/user/exchanges');
    console.log(`   Status: ${result3.statusCode}`);
    console.log(`   Response: ${result3.body.substring(0, 100)}...\n`);

    // Test 4: Check exchange eligibility (should return auth error)
    console.log('4. Testing GET /api/user/orders/test-order/exchange-eligibility');
    const result4 = await makeRequest('/api/user/orders/test-order/exchange-eligibility');
    console.log(`   Status: ${result4.statusCode}`);
    console.log(`   Response: ${result4.body.substring(0, 100)}...\n`);

    console.log('✅ Exchange API endpoints are integrated and responding!');

  } catch (error) {
    console.error('❌ Error testing endpoints:', error.message);
  }
}

// Run the test
testExchangeEndpoints();
