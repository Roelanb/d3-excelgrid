internal static class TableDemoReport
{
    internal static object BuildRequest(int a4WidthPx, int a4HeightPx, int marginPx, string outputFilename)
    {
        var contentW = Math.Max(1, a4WidthPx - (marginPx * 2));
        var contentH = Math.Max(1, a4HeightPx - (marginPx * 2));
        const string tableId = "table1";

        var data = new Dictionary<string, object>
        {
            [tableId] = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["Item"] = "Laptop",
                    ["Qty"] = 2,
                    ["UnitPrice"] = new { value = "€ 1,199.00", style = new { textAlign = "right" } },
                    ["Total"] = new { value = "€ 2,398.00", style = new { textAlign = "right", bold = true } },
                },
                new Dictionary<string, object?>
                {
                    ["Item"] = "Mouse",
                    ["Qty"] = 5,
                    ["UnitPrice"] = new { value = "€ 29.90", style = new { textAlign = "right" } },
                    ["Total"] = new { value = "€ 149.50", style = new { textAlign = "right" } },
                },
                new Dictionary<string, object?>
                {
                    ["Item"] = "Discount",
                    ["Qty"] = "",
                    ["UnitPrice"] = "",
                    ["Total"] = new { value = "-€ 50.00", style = new { textAlign = "right", color = "#dc2626" } },
                },
            }
        };

        return new
        {
            report = new
            {
                reportObjects = new object[]
                {
                    new
                    {
                        id = "title",
                        type = "text",
                        x = marginPx,
                        y = marginPx,
                        width = contentW,
                        height = 60,
                        properties = new
                        {
                            text = "Table Example",
                            fontSize = 28,
                            fontFamily = "Arial",
                            color = "#111827",
                            bold = true
                        }
                    },
                    new
                    {
                        id = tableId,
                        type = "table",
                        x = marginPx,
                        y = marginPx + 80,
                        width = contentW,
                        height = Math.Max(200, contentH - 120),
                        properties = new
                        {
                            columns = new[] { "Item", "Qty", "UnitPrice", "Total" },
                            tableColumnLabels = new Dictionary<string, string>
                            {
                                ["Item"] = "Item",
                                ["Qty"] = "Qty",
                                ["UnitPrice"] = "Unit Price",
                                ["Total"] = "Total"
                            },
                            columnWidths = new Dictionary<string, double?>
                            {
                                ["Item"] = 320,
                                ["Qty"] = 60,
                                ["UnitPrice"] = 140,
                                ["Total"] = 140
                            },
                            tableHeaderStyle = new
                            {
                                backgroundColor = "#f3f4f6",
                                borderColor = "#d1d5db",
                                borderWidth = 1,
                                color = "#111827",
                                fontSize = 12,
                                fontFamily = "Arial",
                                bold = true,
                                padding = 6,
                                textAlign = "left",
                                opacity = 1
                            },
                            tableHeaderCellStyles = new Dictionary<string, object>
                            {
                                ["Qty"] = new { textAlign = "right" },
                                ["UnitPrice"] = new { textAlign = "right" },
                                ["Total"] = new { textAlign = "right" }
                            }
                        }
                    }
                },
                canvasSettings = CanvasSettingsBuilder.Build(a4WidthPx, a4HeightPx, marginPx),
                parameters = Array.Empty<object>()
            },
            data,
            output = new { format = "pdf", filename = outputFilename }
        };
    }
}
