"use strict";

const papers = [...document.querySelectorAll(".publication")];
const filters = [...document.querySelectorAll(".filter")];
const groups = [...document.querySelectorAll(".year-group")];
const status = document.querySelector("#filter-status");

document.querySelector(".filters").hidden = false;
filters.forEach(button => {
  button.addEventListener("click", () => {
    const selected = button.dataset.filter;
    filters.forEach(filter => {
      const active = filter === button;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    papers.forEach(paper => {
      const position = paper.dataset.authorPosition;
      const matches = selected === "all" || position === selected || (selected === "other" && ["3", "4"].includes(position));
      paper.hidden = !matches;
    });
    groups.forEach(group => {
      group.hidden = ![...group.querySelectorAll(".publication")].some(paper => !paper.hidden);
    });
    const count = papers.filter(paper => !paper.hidden).length;
    const label = { all:"selected", "1":"first-author", "2":"second-author", other:"third- or fourth-author" }[selected];
    status.textContent = `Showing ${count} ${label} publications.`;
  });
});

const citations = JSON.parse(document.querySelector("#citations-data").textContent);
const dialog = document.querySelector("#citation-dialog");
const citationText = document.querySelector("#citation-text");
const copyStatus = document.querySelector("#copy-status");

if (typeof dialog.showModal === "function") {
  document.querySelectorAll(".cite-button").forEach(button => {
    button.hidden = false;
    button.addEventListener("click", () => {
      const citation = citations[button.dataset.cite];
      document.querySelector("#citation-title").textContent = citation.title;
      citationText.value = citation.bibtex;
      copyStatus.textContent = "";
      dialog.showModal();
    });
  });
}
function setupDialogClose(modal) {
  modal.querySelector(".close-dialog").addEventListener("click", () => modal.close());
  modal.addEventListener("click", event => {
    if (event.target !== modal) return;
    const bounds = modal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) modal.close();
  });
}
setupDialogClose(dialog);

const figureDialog = document.querySelector("#figure-dialog");
if (typeof figureDialog.showModal === "function") {
  document.querySelectorAll("[data-figure]").forEach(link => {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const paper = citations[link.dataset.figure];
      document.querySelector("#figure-heading").textContent = paper.figureLabel;
      document.querySelector("#figure-paper-title").textContent = paper.title;
      const image = document.querySelector("#expanded-figure");
      image.src = paper.figureSrc;
      image.alt = paper.figureAlt;
      document.querySelector("#figure-caption").textContent = paper.figureCaption;
      document.querySelector("#figure-source").href = paper.figureSource;
      document.querySelector("#figure-original").href = paper.figureSrc;
      figureDialog.showModal();
    });
  });
}
setupDialogClose(figureDialog);
document.querySelector("#copy-citation").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(citationText.value);
    copyStatus.textContent = "Citation copied.";
  } catch {
    citationText.focus();
    citationText.select();
    copyStatus.textContent = "Citation selected. Press Ctrl+C or ⌘C to copy.";
  }
});

if ("IntersectionObserver" in window) {
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting);
    if (!visible.length) return;
    const active = visible[0].target.id;
    navLinks.forEach(link => {
      if (link.getAttribute("href") === `#${active}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-15% 0px -55% 0px", threshold: 0 });
  navLinks.forEach(link => observer.observe(document.querySelector(link.getAttribute("href"))));
}
