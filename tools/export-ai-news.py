#!/usr/bin/env python3
"""Export published AI news & latest digest from ai-news-bot SQLite DB to static blog files."""

import json
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape


def iso_utc(val: str | None) -> str:
    if not val:
        return ""
    s = str(val).strip().replace(" ", "T")
    if not s.endswith("Z") and "+" not in s[10:]:
        s += "Z"
    return s


def parse_json_list(raw: str | None) -> list:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def build_rss(articles: list[dict], site_url: str = "https://linqopsx.github.io") -> str:
    now_rfc = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    items_xml = []
    for a in articles[:30]:
        title = escape(f"[{a['priority']}] {a['title_zh']}")
        link = escape(a["source_url"])
        desc_parts = [a["summary_one_liner"]]
        if a["highlights"]:
            desc_parts.append("核心看点：" + "；".join(a["highlights"]))
        if a["commentary"]:
            desc_parts.append("简评：" + a["commentary"])
        desc = escape("\n".join(p for p in desc_parts if p))
        pub = a["published_at"]
        try:
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            pub_rfc = dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
        except Exception:
            pub_rfc = now_rfc
        items_xml.append(
            f"    <item>\n"
            f"      <title>{title}</title>\n"
            f"      <link>{link}</link>\n"
            f"      <guid isPermaLink=\"false\">ai-news-{a['id']}</guid>\n"
            f"      <pubDate>{pub_rfc}</pubDate>\n"
            f"      <description>{desc}</description>\n"
            f"    </item>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        "  <channel>\n"
        "    <title>Theodore · AI 前沿资讯</title>\n"
        f"    <link>{site_url}/ai-news/</link>\n"
        "    <description>聚合国内外主流大模型最新动态与 AI 日报</description>\n"
        "    <language>zh-CN</language>\n"
        f"    <lastBuildDate>{now_rfc}</lastBuildDate>\n"
        + "\n".join(items_xml)
        + "\n  </channel>\n</rss>\n"
    )


def export_db(db_path: Path, out_dir: Path, limit: int = 300) -> dict:
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    rows = cur.execute(
        """
        SELECT id, source_id, source_name, source_url, category, region, priority,
               title_zh, summary_one_liner, highlights_json, commentary, tags_json, published_at
        FROM ai_articles
        WHERE is_published = 1
        ORDER BY published_at DESC, id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    articles = []
    tag_counter: Counter[str] = Counter()
    source_counter: Counter[tuple[str, str]] = Counter()
    for r in rows:
        tags = [str(t).strip() for t in parse_json_list(r["tags_json"]) if str(t).strip()]
        highlights = [str(h).strip() for h in parse_json_list(r["highlights_json"]) if str(h).strip()]
        for t in tags:
            tag_counter[t] += 1
        source_counter[(r["source_id"], r["source_name"])] += 1
        articles.append(
            {
                "id": r["id"],
                "title_zh": r["title_zh"],
                "summary_one_liner": r["summary_one_liner"],
                "highlights": highlights,
                "commentary": r["commentary"],
                "priority": r["priority"],
                "tags": tags,
                "category": r["category"],
                "region": r["region"],
                "source_name": r["source_name"],
                "source_url": r["source_url"],
                "published_at": iso_utc(r["published_at"]),
            }
        )

    digest_row = cur.execute(
        """
        SELECT id, digest_date, title, overview_md, article_ids_json, created_at
        FROM daily_digests
        ORDER BY digest_date DESC, id DESC
        LIMIT 1
        """
    ).fetchone()
    con.close()

    digest = None
    if digest_row:
        digest = {
            "id": digest_row["id"],
            "digest_date": digest_row["digest_date"],
            "title": digest_row["title"],
            "overview_md": digest_row["overview_md"],
            "article_ids": parse_json_list(digest_row["article_ids_json"]),
            "created_at": iso_utc(digest_row["created_at"]),
        }

    bundle = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "digest": digest,
        "meta": {
            "tags": [{"name": name, "count": count} for name, count in tag_counter.most_common()],
            "sources": [
                {"id": sid, "name": sname, "count": count}
                for (sid, sname), count in source_counter.most_common()
            ],
            "categories": ["official", "research", "media", "community"],
            "regions": ["global", "cn"],
            "priorities": ["P0", "P1"],
        },
        "articles": articles,
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "data.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out_dir / "feed.xml").write_text(build_rss(articles), encoding="utf-8")
    return {"articles": len(articles), "has_digest": digest is not None, "tags": len(tag_counter)}


if __name__ == "__main__":
    db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/news.db")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("assets/ai-news")
    summary = export_db(db, out)
    print(f"Exported {summary['articles']} articles, digest={summary['has_digest']}, tags={summary['tags']} -> {out}")
