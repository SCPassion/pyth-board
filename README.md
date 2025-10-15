# 🐍 Pyth Board

A comprehensive dashboard for tracking Pyth Network OIS (Oracle Integrity Staking) staking statistics across multiple wallets. Built with Next.js 15, TypeScript, and modern React patterns.

## 🌟 Features

- **Multi-Wallet Support**: Track staking data across multiple Solana wallets
- **Real-time Data**: Live Pyth price and staking statistics
- **Interactive Charts**: Pie charts and visualizations for wallet distribution
- **NFT Roles**: View and manage Pythenians NFT partnerships
- **Responsive Design**: Mobile-first approach with dark theme
- **Data Persistence**: Local storage for wallet data and preferences
- **Production Ready**: Clean, optimized codebase with no debug statements

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/SCPassion/pyth-board.git
cd pyth-board

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📁 Project Structure

```
pyth-board/
├── app/                    # Next.js 15 App Router
│   ├── page.tsx           # Dashboard (/) - Portfolio overview only
│   ├── wallets/           # Wallets route (/wallets)
│   │   └── page.tsx       # Wallets page - Display all wallet sections
│   ├── pythenians/        # Pythenians route (/pythenians)
│   │   └── page.tsx       # NFT roles page
│   └── layout.tsx         # Root layout with shared AppLayout
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── app-layout.tsx    # Shared layout with sidebar, header, and data fetching
│   ├── sidebar.tsx       # Navigation sidebar with Next.js routing
│   ├── top-header.tsx    # Top navigation bar with wallet dropdown
│   ├── metric-cards.tsx  # Dashboard metrics with pie charts
│   ├── portfolio-summary.tsx # Portfolio overview
│   ├── wallet-section.tsx # Individual wallet display
│   ├── wallet-dropdown.tsx # Wallet management modal
│   ├── nft-roles.tsx     # NFT partnerships display
│   ├── dashboard-skeleton.tsx # Loading skeleton for dashboard
│   └── icons/            # Custom icon components
│       └── twitter-icon.tsx # Custom Twitter/X icon
├── hooks/                # Custom React hooks
│   ├── use-pyth-price.ts # Pyth price fetching hook
│   └── use-loading-state.ts # Loading state management
├── store/                # State management
│   └── store.ts          # Zustand store for wallet data
├── action/               # Server actions
│   └── pythActions.ts    # Pyth Network API calls
├── types/               # TypeScript definitions
│   └── pythTypes.ts     # Type definitions
├── data/                # Static data
│   └── nftRoleInfo.ts   # NFT role information
└── lib/                 # Utilities
    └── utils.ts         # Helper functions
```

## 🏗️ Architecture

### Shared Layout Architecture

The application uses a **shared layout pattern** where the sidebar and top header are rendered once and persist across all routes, eliminating unnecessary re-renders and providing a consistent user experience.

### Routing Structure

- **`/`** - Dashboard: Portfolio summary, metrics, and general information
- **`/wallets`** - Wallets: Detailed view of all connected wallets
- **`/pythenians`** - Pythenians: NFT roles and partnerships

### State Management

- **Zustand Store**: Centralized state for wallet data
- **Local Storage**: Persistence layer for wallet information
- **Smart Data Updates**: Only refreshes on initial load and when new wallets are added
- **Shared State**: All pages access the same wallet data from the store

### Key Components

#### Shared Layout (`components/app-layout.tsx`)

- **Single source of truth** for sidebar, header, and data fetching
- **Wallet data management** - Loads from localStorage and fetches fresh data
- **Loading states** - Global loading indicator for data refresh
- **Mobile menu** - Handles mobile navigation state
- **No re-rendering** - Layout components stay mounted across route changes

#### Dashboard (`app/page.tsx`)

- **Content only** - No layout code, just dashboard components
- **Uses shared data** - Reads from Zustand store
- **Pyth price hook** - Uses `usePythPrice` for price data
- **Portfolio calculations** - Computes totals and metrics
- **Skeleton loading** - Shows loading state during data fetch

