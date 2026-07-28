---
title: "部署 Minecraft Java 版服务器（Ubuntu 24.04）"
pubDate: 2025-10-05
description: "在 Ubuntu 24.04 上部署 Minecraft Java 版服务器完整教程。"
author: "skqfly"
category: "Game"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

# 部署 Minecraft Java 版服务器（Ubuntu 24.04）
## **🚀 部署 Minecraft Java 版服务器（Ubuntu 24.04）**

### **1\. 安装必要依赖**

更新系统并安装 Java（Minecraft 推荐 **Java 17**，Ubuntu 24.04 自带 OpenJDK 版本很合适）：

```
 sudo apt update && sudo apt upgrade -y
 sudo apt install -y openjdk-17-jdk
```

确认 Java 版本：

```
 java -version
```

### **2\. 创建 Minecraft 目录**

建议单独建个目录：

```
 mkdir -p ~/minecraft
 cd ~/minecraft
 # ~/代表home/skqfly/
```

### **3\. 下载服务端 jar 包**

去 Minecraft 官方下载最新服务端：

```
 wget https://piston-data.mojang.com/v1/objects/$(wget -qO- https://launchermeta.mojang.com/mc/game/version_manifest.json | grep -oP '(?<="url":")[^"]+' | head -n 1 | xargs wget -qO- | grep -oP '(?<="server":\s*{"url": ")[^"]+' ) -O server.jar
```

（上面命令是自动抓最新版，如果嫌麻烦，可以去 [官网](https://www.minecraft.net/zh-hans/download/server) 手动下载 jar，放到 `~/minecraft/server.jar`。）

### **4\. 启动服务端并生成文件**

第一次运行：

```
 java -Xmx4G -Xms4G -jar server.jar nogui
 
 java -Xmx4G -Xms4G -jar minecraft_server.1.21.9.jar nogui
 
 # 注意不要输错jar包的名称
```

如果您想使用图形用户界面启动服务器，您可以省略"nogui"部分。

（参数里 `4G` 是分配内存，树莓派内存有限，建议 1G–4G） 

它会报错并生成 `eula.txt` 文件。

### **5\. 接受 EULA**

编辑 `eula.txt`：

```
 nano eula.txt
```

改成：

```
 eula=true
```

### **6\. 再次启动**

```
 java -Xmx4G -Xms4G -jar server.jar nogui
```

### **7\. systemd 开机自启（可选）**

创建服务文件：

```
sudo nano /etc/systemd/system/minecraft.service
```

写入：

```
[Unit]
Description=Minecraft Server
After=network.target

[Service]
User=skqfly
WorkingDirectory=/home/skqfly/minecraft
ExecStart=/usr/bin/java -Xmx4G -Xms4G -jar server.jar nogui
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

保存退出后：

```
sudo systemctl daemon-reload
sudo systemctl enable minecraft
sudo systemctl start minecraft
```

查看状态：

```
sudo systemctl status minecraft
```

* * *

## **✅ 完成**

现在你就能在 Minecraft 客户端里用：

```
你的树莓派IP:25565
```

来连接服务器。

## **8\. 优化版 systemd 配置，每行都带注释，方便理解**

```
[Unit]
Description=Minecraft Server               # 服务描述，随便写
After=network.target                       # 等网络启动后再运行 MC

[Service]
WorkingDirectory=/home/mcserver/minecraft  # MC 服务器目录（放 server.jar 和 eula.txt 的地方）

ExecStart=/usr/bin/java \                  # Java 程序路径（通常在 /usr/bin/java）
  -Xms3G -Xmx4G \                          # JVM 最小内存 3G，最大内存 4G，避免动态扩容导致卡顿
  -XX:+UseG1GC \                           # 启用 G1 垃圾回收器，延迟更低，MC 官方推荐
  -XX:+ParallelRefProcEnabled \            # 启用并行引用处理，提高多核利用率
  -XX:MaxGCPauseMillis=50 \                # GC 停顿时间目标 ≤ 50 毫秒（玩家几乎感觉不到）
  -XX:+UnlockExperimentalVMOptions \       # 解锁实验性 JVM 参数（让下面的 G1 参数能用）
  -XX:G1NewSizePercent=20 \                # 新生代最小比例 20%（降低年轻代 GC 频率）
  -XX:G1MaxNewSizePercent=40 \             # 新生代最大比例 40%（避免新生代太大）
  -XX:InitiatingHeapOccupancyPercent=15 \  # 堆使用 15% 就触发并发 GC，避免爆堆
  -XX:G1HeapRegionSize=8M \                # 堆划分区域大小 8MB（适合 2~4G 内存）
  -XX:+PerfDisableSharedMem \              # 禁用 JVM 性能监控共享内存，降低树莓派内存开销
  -XX:+AlwaysPreTouch \                    # 启动时一次性分配内存，避免运行中突然分配卡顿
  -Dfile.encoding=UTF-8 \                  # 统一字符集编码，防止乱码
  -jar server.jar nogui                    # 启动 MC 服务器，nogui 表示不需要图形界面

User=mcserver                             # 以 mcserver 用户身份运行（安全，避免用 root）
Restart=on-failure                         # 如果崩溃，自动重启
RestartSec=10                              # 10 秒后重启（防止崩溃循环太快）

LimitNOFILE=10000                          # 提高文件句柄上限，防止 MC 打开太多文件报错
MemoryMax=6G                               # 最多能用 6G 内存（避免服务器整体被吃光）

[Install]
WantedBy=multi-user.target                 # 设置为开机启动
```

* * *

✅ 用法步骤：

1.  把这个保存为：
    ```
    sudo nano /etc/systemd/system/minecraft.service
    ```
2.  重新加载配置：
    ```
    sudo systemctl daemon-reload
    ```
3.  设置开机自启：
    ```
    sudo systemctl enable minecraft
    ```
4.  启动服务：
    ```
    sudo systemctl start minecraft
    ```
5.  查看运行状态：
    ```
     sudo systemctl status minecraft
    ```
