namespace SqlRest.Models;

public class ColumnInfo
{
    public string ColumnName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public bool IsNullable { get; set; }
    public bool IsPrimaryKey { get; set; }
    public bool IsIdentity { get; set; }
    public int MaxLength { get; set; }
    public string PropertyName => ToPascalCase(ColumnName);
    
    private static string ToPascalCase(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        
        var words = input.Split('_', StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(words.Select(word => 
            char.ToUpperInvariant(word[0]) + word.Substring(1).ToLowerInvariant()));
    }
}
