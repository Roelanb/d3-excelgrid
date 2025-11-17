using FastEndpoints;
using SqlRest.Services;
using System.Text;

namespace SqlRest.Endpoints;

public class GenerateTestEndpoint : EndpointWithoutRequest
{
    private readonly DatabaseService _databaseService;

    public GenerateTestEndpoint(DatabaseService databaseService)
    {
        _databaseService = databaseService;
    }

    public override void Configure()
    {
        Get("/tables/{schema}/{table}/generate-tests");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var schema = Route<string>("schema")!;
        var table = Route<string>("table")!;

        try
        {
            // Get table schema to understand columns
            var tableSchema = await _databaseService.GetTableSchemaAsync(schema, table);
            
            var sb = new StringBuilder();
            sb.AppendLine($"### CRUD Operations for {schema}.{table}");
            sb.AppendLine($"### Generated on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            sb.AppendLine();
            sb.AppendLine("@baseUrl = http://localhost:5000");
            sb.AppendLine("@token = YOUR_JWT_TOKEN_HERE");
            sb.AppendLine();
            
            // Find primary key
            var pkColumn = tableSchema.Columns.FirstOrDefault(c => c.IsPrimaryKey);
            var pkName = pkColumn?.Name ?? "Id";
            
            // Generate example data based on column types
            var exampleData = new Dictionary<string, object?>();
            var updateData = new Dictionary<string, object?>();
            
            foreach (var column in tableSchema.Columns)
            {
                if (column.IsPrimaryKey)
                    continue; // Skip PK for insert
                
                var exampleValue = GenerateExampleValue(column.Name, column.Type);
                var updateValue = GenerateExampleValue(column.Name, column.Type, isUpdate: true);
                
                exampleData[column.Name] = exampleValue;
                updateData[column.Name] = updateValue;
            }
            
            // 1. GET ALL (with pagination)
            sb.AppendLine("### 1. Get All Records (Paginated)");
            sb.AppendLine($"GET {{{{baseUrl}}}}/api/{schema}/{table}?page=1&pageSize=10");
            sb.AppendLine("Authorization: Bearer {{token}}");
            sb.AppendLine();
            
            // 2. GET BY ID
            sb.AppendLine("### 2. Get Record by ID");
            sb.AppendLine($"GET {{{{baseUrl}}}}/api/{schema}/{table}/1");
            sb.AppendLine("Authorization: Bearer {{token}}");
            sb.AppendLine();
            
            // 3. CREATE
            sb.AppendLine("### 3. Create New Record");
            sb.AppendLine($"POST {{{{baseUrl}}}}/api/{schema}/{table}");
            sb.AppendLine("Authorization: Bearer {{token}}");
            sb.AppendLine("Content-Type: application/json");
            sb.AppendLine();
            sb.AppendLine("{");
            var dataItems = exampleData.Select(kvp => 
                $"  \"{kvp.Key}\": {FormatJsonValue(kvp.Value)}");
            sb.AppendLine(string.Join(",\n", dataItems));
            sb.AppendLine("}");
            sb.AppendLine();
            
            // 4. UPDATE
            sb.AppendLine("### 4. Update Existing Record");
            sb.AppendLine($"PUT {{{{baseUrl}}}}/api/{schema}/{table}/1");
            sb.AppendLine("Authorization: Bearer {{token}}");
            sb.AppendLine("Content-Type: application/json");
            sb.AppendLine();
            sb.AppendLine("{");
            var updateItems = updateData.Select(kvp => 
                $"  \"{kvp.Key}\": {FormatJsonValue(kvp.Value)}");
            sb.AppendLine(string.Join(",\n", updateItems));
            sb.AppendLine("}");
            sb.AppendLine();
            
            // 5. DELETE
            sb.AppendLine("### 5. Delete Record");
            sb.AppendLine($"DELETE {{{{baseUrl}}}}/api/{schema}/{table}/1");
            sb.AppendLine("Authorization: Bearer {{token}}");
            sb.AppendLine();
            
            // 6. Authentication
            sb.AppendLine("### 6. Get Authentication Token (Run this first!)");
            sb.AppendLine("POST {{baseUrl}}/api/auth/login");
            sb.AppendLine("Content-Type: application/json");
            sb.AppendLine();
            sb.AppendLine("{");
            sb.AppendLine("  \"username\": \"admin\",");
            sb.AppendLine("  \"password\": \"admin\"");
            sb.AppendLine("}");
            sb.AppendLine();
            
            // Additional notes
            sb.AppendLine("###");
            sb.AppendLine("### Notes:");
            sb.AppendLine($"### - Primary Key: {pkName}");
            sb.AppendLine("### - Replace '1' in URLs with actual record IDs");
            sb.AppendLine("### - Run the authentication request first to get a token");
            sb.AppendLine("### - Copy the token from the response and update @token variable");
            sb.AppendLine("### - Adjust example values as needed for your data");
            
            await SendStringAsync(sb.ToString(), contentType: "text/plain", cancellation: ct);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error generating test file");
            await SendErrorsAsync(cancellation: ct);
        }
    }
    
    private static object? GenerateExampleValue(string columnName, string columnType, bool isUpdate = false)
    {
        var lowerName = columnName.ToLower();
        var lowerType = columnType.ToLower();
        
        // Check column name patterns first
        if (lowerName.Contains("name"))
            return isUpdate ? "Updated Name" : "Example Name";
        if (lowerName.Contains("email"))
            return isUpdate ? "updated@example.com" : "test@example.com";
        if (lowerName.Contains("phone"))
            return isUpdate ? "+1-555-0199" : "+1-555-0100";
        if (lowerName.Contains("address"))
            return isUpdate ? "456 Updated St" : "123 Main St";
        if (lowerName.Contains("city"))
            return isUpdate ? "Los Angeles" : "New York";
        if (lowerName.Contains("state") || lowerName.Contains("province"))
            return isUpdate ? "CA" : "NY";
        if (lowerName.Contains("zip") || lowerName.Contains("postal"))
            return isUpdate ? "90001" : "10001";
        if (lowerName.Contains("country"))
            return isUpdate ? "Canada" : "USA";
        if (lowerName.Contains("description"))
            return isUpdate ? "Updated description text" : "Sample description text";
        if (lowerName.Contains("title"))
            return isUpdate ? "Updated Title" : "Sample Title";
        if (lowerName.Contains("price") || lowerName.Contains("amount") || lowerName.Contains("cost"))
            return isUpdate ? 199.99 : 99.99;
        if (lowerName.Contains("quantity") || lowerName.Contains("count"))
            return isUpdate ? 20 : 10;
        if (lowerName.Contains("active") || lowerName.Contains("enabled") || lowerName.Contains("isdeleted"))
            return isUpdate ? false : true;
        if (lowerName.Contains("date") || lowerName.Contains("time"))
            return isUpdate ? DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd") : DateTime.UtcNow.ToString("yyyy-MM-dd");
        
        // Fall back to type-based generation
        if (lowerType.Contains("int") || lowerType.Contains("number") || lowerType.Contains("decimal") || 
            lowerType.Contains("float") || lowerType.Contains("double") || lowerType.Contains("money"))
            return isUpdate ? 200 : 100;
        if (lowerType.Contains("bit") || lowerType.Contains("bool"))
            return true;
        if (lowerType.Contains("date") || lowerType.Contains("time"))
            return isUpdate ? DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd") : DateTime.UtcNow.ToString("yyyy-MM-dd");
        if (lowerType.Contains("guid") || lowerType.Contains("uniqueidentifier"))
            return Guid.NewGuid().ToString();
        
        // Default to string
        return isUpdate ? "Updated Value" : "Sample Value";
    }
    
    private static string FormatJsonValue(object? value)
    {
        if (value == null)
            return "null";
        if (value is string str)
            return $"\"{str}\"";
        if (value is bool b)
            return b.ToString().ToLower();
        if (value is DateTime dt)
            return $"\"{dt:yyyy-MM-dd}\"";
        
        return value.ToString() ?? "null";
    }
}
