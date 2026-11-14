#!/usr/bin/env python3
"""Check static pages and local references. Uses Python's standard library only."""

import argparse
from collections import Counter
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


ORIGIN = "https://david-hoffman.github.io"
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", re.IGNORECASE)


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.lang = ""
        self.title = ""
        self.in_title = False
        self.main_count = 0
        self.ids = Counter()
        self.anchors = set()
        self.references = []
        self.feed(path.read_text(encoding="utf-8"))
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        line = self.getpos()[0]
        if tag == "html":
            self.lang = attrs.get("lang", "")
        if tag == "title":
            self.in_title = True
        if tag == "main":
            self.main_count += 1
        if attrs.get("id"):
            self.ids[attrs["id"]] += 1
            self.anchors.add(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.anchors.add(attrs["name"])
        for attr in ("href", "src", "poster"):
            if attrs.get(attr):
                self.references.append((line, attrs[attr]))
        if attrs.get("srcset") and not attrs["srcset"].startswith("data:"):
            for candidate in attrs["srcset"].split(","):
                if candidate.strip():
                    self.references.append((line, candidate.strip().split()[0]))
        for reference in CSS_URL.findall(attrs.get("style", "")):
            self.references.append((line, reference))
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            match = re.search(r"url\s*=\s*(.+)", attrs.get("content", ""), re.I)
            if match:
                self.references.append((line, match[1].strip("'\" ")))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def check_reference(site, source, line, reference, pages, errors):
    """Resolve links as a browser would when a directory index is served."""
    source_url = "/" + source.relative_to(site).as_posix()
    if source_url.endswith("/index.html"):
        source_url = source_url[:-10]
    url = urlsplit(urljoin(ORIGIN + source_url, unescape(reference).strip()))
    if url.scheme not in ("http", "https") or url.netloc != urlsplit(ORIGIN).netloc:
        return False
    target = (site / unquote(url.path).lstrip("/")).resolve()
    location = f"{source.relative_to(site)}:{line}"
    if not target.is_relative_to(site):
        errors.append(f"{location}: reference leaves site/: {reference}")
        return True
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        errors.append(f"{location}: missing local target: {reference}")
    elif url.fragment and target in pages:
        fragment = unquote(url.fragment).split(":~:text=", 1)[0]
        if fragment and fragment not in pages[target].anchors:
            errors.append(f"{location}: missing fragment #{fragment}: {reference}")
    return True


def check_site(site):
    errors = []
    pages = {}
    local_references = 0
    if not (site / "index.html").is_file():
        errors.append("Missing site/index.html")
    for path in sorted(site.rglob("*.html")):
        try:
            page = Page(path)
            pages[path] = page
        except (UnicodeError, OSError) as error:
            errors.append(f"{path.relative_to(site)}: cannot read page: {error}")
            continue
        for problem, condition in (
            ("missing html lang", not page.lang),
            ("missing page title", not page.title.strip()),
            ("expected exactly one main element", page.main_count != 1),
        ):
            if condition:
                errors.append(f"{path.relative_to(site)}: {problem}")
        for anchor, count in page.ids.items():
            if count > 1:
                errors.append(f"{path.relative_to(site)}: duplicate id '{anchor}'")
    for path, page in pages.items():
        for line, reference in page.references:
            local_references += check_reference(site, path, line, reference, pages, errors)
    for path in sorted(site.rglob("*.css")):
        content = path.read_text(encoding="utf-8")
        for match in CSS_URL.finditer(content):
            line = content.count("\n", 0, match.start()) + 1
            local_references += check_reference(site, path, line, match[1], pages, errors)
    for path in sorted(site.rglob("*")):
        try:
            if path.suffix in (".json", ".webmanifest"):
                data = json.loads(path.read_text(encoding="utf-8"))
                references = []
                if path == site / "index.json" and isinstance(data, list):
                    references = [entry.get("relpermalink", "") for entry in data]
                elif path.suffix == ".webmanifest":
                    references = [icon.get("src", "") for icon in data.get("icons", [])]
                for reference in filter(None, references):
                    local_references += check_reference(site, path, 1, reference, pages, errors)
            elif path.suffix == ".xml":
                tree = ET.parse(path)
                for element in tree.iter():
                    if element.tag.rsplit("}", 1)[-1] in ("loc", "link"):
                        reference = element.get("href") or element.text or ""
                        if reference.strip():
                            local_references += check_reference(site, path, 1, reference, pages, errors)
        except (ValueError, ET.ParseError) as error:
            errors.append(f"{path.relative_to(site)}: invalid {path.suffix}: {error}")
    return errors, len(pages), local_references


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1] / "site")
    args = parser.parse_args()
    site = args.site.resolve()
    errors, page_count, reference_count = check_site(site)
    if errors:
        for error in errors:
            print(f"ERROR {error}")
        print(f"Failed: {len(errors)} issue(s) across {page_count} HTML pages.")
        return 1
    print(f"Passed: {page_count} HTML pages, {reference_count} local references, CSS assets, and JSON/XML syntax.")
    print("External links, JavaScript behavior, and visual layout require separate review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
