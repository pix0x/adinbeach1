"""
Mirror sitedeki 404 olan thumbnail ve content dosyalarını indir.
HTML'leri tara ve eksik dosyaları bul.
"""

import os
import re
import sys
import time
import requests
from urllib.parse import urljoin, urlparse, unquote

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MIRROR_DIR = r"c:\Users\txmd0\Desktop\adinbeach_mirror"
BASE_URL = "https://www.adinhotel.com"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/webp,image/png,image/jpg,*/*",
    "Referer": "https://www.adinhotel.com/",
}

session = requests.Session()
session.headers.update(HEADERS)

downloaded = 0
skipped = 0
failed = 0

def url_to_local_path(url_path):
    """URL path'ini yerel dosya yoluna cevir"""
    clean = unquote(url_path).lstrip('/')
    # Sorgu stringleri temizle
    clean = clean.split('?')[0]
    return os.path.join(MIRROR_DIR, clean.replace('/', os.sep))

def download_file(url_path):
    global downloaded, skipped, failed
    
    local_path = url_to_local_path(url_path)
    
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        skipped += 1
        return
    
    full_url = BASE_URL + url_path
    
    try:
        resp = session.get(full_url, timeout=20, stream=True)
        if resp.status_code == 200:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"  OK: {url_path}")
            downloaded += 1
        else:
            print(f"  {resp.status_code}: {url_path}")
            failed += 1
    except Exception as e:
        print(f"  ERR {url_path}: {e}")
        failed += 1
    
    time.sleep(0.15)

def scan_html_for_missing(filepath):
    """HTML dosyasindaki eksik dosyalari bul"""
    missing = set()
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except:
        return missing
    
    # src="/..." ve href="/..." icin
    patterns = [
        r'src="(/[^"]+)"',
        r"src='(/[^']+)'",
        r'href="(/[^"#?]+\.(css|js|png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|mp4|mp3|pdf))"',
        r"href='(/[^'#?]+\.(css|js|png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|mp4|mp3|pdf))'",
        r'data-src="(/[^"]+)"',
        r"data-src='(/[^']+)'",
        r'content="(/[^"]+\.(png|jpg|jpeg|webp|svg|gif|ico))"',
        r'url\((/[^\)]+)\)',
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, content):
            url_path = match.group(1).split('?')[0].split('#')[0]
            # Sadece asset uzantilari
            ext = os.path.splitext(url_path)[1].lower()
            if ext in ['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.mp4', '.mp3', '.pdf']:
                local = url_to_local_path(url_path)
                if not os.path.exists(local):
                    missing.add(url_path)
    
    return missing

def main():
    print("="*60)
    print("EKSIK DOSYALARI INDIR")
    print("="*60)
    
    all_missing = set()
    
    # Tum HTML dosyalarini tara
    html_count = 0
    for root, dirs, files in os.walk(MIRROR_DIR):
        dirs[:] = [d for d in dirs if d not in ['.git']]
        for filename in files:
            if filename.endswith('.html'):
                filepath = os.path.join(root, filename)
                missing = scan_html_for_missing(filepath)
                all_missing.update(missing)
                html_count += 1
    
    print(f"Taranan HTML: {html_count}")
    print(f"Eksik dosya: {len(all_missing)}")
    print("")
    
    # Eksik dosyalari indir
    for url_path in sorted(all_missing):
        download_file(url_path)
    
    print(f"\n{'='*60}")
    print(f"Indirilen: {downloaded}")
    print(f"Atlanan:   {skipped}")
    print(f"Basarisiz: {failed}")
    print("="*60)

if __name__ == "__main__":
    main()
