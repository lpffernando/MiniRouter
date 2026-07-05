"""
视频语音转写脚本 — 用 faster-whisper 把音频转成文字
用法: python transcribe.py <audio.mp3> [model_size]
输出转写文本到 stdout,同时写到 <audio>.txt
"""
import sys
import os
import json

def main():
    if len(sys.argv) < 2:
        print("用法: python transcribe.py <audio> [model_size]")
        sys.exit(1)

    audio = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "medium"
    if not os.path.exists(audio):
        print(f"错误: 文件不存在 {audio}")
        sys.exit(1)

    print(f"加载模型 {model_size}(首次会下载,约几百MB)...", file=sys.stderr)
    from faster_whisper import WhisperModel
    # device="cuda" 用 GPU,compute_type="float16" 省显存
    try:
        model = WhisperModel(model_size, device="cuda", compute_type="float16")
    except Exception as e:
        print(f"GPU 加载失败,回退 CPU: {e}", file=sys.stderr)
        model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"转写 {audio}...", file=sys.stderr)
    segments, info = model.transcribe(audio, language="zh", beam_size=5, vad_filter=True)

    print(f"检测语言: {info.language}, 概率: {info.language_probability:.2f}", file=sys.stderr)
    print(f"音频时长: {info.duration:.1f}s", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    text_parts = []
    for seg in segments:
        line = f"[{seg.start:.1f}-{seg.end:.1f}] {seg.text.strip()}"
        print(line)
        text_parts.append(seg.text.strip())

    # 写到文件
    out_txt = audio + ".txt"
    with open(out_txt, "w", encoding="utf-8") as f:
        f.write("\n".join(text_parts))
    print(f"\n=== 转写完成,写到 {out_txt} ===", file=sys.stderr)

if __name__ == "__main__":
    main()
