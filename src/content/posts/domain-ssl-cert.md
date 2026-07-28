---
title: "域名绑定及申请 SSL 证书"
pubDate: 2025-10-09
description: "在公网服务器上部署了1panel服务，在端口40301，可以在本地通过http://localhost:40301/skqfly，想用域名访问，https://1panel.mmddskq.top，用nginx反向代理，certbot签名。"
author: "skqfly"
category: "Linux"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

# 域名绑定及申请SSL证书
在公网服务器上部署了1panel服务，在端口40301，可以在本地通过http://localhost:40301/skqfly，想用域名访问，https://1panel.mmddskq.top，用nginx反向代理，certbot签名。

[参考网址](https://blog.huazhuhui.fun/archives/mUksZRXh)

## 1. 域名解析

在域名服务商（比如阿里云、腾讯云、Cloudflare、Namecheap 等）里，添加 DNS 记录：

*   记录类型：A
*   主机记录：`@`
*   值：你的服务器公网 IP
*   TTL：默认

检查解析是否生效：

```
dig +short mmddskq.top
```

应该能返回你服务器的公网 IP。

## 2. 安装 Nginx 和 Certbot（已安装请跳过）

```
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

启动并设置开机自启：

```
sudo systemctl enable --now nginx
```

## 3. 配置 Nginx 反向代理

创建配置文件 `/etc/nginx/sites-available/1panel.mmddskq.top`：

```
sudo nano /etc/nginx/sites-available/1panel.mmddskq.top
```

```
server {
    listen 80;
    server_name 1panel.mmddskq.top;  # 你的域名

    # 反向代理到 1Panel 服务
    location / {
        proxy_pass http://localhost:40301/skqfly;  # 1Panel 本地地址+路径
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;  # 适配 1Panel 文件上传需求
    }

    # 日志配置（可选，便于排查问题）
    access_log /var/log/nginx/1panel_access.log;
    error_log /var/log/nginx/1panel_error.log;
}
```

保存退出：按 `Ctrl+O` → 回车 → `Ctrl+X`。

## 4. 启用站点配置

Ubuntu 22.04 的 Nginx 需通过软链接将 `sites-available` 中的配置文件链接到 `sites-enabled` 目录才会生效：

```
sudo ln -s /etc/nginx/sites-available/1panel.mmddskq.top /etc/nginx/sites-enabled/
```

## 5. 验证 Nginx 配置

检查配置是否有语法错误（必须执行，否则可能导致 Nginx 启动失败）：

```
sudo nginx -t
```

*   若输出 `nginx: configuration file /etc/nginx/nginx.conf test is successful`，说明配置正常；
*   若报错，根据提示修改配置文件（常见错误：路径拼写错误、括号不匹配）。

## 6. 重启 Nginx 服务

使配置生效：

```
sudo systemctl restart nginx
```

此时访问 `http://1panel.mmddskq.top` 应能正常显示 1Panel 页面（未加密，浏览器提示 "不安全"）。

## 7. 用 Certbot 配置 HTTPS

1.  申请 SSL 证书

执行以下命令（自动配置 HTTPS 并修改 Nginx 配置）：

```
sudo certbot --nginx -d 1panel.mmddskq.top
```

1.  交互步骤

*   输入邮箱（用于证书过期提醒）→ 回车；
*   同意协议（输入 `A`）→ 回车；
*   是否共享邮箱（输入 `N`）→ 回车；
*   选择 HTTP 跳转 HTTPS（推荐选 `2`）→ 回车。

## 8. 验证结果

1.  浏览器访问 `https://1panel.mmddskq.top`，地址栏显示绿色小锁，说明 HTTPS 生效；
2.  检查证书有效期：

```
sudo certbot certificates
```

应显示证书有效期为 90 天，且自动续期已配置。
