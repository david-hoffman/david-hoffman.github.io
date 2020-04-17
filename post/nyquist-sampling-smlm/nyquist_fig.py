#!/usr/bin/env python
# -*- coding: utf-8 -*-
# nyquist_fig.py
"""
Nyquist figure

Copyright (c) 2020, David Hoffman
"""

import numpy as np
import matplotlib.pyplot as plt


def main():
    np.random.seed(42)
    r, theta = np.random.rand(2, 90)

    theta *= 2 * np.pi
    rr = np.sqrt(1 / 5 * (r + 5))
    x, y = rr * np.cos(theta), rr * np.sin(theta)

    num_fracs = 9
    fracs = np.arange(1, num_fracs + 1) / num_fracs

    fig, axs = plt.subplots(
        3,
        3,
        sharex=True,
        sharey=True,
        figsize=(5, 5.7),
        gridspec_kw=dict(hspace=0.05, wspace=0.1, left=0.01, right=0.99, top=0.95, bottom=0.01),
    )

    for frac, ax in zip(fracs, axs.ravel()):
        frac = int(len(x) * frac)
        ax.scatter(x[:frac], y[:frac], marker=".")
        ax.set_aspect(1)
        ax.xaxis.set_major_locator(plt.NullLocator())
        ax.yaxis.set_major_locator(plt.NullLocator())
        ax.set_title(f"{frac} Points")

    fig.savefig("featured.png", dpi=150, transparent=False)

    plt.show()


if __name__ == "__main__":
    main()
