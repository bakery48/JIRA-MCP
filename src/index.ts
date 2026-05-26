import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL ?? "";
const JIRA_EMAIL = process.env.JIRA_EMAIL ?? "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? "";

const jiraClient = axios.create({
  baseURL: `${JIRA_BASE_URL}/rest/api/3`,
  headers: {
    Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const server = new Server(
  { name: "jira-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "jira_get_issue",
        description: "Get a JIRA issue by key",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "The JIRA issue key (e.g. PROJECT-123)",
            },
          },
          required: ["issue_key"],
        },
      },
      {
        name: "jira_search_issues",
        description: "Search JIRA issues using JQL",
        inputSchema: {
          type: "object",
          properties: {
            jql: {
              type: "string",
              description: "JQL query string",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (default 20)",
            },
          },
          required: ["jql"],
        },
      },
      {
        name: "jira_create_issue",
        description: "Create a new JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            project_key: {
              type: "string",
              description: "The JIRA project key (e.g. PROJECT)",
            },
            summary: {
              type: "string",
              description: "Issue summary/title",
            },
            description: {
              type: "string",
              description: "Issue description",
            },
            issue_type: {
              type: "string",
              description: "Issue type (default: Task)",
            },
            priority: {
              type: "string",
              description: "Issue priority (e.g. High, Medium, Low)",
            },
            assignee: {
              type: "string",
              description: "Assignee account ID or email",
            },
          },
          required: ["project_key", "summary"],
        },
      },
      {
        name: "jira_update_issue",
        description: "Update an existing JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "The JIRA issue key (e.g. PROJECT-123)",
            },
            summary: {
              type: "string",
              description: "New summary/title",
            },
            description: {
              type: "string",
              description: "New description",
            },
            priority: {
              type: "string",
              description: "New priority",
            },
            assignee: {
              type: "string",
              description: "New assignee account ID or email",
            },
          },
          required: ["issue_key"],
        },
      },
      {
        name: "jira_add_comment",
        description: "Add a comment to a JIRA issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "The JIRA issue key (e.g. PROJECT-123)",
            },
            comment: {
              type: "string",
              description: "Comment text",
            },
          },
          required: ["issue_key", "comment"],
        },
      },
      {
        name: "jira_transition_issue",
        description: "Transition a JIRA issue to a new status",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "The JIRA issue key (e.g. PROJECT-123)",
            },
            transition_name: {
              type: "string",
              description: "Name of the transition (e.g. In Progress, Done)",
            },
          },
          required: ["issue_key", "transition_name"],
        },
      },
      {
        name: "jira_get_projects",
        description: "List available JIRA projects",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "jira_get_issue": {
        const { issue_key } = args as { issue_key: string };
        const response = await jiraClient.get(`/issue/${issue_key}`, {
          params: {
            fields:
              "summary,status,assignee,description,priority,labels,comment",
          },
        });
        const issue = response.data;
        const fields = issue.fields;
        const commentsCount = fields.comment?.total ?? 0;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  key: issue.key,
                  summary: fields.summary,
                  status: fields.status?.name,
                  assignee: fields.assignee?.displayName ?? "Unassigned",
                  description:
                    fields.description?.content
                      ?.map((block: { content?: { text?: string }[] }) =>
                        block.content?.map((c) => c.text).join("") ?? ""
                      )
                      .join("\n") ?? "",
                  priority: fields.priority?.name,
                  labels: fields.labels,
                  comments_count: commentsCount,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "jira_search_issues": {
        const { jql, max_results = 20 } = args as {
          jql: string;
          max_results?: number;
        };
        const response = await jiraClient.get("/search", {
          params: {
            jql,
            maxResults: max_results,
            fields: "summary,status,assignee",
          },
        });
        const issues = response.data.issues.map(
          (issue: {
            key: string;
            fields: {
              summary: string;
              status: { name: string };
              assignee: { displayName: string } | null;
            };
          }) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status?.name,
            assignee: issue.fields.assignee?.displayName ?? "Unassigned",
          })
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: response.data.total,
                  issues,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "jira_create_issue": {
        const {
          project_key,
          summary,
          description,
          issue_type = "Task",
          priority,
          assignee,
        } = args as {
          project_key: string;
          summary: string;
          description?: string;
          issue_type?: string;
          priority?: string;
          assignee?: string;
        };

        const fields: Record<string, unknown> = {
          project: { key: project_key },
          summary,
          issuetype: { name: issue_type },
        };

        if (description) {
          fields.description = {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }],
              },
            ],
          };
        }

        if (priority) {
          fields.priority = { name: priority };
        }

        if (assignee) {
          fields.assignee = { accountId: assignee };
        }

        const response = await jiraClient.post("/issue", { fields });
        const createdIssue = response.data;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  key: createdIssue.key,
                  url: `${JIRA_BASE_URL}/browse/${createdIssue.key}`,
                  message: `Issue ${createdIssue.key} created successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "jira_update_issue": {
        const { issue_key, summary, description, priority, assignee } =
          args as {
            issue_key: string;
            summary?: string;
            description?: string;
            priority?: string;
            assignee?: string;
          };

        const fields: Record<string, unknown> = {};

        if (summary) {
          fields.summary = summary;
        }

        if (description) {
          fields.description = {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: description }],
              },
            ],
          };
        }

        if (priority) {
          fields.priority = { name: priority };
        }

        if (assignee) {
          fields.assignee = { accountId: assignee };
        }

        await jiraClient.put(`/issue/${issue_key}`, { fields });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Issue ${issue_key} updated successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "jira_add_comment": {
        const { issue_key, comment } = args as {
          issue_key: string;
          comment: string;
        };

        const response = await jiraClient.post(`/issue/${issue_key}/comment`, {
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: comment }],
              },
            ],
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  comment_id: response.data.id,
                  message: `Comment added to ${issue_key} successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "jira_transition_issue": {
        const { issue_key, transition_name } = args as {
          issue_key: string;
          transition_name: string;
        };

        const transitionsResponse = await jiraClient.get(
          `/issue/${issue_key}/transitions`
        );
        const transitions = transitionsResponse.data.transitions as Array<{
          id: string;
          name: string;
        }>;

        const transition = transitions.find(
          (t) => t.name.toLowerCase() === transition_name.toLowerCase()
        );

        if (!transition) {
          const availableTransitions = transitions.map((t) => t.name);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: `Transition "${transition_name}" not found`,
                    available_transitions: availableTransitions,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        await jiraClient.post(`/issue/${issue_key}/transitions`, {
          transition: { id: transition.id },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Issue ${issue_key} transitioned to "${transition.name}" successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "jira_get_projects": {
        const response = await jiraClient.get("/project");
        const projects = response.data.map(
          (project: {
            key: string;
            name: string;
            projectTypeKey: string;
          }) => ({
            key: project.key,
            name: project.name,
            type: project.projectTypeKey,
          })
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ projects }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const axiosError = error as {
      response?: { status: number; data: unknown };
    };
    const details = axiosError.response
      ? ` (HTTP ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)})`
      : "";

    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${errorMessage}${details}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("JIRA MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
