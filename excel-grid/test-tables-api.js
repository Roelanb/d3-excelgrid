// Test file to demonstrate the /api/tables endpoint integration
import { fetchTablesFromApi, discoverSchemasAndTables } from './src/services/sqlRestApi';

async function testTablesApi() {
  console.log('Testing /api/tables endpoint integration...\n');
  
  try {
    // Test direct API call
    console.log('1. Testing fetchTablesFromApi():');
    const tablesFromApi = await fetchTablesFromApi();
    console.log(`   Found ${tablesFromApi.length} tables`);
    console.log('   First 5 tables:');
    tablesFromApi.slice(0, 5).forEach(table => {
      console.log(`   - ${table.displayName} (${table.schema}.${table.table})`);
    });
    
    console.log('\n2. Testing discoverSchemasAndTables():');
    const discoveredTables = await discoverSchemasAndTables();
    console.log(`   Found ${discoveredTables.length} tables`);
    
    // Verify both methods return the same results
    if (tablesFromApi.length === discoveredTables.length) {
      console.log('   ✅ Both methods return the same number of tables');
    } else {
      console.log('   ⚠️  Different number of tables returned');
    }
    
    console.log('\n3. Testing utility functions:');
    const uniqueSchemas = [...new Set(tablesFromApi.map(t => t.schema))];
    console.log(`   Unique schemas: ${uniqueSchemas.join(', ')}`);
    
    const personTables = tablesFromApi.filter(t => t.schema === 'Person');
    console.log(`   Person schema tables: ${personTables.map(t => t.table).join(', ')}`);
    
  } catch (error) {
    console.error('Error testing tables API:', error);
  }
}

// Run the test
testTablesApi();
