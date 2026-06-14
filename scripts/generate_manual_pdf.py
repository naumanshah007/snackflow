from __future__ import annotations

import re
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MD = ROOT / "docs" / "manual" / "SnackFlow_User_Handover_Manual.md"
ROOT_OUTPUT = ROOT / "public" / "docs" / "SnackFlow_User_Handover_Manual.pdf"
FRONTEND_OUTPUT = ROOT / "frontend" / "public" / "docs" / "SnackFlow_User_Handover_Manual.pdf"
LOGO_PATH = ROOT / "frontend" / "public" / "logo.png"

BRAND_ORANGE = colors.HexColor("#f97316")
BRAND_GREEN = colors.HexColor("#16a34a")
BRAND_NAVY = colors.HexColor("#172554")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#4b5563")
LINE = colors.HexColor("#e5e7eb")
SOFT_ORANGE = colors.HexColor("#fff7ed")
SOFT_GREEN = colors.HexColor("#f0fdf4")


def clean_inline(text: str) -> str:
    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("`", "")
    )
    escaped = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"\*(.*?)\*", r"<i>\1</i>", escaped)
    return escaped


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=30,
            leading=34,
            alignment=TA_CENTER,
            textColor=BRAND_NAVY,
            spaceAfter=14,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=13,
            leading=18,
            alignment=TA_CENTER,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "h1": ParagraphStyle(
            "SectionTitle",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=22,
            textColor=BRAND_NAVY,
            spaceBefore=14,
            spaceAfter=8,
            borderPadding=(0, 0, 5, 0),
            borderColor=BRAND_ORANGE,
            borderWidth=0,
            borderRadius=0,
        ),
        "h2": ParagraphStyle(
            "SubsectionTitle",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=BRAND_GREEN,
            spaceBefore=9,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.6,
            leading=13.4,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
        ),
        "list": ParagraphStyle(
            "List",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=12.7,
            textColor=INK,
            leftIndent=8,
            firstLineIndent=0,
        ),
        "toc": ParagraphStyle(
            "Toc",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=12.2,
            textColor=INK,
        ),
    }


def add_cover(story: list, styles: dict[str, ParagraphStyle]) -> None:
    story.append(Spacer(1, 0.35 * inch))
    if LOGO_PATH.exists():
        logo = Image(str(LOGO_PATH), width=1.45 * inch, height=1.45 * inch)
        logo.hAlign = "CENTER"
        story.append(logo)
        story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph("SnackFlow User Handover Manual", styles["cover_title"]))
    story.append(Paragraph("Stock, Sales, Shop Ledger & Distribution Management System", styles["cover_subtitle"]))
    story.append(Paragraph("Smart Stock, Sales & Shop Ledger for Snack Distribution", styles["cover_subtitle"]))
    story.append(Spacer(1, 0.25 * inch))

    overview = Table(
        [
            ["Version", "1.0"],
            ["Date", "14 June 2026"],
            ["Prepared for", "Snack Distribution Business Owner / Admin"],
            ["Primary Users", "Owner, warehouse manager, order booker, accountant"],
        ],
        colWidths=[1.45 * inch, 4.45 * inch],
        hAlign="CENTER",
    )
    overview.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT_ORANGE),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#fed7aa")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#fdba74")),
                ("TEXTCOLOR", (0, 0), (0, -1), BRAND_NAVY),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("LEADING", (0, 0), (-1, -1), 13),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(overview)
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            "This document explains the complete daily workflow: setup, inventory, shops, GPS, sales, payments, returns, reversals, expenses, reports, security, and handover checks.",
            styles["cover_subtitle"],
        )
    )
    story.append(PageBreak())


def add_toc(story: list, styles: dict[str, ParagraphStyle], markdown: str) -> None:
    story.append(Paragraph("Table of Contents", styles["h1"]))
    headings = []
    for line in markdown.splitlines():
        if line.startswith("## ") and not line.startswith("## Table"):
            text = line[3:].strip()
            if text and text[0].isdigit():
                headings.append(text)
    rows = []
    for index, heading in enumerate(headings, start=1):
        rows.append([Paragraph(str(index), styles["toc"]), Paragraph(clean_inline(heading), styles["toc"])])
    table = Table(rows, colWidths=[0.35 * inch, 5.65 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("TEXTCOLOR", (0, 0), (0, -1), BRAND_ORANGE),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    story.append(PageBreak())


def flush_list(
    story: list,
    pending: list[str],
    ordered: bool,
    styles: dict[str, ParagraphStyle],
) -> None:
    if not pending:
        return
    items = [ListItem(Paragraph(clean_inline(item), styles["list"]), leftIndent=10) for item in pending]
    story.append(
        ListFlowable(
            items,
            bulletType="1" if ordered else "bullet",
            leftIndent=18,
            bulletFontName="Helvetica-Bold",
            bulletFontSize=8,
            bulletColor=BRAND_ORANGE if ordered else BRAND_GREEN,
            start="1",
        )
    )
    story.append(Spacer(1, 3))
    pending.clear()


def add_manual_body(story: list, styles: dict[str, ParagraphStyle], markdown: str) -> None:
    pending_list: list[str] = []
    ordered = False
    skip_toc_block = False

    for raw_line in markdown.splitlines()[1:]:
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped == "## Table of Contents":
            skip_toc_block = True
            continue
        if skip_toc_block:
            if stripped.startswith("## 1. "):
                skip_toc_block = False
            else:
                continue

        if not stripped:
            flush_list(story, pending_list, ordered, styles)
            continue

        bullet_match = re.match(r"^- (.*)", stripped)
        ordered_match = re.match(r"^\d+\.\s+(.*)", stripped)
        if bullet_match:
            if pending_list and ordered:
                flush_list(story, pending_list, ordered, styles)
            ordered = False
            pending_list.append(bullet_match.group(1))
            continue
        if ordered_match:
            if pending_list and not ordered:
                flush_list(story, pending_list, ordered, styles)
            ordered = True
            pending_list.append(ordered_match.group(1))
            continue

        flush_list(story, pending_list, ordered, styles)

        if stripped.startswith("# "):
            continue
        if stripped.startswith("## "):
            story.append(Paragraph(clean_inline(stripped[3:]), styles["h1"]))
            continue
        if stripped.startswith("### "):
            story.append(Paragraph(clean_inline(stripped[4:]), styles["h2"]))
            continue
        story.append(Paragraph(clean_inline(stripped), styles["body"]))

    flush_list(story, pending_list, ordered, styles)


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(BRAND_ORANGE)
    canvas.rect(0, height - 0.22 * inch, width, 0.22 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_GREEN)
    canvas.rect(0, height - 0.27 * inch, width, 0.05 * inch, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 0.52 * inch, width - doc.rightMargin, 0.52 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(doc.leftMargin, 0.32 * inch, "SnackFlow User Handover Manual")
    canvas.drawRightString(width - doc.rightMargin, 0.32 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    markdown = SOURCE_MD.read_text(encoding="utf-8")
    styles = make_styles()
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.68 * inch,
        title="SnackFlow User Handover Manual",
        author="SnackFlow",
    )
    story: list = []
    add_cover(story, styles)
    add_toc(story, styles, markdown)
    add_manual_body(story, styles, markdown)
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)


def main() -> None:
    if not SOURCE_MD.exists():
        raise FileNotFoundError(f"Manual source not found: {SOURCE_MD}")
    build_pdf(ROOT_OUTPUT)
    FRONTEND_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT_OUTPUT, FRONTEND_OUTPUT)
    print(f"Generated {ROOT_OUTPUT.relative_to(ROOT)}")
    print(f"Copied {FRONTEND_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
