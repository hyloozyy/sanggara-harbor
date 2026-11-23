#!/bin/sh
# Re-renders every screenshot listed in shots.json into screenshots/ (real renders of the game).
cd "$(dirname "$0")/.." || exit 1
node -e "for (const s of require('./shots.json')) console.log(s.name + ' ' + s.query)" | while read -r name query; do
  node tools/capture.mjs "$query" "screenshots/$name" 900 86 | grep -v '^\[console\] log info'
done
ls -la screenshots
