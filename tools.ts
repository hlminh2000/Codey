import inquirer from "inquirer";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

export const createTools = (
	workingDirectory: string,
	// biome-ignore lint/suspicious/noExplicitAny: LangChain model type is complex and not exported
	model?: any
) => [
	tool(
		async ({ operation, a, b }) => {
			switch (operation) {
				case "add":
					return `${a} + ${b} = ${a + b}`;
				case "subtract":
					return `${a} - ${b} = ${a - b}`;
				case "multiply":
					return `${a} * ${b} = ${a * b}`;
				case "divide":
					return `${a} / ${b} = ${a / b}`;
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
// 	tool(
// 		async ({ type, message }) => {
// 			// Call inquirer directly for a one-question prompt
// 			const response = await inquirer.prompt([
// 				{
// 					type,
// 					name: "userInput",
// 					message,
// 				},
// 			]);
// 			if (type === "confirm") return response.userInput ? "yes" : "no";
// 			return response.userInput;
// 		},
// 		{
// 			name: "promptTool",
// 			description: `Use this tool when you want to ask user a question / get their inputs.
// here are the types:
// - input: used for free text questions
// - confirm: yes/no questions, returns a boolean
// `,
// 			schema: z.object({
// 				type: z
// 					.enum([
// 						"input",
// 						"confirm",
// 						"editor",
// 						"password",
// 						"number",
// 						"rawlist",
// 						"expand",
// 						"checkbox",
// 						"search",
// 						"select",
// 						"list",
// 					])
// 					.describe("The type of prompt to use."),
// 				message: z
// 					.string()
// 					.describe("The question / message you want to present to the user."),
// 			}),
// 		},
// 	),
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
	// tool(
	// 	async ({ request }) => {
	// 		if (!model) {
	// 			return "Error: Model not available for planning";
	// 		}
			
	// 		try {
	// 			// Define the schema for the plan output
	// 			const planSchema = z.object({
	// 				steps: z.array(
	// 					z.object({
	// 						stepNumber: z.number().describe("The step number in the sequence"),
	// 						description: z.string().describe("A clear description of what needs to be done in this step"),
	// 						expectedOutcome: z.string().describe("What should be achieved after completing this step"),
	// 					})
	// 				).describe("An ordered list of steps to complete the task"),
	// 				estimatedComplexity: z.enum(["low", "medium", "high"]).describe("The estimated complexity of the overall task"),
	// 			});
				
	// 			type PlanResponse = z.infer<typeof planSchema>;
				
	// 			// Use structured output to generate the plan
	// 			const structuredModel = model.withStructuredOutput(planSchema);
				
	// 			const response: PlanResponse = await structuredModel.invoke([
	// 				{
	// 					role: "system",
	// 					content: "You are a helpful planning assistant. Break down user requests into clear, actionable steps. Be specific and thorough.",
	// 				},
	// 				{
	// 					role: "user",
	// 					content: `Please create a detailed step-by-step plan for the following request:\n\n${request}`,
	// 				},
	// 			]);
				
	// 			// Format the response as a readable string
	// 			const formattedPlan = [
	// 				`📋 Plan for: "${request}"`,
	// 				`Complexity: ${response.estimatedComplexity.toUpperCase()}`,
	// 				"",
	// 				"Steps:",
	// 				...response.steps.map(
	// 					(step: { stepNumber: number; description: string; expectedOutcome: string }) =>
	// 						`${step.stepNumber}. ${step.description}\n   Expected outcome: ${step.expectedOutcome}`
	// 				),
	// 			].join("\n");
				
	// 			return formattedPlan;
	// 		} catch (error) {
	// 			return `Error generating plan: ${error instanceof Error ? error.message : String(error)}`;
	// 		}
	// 	},
	// 	{
	// 		name: "plan",
	// 		description: "Generates a detailed step-by-step plan for completing a task. Use this tool when you need to break down a complex request into actionable steps before executing them.",
	// 		schema: z.object({
	// 			request: z.string().describe("The task or request that needs to be planned out"),
	// 		}),
	// 	},
	// ),
	tool(
		async ({ command }) => {
			try {
				const { stdout, stderr } = await execAsync(command, {
					cwd: workingDirectory,
					maxBuffer: 1024 * 1024 * 10, // 10MB buffer
					timeout: 30000, // 30 second timeout
				});
				
				let output = "";
				if (stdout) {
					output += `STDOUT:\n${stdout}`;
				}
				if (stderr) {
					output += `${stdout ? "\n\n" : ""}STDERR:\n${stderr}`;
				}
				
				return output || "Command executed successfully with no output";
			} catch (error) {
				if (error instanceof Error && "stdout" in error && "stderr" in error) {
					// Command failed but we have output
					const execError = error as { stdout: string; stderr: string; code?: number };
					let output = `Command failed with exit code ${execError.code ?? "unknown"}\n\n`;
					if (execError.stdout) {
						output += `STDOUT:\n${execError.stdout}\n\n`;
					}
					if (execError.stderr) {
						output += `STDERR:\n${execError.stderr}`;
					}
					return output;
				}
				return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
		{
			name: "bash",
			description: "Executes a bash command in the working directory. Use this for running shell commands, installing packages, running tests, etc. The command runs with a 30-second timeout and 10MB output buffer limit.",
			schema: z.object({
				command: z.string().describe("The bash command to execute (e.g., 'ls -la', 'npm install', 'git status')"),
			}),
		},
	),
];