#!/bin/sh
# Committed copies of QA screenshots: JPEG q70 next to each PNG (PNGs stay local, gitignored).
for dir in "$@"; do
  for f in "$dir"/*.png; do
    [ -e "$f" ] || continue
    out="${f%.png}.jpg"
    [ "$out" -nt "$f" ] && continue
    sips -s format jpeg -s formatOptions 70 "$f" --out "$out" >/dev/null
  done
done
