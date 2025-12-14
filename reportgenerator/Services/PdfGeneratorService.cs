using System.Text.Json;
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

        // Apply data to data regions (and tables for standalone table support)
        ApplyDataToRegions(report.ReportObjects, data);

        // Generate PDF
        var pdfBytes = await Task.Run(() => GeneratePdf(report, parameters));
        return pdfBytes;
    }

    private static void ApplyDataToRegions(List<ReportObject> objects, Dictionary<string, List<Dictionary<string, object>>> data)
    {
        foreach (var obj in objects.Where(o => o.Type == ReportObjectType.DataRegion || o.Type == ReportObjectType.Table || o.Type == ReportObjectType.Datatable))
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

    private static double Clamp01(double v) => v < 0 ? 0 : (v > 1 ? 1 : v);

    private static SKColor ApplyOpacity(SKColor color, double? opacity)
    {
        if (opacity is null) return color;
        var o = Clamp01(opacity.Value);
        return color.WithAlpha((byte)Math.Round(color.Alpha * o));
    }

    private static TextStyleProperties MergeStyles(TextStyleProperties? baseStyle, TextStyleProperties? overrideStyle)
    {
        if (baseStyle == null && overrideStyle == null) return new TextStyleProperties();
        if (baseStyle == null) return overrideStyle ?? new TextStyleProperties();
        if (overrideStyle == null) return baseStyle;

        return new TextStyleProperties
        {
            FontSize = overrideStyle.FontSize ?? baseStyle.FontSize,
            FontFamily = overrideStyle.FontFamily ?? baseStyle.FontFamily,
            Bold = overrideStyle.Bold ?? baseStyle.Bold,
            Italic = overrideStyle.Italic ?? baseStyle.Italic,
            Underline = overrideStyle.Underline ?? baseStyle.Underline,
            StrikeThrough = overrideStyle.StrikeThrough ?? baseStyle.StrikeThrough,
            Color = overrideStyle.Color ?? baseStyle.Color,
            BackgroundColor = overrideStyle.BackgroundColor ?? baseStyle.BackgroundColor,
            Opacity = overrideStyle.Opacity ?? baseStyle.Opacity,
            BorderWidth = overrideStyle.BorderWidth ?? baseStyle.BorderWidth,
            BorderColor = overrideStyle.BorderColor ?? baseStyle.BorderColor,
            Padding = overrideStyle.Padding ?? baseStyle.Padding,
            TextAlign = overrideStyle.TextAlign ?? baseStyle.TextAlign,
        };
    }

    private static TextStyleProperties GetHeaderCellStyle(ReportObjectProperties props, string column)
    {
        var baseStyle = props.TableHeaderStyle;
        var cellStyles = props.TableHeaderCellStyles;
        TextStyleProperties? perCell = null;
        if (cellStyles != null && cellStyles.TryGetValue(column, out var s))
            perCell = s;
        return MergeStyles(baseStyle, perCell);
    }

    private static (string Text, TextStyleProperties? Style) TryExtractValueAndStyle(object? value)
    {
        if (value == null)
            return (string.Empty, null);

        // System.Text.Json will deserialize `object` values as JsonElement
        if (value is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.Null || je.ValueKind == JsonValueKind.Undefined)
                return (string.Empty, null);

            if (je.ValueKind == JsonValueKind.Object)
            {
                if (je.TryGetProperty("value", out var valueEl))
                {
                    var text = valueEl.ValueKind == JsonValueKind.String
                        ? (valueEl.GetString() ?? string.Empty)
                        : valueEl.ToString();

                    TextStyleProperties? style = null;
                    if (je.TryGetProperty("style", out var styleEl) && styleEl.ValueKind == JsonValueKind.Object)
                    {
                        try
                        {
                            style = styleEl.Deserialize<TextStyleProperties>(new JsonSerializerOptions
                            {
                                PropertyNameCaseInsensitive = true
                            });
                        }
                        catch
                        {
                            style = null;
                        }
                    }

                    return (text ?? string.Empty, style);
                }
            }

            return (je.ValueKind == JsonValueKind.String ? (je.GetString() ?? string.Empty) : je.ToString(), null);
        }

        return (value.ToString() ?? string.Empty, null);
    }

    private static void DrawStyledCell(
        SKCanvas canvas,
        float x,
        float y,
        float w,
        float h,
        string text,
        TextStyleProperties? style,
        TextStyleProperties defaults)
    {
        var merged = MergeStyles(defaults, style);

        var bg = ApplyOpacity(ParseSkColor(merged.BackgroundColor ?? defaults.BackgroundColor), merged.Opacity ?? defaults.Opacity);
        var fg = ApplyOpacity(ParseSkColor(merged.Color ?? defaults.Color), merged.Opacity ?? defaults.Opacity);
        var borderColor = ApplyOpacity(ParseSkColor(merged.BorderColor ?? defaults.BorderColor), merged.Opacity ?? defaults.Opacity);

        var borderWidthPx = merged.BorderWidth ?? defaults.BorderWidth ?? 0;
        var borderWidthPt = borderWidthPx > 0 ? PixelsToPoints(borderWidthPx) : 0;

        using (var bgPaint = new SKPaint { Color = bg, Style = SKPaintStyle.Fill })
        {
            canvas.DrawRect(x, y, w, h, bgPaint);
        }

        if (borderWidthPt > 0)
        {
            using var borderPaint = new SKPaint { Color = borderColor, Style = SKPaintStyle.Stroke, StrokeWidth = borderWidthPt };
            canvas.DrawRect(x, y, w, h, borderPaint);
        }

        var fontSizePt = PixelsToPoints(merged.FontSize ?? defaults.FontSize ?? 12);
        using var textPaint = new SKPaint
        {
            Color = fg,
            TextSize = fontSizePt,
            Typeface = GetTypeface(merged.FontFamily ?? defaults.FontFamily, merged.Bold ?? defaults.Bold ?? false, merged.Italic ?? defaults.Italic ?? false),
            IsAntialias = true
        };

        var paddingPt = PixelsToPoints(merged.Padding ?? defaults.Padding ?? 5);

        // Vertical centering based on font metrics
        var metrics = textPaint.FontMetrics;
        var textHeight = metrics.Descent - metrics.Ascent;
        var baselineY = y + (h - textHeight) / 2 - metrics.Ascent;

        var align = (merged.TextAlign ?? defaults.TextAlign ?? "left").Trim().ToLowerInvariant();
        var textWidth = textPaint.MeasureText(text);

        float textX;
        switch (align)
        {
            case "center":
                textX = x + (w - textWidth) / 2;
                break;
            case "right":
                textX = x + w - paddingPt - textWidth;
                break;
            default:
                textX = x + paddingPt;
                break;
        }

        // Clip text to cell bounds
        var clipSave = canvas.Save();
        canvas.ClipRect(new SKRect(x, y, x + w, y + h));
        canvas.DrawText(text ?? string.Empty, textX, baselineY, textPaint);

        // Underline / strikeThrough
        var underline = merged.Underline ?? defaults.Underline ?? false;
        var strike = merged.StrikeThrough ?? defaults.StrikeThrough ?? false;

        if (underline || strike)
        {
            using var decoPaint = new SKPaint
            {
                Color = fg,
                Style = SKPaintStyle.Stroke,
                StrokeWidth = Math.Max(1, fontSizePt / 12)
            };

            if (underline)
            {
                var underlineY = baselineY + Math.Max(1, fontSizePt / 12);
                canvas.DrawLine(textX, underlineY, textX + textWidth, underlineY, decoPaint);
            }

            if (strike)
            {
                var strikeY = y + h / 2;
                canvas.DrawLine(textX, strikeY, textX + textWidth, strikeY, decoPaint);
            }
        }

        canvas.RestoreToCount(clipSave);
    }

    private static (List<float> WidthsPt, List<float> XOffsetsPt) ComputeTableColumnLayout(
        float totalWidthPt,
        List<string> columns,
        Dictionary<string, double?>? columnWidthsPx)
    {
        if (columns.Count == 0)
            return (new List<float>(), new List<float>());

        var fixedWidthsPx = columns
            .Select(c =>
            {
                if (columnWidthsPx != null && columnWidthsPx.TryGetValue(c, out var v) && v.HasValue && v.Value > 0)
                    return v.Value;
                return (double?)null;
            })
            .ToList();

        var fixedTotalPt = fixedWidthsPx.Where(v => v.HasValue).Sum(v => PixelsToPoints(v!.Value));
        var autoCount = fixedWidthsPx.Count(v => !v.HasValue);
        var autoWidthPt = autoCount > 0 ? Math.Max(PixelsToPoints(20), (totalWidthPt - fixedTotalPt) / autoCount) : 0;

        var widthsPt = fixedWidthsPx
            .Select(v => v.HasValue ? PixelsToPoints(v.Value) : autoWidthPt)
            .ToList();

        var xOffsets = new List<float>(widthsPt.Count);
        float acc = 0;
        foreach (var w in widthsPt)
        {
            xOffsets.Add(acc);
            acc += w;
        }

        return (widthsPt, xOffsets);
    }

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
        foreach (var table in report.ReportObjects.Where(o => o.Type == ReportObjectType.Table || o.Type == ReportObjectType.Datatable))
        {
            var props = table.Properties;
            var columns = props.Columns ?? new List<string>();
            if (columns.Count == 0) continue;

            var parentRegion = FindParentDataRegion(table, report.ReportObjects);
            var tableData = table.Data ?? parentRegion?.Data;
            var dataCount = tableData?.Count ?? 0;
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
                            if ((obj.Type == ReportObjectType.Table || obj.Type == ReportObjectType.Datatable) && tablePagination.TryGetValue(obj.Id, out var pageInfo))
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
        var data = obj.Data ?? parentRegion?.Data ?? new List<Dictionary<string, object>>();
        if (startRow >= data.Count) return;

        // Convert to points
        var objX = PixelsToPoints(obj.X);
        var objY = PixelsToPoints(yStartPx);
        var objW = PixelsToPoints(obj.Width);

        var rowHeight = PixelsToPoints(30);
        var (colWidthsPt, colXPt) = ComputeTableColumnLayout(objW, columns, props.ColumnWidths);

        var headerDefaults = new TextStyleProperties
        {
            BackgroundColor = "#f3f4f6",
            BorderColor = "#d1d5db",
            BorderWidth = 1,
            Color = "#374151",
            FontSize = 12,
            FontFamily = "Arial",
            Bold = true,
            Padding = 5,
            TextAlign = "left",
            Opacity = 1
        };

        // Draw header cells (with formatting)
        for (int i = 0; i < columns.Count; i++)
        {
            var x = objX + colXPt[i];
            var y = objY;
            var col = columns[i];
            var headerStyle = GetHeaderCellStyle(props, col);
            DrawStyledCell(canvas, x, y, colWidthsPt[i], rowHeight, col, headerStyle, headerDefaults);
        }

        var cellDefaults = new TextStyleProperties
        {
            BackgroundColor = "#ffffff",
            BorderColor = "#e5e7eb",
            BorderWidth = 1,
            Color = "#4b5563",
            FontSize = 12,
            FontFamily = "Arial",
            Bold = false,
            Padding = 5,
            TextAlign = "left",
            Opacity = 1
        };

        var displayData = data.Skip(startRow).Take(rowsToTake).ToList();
        for (int rowIndex = 0; rowIndex < displayData.Count; rowIndex++)
        {
            var row = displayData[rowIndex];
            var y = objY + (rowIndex + 1) * rowHeight;

            for (int colIndex = 0; colIndex < columns.Count; colIndex++)
            {
                var x = objX + colXPt[colIndex];
                var col = columns[colIndex];

                if (row.TryGetValue(col, out var value) && value != null)
                {
                    var (cellText, cellStyle) = TryExtractValueAndStyle(value);
                    DrawStyledCell(canvas, x, y, colWidthsPt[colIndex], rowHeight, cellText, cellStyle, cellDefaults);
                }
                else
                {
                    DrawStyledCell(canvas, x, y, colWidthsPt[colIndex], rowHeight, string.Empty, null, cellDefaults);
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

            case ReportObjectType.Datatable:
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
        var data = obj.Data ?? parentRegion?.Data ?? new List<Dictionary<string, object>>();

        // Convert to points
        var objX = PixelsToPoints(obj.X);
        var objY = PixelsToPoints(obj.Y);
        var objW = PixelsToPoints(obj.Width);
        var objH = PixelsToPoints(obj.Height);

        var rowHeight = PixelsToPoints(30);
        var (colWidthsPt, colXPt) = ComputeTableColumnLayout(objW, columns, props.ColumnWidths);

        var headerDefaults = new TextStyleProperties
        {
            BackgroundColor = "#f3f4f6",
            BorderColor = "#d1d5db",
            BorderWidth = 1,
            Color = "#374151",
            FontSize = 12,
            FontFamily = "Arial",
            Bold = true,
            Padding = 5,
            TextAlign = "left",
            Opacity = 1
        };

        // Draw header cells (with formatting)
        for (int i = 0; i < columns.Count; i++)
        {
            var x = objX + colXPt[i];
            var y = objY;
            var col = columns[i];
            var headerStyle = GetHeaderCellStyle(props, col);
            DrawStyledCell(canvas, x, y, colWidthsPt[i], rowHeight, col, headerStyle, headerDefaults);
        }

        var cellDefaults = new TextStyleProperties
        {
            BackgroundColor = "#ffffff",
            BorderColor = "#e5e7eb",
            BorderWidth = 1,
            Color = "#4b5563",
            FontSize = 12,
            FontFamily = "Arial",
            Bold = false,
            Padding = 5,
            TextAlign = "left",
            Opacity = 1
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
                var x = objX + colXPt[colIndex];
                var col = columns[colIndex];

                if (row.TryGetValue(col, out var value) && value != null)
                {
                    var (cellText, cellStyle) = TryExtractValueAndStyle(value);
                    DrawStyledCell(canvas, x, y, colWidthsPt[colIndex], rowHeight, cellText, cellStyle, cellDefaults);
                }
                else
                {
                    DrawStyledCell(canvas, x, y, colWidthsPt[colIndex], rowHeight, string.Empty, null, cellDefaults);
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
