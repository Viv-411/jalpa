#!/bin/sh
# Runs a command with the Firebase Auth + Firestore emulators up.
# Uses the portable Java runtime in .tools/ if one is there.
cd "$(dirname "$0")/.."
for jre in .tools/jdk-*/Contents/Home/bin .tools/jdk-*/bin; do
  [ -d "$jre" ] && PATH="$PWD/$jre:$PATH"
done
export PATH
exec npx firebase emulators:exec --only auth,firestore --project "${JALPA_PROJECT:-debate-app-411}" "$*"
