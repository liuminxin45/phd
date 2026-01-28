# Phabricator Dashboard

A unified dashboard for Phabricator based on Conduit API.

## Features

- Project Management
- Task Management (Maniphest)
- Blog System (Phame)
- User Information

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- TailwindCSS
- Material-UI & Radix UI

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set:
- `PHA_HOST`: Your Phabricator server URL
- `PHA_TOKEN`: Your Conduit API token

### 3. Run Development Server

```bash
npm run dev
```

The application will run at `http://localhost:9641`

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
phabricator-dashboard/
├── components/         # React components
├── contexts/          # React contexts
├── hooks/             # Custom hooks
├── lib/               # Utilities and API clients
├── pages/             # Next.js pages
├── public/            # Static assets
├── styles/            # Global styles
└── utils/             # Helper functions
```

## License

MIT
