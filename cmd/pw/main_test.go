package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func withServer(t *testing.T, handler http.HandlerFunc) string {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	t.Setenv("PW_BASE_URL", srv.URL)
	// Never touch the developer's own saved tokens while testing.
	t.Setenv("PW_STATE_FILE", filepath.Join(t.TempDir(), "pins.json"))
	return srv.URL
}

func TestWriteReadAndAmend(t *testing.T) {
	var stored = "hello"
	base := withServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "POST" && r.URL.Path == "/api/write":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			stored = body["content"].(string)
			w.WriteHeader(http.StatusCreated)
			_, _ = io.WriteString(w, `{"id":"abc1234","edit_token":"token"}`)
		case r.Method == "GET" && r.URL.Path == "/api/pin/abc1234":
			_ = json.NewEncoder(w).Encode(map[string]string{"id": "abc1234", "content": stored})
		case r.Method == "PATCH" && r.URL.Path == "/api/pin/abc1234":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["edit_token"] != "token" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			stored = body["content"].(string)
			_, _ = io.WriteString(w, `{"id":"abc1234"}`)
		default:
			http.NotFound(w, r)
		}
	})

	var out, errOut bytes.Buffer
	if code := run([]string{"write", "--edit-url"}, strings.NewReader("first"), &out, &errOut); code != 0 {
		t.Fatalf("write code %d: %s", code, errOut.String())
	}
	if got := out.String(); got != base+"/abc1234#token\n" {
		t.Fatalf("write output %q", got)
	}

	out.Reset()
	if code := run([]string{"amend", "abc1234#token"}, strings.NewReader("second"), &out, &errOut); code != 0 {
		t.Fatalf("amend code %d: %s", code, errOut.String())
	}
	out.Reset()
	if code := run([]string{"abc1234"}, strings.NewReader(""), &out, &errOut); code != 0 {
		t.Fatalf("read code %d: %s", code, errOut.String())
	}
	if out.String() != "second" {
		t.Fatalf("read output %q", out.String())
	}
}

func TestEncryptionRoundTripAndWrongPass(t *testing.T) {
	sealed, iv, err := encrypt([]byte("秘密\n"), "correct")
	if err != nil {
		t.Fatal(err)
	}
	plain, err := decrypt(sealed, iv, "correct")
	if err != nil || string(plain) != "秘密\n" {
		t.Fatalf("round trip %q, %v", plain, err)
	}
	if _, err := decrypt(sealed, iv, "wrong"); err == nil {
		t.Fatal("wrong passphrase succeeded")
	}
}

func TestReadKeepsStdoutCleanOnError(t *testing.T) {
	withServer(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, `{"error":"not_found"}`)
	})
	var out, errOut bytes.Buffer
	if code := run([]string{"abc1234"}, strings.NewReader(""), &out, &errOut); code != 4 {
		t.Fatalf("code %d", code)
	}
	if out.Len() != 0 {
		t.Fatalf("stdout was %q", out.String())
	}
	if !strings.Contains(errOut.String(), "not_found") {
		t.Fatalf("stderr was %q", errOut.String())
	}
}

func TestWriteRetriesCollisionsAndSupportsOutputModes(t *testing.T) {
	calls := 0
	base := withServer(t, func(w http.ResponseWriter, _ *http.Request) {
		calls++
		if calls < 3 {
			w.WriteHeader(http.StatusConflict)
			_, _ = io.WriteString(w, `{"error":"id_taken"}`)
			return
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, `{"id":"abc1234","edit_token":"token"}`)
	})
	var retryOut, retryErr bytes.Buffer
	if code := run([]string{"write"}, strings.NewReader("x"), &retryOut, &retryErr); code != 0 || calls != 3 {
		t.Fatalf("collision retry: code=%d calls=%d err=%q", code, calls, retryErr.String())
	}
	for _, tc := range []struct{ option, want string }{
		{"", "abc1234\n"}, {"--url", base + "/abc1234\n"}, {"--edit-url", base + "/abc1234#token\n"},
	} {
		calls = 2
		args := []string{"write"}
		if tc.option != "" {
			args = append(args, tc.option)
		}
		var out, errOut bytes.Buffer
		if code := run(args, strings.NewReader("x"), &out, &errOut); code != 0 || out.String() != tc.want {
			t.Fatalf("%s: code=%d out=%q err=%q", tc.option, code, out.String(), errOut.String())
		}
	}
}

