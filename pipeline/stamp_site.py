#!/usr/bin/env python3
"""Stamp public/index.html with content hashes (app.js?v=…, app.css?v=…, kit.css?v=…).

Combined with the ?v= on data requests (meta.json "version"), every asset can be cached
by browsers indefinitely while a deploy is still picked up at once. Run after any edit
to the site files or a data rebuild.
"""
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")


def digest(rel):
    return hashlib.sha1(open(os.path.join(PUB, rel), "rb").read()).hexdigest()[:10]


html_path = os.path.join(PUB, "index.html")
html = open(html_path, encoding="utf-8").read()
for rel in ("app.js", "app.css", "kit/kit.css"):
    html = re.sub(r'(["\'])' + re.escape(rel) + r'(\?v=[0-9a-f]+)?\1', lambda m: f'{m.group(1)}{rel}?v={digest(rel)}{m.group(1)}', html)
open(html_path, "w", encoding="utf-8").write(html)
print(re.findall(r'(?:app\.js|app\.css|kit\.css)\?v=[0-9a-f]+', html))
