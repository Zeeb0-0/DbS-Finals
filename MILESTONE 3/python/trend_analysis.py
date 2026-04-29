#!/usr/bin/env python3
"""
trend_analysis.py
─────────────────
Detects trending hashtags and engagement velocity, prints JSON.
No DB writes — pure read & compute.
"""

import sys
import json
import argparse
import os
from collections import Counter

try:
    import mysql.connector
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "database": os.getenv("DB_NAME", "social_media_analytics"),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", ""),
    "charset":  "utf8mb4",
}


def run_trends() -> dict:
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # Top hashtags
    cursor.execute("""
        SELECT h.hashtag_text, COUNT(*) AS usage_count,
               SUM(em.likes + em.shares + em.comments) AS total_engagement
        FROM post_hashtags ph
        JOIN hashtags h ON ph.hashtag_id = h.hashtag_id
        JOIN engagement_metrics em ON ph.post_id = em.post_id
        GROUP BY h.hashtag_id, h.hashtag_text
        ORDER BY usage_count DESC, total_engagement DESC
        LIMIT 10
    """)
    trending_hashtags = cursor.fetchall()

    # Engagement velocity — posts sorted by engagement per day since posted
    cursor.execute("""
        SELECT p.post_id,
               LEFT(p.post_content, 60)            AS preview,
               u.username,
               pl.platform_name,
               (em.likes + em.shares + em.comments) AS total_engagement,
               DATEDIFF(NOW(), p.post_date) + 1    AS days_old,
               ROUND((em.likes + em.shares + em.comments) /
                     (DATEDIFF(NOW(), p.post_date) + 1), 2) AS engagement_velocity
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        JOIN platforms pl ON u.platform_id = pl.platform_id
        JOIN engagement_metrics em ON p.post_id = em.post_id
        ORDER BY engagement_velocity DESC
        LIMIT 10
    """)
    velocity = cursor.fetchall()

    # Platform comparison
    cursor.execute("""
        SELECT pl.platform_name,
               COUNT(p.post_id) AS posts,
               AVG(em.likes)    AS avg_likes,
               AVG(em.views)    AS avg_views,
               AVG(em.likes + em.shares + em.comments) AS avg_engagement
        FROM platforms pl
        JOIN users u ON pl.platform_id = u.platform_id
        JOIN posts p ON u.user_id = p.user_id
        JOIN engagement_metrics em ON p.post_id = em.post_id
        GROUP BY pl.platform_id, pl.platform_name
        ORDER BY avg_engagement DESC
    """)
    platform_cmp = cursor.fetchall()

    cursor.close()
    conn.close()

    # Serialise Decimal / int
    def clean(obj):
        if isinstance(obj, list):
            return [clean(i) for i in obj]
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items()}
        try:
            return float(obj)
        except (TypeError, ValueError):
            return obj

    return {
        "trending_hashtags": clean(trending_hashtags),
        "engagement_velocity": clean(velocity),
        "platform_comparison": clean(platform_cmp),
    }


DEMO_TRENDS = {
    "trending_hashtags": [
        {"hashtag_text":"Philippines","usage_count":2,"total_engagement":50200},
        {"hashtag_text":"DigitalArt","usage_count":2,"total_engagement":25800},
        {"hashtag_text":"Tech","usage_count":2,"total_engagement":7300},
        {"hashtag_text":"TechReview","usage_count":1,"total_engagement":5402},
        {"hashtag_text":"FreeResources","usage_count":1,"total_engagement":27700},
    ],
    "engagement_velocity": [
        {"post_id":11,"preview":"POV: You push to production on a Friday.","username":"devlife_tiktok",
         "platform_name":"TikTok","total_engagement":56100,"days_old":174,"engagement_velocity":322.41},
        {"post_id":12,"preview":"Teaching myself Rust after 5 years of Python.","username":"devlife_tiktok",
         "platform_name":"TikTok","total_engagement":41700,"days_old":169,"engagement_velocity":246.75},
    ],
    "platform_comparison": [
        {"platform_name":"TikTok","posts":2,"avg_likes":38500,"avg_views":770000,"avg_engagement":24900},
        {"platform_name":"Instagram","posts":3,"avg_likes":15633,"avg_views":175000,"avg_engagement":6293},
        {"platform_name":"Facebook","posts":2,"avg_likes":14250,"avg_views":166000,"avg_engagement":19120},
        {"platform_name":"LinkedIn","posts":2,"avg_likes":2115,"avg_views":31500,"avg_engagement":1726},
        {"platform_name":"Twitter","posts":3,"avg_likes":5033,"avg_views":60667,"avg_engagement":3345},
    ],
}


if __name__ == "__main__":
    if not MYSQL_AVAILABLE:
        print(json.dumps({"status": "demo", **DEMO_TRENDS}, indent=2))
        sys.exit(0)

    try:
        data = run_trends()
        print(json.dumps({"status": "success", **data}, indent=2))
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}, indent=2))
        sys.exit(1)