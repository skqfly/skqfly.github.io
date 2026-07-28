---
title: "Linux 服务设置开机自启流程"
pubDate: 2025-10-03
description: "本文档整理了如何在 Linux 系统中为一个服务（例如 frpc、frps 或其他可执行程序）配置开机自启，基于 systemd。"
author: "skqfly"
category: "Linux"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

# Linux 服务设置开机自启流程
## **Linux 服务设置开机自启流程**

本文档整理了如何在 Linux 系统中为一个服务（例如 frpc、frps 或其他可执行程序）配置开机自启，基于 **systemd**。

### **1\. 创建 systemd 单元文件**

1.  进入 systemd 配置目录：
    ```
     cd /etc/systemd/system/
    ```
2.  创建一个新的服务文件，例如 `frpc.service`：
    ```
     sudo nano /etc/systemd/system/frpc.service
    ```
3.  写入以下内容（根据实际路径修改 `ExecStart`）：
    ```
     [Unit]
     Description=FRP Client Service
     After=network.target
     
     [Service]
     Type=simple
     ExecStart=/home/skqfly/frp/frpc -c /home/skqfly/frp/frpc.toml
     Restart=on-failure
     RestartSec=5s
     
     [Install]
     WantedBy=multi-user.target
    ```
    
    > ⚠️ 注意：
    > 
    > *   `ExecStart` 指定了服务启动的命令，路径需与实际程序一致。
    > *   `Restart=on-failure` 表示进程异常退出后自动重启。

* * *

### **2\. 重新加载 systemd 配置**

每次新建或修改 `.service` 文件后，需要通知 systemd：
```
 sudo systemctl daemon-reload
```

* * *

### **3\. 设置开机自启**

启用服务：
```
 sudo systemctl enable frpc
```
立即启动服务：
```
 sudo systemctl start frpc
```

* * *

### **4\. 常用管理命令**

*   查看服务状态：`sudo systemctl status frpc`
*   重启服务：`sudo systemctl restart frpc`
*   停止服务：`sudo systemctl stop frpc`
*   查看实时日志：`sudo journalctl -u frpc -f`

* * *

### **5\. 示例：服务端 frps**

`/etc/systemd/system/frps.service` 示例：
```
[Unit]
Description=FRP Server Service
After=network.target

[Service]
Type=simple
ExecStart=/home/skqfly/frp/frps -c /home/skqfly/frp/frps.toml
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

配置完成后同样执行：
```
sudo systemctl daemon-reload
sudo systemctl enable frps
sudo systemctl start frps
```

* * *

### **6\. 验证开机自启**

重启系统后，执行：
```
systemctl status frpc
```
如果显示 `Active: active (running)`，则说明服务已随系统启动成功。