#### Wallets Page (`app/wallets/page.tsx`)

- **Content only** - No layout code, just wallet sections
- **Cached data** - Uses existing wallet data from store
- **Fast loading** - No API calls, instant display
- **Simple structure** - Just maps over wallet data

#### Pythenians Page (`app/pythenians/page.tsx`)

- **Minimal code** - Just renders NFT roles component
- **No data fetching** - Uses static NFT data
- **Clean structure** - Single component render

#### Sidebar (`components/sidebar.tsx`)

- **Next.js routing** - Uses Link components for navigation
- **Active detection** - Uses `usePathname` to highlight current route
- **Mobile responsive** - Overlay and toggle functionality
- **Persistent** - Stays mounted across all routes
- **Custom icons** - Uses custom Twitter/X icon component

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server with Turbopack
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Charts**: Recharts
- **UI Components**: Radix UI + shadcn/ui
- **Icons**: Lucide React + Custom SVG components
- **Blockchain**: Solana Web3.js, Pyth Network SDK

### Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Next.js recommended configuration
- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS with responsive design
- **State**: Zustand for global state management
- **Production Ready**: No debug statements, clean code

## 🔧 Key Features Implementation

### Wallet Management

- Add/remove wallets through dropdown modal
- Click-outside-to-close functionality
- Data persistence in localStorage
- Real-time staking information fetching

### Data Flow

1. **App Layout**: Loads wallets from localStorage on mount
2. **Data Refresh**: Fetches fresh staking data from Pyth Network APIs (production only)
3. **Store Update**: Updates Zustand store with fresh data
4. **Persistence**: Saves updated data to localStorage
5. **New Wallet Detection**: Listens for localStorage changes and refreshes data
6. **All Pages**: Read from shared store (consistent data across routes)

### Responsive Design

- Mobile-first approach
- Collapsible sidebar on mobile
- Responsive charts and components
- Touch-friendly interactions

## 🎨 UI/UX Features

### Dark Theme

- Consistent dark color scheme
- Purple accent colors for branding
- High contrast for readability

### Interactive Elements

- Hover effects on buttons and cards
- Loading states for data fetching
- Smooth transitions and animations
- Mobile menu with overlay
- Skeleton loading for smooth transitions

### Charts and Visualizations

- Pie charts for wallet distribution
- Responsive chart containers
- Color-coded legend with compact layout
- Real-time data updates

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Environment Variables

No environment variables required for basic functionality. The app uses public Pyth Network APIs.

## 🤝 Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use functional components and hooks
- Maintain responsive design
- Test on mobile and desktop
- Follow existing code style
- Update documentation for new features
- Keep code clean and production-ready

### Areas for Contribution

- **UI/UX Improvements**: Better mobile experience, animations
- **New Features**: Additional chart types, export functionality
- **Performance**: Optimize API calls, caching strategies
- **Testing**: Add unit and integration tests
- **Documentation**: Improve code comments and guides
- **Layout Enhancements**: Additional shared components, better state management
- **Route Optimization**: New pages following the established pattern

## 📊 Data Sources

- **Pyth Network APIs**: Staking information and price data
- **Solana RPC**: Wallet and transaction data
- **Local Storage**: User wallet configurations

## 🔒 Security

- No private keys stored
- Read-only wallet data access
- Client-side only (no backend required)
- Secure API communications

## 📱 Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## 🐛 Troubleshooting

### Common Issues

1. **Development server not starting**

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

2. **TypeScript errors**

   ```bash
   npm run lint
   ```

3. **Build failures**
   - Check Node.js version (18+)
   - Clear Next.js cache: `rm -rf .next`

### Getting Help

- Check existing issues on GitHub
- Create a new issue with detailed description
- Include browser console errors
- Provide steps to reproduce

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Pyth Network for the Oracle Incentive Scheme
- Next.js team for the amazing framework
- Radix UI for accessible components
- Tailwind CSS for utility-first styling

---

**Happy coding! 🚀**
