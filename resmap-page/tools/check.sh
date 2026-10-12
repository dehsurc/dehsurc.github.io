#!/bin/sh
# Every check the page has, with a real exit status. Piping a check through
# tail or head hands back the pager's status instead of the check's, which is
# how a broken harness once went out with a push behind it.
#
#     sh tools/check.sh && git push
dir=$(dirname "$0")
status=0
for c in check-numbers check-drive check-video check-title; do
  if out=$(node "$dir/$c.js" 2>&1); then
    echo "pass  $c ($(printf '%s\n' "$out" | grep -c '^  ok') checks)"
  else
    echo "FAIL  $c"
    printf '%s\n' "$out" | grep -A3 -E 'FAIL|Error' | head -40
    status=1
  fi
done
exit $status
