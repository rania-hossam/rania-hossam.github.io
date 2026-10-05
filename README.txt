Rania Elbadry — personal academic website

Website: https://rania-hossam.github.io/
Repository: https://github.com/rania-hossam/rania-hossam.github.io

A static, responsive academic website closely following the visual layout of
https://ahmedheakl.github.io/: a navy header, white background, system fonts,
About me with a right-hand portrait, and wide figure-first publication rows.
Rania’s verified biography, publications, news, and thesis are used throughout.
No framework or package installation is needed to view or edit it.

VIEW LOCALLY
  python3 build.py
  python3 -m http.server 4173 --directory dist --bind 127.0.0.1
Then visit http://127.0.0.1:4173. dist/index.html also opens directly.

EDIT
  template.html      Biography, news, thesis, contact details, and page structure
  publications.json Publication metadata, author order, and figure sources
  site.json         Published website URL and repository URL
  dist/styles.css   Reference-inspired layout and large publication figures
  dist/script.js    Author filters and figure viewer
  dist/assets/      Self-hosted portrait, original paper figures, and fonts
  sources.json      Content provenance and publication selection policy

After editing the template or publications, regenerate the HTML:
  python3 build.py

The generator checks that Rania is listed first or second, or third/fourth
with an explicit acceptance evidence URL or an author-requested preprint
exception. DocAtlas and CEPO are requested exceptions and are labeled Preprint.
The site contains 15 papers: four first-author, three second-author, and
eight third/fourth-author papers. The list follows the order in publications.json.
The master's thesis is displayed separately. Content, paper links, and
full-size figure links remain usable without JavaScript.

FIGURES
Fourteen publication entries show original figures or tables from their
papers. Click a figure to enlarge it and follow its source link. Selection
favors readable overviews, methods, or central results. Tables are clearly
labeled when the paper has no suitable figure. The CLEF overview chapter
has a text-only entry because its original figures were not accessible.
Figure/table assets retain their respective publication rights; fonts
include their original licenses. No scientific figure is AI-generated.

VERIFY
With Node.js 22+ and Google Chrome installed on macOS:
  node --check dist/script.js
  node scripts/check-browser.mjs
The browser check uses a temporary profile and loopback server, then
closes both. It checks author filters, figure enlargement, keyboard dismissal,
image loading, responsive layout,
and content without JavaScript. Screenshots go to /private/tmp/rania-github-*.

GITHUB PAGES
The .github/workflows/pages.yml workflow builds and publishes dist/ after
every push to main. It requires only Python's standard library.

For a personal website, name the public repository USERNAME.github.io.
In Settings > Pages, select GitHub Actions as the build source. Set url
in site.json to https://USERNAME.github.io and repository to the GitHub
repository URL. Commit and push the source to main. The workflow receives
the actual Pages URL and generates canonical/social metadata automatically.
Project repositories are also supported; all local asset paths are relative.

CONTENT SOURCES
Verified October 4, 2026. See sources.json and each paper's figureSource
and acceptanceSource fields. Google Scholar was cross-checked with arXiv,
ACL Anthology, publishers, and the MBZUAI thesis repository. The photograph
comes from MBZUAI's 2026 graduation page.
