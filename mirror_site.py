"""
adinhotel.com tam site mirroru
Tüm sayfaları, resimleri, CSS ve JS dosyalarını indirir.
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, unquote
import os
import re
import sys
import time
from collections import deque

# Windows terminal encoding fix
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "https://www.adinhotel.com"
OUTPUT_DIR = r"c:\Users\txmd0\Desktop\adinbeach_mirror"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

visited_urls = set()
failed_urls = set()
asset_queue = set()

session = requests.Session()
session.headers.update(HEADERS)

def url_to_filepath(url):
    """URL'den yerel dosya yolu oluştur"""
    parsed = urlparse(url)
    path = unquote(parsed.path)
    
    if path == "/" or path == "":
        return os.path.join(OUTPUT_DIR, "index.html")
    
    # Dosya uzantısı varsa direkt kaydet
    _, ext = os.path.splitext(path)
    if ext and ext.lower() not in ['.php', '.html', '.htm', '']:
        return os.path.join(OUTPUT_DIR, path.lstrip("/"))
    
    # HTML sayfaları için index.html ekle
    if path.endswith("/"):
        return os.path.join(OUTPUT_DIR, path.lstrip("/"), "index.html")
    elif ext in ['.php', '.html', '.htm']:
        # .php'yi .html yap
        path = re.sub(r'\.php$', '.html', path)
        return os.path.join(OUTPUT_DIR, path.lstrip("/"))
    else:
        return os.path.join(OUTPUT_DIR, path.lstrip("/"), "index.html")

def download_asset(url):
    """Tek bir asset dosyasını indir"""
    if url in visited_urls:
        return None
    visited_urls.add(url)
    
    filepath = url_to_filepath(url)
    
    # Zaten var mı?
    if os.path.exists(filepath):
        return filepath
    
    try:
        print(f"  ⬇ {url}")
        resp = session.get(url, timeout=20, stream=True)
        if resp.status_code == 200:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return filepath
        else:
            print(f"  ✗ {resp.status_code}: {url}")
            failed_urls.add(url)
    except Exception as e:
        print(f"  ✗ HATA {url}: {e}")
        failed_urls.add(url)
    return None

def extract_assets_from_html(html_content, page_url):
    """HTML'den tüm asset URL'lerini çıkar"""
    soup = BeautifulSoup(html_content, 'html.parser')
    assets = set()
    
    # CSS
    for tag in soup.find_all('link', rel=lambda r: r and 'stylesheet' in r):
        href = tag.get('href')
        if href:
            assets.add(urljoin(page_url, href))
    
    # JS
    for tag in soup.find_all('script', src=True):
        assets.add(urljoin(page_url, tag['src']))
    
    # Resimler
    for tag in soup.find_all('img'):
        for attr in ['src', 'data-src', 'data-lazy-src']:
            val = tag.get(attr)
            if val and not val.startswith('data:'):
                assets.add(urljoin(page_url, val))
        # srcset
        srcset = tag.get('srcset', '')
        if srcset:
            for part in srcset.split(','):
                url = part.strip().split()[0]
                if url:
                    assets.add(urljoin(page_url, url))
    
    # Video/audio
    for tag in soup.find_all(['video', 'audio', 'source']):
        src = tag.get('src')
        if src:
            assets.add(urljoin(page_url, src))
    
    # Favicon vb.
    for tag in soup.find_all('link', rel=lambda r: r and any(x in r for x in ['icon', 'apple-touch-icon', 'manifest'])):
        href = tag.get('href')
        if href:
            assets.add(urljoin(page_url, href))
    
    # Filtrele - sadece aynı domain
    same_domain = set()
    for a in assets:
        parsed = urlparse(a)
        if parsed.netloc in ['', 'www.adinhotel.com', 'adinhotel.com']:
            same_domain.add(a)
    
    return same_domain

def extract_links_from_html(html_content, page_url):
    """HTML'den aynı domain'e ait linkleri çıkar"""
    soup = BeautifulSoup(html_content, 'html.parser')
    links = set()
    
    for tag in soup.find_all('a', href=True):
        href = tag['href']
        full_url = urljoin(page_url, href)
        parsed = urlparse(full_url)
        
        # Sadece aynı domain, fragment yok, mailto yok
        if parsed.netloc in ['www.adinhotel.com', 'adinhotel.com']:
            # Fragment temizle
            clean = full_url.split('#')[0]
            # Query string'i sakla ama sadece path için deduplicate et
            if clean and clean != page_url:
                links.add(clean)
    
    return links

def extract_assets_from_css(css_content, css_url):
    """CSS içindeki url() referanslarını çıkar"""
    assets = set()
    # url('...') veya url("...") veya url(...)
    pattern = re.compile(r'url\(["\']?([^"\')\s]+)["\']?\)')
    for match in pattern.finditer(css_content):
        asset_url = match.group(1)
        if not asset_url.startswith('data:'):
            assets.add(urljoin(css_url, asset_url))
    return assets

def rewrite_html_for_offline(html_content, page_url, output_path):
    """HTML içindeki URL'leri göreli yollarla değiştir"""
    # Bu fonksiyon ileride kullanılabilir
    # Şimdilik orijinal HTML'i kaydet
    return html_content