func TestWriteJSONExpiryAndLimits(t *testing.T) {
	withServer(t, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if _, ok := body["expires_at"]; !ok {
			t.Error("missing expiry")
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, `{"id":"abc1234","edit_token":"token"}`)
	})
	var out, errOut bytes.Buffer
	if code := run([]string{"write", "--expires", "2d", "--json"}, strings.NewReader("x"), &out, &errOut); code != 0 {
		t.Fatalf("code=%d %s", code, errOut.String())
	}
	var got map[string]string
	if err := json.Unmarshal(out.Bytes(), &got); err != nil || got["tag"] != "abc1234" || got["edit_url"] == "" {
		t.Fatalf("json=%q err=%v", out.String(), err)
	}
	out.Reset()
	errOut.Reset()
	if code := run([]string{"write"}, strings.NewReader(strings.Repeat("x", 262145)), &out, &errOut); code != 2 || out.Len() != 0 {
		t.Fatalf("oversize code=%d out=%q", code, out.String())
	}
	if code := run([]string{"write", "--expires", "bad"}, strings.NewReader("x"), &out, &errOut); code != 2 {
		t.Fatalf("bad expiry code=%d", code)
	}
}

func TestEncryptedReadThroughCLI(t *testing.T) {
	sealed, iv, err := encrypt([]byte("secret"), "correct")
	if err != nil {
		t.Fatal(err)
	}
	withServer(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"id": "abc1234", "ciphertext": sealed, "iv": iv})
	})
	var out, errOut bytes.Buffer
	if code := run([]string{"abc1234"}, strings.NewReader(""), &out, &errOut); code != 3 || out.Len() != 0 {
		t.Fatalf("missing pass code=%d out=%q", code, out.String())
	}
	out.Reset()
	errOut.Reset()
	if code := run([]string{"abc1234", "--pass", "correct"}, strings.NewReader(""), &out, &errOut); code != 0 || out.String() != "secret" {
		t.Fatalf("decrypt code=%d out=%q err=%q", code, out.String(), errOut.String())
	}
}

func TestExitCodesAndOptionValidation(t *testing.T) {
	for _, tc := range []struct {
		args []string
		want int
	}{
		{nil, 2}, {[]string{"bad"}, 2}, {[]string{"write", "--wat"}, 2},
		{[]string{"amend"}, 2}, {[]string{"update", "--wat"}, 2},
	} {
		var out, errOut bytes.Buffer
		if got := run(tc.args, strings.NewReader("x"), &out, &errOut); got != tc.want {
			t.Errorf("run(%v)=%d want %d", tc.args, got, tc.want)
		}
	}
}

// Rejection sampling means every letter has to stay reachable: a mangled bound
// would silently narrow the alphabet and cost collision headroom.
func TestNewIDCoversTheAlphabetUnbiased(t *testing.T) {
	seen := map[rune]int{}
	const draws = 5000
	for i := 0; i < draws; i++ {
		id, err := newID()
		if err != nil {
			t.Fatal(err)
		}
		if _, err := idFrom(id); err != nil {
			t.Fatalf("newID produced an invalid tag %q", id)
		}
		for _, c := range id {
			seen[c]++
		}
	}
	if len(seen) != len(alphabet) {
		t.Fatalf("newID reached %d of %d letters", len(seen), len(alphabet))
	}
	// 35k draws over 62 letters averages ~565 each; a modulo bias showed up as
	// roughly 25% extra on the first eight, so this catches it with huge margin.
	expected := draws * 7 / len(alphabet)
	for c, n := range seen {
		if n < expected/2 || n > expected*2 {
			t.Fatalf("letter %q appeared %d times, expected near %d", c, n, expected)
		}
	}
}

// The whole point of the store: a plain `pw write` keeps the one-shot edit
// token, so `pw amend TAG` works later without the user having saved it.
func TestSavedTokenPowersAmendListAndForget(t *testing.T) {
	stored := "first"
	withServer(t, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch r.Method {
		case "POST":
			w.WriteHeader(http.StatusCreated)
			_, _ = io.WriteString(w, `{"id":"abc1234","edit_token":"token"}`)
		case "PATCH":
			if body["edit_token"] != "token" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			stored = body["content"].(string)
			_, _ = io.WriteString(w, `{"id":"abc1234"}`)
		}
	})
	var out, errOut bytes.Buffer
	if code := run([]string{"write"}, strings.NewReader("first"), &out, &errOut); code != 0 {
		t.Fatalf("write code %d: %s", code, errOut.String())
	}
	out.Reset()
	if code := run([]string{"amend", "abc1234"}, strings.NewReader("second"), &out, &errOut); code != 0 {
		t.Fatalf("amend without token: code %d: %s", code, errOut.String())
	}
	if stored != "second" {
		t.Fatalf("server stored %q", stored)
	}
	out.Reset()
	if code := run([]string{"list"}, strings.NewReader(""), &out, &errOut); code != 0 ||
		!strings.Contains(out.String(), "abc1234") || !strings.Contains(out.String(), "#token") {
		t.Fatalf("list out=%q", out.String())
	}
	out.Reset()
	if code := run([]string{"forget", "abc1234"}, strings.NewReader(""), &out, &errOut); code != 0 {
		t.Fatalf("forget code %d", code)
	}
	if code := run([]string{"amend", "abc1234"}, strings.NewReader("third"), &out, &errOut); code != 2 {
		t.Fatalf("amend after forget code %d", code)
	}
	if stored != "second" {
		t.Fatalf("forgotten pin was still amended: %q", stored)
	}
	// --no-save must leave nothing behind.
	if code := run([]string{"write", "--no-save"}, strings.NewReader("x"), &out, &errOut); code != 0 {
		t.Fatal(errOut.String())
	}
	if _, ok := savedPin("abc1234"); ok {
		t.Fatal("--no-save still saved the token")
	}
}

