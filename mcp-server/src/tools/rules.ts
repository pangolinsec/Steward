import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, patch, campaignId, c, handleError } from "../client.js";

interface Rule {
  id: number;
  campaign_id: number;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>[];
  action_mode: string;
  priority: number;
  tags: string[];
  target_mode: string;
  target_config: Record<string, unknown>;
}

interface TestResult {
  overall_pass: boolean;
  details: Record<string, unknown>;
  character_used?: { id: number; name: string };
  environment_snapshot: Record<string, unknown>;
  actions_would_fire: Record<string, unknown>[];
}

interface RuleReference {
  rule_id: number;
  rule_name: string;
  enabled: boolean;
  references: { location: string; detail: string }[];
}

function formatRule(r: Rule): string {
  const lines: string[] = [];
  const status = r.enabled ? "enabled" : "DISABLED";
  lines.push(`## ${r.name} (id: ${r.id}, ${status})\n`);
  if (r.description) lines.push(`*${r.description}*\n`);
  lines.push(`**Trigger:** ${r.trigger_type} | **Mode:** ${r.action_mode} | **Priority:** ${r.priority} | **Target:** ${r.target_mode}`);
  if (r.tags.length > 0) lines.push(`**Tags:** ${r.tags.join(", ")}`);
  lines.push("");

  if (r.trigger_config && Object.keys(r.trigger_config).length > 0) {
    lines.push(`**Trigger Config:** \`${JSON.stringify(r.trigger_config)}\``);
  }
  lines.push(`**Conditions:** \`${JSON.stringify(r.conditions)}\``);
  lines.push(`**Actions:** \`${JSON.stringify(r.actions)}\``);
  if (r.target_config && Object.keys(r.target_config).length > 0) {
    lines.push(`**Target Config:** \`${JSON.stringify(r.target_config)}\``);
  }
  return lines.join("\n");
}

