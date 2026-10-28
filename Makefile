.PHONY: all build install cli app clean

all: build

install:
	bun install

cli:
	cargo build --release -p du-sk-cli

app:
	bun run tauri build

build: cli app

clean:
	cargo clean
	rm -rf dist
