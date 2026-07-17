---
title: "从随机种子到环境快照：一次可复现实验的完整记录"
pubDate: 2024-12-14
description: "以一维热方程为例，记录如何固定输入、数值格式与运行环境，让计算结果可以被重复验证。"
author: "skqfly"
category: "Research"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

“代码能再次运行”和“实验可以复现”不是一回事。前者只说明程序没有报错，后者还要求输入、离散方法、依赖版本和评价指标都能被另一个人准确还原。

这次小实验求解长度为 1 的细杆上的一维热方程：

$$
\frac{\partial u}{\partial t}=\alpha\frac{\partial^2u}{\partial x^2},
\qquad u(0,t)=u(1,t)=0.
$$

空间使用二阶中心差分，时间使用显式 Euler。记

$$
r=\frac{\alpha\Delta t}{\Delta x^2},
$$

更新公式为

$$
u_i^{n+1}=u_i^n+r\left(u_{i-1}^n-2u_i^n+u_{i+1}^n\right).
$$

为了避免数值振荡，需要满足稳定性条件 $r\leq 1/2$。本次取 $\alpha=0.1$、$\Delta x=0.01$，再由 $r=0.4$ 反推时间步长，而不是手工填写一个“看起来足够小”的数。

## 固定所有会变化的输入

初值是在 $\sin(\pi x)$ 上叠加微小扰动。扰动来自随机数，因此随机种子也是实验参数的一部分：

```python
import numpy as np

alpha = 0.1
dx = 0.01
r = 0.4
dt = r * dx**2 / alpha
steps = 2500

x = np.arange(0.0, 1.0 + dx, dx)
rng = np.random.default_rng(20240109)
u = np.sin(np.pi * x) + rng.normal(0.0, 1e-3, size=x.size)
u[[0, -1]] = 0.0

for _ in range(steps):
    previous = u.copy()
    u[1:-1] = previous[1:-1] + r * (
        previous[:-2] - 2.0 * previous[1:-1] + previous[2:]
    )

print(f"t={steps * dt:.4f}")
print(f"max={u.max():.8f}")
print(f"l2={np.linalg.norm(u) * np.sqrt(dx):.8f}")
```

代码里没有依赖系统时间，也没有读取隐式的本地配置。每次运行都从相同初值开始，边界条件也在进入时间循环前明确覆盖。

## 重复运行不是只看一张曲线

图像很适合发现异常，却不适合作为唯一的比较依据。我同时记录终止时刻、最大值和离散 $L^2$ 范数，并用第一次运行作为基准：

| 运行 | 随机种子 | $r$ | 与基准结果的最大绝对差 |
| --- | ---: | ---: | ---: |
| A | 20240109 | 0.4 | 0 |
| B | 20240109 | 0.4 | 0 |
| C | 20240109 | 0.4 | 0 |

这个表格证明的是“在相同环境中结果一致”，还不能证明跨环境完全一致。浮点运算顺序、BLAS 实现和处理器架构都可能带来末位差异，所以验收条件应写成误差阈值，例如

$$
\lVert u_{\mathrm{new}}-u_{\mathrm{ref}}\rVert_\infty < 10^{-12},
$$

而不是要求序列化文件的每一个字节都相同。

## 保存环境，而不是只保存 `requirements.txt`

这次运行记录了 Python 版本、NumPy 版本、操作系统、命令行参数和 Git 提交号。`requirements.txt` 只描述直接依赖；真正复现实验时，我会使用锁定文件或容器镜像，并把环境信息和结果放在同一个输出目录中。

一份足够小的复现清单包括：

1. 输入数据的来源与校验值；
2. 随机种子和全部超参数；
3. 离散格式、边界条件与停止条件；
4. 依赖锁定文件和运行命令；
5. 可机器比较的指标与允许误差。

把这些信息和代码一起提交后，实验才从“我这里可以运行”变成“别人可以验证”。
