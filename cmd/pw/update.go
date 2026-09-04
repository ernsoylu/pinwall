package main

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const repo = "ernsoylu/pinwall"
const maxDownload = 64 << 20

type release struct {
	Tag string `json:"tag_name"`
	URL string `json:"html_url"`
}

func runUpdate(check bool, stdout, stderr io.Writer) int {
	rel, err := latestRelease()
	if err != nil {
		fmt.Fprintln(stderr, "pw: checking for updates:", err)
		return 1
	}
	if !newer(version, rel.Tag) {
		fmt.Fprintf(stdout, "pw %s is already up to date (latest %s).\n", version, rel.Tag)
		return 0
	}
	fmt.Fprintf(stdout, "pw %s is available; you have %s.\n", rel.Tag, version)
	if check {
		fmt.Fprintln(stdout, rel.URL)
		return 0
	}

	archive, err := verifiedAsset(rel.Tag)
	if err != nil {
		fmt.Fprintln(stderr, "pw: download failed:", err)
		return 1
	}
	binary, err := extractBinary(archive)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 1
	}
	dest, err := os.Executable()
	if err != nil {
		fmt.Fprintln(stderr, "pw: cannot locate executable:", err)
		return 1
	}
	if resolved, e := filepath.EvalSymlinks(dest); e == nil {
		dest = resolved
	}
	if err := replace(dest, binary); err != nil {
		fmt.Fprintln(stderr, "pw: could not replace", dest+":", err)
		fmt.Fprintln(stderr, "reinstall: curl -fsSL --proto '=https' --proto-redir '=https' https://pw.pee.pw/r/pwsh001 | sh")
		return 1
	}
	fmt.Fprintf(stdout, "Updated to %s at %s\n", rel.Tag, dest)
	return 0
}

func secureClient() *http.Client {
	return &http.Client{Timeout: 60 * time.Second, CheckRedirect: secureRedirect}
}

func secureRedirect(req *http.Request, via []*http.Request) error {
	if req.URL.Scheme != "https" {
		return errors.New("refusing insecure redirect")
	}
	if len(via) >= 10 {
		return errors.New("too many redirects")
	}
	return nil
}
func getAsset(raw string) ([]byte, error) {
	res, err := secureClient().Get(raw)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, errors.New(res.Status)
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, maxDownload+1))
	if err == nil && len(b) > maxDownload {
		return nil, errors.New("response exceeds 64 MiB")
	}
	return b, err
}
func latestRelease() (release, error) {
	var r release
	b, err := getAsset("https://api.github.com/repos/" + repo + "/releases/latest")
	if err != nil {
		return r, err
	}
	err = json.Unmarshal(b, &r)
	if err == nil && r.Tag == "" {
		err = errors.New("release has no tag")
	}
	return r, err
}
func assetName(tag string) string {
	ext := "tar.gz"
	if runtime.GOOS == "windows" {
		ext = "zip"
	}
	return fmt.Sprintf("pw_%s_%s_%s.%s", strings.TrimPrefix(tag, "v"), runtime.GOOS, runtime.GOARCH, ext)
}
func verifiedAsset(tag string) ([]byte, error) {
	name := assetName(tag)
	base := "https://github.com/" + repo + "/releases/download/" + tag + "/"
	archive, err := getAsset(base + name)
	if err != nil {
		return nil, err
	}
	sums, err := getAsset(base + "checksums.txt")
	if err != nil {
		return nil, err
	}
	want, err := checksumFor(string(sums), name)
	if err != nil {
		return nil, err
	}
	got := sha256.Sum256(archive)
	if hex.EncodeToString(got[:]) != want {
		return nil, errors.New("checksum mismatch")
	}
	return archive, nil
}

func checksumFor(sums, name string) (string, error) {
	for _, line := range strings.Split(sums, "\n") {
		f := strings.Fields(line)
		if len(f) == 2 && f[1] == name {
			return f[0], nil
		}
	}
	return "", errors.New("asset missing from checksums.txt")
}

func extractBinary(data []byte) ([]byte, error) {
	if runtime.GOOS == "windows" {
		z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			return nil, err
		}
		if len(z.File) > 512 {
			return nil, errors.New("archive has too many entries")
		}
		for _, f := range z.File {
			if f.UncompressedSize64 > maxDownload {
				return nil, errors.New("archive entry too large")
			}
			if filepath.Base(f.Name) == "pw.exe" {
				r, e := f.Open()
				if e != nil {
					return nil, e
				}
				defer r.Close()
				return readBounded(r)
			}
		}
		return nil, errors.New("archive has no pw.exe")
	}
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for n := 0; n < 512; n++ {
		h, e := tr.Next()
		if errors.Is(e, io.EOF) {
			break
		}
		if e != nil {
			return nil, e
		}
		if h.Size > maxDownload {
			return nil, errors.New("archive entry too large")
		}
		if h.Typeflag == tar.TypeReg && filepath.Base(h.Name) == "pw" {
			return readBounded(tr)
		}
	}
	return nil, errors.New("archive has no pw")
}

func readBounded(r io.Reader) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(r, maxDownload+1))
	if err == nil && len(b) > maxDownload {
		err = errors.New("archive entry too large")
	}
	return b, err
}

func replace(dest string, binary []byte) error {
	info, err := os.Stat(dest)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dest), ".pw-update-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err = tmp.Write(binary); err == nil {
		err = tmp.Close()
	}
	if err == nil {
		err = os.Chmod(name, info.Mode().Perm())
	}
	if err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		old := dest + ".old"
		_ = os.Remove(old)
		if err = os.Rename(dest, old); err != nil {
			return err
		}
		if err = os.Rename(name, dest); err != nil {
			_ = os.Rename(old, dest)
			return err
		}
		_ = os.Remove(old)
		return nil
	}
	return os.Rename(name, dest)
}
func newer(current, tag string) bool {
	parse := func(s string) ([3]int, bool) {
		var v [3]int
		s = strings.TrimPrefix(strings.SplitN(strings.TrimSpace(s), "-", 2)[0], "v")
		p := strings.Split(s, ".")
		if len(p) < 1 {
			return v, false
		}
		for i := 0; i < 3 && i < len(p); i++ {
			n, e := strconv.Atoi(p[i])
			if e != nil {
				return v, false
			}
			v[i] = n
		}
		return v, true
	}
	c, ok := parse(current)
	t, tok := parse(tag)
	if !tok {
		return false
	}
	if !ok {
		return true
	}
	for i := range c {
		if t[i] != c[i] {
			return t[i] > c[i]
		}
	}
	return false
}
