-- ============================================================
--  Social Media Analytics Dashboard - Database Schema (3NF)
--  File: schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS social_media_analytics
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE social_media_analytics;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS post_hashtags, aggregation_reports, sentiment_results, engagement_metrics, hashtags, posts, users, platforms;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- TABLE: platforms
-- Stores social media platform metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS platforms (
    platform_id   INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    platform_name VARCHAR(50)     NOT NULL,
    platform_url  VARCHAR(255)    NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (platform_id),
    UNIQUE KEY uq_platform_name (platform_name)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: users (social media accounts being tracked)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    username      VARCHAR(100)    NOT NULL,
    display_name  VARCHAR(150)    NOT NULL,
    platform_id   INT UNSIGNED    NOT NULL,
    followers     INT UNSIGNED    NOT NULL DEFAULT 0,
    following     INT UNSIGNED    NOT NULL DEFAULT 0,
    bio           TEXT,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_user_platform (username, platform_id),
    CONSTRAINT fk_user_platform
        FOREIGN KEY (platform_id) REFERENCES platforms (platform_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: posts
-- Individual social media posts
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    post_id       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id       INT UNSIGNED    NOT NULL,
    post_content  TEXT            NOT NULL,
    post_date     DATETIME        NOT NULL,
    post_url      VARCHAR(500),
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id),
    CONSTRAINT fk_post_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: engagement_metrics
-- Stores per-post engagement numbers (1NF/2NF/3NF compliant:
-- all non-key attrs depend solely on post_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS engagement_metrics (
    metric_id     INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    post_id       INT UNSIGNED    NOT NULL,
    likes         INT UNSIGNED    NOT NULL DEFAULT 0,
    shares        INT UNSIGNED    NOT NULL DEFAULT 0,
    comments      INT UNSIGNED    NOT NULL DEFAULT 0,
    views         INT UNSIGNED    NOT NULL DEFAULT 0,
    clicks        INT UNSIGNED    NOT NULL DEFAULT 0,
    recorded_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_id),
    UNIQUE KEY uq_post_metric (post_id, recorded_at),
    CONSTRAINT fk_metric_post
        FOREIGN KEY (post_id) REFERENCES posts (post_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: sentiment_results
-- Stores Python-generated sentiment analysis per post
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_results (
    sentiment_id        INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    post_id             INT UNSIGNED        NOT NULL,
    sentiment_label     ENUM('positive','neutral','negative') NOT NULL,
    sentiment_score     DECIMAL(5,4)        NOT NULL COMMENT 'Range -1.0000 to 1.0000',
    positive_score      DECIMAL(5,4)        NOT NULL DEFAULT 0.0000,
    neutral_score       DECIMAL(5,4)        NOT NULL DEFAULT 0.0000,
    negative_score      DECIMAL(5,4)        NOT NULL DEFAULT 0.0000,
    compound_score      DECIMAL(5,4)        NOT NULL DEFAULT 0.0000,
    analyzed_at         TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sentiment_id),
    UNIQUE KEY uq_post_sentiment (post_id),
    CONSTRAINT fk_sentiment_post
        FOREIGN KEY (post_id) REFERENCES posts (post_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: hashtags (normalized — 3NF)
-- ============================================================
CREATE TABLE IF NOT EXISTS hashtags (
    hashtag_id    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    hashtag_text  VARCHAR(150)    NOT NULL,
    PRIMARY KEY (hashtag_id),
    UNIQUE KEY uq_hashtag (hashtag_text)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: post_hashtags (junction — resolves M:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id       INT UNSIGNED    NOT NULL,
    hashtag_id    INT UNSIGNED    NOT NULL,
    PRIMARY KEY (post_id, hashtag_id),
    CONSTRAINT fk_ph_post
        FOREIGN KEY (post_id)    REFERENCES posts    (post_id)    ON DELETE CASCADE,
    CONSTRAINT fk_ph_hashtag
        FOREIGN KEY (hashtag_id) REFERENCES hashtags (hashtag_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: aggregation_reports
-- Stores Python-generated aggregate summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS aggregation_reports (
    report_id       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id         INT UNSIGNED    NOT NULL,
    report_period   DATE            NOT NULL COMMENT 'First day of reporting period',
    total_posts     INT UNSIGNED    NOT NULL DEFAULT 0,
    total_likes     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_shares    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_comments  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_views     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    avg_engagement  DECIMAL(10,4)   NOT NULL DEFAULT 0.0000,
    top_post_id     INT UNSIGNED,
    generated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id),
    UNIQUE KEY uq_user_period (user_id, report_period),
    CONSTRAINT fk_report_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_report_top_post
        FOREIGN KEY (top_post_id) REFERENCES posts (post_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO platforms (platform_name, platform_url) VALUES
    ('Twitter',   'https://twitter.com'),
    ('Instagram', 'https://instagram.com'),
    ('Facebook',  'https://facebook.com'),
    ('LinkedIn',  'https://linkedin.com'),
    ('TikTok',    'https://tiktok.com');

INSERT INTO users (username, display_name, platform_id, followers, following, bio) VALUES
    ('techguru_ph',    'Tech Guru PH',       1, 45200, 312,  'Tech reviews & tutorials from Manila 🇵🇭'),
    ('anna_creates',   'Anna Creates',        2, 128500, 890, 'Digital artist & content creator ✨'),
    ('biz_insights',   'Business Insights',   4, 32100, 145,  'Data-driven business strategies'),
    ('daily_vibes_ph', 'Daily Vibes PH',      3, 67800, 2300, 'Your daily dose of good vibes 🌟'),
    ('devlife_tiktok', 'Dev Life',            5, 210000, 50,  'Coding tutorials & developer humor');

INSERT INTO posts (user_id, post_content, post_date, post_url) VALUES
    (1, 'Just reviewed the latest flagship smartphone and WOW — the camera system is absolutely next level. Full review on YouTube! #TechReview #Smartphones #Philippines',
        '2024-11-01 09:15:00', 'https://twitter.com/techguru_ph/1'),
    (1, 'Hot take: Most people don''t need the Pro version of any phone. The base model is more than enough for 90% of users. Fight me. #TechOpinion #SaveMoney',
        '2024-11-05 14:30:00', 'https://twitter.com/techguru_ph/2'),
    (1, 'Tutorial: How to set up your own VPN at home in under 10 minutes. Thread below 👇 #Cybersecurity #DIY #Tech',
        '2024-11-10 08:00:00', 'https://twitter.com/techguru_ph/3'),
    (2, 'Spent 3 months on this digital painting. Every brushstroke was intentional. Art is never really finished, you just decide to stop. ❤️ #DigitalArt #Illustration',
        '2024-11-02 18:45:00', 'https://instagram.com/anna_creates/1'),
    (2, 'Commission slots OPEN! DM me for details. Specializing in character portraits and fantasy landscapes 🎨 #ArtCommissions #DigitalArtist',
        '2024-11-07 12:00:00', 'https://instagram.com/anna_creates/2'),
    (2, 'New brushpack dropped! Free for all followers. Link in bio. Made these over 6 months testing different textures. #FreeResources #ProcreateBrushes',
        '2024-11-12 10:30:00', 'https://instagram.com/anna_creates/3'),
    (3, 'The businesses that will thrive in 2025 are those investing in data literacy today. Here''s a 5-point framework for getting started. #BusinessStrategy #DataAnalytics',
        '2024-11-03 07:00:00', 'https://linkedin.com/biz_insights/1'),
    (3, 'Unpopular opinion: Most dashboards show data but don''t create insight. The difference is context. A number without a benchmark is just noise. #Analytics #Leadership',
        '2024-11-08 09:30:00', 'https://linkedin.com/biz_insights/2'),
    (4, 'Good morning Philippines! ☀️ Start your day with gratitude and watch how everything changes. What are you grateful for today? #GoodVibes #Mindfulness',
        '2024-11-04 06:00:00', 'https://facebook.com/daily_vibes_ph/1'),
    (4, 'This sunset in Palawan took my breath away. Some places on Earth just make you feel small in the best possible way 🌅 #Palawan #Philippines #Travel',
        '2024-11-09 19:00:00', 'https://facebook.com/daily_vibes_ph/2'),
    (5, 'POV: You push to production on a Friday. #DevHumor #Programming #CodingLife',
        '2024-11-06 15:00:00', 'https://tiktok.com/devlife_tiktok/1'),
    (5, 'Teaching myself Rust after 5 years of Python. My brain hurts but in a good way 🦀 #Rust #Python #LearnToCode',
        '2024-11-11 11:00:00', 'https://tiktok.com/devlife_tiktok/2');

INSERT INTO engagement_metrics (post_id, likes, shares, comments, views, clicks) VALUES
    (1,  4200,  890,  312,  52000, 3100),
    (2,  7800, 2100,  945,  89000, 5400),
    (3,  3100,  760,  428,  41000, 8900),
    (4, 15600,  430,  892, 120000, 2300),
    (5,  8900, 1200,  634,  95000, 4500),
    (6, 22400, 3800, 1450, 310000, 18000),
    (7,  1890,  780,  234,  28000, 1200),
    (8,  2340,  890,  567,  35000, 890),
    (9,  9800, 2100, 1230,  87000, 1800),
    (10, 18700, 4500, 2340, 245000, 3200),
    (11, 45000, 8900, 3200, 890000, 12000),
    (12, 32000, 5600, 4100, 650000, 8900);

INSERT INTO hashtags (hashtag_text) VALUES
    ('TechReview'), ('Smartphones'), ('Philippines'), ('TechOpinion'),
    ('SaveMoney'), ('Cybersecurity'), ('DIY'), ('Tech'), ('DigitalArt'),
    ('Illustration'), ('ArtCommissions'), ('DigitalArtist'), ('FreeResources'),
    ('ProcreateBrushes'), ('BusinessStrategy'), ('DataAnalytics'), ('Analytics'),
    ('Leadership'), ('GoodVibes'), ('Mindfulness'), ('Palawan'), ('Travel'),
    ('DevHumor'), ('Programming'), ('CodingLife'), ('Rust'), ('Python'), ('LearnToCode');

INSERT INTO post_hashtags (post_id, hashtag_id) VALUES
    (1,1),(1,2),(1,3),
    (2,4),(2,5),
    (3,6),(3,7),(3,8),
    (4,9),(4,10),
    (5,11),(5,12),
    (6,13),(6,14),
    (7,15),(7,16),
    (8,17),(8,18),
    (9,19),(9,20),
    (10,21),(10,3),(10,22),
    (11,23),(11,24),(11,25),
    (12,26),(12,27),(12,28);

-- Placeholder sentiment (will be overwritten by Python analysis)
INSERT INTO sentiment_results (post_id, sentiment_label, sentiment_score, positive_score, neutral_score, negative_score, compound_score) VALUES
    (1,  'positive',  0.6200, 0.6200, 0.2800, 0.1000,  0.8700),
    (2,  'positive',  0.4100, 0.4100, 0.3500, 0.2400,  0.6300),
    (3,  'positive',  0.5500, 0.5500, 0.3800, 0.0700,  0.7800),
    (4,  'positive',  0.7800, 0.7800, 0.1800, 0.0400,  0.9200),
    (5,  'neutral',   0.1200, 0.3200, 0.5600, 0.1200,  0.2400),
    (6,  'positive',  0.8900, 0.8900, 0.0800, 0.0300,  0.9600),
    (7,  'positive',  0.6700, 0.6700, 0.2500, 0.0800,  0.8500),
    (8,  'neutral',   0.2300, 0.3400, 0.4500, 0.2100,  0.3800),
    (9,  'positive',  0.7200, 0.7200, 0.2100, 0.0700,  0.8900),
    (10, 'positive',  0.8500, 0.8500, 0.1200, 0.0300,  0.9400),
    (11, 'neutral',  -0.0500, 0.2200, 0.5800, 0.2000, -0.0500),
    (12, 'positive',  0.5900, 0.5900, 0.3000, 0.1100,  0.7600);

-- ============================================================
-- VIEWS for easy querying
-- ============================================================
CREATE OR REPLACE VIEW vw_post_summary AS
    SELECT
        p.post_id,
        u.username,
        u.display_name,
        pl.platform_name,
        LEFT(p.post_content, 80)        AS post_preview,
        p.post_date,
        em.likes,
        em.shares,
        em.comments,
        em.views,
        em.clicks,
        (em.likes + em.shares + em.comments) AS total_engagement,
        sr.sentiment_label,
        sr.compound_score
    FROM posts p
    JOIN users u             ON p.user_id     = u.user_id
    JOIN platforms pl        ON u.platform_id = pl.platform_id
    LEFT JOIN engagement_metrics em ON p.post_id = em.post_id
    LEFT JOIN sentiment_results  sr ON p.post_id = sr.post_id;

CREATE OR REPLACE VIEW vw_user_stats AS
    SELECT
        u.user_id,
        u.username,
        u.display_name,
        pl.platform_name,
        u.followers,
        COUNT(p.post_id)                            AS total_posts,
        COALESCE(SUM(em.likes),    0)               AS total_likes,
        COALESCE(SUM(em.shares),   0)               AS total_shares,
        COALESCE(SUM(em.comments), 0)               AS total_comments,
        COALESCE(SUM(em.views),    0)               AS total_views,
        COALESCE(AVG(em.likes + em.shares + em.comments), 0) AS avg_engagement
    FROM users u
    JOIN platforms pl   ON u.platform_id = pl.platform_id
    LEFT JOIN posts p   ON u.user_id     = p.user_id
    LEFT JOIN engagement_metrics em ON p.post_id = em.post_id
    GROUP BY u.user_id, u.username, u.display_name, pl.platform_name, u.followers;