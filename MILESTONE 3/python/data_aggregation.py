#!/usr/bin/env python3
"""
data_aggregation.py
───────────────────
Aggregates engagement metrics per user per month,
writes summary rows to aggregation_reports, prints JSON.

Usage:
    python3 data_aggregation.py              # all users
    python3 data_aggregation.py --user_id 2  # single user
"""

import sys
import json
import argparse
import os
from datetime import date

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


def aggregate(user_id: int | None = None) -> list[dict]:
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    uid_filter = "AND p.user_id = %s" if user_id else ""
    params     = (user_id,) if user_id else ()

    # Monthly roll-up per user
    cursor.execute(f"""
        SELECT
            p.user_id,
            DATE_FORMAT(p.post_date, '%%Y-%%m-01') AS report_period,
            COUNT(p.post_id)                        AS total_posts,
            COALESCE(SUM(em.likes),    0)           AS total_likes,
            COALESCE(SUM(em.shares),   0)           AS total_shares,
            COALESCE(SUM(em.comments), 0)           AS total_comments,
            COALESCE(SUM(em.views),    0)           AS total_views,
            COALESCE(AVG(em.likes + em.shares + em.comments), 0) AS avg_engagement
        FROM posts p
        LEFT JOIN engagement_metrics em ON p.post_id = em.post_id
        WHERE 1=1 {uid_filter}
        GROUP BY p.user_id, report_period
        ORDER BY p.user_id, report_period
    """, params)

    aggregations = cursor.fetchall()

    upsert_sql = """
        INSERT INTO aggregation_reports
            (user_id, report_period, total_posts, total_likes, total_shares,
             total_comments, total_views, avg_engagement, top_post_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            total_posts    = VALUES(total_posts),
            total_likes    = VALUES(total_likes),
            total_shares   = VALUES(total_shares),
            total_comments = VALUES(total_comments),
            total_views    = VALUES(total_views),
            avg_engagement = VALUES(avg_engagement),
            top_post_id    = VALUES(top_post_id),
            generated_at   = CURRENT_TIMESTAMP
    """

    results = []
    for row in aggregations:
        # Find top post in this period for this user
        cursor.execute("""
            SELECT p.post_id
            FROM posts p
            JOIN engagement_metrics em ON p.post_id = em.post_id
            WHERE p.user_id = %s AND DATE_FORMAT(p.post_date, '%%Y-%%m-01') = %s
            ORDER BY (em.likes + em.shares + em.comments) DESC
            LIMIT 1
        """, (row["user_id"], row["report_period"]))
        top = cursor.fetchone()
        top_post_id = top["post_id"] if top else None

        cursor.execute(upsert_sql, (
            row["user_id"], row["report_period"],
            row["total_posts"], row["total_likes"], row["total_shares"],
            row["total_comments"], row["total_views"],
            round(float(row["avg_engagement"]), 4),
            top_post_id,
        ))

        results.append({
            "user_id":       row["user_id"],
            "report_period": str(row["report_period"]),
            "total_posts":   int(row["total_posts"]),
            "total_likes":   int(row["total_likes"]),
            "total_shares":  int(row["total_shares"]),
            "total_comments":int(row["total_comments"]),
            "total_views":   int(row["total_views"]),
            "avg_engagement":round(float(row["avg_engagement"]), 2),
            "top_post_id":   top_post_id,
        })

    conn.commit()
    cursor.close()
    conn.close()
    return results


# ─────────────────────────────────────────────────────────────
DEMO_DATA = [
    {"user_id":1,"report_period":"2024-11-01","total_posts":3,"total_likes":15100,
     "total_shares":3750,"total_comments":1685,"total_views":182000,"avg_engagement":6845.0,"top_post_id":2},
    {"user_id":2,"report_period":"2024-11-01","total_posts":3,"total_likes":46900,
     "total_shares":5430,"total_comments":2976,"total_views":525000,"avg_engagement":18435.0,"top_post_id":6},
    {"user_id":3,"report_period":"2024-11-01","total_posts":2,"total_likes":4230,
     "total_shares":1670,"total_comments":801,"total_views":63000,"avg_engagement":3350.5,"top_post_id":8},
    {"user_id":4,"report_period":"2024-11-01","total_posts":2,"total_likes":28500,
     "total_shares":6600,"total_comments":3570,"total_views":332000,"avg_engagement":19335.0,"top_post_id":10},
    {"user_id":5,"report_period":"2024-11-01","total_posts":2,"total_likes":77000,
     "total_shares":14500,"total_comments":7300,"total_views":1540000,"avg_engagement":49400.0,"top_post_id":11},
]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user_id", type=int, default=None)
    args = parser.parse_args()

    if not MYSQL_AVAILABLE:
        demo = [r for r in DEMO_DATA if not args.user_id or r["user_id"] == args.user_id]
        print(json.dumps({"status": "demo", "aggregated": len(demo), "results": demo}, indent=2))
        sys.exit(0)

    try:
        data = aggregate(args.user_id)
        print(json.dumps({"status": "success", "aggregated": len(data), "results": data}, indent=2))
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}, indent=2))
        sys.exit(1)