export function registerRuleTools(server: McpServer): void {
  server.registerTool(
    "steward_list_rules",
    {
      title: "List Rules",
      description:
        "List all automation rules. Filterable by name search, trigger type, or tag.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        search: z.string().optional().describe("Search by rule name"),
        trigger_type: z.string().optional().describe("Filter by trigger type (e.g. on_time_advance, on_rest, on_encounter)"),
        tag: z.string().optional().describe("Filter by tag"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.search) qp.set("search", params.search);
        if (params.trigger_type) qp.set("trigger_type", params.trigger_type);
        if (params.tag) qp.set("tag", params.tag);
        const qs = qp.toString();
        const rules = await get<Rule[]>(c(cId, `/rules${qs ? "?" + qs : ""}`));
        if (rules.length === 0) return { content: [{ type: "text", text: "No rules found." }] };

        const lines = ["## Rules\n"];
        for (const r of rules) {
          const status = r.enabled ? "" : " [DISABLED]";
          const tags = r.tags.length > 0 ? ` [${r.tags.join(", ")}]` : "";
          lines.push(`- **${r.name}** (id: ${r.id})${status} — ${r.trigger_type}, ${r.action_mode}${tags}`);
          if (r.description) lines.push(`  ${r.description}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_get_rule",
    {
      title: "Get Rule Details",
      description:
        "Get full details of a rule including conditions tree, actions, trigger config, and target config.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rule_id: z.number().int().describe("Rule ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const rule = await get<Rule>(c(cId, `/rules/${params.rule_id}`));
        return { content: [{ type: "text", text: formatRule(rule) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_create_rule",
    {
      title: "Create Rule",
      description:
        "Create a new automation rule. Rules trigger on game events and evaluate conditions to fire actions. Use steward_get_campaign for attribute keys and steward_list_status_effects/items for entity names used in conditions and actions.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Rule name"),
        trigger_type: z
          .enum([
            "on_time_advance", "on_effect_change", "on_item_change",
            "on_threshold", "on_location_change", "on_rest",
            "on_schedule", "on_encounter",
          ])
          .describe("Event that triggers evaluation"),
        description: z.string().optional().describe("Rule description"),
        enabled: z.boolean().optional().describe("Whether rule is active (default: true)"),
        trigger_config: z.record(z.unknown()).optional().describe("Trigger-specific configuration"),
        conditions: z.record(z.unknown()).optional().describe("Condition tree: { all: [...] } or { any: [...] }"),
        actions: z.array(z.record(z.unknown())).optional().describe("Array of action objects"),
        action_mode: z.enum(["auto", "suggest"]).optional().describe("auto = apply immediately, suggest = create notification (default: auto)"),
        priority: z.number().int().optional().describe("Evaluation priority, lower = first (default: 100)"),
        tags: z.array(z.string()).optional().describe("Tags for organization"),
        target_mode: z
          .enum(["environment", "all_pcs", "all_npcs", "all_characters", "specific_characters"])
          .optional()
          .describe("Who actions target (default: environment)"),
        target_config: z.record(z.unknown()).optional().describe("Target-specific config (e.g. { character_ids: [1,2] })"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<Rule>(c(cId, "/rules"), {
          name: params.name,
          trigger_type: params.trigger_type,
          description: params.description ?? "",
          enabled: params.enabled ?? true,
          trigger_config: params.trigger_config ?? {},
          conditions: params.conditions ?? { all: [] },
          actions: params.actions ?? [],
          action_mode: params.action_mode ?? "auto",
          priority: params.priority ?? 100,
          tags: params.tags ?? [],
          target_mode: params.target_mode ?? "environment",
          target_config: params.target_config ?? {},
        });
        return { content: [{ type: "text", text: `Rule **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_rule",
    {
      title: "Update Rule",
      description: "Update a rule's fields. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rule_id: z.number().int().describe("Rule ID"),
        name: z.string().optional().describe("Rule name"),
        description: z.string().optional().describe("Rule description"),
        enabled: z.boolean().optional().describe("Whether rule is active"),
        trigger_type: z
          .enum([
            "on_time_advance", "on_effect_change", "on_item_change",
            "on_threshold", "on_location_change", "on_rest",
            "on_schedule", "on_encounter",
          ])
          .optional()
          .describe("Trigger event"),
        trigger_config: z.record(z.unknown()).optional().describe("Trigger config"),
        conditions: z.record(z.unknown()).optional().describe("Condition tree (replaces all)"),
        actions: z.array(z.record(z.unknown())).optional().describe("Actions array (replaces all)"),
        action_mode: z.enum(["auto", "suggest"]).optional().describe("Action mode"),
        priority: z.number().int().optional().describe("Priority"),
        tags: z.array(z.string()).optional().describe("Tags (replaces all)"),
        target_mode: z
          .enum(["environment", "all_pcs", "all_npcs", "all_characters", "specific_characters"])
          .optional()
          .describe("Target mode"),
        target_config: z.record(z.unknown()).optional().describe("Target config"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, rule_id, ...fields } = params;
        const result = await put<Rule>(c(cId, `/rules/${rule_id}`), fields);
        return { content: [{ type: "text", text: `Rule **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_delete_rule",
    {
      title: "Delete Rule",
      description: "Permanently delete a rule.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rule_id: z.number().int().describe("Rule ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/rules/${params.rule_id}`));
        return { content: [{ type: "text", text: "Rule deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_toggle_rule",
    {
      title: "Toggle Rule",
      description: "Enable or disable a rule. Toggles the current enabled state.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rule_id: z.number().int().describe("Rule ID to toggle"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await patch<Rule>(c(cId, `/rules/${params.rule_id}/toggle`));
        const state = result.enabled ? "enabled" : "disabled";
        return { content: [{ type: "text", text: `Rule **${result.name}** is now **${state}**.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_test_rule",
    {
      title: "Test Rule (Dry Run)",
      description:
        "Dry-run a rule against the current game state. Shows whether conditions pass, what the environment snapshot looks like, and what actions would fire — without actually applying anything.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rule_id: z.number().int().describe("Rule ID to test"),
        character_id: z.number().int().optional().describe("Specific character to test against (for character-targeted rules)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const body: Record<string, unknown> = {};
        if (params.character_id) body.character_id = params.character_id;
        const result = await post<TestResult>(c(cId, `/rules/${params.rule_id}/test`), body);

        const lines: string[] = [];
        lines.push(`## Rule Test Result\n`);
        lines.push(`**Overall:** ${result.overall_pass ? "PASS" : "FAIL"}\n`);

        if (result.character_used) {
          lines.push(`**Character:** ${result.character_used.name} (id: ${result.character_used.id})`);
        }

        const env = result.environment_snapshot;
        const envParts: string[] = [];
        if (env.weather) envParts.push(`weather: ${env.weather}`);
        if (env.time_of_day) envParts.push(`time: ${env.time_of_day}`);
        if (env.current_hour != null) envParts.push(`hour: ${env.current_hour}`);
        if (env.current_location_id) envParts.push(`location_id: ${env.current_location_id}`);
        if (envParts.length > 0) lines.push(`**Environment:** ${envParts.join(", ")}`);
        lines.push("");

        lines.push(`**Condition Details:** \`${JSON.stringify(result.details)}\`\n`);

        if (result.actions_would_fire.length > 0) {
          lines.push("**Actions that would fire:**");
          for (const a of result.actions_would_fire) {
            lines.push(`- \`${JSON.stringify(a)}\``);
          }
        } else {
          lines.push("**No actions would fire.**");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_run_rule",
    {
      title: "Run Rule",
      description:
        "Manually run a rule against the current game state, bypassing trigger requirements and the enabled flag. Evaluates conditions and executes actions directly. Use this when you want to force-fire a rule without waiting for its trigger.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rule_id: z.number().int().describe("Rule ID to run"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<{ fired: boolean; results: { target: string; target_id: number | null; status: string; reason?: string; actions?: { success: boolean; description: string }[] }[] }>(
          c(cId, `/rules/${params.rule_id}/run`),
          {},
        );

        const lines: string[] = [];
        lines.push(`## Run Rule Result\n`);
        lines.push(`**Fired:** ${result.fired ? "Yes" : "No"}\n`);

        for (const r of result.results) {
          if (r.status === "applied") {
            lines.push(`- **${r.target}**: Applied`);
            for (const a of r.actions ?? []) {
              lines.push(`  - ${a.success ? "OK" : "FAIL"}: ${a.description}`);
            }
          } else {
            lines.push(`- **${r.target}**: Skipped — ${r.reason}`);
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_get_rule_references",
    {
      title: "Find Rule References",
      description:
        "Find which rules reference a given entity (effect, item, location, weather, attribute, or character). Useful for impact analysis before deleting or renaming entities.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        entity_type: z
          .enum(["effect", "item", "location", "weather", "attribute", "character"])
          .describe("Type of entity to search for"),
        entity_name: z.string().optional().describe("Entity name to search for"),
        entity_id: z.number().int().optional().describe("Entity ID (for locations/characters)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        qp.set("entity_type", params.entity_type);
        if (params.entity_name) qp.set("entity_name", params.entity_name);
        if (params.entity_id != null) qp.set("entity_id", String(params.entity_id));
        const refs = await get<RuleReference[]>(c(cId, `/rules/references?${qp}`));

        if (refs.length === 0) {
          return { content: [{ type: "text", text: `No rules reference this ${params.entity_type}.` }] };
        }

        const lines = [`## Rules referencing ${params.entity_type}${params.entity_name ? ` "${params.entity_name}"` : ""}\n`];
        for (const r of refs) {
          const status = r.enabled ? "" : " [DISABLED]";
          lines.push(`- **${r.rule_name}** (id: ${r.rule_id})${status}`);
          for (const ref of r.references) {
            lines.push(`  - ${ref.location}: ${ref.detail}`);
          }
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
