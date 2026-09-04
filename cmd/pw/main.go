package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultBase = "https://pw.pee.pw"
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

var version = "dev"

type options struct {
	pass, language, expires, tag string
	url, editURL, json           bool
}

type pin struct {
	ID, Content, Ciphertext, IV, Language, CreatedAt, ExpiresAt string
	EditToken                                                   string `json:"edit_token"`
}

func (p *pin) UnmarshalJSON(b []byte) error {
	type wire struct {
		ID, Content, Ciphertext, IV, Language string
		CreatedAt                             string `json:"created_at"`
		ExpiresAt                             string `json:"expires_at"`
		EditToken                             string `json:"edit_token"`
	}
	var w wire
	if err := json.Unmarshal(b, &w); err != nil {
		return err
	}
	*p = pin{w.ID, w.Content, w.Ciphertext, w.IV, w.Language, w.CreatedAt, w.ExpiresAt, w.EditToken}
	return nil
}

func main() { os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr)) }

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "usage: pw TAG [--pass SECRET] | pw write [options] | pw amend TAG#TOKEN [options]")
		return 2
	}
	if args[0] == "update" {
		if len(args) > 2 || (len(args) == 2 && args[1] != "--check") {
			fmt.Fprintln(stderr, "usage: pw update [--check]")
			return 2
		}
		return runUpdate(len(args) == 2, stdout, stderr)
	}
	if args[0] == "--version" || args[0] == "version" {
		fmt.Fprintf(stdout, "pw %s\n", version)
		return 0
	}
	command, target := "read", args[0]
	start := 1
	if args[0] == "write" {
		command, target = "write", ""
	} else if args[0] == "amend" {
		command = "amend"
		if len(args) < 2 {
			fmt.Fprintln(stderr, "pw: amend requires TAG#EDIT_TOKEN")
			return 2
		}
		target, start = args[1], 2
	}
	opts, err := parseOptions(args[start:])
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	if command == "read" {
		return readPin(target, opts, stdout, stderr)
	}
	body, err := io.ReadAll(io.LimitReader(stdin, 262145))
	if err != nil {
		fmt.Fprintln(stderr, "pw: reading stdin:", err)
		return 1
	}
	if len(body) == 0 {
		fmt.Fprintln(stderr, "pw: stdin is empty")
		return 2
	}
	if len(body) > 262144 {
		fmt.Fprintln(stderr, "pw: input exceeds 256 KiB")
		return 2
	}
	if command == "write" {
		return writePin(body, opts, stdout, stderr)
	}
	return amendPin(target, body, opts, stdout, stderr)
}

func parseOptions(args []string) (options, error) {
	o := options{language: "text"}
	for i := 0; i < len(args); i++ {
		value := func(name string) (string, error) {
			if i+1 >= len(args) {
				return "", fmt.Errorf("%s requires a value", name)
			}
			i++
			return args[i], nil
		}
		var err error
		switch args[i] {
		case "--pass":
			o.pass, err = value(args[i])
		case "--language", "-l":
			o.language, err = value(args[i])
		case "--expires":
			o.expires, err = value(args[i])
		case "--tag":
			o.tag, err = value(args[i])
		case "--url":
			o.url = true
		case "--edit-url":
			o.editURL = true
		case "--json":
			o.json = true
		default:
			return o, fmt.Errorf("unknown option %s", args[i])
		}
		if err != nil {
			return o, err
		}
	}
	return o, nil
}

func baseURL() string {
	if s := os.Getenv("PW_BASE_URL"); s != "" {
		return strings.TrimRight(s, "/")
	}
	return defaultBase
}
func idFrom(s string) (string, error) {
	u, err := url.Parse(s)
	if err == nil && u.Host != "" {
		s = strings.Trim(strings.TrimPrefix(u.Path, "/r/"), "/")
	}
	if i := strings.IndexByte(s, '#'); i >= 0 {
		s = s[:i]
	}
	if len(s) < 5 || len(s) > 7 {
		return "", errors.New("invalid tag")
	}
	for _, c := range s {
		if !strings.ContainsRune(alphabet+"_-", c) {
			return "", errors.New("invalid tag")
		}
	}
	return s, nil
}

func request(method, path string, body any) (*http.Response, error) {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(context.Background(), method, baseURL()+path, r)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("content-type", "application/json")
	}
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if req.URL.Scheme != "https" && !strings.HasPrefix(baseURL(), "http://127.0.0.1") {
			return errors.New("refusing insecure redirect")
		}
		return nil
	}}
	return client.Do(req)
}

func readPin(target string, o options, stdout, stderr io.Writer) int {
	id, err := idFrom(target)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	res, err := request("GET", "/api/pin/"+id, nil)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 1
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return apiFailure(res, stderr)
	}
	var p pin
	if err := json.NewDecoder(res.Body).Decode(&p); err != nil {
		fmt.Fprintln(stderr, "pw: invalid server response")
		return 1
	}
	content := []byte(p.Content)
	if p.Ciphertext != "" {
		if o.pass == "" {
			fmt.Fprintln(stderr, "pw: pin is encrypted; supply --pass")
			return 3
		}
		content, err = decrypt(p.Ciphertext, p.IV, o.pass)
		if err != nil {
			fmt.Fprintln(stderr, "pw: wrong passphrase or damaged pin")
			return 3
		}
	}
	_, err = stdout.Write(content)
	if err != nil {
		fmt.Fprintln(stderr, "pw: writing stdout:", err)
		return 1
	}
	return 0
}

