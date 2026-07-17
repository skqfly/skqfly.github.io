---
title: "残差很小，线性方程组的解就可靠吗？"
pubDate: 2025-10-26
description: "从条件数、前向误差与后向误差出发，理解为什么小残差不总能保证小解误差。"
author: "skqfly"
category: "Numerical Analysis"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

求解 $Ax=b$ 后，我们通常先检查残差 $r=b-A\hat{x}$。残差小当然是好事，但它只说明计算出的 $\hat{x}$ 精确地解了一个与原问题相近的方程；若矩阵病态，$\hat{x}$ 仍可能离真实解很远。

## 条件数连接残差与误差

在一致范数下，矩阵的条件数定义为

$$
\kappa(A)=\lVert A\rVert\lVert A^{-1}\rVert.
$$

若把残差看成右端项扰动，可得到近似的误差界

$$
\frac{\lVert x-\hat{x}\rVert}{\lVert x\rVert}
\lesssim
\kappa(A)
\frac{\lVert b-A\hat{x}\rVert}{\lVert b\rVert}.
$$

因此，当 $\kappa(A)$ 很大时，机器精度级别的相对残差仍可能被放大成明显的解误差。

## 用 Hilbert 矩阵做检查

Hilbert 矩阵的元素为 $H_{ij}=1/(i+j+1)$，它随着维度增加会迅速变得病态。可以选定全一向量为真实解，再比较求解结果。

~~~~python
import numpy as np


def hilbert(n):
    i = np.arange(n)[:, None]
    j = np.arange(n)[None, :]
    return 1.0 / (i + j + 1.0)


for n in (5, 8, 12):
    A = hilbert(n)
    x_true = np.ones(n)
    b = A @ x_true
    x_hat = np.linalg.solve(A, b)

    relative_residual = np.linalg.norm(b - A @ x_hat) / np.linalg.norm(b)
    relative_error = np.linalg.norm(x_hat - x_true) / np.linalg.norm(x_true)

    print(n, np.linalg.cond(A), relative_residual, relative_error)
~~~~

双精度环境中的量级通常如下：

| 维度 $n$ | $\kappa_2(H)$ | 相对残差 | 相对解误差 |
| ---: | ---: | ---: | ---: |
| 5 | $4.8\times10^5$ | $10^{-16}$ | $10^{-12}$ |
| 8 | $1.5\times10^{10}$ | $10^{-16}$ | $10^{-7}$ |
| 12 | $10^{16}$ 量级 | $10^{-16}$ | $10^{-1}$ 量级 |

不同 BLAS 实现会让最后几位发生变化，但趋势不变：残差始终很小，解误差却随条件数迅速放大。

## 更完整的诊断

实际计算中可以同时报告以下三个量：

1. 相对残差，用于判断线性系统是否被数值求解器充分满足；
2. 条件数估计，用于衡量问题对输入扰动的敏感性；
3. 后向误差，用于衡量 $\hat{x}$ 是多大扰动问题的精确解。

如果条件数过大，应优先检查变量尺度、模型参数化和离散方式，也可以考虑预条件、正则化或更高精度计算。仅仅把迭代容差调得更小，通常无法修复问题本身的病态性。
