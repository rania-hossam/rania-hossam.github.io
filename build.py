"""Regenerate static HTML after editing publications.json or template.html."""
import argparse
import html
import hashlib
import json
from itertools import groupby
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
PUBLICATIONS = json.loads((ROOT / "publications.json").read_text())
ALIASES = {"Rania Elbadry", "Rania Hossam", "Rania Hossam Elmohamady Elbadry"}
AUTHOR_LABELS = {1: "First", 2: "Second", 3: "Third", 4: "Fourth"}
escape = html.escape
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--site-url", help="Published GitHub Pages base URL, including any project path")
args = parser.parse_args()
config = json.loads((ROOT / "site.json").read_text())
site_url = (args.site_url if args.site_url is not None else config.get("url", "")).rstrip("/")
if site_url:
    assert urlsplit(site_url).scheme == "https" and urlsplit(site_url).netloc, "Use an absolute HTTPS site URL"


def external(url, label, css=""):
    return f'<a class="{css}" href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{label}</a>'


def render_paper(paper):
    positions = [i + 1 for i, name in enumerate(paper["authors"]) if name in ALIASES]
    assert len(positions) == 1 and positions[0] in AUTHOR_LABELS, f"Ineligible author position: {paper['id']}"
    if positions[0] in (3, 4):
        assert paper.get("accepted") is True, f"Third/fourth-author paper must have confirmed acceptance: {paper['id']}"
        assert paper.get("acceptanceSource", "").startswith("https://"), f"Missing acceptance evidence: {paper['id']}"
    urls = [paper["paper"], *[link["url"] for link in paper["links"]]]
    urls += [paper[key] for key in ("pdf", "figureSource") if paper.get(key)]
    for url in urls:
        assert url.startswith("https://"), f"Invalid URL: {url}"
    figure = ""
    if paper.get("image"):
        assert (ROOT / "dist/assets" / paper["image"]).is_file(), f"Missing image: {paper['image']}"
        assert paper.get("figureSource"), f"Missing figure source: {paper['id']}"
        figure = f'''<figure class="paper-figure">
        <a class="paper-image" href="./assets/{paper['image']}" data-figure="{paper['id']}" target="_blank" rel="noopener noreferrer" aria-label="Enlarge figure for {escape(paper['title'])}"><img src="./assets/{paper['image']}" alt="{escape(paper['imageAlt'])}" loading="lazy" width="{paper['imageWidth']}" height="{paper['imageHeight']}"><span class="enlarge-label" aria-hidden="true">Enlarge <svg class="icon small"><use href="#expand"/></svg></span></a>
        <figcaption>{escape(paper['figureLabel'])}</figcaption>
      </figure>'''
    authors = ", ".join(f'<strong>{escape(name)}</strong>' if name in ALIASES else escape(name) for name in paper["authors"])
    award = f'<span class="highlight">{escape(paper["highlight"])}</span>' if paper.get("highlight") else ""
    links = [external(paper["paper"], "Paper")]
    if paper.get("pdf"):
        links.append(external(paper["pdf"], "PDF"))
    links += [external(link["url"], escape(link["label"])) for link in paper["links"]]
    links_html = ' <span class="link-separator" aria-hidden="true">/</span> '.join(links)
    css = "publication" if figure else "publication publication-text-only"
    return f'''<article id="paper-{paper['id']}" class="{css}" data-author-position="{positions[0]}" aria-labelledby="title-{paper['id']}">
      {figure}
      <div class="paper-content">
        <h3 id="title-{paper['id']}">{external(paper['paper'], escape(paper['title']))}</h3>
        <p class="authors">{authors}</p>
        <div class="paper-meta"><span class="venue">{escape(paper['venue'])}</span>{award}<span class="author-position">{AUTHOR_LABELS[positions[0]]} author</span></div>
        <div class="paper-links">{links_html}</div>
        <p class="paper-description">{escape(paper['summary'])}</p>
      </div>
    </article>'''


assert len({p["id"] for p in PUBLICATIONS}) == len(PUBLICATIONS), "Duplicate publication IDs"
# Keep the curated display order in publications.json, including papers placed last.
sections = []
for year, papers in groupby(PUBLICATIONS, key=lambda p: p["year"]):
    articles = "\n".join(render_paper(p) for p in papers)
    sections.append(f'<section class="year-group" aria-label="{year} publications"><div class="year-label"><h3>{year}</h3><span></span></div><div class="year-papers">{articles}</div></section>')

figures = {p["id"]: {"title": p["title"], "figureSrc": "./assets/" + p["image"] if p.get("image") else "", "figureAlt": p["imageAlt"], "figureLabel": p["figureLabel"], "figureCaption": p["figureCaption"], "figureSource": p["figureSource"]} for p in PUBLICATIONS}
template = (ROOT / "template.html").read_text()
metadata = ""
if site_url:
    person = {"@context": "https://schema.org", "@type": "Person", "name": "Rania Elbadry", "alternateName": list(sorted(ALIASES - {"Rania Elbadry"})), "url": site_url + "/", "image": site_url + "/assets/portrait.jpg", "jobTitle": "Ph.D. student", "affiliation": {"@type": "CollegeOrUniversity", "name": "Mohamed bin Zayed University of Artificial Intelligence", "url": "https://mbzuai.ac.ae/"}, "sameAs": ["https://scholar.google.com/citations?user=ic1jai8AAAAJ&hl=en", "https://ae.linkedin.com/in/rania-hossam55"]}
    metadata = (f'<link rel="canonical" href="{escape(site_url)}/">\n'
                f'  <meta property="og:url" content="{escape(site_url)}/">\n'
                f'  <meta property="og:image" content="{escape(site_url)}/assets/portrait.jpg">\n'
                f'  <script type="application/ld+json">{json.dumps(person, ensure_ascii=False).replace("<", chr(92) + "u003c")}</script>')
page = template.replace("<!-- PUBLICATIONS -->", "\n".join(sections)).replace("<!-- FIGURES -->", json.dumps(figures, ensure_ascii=False).replace("<", "\\u003c")).replace("<!-- SITE_METADATA -->", metadata).replace("{{PAPER_COUNT}}", str(len(PUBLICATIONS)))
for placeholder, asset in (("{{STYLE_VERSION}}", "styles.css"), ("{{SCRIPT_VERSION}}", "script.js")):
    page = page.replace(placeholder, hashlib.sha256((ROOT / "dist" / asset).read_bytes()).hexdigest()[:12])
(ROOT / "dist/index.html").write_text("\n".join(line.rstrip() for line in page.splitlines()) + "\n")
(ROOT / "dist/.nojekyll").touch()
print(f"Built {len(PUBLICATIONS)} selected publications and one separately labeled thesis for {site_url or 'local preview'}.")
