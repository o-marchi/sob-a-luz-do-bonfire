#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { adminApi } from "./apiClient.js";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { z } from "zod";
import {
  applyMonthlyPlanSchema,
  attachPoolToCampaignSchema,
  bulkParticipantsSchema,
  campaignIdSchema,
  createPoolFromGamesSchema,
  finalizeElectionSchema,
  monthlyPlanSchema,
  querySchema,
  updateCampaignSchema,
  updateRulesSchema,
  upsertGamesSchema,
} from "./schemas.js";

const server = new McpServer({
  name: "sob-a-luz-do-bonfire",
  version: "0.1.0",
});

const jsonContent = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(value, null, 2),
    },
  ],
});

const imageCategory = z
  .enum(["banners", "pictures", "assets"])
  .default("banners");

server.registerTool(
  "import_image",
  {
    title: "Import image into R2",
    description:
      "Copies a direct Postimages or Steam image to the project's R2 bucket and verifies its public URL. Requires user authorization to upload. Returns a URL for a subsequent game update; does not change game records.",
    inputSchema: { sourceUrl: z.string().url(), category: imageCategory },
  },
  async (input) =>
    jsonContent(await adminApi.post("/admin/media/import", input)),
);

server.registerTool(
  "upload_image",
  {
    title: "Upload local image to R2",
    description:
      "Uploads a user-authorized local PNG, JPEG, GIF, or WebP file (up to 8 MiB) to R2 and returns its verified public URL. The path is on the machine running this MCP server. Does not change game records.",
    inputSchema: { filePath: z.string().min(1), category: imageCategory },
  },
  async ({ filePath, category }) => {
    const contentTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = contentTypes[extname(filePath).toLowerCase()];
    const info = await stat(filePath);
    if (!contentType || !info.isFile() || info.size > 8 * 1024 * 1024)
      throw new Error("Choose a PNG, JPEG, GIF, or WebP file up to 8 MiB.");
    const file = new Uint8Array(await readFile(filePath));
    if (file.byteLength > 8 * 1024 * 1024)
      throw new Error("The image exceeds 8 MiB.");
    return jsonContent(await adminApi.uploadImage(file, contentType, category));
  },
);

server.registerTool(
  "get_admin_state",
  {
    title: "Get admin state",
    description:
      "Returns the current campaign, known games, known players, and pools. Use before planning changes.",
    inputSchema: {},
  },
  async () => jsonContent(await adminApi.get("/admin/state")),
);

server.registerTool(
  "get_current_campaign",
  {
    title: "Get current campaign",
    description:
      "Returns only the current campaign with game, pool, options, votes, and participants.",
    inputSchema: {},
  },
  async () => {
    const state = await adminApi.get<{ currentCampaign: unknown }>(
      "/admin/state",
    );
    return jsonContent(state.currentCampaign);
  },
);

server.registerTool(
  "list_games",
  {
    title: "List games",
    description: "Searches the game library by title or Steam URL.",
    inputSchema: querySchema.shape,
  },
  async ({ query }) => {
    const search = query ? `?query=${encodeURIComponent(query)}` : "";
    return jsonContent(await adminApi.get(`/admin/games${search}`));
  },
);

server.registerTool(
  "list_players",
  {
    title: "List players",
    description:
      "Searches players by name, email, Discord username, or global name.",
    inputSchema: querySchema.shape,
  },
  async ({ query }) => {
    const search = query ? `?query=${encodeURIComponent(query)}` : "";
    return jsonContent(await adminApi.get(`/admin/players${search}`));
  },
);

server.registerTool(
  "get_rules",
  {
    title: "Get website rules",
    description:
      "Returns the Markdown rules currently shown on the public website.",
    inputSchema: {},
  },
  async () => jsonContent(await adminApi.get("/admin/rules")),
);

server.registerTool(
  "update_rules",
  {
    title: "Update website rules",
    description:
      "Replaces the Markdown rules shown on the public website. Only use after explicit user confirmation.",
    inputSchema: updateRulesSchema.shape,
  },
  async (input) => jsonContent(await adminApi.patch("/admin/rules", input)),
);

server.registerTool(
  "preview_monthly_plan",
  {
    title: "Preview monthly plan",
    description:
      "Validates a full monthly campaign update, including historical game recommender provenance, and returns a safe diff plus confirmation token. This does not modify data.",
    inputSchema: monthlyPlanSchema.shape,
  },
  async (input) =>
    jsonContent(await adminApi.post("/admin/monthly-plan/preview", input)),
);

server.registerTool(
  "apply_monthly_plan",
  {
    title: "Apply monthly plan",
    description:
      "Applies a monthly campaign plan transactionally. Must use the confirmationToken returned by preview_monthly_plan.",
    inputSchema: applyMonthlyPlanSchema.shape,
  },
  async (input) =>
    jsonContent(await adminApi.post("/admin/monthly-plan/apply", input)),
);

