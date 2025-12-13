using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ReportGenerator.Models;
using SkiaSharp;

namespace ReportGenerator.Services;

/// <summary>
/// Service for generating PDF documents from report definitions
/// </summary>
public class PdfGeneratorService
{
    private readonly ParameterSubstitutionService _parameterService;
    private readonly BarcodeService _barcodeService;
    private readonly ImageService _imageService;

    private sealed record TablePaginationInfo(
        int RowsFirstPage,
        int RowsOtherPages,
        int TotalPages);

    public PdfGeneratorService(
        ParameterSubstitutionService parameterService,
        BarcodeService barcodeService,
        ImageService imageService)
    {
        _parameterService = parameterService;
        _barcodeService = barcodeService;
        _imageService = imageService;
    }

    /// <summary>
    /// Generates a PDF document from the report definition
    /// </summary>
    public async Task<byte[]> GenerateAsync(GenerateRequest request)
    {
        var report = request.Report;
        var data = request.Data ?? new Dictionary<string, List<Dictionary<string, object>>>();
        var parameters = report.Parameters ?? new List<ReportParameter>();

        // Apply data to data regions
        ApplyDataToRegions(report.ReportObjects, data);

        // Generate PDF
        var pdfBytes = await Task.Run(() => GeneratePdf(report, parameters));
        return pdfBytes;
    }

    private static void ApplyDataToRegions(List<ReportObject> objects, Dictionary<string, List<Dictionary<string, object>>> data)
    {
        foreach (var obj in objects.Where(o => o.Type == ReportObjectType.DataRegion))
        {
            if (data.TryGetValue(obj.Id, out var regionData))
            {
                obj.Data = regionData;
            }
        }
    }

    // Screen DPI (pixels per inch) - standard browser resolution
    private const float ScreenDpi = 96f;
    // PDF points per inch
    private const float PointsPerInch = 72f;
    private const float MmPerInch = 25.4f;

    /// <summary>
    /// Converts pixels (at 96 DPI) to PDF points (72 per inch)
    /// </summary>
    private static float PixelsToPoints(double pixels) => (float)(pixels * PointsPerInch / ScreenDpi);

    private static float InchesToPoints(double inches) => (float)(inches * PointsPerInch);

    private static float MmToPoints(double mm) => (float)(mm / MmPerInch * PointsPerInch);

    private static (float WidthPt, float HeightPt) GetPageSizePoints(PageSettings page)
    {
        var preset = page.Preset?.Trim().ToLowerInvariant();

        float widthPt;
        float heightPt;

        switch (preset)
        {
            case "a4":
                widthPt = MmToPoints(210);
                heightPt = MmToPoints(297);
                break;
            case "letter":
                widthPt = InchesToPoints(8.5);
                heightPt = InchesToPoints(11);
                break;
            default:
                widthPt = PixelsToPoints(page.Width);
                heightPt = PixelsToPoints(page.Height);
                break;
        }

        var orientation = page.Orientation?.Trim().ToLowerInvariant();
        if (orientation == "landscape")
        {
            if (widthPt < heightPt)
                (widthPt, heightPt) = (heightPt, widthPt);
        }
        else
        {
            if (widthPt > heightPt)
                (widthPt, heightPt) = (heightPt, widthPt);
        }

        return (widthPt, heightPt);
    }

