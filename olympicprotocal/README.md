# Olympic Protocal · 校园通行指挥台

课表 / 语音播报 / 定位 / 路线规划的静态页面，访问地址：
<https://rhythmhill.com/olympicprotocal/>

**这个目录是部署副本，请不要直接改这里。** 源文件在 Olympic Protocal 工程里，
改完运行 `node tools/deploy.js --push` 同步过来。

页面完全跑在浏览器端，没有任何后端依赖；数据存在访问者自己的浏览器里。
OpenStreetMap 取点可直接用；高德 / Google 需要跨域代理，静态托管上没有，
所以线上只能用 OpenStreetMap 那个来源。
