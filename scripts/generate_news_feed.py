import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
from pathlib import Path

BASE_URL = "https://pollutionnearme.org/news/"
REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "news" / "feed.xml"

def scrape_news():
    html = requests.get(BASE_URL).text
    soup = BeautifulSoup(html, "html.parser")

    items = []

    for article in soup.select("article.news-post"):
        link_el = article.select_one("a")
        title_el = article.select_one(".post-title")
        date_el = article.select_one(".post-meta")
        summary_el = article.select_one(".summary-text")

        if not link_el or not title_el:
            continue

        link = urljoin(BASE_URL, link_el["href"])

        items.append({
            "title": title_el.get_text(strip=True),
            "link": link,
            "date": date_el.get_text(strip=True) if date_el else None,
            "summary": summary_el.get_text(strip=True) if summary_el else "",
        })

    return items

def build_rss(items):
    rss_items = []

    for item in items:
        pub_date = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")

        rss_items.append(f"""
    <item>
      <title>{item['title']}</title>
      <link>{item['link']}</link>
      <description><![CDATA[{item['summary']}]]></description>
      <pubDate>{pub_date}</pubDate>
    </item>""")

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pollution Near Me – News</title>
    <link>{BASE_URL}</link>
    <description>Environmental news and updates from Pollution Near Me.</description>
    {''.join(rss_items)}
  </channel>
</rss>
"""
    return rss

def main():
    items = scrape_news()
    rss_xml = build_rss(items)
    OUTPUT_PATH.write_text(rss_xml, encoding="utf-8")
    print(f"Wrote RSS feed with {len(items)} items to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
