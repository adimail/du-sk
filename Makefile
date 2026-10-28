DEST := $(HOME)/scripts

.PHONY: all build install cli app clean

all: build

install:
	bun install

cli:
	cargo build --release -p du-sk-cli
	mkdir -p $(DEST)
	cp target/release/du-sk-cli $(DEST)/

app:
	bun run tauri build
	mkdir -p $(DEST)
	cp -R target/release/bundle/macos/du-sk.app $(DEST)/ 2>/dev/null || cp -R src-tauri/target/release/bundle/macos/du-sk.app $(DEST)/

build: cli app

clean:
	cargo clean
	rm -rf dist
