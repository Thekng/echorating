# EchoRating 2.0 — Redesign + Product Evolution Prompt

You are an expert senior full-stack engineer, product designer, and SaaS architect. Your task is to evolve the existing EchoRating app into a cleaner, more modern agency performance platform.

## Context

EchoRating is an agency performance workspace used to track daily stats by members and departments. Have in mind to make the proper conections with the database (supabase) so that the app doesnt break (feel free to create new tables or schemas if you believe it will make the system more secure or operate faster).

Current app has:

* Sidebar navigation: Dashboard, Daily Log, Team, Settings
* Daily Log form
* Team page
* Leaderboard page
* Member profile page
* Settings pages for Company, Departments, Metrics, Members
* Departments personalized by the owner 
* Metrics personalized by the owner 

Current problem:

The app works as a data entry and reporting tool, but it does not yet feel like a modern SaaS performance operating system. It lacks a strong dashboard, visual hierarchy, accountability automation, and actionable insights.

Main goal:

Transform EchoRating from a simple daily stats tracker into an **Agency Performance Operating System** centered around:

1. Daily accountability
2. Team performance visibility
3. Department performance
4. Score-based health tracking

---

# Design System / UI Requirements

## Install and apply theme

Run:

```bash
npx shadcn@latest add https://tweakcn.com/r/themes/cmlh0vbnd000004l112kx8a0l
```

Use the installed shadcn/tweakcn theme as the base visual system.

## UI Direction

Use a clean SaaS style inspired by:

* Linear
* Stripe
* Vercel
* Notion dashboards

Design principles:

* Minimal but not empty
* Clear hierarchy
* Fast scanning
* Strong cards
* Better spacing
* Better tables
* More visual dashboard
* More useful empty states
* Mobile-friendly where practical
* large view

Avoid:

* Overloaded tables as the primary experience
* Too many borders
* Raw CRUD feeling
* Generic admin dashboard look
* Excessive colors

Use:

* shadcn components
* cards
* badges
* tabs
* dropdowns
* progress bars
* skeleton states
* empty states
* responsive grids
* icons from lucide-react if available

---

# Product Positioning

EchoRating should become an Agency Performance Operating System

Core idea:

Everything in the platform should help answer:

* Is the agency healthy?
* Who is performing?
* Who is falling behind?
* Which department needs attention?
* What should the owner/manager do today?

The key product concept is:

## Metric Trends

For any date range selected, show whether each metric is trending up or down compared to the previous equivalent period. This is the core insight the owner/manager needs — are numbers going in the right direction?

* Compare selected period vs previous period of same length (e.g., this week vs last week)
* Show a simple up/down arrow + percentage change per metric
* Apply to dashboard KPI cards, leaderboard, member profiles, and department views
* If not enough data for comparison, show "No trend data" gracefully

---

# Navigation Update

Use this simplified sidebar:

* Dashboard
* Daily Log
* Team
* Leaderboard
* Reports
* Settings

If Reports does not exist yet, add route placeholder with useful empty state.

Sidebar should include:

* EchoRating logo/name
* Workspace subtitle
* Main navigation
* Bottom area with agency name, dark mode toggle if already supported, and collapse button if current layout supports it

---

# P0 — Critical Implementation

## 1. Redesign Foundation

Implement a consistent layout system:

* AppShell
* Sidebar
* PageHeader
* StatCard
* MetricCard
* ScoreCard
* DataTable wrapper
* EmptyState
* FilterBar
* SectionHeader

Create or refactor reusable components instead of duplicating UI.

All existing screens should visually align with the new design system.

---

## 2. Dashboard 2.0

The Dashboard must become the primary home screen.

Create a modern dashboard that includes:

### 2.1 Header

Content:

* Title: `Dashboard`
* Subtitle: `Track agency performance, accountability, and team momentum.`
* Period selector: Today / Yesterday /This Week / This Month / Last Month / Custom

### 2.2 KPI Snapshot

Four cards:

