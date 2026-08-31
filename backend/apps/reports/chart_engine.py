"""
Chart Engine — Renders charts (Bar, Line, Pie, Doughnut) as base64 PNG images
for inclusion in HTML and PDF reports using Matplotlib.
"""

import io
import base64
from decimal import Decimal
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server rendering
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker


# Color schemes matching report themes
THEME_PALETTES = {
    'corporate_blue': ['#1e3a5f', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe'],
    'maintenance': ['#e94560', '#0f3460', '#16213e', '#533483', '#e94560'],
    'finance': ['#0d4f3c', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    'minimal': ['#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
    'executive': ['#581c87', '#7e22ce', '#a855f7', '#c084fc', '#e9d5ff'],
}


def generate_chart_image(
    chart_type: str,
    title: str,
    labels: list[str],
    values: list[float | int],
    theme: str = 'corporate_blue',
    width: float = 6.5,
    height: float = 3.2,
) -> str | None:
    """
    Generate a chart and return it as a base64 encoded PNG data URI.

    Args:
        chart_type: 'bar', 'line', 'pie', 'doughnut'
        title: Chart title
        labels: Data labels (x-axis or pie categories)
        values: Data values
        theme: Theme key for styling
        width: Figure width in inches
        height: Figure height in inches

    Returns:
        Base64 string `data:image/png;base64,...` or None if no data
    """
    if not labels or not values or len(labels) != len(values):
        return None

    # Sanitize None values and Decimal types to prevent unsupported operand errors
    clean_pairs = [
        (str(l if l is not None else 'Unknown'), float(v) if isinstance(v, Decimal) else (v if v is not None else 0))
        for l, v in zip(labels, values)
    ]
    if not clean_pairs:
        return None

    labels = [p[0] for p in clean_pairs]
    values = [p[1] for p in clean_pairs]

    # Limit to top 10 categories for readability
    if len(labels) > 10:
        labels = labels[:10]
        values = values[:10]

    colors = THEME_PALETTES.get(theme, THEME_PALETTES['corporate_blue'])

    plt.close('all')
    fig, ax = plt.subplots(figsize=(width, height), dpi=120)

    # Style background
    fig.patch.set_facecolor('#ffffff')
    ax.set_facecolor('#fafafa')

    chart_type = chart_type.lower()

    if chart_type == 'bar':
        bar_colors = [colors[i % len(colors)] for i in range(len(values))]
        bars = ax.bar(labels, values, color=bar_colors, width=0.55, edgecolor='none')
        ax.set_axisbelow(True)
        ax.yaxis.grid(True, color='#e5e7eb', linestyle='--', linewidth=0.7)
        ax.xaxis.grid(False)

        # Add data value labels on top of bars
        for bar in bars:
            height_val = bar.get_height()
            ax.annotate(
                f'{height_val:,.0f}' if isinstance(height_val, int) or height_val.is_integer() else f'{height_val:,.1f}',
                xy=(bar.get_x() + bar.get_width() / 2, height_val),
                xytext=(0, 3),
                textcoords="offset points",
                ha='center', va='bottom', fontsize=7.5, fontweight='bold', color='#374151'
            )

        plt.xticks(rotation=20 if len(labels) > 5 else 0, ha='right' if len(labels) > 5 else 'center', fontsize=8)

    elif chart_type == 'line':
        ax.plot(labels, values, marker='o', color=colors[0], linewidth=2.5, markersize=6, markerfacecolor=colors[1])
        ax.set_axisbelow(True)
        ax.grid(True, color='#e5e7eb', linestyle='--', linewidth=0.7)
        ax.fill_between(labels, values, color=colors[0], alpha=0.1)
        plt.xticks(rotation=20 if len(labels) > 5 else 0, ha='right' if len(labels) > 5 else 'center', fontsize=8)

    elif chart_type in ('pie', 'doughnut'):
        pie_colors = [colors[i % len(colors)] for i in range(len(values))]
        wedgeprops = {'width': 0.4} if chart_type == 'doughnut' else {'edgecolor': 'white', 'linewidth': 1.5}
        wedges, texts, autotexts = ax.pie(
            values,
            labels=labels,
            autopct='%1.1f%%',
            startangle=140,
            colors=pie_colors,
            wedgeprops=wedgeprops,
            textprops={'fontsize': 8},
        )
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_weight('bold')
            autotext.set_fontsize(7.5)

    # Title & Spacing
    if title:
        ax.set_title(title, fontsize=10, fontweight='bold', color='#111827', pad=10)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#d1d5db')
    ax.spines['bottom'].set_color('#d1d5db')

    plt.tight_layout()

    # Save to buffer
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
    plt.close(fig)
    buf.seek(0)

    base64_str = base64.b64encode(buf.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{base64_str}"


def generate_comparison_chart_image(
    chart_type: str,
    title: str,
    labels: list[str],
    values_a: list[float | int],
    values_b: list[float | int],
    label_a: str = "Period A",
    label_b: str = "Period B",
    theme: str = 'corporate_blue',
    width: float = 6.5,
    height: float = 3.2,
) -> str | None:
    """
    Generate a dual-series comparison chart (Period A vs Period B) as base64 PNG data URI.
    """
    if not labels or not values_a or not values_b:
        return None

    import numpy as np
    from decimal import Decimal

    # Sanitize inputs
    clean_a = [float(v) if isinstance(v, Decimal) else (v if v is not None else 0) for v in values_a]
    clean_b = [float(v) if isinstance(v, Decimal) else (v if v is not None else 0) for v in values_b]
    clean_labels = [str(l if l is not None else 'Unknown') for l in labels]

    if len(clean_labels) > 10:
        clean_labels = clean_labels[:10]
        clean_a = clean_a[:10]
        clean_b = clean_b[:10]

    colors = THEME_PALETTES.get(theme, THEME_PALETTES['corporate_blue'])
    color_a = colors[0]
    color_b = colors[1] if len(colors) > 1 else '#94a3b8'

    plt.close('all')
    fig, ax = plt.subplots(figsize=(width, height), dpi=120)

    fig.patch.set_facecolor('#ffffff')
    ax.set_facecolor('#fafafa')

    x = np.arange(len(clean_labels))
    width_bar = 0.35

    if chart_type.lower() == 'line':
        ax.plot(clean_labels, clean_a, marker='o', color=color_a, label=label_a, linewidth=2)
        ax.plot(clean_labels, clean_b, marker='s', color=color_b, label=label_b, linewidth=2, linestyle='--')
        plt.xticks(rotation=20 if len(clean_labels) > 5 else 0, ha='right' if len(clean_labels) > 5 else 'center', fontsize=8)
    else:
        ax.bar(x - width_bar/2, clean_a, width_bar, label=label_a, color=color_a)
        ax.bar(x + width_bar/2, clean_b, width_bar, label=label_b, color=color_b)
        ax.set_xticks(x)
        ax.set_xticklabels(clean_labels, rotation=20 if len(clean_labels) > 5 else 0, ha='right' if len(clean_labels) > 5 else 'center', fontsize=8)

    ax.legend(fontsize=8, loc='upper right')
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color='#e5e7eb', linestyle='--', linewidth=0.7)

    if title:
        ax.set_title(title, fontsize=10, fontweight='bold', color='#111827', pad=10)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#d1d5db')
    ax.spines['bottom'].set_color('#d1d5db')

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
    plt.close(fig)
    buf.seek(0)

    base64_str = base64.b64encode(buf.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{base64_str}"
