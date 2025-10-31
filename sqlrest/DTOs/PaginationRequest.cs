namespace SqlRest.DTOs;

public class PaginationRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public int Skip => (Page - 1) * PageSize;
}

public class SortRequest
{
    public string SortBy { get; set; } = string.Empty;
    public bool SortDescending { get; set; } = false;
}

public class FilterRequest
{
    public string? Field { get; set; }
    public string? Operator { get; set; } // eq, ne, gt, gte, lt, lte, like, in
    public string? Value { get; set; }
}

public class QueryRequest : PaginationRequest
{
    public string? Search { get; set; }
    public SortRequest? Sort { get; set; }
    public List<FilterRequest>? Filters { get; set; }
}
