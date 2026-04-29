#!/usr/bin/env python3
"""
sentiment_analysis.py
─────────────────────
Performs VADER sentiment analysis on posts stored in MySQL,
writes results back to sentiment_results, and prints JSON.

Usage:
    python3 sentiment_analysis.py             # analyse ALL posts
    python3 sentiment_analysis.py --post_id 5  # single post
"""

import sys
import json
import argparse
import os
import re

# ── Attempt real VADER import; fall back to a lightweight rule-based stub ──
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    VADER_AVAILABLE = True
except ImportError:
    VADER_AVAILABLE = False

# ── Attempt MySQL import ──
try:
    import mysql.connector
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False

# ── DB config (mirrors php/db_config.php) ──
DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "database": os.getenv("DB_NAME", "social_media_analytics"),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", "Password123456"),
    "charset":  "utf8mb4",
}

# ─────────────────────────────────────────────────────────────
# Lightweight rule-based fallback analyser
# ─────────────────────────────────────────────────────────────
POSITIVE_WORDS = {
    "great","good","love","excellent","amazing","wonderful","fantastic","best",
    "happy","positive","beautiful","awesome","brilliant","outstanding","superb",
    "delightful","nice","helpful","enjoy","perfect","wow","incredible","proud",
    "excited","thrilled","grateful","blessed","free","open","dropped","new",
}
NEGATIVE_WORDS = {
    "bad","terrible","hate","awful","worst","horrible","fail","error","bug",
    "broken","wrong","disappointed","ugly","boring","stupid","frustrating",
    "hurts","problem","issue","crash","angry","sad","disappointing","pain",
}

def rule_based_sentiment(text: str) -> dict:
    words   = re.findall(r"[a-z']+", text.lower())
    pos     = sum(1 for w in words if w in POSITIVE_WORDS)
    neg     = sum(1 for w in words if w in NEGATIVE_WORDS)
    total   = len(words) or 1
    pos_s   = round(min(pos / total * 3, 1.0), 4)
    neg_s   = round(min(neg / total * 3, 1.0), 4)
    neu_s   = round(max(0.0, 1.0 - pos_s - neg_s), 4)
    compound = round(pos_s - neg_s, 4)
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    return {
        "pos": pos_s, "neg": neg_s, "neu": neu_s, "compound": compound,
        "label": label, "score": compound,
    }


def analyse_text(text: str) -> dict:
    if VADER_AVAILABLE:
        analyzer = SentimentIntensityAnalyzer()
        scores   = analyzer.polarity_scores(text)
        compound = scores["compound"]
        if compound >= 0.05:
            label = "positive"
        elif compound <= -0.05:
            label = "negative"
        else:
            label = "neutral"
        return {
            "pos": round(scores["pos"], 4),
            "neg": round(scores["neg"], 4),
            "neu": round(scores["neu"], 4),
            "compound": round(compound, 4),
            "label": label,
            "score": round(compound, 4),
        }
    else:
        return rule_based_sentiment(text)


def run(post_id: int | None = None) -> list[dict]:
    if not MYSQL_AVAILABLE:
        return [{"error": "mysql-connector-python not installed",
                 "tip": "pip install mysql-connector-python vaderSentiment"}]

    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    if post_id:
        cursor.execute("SELECT post_id, post_content FROM posts WHERE post_id = %s", (post_id,))
    else:
        cursor.execute("SELECT post_id, post_content FROM posts ORDER BY post_id")

    posts   = cursor.fetchall()
    results = []

    upsert_sql = """
        INSERT INTO sentiment_results
            (post_id, sentiment_label, sentiment_score,
             positive_score, neutral_score, negative_score, compound_score)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            sentiment_label = VALUES(sentiment_label),
            sentiment_score = VALUES(sentiment_score),
            positive_score  = VALUES(positive_score),
            neutral_score   = VALUES(neutral_score),
            negative_score  = VALUES(negative_score),
            compound_score  = VALUES(compound_score),
            analyzed_at     = CURRENT_TIMESTAMP
    """

    for post in posts:
        s = analyse_text(post["post_content"])
        cursor.execute(upsert_sql, (
            post["post_id"], s["label"], s["score"],
            s["pos"], s["neu"], s["neg"], s["compound"],
        ))
        results.append({
            "post_id":         post["post_id"],
            "preview":         post["post_content"][:60] + "…",
            "sentiment_label": s["label"],
            "compound_score":  s["compound"],
            "positive_score":  s["pos"],
            "neutral_score":   s["neu"],
            "negative_score":  s["neg"],
            "engine":          "vader" if VADER_AVAILABLE else "rule-based",
        })

    conn.commit()
    cursor.close()
    conn.close()
    return results


# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sentiment analysis for social media posts")
    parser.add_argument("--post_id", type=int, default=None)
    args = parser.parse_args()

    # Demo mode when DB is unavailable
    if not MYSQL_AVAILABLE:
        demo = [
            {"post_id": 1, "preview": "Just reviewed the latest flagship smartphone…",
             "engine": "rule-based (no DB)", **rule_based_sentiment("Just reviewed the latest flagship smartphone and WOW")}
        ]
        print(json.dumps({"status": "demo", "results": demo}, indent=2))
        sys.exit(0)

    try:
        data = run(args.post_id)
        print(json.dumps({"status": "success", "analysed": len(data), "results": data}, indent=2))
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}, indent=2))
        sys.exit(1)