func writePin(content []byte, o options, stdout, stderr io.Writer) int {
	data := map[string]any{"language": o.language}
	if o.expires != "" {
		expiry, err := parseExpiry(o.expires)
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 2
		}
		data["expires_at"] = expiry
	}
	if o.pass != "" {
		sealed, iv, err := encrypt(content, o.pass)
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 1
		}
		data["ciphertext"], data["iv"] = sealed, iv
	} else {
		data["content"] = string(content)
	}
	for tries := 0; tries < 3; tries++ {
		id, err := newID()
		if o.tag != "" {
			id, err = idFrom(o.tag)
		}
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 1
		}
		data["id"] = id
		res, err := request("POST", "/api/write", data)
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 1
		}
		if res.StatusCode == 409 && o.tag == "" {
			res.Body.Close()
			continue
		}
		if res.StatusCode != 201 {
			code := apiFailure(res, stderr)
			res.Body.Close()
			return code
		}
		var result pin
		err = json.NewDecoder(res.Body).Decode(&result)
		res.Body.Close()
		if err != nil {
			fmt.Fprintln(stderr, "pw: invalid server response")
			return 1
		}
		return printCreated(result, o, stdout)
	}
	fmt.Fprintln(stderr, "pw: could not allocate a tag")
	return 1
}

func amendPin(target string, content []byte, o options, stdout, stderr io.Writer) int {
	i := strings.LastIndexByte(target, '#')
	if i < 0 || i == len(target)-1 {
		fmt.Fprintln(stderr, "pw: amend requires TAG#EDIT_TOKEN")
		return 2
	}
	id, err := idFrom(target[:i])
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	data := map[string]any{"edit_token": target[i+1:]}
	if o.pass != "" {
		sealed, iv, err := encrypt(content, o.pass)
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 1
		}
		data["ciphertext"], data["iv"] = sealed, iv
	} else {
		data["content"] = string(content)
	}
	res, err := request("PATCH", "/api/pin/"+id, data)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 1
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return apiFailure(res, stderr)
	}
	fmt.Fprintln(stdout, id)
	return 0
}

func printCreated(p pin, o options, out io.Writer) int {
	share := baseURL() + "/" + p.ID
	edit := share + "#" + p.EditToken
	if o.json {
		_ = json.NewEncoder(out).Encode(map[string]string{"tag": p.ID, "url": share, "edit_url": edit})
		return 0
	}
	if o.editURL {
		fmt.Fprintln(out, edit)
	} else if o.url {
		fmt.Fprintln(out, share)
	} else {
		fmt.Fprintln(out, p.ID)
	}
	return 0
}

func apiFailure(res *http.Response, stderr io.Writer) int {
	var e struct {
		Error string `json:"error"`
	}
	_ = json.NewDecoder(io.LimitReader(res.Body, 4096)).Decode(&e)
	if e.Error == "" {
		e.Error = res.Status
	}
	fmt.Fprintln(stderr, "pw:", e.Error)
	if res.StatusCode == 404 {
		return 4
	}
	if res.StatusCode == 403 {
		return 3
	}
	if res.StatusCode == 429 {
		return 5
	}
	return 1
}

// Rejection sampling: 256 is not a multiple of 62, so a plain modulo would make
// the first eight letters of the alphabet a quarter likelier than the rest.
func newID() (string, error) {
	const limit = 256 - 256%len(alphabet)
	id := make([]byte, 7)
	buf := make([]byte, len(id))
	for filled := 0; filled < len(id); {
		if _, err := rand.Read(buf); err != nil {
			return "", err
		}
		for _, b := range buf {
			if int(b) < limit && filled < len(id) {
				id[filled] = alphabet[int(b)%len(alphabet)]
				filled++
			}
		}
	}
	return string(id), nil
}
func parseExpiry(s string) (string, error) {
	if strings.HasSuffix(s, "d") {
		var days int
		if _, err := fmt.Sscanf(s, "%dd", &days); err != nil || days < 1 {
			return "", errors.New("invalid expiry")
		}
		return time.Now().Add(time.Duration(days) * 24 * time.Hour).UTC().Format(time.RFC3339), nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil || !t.After(time.Now()) {
		return "", errors.New("expiry must be a future RFC3339 time or Nd")
	}
	return t.UTC().Format(time.RFC3339), nil
}

func pbkdf2(password, salt []byte, iterations, size int) []byte {
	out := make([]byte, 0, size)
	for block := uint32(1); len(out) < size; block++ {
		h := hmac.New(sha256.New, password)
		h.Write(salt)
		h.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := h.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iterations; i++ {
			h = hmac.New(sha256.New, password)
			h.Write(u)
			u = h.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:size]
}
func encrypt(plain []byte, pass string) (string, string, error) {
	salt := make([]byte, 16)
	iv := make([]byte, 12)
	if _, err := rand.Read(salt); err != nil {
		return "", "", err
	}
	if _, err := rand.Read(iv); err != nil {
		return "", "", err
	}
	block, err := aes.NewCipher(pbkdf2([]byte(pass), salt, 310000, 32))
	if err != nil {
		return "", "", err
	}
	g, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", err
	}
	sealed := append(salt, g.Seal(nil, iv, plain, nil)...)
	return base64.StdEncoding.EncodeToString(sealed), base64.StdEncoding.EncodeToString(iv), nil
}
func decrypt(encoded, encodedIV, pass string) ([]byte, error) {
	payload, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(payload) <= 16 {
		return nil, errors.New("invalid ciphertext")
	}
	iv, err := base64.StdEncoding.DecodeString(encodedIV)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(pbkdf2([]byte(pass), payload[:16], 310000, 32))
	if err != nil {
		return nil, err
	}
	g, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return g.Open(nil, iv, payload[16:], nil)
}
