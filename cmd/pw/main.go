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
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"text/tabwriter"
	"time"
)

const defaultBase = "https://pw.pee.pw"
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const maxSize = 262144

var version = "dev"

type options struct {
	pass, passEnv, passFile       string
	language, expires, tag        string
	output                        string
	url, editURL, json            bool
	quiet, noSave, help, explicit bool
	args                          []string
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
		fmt.Fprint(stderr, rootHelp())
		return 2
	}
	switch args[0] {
	case "help", "--help", "-h":
		return showHelp(args[1:], stdout, stderr)
	case "--version", "version", "-V":
		fmt.Fprintf(stdout, "pw %s\n", version)
		return 0
	case "update":
		if len(args) > 2 || (len(args) == 2 && args[1] != "--check") {
			fmt.Fprintln(stderr, "usage: pw update [--check]")
			return 2
		}
		return runUpdate(len(args) == 2, stdout, stderr)
	}

	command, start := "read", 0
	switch args[0] {
	case "read", "write", "amend", "info", "list", "forget", "open":
		command, start = args[0], 1
	}
	opts, err := parseOptions(args[start:])
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	if opts.help {
		return showHelp([]string{command}, stdout, stderr)
	}
	target := ""
	if len(opts.args) > 0 {
		target = opts.args[0]
	}
	needsTag := command != "write" && command != "list"
	if needsTag && target == "" {
		fmt.Fprintf(stderr, "pw: %s needs a tag — see pw help %s\n", command, command)
		return 2
	}

	switch command {
	case "read":
		return readPin(target, opts, stdout, stderr)
	case "info":
		return infoPin(target, opts, stdout, stderr)
	case "list":
		return listPins(opts, stdout, stderr)
	case "forget":
		return forgetSaved(target, opts, stdout, stderr)
	case "open":
		return openPin(target, opts, stdout, stderr)
	}

	file := ""
	if command == "write" && len(opts.args) > 0 {
		file = opts.args[0]
	} else if command == "amend" && len(opts.args) > 1 {
		file = opts.args[1]
	}
	body, code := readInput(file, stdin, stderr)
	if code != 0 {
		return code
	}
	if command == "write" {
		if !opts.explicit {
			opts.language = languageFor(file)
		}
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
		case "--pass-env":
			o.passEnv, err = value(args[i])
		case "--pass-file":
			o.passFile, err = value(args[i])
		case "--language", "-l":
			o.language, err = value(args[i])
			o.explicit = true
		case "--expires":
			o.expires, err = value(args[i])
		case "--tag":
			o.tag, err = value(args[i])
		case "--output", "-o":
			o.output, err = value(args[i])
		case "--url":
			o.url = true
		case "--edit-url":
			o.editURL = true
		case "--json":
			o.json = true
		case "--no-save":
			o.noSave = true
		case "--quiet", "-q":
			o.quiet = true
		case "--help", "-h":
			o.help = true
		default:
			if strings.HasPrefix(args[i], "-") && args[i] != "-" {
				return o, fmt.Errorf("unknown option %s", args[i])
			}
			o.args = append(o.args, args[i])
		}
		if err != nil {
			return o, err
		}
	}
	return o, nil
}

// A passphrase on the command line is visible in the process list, so --pass-env
// and --pass-file exist for scripts; all three land here.
func (o options) passphrase() (string, error) {
	switch {
	case o.pass != "":
		return o.pass, nil
	case o.passEnv != "":
		v, ok := os.LookupEnv(o.passEnv)
		if !ok || v == "" {
			return "", fmt.Errorf("%s is empty or unset", o.passEnv)
		}
		return v, nil
	case o.passFile != "":
		b, err := os.ReadFile(o.passFile)
		if err != nil {
			return "", err
		}
		v := strings.TrimRight(string(b), "\r\n")
		if v == "" {
			return "", errors.New(o.passFile + " is empty")
		}
		return v, nil
	}
	return "", nil
}

var extensions = map[string]string{
	".md": "markdown", ".markdown": "markdown", ".sh": "bash", ".bash": "bash",
	".zsh": "bash", ".go": "go", ".py": "python", ".js": "javascript",
	".mjs": "javascript", ".cjs": "javascript", ".ts": "typescript", ".tsx": "tsx",
	".jsx": "jsx", ".json": "json", ".yaml": "yaml", ".yml": "yaml",
	".html": "html", ".htm": "html", ".css": "css", ".sql": "sql", ".rs": "rust",
	".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".hpp": "cpp",
	".java": "java", ".txt": "text",
}

var aliases = map[string]string{
	"sh": "bash", "shell": "bash", "zsh": "bash", "js": "javascript",
	"ts": "typescript", "py": "python", "md": "markdown", "yml": "yaml",
	"rs": "rust", "golang": "go", "c++": "cpp",
}

func languageFor(file string) string {
	if lang, ok := extensions[strings.ToLower(filepath.Ext(file))]; ok && file != "-" {
		return lang
	}
	return "text"
}

