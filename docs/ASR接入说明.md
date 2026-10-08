# 免费本机 ASR 接入说明

ASR（Automatic Speech Recognition）即自动语音识别，也常称为语音转文字（Speech-to-Text / STT）。

此次接入使用多语言 Whisper small 模型及 faster-whisper 的 CPU int8 推理。依赖安装在项目的 `.venv-asr/` 中，模型位于 `.local/asr-model/`，均不纳入源码提交。模型下载来自官方 Hugging Face 仓库，并校验模型文件 SHA-256。

## 用户流程

1. 点击或长按「说说我的想法」，允许浏览器使用麦克风。
2. 原音频暂停，录制真实语音。
3. 结束录音后，先保存原始录音，恢复之前的播放状态。
4. 本机 ASR 将录音转成中文，界面显示处理状态。也可关闭窗口让识别在后台完成。
5. 识别完成后展示文字、原始录音、关联上下文及本地规则整理结果。
6. 识别失败或没有清晰语音时保留原始录音，可重新识别或手工补充文字。
7. 重新识别已有文字会先提示其影响；首次保存的文字不会被后续识别覆盖。

## 范围与数据

- 模型与软件开源，无计次费用，无需 API Key。仅首次安装需要联网下载模型。
- 录音发送到 `127.0.0.1` 上的本机服务，在这台 Mac 上识别，不上传云端。
- 本机服务只接受本页同源请求，录音处理完后删除临时文件。
- 原始录音继续由浏览器 IndexedDB 保存；文字与识别状态继续由 localStorage 保存。
- 固定识别中文，每条不超过 3 分钟，接口最大 12 MB。
- 此次接入的是用户思考录音的 ASR；导入音频的整段转写与生成式 AI 解读仍未实现。
- 识别不是逐字准确保证，口音、噪声与很短的录音会影响结果。可以修订文字，回听原始语音。
- 仅托管 `dist/` 静态页面不能调用本机 ASR，需要运行项目服务器。

## 安装与启动

当前工作区已安装。启动：

```sh
npm run dev
```

新机器先安装 Node.js、uv、curl，再运行：

```sh
npm run setup:asr
npm run dev
```

检查：`GET /api/asr/status`。转写：`POST /api/asr/transcribe`，请求体为音频二进制，Content-Type 为实际音频类型。

来源：[faster-whisper](https://github.com/SYSTRAN/faster-whisper)、[Whisper small 转换模型](https://huggingface.co/Systran/faster-whisper-small)。