server.registerTool(
  "upsert_games",
  {
    title: "Upsert games",
    description:
      "Creates or updates games by id or normalized title. Prefer preview_monthly_plan for full monthly setup.",
    inputSchema: upsertGamesSchema.shape,
  },
  async (input) =>
    jsonContent(await adminApi.post("/admin/games/upsert-many", input)),
);

server.registerTool(
  "create_pool_from_games",
  {
    title: "Create pool from games",
    description:
      "Creates or reuses a pool with the provided game ids/titles. Can optionally attach it to a campaign.",
    inputSchema: createPoolFromGamesSchema.shape,
  },
  async (input) =>
    jsonContent(await adminApi.post("/admin/pools/from-games", input)),
);

server.registerTool(
  "attach_pool_to_campaign",
  {
    title: "Attach pool to campaign",
    description:
      "Attaches an existing pool to a campaign, or to the current campaign if campaignId is omitted.",
    inputSchema: attachPoolToCampaignSchema.shape,
  },
  async (input) =>
    jsonContent(await adminApi.post("/admin/pools/attach-to-campaign", input)),
);

server.registerTool(
  "update_campaign",
  {
    title: "Update campaign",
    description:
      "Updates campaign metadata such as description, meeting details, game, pool, electionActive, or current status.",
    inputSchema: updateCampaignSchema.shape,
  },
  async ({ campaignId, ...body }) =>
    jsonContent(await adminApi.patch(`/admin/campaigns/${campaignId}`, body)),
);

server.registerTool(
  "bulk_update_campaign_participants",
  {
    title: "Bulk update campaign participants",
    description:
      "Adds or updates campaign participant flags and optionally records the exact suggested game by ID or title.",
    inputSchema: bulkParticipantsSchema.shape,
  },
  async ({ campaignId, participants }) =>
    jsonContent(
      await adminApi.post(`/admin/campaigns/${campaignId}/participants/bulk`, {
        participants,
      }),
    ),
);

server.registerTool(
  "get_election_result",
  {
    title: "Get election result",
    description: "Calculates token-weighted pool results for a campaign.",
    inputSchema: campaignIdSchema.shape,
  },
  async ({ campaignId }) =>
    jsonContent(
      await adminApi.get(`/admin/campaigns/${campaignId}/election-result`),
    ),
);

server.registerTool(
  "finalize_election",
  {
    title: "Finalize election",
    description:
      "Calculates the election winner, assigns the winning game to the campaign, and disables electionActive.",
    inputSchema: finalizeElectionSchema.shape,
  },
  async ({ campaignId, allowTie }) =>
    jsonContent(
      await adminApi.post(`/admin/campaigns/${campaignId}/finalize-election`, {
        allowTie,
      }),
    ),
);

server.registerResource(
  "current_campaign",
  "sobaluz://campaign/current",
  {
    title: "Current campaign",
    description:
      "Current campaign with participants, pool, options, and votes.",
    mimeType: "application/json",
  },
  async (uri) => {
    const state = await adminApi.get<{ currentCampaign: unknown }>(
      "/admin/state",
    );

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(state.currentCampaign, null, 2),
        },
      ],
    };
  },
);

server.registerResource(
  "token_rules",
  "sobaluz://rules/tokens",
  {
    title: "Website rules",
    description:
      "Rules currently published on the Sob a Luz do Bonfire website.",
    mimeType: "text/markdown",
  },
  async (uri) => {
    const rules = await adminApi.get<{ content: string }>("/admin/rules");

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: rules.content,
        },
      ],
    };
  },
);

server.registerPrompt(
  "prepare_monthly_campaign",
  {
    title: "Prepare monthly campaign",
    description:
      "Guide an agent through safely adding games, creating a pool, updating description, and enabling voting.",
    argsSchema: {
      notes: monthlyPlanSchema.optional(),
    },
  },
  ({ notes }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Prepare a monthly Sob a Luz do Bonfire campaign update.",
            "Always call get_current_campaign and list_games/list_players as needed before writing.",
            "Call preview_monthly_plan first and show the diff to the user.",
            "Only call apply_monthly_plan after explicit confirmation, using the confirmationToken from preview.",
            notes
              ? `Initial structured notes: ${JSON.stringify(notes, null, 2)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      },
    ],
  }),
);

server.registerPrompt(
  "record_meeting_attendance",
  {
    title: "Record meeting attendance",
    description:
      "Guide an agent through resolving players and updating partook_in_the_meeting plus related flags.",
    argsSchema: {
      notes: bulkParticipantsSchema.optional(),
    },
  },
  ({ notes }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            "Record meeting attendance for the current campaign.",
            "Resolve ambiguous player names with list_players before applying updates.",
            "Prefer preview_monthly_plan when multiple participant flags or campaign changes are involved.",
            "Only write after explicit user confirmation.",
            notes
              ? `Initial structured notes: ${JSON.stringify(notes, null, 2)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