func readInput(file string, stdin io.Reader, stderr io.Writer) ([]byte, int) {
	source, name := stdin, "stdin"
	if file != "" && file != "-" {
		f, err := os.Open(file)
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return nil, 1
		}
		defer f.Close()
		source, name = f, file
	}
	body, err := io.ReadAll(io.LimitReader(source, maxSize+1))
	if err != nil {
		fmt.Fprintf(stderr, "pw: reading %s: %v\n", name, err)
		return nil, 1
	}
	if len(body) == 0 {
		fmt.Fprintf(stderr, "pw: %s is empty\n", name)
		return nil, 2
	}
	if len(body) > maxSize {
		fmt.Fprintln(stderr, "pw: input exceeds 256 KiB")
		return nil, 2
	}
	return body, 0
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

// An edit URL carries the token after "#": pw amend accepts either half.
func tokenFrom(s string) string {
	if i := strings.LastIndexByte(s, '#'); i >= 0 {
		return s[i+1:]
	}
	return ""
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

func fetchPin(target string, stderr io.Writer) (pin, int) {
	id, err := idFrom(target)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return pin{}, 2
	}
	res, err := request("GET", "/api/pin/"+id, nil)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return pin{}, 1
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return pin{}, apiFailure(res, stderr)
	}
	var p pin
	if err := json.NewDecoder(res.Body).Decode(&p); err != nil {
		fmt.Fprintln(stderr, "pw: invalid server response")
		return pin{}, 1
	}
	p.ID = id
	return p, 0
}

func readPin(target string, o options, stdout, stderr io.Writer) int {
	p, code := fetchPin(target, stderr)
	if code != 0 {
		return code
	}
	content := []byte(p.Content)
	if p.Ciphertext != "" {
		pass, err := o.passphrase()
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 2
		}
		if pass == "" {
			fmt.Fprintln(stderr, "pw: pin is encrypted; supply --pass, --pass-env or --pass-file")
			return 3
		}
		content, err = decrypt(p.Ciphertext, p.IV, pass)
		if err != nil {
			fmt.Fprintln(stderr, "pw: wrong passphrase or damaged pin")
			return 3
		}
	}
	if o.json {
		return emitJSON(map[string]any{
			"tag": p.ID, "url": baseURL() + "/" + p.ID, "language": p.Language,
			"created_at": p.CreatedAt, "expires_at": p.ExpiresAt,
			"encrypted": p.Ciphertext != "", "content": string(content),
		}, stdout, stderr)
	}
	if o.output != "" {
		if err := os.WriteFile(o.output, content, 0o600); err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 1
		}
		if !o.quiet {
			fmt.Fprintf(stderr, "pw: wrote %d bytes to %s\n", len(content), o.output)
		}
		return 0
	}
	if _, err := stdout.Write(content); err != nil {
		fmt.Fprintln(stderr, "pw: writing stdout:", err)
		return 1
	}
	return 0
}

func infoPin(target string, o options, stdout, stderr io.Writer) int {
	p, code := fetchPin(target, stderr)
	if code != 0 {
		return code
	}
	size := len(p.Content)
	if p.Ciphertext != "" {
		size = len(p.Ciphertext)
	}
	share := baseURL() + "/" + p.ID
	record, known := savedPin(p.ID)
	if o.json {
		out := map[string]any{
			"tag": p.ID, "url": share, "language": p.Language, "created_at": p.CreatedAt,
			"expires_at": p.ExpiresAt, "encrypted": p.Ciphertext != "", "size": size,
		}
		if known {
			out["edit_url"] = record.EditURL
		}
		return emitJSON(out, stdout, stderr)
	}
	w := tabwriter.NewWriter(stdout, 0, 0, 2, ' ', 0)
	expires := p.ExpiresAt
	if expires == "" {
		expires = "never"
	}
	encrypted := "no"
	if p.Ciphertext != "" {
		encrypted = "yes (AES-256-GCM)"
	}
	fmt.Fprintf(w, "tag\t%s\nurl\t%s\nlanguage\t%s\ncreated\t%s\nexpires\t%s\nsize\t%d bytes\nencrypted\t%s\n",
		p.ID, share, p.Language, p.CreatedAt, expires, size, encrypted)
	if known {
		fmt.Fprintf(w, "edit url\t%s\n", record.EditURL)
	}
	_ = w.Flush()
	if !known && !o.quiet {
		fmt.Fprintln(stderr, "pw: no saved edit token for this pin — see pw help editing")
	}
	return 0
}

func listPins(o options, stdout, stderr io.Writer) int {
	list := loadSaved()
	if o.json {
		return emitJSON(list, stdout, stderr)
	}
	if len(list) == 0 {
		fmt.Fprintln(stderr, "pw: no saved pins — pw write saves the edit token of every pin it creates")
		return 0
	}
	if o.url || o.editURL {
		for _, s := range list {
			if o.editURL {
				fmt.Fprintln(stdout, s.EditURL)
			} else {
				fmt.Fprintln(stdout, s.URL)
			}
		}
		return 0
	}
	w := tabwriter.NewWriter(stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "TAG\tLANGUAGE\tCREATED\tEDIT URL")
	for _, s := range list {
		language := s.Language
		if s.Encrypted {
			language += " (encrypted)"
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", s.Tag, language, s.Created, s.EditURL)
	}
	_ = w.Flush()
	return 0
}

func forgetSaved(target string, o options, stdout, stderr io.Writer) int {
	id, err := idFrom(target)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	if err := forgetPin(id); err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 1
	}
	if !o.quiet {
		fmt.Fprintf(stdout, "forgot %s\n", id)
	}
	return 0
}

