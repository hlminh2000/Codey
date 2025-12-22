# react-agent

To install dependencies:

```bash
bun install
```

To run:

```bash
# Run with current directory as working directory (default)
bun run index.ts

# Run with a specific working directory
bun run index.ts /path/to/directory
```

The agent will only be able to access files within the specified working directory. Any attempts to access files outside this directory will be denied.

This project was created using `bun init` in bun v1.2.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
