# 🐍 Pyth Board

A comprehensive dashboard for tracking Pyth Network OIS (Oracle Incentive Scheme) staking statistics across multiple wallets. Built with Next.js 15, TypeScript, and modern React patterns.

## 🌟 Features

- **Multi-Wallet Support**: Track staking data across multiple Solana wallets
- **Real-time Data**: Live Pyth price and staking statistics
- **Interactive Charts**: Pie charts and visualizations for wallet distribution
- **NFT Roles**: View and manage Pythenians NFT partnerships
- **Responsive Design**: Mobile-first approach with dark theme
- **Data Persistence**: Local storage for wallet data and preferences

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
│   ├── page.tsx           # Dashboard (/) - Main page with portfolio overview
│   ├── wallets/           # Wallets route (/wallets)
│   │   └── page.tsx       # Wallets page - Display all wallet sections
│   ├── pythenians/        # Pythenians route (/pythenians)
│   │   └── page.tsx       # NFT roles page
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── sidebar.tsx       # Navigation sidebar
│   ├── top-header.tsx    # Top navigation bar
│   ├── metric-cards.tsx  # Dashboard metrics with pie charts
│   ├── portfolio-summary.tsx # Portfolio overview
│   ├── wallet-section.tsx # Individual wallet display
│   ├── wallet-dropdown.tsx # Wallet management modal
│   └── nft-roles.tsx     # NFT partnerships display
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

### Routing Structure

- **`/`** - Dashboard: Portfolio summary, metrics, and general information
- **`/wallets`** - Wallets: Detailed view of all connected wallets
- **`/pythenians`** - Pythenians: NFT roles and partnerships

### State Management

- **Zustand Store**: Centralized state for wallet data
- **Local Storage**: Persistence layer for wallet information
- **Real-time Updates**: Dashboard refreshes data, other pages use cached data

### Key Components

#### Dashboard (`app/page.tsx`)

- Fetches and displays portfolio summary
- Shows Pyth price and staking metrics
- Handles data refresh on page reload
- Displays interactive pie charts

#### Wallets Page (`app/wallets/page.tsx`)

- Displays all wallet sections
- Uses cached data (no API calls)
- Fast navigation and instant loading

#### Sidebar (`components/sidebar.tsx`)

- Next.js Link-based navigation
- Active route detection
- Mobile-responsive with overlay

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
- **Icons**: Lucide React
- **Blockchain**: Solana Web3.js, Pyth Network SDK

### Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Next.js recommended configuration
- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS with responsive design
- **State**: Zustand for global state management

## 🔧 Key Features Implementation

### Wallet Management

- Add/remove wallets through dropdown modal
- Click-outside-to-close functionality
- Data persistence in localStorage
- Real-time staking information fetching

### Data Flow

1. **Dashboard**: Fetches fresh data from Pyth Network APIs
2. **Store**: Updates Zustand store with new data
3. **Persistence**: Saves to localStorage
4. **Other Pages**: Read from store (cached data)

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

### Areas for Contribution

- **UI/UX Improvements**: Better mobile experience, animations
- **New Features**: Additional chart types, export functionality
- **Performance**: Optimize API calls, caching strategies
- **Testing**: Add unit and integration tests
- **Documentation**: Improve code comments and guides

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