* Premium Sold / Premium Written
* Policies Sold
* New Conversations
* Total Calls

Each card should show:

* Current value
* Target if available
* Progress percentage
* Trend if available
* Empty state if unavailable

### 2.4 Department Scorecards

Show all active departments as cards.

Each card:

* Department name
* Department score
* Completion rate
* Top metric
* Missing logs count
* Trend indicator

### 2.5 Top Performers

Show top 3 members for selected period.

Each card:

* Rank
* Name
* Department
* Primary metric value
* Score or completion rate

Add CTA:

* `View Leaderboard`

### 2.6 Missing Daily Entries

Important accountability widget.

Show members who have not submitted today or selected period.

Fields:

* Member name
* Department
* Last submission date
* Status badge

Add CTA placeholder:

* `Send Reminder`

If reminder system is not built yet, button can be disabled with tooltip or open a placeholder modal.

### 2.7 Activity Feed

Create activity feed from recent logs.

Example items:

* `Amy submitted daily log`
* `Chris reached 80% of target`
* `Service team completed 92% of logs`

If event tracking does not exist, derive from recent logs.

### 2.8 Forecast Widget

Show projected result when possible.

Example:

* Current Premium: `$412,000`
* Projected Month End: `$538,000`
* Projected Achievement: `108%`

If not enough data, show empty state.

---

## 3. Daily Log 2.0

Improve Daily Log UX.

Rename experience mentally from “form” to “Daily Check-In”.

Required improvements:

* Cleaner layout
* Better sectioning
* Progress indicator
* Autosave draft if existing backend supports it
* Keep manual Save Draft if already exists
* Submit Daily Log primary CTA
* Better validation for required fields
* Notes section remains
* Recent Logs table remains but improved visually

Daily Log layout:

1. Page header
2. Context row:

   * Department
   * Agent
   * Date
3. Metric input grid
4. Notes
5. Draft/submit actions
6. Recent logs

Add clear states:

* Draft
* Submitted
* Missing
* Late

---

## 4. Team Page 2.0

Current Team page is mostly a table. Add summary and better accountability.

Add top cards:

* Active Members
* Submitted Today
* Missing Logs
* Team Completion Rate

Then filters:

* Department
* Time
* Status
* Search

Then table:

* Member
* Role
* Department
* Status
* Submitted
* Draft
* Completion
* Last Entry
* Profile CTA

Improve badges and empty states.

---

## 5. Leaderboard 2.0

Make leaderboard more visual and useful.

Add:

* Top 3 podium cards
* Ranking table below
* Filters:

  * Team/Department
  * Time
  * Sort metric

Leaderboard table should include:

* Rank
* Member
* Department
* Premium Sold
* Policies Sold
* Items Sold
* New Conversations
* Total Calls
* Follow Ups
* Completion Rate
* Profile CTA

Ranking should support sorting by selected metric.

---

## 6. Member Profile 2.0

Transform profile page into Agent Performance Hub.

Header:

* Member name
* Role
* Department
* Status
* Rank
* Time filter

Top cards:

* Team Rank
* Personal Score
* Submitted Logs
* Completion Rate

Key stats:

* The ones created

Add charts if chart library exists. If not, add chart placeholder cards.

Required analytics:

* Line chart: metric evolution over time
* Comparison with department average
* Submission streak
* Progress vs target
* Daily performance calendar / heatmap

Recent Logs table remains but redesigned.

---

# P1 — Important Features

## 7. Department Dashboard

Create department-level analytics page or enhance existing Team/Reports structure.

Requirements:

* Department score
* Aggregated metrics
* Completion rate over time
* Heatmap of submissions by member/day
* Top performers
* Members needing attention
* Comparison between departments

If route does not exist, add under Reports or Dashboard.

---

## 8. Trends and Comparisons

Add temporal comparisons where data allows:

* Week over week
* Month over month
* 7-day moving average
* 30-day moving average
* Automatic trend labels:

  * Improving
  * Stable
  * Declining

Use simple calculations first.

