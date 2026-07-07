#!/usr/bin/env python3
"""
Pre-render every spoken clip in the exam content banks with the Studio (Piper)
voices, once, at build time -> bundled MP3s the app plays instantly.

Spoken content (the ONLY text the app ever sends to TTS):
  - src/data/sentences.json      -> Listen and Type sentences
  - src/data/conversations.json  -> Interactive Listening spoken turns
  - src/data/speaking.json       -> Interactive Speaking questions (.interactive)

Every string is rendered in BOTH the female and male voice so that whichever
speaker the app picks at runtime, the clip exists. Output:
  public/voices/<key>.mp3        one file per (text, gender)
  src/data/voicePack.json        manifest: [key, ...]

`key` MUST match packKey() in src/lib/tts.js:  hash of (gender + text),
h = 7; h = (h*31 + charCode) mod 2^32; hex.

Usage:  python scripts/render-voices.py
Requires:  pip install piper-tts lameenc   and models in build/piper/
"""
import json, os, sys, io, wave
from pathlib import Path
from piper import PiperVoice
import lameenc

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src' / 'data'
OUT = ROOT / 'public' / 'voices'
MODELS = ROOT / 'build' / 'piper'
BITRATE = 48  # kbps, mono speech — small but clear

def load_json(name):
    with open(DATA / name, encoding='utf-8') as f:
        return json.load(f)

def pack_key(text, gender):
    h = 7
    for ch in (gender + text):
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return format(h, 'x')

def spoken_strings():
    out = set()
    for s in load_json('sentences.json'):
        if s.get('text'): out.add(s['text'].strip())
    for c in load_json('conversations.json'):
        # new schema: full scenario dialogue (both speakers) is spoken in Part A,
        # and each round's `audio` (a subset) is spoken again in Part B
        for t in c.get('dialogue', []):
            if t.get('text'): out.add(t['text'].strip())
        for t in c.get('turns', []):  # backward-compat
            if t.get('text'): out.add(t['text'].strip())
    sp = load_json('speaking.json')
    for it in sp.get('interactive', []):
        for q in it.get('questions', []):
            if isinstance(q, str) and q.strip(): out.add(q.strip())
    return sorted(out)

def synth_pcm(voice, text):
    chunks = list(voice.synthesize(text))
    pcm = b''.join(c.audio_int16_bytes for c in chunks)
    sr = chunks[0].sample_rate if chunks else 22050
    return pcm, sr

def to_mp3(pcm, sr):
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    strings = spoken_strings()
    print(f'{len(strings)} unique spoken strings -> {len(strings)*2} clips (both voices)')
    voices = {
        'female': PiperVoice.load(str(MODELS / 'fem.onnx'), str(MODELS / 'fem.onnx.json')),
        'male':   PiperVoice.load(str(MODELS / 'mal.onnx'), str(MODELS / 'mal.onnx.json')),
    }
    manifest, total_bytes, n = [], 0, 0
    for gender, voice in voices.items():
        for text in strings:
            key = pack_key(text, gender)
            path = OUT / f'{key}.mp3'
            pcm, sr = synth_pcm(voice, text)
            mp3 = to_mp3(pcm, sr)
            path.write_bytes(mp3)
            manifest.append(key)
            total_bytes += len(mp3)
            n += 1
            if n % 50 == 0:
                print(f'  {n}/{len(strings)*2}  ({total_bytes/1e6:.1f} MB)')
    manifest = sorted(set(manifest))
    with open(DATA / 'voicePack.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f)
    print(f'DONE: {n} clips, {total_bytes/1e6:.1f} MB total, {len(manifest)} manifest keys')

if __name__ == '__main__':
    main()
