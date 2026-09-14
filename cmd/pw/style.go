package main

import (
	"fmt"
	"io"
	"os"
	"strings"
)

// pw ships as one dependency-free binary for eight platforms, and the whole
// styling need is four lines of stderr plus two small tables — a handful of SGR
// codes, not a TUI library. Styling is off whenever the output is not a
// terminal, so pipes and captures see exactly the plain text they always did.
type style struct{ on bool }

func styler(w io.Writer, plain bool) style {
	return style{on: !plain && isTerminal(w) &&
		os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb"}
}

func (s style) paint(code, text string) string {
	if !s.on || text == "" {
		return text
	}
	return "\x1b[" + code + "m" + text + "\x1b[0m"
}

func (s style) bold(t string) string   { return s.paint("1", t) }
func (s style) dim(t string) string    { return s.paint("2", t) }
func (s style) link(t string) string   { return s.paint("4;36", t) }
func (s style) label(t string) string  { return s.dim(t) }
func (s style) accent(t string) string { return s.paint("36", t) }

// Pad before painting: escape bytes have no width on screen but every column
// calculation counts them, so colour has to go on last.
func (s style) column(text string, width int) string {
	return text + strings.Repeat(" ", max(0, width-len([]rune(text))))
}

// rows renders an aligned table; painted reports which cells to emphasise.
func (s style) table(out io.Writer, header []string, rows [][]string, paint func(column int, cell string) string) {
	if paint == nil {
		paint = func(_ int, cell string) string { return cell }
	}
	widths := make([]int, len(header))
	for i, h := range header {
		widths[i] = len([]rune(h))
	}
	for _, row := range rows {
		for i, cell := range row {
			widths[i] = max(widths[i], len([]rune(cell)))
		}
	}
	line := func(cells []string, decorate func(int, string) string) {
		parts := make([]string, len(cells))
		for i, cell := range cells {
			text := cell
			if i < len(cells)-1 {
				text = s.column(cell, widths[i])
			}
			parts[i] = decorate(i, text)
		}
		fmt.Fprintln(out, strings.TrimRight(strings.Join(parts, "  "), " "))
	}
	if len(header) > 0 {
		line(header, func(_ int, cell string) string { return s.dim(cell) })
	}
	for _, row := range rows {
		line(row, paint)
	}
}
