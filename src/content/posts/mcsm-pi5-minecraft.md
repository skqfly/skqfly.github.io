---
title: "在树莓派5（Ubuntu24.04）下使用MCSM面板搭建Minecraft服务器"
pubDate: 2025-10-10
description: "树莓派5 Ubuntu24.04 上使用 MCSM 面板搭建 Minecraft 服务器教程。"
author: "skqfly"
category: "Game"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

# 在树莓派5（Ubuntu24.04）下使用MCSM面板搭建Minecraft服务器
[官方文档](https://docs.mcsmanager.com/zh_cn/)[参考教程](https://www.bilibili.com/opus/993787460174479366)

## **1\. 安装mcsm-web和mcsm-daemon服务**

因为需要注册到系统服务，一键安装脚本**必须使用 root 权限**运行。（在线安装记得联网）

```
sudo su -c "wget -qO- https://script.mcsmanager.com/setup_cn.sh | bash"
```

安装完成后显示如下界面

启动方式

**mcsm-web默认在23333端口，mcsm-daemon默认在24444端口。云服务器记得打开对应防火墙，安全组！**

```
# 先启动面板守护进程。
# 这是用于进程控制，终端管理的服务进程。
systemctl start mcsm-daemon.service
# 再启动面板 Web 服务。
# 这是用来实现支持网页访问和用户管理的服务。
systemctl start mcsm-web.service
```

**接下来，如果你需要开放防火墙**

```
#安装ufw
sudo apt-get update
sudo apt-get install ufw

#启动ufw
sudo ufw enable

#开放23333和24444端口

sudo ufw allow 23333
sudo ufw allow 24444
```

## **2\. 访问mcsm-web并配置**

*   **本机访问http://localhost:23333**
*   **局域网访问http://局域网ipv4:23333**
*   **有公网访问http://公网ipv4:23333**

**第一次进入要设置账号密码，要牢记**

## **3\. 新增服务节点**

**这里远程节点 IP 地址必须使用外网地址或 localhost 地址。这里解释一下，新增节点可以添加很多节点（服务器），只要服务器部署了mcsm-daemon服务就可以。**

**这里我们mcsm-daemon和mcsm-web都部署在了树莓派5上，所以我们这里填localhost和端口24444就可以（不影响公网联机**

**如果你还有其他有公网ip的服务器也安装mcsm-daemon服务，这里就填公网ip地址和mcsm-daemon服务的端口。（mcsm可以同时管理多台服务器）**

**对于远程节点密钥在mcsm-daemon服务安装的位置**

```
sudo nano /opt/mcsmanager/daemon/data/Config/global.json 
```

key对应的就是远程节点密钥

## **4\. 配置java环境**

创建实例之前我们还要查看服务器是否有java环境以及对应java版本你可以安装你对应java版本

```
sudo apt install openjdk-8-jdk
sudo apt install openjdk-11-jdk
sudo apt install openjdk-17-jdk
sudo apt install openjdk-21-jdk
```

安装完成后，输入以下命令来查看你安装的Java

```
sudo update-alternatives --config java
```

输入对应的数字可以切换Java版本

使用以下命令来查看当前java版本

```
java -version
```

## **5\. 创建mc实例**

这里我创建一个mc java版1.21.9版本作演示

打开文件管理，我们上传，我们的mc服务端文件

服务器文件的话，去 Minecraft 官方下载最新服务端： [官网](https://www.minecraft.net/zh-hans/download/server) 手动下载 jar

这里替换成你下载的jar包名称server.jar

```
java -Xmx4096M  -Xms4096M -jar server.jar nogui
```

这里是初始分配2g最高4g，"nogui"部分表示不启动图形用户界面启动服务器

第一次启动它会报错并生成 `eula.txt` 文件。

编辑 `eula.txt`，改成：

```
 eula=true
```

再次启动

大功告成！默认启动在25565端口。

## **6\. 其他整合包模组mc实例**

这里以bettermc服务端为例

[**better-mc-forge-bmc4**](https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc4)
