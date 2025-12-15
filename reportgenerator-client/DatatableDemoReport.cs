internal static class DatatableDemoReport
{
    internal static object BuildRequest(int a4WidthPx, int a4HeightPx, int marginPx, string outputFilename)
    {
        var contentW = Math.Max(1, a4WidthPx - (marginPx * 2));
        var contentH = Math.Max(1, a4HeightPx - (marginPx * 2));
        const string tableId = "datatable1";

        var rows = new List<Dictionary<string, object?>>();
        void Add(string category, string name, int qty, double price)
        {
            var total = qty * price;
            rows.Add(new Dictionary<string, object?>
            {
                ["Category"] = category,
                ["Name"] = name,
                ["Qty"] = qty,
                ["Price"] = new { value = $"€ {price:0.00}", style = new { textAlign = "right" } },
                ["Total"] = new { value = $"€ {total:0.00}", style = new { textAlign = "right" } },
            });
        }

        Add("Hardware", "Keyboard", 3, 49.95);
        Add("Hardware", "Monitor", 1, 229.00);
        Add("Hardware", "USB-C Dock", 2, 139.00);
        Add("Software", "IDE License", 5, 19.00);
        Add("Software", "Antivirus", 10, 4.50);

        var data = new Dictionary<string, object>
        {
            [tableId] = rows
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
                            text = "Datatable Example (grouped)",
                            fontSize = 28,
                            fontFamily = "Arial",
                            color = "#111827",
                            bold = true
                        }
                    },
                    new
                    {
                        id = tableId,
                        type = "datatable",
                        x = marginPx,
                        y = marginPx + 80,
                        width = contentW,
                        height = Math.Max(200, contentH - 120),
                        properties = new
                        {
                            columns = new[] { "Category", "Name", "Qty", "Price", "Total" },
                            dataTableGroupBy = new[] { "Category" },
                            columnWidths = new Dictionary<string, double?>
                            {
                                ["Category"] = 140,
                                ["Name"] = 240,
                                ["Qty"] = 70,
                                ["Price"] = 110,
                                ["Total"] = 110
                            },
                            tableHeaderCellStyles = new Dictionary<string, object>
                            {
                                ["Qty"] = new { textAlign = "right" },
                                ["Price"] = new { textAlign = "right" },
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
