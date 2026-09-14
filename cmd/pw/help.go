package main

import (
	"fmt"
	"io"
	"sort"
	"strings"
)

type topic struct{ name, summary, body string }

// Commands and topics are the two help menus: `pw help` lists both, `pw help X`
// or `pw X --help` opens one.
var commands = []topic{
	{"read", "Print a pin's content", `usage: pw read TAG [options]
       pw TAG [options]

TAG may be a bare tag, a full URL, or an edit URL (TAG#EDIT_TOKEN) — the
token is ignored when reading.

options:
  --pass SECRET      passphrase for an encrypted pin
  --pass-env VAR     read the passphrase from an environment variable
  --pass-file PATH   read the passphrase from a file ("-" is not allowed)
  -o, --output PATH  write to a file instead of stdout
  --json             print the pin as JSON instead of raw content
  -q, --quiet        suppress notes on stderr

examples:
  pw abc1234
  pw abc1234 | sh
  pw read https://pw.pee.pw/abc1234 --pass-env PW_PASS -o deploy.sh`},

	{"write", "Create a pin from stdin or a file", `usage: pw write [FILE] [options]

Reads FILE, or stdin when no file is given ("-" also means stdin). Maximum
256 KiB. With no --language, the language is guessed from FILE's extension
and otherwise defaults to text.

The server returns an edit token exactly once, at creation. pw saves it to
the local store (see: pw help editing) so that ` + "`pw amend TAG`" + ` works later,
and --edit-url / --json print it.

options:
  -l, --language L   syntax language (see: pw help languages)
  --expires SPEC     expire the pin after Nd (e.g. 30d) or at an RFC3339 time
  --tag TAG          ask for a specific 5-7 character tag instead of a random one
  --pass SECRET      encrypt with a passphrase before upload
  --pass-env VAR     take the passphrase from an environment variable
  --pass-file PATH   take the passphrase from a file
  --url              print the share URL instead of the tag
  --edit-url         print the edit URL (share URL + #EDIT_TOKEN)
  --url --edit-url   print both, share URL first, one per line
  --json             print {"tag","url","edit_url"} as JSON
  --no-save          do not save the edit token locally
  --plain, --stdout  plain unstyled output (implied when piping)
  -q, --quiet        suppress the url note on stderr

examples:
  cat DESIGN.md | pw write --edit-url
  pw write deploy.sh --expires 30d
  pw write notes.md --pass-env PW_PASS --json`},

	{"amend", "Replace the content of a pin you own", `usage: pw amend TAG[#EDIT_TOKEN] [FILE] [options]

Without #EDIT_TOKEN, pw uses the token saved when the pin was created on this
machine. Amending replaces the content only; language and expiry stay as they
were. Encrypt again with the same --pass options, or the pin becomes plain
text.

options:
  --pass SECRET      encrypt the new content with a passphrase
  --pass-env VAR     take the passphrase from an environment variable
  --pass-file PATH   take the passphrase from a file
  --url              print the share URL instead of the tag
  -q, --quiet        print nothing on success

examples:
  printf 'replacement\n' | pw amend abc1234
  pw amend 'abc1234#3f2a...' README.md`},

	{"info", "Show a pin's metadata", `usage: pw info TAG [options]

Prints tag, URL, language, creation and expiry times, size and whether the pin
is encrypted — without printing the content. Adds the edit URL when the token
is saved locally.

options:
  --json             print the metadata as JSON
  --plain, --stdout  plain unstyled output (implied when piping)
  -q, --quiet        suppress notes on stderr`},

	{"list", "List pins saved on this machine", `usage: pw list [options]

Lists the pins whose edit tokens pw saved at creation, newest first. This is a
local record only: it says nothing about whether a pin still exists on the
server, and pins created elsewhere never appear.

options:
  --json             print the saved records as JSON
  --url              print only the share URLs
  --edit-url         print only the edit URLs
  --plain, --stdout  plain unstyled output (implied when piping)`},

	{"forget", "Remove a saved edit token", `usage: pw forget TAG

Drops one pin from the local store. The pin itself is untouched, and the token
cannot be recovered afterwards — the server never shows it twice.`},

	{"open", "Open a pin in the browser", `usage: pw open TAG [--edit-url]

Opens the share URL with the system browser (xdg-open, open, or rundll32).
With --edit-url, opens the edit URL when the token is known.`},

	{"update", "Update pw itself", `usage: pw update [--check]

Downloads and installs the latest release. --check only reports whether a
newer version exists.`},

	{"version", "Print the version", "usage: pw version"},

	{"help", "Show help for a command or topic", `usage: pw help [COMMAND|TOPIC]
       pw COMMAND --help`},
}

