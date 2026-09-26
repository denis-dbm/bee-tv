"""Render the Mermaid sources in diagrams/*.mmd to high-resolution PNGs in images/.

Usage (from the repository root; needs network access for the Mermaid library):
    uv run --with playwright playwright install chromium   # once
    uv run --with playwright python presentation/render_diagrams.py

PNGs (not inline Mermaid) keep the deck portable: Marp and any Markdown-to-PDF tool show them.
"""

import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "diagrams"
OUT = ROOT / "images"
CONFIG = {
    "startOnLoad": False,
    "theme": "base",
    "securityLevel": "loose",
    "fontFamily": "Inter, Segoe UI, Helvetica, Arial, sans-serif",
    "themeVariables": {
        "fontSize": "16px",
        "primaryColor": "#FFF3C4", "primaryBorderColor": "#C98A00", "primaryTextColor": "#1b1b1b",
        "secondaryColor": "#F3E5F5", "tertiaryColor": "#FFFBF2",
        "lineColor": "#5f5a50", "clusterBkg": "#FFFBF2", "clusterBorder": "#C98A00",
        "actorBkg": "#FFF3C4", "actorBorder": "#C98A00", "signalColor": "#1b1b1b",
        "noteBkgColor": "#F3E5F5", "noteBorderColor": "#7B1FA2",
        "labelBoxBkgColor": "#FFF3C4", "labelBoxBorderColor": "#C98A00",
        "activationBkgColor": "#FFE08A",
    },
    # Compact vertical rhythm, generous horizontal spacing: sequence diagrams fit 16:9 slides.
    "sequence": {"useMaxWidth": False, "mirrorActors": False, "boxMargin": 6, "noteMargin": 6,
                 "messageMargin": 24, "actorMargin": 70, "width": 170, "height": 50},
    "flowchart": {"useMaxWidth": False, "htmlLabels": True, "curve": "basis"},
    "class": {"useMaxWidth": False},
}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(device_scale_factor=2, viewport={"width": 2400, "height": 1600})
        await page.set_content('<html><body style="margin:0;background:#fff"><div id="out" style="display:inline-block;padding:24px;background:#fff"></div></body></html>')
        await page.add_script_tag(url="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js")
        await page.evaluate(f"mermaid.initialize({json.dumps(CONFIG)})")
        failures = 0
        for src in sorted(SRC.glob("*.mmd")):
            try:
                svg = await page.evaluate("async (code) => (await mermaid.render('d' + Date.now(), code)).svg", src.read_text())
            except Exception as exc:
                failures += 1
                print(f"FAIL {src.name}: {str(exc).splitlines()[0][:200]}")
                continue
            # Render at the SVG's natural size: mermaid otherwise caps width and shrinks text.
            await page.evaluate("""(svg) => {
                const out = document.getElementById('out');
                out.innerHTML = svg;
                const el = out.querySelector('svg');
                const vb = el.viewBox.baseVal;
                el.style.maxWidth = 'none';
                el.setAttribute('width', vb.width);
                el.setAttribute('height', vb.height);
            }""", svg)
            box = page.locator("#out")
            png = OUT / f"{src.stem}.png"
            await box.screenshot(path=str(png))
            bb = await box.bounding_box()
            print(f"ok   {src.name:24s} -> {png.name} ({int(bb['width'])}x{int(bb['height'])} css px)")
        await browser.close()
        sys.exit(1 if failures else 0)

asyncio.run(main())
