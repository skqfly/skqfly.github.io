---
title: "从 Notebook 走向可复现的数值实验"
pubDate: 2025-04-12
description: "把探索、计算和报告拆成清晰步骤，让一次性的 Notebook 成为可以复核的实验。"
author: "skqfly"
category: "Reproducibility"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

Notebook 很适合探索：数据、公式、图像和解释可以放在一起，反馈速度也很快。但当同一个文件承担数据清洗、参数配置、长时间计算和最终绘图时，单元格执行顺序会逐渐变成隐藏状态。

![适合讨论与整理实验思路的空间](/demo-1.jpg)

问题通常不是 Notebook 本身，而是没有区分“探索过程”和“可重复执行的计算过程”。

## 先找出隐含输入

一次数值实验的输入不仅是数据文件，还包括：

- 参数与随机种子；
- 软件依赖和运行环境；
- 数据预处理规则；
- 代码版本；
- 单元格曾经产生、但已经看不见的内存状态。

最后一项最危险。若选择“重启内核并全部运行”后结果发生变化，就说明实验依赖了执行历史。

## 拆成三层

一个轻量但有效的结构如下：

| 层次 | 职责 | 典型产物 |
| --- | --- | --- |
| 探索层 | 尝试假设、查看数据 | Notebook、草图 |
| 计算层 | 确定性地执行模型 | 脚本、配置、原始结果 |
| 报告层 | 读取结果并生成表达 | 图表、表格、文章 |

探索层可以频繁变化；计算层应接受显式参数，不依赖交互状态；报告层只读取已经保存的结果，避免在绘图时偷偷重新计算。

## 推荐的最小目录

~~~~text
experiment/
├─ configs/
│  └─ baseline.yaml
├─ data/
│  └─ README.md
├─ src/
│  ├─ simulate.py
│  └─ metrics.py
├─ notebooks/
│  └─ analysis.ipynb
├─ results/
└─ requirements.txt
~~~~

数据目录中的说明文件应写清来源、校验值和获取方式，而不是把来源不明的大文件直接提交。结果目录保存机器可读的原始输出，Notebook 只负责读取和解释。

## 为随机性建立边界

如果模型含有随机过程，应在入口处创建随机数生成器，并显式传递：

~~~~python
import numpy as np


def run_experiment(seed, sample_count):
    rng = np.random.default_rng(seed)
    samples = rng.normal(loc=0.0, scale=1.0, size=sample_count)
    return {
        "seed": seed,
        "sample_count": sample_count,
        "mean": float(samples.mean()),
        "std": float(samples.std(ddof=1)),
    }
~~~~

这样随机种子会成为实验配置的一部分，而不是散落在多个单元格中的全局状态。

## 一次简单的复现验收

在发布结果前，可以在全新环境中做一次验收：

1. 从空目录获取代码。
2. 按锁定文件安装依赖。
3. 依据说明获取并校验数据。
4. 只运行一个入口命令。
5. 比较关键指标、表格和图像。

可复现并不要求每个浮点数在所有硬件上逐位相同，但应提前定义允许的误差范围，并说明可能影响结果的非确定性来源。做到这一点，Notebook 仍然是很好的思考工具，同时实验也不再依赖作者的记忆。

