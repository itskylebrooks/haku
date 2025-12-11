# Haku

A quiet planner that unifies calendar and todos into a single, simple view of your week.

#### Desktop Version
![Day View (Desktop)](public/images/desktop-day.png)

![Week View (Desktop)](public/images/desktop-week.png)

![Board View (Desktop)](public/images/desktop-board.png)

#### Mobile Version
![Board, Day, Week Views (Mobile)](public/images/mobile-all.png)

## Overview

Haku is a calm weekly planner built around one type of object: an **activity**.

There’s no split between tasks and events, no projects, no tags, no color systems to maintain. An activity can:

- live on a specific day (with or without time),
- sit in **Inbox** when it’s just a thought,
- or move to **Later** when you’re not ready to schedule it yet.

Haku is for people who feel exhausted by “serious” productivity tools—calendars full of slots, todo apps full of labels, and all-in-one systems that turn planning into a hobby. It gives you one clear surface for **Today** and **This Week**, and then gets out of the way.


## Features

- **One object: activities**  
  Everything is an activity. No separate models for tasks vs events; no duplicate entries across tools.

- **Day-first planning**  
  The **Day** view is home: a single Today column with Overdue items nearby, so you see what actually competes for your attention.

- **Week at a glance**  
  The **Week** view is a calm grid that lets you shift activities across days and balance the week without micromanaging every hour.

- **Board with Inbox and Later**  
  The **Board** view holds Inbox and Later as simple lists: fast capture for ideas, and a deliberate parking spot for “not now.”

- **Light “repeat” via duplication**  
  Time-based activities (classes, training, recurring meetings) can be duplicated forward across days/weeks. Each copy is independent; there’s no hidden recurrence engine.

- **Local-first and offline**  
  All state is stored in the browser (localStorage). Haku works offline by default; your data stays on your device.

- **PWA (Installable)**  
  Haku ships with a manifest and service worker. On supported browsers you can install it to your home screen / app launcher like a native app.

- **Keyboard-friendly (desktop)**  
  Quick creation and navigation via keyboard shortcuts so you don’t have to leave the keys every few seconds.

- **Calm design**  
  Minimal UI, subtle motion, no feeds, no streaks, no gamification. The app tries not to shout at you.


## Core concepts

### Activities

An activity is the only thing Haku stores. It roughly has:

- `title`
- optional `note`
- optional `date`
- optional `time` and `duration`
- `list`: `"inbox" | "day" | "later"`
- `completed`: `boolean`

Rich meaning lives in your head; the activity is just a handle into it.

### Three “homes”

An activity can live in exactly one of these places at a time:

- **Inbox** – raw capture. Ideas, vague tasks, half-decisions you’ll sort out later.
- **Day (dated)** – a specific date, optionally with time. This is what actually competes for your day.
- **Later** – things you don’t want to delete, but don’t want to lie to yourself about doing “soon”.

The **Week** view doesn’t introduce new data; it’s just the dated activities arranged side by side.


## Why I built it

For years I bounced between tools: Google Calendar, Microsoft To Do, Notion setups, paper notebooks, niche indie apps, Apple Calendar + Reminders. The pattern was always the same: initial excitement, a burst of setup, a couple of “perfect” weeks, and then quiet abandonment.

The problem wasn’t discipline; it was structure. Most tools expect you to think in time slots, projects, tags, and priorities. My brain doesn’t work that way. It thinks in “today,” “this week,” and “later,” plus a messy web of associations that no app can—or should—try to fully copy.

I don’t need a second brain; I need thin handles into the one I already have. Haku is an attempt to build exactly that: one small object (activity), a few simple places it can live, and views that match how real days actually feel.

A longer, essay-style writeup about Haku’s story and philosophy will live on my personal site.


## Tech stack

- **Framework**: React + TypeScript  
- **Build tool**: Vite  
- **State**: Lightweight global store (Zustand-style) + localStorage persistence  
- **Styling**: Tailwind CSS  
- **Icons & motion**: Lucide, Framer Motion (used sparingly)  
- **PWA**: Manifest + service worker for offline support and installability  


## Getting started

Prerequisites:

- Node.js (LTS or newer)
- npm / pnpm / yarn (pick one; commands below use `npm`)

Clone and install:

```bash
git clone https://github.com/<your-username>/haku.git
cd haku
npm install
```

Start dev server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

Preview production build:

```bash
pnpm run preview
```

## Keyboard shortcuts (desktop)

* **Create new activity**: `Cmd/Ctrl + K`
* **Close modals / dialogs**: `Esc`
* **Confirm in dialogs**: `Enter`

## Data & privacy

* All data is stored locally in your browser via `localStorage` under a single key (e.g. `haku:v1:state`).
* There is no account system and no server-side storage by default.
* Import/export is available so you can back up or move your data between devices manually.

If I ever add sync or server features, they will be clearly documented and opt-in.

## Status

Right now Haku has everything it needs to be my main planner: activities as the only object, Day/Week/Board views, Inbox and Later, local storage, PWA support, and keyboard shortcuts. It opens fast and is stable enough for planning real weeks without a backup app.

I don’t call it “finished,” because the work left isn’t about more features — it’s about rounding edges. Small bugs, awkward spots in the UI, and interaction details still need polish. I’m cautious about adding anything on top of the current model, because each “harmless” option risks turning a calm planner into the kind of system I originally wanted to escape.

For now, I’m the first beta user. If you’re similarly allergic to noise and heavy systems, Haku might be useful to you too.

## License

Code: The source code in this repository is licensed under the MIT License (see `LICENSE`).

## Trademarks and project names

All trademarks, service marks, and trade names remain the property of their respective owners.

In particular, you may not use the name “Haku”, my logo, visual identity, or the name “Kyle Brooks” in a way that suggests your fork, app, or product is the original or is officially endorsed, unless you have my explicit written permission.

The MIT license applies to the code, not to the brand, naming, visual identity, or marketing copy.