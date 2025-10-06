# Excel Grid

A feature-rich, Excel-like grid component built with React, TypeScript, D3.js, and Material-UI.

## Features

- 📊 Excel-like grid with row/column selection
- 🎨 Rich text formatting (bold, italic, underline, font size, colors)
- 📏 Resizable columns and rows
- 🔄 CSV import/export
- 📋 Copy/paste support
- 🎯 Cell alignment (left, center, right)
- 🖌️ Cell styling and borders
- ⚡ High performance with virtual scrolling

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **D3.js** - Grid rendering and visualization
- **Material-UI** - UI components and toolbar
- **Cloudflare Pages** - Deployment platform

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

### Development

The application will be available at `http://localhost:5173` (default Vite port).

## Deployment

### Deploy to Cloudflare Pages

This project is configured for easy deployment to Cloudflare Pages.

**Quick Deploy:**
```bash
# Install wrangler and deploy
pnpm install
pnpm run deploy
```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Deployment Options:
1. **Manual deployment** - Deploy from local machine with `pnpm run deploy`
2. **GitHub integration** - Connect your repo to Cloudflare Pages for automatic deployments
3. **CI/CD** - Use the included GitHub Actions workflow

## Project Structure

```
excel-grid/
├── src/
│   ├── components/       # React components
│   │   ├── ExcelGrid.tsx # Main grid component
│   │   ├── Toolbar.tsx   # Formatting toolbar
│   │   └── CSVImportDialog.tsx
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   └── hooks/            # Custom React hooks
├── public/               # Static assets
├── wrangler.toml         # Cloudflare configuration
└── DEPLOYMENT.md         # Deployment guide

```

## Scripts

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build locally
- `pnpm run deploy` - Build and deploy to Cloudflare Pages
- `pnpm run pages:dev` - Test with Cloudflare Pages locally
- `pnpm run lint` - Run ESLint

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