def crawl_page(url):
    """Bir sayfayı crawl et"""
    if url in visited_urls:
        return set(), set()
    visited_urls.add(url)
    
    # Sadece HTML sayfaları crawl et
    parsed = urlparse(url)
    path = parsed.path
    _, ext = os.path.splitext(path)
    if ext and ext.lower() not in ['', '.html', '.htm', '.php']:
        # Asset - sadece indir
        download_asset(url)
        return set(), set()
    
    try:
        print(f"\n📄 {url}")
        resp = session.get(url, timeout=20)
        
        if resp.status_code != 200:
            print(f"  ✗ HTTP {resp.status_code}")
            failed_urls.add(url)
            return set(), set()
        
        content_type = resp.headers.get('content-type', '')
        if 'text/html' not in content_type:
            # HTML değil, asset olarak kaydet
            download_asset(url)
            return set(), set()
        
        html = resp.text
        
        # Dosyayı kaydet
        filepath = url_to_filepath(url)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  ✓ Kaydedildi: {filepath}")
        
        # Asset'leri ve linkleri çıkar
        assets = extract_assets_from_html(html, url)
        links = extract_links_from_html(html, url)
        
        return assets, links
        
    except Exception as e:
        print(f"  ✗ HATA: {e}")
        failed_urls.add(url)
        return set(), set()

def download_css_and_its_assets(css_url):
    """CSS'i indir ve içindeki asset'leri de indir"""
    if css_url in visited_urls:
        return
    visited_urls.add(css_url)
    
    try:
        print(f"  🎨 CSS: {css_url}")
        resp = session.get(css_url, timeout=20)
        if resp.status_code == 200:
            filepath = url_to_filepath(css_url)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'wb') as f:
                f.write(resp.content)
            
            # CSS içindeki asset'leri bul
            try:
                css_text = resp.content.decode('utf-8', errors='ignore')
                sub_assets = extract_assets_from_css(css_text, css_url)
                for asset in sub_assets:
                    if urlparse(asset).netloc in ['', 'www.adinhotel.com', 'adinhotel.com']:
                        download_asset(asset)
            except:
                pass
    except Exception as e:
        print(f"  ✗ CSS HATA: {e}")

def main():
    print("=" * 60)
    print("adinhotel.com SITE MIRROR BAŞLADI")
    print(f"Hedef klasör: {OUTPUT_DIR}")
    print("=" * 60)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # BFS ile tüm sayfaları crawl et
    page_queue = deque([BASE_URL + "/"])
    all_assets = set()
    
    # Önce bilinen sayfaları ekle
    known_pages = [
        "/", "/odalar", "/odalar/premium-odalar", "/odalar/flora-odalar",
        "/odalar/size-ozel-villa", "/lezzet", "/deniz-ve-havuz",
        "/adin-ayricaliklari", "/eglence", "/toplanti", "/hakkimizda",
        "/surdurulebilirlik", "/firsatlar", "/bize-ulasin",
        "/cerez-politikasi", "/kullanim-kosullari", "/iptal-iade",
        "/kvkk", "/erisilebilirlik", "/rezervasyon",
        "/odalar/premium-dubleks-royal", "/odalar/premium-dubleks-superior",
        "/odalar/premium-suit", "/odalar/premium-aile",
        "/odalar/premium-connection", "/odalar/premium-standart",
        "/odalar/premium-engelli", "/odalar/flora-oda",
        "/odalar/flora-connection", "/odalar/flora-dublex",
        "/odalar/flora-mercan", "/odalar/flora-yasemin",
        "/odalar/villa-gloria", "/odalar/villa-magnolia",
        "/firsatlar/ruya-balayi",
    ]
    
    for page in known_pages:
        url = BASE_URL + page
        if url not in visited_urls:
            page_queue.append(url)
    
    crawled_count = 0
    while page_queue:
        url = page_queue.popleft()
        if url in visited_urls:
            continue
        
        assets, links = crawl_page(url)
        all_assets.update(assets)
        
        # Yeni linkleri kuyruğa ekle
        for link in links:
            if link not in visited_urls:
                page_queue.append(link)
        
        crawled_count += 1
        time.sleep(0.3)  # Sunucuyu yormamak için
    
    print(f"\n{'=' * 60}")
    print(f"Toplam {crawled_count} sayfa crawl edildi")
    print(f"Toplam {len(all_assets)} asset indirilecek")
    print("Asset'ler indiriliyor...")
    print("=" * 60)
    
    # Asset'leri indir
    for asset_url in all_assets:
        parsed = urlparse(asset_url)
        path = parsed.path
        _, ext = os.path.splitext(path)
        
        if ext.lower() == '.css':
            download_css_and_its_assets(asset_url)
        else:
            download_asset(asset_url)
        
        time.sleep(0.1)
    
    print(f"\n{'=' * 60}")
    print("TAMAMLANDI!")
    print(f"✓ Başarılı: {len(visited_urls) - len(failed_urls)} dosya")
    print(f"✗ Başarısız: {len(failed_urls)} dosya")
    if failed_urls:
        print("\nBaşarısız URL'ler:")
        for u in sorted(failed_urls):
            print(f"  - {u}")
    print("=" * 60)

if __name__ == "__main__":
    main()
