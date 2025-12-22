import inquirer from "inquirer";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const tools = [
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
	// tool(async () => {}, {name: "think"})
];