    private byte[] GeneratePdf(ReportDefinition report, List<ReportParameter> parameters)
    {
        var page = report.CanvasSettings.Page;

        var pageWidthPx = page.Width;
        var pageHeightPx = page.Height;
        var marginLeftPx = page.Margins.Left;
        var marginRightPx = page.Margins.Right;
        var marginTopPx = page.Margins.Top;
        var marginBottomPx = page.Margins.Bottom;

        var (pageWidthPt, pageHeightPt) = GetPageSizePoints(page);
        var marginLeftPt = PixelsToPoints(marginLeftPx);
        var marginRightPt = PixelsToPoints(marginRightPx);
        var marginTopPt = PixelsToPoints(marginTopPx);
        var marginBottomPt = PixelsToPoints(marginBottomPx);

        var tablePagination = new Dictionary<string, TablePaginationInfo>();
        foreach (var table in report.ReportObjects.Where(o => o.Type == ReportObjectType.Table))
        {
            var props = table.Properties;
            var columns = props.Columns ?? new List<string>();
            if (columns.Count == 0) continue;

            var parentRegion = FindParentDataRegion(table, report.ReportObjects);
            if (parentRegion == null) continue;

            var dataCount = parentRegion.Data?.Count ?? 0;
            if (dataCount <= 0) continue;

            const double rowHeightPx = 30;

            var availableHeightFirstPx = Math.Min(table.Height, (pageHeightPx - marginBottomPx) - table.Y);
            var rowsFirstPage = (int)Math.Floor((availableHeightFirstPx - rowHeightPx) / rowHeightPx);
            if (rowsFirstPage < 1) rowsFirstPage = 1;

            var yOtherPx = marginTopPx;
            var availableHeightOtherPx = Math.Min(table.Height, (pageHeightPx - marginBottomPx) - yOtherPx);
            var rowsOtherPages = (int)Math.Floor((availableHeightOtherPx - rowHeightPx) / rowHeightPx);
            if (rowsOtherPages < 1) rowsOtherPages = 1;

            int totalPages;
            if (dataCount <= rowsFirstPage)
            {
                totalPages = 1;
            }
            else
            {
                var remaining = dataCount - rowsFirstPage;
                totalPages = 1 + (int)Math.Ceiling(remaining / (double)rowsOtherPages);
            }

            if (totalPages > 1)
                tablePagination[table.Id] = new TablePaginationInfo(rowsFirstPage, rowsOtherPages, totalPages);
        }

        var totalDocumentPages = tablePagination.Values.Select(v => v.TotalPages).DefaultIfEmpty(1).Max();

        var document = Document.Create(container =>
        {
            for (var pageIndex = 0; pageIndex < totalDocumentPages; pageIndex++)
            {
                var localPageIndex = pageIndex;

                container.Page(pageDescriptor =>
                {
                    // Set page size in points
                    pageDescriptor.Size(pageWidthPt, pageHeightPt, Unit.Point);

                    // Set margins in points
                    pageDescriptor.MarginLeft(marginLeftPt, Unit.Point);
                    pageDescriptor.MarginRight(marginRightPt, Unit.Point);
                    pageDescriptor.MarginTop(marginTopPt, Unit.Point);
                    pageDescriptor.MarginBottom(marginBottomPt, Unit.Point);

                    // Content with absolute positioning using SkiaSharp canvas
                    // Note: Canvas coordinates are in points (content area)
                    pageDescriptor.Content().SkiaSharpSvgCanvas((canvas, size) =>
                    {
                        var saveCount = canvas.Save();
                        canvas.Translate(-marginLeftPt, -marginTopPt);

                        foreach (var obj in report.ReportObjects.OrderBy(o => o.Y).ThenBy(o => o.X))
                        {
                            if (obj.Type == ReportObjectType.Table && tablePagination.TryGetValue(obj.Id, out var pageInfo))
                            {
                                int startRow;
                                int rowsToTake;
                                double yStartPx;

                                if (localPageIndex == 0)
                                {
                                    startRow = 0;
                                    rowsToTake = pageInfo.RowsFirstPage;
                                    yStartPx = obj.Y;
                                }
                                else
                                {
                                    startRow = pageInfo.RowsFirstPage + (localPageIndex - 1) * pageInfo.RowsOtherPages;
                                    rowsToTake = pageInfo.RowsOtherPages;
                                    yStartPx = marginTopPx;
                                }

                                RenderTablePage(canvas, obj, report.ReportObjects, startRow, rowsToTake, yStartPx);
                                continue;
                            }

                            if (obj.Y < pageHeightPx)
                            {
                                if (localPageIndex != 0) continue;
                                RenderObject(canvas, obj, report.ReportObjects, parameters);
                                continue;
                            }

                            var objPageIndex = (int)Math.Floor(obj.Y / pageHeightPx);
                            if (objPageIndex != localPageIndex) continue;

                            var objOffsetSave = canvas.Save();
                            canvas.Translate(0, -PixelsToPoints(objPageIndex * pageHeightPx));
                            RenderObject(canvas, obj, report.ReportObjects, parameters);
                            canvas.RestoreToCount(objOffsetSave);
                        }

                        canvas.RestoreToCount(saveCount);
                    });
                });
            }
        });

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);
        return stream.ToArray();
    }

    private void RenderTablePage(
        SKCanvas canvas,
        ReportObject obj,
        List<ReportObject> allObjects,
        int startRow,
        int rowsToTake,
        double yStartPx)
    {
        var props = obj.Properties;
        var columns = props.Columns ?? new List<string>();

        if (columns.Count == 0) return;

        var parentRegion = FindParentDataRegion(obj, allObjects);
        var data = parentRegion?.Data ?? new List<Dictionary<string, object>>();
        if (startRow >= data.Count) return;

        // Convert to points
        var objX = PixelsToPoints(obj.X);
        var objY = PixelsToPoints(yStartPx);
        var objW = PixelsToPoints(obj.Width);

        var rowHeight = PixelsToPoints(30);
        var colWidth = objW / columns.Count;
        var textPadding = PixelsToPoints(5);

        // Header colors
        var headerBgColor = ParseSkColor("#f3f4f6");
        var borderColor = ParseSkColor("#d1d5db");
        var headerTextColor = ParseSkColor("#374151");

        using var headerBgPaint = new SKPaint { Color = headerBgColor, Style = SKPaintStyle.Fill };
        using var borderPaint = new SKPaint { Color = borderColor, Style = SKPaintStyle.Stroke, StrokeWidth = PixelsToPoints(1) };
        using var headerTextPaint = new SKPaint
        {
            Color = headerTextColor,
            TextSize = PixelsToPoints(12),
            Typeface = SKTypeface.FromFamilyName("Arial", SKFontStyleWeight.Bold, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright),
            IsAntialias = true
        };

        // Draw header cells
        for (int i = 0; i < columns.Count; i++)
        {
            var x = objX + i * colWidth;
            var y = objY;

            canvas.DrawRect(x, y, colWidth, rowHeight, headerBgPaint);
            canvas.DrawRect(x, y, colWidth, rowHeight, borderPaint);
            canvas.DrawText(columns[i], x + textPadding, y + rowHeight / 2 + PixelsToPoints(4), headerTextPaint);
        }

        // Data row colors
        var cellBgColor = ParseSkColor("#ffffff");
        var cellBorderColor = ParseSkColor("#e5e7eb");
        var cellTextColor = ParseSkColor("#4b5563");

        using var cellBgPaint = new SKPaint { Color = cellBgColor, Style = SKPaintStyle.Fill };
        using var cellBorderPaint = new SKPaint { Color = cellBorderColor, Style = SKPaintStyle.Stroke, StrokeWidth = PixelsToPoints(1) };
        using var cellTextPaint = new SKPaint
        {
            Color = cellTextColor,
            TextSize = PixelsToPoints(12),
            Typeface = SKTypeface.FromFamilyName("Arial"),
            IsAntialias = true
        };

        var displayData = data.Skip(startRow).Take(rowsToTake).ToList();
        for (int rowIndex = 0; rowIndex < displayData.Count; rowIndex++)
        {
            var row = displayData[rowIndex];
            var y = objY + (rowIndex + 1) * rowHeight;

            for (int colIndex = 0; colIndex < columns.Count; colIndex++)
            {
                var x = objX + colIndex * colWidth;
                var col = columns[colIndex];

                canvas.DrawRect(x, y, colWidth, rowHeight, cellBgPaint);
                canvas.DrawRect(x, y, colWidth, rowHeight, cellBorderPaint);

                if (row.TryGetValue(col, out var value) && value != null)
                {
                    canvas.DrawText(value.ToString() ?? string.Empty, x + textPadding, y + rowHeight / 2 + PixelsToPoints(4), cellTextPaint);
                }
            }
        }
    }

    private void RenderObject(
        SKCanvas canvas,
        ReportObject obj,
        List<ReportObject> allObjects,
        List<ReportParameter> parameters)
    {
        switch (obj.Type)
        {
            case ReportObjectType.Text:
                RenderText(canvas, obj, allObjects, parameters);
                break;

            case ReportObjectType.Image:
                RenderImage(canvas, obj);
                break;

            case ReportObjectType.Barcode:
                RenderBarcode(canvas, obj, allObjects, parameters);
                break;

            case ReportObjectType.Table:
                RenderTable(canvas, obj, allObjects);
                break;

            case ReportObjectType.Line:
                RenderLine(canvas, obj);
                break;

            case ReportObjectType.Rectangle:
                RenderRectangle(canvas, obj);
                break;

            case ReportObjectType.Ellipse:
                RenderEllipse(canvas, obj);
                break;

            case ReportObjectType.DataRegion:
                // Data regions are invisible containers, skip rendering
                break;

            case ReportObjectType.Header:
            case ReportObjectType.Footer:
                // Headers/footers handled separately
                break;
        }
    }

    private void RenderText(
        SKCanvas canvas,
        ReportObject obj,
        List<ReportObject> allObjects,
        List<ReportParameter> parameters)
    {
        var props = obj.Properties;
        var text = props.Text ?? string.Empty;

        // Apply data binding if present
        if (props.DataBinding != null)
        {
            var parentRegion = FindParentDataRegion(obj, allObjects);
            if (parentRegion?.Data?.Count > 0)
            {
                var record = parentRegion.Data[0];
                if (record.TryGetValue(props.DataBinding.ColumnName, out var value))
                {
                    text = value?.ToString() ?? string.Empty;
                }
            }
        }
        else
        {
            // Apply parameter substitution
            text = _parameterService.Substitute(text, parameters);
        }

        // Convert pixel coordinates to points
        var x = PixelsToPoints(obj.X);
        var y = PixelsToPoints(obj.Y);
        var w = PixelsToPoints(obj.Width);
        var h = PixelsToPoints(obj.Height);

        // Draw background
        if (!string.IsNullOrEmpty(props.BackgroundColor) &&
            !props.BackgroundColor.Equals("transparent", StringComparison.OrdinalIgnoreCase))
        {
            using var bgPaint = new SKPaint
            {
                Color = ParseSkColor(props.BackgroundColor),
                Style = SKPaintStyle.Fill
            };
            canvas.DrawRect(x, y, w, h, bgPaint);
        }

        // Draw border
        if (props.BorderWidth > 0 && !string.IsNullOrEmpty(props.BorderColor))
        {
            using var borderPaint = new SKPaint
            {
                Color = ParseSkColor(props.BorderColor),
                Style = SKPaintStyle.Stroke,
                StrokeWidth = PixelsToPoints(props.BorderWidth ?? 1)
            };
            canvas.DrawRect(x, y, w, h, borderPaint);
        }

        // Draw text
        using var textPaint = new SKPaint
        {
            Color = ParseSkColor(props.Color ?? "#000000"),
            TextSize = PixelsToPoints(props.FontSize ?? 16),
            Typeface = GetTypeface(props.FontFamily, props.Bold ?? false, props.Italic ?? false),
            IsAntialias = true
        };

        // Calculate text position based on alignment
        var textBounds = new SKRect();
        textPaint.MeasureText(text, ref textBounds);

        float textX = x;
        float textY = y;

        // Horizontal alignment
        var align = props.TextAlign?.ToLowerInvariant() ?? "left";
        switch (align)
        {
            case "center":
                textX = x + (w - textBounds.Width) / 2;
                break;
            case "right":
                textX = x + w - textBounds.Width - PixelsToPoints(5);
                break;
            default: // left
                textX = x + PixelsToPoints(5);
                break;
        }

        // Vertical alignment (center by default)
        textY = y + (h + textBounds.Height) / 2;

        canvas.DrawText(text, textX, textY, textPaint);
    }

    private void RenderImage(SKCanvas canvas, ReportObject obj)
    {
        var imageData = _imageService.LoadImageAsync(obj.Properties.Src).GetAwaiter().GetResult();
        if (imageData == null || imageData.Length == 0) return;

        using var image = SKImage.FromEncodedData(imageData);
        if (image == null) return;

        // Convert pixel coordinates to points
        var x = PixelsToPoints(obj.X);
        var y = PixelsToPoints(obj.Y);
        var w = PixelsToPoints(obj.Width);
        var h = PixelsToPoints(obj.Height);

        var destRect = new SKRect(x, y, x + w, y + h);
        canvas.DrawImage(image, destRect);
    }

    private void RenderBarcode(
        SKCanvas canvas,
        ReportObject obj,
        List<ReportObject> allObjects,
        List<ReportParameter> parameters)
    {
        var props = obj.Properties;
        var text = props.Text ?? string.Empty;

        // Apply data binding
        if (props.DataBinding != null)
        {
            var parentRegion = FindParentDataRegion(obj, allObjects);
            if (parentRegion?.Data?.Count > 0)
            {
                var record = parentRegion.Data[0];
                if (record.TryGetValue(props.DataBinding.ColumnName, out var value))
                {
                    text = value?.ToString() ?? string.Empty;
                }
            }
        }
        else
        {
            text = _parameterService.Substitute(text, parameters);
        }

        if (string.IsNullOrEmpty(text)) return;

        var barcodeData = _barcodeService.GenerateBarcode(
            text,
            props.BarcodeType ?? "qrcode",
            (int)obj.Width,
            (int)obj.Height,
            props.BarcodeIncludeText ?? false);

        if (barcodeData.Length > 0)
        {
            using var image = SKImage.FromEncodedData(barcodeData);
            if (image != null)
            {
                // Convert pixel coordinates to points
                var x = PixelsToPoints(obj.X);
                var y = PixelsToPoints(obj.Y);
                var w = PixelsToPoints(obj.Width);
                var h = PixelsToPoints(obj.Height);

                var destRect = new SKRect(x, y, x + w, y + h);
                canvas.DrawImage(image, destRect);
            }
        }
    }

    private void RenderTable(SKCanvas canvas, ReportObject obj, List<ReportObject> allObjects)
    {
        var props = obj.Properties;
        var columns = props.Columns ?? new List<string>();

        if (columns.Count == 0) return;

        var parentRegion = FindParentDataRegion(obj, allObjects);
        var data = parentRegion?.Data ?? new List<Dictionary<string, object>>();

        // Convert to points
        var objX = PixelsToPoints(obj.X);
        var objY = PixelsToPoints(obj.Y);
        var objW = PixelsToPoints(obj.Width);
        var objH = PixelsToPoints(obj.Height);

        var rowHeight = PixelsToPoints(30);
        var colWidth = objW / columns.Count;
        var textPadding = PixelsToPoints(5);

        // Header colors
        var headerBgColor = ParseSkColor("#f3f4f6");
        var borderColor = ParseSkColor("#d1d5db");
        var headerTextColor = ParseSkColor("#374151");

        using var headerBgPaint = new SKPaint { Color = headerBgColor, Style = SKPaintStyle.Fill };
        using var borderPaint = new SKPaint { Color = borderColor, Style = SKPaintStyle.Stroke, StrokeWidth = PixelsToPoints(1) };
        using var headerTextPaint = new SKPaint
        {
            Color = headerTextColor,
            TextSize = PixelsToPoints(12),
            Typeface = SKTypeface.FromFamilyName("Arial", SKFontStyleWeight.Bold, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright),
            IsAntialias = true
        };

        // Draw header cells
        for (int i = 0; i < columns.Count; i++)
        {
            var x = objX + i * colWidth;
            var y = objY;

            // Header cell background
            canvas.DrawRect(x, y, colWidth, rowHeight, headerBgPaint);
            canvas.DrawRect(x, y, colWidth, rowHeight, borderPaint);

            // Header text
            canvas.DrawText(columns[i], x + textPadding, y + rowHeight / 2 + PixelsToPoints(4), headerTextPaint);
        }

        // Data row colors
        var cellBgColor = ParseSkColor("#ffffff");
        var cellBorderColor = ParseSkColor("#e5e7eb");
        var cellTextColor = ParseSkColor("#4b5563");

        using var cellBgPaint = new SKPaint { Color = cellBgColor, Style = SKPaintStyle.Fill };
        using var cellBorderPaint = new SKPaint { Color = cellBorderColor, Style = SKPaintStyle.Stroke, StrokeWidth = PixelsToPoints(1) };
        using var cellTextPaint = new SKPaint
        {
            Color = cellTextColor,
            TextSize = PixelsToPoints(12),
            Typeface = SKTypeface.FromFamilyName("Arial"),
            IsAntialias = true
        };

        // Draw data rows
        var maxRows = (int)((objH - rowHeight) / rowHeight);
        var displayData = data.Take(maxRows).ToList();

        for (int rowIndex = 0; rowIndex < displayData.Count; rowIndex++)
        {
            var row = displayData[rowIndex];
            var y = objY + (rowIndex + 1) * rowHeight;

            for (int colIndex = 0; colIndex < columns.Count; colIndex++)
            {
                var x = objX + colIndex * colWidth;
                var col = columns[colIndex];

                // Cell background and border
                canvas.DrawRect(x, y, colWidth, rowHeight, cellBgPaint);
                canvas.DrawRect(x, y, colWidth, rowHeight, cellBorderPaint);

                // Cell text
                if (row.TryGetValue(col, out var value) && value != null)
                {
                    canvas.DrawText(value.ToString() ?? string.Empty, x + textPadding, y + rowHeight / 2 + PixelsToPoints(4), cellTextPaint);
                }
            }
        }
    }

    private void RenderLine(SKCanvas canvas, ReportObject obj)
    {
        var props = obj.Properties;

        // Convert to points
        var x = PixelsToPoints(obj.X);
        var y = PixelsToPoints(obj.Y);
        var w = PixelsToPoints(obj.Width);
        var h = PixelsToPoints(obj.Height);

        using var paint = new SKPaint
        {
            Color = ParseSkColor(props.StrokeColor ?? "#000000"),
            Style = SKPaintStyle.Stroke,
            StrokeWidth = PixelsToPoints(props.StrokeWidth ?? 2),
            IsAntialias = true
        };

        canvas.DrawLine(x, y + h / 2, x + w, y + h / 2, paint);
    }

    private void RenderRectangle(SKCanvas canvas, ReportObject obj)
    {
        var props = obj.Properties;

        // Convert to points
        var x = PixelsToPoints(obj.X);
        var y = PixelsToPoints(obj.Y);
        var w = PixelsToPoints(obj.Width);
        var h = PixelsToPoints(obj.Height);

        // Fill
        if (!string.IsNullOrEmpty(props.FillColor) &&
            !props.FillColor.Equals("transparent", StringComparison.OrdinalIgnoreCase))
        {
            using var fillPaint = new SKPaint
            {
                Color = ParseSkColor(props.FillColor),
                Style = SKPaintStyle.Fill
            };
            canvas.DrawRect(x, y, w, h, fillPaint);
        }

        // Stroke
        if (props.StrokeWidth > 0)
        {
            using var strokePaint = new SKPaint
            {
                Color = ParseSkColor(props.StrokeColor ?? "#000000"),
                Style = SKPaintStyle.Stroke,
                StrokeWidth = PixelsToPoints(props.StrokeWidth ?? 1)
            };
            canvas.DrawRect(x, y, w, h, strokePaint);
        }
    }

    private void RenderEllipse(SKCanvas canvas, ReportObject obj)
    {
        var props = obj.Properties;

        // Convert to points
        var x = PixelsToPoints(obj.X);
        var y = PixelsToPoints(obj.Y);
        var w = PixelsToPoints(obj.Width);
        var h = PixelsToPoints(obj.Height);

        var centerX = x + w / 2;
        var centerY = y + h / 2;
        var radiusX = w / 2;
        var radiusY = h / 2;

        // Fill
        if (!string.IsNullOrEmpty(props.FillColor) &&
            !props.FillColor.Equals("transparent", StringComparison.OrdinalIgnoreCase))
        {
            using var fillPaint = new SKPaint
            {
                Color = ParseSkColor(props.FillColor),
                Style = SKPaintStyle.Fill,
                IsAntialias = true
            };
            canvas.DrawOval(centerX, centerY, radiusX, radiusY, fillPaint);
        }

        // Stroke
        if (props.StrokeWidth > 0)
        {
            using var strokePaint = new SKPaint
            {
                Color = ParseSkColor(props.StrokeColor ?? "#000000"),
                Style = SKPaintStyle.Stroke,
                StrokeWidth = PixelsToPoints(props.StrokeWidth ?? 1),
                IsAntialias = true
            };
            canvas.DrawOval(centerX, centerY, radiusX, radiusY, strokePaint);
        }
    }

    private static ReportObject? FindParentDataRegion(ReportObject obj, List<ReportObject> allObjects)
    {
        var centerX = obj.X + obj.Width / 2;
        var centerY = obj.Y + obj.Height / 2;

        return allObjects.FirstOrDefault(o =>
            o.Type == ReportObjectType.DataRegion &&
            o.Id != obj.Id &&
            centerX >= o.X &&
            centerX <= o.X + o.Width &&
            centerY >= o.Y &&
            centerY <= o.Y + o.Height);
    }

    private static SKTypeface GetTypeface(string? fontFamily, bool bold, bool italic)
    {
        var familyName = MapFontFamily(fontFamily);
        var weight = bold ? SKFontStyleWeight.Bold : SKFontStyleWeight.Normal;
        var slant = italic ? SKFontStyleSlant.Italic : SKFontStyleSlant.Upright;

        return SKTypeface.FromFamilyName(familyName, weight, SKFontStyleWidth.Normal, slant);
    }

    private static string MapFontFamily(string? fontFamily)
    {
        var ff = fontFamily?.ToLowerInvariant() ?? string.Empty;
        if (ff.Contains("courier")) return "Courier New";
        if (ff.Contains("times")) return "Times New Roman";
        return "Arial";
    }

    private static SKColor ParseSkColor(string? color)
    {
        if (string.IsNullOrEmpty(color)) return SKColors.Black;

        var c = color.Trim().ToLowerInvariant();
        if (c == "transparent") return SKColors.Transparent;

        if (c.StartsWith('#'))
        {
            var hex = c[1..];
            if (hex.Length == 3)
            {
                var r = Convert.ToByte(new string(hex[0], 2), 16);
                var g = Convert.ToByte(new string(hex[1], 2), 16);
                var b = Convert.ToByte(new string(hex[2], 2), 16);
                return new SKColor(r, g, b);
            }
            if (hex.Length == 6)
            {
                var r = Convert.ToByte(hex[..2], 16);
                var g = Convert.ToByte(hex[2..4], 16);
                var b = Convert.ToByte(hex[4..6], 16);
                return new SKColor(r, g, b);
            }
        }

        return SKColors.Black;
    }
}