var topics = []topic{
	{"tags", "Tag format, URLs and collisions", `A tag is 5-7 characters from A-Z, a-z, 0-9, "_" and "-". pw generates 7
random characters unless --tag asks for a specific one; a taken tag fails with
id_taken (exit 1) rather than overwriting anything.

Anywhere a TAG is accepted, these all work:
  abc1234
  https://pw.pee.pw/abc1234
  https://pw.pee.pw/abc1234#EDIT_TOKEN

Tags are never reused, so a link keeps meaning the same pin forever.`},

	{"editing", "Edit tokens and the local token store", `Creating a pin returns an edit token once. It is the only proof of ownership:
there is no account, and the server will not show the token again.

pw saves new tokens to:
  $PW_STATE_FILE, else $XDG_STATE_HOME/pw/pins.json, else ~/.local/state/pw/pins.json

The file is created with 0600 permissions. Because it holds every edit token,
treat it like a keyring — --no-save keeps a token out of it, and --edit-url or
--json hand the token to you instead.

  pw list            what is saved here
  pw forget TAG      drop one record
  pw amend TAG       amend using the saved token
  pw amend TAG#TOK   amend with an explicit token, saved or not`},

	{"encryption", "Passphrase pins", `--pass, --pass-env and --pass-file encrypt the content locally before upload:
PBKDF2-SHA256 (310k iterations) derives a key from the passphrase and a random
16-byte salt, and AES-256-GCM seals the content with a random 12-byte IV. The
server stores only the ciphertext, and the web viewer decrypts with the same
scheme, so a browser can open a pin pw encrypted.

The passphrase never leaves the machine, and a lost passphrase means lost
content. Prefer --pass-env or --pass-file in scripts: --pass puts the secret in
the process list.

  pw write notes.md --pass-file ~/.pw-pass
  pw abc1234 --pass-env PW_PASS`},

	{"expiry", "How --expires works", `--expires takes Nd (days) or an RFC3339 timestamp:

  pw write --expires 7d
  pw write --expires 2026-12-31T23:59:59Z

Expired pins stop being readable immediately and are swept from the database on
later writes. Expiry is set at creation; amend cannot change it.`},

	{"languages", "Syntax languages", `--language accepts what the web viewer can highlight:

  text  bash  c  cpp  css  go  html  java  javascript  json
  jsx  markdown  python  rust  sql  tsx  typescript  yaml

Aliases: sh, shell, zsh -> bash; js -> javascript; ts -> typescript;
py -> python; md -> markdown; yml -> yaml; rs -> rust; golang -> go.

When writing a file with no --language, the extension decides; unknown
extensions and stdin default to text.`},

	{"output", "Choosing what pw prints", `write prints the tag by default, one line, nothing else — pipe-friendly:

  TAG=$(pw write < notes.md)

  --url              https://pw.pee.pw/TAG
  --edit-url         https://pw.pee.pw/TAG#EDIT_TOKEN
  --url --edit-url   both, share URL on the first line
  --json             {"tag":"…","url":"…","edit_url":"…"}

  { read -r url; read -r edit; } < <(pw write --url --edit-url < notes.md)

Tables and notes are lightly styled on a terminal only: pw dims labels and
underlines links when stdout is a tty, and prints plain text whenever output is
piped, redirected, captured, or --plain / --stdout is given. NO_COLOR and
TERM=dumb are honoured.

read writes the raw bytes to stdout, or to --output PATH. Errors and notes go
to stderr, so stdout stays clean enough to pipe into a shell. On a terminal,
write also notes both URLs on stderr; -q or --quiet silences them.`},

	{"exit-codes", "What each exit status means", `  0  success
  1  network, server or local I/O failure
  2  usage error (bad option, missing tag, empty or oversized input)
  3  encryption problem: passphrase missing or wrong, or an invalid edit token
  4  no such pin (or it expired)
  5  rate limited — wait and retry`},

	{"env", "Environment variables", `  PW_BASE_URL    server to talk to (default https://pw.pee.pw)
  PW_STATE_FILE  path of the saved-token file
  XDG_STATE_HOME base directory for the default state file
  NO_COLOR       set to anything to disable styling (same as --plain)
  TERM           "dumb" disables styling too`},
}

func rootHelp() string {
	var b strings.Builder
	b.WriteString("pw — pin text on pinwall and read it back by tag\n\nusage:\n" +
		"  pw TAG [options]              read a pin\n" +
		"  pw COMMAND [args] [options]   everything else\n\ncommands:\n")
	for _, c := range commands {
		fmt.Fprintf(&b, "  %-8s %s\n", c.name, c.summary)
	}
	b.WriteString("\nhelp topics:\n")
	for _, t := range topics {
		fmt.Fprintf(&b, "  %-11s %s\n", t.name, t.summary)
	}
	b.WriteString("\ncommon options:\n" +
		"  --pass SECRET | --pass-env VAR | --pass-file PATH   passphrase for encrypted pins\n" +
		"  --url | --edit-url | --json                         what to print\n" +
		"  -q, --quiet                                         suppress notes on stderr\n" +
		"  -h, --help                                          help for a command\n\n" +
		"  pw help write        options for one command\n" +
		"  pw help editing      how edit tokens are kept\n")
	return b.String()
}

func findTopic(name string) (topic, bool) {
	for _, list := range [][]topic{commands, topics} {
		for _, t := range list {
			if t.name == name {
				return t, true
			}
		}
	}
	return topic{}, false
}

func showHelp(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprint(stdout, rootHelp())
		return 0
	}
	if t, ok := findTopic(args[0]); ok {
		fmt.Fprintf(stdout, "%s — %s\n\n%s\n", t.name, t.summary, t.body)
		return 0
	}
	names := make([]string, 0, len(commands)+len(topics))
	for _, list := range [][]topic{commands, topics} {
		for _, t := range list {
			names = append(names, t.name)
		}
	}
	sort.Strings(names)
	fmt.Fprintf(stderr, "pw: no help for %q\navailable: %s\n", args[0], strings.Join(names, ", "))
	return 2
}
