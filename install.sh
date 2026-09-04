#!/bin/sh
set -eu

repo=ernsoylu/pinwall
install_dir=${PW_INSTALL_DIR:-"$HOME/.local/bin"}
die() { printf 'pw installer: %s\n' "$*" >&2; exit 1; }
fetch() { curl -fsSL --proto '=https' --proto-redir '=https' "$@"; }

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v tar >/dev/null 2>&1 || die "tar is required"
case $(uname -s) in Linux) os=linux;; Darwin) os=darwin;; FreeBSD) os=freebsd;; *) die "unsupported OS";; esac
case $(uname -m) in x86_64|amd64) arch=amd64;; aarch64|arm64) arch=arm64;; *) die "unsupported architecture";; esac

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
release=$(fetch "https://api.github.com/repos/$repo/releases/latest") || die "release lookup failed"
tag=$(printf '%s' "$release" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
[ -n "$tag" ] || die "release has no tag"
asset="pw_${tag#v}_${os}_${arch}.tar.gz"
base="https://github.com/$repo/releases/download/$tag"
fetch -o "$tmp/$asset" "$base/$asset" || die "download failed"
fetch -o "$tmp/checksums.txt" "$base/checksums.txt" || die "checksum download failed"
expected=$(awk -v asset="$asset" '$2 == asset { print $1 }' "$tmp/checksums.txt")
if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$tmp/$asset" | awk '{print $1}');
elif command -v shasum >/dev/null 2>&1; then actual=$(shasum -a 256 "$tmp/$asset" | awk '{print $1}');
else die "sha256sum or shasum is required"; fi
[ -n "$expected" ] && [ "$expected" = "$actual" ] || die "checksum mismatch"
tar -xzf "$tmp/$asset" -C "$tmp"
[ -f "$tmp/pw" ] || die "archive has no pw binary"
mkdir -p "$install_dir"
install -m 0755 "$tmp/pw" "$install_dir/pw" 2>/dev/null || { cp "$tmp/pw" "$install_dir/pw"; chmod 0755 "$install_dir/pw"; }
printf 'Installed pw %s to %s/pw\n' "$tag" "$install_dir"
