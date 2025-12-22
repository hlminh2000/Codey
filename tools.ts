import inquirer from "inquirer";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

/**
 * Checks if a path is within the allowed working directory
 */
const isPathAllowed = (targetPath: string, workingDir: string): boolean => {
	const resolvedTarget = resolve(targetPath);
	const resolvedWorkingDir = resolve(workingDir);
	const relativePath = relative(resolvedWorkingDir, resolvedTarget);
	
	// If relative path starts with '..', it's outside the working directory
	// Empty string means the paths are the same (allowed)
	return relativePath === '' || !relativePath.startsWith('..');
};

export const createTools = (workingDirectory: string) => [
	tool(
		async ({ operation, a, b }) => {
			switch (operation) {
				case "add":
					return `${a + b}`;
				case "subtract":
					return `${a - b}`;
				case "multiply":
					return `${a * b}`;
				case "divide":
					return `${a / b}`;
				default:
					return "Unknown operation";
			}
		},
		{
			name: "calculator",
			description:
				"Performs basic arithmetic operations (add, subtract, multiply, divide) on two numbers",
			schema: z.object({
				operation: z
					.enum(["add", "subtract", "multiply", "divide"])
					.describe("The operation to perform"),
				a: z.number().describe("First number"),
				b: z.number().describe("Second number"),
			}),
		},
	),
	tool(
		async ({ type, message }) => {
			// Call inquirer directly for a one-question prompt
			const response = await inquirer.prompt([
				{
					type,
					name: "userInput",
					message,
				},
			]);
			if (type === "confirm") return response.userInput ? "yes" : "no";
			return response.userInput;
		},
		{
			name: "promptTool",
			description: `Use this tool when you want to ask user a question / get their inputs.
here are the types:
- input: used for free text questions
- confirm: yes/no questions, returns a boolean
`,
			schema: z.object({
				type: z
					.enum([
						"input",
						"confirm",
						"editor",
						"password",
						"number",
						"rawlist",
						"expand",
						"checkbox",
						"search",
						"select",
						"list",
					])
					.describe("The type of prompt to use."),
				message: z
					.string()
					.describe("The question / message you want to present to the user."),
			}),
		},
	),
	tool(
		async ({ path }) => {
			try {
				if (!isPathAllowed(path, workingDirectory)) {
					return `Permission denied: Cannot access '${path}'. You can only access files within the working directory: ${workingDirectory}`;
				}
				const fullPath = resolve(path);
				const entries = await readdir(fullPath, { withFileTypes: true });
				const files = entries
					.map((entry) => {
						const type = entry.isDirectory() ? "[DIR]" : "[FILE]";
						return `${type} ${entry.name}`;
					})
					.join("\n");
				return files || "Directory is empty";
			} catch (error) {
				return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		{
			name: "listFiles",
			description: "Lists all files and directories in the specified path",
			schema: z.object({
				path: z.string().describe("The directory path to list files from (e.g., '.', './src', '/Users/name/folder')"),
			}),
		},
	),
	tool(
		async ({ path }) => {
			try {
				if (!isPathAllowed(path, workingDirectory)) {
					return `Permission denied: Cannot access '${path}'. You can only access files within the working directory: ${workingDirectory}`;
				}
				const fullPath = resolve(path);
				const content = await readFile(fullPath, "utf-8");
				return content;
			} catch (error) {
				return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		{
			name: "readFile",
			description: "Reads the contents of a file at the specified path",
			schema: z.object({
				path: z.string().describe("The file path to read from (e.g., './file.txt', '/Users/name/document.md')"),
			}),
		},
	),
	tool(
		async ({ path, content }) => {
			try {
				if (!isPathAllowed(path, workingDirectory)) {
					return `Permission denied: Cannot access '${path}'. You can only access files within the working directory: ${workingDirectory}`;
				}
				const fullPath = resolve(path);
				await writeFile(fullPath, content, "utf-8");
				return `Successfully wrote ${content.length} characters to ${path}`;
			} catch (error) {
				return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		{
			name: "writeFile",
			description: "Writes content to a file at the specified path. Creates the file if it doesn't exist, overwrites if it does.",
			schema: z.object({
				path: z.string().describe("The file path to write to (e.g., './output.txt', '/Users/name/document.md')"),
				content: z.string().describe("The content to write to the file"),
			}),
		},
	),
];