---
title: "把参数扫描做成可复现的计算实验"
pubDate: 2026-03-18
description: "用确定性配置、实验标识与结构化结果，让参数扫描可以中断、复跑和比较。"
author: "skqfly"
category: "Reproducibility"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

参数扫描看起来只是两层循环，但一旦运行时间变长、参数增多，最常见的问题就会出现：不知道某个结果来自哪组参数，失败后只能全部重跑，或者换一台机器便无法复现。

以阻尼振子为例：

$$
\ddot{x}+2\zeta\omega\dot{x}+\omega^2x=0.
$$

我们希望比较不同阻尼比 $\zeta$ 和固有频率 $\omega$ 下的衰减时间。关键不是写出循环，而是为每次运行建立稳定、可追踪的身份。

## 让配置决定实验标识

把参数按固定顺序序列化，再计算短哈希。相同配置无论何时提交，都会得到相同标识。

~~~~python
from hashlib import sha256
from itertools import product
import json


def experiment_id(config):
    payload = json.dumps(
        config,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256(payload).hexdigest()[:12]


grid = {
    "zeta": [0.05, 0.10, 0.20],
    "omega": [1.0, 2.0, 4.0],
}

experiments = []
for zeta, omega in product(grid["zeta"], grid["omega"]):
    config = {"zeta": zeta, "omega": omega, "solver": "RK45"}
    experiments.append({"id": experiment_id(config), **config})
~~~~

哈希不是为了保密，而是为了去重与追踪。运行前先查询结果目录：若该标识已经有完整记录就跳过，若只有临时文件则继续或重跑。

## 将“环境”也视为输入

同一份参数在不同依赖版本下可能产生差异，因此实验记录不能只保存模型参数。一个实用的最小记录可以分成四类：

| 记录项 | 示例 | 作用 |
| --- | --- | --- |
| 模型参数 | $\zeta=0.1,\ \omega=2$ | 定义待求问题 |
| 数值设置 | RK45、容差 $10^{-8}$ | 定义求解过程 |
| 软件环境 | Python、NumPy、SciPy 版本 | 解释实现差异 |
| 产出摘要 | 状态、运行时间、误差指标 | 支持筛选与比较 |

![用于整理实验记录的安静工作空间](/demo-2.jpg)

图片、图表和日志都属于结果，但结构化摘要更适合批量分析。可以把每次运行的摘要追加到 CSV 或 Parquet，把较大的轨迹数组按实验标识保存为独立文件。

## 一个可恢复的执行顺序

1. 读取并校验配置。
2. 计算实验标识。
3. 检查是否已有成功结果。
4. 写入“运行中”状态。
5. 执行求解并保存原始数据。
6. 计算摘要，最后原子地写入“成功”状态。

如果进程在第 5 步中断，下次启动时会看到未完成状态，而不会误把半份结果当成成功实验。对于需要数小时或数天的扫描，这种流程比单纯增加并行度更重要。

## 比较之前先固定指标

衰减时间可以定义为振幅首次低于初始振幅 $1/e$ 的时刻。指标必须在扫描前定义，否则很容易根据结果临时选择对自己有利的解释。可复现性不仅是“代码能运行”，也包括分析规则能够被提前说明。