Avoid overengineering.

---

## 9. Targets and Goals

Improve support for targets:

* Daily targets
* Weekly targets
* Monthly targets
* Department targets
* Member-specific targets

If database schema already supports targets, extend UI.
If not, add minimal structure or TODO markers with clear implementation notes.

Targets should power:

* Progress bars
* Score calculations
* Forecasts
* Alerts

---

# P2 — Accountability Automation

## 10. Alert Center

Add notification/alert structure.

Initial alert types:

* Missing daily log
* Below target for X days
* Department completion below threshold
* New record / achievement

Create UI first:

* Bell icon
* Alerts dropdown
* Alerts page or panel

If backend notification system does not exist yet, derive alerts dynamically from current data.

---

## 11. Digests / Reports

Add placeholders or initial implementation for:

* Daily digest
* Weekly report
* Monthly report
* Manager summary

Each should answer:

* What happened?
* Who performed?
* Who needs attention?
* What should manager do next?

---

# P3 — Gamification

Only implement after core accountability is strong.

Add later:

* Badges
* 7-day streak
* 30-day streak
* Top performer of the month
* Department challenges
* Milestone celebrations

Do not over-prioritize gamification before dashboard, daily log, and accountability.

---

# Data + Logic Requirements

Work with existing schema and codebase first.

Before changing database schema:

1. Inspect current models/tables/types.
2. Reuse existing data where possible.
3. Only add schema changes when necessary.
4. Keep migrations safe.
5. Do not break existing logs, members, departments, or metrics.

Required derived metrics:

## Completion Rate

```ts
completionRate = submittedLogs / expectedLogs
```

## Missing Logs

Members expected to submit but without submitted log for selected date/period.

## Streak

Consecutive days with submitted logs.

## Personal Score

Weighted score using:

* Completion
* Performance vs target
* Consistency
* Trend

## Department Score

Aggregate of member scores and department completion.

## Agency Score

Aggregate of department scores.

All scoring should handle missing targets and missing logs gracefully.

---

# Implementation Strategy

Work in this order:

## Step 1 — Audit

Inspect project structure:

* Framework
* Routing
* Components
* Database/schema
* Auth
* Existing metrics logic
* Existing dashboard logic
* Existing settings logic

Then summarize current architecture before making major changes.

## Step 2 — Design System

Install shadcn/tweakcn theme.

Create reusable components.

Refactor layout and sidebar.

## Step 3 — Dashboard

Build Dashboard 2.0 first.

This defines the product experience.

## Step 4 — Daily Log

Improve data entry and accountability.

## Step 5 — Team + Leaderboard

Upgrade team visibility.

## Step 6 — Profile + Analytics

Add member-level insights.

## Step 7 — Reports / Alerts / Forecasting

Add intelligence layer.

---

# Engineering Guidelines

* Keep implementation incremental.
* Avoid large risky rewrites.
* Preserve existing functionality.
* Use TypeScript strictly.
* Prefer reusable components.
* Avoid duplicated logic.
* Put score calculations in utility/service functions.
* Keep UI responsive.
* Add loading, empty, and error states.
* Use meaningful commit-sized changes.
* Do not remove existing features unless clearly replaced.
* Do not invent fake backend behavior; use placeholders when needed.

---

# Acceptance Criteria

The work is successful when:

* The app feels like a modern SaaS platform.
* Dashboard becomes the main value screen.
* Owner can quickly see agency health.
* Manager can quickly see missing logs.
* Members can understand their personal performance.
* Leaderboard feels competitive and useful.
* Daily Log is faster and cleaner.
* Settings remain functional but visually improved.
* Existing data is preserved.
* No existing critical workflows are broken.

---

# Final Output Expected From Claude

When implementing, provide:

1. Brief architecture findings
2. List of files changed
3. Explanation of major UI/data changes
4. Any schema changes
5. Any TODOs left intentionally
6. Testing instructions
7. Known limitations

Prioritize shipping a strong P0 implementation before starting P1/P2/P3.
