internal static class SizeCheckDemoReport
{
    internal static object BuildRequest(int a4WidthPx, int a4HeightPx, int marginPx, int rectSizePx, string outputFilename)
    {
        var contentWidthPx = Math.Max(1, a4WidthPx - (marginPx * 2));
        var contentHeightPx = Math.Max(1, a4HeightPx - (marginPx * 2));

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
                        x = marginPx + rectSizePx + 10,
                        y = marginPx + 10,
                        width = Math.Max(1, contentWidthPx - rectSizePx - 10),
                        height = 60,
                        properties = new
                        {
                            text = $"A4 Layout Test (margin: {marginPx}px)",
                            fontSize = 28,
                            fontFamily = "Arial",
                            color = "#111827",
                            bold = true
                        }
                    },
                    new
                    {
                        id = "subtitle",
                        type = "text",
                        x = marginPx + rectSizePx + 10,
                        y = marginPx + 70,
                        width = Math.Max(1, contentWidthPx - rectSizePx - 10),
                        height = 40,
                        properties = new
                        {
                            text = "Rectangles mark the 4 corners of the content area",
                            fontSize = 16,
                            fontFamily = "Arial",
                            color = "#374151"
                        }
                    },
                    new
                    {
                        id = "corner_tl",
                        type = "rectangle",
                        x = marginPx,
                        y = marginPx,
                        width = rectSizePx,
                        height = rectSizePx,
                        properties = new
                        {
                            strokeWidth = 2,
                            strokeColor = "#ef4444",
                            fillColor = "transparent"
                        }
                    },
                    new
                    {
                        id = "corner_tr",
                        type = "rectangle",
                        x = marginPx + Math.Max(0, contentWidthPx - rectSizePx),
                        y = marginPx,
                        width = rectSizePx,
                        height = rectSizePx,
                        properties = new
                        {
                            strokeWidth = 2,
                            strokeColor = "#3b82f6",
                            fillColor = "transparent"
                        }
                    },
                    new
                    {
                        id = "corner_bl",
                        type = "rectangle",
                        x = marginPx,
                        y = marginPx + Math.Max(0, contentHeightPx - rectSizePx),
                        width = rectSizePx,
                        height = rectSizePx,
                        properties = new
                        {
                            strokeWidth = 2,
                            strokeColor = "#22c55e",
                            fillColor = "transparent"
                        }
                    },
                    new
                    {
                        id = "corner_br",
                        type = "rectangle",
                        x = marginPx + Math.Max(0, contentWidthPx - rectSizePx),
                        y = marginPx + Math.Max(0, contentHeightPx - rectSizePx),
                        width = rectSizePx,
                        height = rectSizePx,
                        properties = new
                        {
                            strokeWidth = 2,
                            strokeColor = "#a855f7",
                            fillColor = "transparent"
                        }
                    },
                    new
                    {
                        id = "footer",
                        type = "text",
                        x = marginPx + rectSizePx + 10,
                        y = marginPx + Math.Max(0, contentHeightPx - 30),
                        width = Math.Max(1, contentWidthPx - rectSizePx - 10),
                        height = 30,
                        properties = new
                        {
                            text = "Expected: A4 (595 x 842 pts) with 20px margins",
                            fontSize = 12,
                            fontFamily = "Arial",
                            color = "#6b7280"
                        }
                    }
                },
                canvasSettings = CanvasSettingsBuilder.Build(a4WidthPx, a4HeightPx, marginPx),
                parameters = Array.Empty<object>()
            },
            data = new { },
            output = new { format = "pdf", filename = outputFilename }
        };
    }
}
