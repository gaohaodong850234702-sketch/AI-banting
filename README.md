# AI伴听 V0.2 全真模拟版

独立于 `../AI伴听`（V0.1），独立端口、数据空间与模型配置。V0.1 不被覆盖。

## 启动

```sh
npm start
```

访问 http://127.0.0.1:4318/#journey 。首次在「设置与数据」填写大模型 API，启用后测试连接。

- 浏览器数据：`banting-demo-v2`；录音：IndexedDB `banting-media-v2`。
- API Key：`.local/model-config.json`，文件权限 0600，不进入前端或导出数据。
- 播客原音频：`.local/podcasts/`，仅本机体验，不包含在静态构建中。
- Whisper：`.venv-asr/` + `.local/asr-model/`，此副本独立安装。

## 真实体验

五期节目来自「以鹅传鹅FM」「鹅厂wò谈会」，元数据、原页、发布日期、SHA-256 在 `docs/真实音频来源.json`。来源为发布者在小宇宙公开页面提供的 PUBLIC 媒体，不绕过登录、付费或 DRM。推荐时间是节目章节导航，不是逐字稿。

从推荐片段开始或从头听 → 用语音/文字留下反应 → 本机 ASR 转写用户录音及触发前 90 秒的原音频 → 大模型理解记录 → 联系旧记录 → 提问 → 手动生成阶段回顾。原始个人记录从空白开始。

原始录音保留在浏览器；启用模型后，用户文字、相关历史和播客片段转写发往用户配置的服务商。用户选择启用才能调用。模型错误不会用预设答案替代。

## 模型接入

使用 Chat Completions 兼容接口。百炼复制控制台中间的「OpenAI 兼容地址」，格式为：

`https://你的业务空间.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`

模型名称为具体 ID，例如 `qwen-plus`。填写 `/api/v1` 时会为阿里云域名自动转换兼容路径。千问文本模型显式关闭深度思考以适配本版 JSON 工作流。按实际账户支持的模型与额度使用；本应用不改变控制台的「仅使用免费额度」设置。

DeepSeek 等其他兼容服务可用自己的 Base URL、模型 ID 和 Key。API Key 与服务商/地域应匹配；更换域名必须重新输入密钥。

官方参考：
- https://help.aliyun.com/zh/model-studio/base-url
- https://help.aliyun.com/zh/model-studio/qwen-plus
- https://api-docs.deepseek.com/guides/json_mode/

## 四条工作流

见 `docs/V0.2-工作流与体验方案.md`；共享及任务提示词在 `backend/workflows.mjs`。每条结论的原话引用由服务端检查。修订或删除记录后，依赖结果失效；失败可重试；用户可以纠正理解、确认或否定关联、评价问答与回顾。

前 80 条真实记录全部供语义比较，更多时用词项匹配与最近记录形成候选。当前没有向量数据库或微调。500 条以上须缩小范围。引用匹配只能防止伪造原话，不能证明模型判断正确。

## 检查与重建

```sh
npm test
npm run check
npm run build
npm run test:asr
```

`dist/` 仅前端文件，不含后端、密钥、播客与 ASR 模型；完整体验必须由 `npm start` 提供。

需要重新准备媒体：`npm run prepare:podcasts`（约 0.4 GB，依赖 curl）；重新安装 ASR：`npm run setup:asr`。原音频片段转写需要 PATH 中的 ffmpeg，或设置 `BANTING_FFMPEG`。

`tests/model.test.mjs` 和 `scripts/browser-contract-server.mjs` 使用明确标识的隔离协议测试服务，只验证传输、引用和界面链路，不能作为真实模型质量证据，也从不用于正常运行降级。
