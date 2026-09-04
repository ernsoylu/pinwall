package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestNewer(t *testing.T) {
	for _, tc := range []struct {
		current, latest string
		want            bool
	}{
		{"1.0.0", "v1.0.1", true}, {"v1.2.0", "v1.1.9", false},
		{"dev", "v1.0.0", true}, {"1.0.0", "not-a-version", false},
	} {
		if got := newer(tc.current, tc.latest); got != tc.want {
			t.Errorf("newer(%q,%q)=%v", tc.current, tc.latest, got)
		}
	}
}

func TestChecksumAndSecureRedirect(t *testing.T) {
	if got, err := checksumFor("aaa  other\nbbb  wanted\n", "wanted"); err != nil || got != "bbb" {
		t.Fatalf("checksum=%q err=%v", got, err)
	}
	if _, err := checksumFor("aaa  other\n", "wanted"); err == nil {
		t.Fatal("missing checksum accepted")
	}
	req, _ := http.NewRequest("GET", "http://example.com", nil)
	if secureRedirect(req, nil) == nil {
		t.Fatal("HTTP redirect accepted")
	}
	req.URL.Scheme = "https"
	if secureRedirect(req, make([]*http.Request, 10)) == nil {
		t.Fatal("redirect loop accepted")
	}
}

func TestExtractBinaryAndBounds(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("tar fixture")
	}
	makeArchive := func(name string, size int64, content []byte) []byte {
		var buf bytes.Buffer
		gz := gzip.NewWriter(&buf)
		tw := tar.NewWriter(gz)
		_ = tw.WriteHeader(&tar.Header{Name: name, Mode: 0755, Size: size, Typeflag: tar.TypeReg})
		if int64(len(content)) == size {
			_, _ = tw.Write(content)
			_ = tw.Close()
		}
		_ = gz.Close()
		return buf.Bytes()
	}
	binary, err := extractBinary(makeArchive("pw", 3, []byte("new")))
	if err != nil || string(binary) != "new" {
		t.Fatalf("binary=%q err=%v", binary, err)
	}
	if _, err := extractBinary(makeArchive("LICENSE", 3, []byte("MIT"))); err == nil {
		t.Fatal("missing binary accepted")
	}
	if _, err := extractBinary(makeArchive("pw", maxDownload+1, nil)); err == nil {
		t.Fatal("oversized entry accepted")
	}
}

func TestReplacePreservesMode(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "pw")
	if err := os.WriteFile(dest, []byte("old"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := replace(dest, []byte("new")); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(dest)
	info, _ := os.Stat(dest)
	if string(b) != "new" || info.Mode().Perm() != 0700 {
		t.Fatalf("content=%q mode=%o", b, info.Mode().Perm())
	}
}
