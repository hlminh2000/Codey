# react-agent

## Project Overview

react-agent is a React-based application that serves as an agent capable of interacting with files within a specified working directory. It enforces strict access control, allowing file operations only within the designated directory to ensure security.

## Getting Started

### Installation
```bash
bun install
```

### Setup
1. Ensure you have [Bun](https://bun.sh) installed
2. Configure your working directory permissions in `.env` or environment variables
3. Verify TypeScript setup via `tsconfig.json`

## Usage

### Running the Agent
```bash
# Run with current directory as working directory (default)
bun run index.ts

# Run with a specific working directory
bun run index.ts /path/to/directory
```

The agent will only be able to access files within the specified working directory. Any attempts to access files outside this directory will be denied.

## Key Features
- Secure directory-based file access control
- Built with React for interactive UI
- TypeScript support with strict type checking
- Bun.js for fast execution

## Project Structure
```
.
├── .env
├── .gitignore
├── .git
├── bun.lock
├── package.json
├── tsconfig.json
├── tools.ts
├── index.ts
└── README.md
```

This project was created using `bun init` in bun v1.2.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
