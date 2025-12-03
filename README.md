# 🎮 Jared's Games Hub

A personal dashboard to track your daily and weekly web games progress. Built with [Astro](https://astro.build).

## ✨ Features

- **Daily Game Tracking**: Keep track of Wordle, Connections, Strands, and many more.
- **Weekly Game Tracking**: Track weekly leagues and fantasy games.
- **Progress Bars**: Visual feedback on your daily completion status.
- **Local Persistence**: Your progress is saved automatically to your browser's local storage.
- **Smart Resets**:
  - Daily games reset automatically at midnight.
  - Weekly games reset automatically on Mondays.
- **Premium Design**: Sleek dark mode interface with glassmorphism effects.

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build)
- **Styling**: Scoped CSS (No external CSS frameworks)
- **Logic**: Vanilla JavaScript (Client-side)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd jared-website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:4321` to see your hub!

## 📝 Customization

To add or remove games, edit the `DAILY_GAMES` or `WEEKLY_GAMES` arrays in `src/components/GamesHub.astro`.

```typescript
const DAILY_GAMES = [
  { id: "wordle", name: "Wordle", url: "..." },
  // Add your games here
];
```