func TestWriteFromFilePicksLanguageAndAliases(t *testing.T) {
	var seen string
	withServer(t, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		seen, _ = body["language"].(string)
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, `{"id":"abc1234","edit_token":"token"}`)
	})
	file := filepath.Join(t.TempDir(), "notes.md")
	if err := os.WriteFile(file, []byte("# hi\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	var out, errOut bytes.Buffer
	if code := run([]string{"write", file}, strings.NewReader(""), &out, &errOut); code != 0 || seen != "markdown" {
		t.Fatalf("file write code=%d language=%q err=%q", code, seen, errOut.String())
	}
	if code := run([]string{"write", file, "-l", "shell"}, strings.NewReader(""), &out, &errOut); code != 0 || seen != "bash" {
		t.Fatalf("alias language=%q", seen)
	}
	if code := run([]string{"write"}, strings.NewReader("plain"), &out, &errOut); code != 0 || seen != "text" {
		t.Fatalf("stdin default language=%q", seen)
	}
}

func TestInfoOutputFileAndPassphraseSources(t *testing.T) {
	sealed, iv, err := encrypt([]byte("secret"), "hunter2")
	if err != nil {
		t.Fatal(err)
	}
	withServer(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id": "abc1234", "ciphertext": sealed, "iv": iv,
			"language": "markdown", "created_at": "2026-09-13T18:02:22Z",
		})
	})
	var out, errOut bytes.Buffer
	if code := run([]string{"info", "abc1234"}, strings.NewReader(""), &out, &errOut); code != 0 {
		t.Fatalf("info code %d: %s", code, errOut.String())
	}
	for _, want := range []string{"abc1234", "markdown", "never", "yes"} {
		if !strings.Contains(out.String(), want) {
			t.Fatalf("info missing %q in %q", want, out.String())
		}
	}
	pass := filepath.Join(t.TempDir(), "pass")
	if err := os.WriteFile(pass, []byte("hunter2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(t.TempDir(), "out.txt")
	out.Reset()
	code := run([]string{"read", "abc1234", "--pass-file", pass, "-o", target}, strings.NewReader(""), &out, &errOut)
	if code != 0 || out.Len() != 0 {
		t.Fatalf("read -o code=%d out=%q err=%q", code, out.String(), errOut.String())
	}
	if b, err := os.ReadFile(target); err != nil || string(b) != "secret" {
		t.Fatalf("output file %q %v", b, err)
	}
	t.Setenv("PW_PASS", "hunter2")
	out.Reset()
	if code := run([]string{"abc1234", "--pass-env", "PW_PASS"}, strings.NewReader(""), &out, &errOut); code != 0 || out.String() != "secret" {
		t.Fatalf("--pass-env out=%q", out.String())
	}
	out.Reset()
	if code := run([]string{"abc1234", "--pass-env", "PW_MISSING"}, strings.NewReader(""), &out, &errOut); code != 2 {
		t.Fatalf("missing env var code %d", code)
	}
}

func TestHelpMenusAndSubmenus(t *testing.T) {
	var out, errOut bytes.Buffer
	if code := run([]string{"help"}, strings.NewReader(""), &out, &errOut); code != 0 {
		t.Fatalf("help code %d", code)
	}
	for _, want := range []string{"commands:", "help topics:", "amend", "encryption"} {
		if !strings.Contains(out.String(), want) {
			t.Fatalf("root help missing %q", want)
		}
	}
	for _, args := range [][]string{{"help", "write"}, {"write", "--help"}, {"write", "-h"}} {
		out.Reset()
		if code := run(args, strings.NewReader(""), &out, &errOut); code != 0 ||
			!strings.Contains(out.String(), "--edit-url") {
			t.Fatalf("%v: code=%d out=%q", args, code, out.String())
		}
	}
	out.Reset()
	if code := run([]string{"help", "editing"}, strings.NewReader(""), &out, &errOut); code != 0 ||
		!strings.Contains(out.String(), "pins.json") {
		t.Fatalf("topic help out=%q", out.String())
	}
	out.Reset()
	errOut.Reset()
	if code := run([]string{"help", "nonsense"}, strings.NewReader(""), &out, &errOut); code != 2 ||
		!strings.Contains(errOut.String(), "available:") {
		t.Fatalf("unknown topic code=%d err=%q", code, errOut.String())
	}
	// Every command and topic advertised by the root menu must resolve.
	for _, list := range [][]topic{commands, topics} {
		for _, tp := range list {
			out.Reset()
			if code := run([]string{"help", tp.name}, strings.NewReader(""), &out, &errOut); code != 0 || out.Len() == 0 {
				t.Errorf("help %s: code=%d", tp.name, code)
			}
		}
	}
}
