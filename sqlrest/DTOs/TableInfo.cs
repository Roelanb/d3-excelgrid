namespace SqlRest.DTOs;

public class TableInfo
{
    public string Schema { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string FullName => $"{Schema}.{Name}";
}

public class TablesResponse
{
    public List<TableInfo> Tables { get; set; } = new();
    public int TotalCount => Tables.Count;
}
