package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// A pin's edit token is shown exactly once, at creation, and there are no
// accounts — so the only way `pw amend TAG` can work later is to keep the token
// here. 0600, because this file is effectively a keyring.
type saved struct {
	Tag       string `json:"tag"`
	EditToken string `json:"edit_token"`
	URL       string `json:"url"`
	EditURL   string `json:"edit_url"`
	Language  string `json:"language,omitempty"`
	Created   string `json:"created"`
	Encrypted bool   `json:"encrypted,omitempty"`
}

func storePath() (string, error) {
	if p := os.Getenv("PW_STATE_FILE"); p != "" {
		return p, nil
	}
	dir := os.Getenv("XDG_STATE_HOME")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		dir = filepath.Join(home, ".local", "state")
	}
	return filepath.Join(dir, "pw", "pins.json"), nil
}

func loadSaved() []saved {
	path, err := storePath()
	if err != nil {
		return nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var list []saved
	if json.Unmarshal(b, &list) != nil {
		return nil
	}
	return list
}

func storeSaved(list []saved) error {
	path, err := storePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	// Temp file plus rename: a crash mid-write would otherwise truncate every
	// token in the store, not just the one being added.
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(b, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func rememberPin(s saved) error {
	list := loadSaved()
	kept := make([]saved, 0, len(list)+1)
	kept = append(kept, s)
	for _, old := range list {
		if old.Tag != s.Tag {
			kept = append(kept, old)
		}
	}
	return storeSaved(kept)
}

func savedPin(tag string) (saved, bool) {
	for _, s := range loadSaved() {
		if s.Tag == tag {
			return s, true
		}
	}
	return saved{}, false
}

func forgetPin(tag string) error {
	list := loadSaved()
	kept := make([]saved, 0, len(list))
	for _, s := range list {
		if s.Tag != tag {
			kept = append(kept, s)
		}
	}
	if len(kept) == len(list) {
		return errors.New("no saved edit token for " + tag)
	}
	return storeSaved(kept)
}
