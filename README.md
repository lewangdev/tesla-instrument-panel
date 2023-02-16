# Model 3/Y 仪表盘

这是一个 DEMO, 用于演示获取 tesla 车辆数据并且做展示的过程.

[![Tesla Instrument Panel](./images/tesla-dash.gif)](https://github.com/lewangdev/tesla-instrument-panel)

## 体验

```
git clone git@github.com:lewangdev/tesla-instrument-panel.git
python3 -m http.server 8000
```

在浏览器地址栏输入 http://127.0.0.1:8000 即可体验

## 如何连接自己的车辆数据

- 安装 [teslamate](https://github.com/adriankumpf/teslamate), 推荐用 docker-compose 安装，这种方式会方便以后的升级
- 下载执行 [tesla_auth](https://github.com/adriankumpf/tesla_auth) 命令, 获取 teslamate 登录需要的 token，登录完成后就可以看到 teslamate 和 Grafana，并且从 mosquitto 上订阅到车辆的数据
- 根据自己的环境修改 app.js 中的设置
