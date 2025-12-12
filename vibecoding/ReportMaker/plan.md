# Report Parameters Implementation Plan

## Status: COMPLETED

## Overview
Implement a report parameters system that allows users to define variables that can be used throughout the report. Parameters will be displayed in a collapsible panel at the top of the screen.

## 1. Type Definitions (`src/types/index.ts`)

Add new types for report parameters:

```typescript
export type ReportParameterType =
  | 'string'
  | 'integer'
  | 'float'
  | 'date'
  | 'time'
  | 'datetime'
  | 'daterange'
  | 'boolean'
  | 'list-string'
  | 'list-number'
  | 'email';

export interface ReportParameter {
  id: string;
  name: string;           // Variable name (used in expressions like {{paramName}})
  type: ReportParameterType;
  label?: string;         // Display label
  description?: string;   // Help text
  placeholder?: string;   // Input placeholder
  required: boolean;      // Mandatory or optional
  defaultValue?: any;     // Default value (type depends on parameter type)
  value?: any;            // Current value
  listValues?: string[];  // For list types: available options
}
```

## 2. Store Updates (`src/hooks/useReportStore.ts`)

Add parameter management to the store:

- Add `parameters: ReportParameter[]` to state
- Add actions:
  - `addParameter(type: ReportParameterType): void`
  - `updateParameter(id: string, updates: Partial<ReportParameter>): void`
  - `removeParameter(id: string): void`
  - `setParameterValue(id: string, value: any): void`
- Update `saveReport` to include parameters in JSON
- Update `loadReport` to restore parameters from JSON

## 3. Parameters Panel Component (`src/components/ParametersPanel/ParametersPanel.tsx`)

Create a new collapsible panel component:

- Positioned at the top of the screen (below toolbar)
- Collapse/expand toggle button
- "+" button to add new parameter (opens type selector)
- List of parameters with:
  - Parameter name (editable)
  - Type indicator
  - Value input (type-specific)
  - Required toggle
  - "-" button to remove
- Expandable details for each parameter:
  - Label
  - Description
  - Placeholder
  - Default value

## 4. Parameter Input Components (`src/components/ParametersPanel/ParameterInput.tsx`)

Create type-specific input components:

- `StringInput` - text input
- `IntegerInput` - number input (step=1)
- `FloatInput` - number input (step=any)
- `DateInput` - date picker
- `TimeInput` - time picker
- `DateTimeInput` - datetime-local picker
- `DateRangeInput` - two date pickers (from/to)
- `BooleanInput` - checkbox/toggle
- `ListStringInput` - multi-select or tags input
- `ListNumberInput` - multi-select numbers
- `EmailInput` - email input with validation

## 5. Parameter Type Selector (`src/components/ParametersPanel/ParameterTypeSelector.tsx`)

Modal/dropdown to select parameter type when adding new parameter:

- Grid or list of available types
- Icon and label for each type
- Creates parameter with sensible defaults

## 6. App Layout Update (`src/App.tsx`)

Integrate the parameters panel:

- Add ParametersPanel between Toolbar and main content area
- Ensure proper z-index and positioning

## 7. JSON Persistence

Update save/load to handle parameters:

```json
{
  "reportObjects": [...],
  "canvasSettings": {...},
  "parameters": [
    {
      "id": "uuid",
      "name": "startDate",
      "type": "date",
      "label": "Start Date",
      "required": true,
      "defaultValue": "2024-01-01"
    }
  ]
}
```

## 8. Parameter Usage in Report (IMPLEMENTED)

✅ Text objects can reference parameters using `{{paramName}}` syntax
✅ Barcode objects can use parameters in their text content
✅ Preview/PDF generation substitutes parameter values
- Future: Data region queries can use parameters as filters

## Implementation Order

1. ✅ Add types to `types/index.ts`
2. ✅ Update store with parameter state and actions
3. ✅ Create ParameterInput component (handles all types)
4. ✅ Create ParameterTypeSelector component
5. ✅ Create ParameterRow component
6. ✅ Create ParametersPanel component
7. ✅ Update App.tsx layout
8. ✅ Update save/load functions (included in step 2)

## File Structure

```
src/
  components/
    ParametersPanel/
      ParametersPanel.tsx      # Main collapsible panel
      ParameterInput.tsx       # Type-specific inputs
      ParameterTypeSelector.tsx # Type selection modal
      ParameterRow.tsx         # Single parameter row
      index.ts                 # Exports
  types/
    index.ts                   # Add ReportParameter types
  hooks/
    useReportStore.ts          # Add parameter state/actions
```

## UI Design Notes

- Panel header: "Report Parameters" with collapse button and "+" add button
- When collapsed: show just header bar with count of parameters
- When expanded: show scrollable list of parameter rows
- Each row: compact view with name, type badge, value input, required indicator, delete button
- Click row to expand and show additional fields (label, description, placeholder, default)
- Use consistent styling with existing Toolbar and PropertiesPanel
