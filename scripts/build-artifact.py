#!/usr/bin/env python3
"""Build artifact/goa-trip-planner.html — the planner as a live, shared Claude page.

Inlines assets/*.js, drops the outer <!doctype>/<html>/<head>/<body> tags (the Claude page
supplies its own), and points the Explore link at the GitHub Pages site.
Run:  python3 scripts/build-artifact.py
"""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://akshaykangude.github.io/Goa_Trip_Planner/'
h = (ROOT / 'index.html').read_text(encoding='utf-8')
for f in ['config', 'tripdata', 'sync']:
    tag = f'<script src="assets/{f}.js"></script>'
    assert h.count(tag) == 1, f
    js = (ROOT / f'assets/{f}.js').read_text(encoding='utf-8').replace('</script', '<\\/script')
    h = h.replace(tag, f'<script>/* assets/{f}.js */\n{js}\n</script>')
h = h.replace('href="explore.html"', f'href="{SITE}explore.html" target="_blank" rel="noopener"')
title = re.search(r'<title>.*?</title>', h).group(0)
h = h.replace(title, '', 1)
h = re.sub(r'<!DOCTYPE html>\s*', '', h, flags=re.I)
h = re.sub(r'</?html[^>]*>|</?head>|</?body[^>]*>', '', h)
h = re.sub(r'<meta charset="[^"]*">\s*', '', h)
h = re.sub(r'<meta name="viewport"[^>]*>\s*', '', h)
out = ROOT / 'artifact' / 'goa-trip-planner.html'
out.write_text(title + '\n' + h.strip() + '\n', encoding='utf-8')
print('wrote', out, f'{out.stat().st_size // 1024} KB')