func openPin(target string, o options, stdout, stderr io.Writer) int {
	id, err := idFrom(target)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	link := baseURL() + "/" + id
	if o.editURL {
		if record, ok := savedPin(id); ok {
			link = record.EditURL
		} else if token := tokenFrom(target); token != "" {
			link = link + "#" + token
		} else {
			fmt.Fprintln(stderr, "pw: no saved edit token for", id)
			return 2
		}
	}
	opener := map[string]string{"darwin": "open", "windows": "rundll32"}[runtime.GOOS]
	args := []string{link}
	if opener == "" {
		opener = "xdg-open"
	}
	if runtime.GOOS == "windows" {
		args = []string{"url.dll,FileProtocolHandler", link}
	}
	if err := exec.Command(opener, args...).Start(); err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		fmt.Fprintln(stdout, link)
		return 1
	}
	if !o.quiet {
		fmt.Fprintln(stderr, "pw: opening", link)
	}
	return 0
}

func writePin(content []byte, o options, stdout, stderr io.Writer) int {
	if lang, ok := aliases[strings.ToLower(o.language)]; ok {
		o.language = lang
	}
	data := map[string]any{"language": o.language}
	if o.expires != "" {
		expiry, err := parseExpiry(o.expires)
		if err != nil {
			fmt.Fprintln(stderr, "pw:", err)
			return 2
		}
		data["expires_at"] = expiry
	}
	pass, err := o.passphrase()
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	if pass != "" {
		sealed, iv, err := encrypt(content, pass)
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
		return printCreated(result, o, pass != "", stdout, stderr)
	}
	fmt.Fprintln(stderr, "pw: could not allocate a tag")
	return 1
}

func amendPin(target string, content []byte, o options, stdout, stderr io.Writer) int {
	id, err := idFrom(target)
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	token := tokenFrom(target)
	if token == "" {
		record, ok := savedPin(id)
		if !ok {
			fmt.Fprintf(stderr, "pw: no saved edit token for %s — amend with TAG#EDIT_TOKEN (see pw help editing)\n", id)
			return 2
		}
		token = record.EditToken
	}
	data := map[string]any{"edit_token": token}
	pass, err := o.passphrase()
	if err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 2
	}
	if pass != "" {
		sealed, iv, err := encrypt(content, pass)
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
	if o.quiet {
		return 0
	}
	if o.url {
		fmt.Fprintln(stdout, baseURL()+"/"+id)
	} else {
		fmt.Fprintln(stdout, id)
	}
	return 0
}

func printCreated(p pin, o options, encrypted bool, stdout, stderr io.Writer) int {
	share := baseURL() + "/" + p.ID
	edit := share + "#" + p.EditToken
	stored := false
	if !o.noSave && p.EditToken != "" {
		err := rememberPin(saved{
			Tag: p.ID, EditToken: p.EditToken, URL: share, EditURL: edit,
			Language: o.language, Created: time.Now().UTC().Format(time.RFC3339),
			Encrypted: encrypted,
		})
		stored = err == nil
		if err != nil && !o.quiet {
			fmt.Fprintln(stderr, "pw: could not save the edit token:", err)
		}
	}
	if o.json {
		saveState := "no"
		if stored {
			saveState = "yes"
		}
		return emitJSON(map[string]string{
			"tag": p.ID, "url": share, "edit_url": edit, "edit_token": p.EditToken,
			"language": o.language, "saved": saveState,
		}, stdout, stderr)
	}
	switch {
	case o.editURL:
		fmt.Fprintln(stdout, edit)
	case o.url:
		fmt.Fprintln(stdout, share)
	default:
		fmt.Fprintln(stdout, p.ID)
		// The token is shown exactly once. On a terminal, say so rather than
		// letting it scroll past as a bare tag; pipelines never see this.
		if !o.quiet && isTerminal(stderr) {
			fmt.Fprintf(stderr, "pw: edit url %s\n", edit)
			if stored {
				fmt.Fprintf(stderr, "pw: token saved — amend later with: pw amend %s\n", p.ID)
			}
		}
	}
	return 0
}

func emitJSON(v any, stdout, stderr io.Writer) int {
	e := json.NewEncoder(stdout)
	e.SetIndent("", "  ")
	if err := e.Encode(v); err != nil {
		fmt.Fprintln(stderr, "pw:", err)
		return 1
	}
	return 0
}

func isTerminal(w io.Writer) bool {
	f, ok := w.(*os.File)
	if !ok {
		return false
	}
	info, err := f.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
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
