internal static class CanvasSettingsBuilder
{
    internal static object Build(int widthPx, int heightPx, int marginPx)
    {
        return new
        {
            showGrid = false,
            snapToGrid = false,
            gridSize = 10,
            zoom = 1,
            width = widthPx,
            height = heightPx,
            page = new
            {
                preset = "A4",
                orientation = "portrait",
                width = widthPx,
                height = heightPx,
                margins = new { top = marginPx, right = marginPx, bottom = marginPx, left = marginPx }
            }
        };
    }
}
