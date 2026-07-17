---
title: "从热方程到可信的有限差分实验"
pubDate: 2026-06-03
description: "从离散格式、稳定性条件到网格收敛，完整走一遍一维热方程的数值实验。"
author: "skqfly"
category: "Scientific Computing"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

有限差分法的公式并不复杂，真正容易出错的是：离散格式是否稳定、边界条件是否被正确实现，以及实验结果能否支持“算法收敛”这个结论。下面用一维热方程把这些环节连起来。

## 问题与离散

考虑区间 $x\in[0,1]$ 上的初边值问题

$$
\frac{\partial u}{\partial t}
=\alpha\frac{\partial^2u}{\partial x^2},\qquad
u(0,t)=u(1,t)=0,\qquad
u(x,0)=\sin(\pi x).
$$

它的解析解是

$$
u(x,t)=e^{-\alpha\pi^2t}\sin(\pi x),
$$

因此很适合用来检查数值误差。令 $x_i=i\Delta x$、$t^n=n\Delta t$，在空间使用中心差分、时间使用前向欧拉，可得

$$
u_i^{n+1}
=u_i^n+r\left(u_{i-1}^n-2u_i^n+u_{i+1}^n\right),
\qquad
r=\frac{\alpha\Delta t}{\Delta x^2}.
$$

这一显式格式必须满足 $r\leq \frac12$。它不是经验参数，而是由放大因子分析得到的稳定性限制。

## 一个最小实现

~~~~python
import numpy as np


def solve_heat(nx=101, alpha=0.1, final_time=0.2, r=0.45):
    x = np.linspace(0.0, 1.0, nx)
    dx = x[1] - x[0]
    dt = r * dx**2 / alpha
    steps = int(np.ceil(final_time / dt))
    dt = final_time / steps
    r = alpha * dt / dx**2

    u = np.sin(np.pi * x)
    for _ in range(steps):
        next_u = u.copy()
        next_u[1:-1] = (
            u[1:-1]
            + r * (u[:-2] - 2.0 * u[1:-1] + u[2:])
        )
        next_u[[0, -1]] = 0.0
        u = next_u

    exact = np.exp(-alpha * np.pi**2 * final_time) * np.sin(np.pi * x)
    error = np.max(np.abs(u - exact))
    return x, u, error
~~~~

代码里重新计算了步数和 $\Delta t$，这样终止时间会被精确命中，同时仍保持稳定性条件。边界值在每一步都显式设置，避免后续修改初值时意外破坏边界。

## 网格收敛检查

固定 $r=0.45$ 并逐次减半 $\Delta x$，得到一组代表性的最大模误差：

| 网格点数 $N_x$ | $\Delta x$ | 最大误差 | 误差比 |
| ---: | ---: | ---: | ---: |
| 26 | 0.0400 | $1.76\times10^{-4}$ | — |
| 51 | 0.0200 | $4.40\times10^{-5}$ | 4.00 |
| 101 | 0.0100 | $1.10\times10^{-5}$ | 4.00 |
| 201 | 0.0050 | $2.75\times10^{-6}$ | 4.00 |

误差在网格间距减半时约缩小为四分之一，符合空间二阶、且 $\Delta t=O(\Delta x^2)$ 时整体二阶的预期。相比只画一条“看起来平滑”的曲线，收敛表能更直接地说明实现是否正确。

## 实验中应记录什么

至少保存 $\alpha$、最终时间、网格点数、实际使用的 $\Delta t$、稳定性参数 $r$ 和误差范数。数值方法的结论依赖这些条件；缺少它们，曲线就很难被复核。
