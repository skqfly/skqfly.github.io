---
title: "FRP 安装与配置"
pubDate: 2025-10-03
description: "本文档整理了你提供的 FRP 安装、解压、重命名、以及 frps.toml 与 frpc.toml 的示例配置，已经按 Markdown 格式美化，便于保存与分享。"
author: "skqfly"
category: "Linux"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

# FRP 安装与配置
## **FRP 安装与配置（整理版）**

本文档整理了你提供的 FRP 安装、解压、重命名、以及 `frps.toml` 与 `frpc.toml` 的示例配置，已经按 Markdown 格式美化，便于保存与分享。

[FRP 官方文档](https://gofrp.org/zh-cn/docs/overview/)

[GITHUB 官方网址](https://github.com/fatedier/frp/releases)

 [FRP - Linux & Win 内网穿透教程 手搓难度](https://www.cnblogs.com/geek233/p/18791892)

* * *

### **1\. 下载（示例：AMD/x86\_64 架构）**

```
 # AMD（x86_64）架构下载
 wget https://github.com/fatedier/frp/releases/download/v0.65.0/frp_0.65.0_linux_amd64.tar.gz
 # 树莓派arm64架构下载
 wget https://github.com/fatedier/frp/releases/download/v0.65.0/frp_0.65.0_linux_arm64.tar.gz
```

> 如果你是 ARM（树莓派），请改用对应的 `linux_arm` 或 `linux_arm64` 包。

* * *

### **2\. 解压**

```
 # 解压当前目录
 tar -zxvf frp_0.65.0_linux_amd64.tar.gz
 
 # 解压到指定目录
 tar -zxvf frp_0.65.0_linux_amd64.tar.gz -C /path/to/dir
```

* * *

### **3\. 重命名并进入目录**

```
 # 解压后目录通常为 frp_0.65.0_linux_amd64
 mv frp_0.65.0_linux_amd64 frp
 cd frp
```

* * *

### **4\. 服务端配置（**`**frps.toml**` **示例）**

> 用 `sudo nano frps.toml` 编辑（或使用你偏好的编辑器）。下面是整理后的配置片段：

```
 # =========== 基本监听 ===========
 # vhost HTTP（用于内网 HTTP 代理穿透）
 vhostHTTPPort = 80
 # vhost HTTPS（用于内网 HTTPS 代理穿透）
 vhostHTTPSPort = 443
 
 # 如果使用子域名解析（动态子域名），设置 subDomainHost（没有域名请删除此行）
 # subDomainHost = "mmddskq.top"  # 示例：替换为你的真实域名或删除
 
 # =========== Web 控制台（Dashboard） ===========
 [webServer]
 addr = "0.0.0.0"        # 监听地址（所有 IP）
 port = 7500              # Dashboard 端口（浏览器访问示例：http://公网IP:7500）
 user = ""         # Dashboard 登录用户名
 password = ""    # Dashboard 登录密码（请修改为更安全的密码）
 
 # =========== 身份验证（Authentication） ===========
 # 支持 token、oidc 等方式。这里使用 token。
 auth.method = "token"
 # auth.token 在 frps.toml 与 frpc.toml 中必须一致
 # 示例：
 auth.token = ""
```

> 请务必替换 `webServer.password` 为更强的密码，并确认 `subDomainHost` 的使用需求（无域名则删除）。

* * *

### **5\. 客户端配置（**`**frpc.toml**` **示例）**

> 用 `sudo nano frpc.toml` 编辑。下面是整理后的配置：

```
 # 服务端地址（公网 IP 或域名）
 serverAddr = "公网ipv4"
 # 服务端监听端口（需与 frps 的 bindPort 保持一致）
 serverPort = 7000
 
 # 连接协议
 transport.protocol = "tcp"
 
 # 认证方式（与服务端一致）
 auth.method = "token"
 auth.token = ""
 
 # =========== 代理配置 ===========
 [[proxies]]
 name = "ssh23"         # 代理名称（随意，但需唯一）
 type = "tcp"           # 选择 tcp（适合 SSH 等 IP:端口 直连）
 localIP = "127.0.0.1"   # 本地被转发的服务地址
 localPort = 22           # 本地被转发的服务端口（SSH 的默认端口为 22）
 remotePort = 23          # 服务端映射端口（访问 公网IP:23 将被转入本地 127.0.0.1:22）
 
 # 如果使用域名/子域名访问，改用 type = "http" 并配置 subdomain 字段；
 # 如果使用 IP+端口 直连，请删除 subdomain 字段并使用 remotePort。
```

* * *

### **6\. 注意事项与排查指引**

*   修改 `frps.toml` 或 `frpc.toml` 后需要重启对应服务：
    *   客户端：`sudo systemctl restart frpc`
    *   服务端：`sudo systemctl restart frps`
*   如果 `frpc` 启动失败并报错 `dial tcp ...: i/o timeout`：通常是网络不可达或服务端端口未开放。
    *   在服务端检查监听：`sudo ss -lntp | grep 7000`
    *   检查云厂商安全组或服务器防火墙是否放行 `7000/tcp`。
    *   在客户端测试连通性：`telnet 公网ipv4 7000` 或 `nc -vz 公网ipv4 7000`。
*   `auth.token` 必须在双方完全一致。
*   如果运行在树莓派等 ARM 设备，确保下载与设备架构匹配的 frp 二进制（例如 `linux_arm` 或 `linux_arm64`）。

* * *

### **7\. 常用命令速查**

```
 # systemd 管理
 sudo systemctl daemon-reload
 sudo systemctl enable frpc
 sudo systemctl start frpc
 sudo systemctl status frpc
 sudo systemctl restart frpc
 
 sudo systemctl daemon-reload
 sudo systemctl enable frpc
 sudo systemctl start frpc
 sudo systemctl status frpc
 sudo systemctl restart frpc
 
 sudo nano /etc/systemd/system/frpc.service
 
 sudo nano /etc/systemd/system/frps.service
 
 # mc联机
 公网ipv4:25565
```

### **8\. 注意事项**

这个文件权限里 **没有 x（可执行权限）**，说明它被当作普通文件而不是程序，所以 systemd 才会报错 `status=203/EXEC`。

你已经执行了：

```
 chmod +x /home/skqfly/frp/frpc
```

这样它就变成可执行文件了，再运行时权限问题就解决了。

1.  **SSH**：依然走公网 IP 直连 → `公网ipv4 → 树莓派 127.0.0.1:22`
2.  **网站（博客）**：走域名 `blog.mmddskq.top → 树莓派 127.0.0.1:8888`

* * *

### **服务端配置（**`**frps.toml**`**，云服务器）**

```
# =========== 基础监听 ===========
bindPort = 7000                     # frps 服务端端口，frpc 要连这个
vhostHTTPPort = 80                  # HTTP 代理端口
vhostHTTPSPort = 443                # HTTPS 代理端口

# 如果用子域名解析必须加上（这里用你的域名）
subDomainHost = "mmddskq.top"

# =========== Web 控制台 ===========
[webServer]
addr = "0.0.0.0"
port = 7500
user = ""
password = ""                 # 建议换更安全的密码

# =========== 身份验证 ===========
auth.method = "token"
auth.token = ""
```

* * *

### **客户端配置（**`**frpc.toml**`**，树莓派）**

```
# =========== 服务端信息 ===========
serverAddr = "123.60.219.241"        # 云服务器 IP
serverPort = 7000                    # 要和 frps.toml 的 bindPort 对应

transport.protocol = "tcp"

auth.method = "token"
auth.token = ""

# =========== 代理配置 ===========

# 1. SSH（不用域名，IP直连）
[[proxies]]
name = "ssh23"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 23                      # 访问 公网ipv4 → 树莓派 SSH

# 2. 网站（博客，用域名 blog.mmddskq.top）
[[proxies]]
name = "blog"
type = "http"
localIP = "127.0.0.1"
localPort = 8888                     # 树莓派本地网站监听端口
subdomain = "blog"                   # 最终访问 blog.mmddskq.top
```

* * *

### **🔑 最终访问方式**

*   **SSH**：
    ```
    ssh 用户名@公网ipv4 -p 23
    ```
*   **网站**： 打开浏览器访问：
    ```
    http://blog.mmddskq.top
    ```
（前提：你的 DNS 已经把 `*.mmddskq.top` 解析到云服务器 `公网ipv4`）
