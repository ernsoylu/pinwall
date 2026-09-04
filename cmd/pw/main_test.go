package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func withServer(t *testing.T, handler http.HandlerFunc) string {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	t.Setenv("PW_BASE_URL", srv.URL)
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
