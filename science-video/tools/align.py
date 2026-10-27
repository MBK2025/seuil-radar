import re, json, subprocess, sys
# usage : python3 align.py script.txt voix.mp3 words.json
# Markup du script : *mot* = mot accentué (jaune), ^MOT^ = mot géant, mot[5] = forcer 5 syllabes (nombres, sigles).

# Markup: *italique*  ^GRAS^  _souligné_
TEXT = open(sys.argv[1], encoding="utf-8").read().strip()

def parse(text):
    out = []
    for raw in text.split():
        style = None
        w = raw
        for mark, st in (("*", "italic"), ("^", "bold"), ("_", "under")):
            if w.startswith(mark) and w.endswith(mark) and len(w) > 1:
                style, w = st, w[1:-1]
        m = re.match(r"^(.*)\[(\d+)\]([.,:;!?…]*)$", w)
        forced = None
        if m:
            w, forced = m.group(1) + m.group(3), int(m.group(2))
        if w in (":", "?", "!", ";") and out:  # ponctuation isolée -> collée au mot précédent
            out[-1]["w"] += " " + w
            continue
        out.append({"w": w, "style": style, "forced": forced})
    return out

def syl(w):
    d = re.sub(r"[^0-9]", "", w)
    if d:
        try:
            from num2words import num2words
            return max(1, len(re.findall(r"[aeiouyàâéèêëîïôûùœ]+", num2words(int(d), lang="fr"))))
        except Exception:
            return 2 * len(d)
    w = w.lower()
    w = re.sub(r"e(s)?$", "", w) or w
    n = len(re.findall(r"[aeiouyàâéèêëîïôûùœ]+", w))
    return max(1, n)

words = parse(TEXT)
for x in words:
    x["syl"] = x.pop("forced") or syl(x["w"])

# segments de parole (entre silences)
log = subprocess.run(["ffmpeg", "-i", sys.argv[2], "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r"silence_start: ([0-9.]+)", log)]
en = [float(v) for v in re.findall(r"silence_end: ([0-9.]+)", log)]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sys.argv[2]],
                           capture_output=True, text=True).stdout)
segs, cur = [], 0.0
for s, e in zip(st, en):
    if s - cur > 0.15:
        segs.append((cur, s))
    cur = e
if dur - cur > 0.15:
    segs.append((cur, dur))

# frontières possibles = après un mot ponctué
breaks = [i + 1 for i, x in enumerate(words) if re.search(r"[,.:?…]$|\.\.\.$", x["w"].rstrip(" "))]
if breaks[-1] != len(words):
    breaks.append(len(words))
cand = list(range(len(words) + 1))
bset = set(breaks)

S = len(segs)
pref = [0]
for x in words:
    pref.append(pref[-1] + x["syl"])
rate = pref[-1] / sum(e - s for s, e in segs)

# DP : découper les mots en S groupes, chaque frontière sur un point de ponctuation
INF = 1e18
C = len(cand)
dp = [[INF] * C for _ in range(S + 1)]
bk = [[-1] * C for _ in range(S + 1)]
dp[0][0] = 0
for k in range(1, S + 1):
    d = segs[k - 1][1] - segs[k - 1][0]
    for j in range(1, C):
        for i in range(j):
            if dp[k - 1][i] >= INF:
                continue
            sy = pref[cand[j]] - pref[cand[i]]
            if sy == 0:
                continue
            cost = (sy / rate - d) ** 2 / max(d, 0.3)
            if cand[j] not in bset and cand[j] != len(words):
                cost += 0.35  # coupure hors ponctuation
            # ponctuation forte à l'intérieur du segment
            cost += 0.25 * sum(1 for q in range(cand[i] + 1, cand[j]) if q in bset)
            if dp[k - 1][i] + cost < dp[k][j]:
                dp[k][j] = dp[k - 1][i] + cost
                bk[k][j] = i
j = C - 1
bounds = []
for k in range(S, 0, -1):
    i = bk[k][j]
    bounds.append((cand[i], cand[j]))
    j = i
bounds.reverse()

for si, ((a, b), (s, e)) in enumerate(zip(bounds, segs)):
    tot = pref[b] - pref[a]
    t = s
    for wi in range(a, b):
        d = (e - s) * words[wi]["syl"] / tot
        words[wi].update(s=round(t, 3), e=round(t + d, 3), seg=si)
        t += d
    print(f"{s:6.2f}-{e:6.2f}  " + " ".join(w["w"] for w in words[a:b]), file=sys.stderr)

json.dump({"duration": dur, "words": words}, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
