import { expect, it } from "vitest";
import { detectLanguage } from "./detect-language";

it.each([
  ["", "markdown"], ["   ", "markdown"], ["A note about tomorrow's meeting.", "text"],
  ["Note: bring your laptop", "text"], ["{not JSON", "text"],
  ['{"name":"pinwall","items":[1,2]}', "json"],
  ["# Notes\n\n```python\ndef hello(): pass\n```", "markdown"],
  ["A **bold** statement.", "markdown"],
  ["- first\n- second\n", "markdown"],
  ["name: pinwall\nport: 3000", "yaml"],
  ["#!/bin/sh\nprintf 'hello\\n'", "bash"],
  ["def hello(name):\n    return name", "python"],
  ['package main\nfunc main() { println("hi") }', "go"],
  ['fn main() { println!("hi"); }', "rust"],
  ['public class Main { public static void main(String[] args) {} }', "java"],
  ['#include <stdio.h>\nint main(void) { return 0; }', "c"],
  ['#include <iostream>\nint main() { std::cout << "hi"; }', "cpp"],
  ["SELECT id FROM pins WHERE id = 'abc1234';", "sql"],
  [".card { color: red; }", "css"],
  ['<h1 class="title">Hello</h1>', "html"],
  ['const greet = () => "hello";', "javascript"],
  ['const greet = (name: string) => name;', "typescript"],
  ['const Card = () => <div>Hello</div>;', "jsx"],
  ['const Card = (name: string) => <div>{name}</div>;', "tsx"],
])("detects %j as %s", (content, language) => {
  expect(detectLanguage(content)).toBe(language);
});
