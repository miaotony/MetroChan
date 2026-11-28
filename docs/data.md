# 官方数据维护

`data/official/stations.json` 保留官方字典和稳定的站点 ID。`routes/*.bin` 和 `map.bin` 是可独立解压的 gzip 文件，不是运行时重新计算的路径。普通构建不需要联网、Git 历史、解包数据或安装压缩工具。

同一份官方快照的实际文件大小（字节，不计 HTTP 压缩或磁盘块取整）：

| 内容 | 压缩改造前（`2d22841`） | 改造后 | 减少 |
| --- | ---: | ---: | ---: |
| 官方路径 | 18,956,451 | 136,414 | 99.28% |
| 整个部署目录 | 19,445,080 | 479,043 | 97.54% |
| 可双击的独立 HTML | 19,514,116 | 439,625 | 97.75% |

开发时线网仍编辑 `data/metro_data.json`。发布时用站点、线路编号替代重复名称，构建会校验还原后的内容与枚举顺序；这张线网和官方票价字典并不相同，不能互换。打赏二维码采用无损 WebP，单文件中的两处展示共用同一份图片。在线分享预览图仍使用原 PNG，不打包进离线文件。

## 将路径还原成可读的旧格式

```sh
node scripts/official-data.mjs unpack data/official/stations.json data/official/routes /tmp/metrochan-paths
```

输出目录必须尚不存在。得到 `0.json` 至 `416.json`，每个文件以终点 ID 索引，内容是完整的 `{p, lt, r}`；保留推荐原文、顺序、票价、分钟、换乘数及出行类别。地图可用 `gzip -dc data/official/map.bin > /tmp/metrochan-map.json` 还原为原始 JSON。

## 替换官方快照

使用新快照配套的站点字典和**完整**的路径目录（不要从 UI 文案反推数据）：

```sh
node scripts/official-data.mjs pack stations.json paths /tmp/metrochan-routes-new
```

命令按新字典核对 ID 和输入文件集合，每块写出前均解压并与输入深比较；额外字段、丢失记录或文字差异都会报错。验证成功后，成套替换字典和 `routes/` 目录；若地图变化，以 `gzip -n -9 -c map_geo.json > data/official/map.bin` 更新。只在有核实过的上游变更时更新测试快照、覆盖数量与体积预算。运行 `npm test`、构建及双路径/离线回归，见[测试说明](../tests/README.md)。

## 路径块 v1

- 每 16 个连续起点独立一个块。`first`（含）、`end`（不含）、`stationCount` 与 `version` 确定边界。每行只存 ID 大于起点的终点，按 ID 升序；反向查询沿用原规则。
- gzip 内是 UTF-8 JSON。`templates` 字典把推荐原文中的起点、终点换成 `U+0001`、`U+0002`；若原文已包含这些字符，使用单元素数组保留原文。`profiles` 共享线路类别、分组名、有序选项名、模板 ID 和换乘数。
- `profileIds` 和 `fares` 是按站对排列的列。模板组合编号从 1 开始，0 表示未收录。`minutes` 按站对及选项顺序排列，保存相对同块、同终点、同选项位置上一次分钟值的差，首次相对 0。所有块相互独立。
- 网站仅解压所查站对的块；缓存列及偏移，仅为请求的站对展开原文。内容变化产生新的资源 URL，不复用旧版路径。离线文件内嵌相同的压缩字节。
