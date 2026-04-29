# Social Media Analytics Dashboard

A full-stack data-driven system integrating **MySQL**, **PHP**, **CSS/HTML/JS**, and **Python**.

---

## Folder Structure

```
social_media_dashboard/
├── index.html                  ← Dashboard UI entry point
├── css/
│   └── style.css               ← Dark analytics theme
├── js/
│   └── dashboard.js            ← All frontend logic (CRUD, charts, script runner)
├── php/
│   ├── db_config.php           ← PDO connection + helpers
│   ├── posts_api.php           ← Posts CRUD API (GET/POST/PUT/DELETE)
│   ├── users_api.php           ← Accounts CRUD API
│   └── run_script.php          ← Secure Python script runner
├── python/
│   ├── sentiment_analysis.py   ← VADER sentiment → writes to sentiment_results
│   ├── data_aggregation.py     ← Monthly roll-ups → writes to aggregation_reports
│   └── trend_analysis.py       ← Trending hashtags + engagement velocity (read-only)
└── sql/
    └── schema.sql              ← Full 3NF schema + sample data + views
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| MySQL | 8.0+ |
| PHP  | 8.0+ (with PDO_MySQL, shell_exec enabled) |
| Python | 3.10+ |
| pip packages | `mysql-connector-python`, `vaderSentiment` |

---

## Setup

### 1. Database
```bash
mysql -u root -p < sql/schema.sql
```

### 2. PHP Configuration
Edit `php/db_config.php`:
```php
define('DB_USER', 'your_mysql_user');
define('DB_PASS', 'your_mysql_password');
```

### 3. Python Dependencies
```bash
pip install mysql-connector-python vaderSentiment
```

### 4. Web Server
Place the project folder inside your web server root (e.g., `htdocs/` for XAMPP or `www/` for WAMP):

```
htdocs/
└── social_media_dashboard/
    └── index.html   ← open http://localhost/social_media_dashboard/
```

> **XAMPP users**: Enable `shell_exec` in `php.ini` (it is on by default in most setups).

---

## Database Schema (3NF)

```
platforms ──< users ──< posts ──< engagement_metrics
                               └─< sentiment_results
                               └─< post_hashtags >── hashtags
         users ──< aggregation_reports
```

All tables satisfy **3NF**:
- Every non-key attribute depends on the **whole** primary key (2NF).
- No non-key attribute depends on another non-key attribute (3NF).
- M:N relationships (posts ↔ hashtags) are resolved via junction tables.

---

## Features

### Dashboard UI
- **Overview** — KPI cards, top posts table, likes-by-account bar chart
- **Charts & Trends** — platform comparison, sentiment distribution, hashtag frequency
- **Posts** — full CRUD with filter by platform/sentiment and sort controls
- **Accounts** — full CRUD for tracked social media accounts
- **Python Scripts** — in-browser script runner with live JSON output

### API Endpoints (PHP)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET    | `posts_api.php?action=list` | List all posts with engagement + sentiment |
| GET    | `posts_api.php?action=single&id=N` | Single post detail |
| GET    | `posts_api.php?action=stats` | Per-user aggregated stats |
| GET    | `posts_api.php?action=platform_breakdown` | Platform comparison |
| GET    | `posts_api.php?action=sentiment_summary` | Sentiment counts |
| GET    | `posts_api.php?action=top_hashtags` | Top 15 hashtags |
| POST   | `posts_api.php` | Create post + engagement row |
| PUT    | `posts_api.php` | Update post content + metrics |
| DELETE | `posts_api.php` | Delete post (cascades) |
| GET/POST | `users_api.php` | CRUD for accounts |
| POST   | `run_script.php?script=sentiment` | Run sentiment_analysis.py |
| POST   | `run_script.php?script=aggregate` | Run data_aggregation.py |
| POST   | `run_script.php?script=trend` | Run trend_analysis.py |

### Python Scripts
| Script | Description | DB Write |
|--------|-------------|----------|
| `sentiment_analysis.py` | VADER polarity scoring per post | `sentiment_results` |
| `data_aggregation.py`   | Monthly totals & top post per user | `aggregation_reports` |
| `trend_analysis.py`     | Trending hashtags + velocity | None (read-only) |

All scripts include a **demo/fallback mode** when MySQL is unavailable.

---

## Sample Data Included
- 5 platforms (Twitter, Instagram, Facebook, LinkedIn, TikTok)
- 5 user accounts with realistic bios and follower counts
- 12 posts with varied content across all platforms
- Engagement metrics for every post
- Pre-seeded sentiment scores (overwritten when Python script runs)
- 28 hashtags with post associations