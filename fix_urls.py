"""
Mirror sitedeki HTML dosyalarında absolute URL'leri göreli path'lere çevir.
https://www.adinhotel.com/content/files/x.jpg -> /content/files/x.jpg
https://www.adinhotel.com/odalar/ -> /odalar/
"""

import os
import re
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MIRROR_DIR = r"c:\Users\txmd0\Desktop\adinbeach_mirror"

DOMAIN_PATTERNS = [
    "https://www.adinhotel.com",
    "http://www.adinhotel.com",
    "https://adinhotel.com",
    "http://adinhotel.com",
]

def fix_html(filepath):
    """HTML dosyasındaki absolute URL'leri göreli yap"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        print(f"  OKUMA HATASI {filepath}: {e}")
        return
    
    original = content
    
    # Domain'i kaldır - sadece path kalsın
    for domain in DOMAIN_PATTERNS:
        # href="https://www.adinhotel.com/path" -> href="/path"
        content = content.replace(f'href="{domain}/', 'href="/')
        content = content.replace(f"href='{domain}/", "href='/")
        
        # src="https://www.adinhotel.com/path" -> src="/path"
        content = content.replace(f'src="{domain}/', 'src="/')
        content = content.replace(f"src='{domain}/", "src='/")
        
        # action="..." for forms
        content = content.replace(f'action="{domain}/', 'action="/')
        content = content.replace(f"action='{domain}/", "action='/")
        
        # srcset içindeki URL'ler
        content = content.replace(f'srcset="{domain}/', 'srcset="/')
        
        # url() CSS içi
        content = content.replace(f"url('{domain}/", "url('/")
        content = content.replace(f'url("{domain}/', 'url("/')
        content = content.replace(f"url({domain}/", "url(/")
        
        # data-src, data-href vb.
        for attr in ['data-src', 'data-href', 'data-url', 'data-image', 'data-bg']:
            content = content.replace(f'{attr}="{domain}/', f'{attr}="/')
            content = content.replace(f"{attr}='{domain}/", f"{attr}='/")
        
        # content="" meta tags (og:image vb.)
        content = content.replace(f'content="{domain}/', 'content="/')
        
        # Bare domain (linkin sonu / olmadan)
        content = content.replace(f'href="{domain}"', 'href="/"')
        content = content.replace(f"href='{domain}'", "href='/'")
    
    # JavaScript içinde window.location veya inline URL'ler
    for domain in DOMAIN_PATTERNS:
        content = content.replace(f'"{domain}/', '"/')
        content = content.replace(f"'{domain}/", "'/")
    
    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"  YAZMA HATASI {filepath}: {e}")
    return False

def fix_css(filepath):
    """CSS dosyasındaki absolute URL'leri düzelt"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        print(f"  CSS OKUMA HATASI: {e}")
        return
    
    original = content
    for domain in DOMAIN_PATTERNS:
        content = content.replace(f"url('{domain}/", "url('/")
        content = content.replace(f'url("{domain}/', 'url("/')
        content = content.replace(f"url({domain}/", "url(/")
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    print("="*60)
    print("URL DUZELTME BASLIYOR")
    print(f"Klasor: {MIRROR_DIR}")
    print("="*60)
    
    html_fixed = 0
    css_fixed = 0
    total = 0
    
    for root, dirs, files in os.walk(MIRROR_DIR):
        # Gereksiz klasorleri atla
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules']]
        
        for filename in files:
            filepath = os.path.join(root, filename)
            ext = os.path.splitext(filename)[1].lower()
            total += 1
            
            if ext in ['.html', '.htm']:
                if fix_html(filepath):
                    rel = filepath.replace(MIRROR_DIR + '\\', '')
                    print(f"  [HTML] Duzeltildi: {rel}")
                    html_fixed += 1
            elif ext == '.css':
                if fix_css(filepath):
                    rel = filepath.replace(MIRROR_DIR + '\\', '')
                    print(f"  [CSS]  Duzeltildi: {rel}")
                    css_fixed += 1
    
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI!")
    print(f"HTML duzeltilen: {html_fixed}")
    print(f"CSS duzeltilen:  {css_fixed}")
    print(f"Toplam islem:    {total}")
    print("="*60)

if __name__ == "__main__":
    main()
