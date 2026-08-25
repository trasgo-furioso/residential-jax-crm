import { z } from 'zod';
import { type LanguageModel, generateText, tool } from 'ai';
import { publicProcedure, router } from './trpc.js';
import { db } from '@/lib/db/index.js';
import { opportunities } from '@/lib/db/schema.js';
import { eq } from 'drizzle-orm';

// ── Pipeline MCP client (replaces local DuckDB) ──────────────────────────────
const PIPELINE_MCP_URL =
  process.env.PIPELINE_MCP_URL ??
  'https://k9f346jdz9.execute-api.us-east-2.amazonaws.com/v1/mcp';

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

async function callPipelineMcp(
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const response = await fetch(PIPELINE_MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Pipeline MCP call failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(
      `Pipeline MCP error: ${body.error.message ?? JSON.stringify(body.error)}`,
    );
  }

  return body.result as McpToolResult;
}

interface PropertyRow {
  parcel_id: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  assessed_value: number;
  market_value: number;
  current_owner_name: string;
  lat: number;
  lng: number;
  year_built: number | null;
  sqft: number | null;
  roof_age_years: number | null;
  ownership_tenure_years: number | null;
  is_regional_owner: boolean | null;
  water_proximity_ft: number | null;
  transit_distance_mi: number | null;
  provenance_sources: string;
  provenance_last_run: string;
  provenance_timestamps?: string;
}

/**
 * Resolve the AI model provider at runtime.
 * Prefers Anthropic when ANTHROPIC_API_KEY is set,
 * falls back to OpenAI, then Amazon Bedrock.
 */
async function resolveModel(): Promise<LanguageModel> {
  if (process.env.ANTHROPIC_API_KEY) {
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic('claude-haiku-4-5-20251001') as LanguageModel;
  }
  if (process.env.OPENAI_API_KEY) {
    const { createOpenAI } = await import('@ai-sdk/openai');
    const provider = createOpenAI();
    return provider.languageModel(process.env.OPENAI_MODEL_ID ?? 'gpt-4o') as LanguageModel;
  }
  if (process.env.BEDROCK_MODEL_ID) {
    const { createAmazonBedrock } = await import('@ai-sdk/amazon-bedrock');
    const provider = createAmazonBedrock();
    return provider.languageModel(process.env.BEDROCK_MODEL_ID) as LanguageModel;
  }
  throw new Error(
    'No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or BEDROCK_MODEL_ID.',
  );
}

const SYSTEM_PROMPT = `You are a helpful property acquisition assistant for a residential CRM in Jacksonville, FL.
You have access to the Oracle Property Intelligence pipeline's property database (via MCP) with the following columns:

- parcel_id (TEXT) — unique parcel identifier
- address_street, address_city, address_zip (TEXT)
- assessed_value, market_value (NUMERIC)
- current_owner_name (TEXT)
- lat, lng (DOUBLE)
- year_built (INTEGER)
- sqft (INTEGER)
- roof_age_years (INTEGER) — estimated age of the roof in years
- ownership_tenure_years (INTEGER) — how long the current owner has held the property
- is_regional_owner (BOOLEAN) — whether the owner is a regional/institutional investor
- water_proximity_ft (DOUBLE) — distance to nearest water body in feet
- transit_distance_mi (DOUBLE) — distance to nearest transit stop in miles
- provenance_sources (TEXT) — comma-separated list of data sources
- provenance_last_run (TEXT) — ISO timestamp of last pipeline run
- provenance_timestamps (TEXT) — JSON of per-source collection timestamps

IMPORTANT — Jacksonville neighborhoods:
All properties in the database have address_city = 'Jacksonville'. There are NO separate cities
for neighborhoods. When a user mentions a neighborhood or area name, do NOT use address_city to
filter by that name. Instead, use the ZIP code mapping below with address_zip IN (...).

Jacksonville neighborhood to ZIP code mapping:
- Arlington: 32211, 32225, 32246
- Riverside / Avondale: 32204, 32205
- San Marco: 32207
- Springfield: 32206
- Ortega: 32210
- Mandarin: 32223, 32257, 32258
- Westside: 32210, 32221
- Northside: 32218, 32219, 32220
- Beaches (Jacksonville Beach, Neptune Beach, Atlantic Beach): 32233, 32250, 32266
- Southside: 32216, 32246, 32256

Example: if the user asks about "Arlington properties", use:
  address_zip IN ('32211','32225','32246')
Do NOT use: address_city = 'Arlington'

If a neighborhood is not in the list above, try matching with:
  address_street LIKE '%NEIGHBORHOOD_NAME%'
as a fallback, since some street names contain area references.

When the user asks about properties, use the queryProperties tool to search the database.
Build a SQL WHERE clause using the column names above. Use DuckDB SQL syntax.
Always limit results to a reasonable number (default 20) unless the user asks for more.

IMPORTANT — Price / value filtering:
assessed_value and market_value are NUMERIC columns storing raw dollar amounts as numbers (no $ sign, no commas).
When the user says "under $200k" or "below 200,000", use a simple numeric comparison:
  assessed_value < 200000
Do NOT use CAST, REPLACE, or string functions on these columns — they are already numeric.
Use strict inequality (< or >) so that "under $200k" excludes $200,000 exactly.

Examples:
- "properties under $200k" → assessed_value < 200000
- "homes between $150k and $300k" → assessed_value >= 150000 AND assessed_value <= 300000
- "over $500k" → assessed_value > 500000

When the user asks about the CRM status of a specific property, use the getOpportunityStatus tool.

Respond conversationally. Summarize the results clearly. Mention how many properties matched.
If properties are returned, highlight key attributes (address, assessed value, roof age, ownership tenure).
Always mention the provenance sources so the user knows where the data comes from.`;

/**
 * Query properties via the pipeline MCP server (JSON-RPC over HTTP).
 * Sanitizes input to block DML keywords.
 */
async function executePropertyQuery(
  sqlWhere?: string,
  limit?: number,
): Promise<PropertyRow[]> {
  const effectiveLimit = Math.min(limit ?? 20, 200);

  // Sanitize: strip semicolons, block DML keywords
  const clause = sqlWhere ? sqlWhere.replace(/;/g, '').trim() : '';
  const forbidden = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\b/i;
  if (clause && forbidden.test(clause)) {
    throw new Error('Disallowed SQL keyword in WHERE clause');
  }

  const sql = clause
    ? `SELECT * FROM properties WHERE ${clause} LIMIT ${effectiveLimit}`
    : `SELECT * FROM properties LIMIT ${effectiveLimit}`;

  const mcpResult = await callPipelineMcp('queryProperties', {
    county: 'duval',
    sql,
  });

  if (mcpResult.isError) {
    const errText = mcpResult.content[0]?.text ?? 'Unknown MCP error';
    throw new Error(`Property query failed: ${errText}`);
  }

  const responseText = mcpResult.content[0]?.text ?? '{"rows":[]}';
  const { rows } = JSON.parse(responseText) as { rows: PropertyRow[] };
  return rows;
}

export const agentRouter = router({
  chat: publicProcedure
    .input(z.object({ message: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const model = await resolveModel();
      let matchedProperties: PropertyRow[] = [];
      const toolCallLog: unknown[] = [];

      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: input.message,
        tools: {
          queryProperties: tool({
            description:
              'Query the property database with an optional SQL WHERE clause. Returns matching properties with provenance data.',
            inputSchema: z.object({
              sql_where: z
                .string()
                .optional()
                .describe(
                  'SQL WHERE clause to filter properties (e.g. "roof_age_years > 15 AND address_zip IN (\'32211\',\'32225\',\'32246\')")',
                ),
              limit: z
                .number()
                .optional()
                .describe('Maximum number of results to return (default 20)'),
            }),
            execute: async ({ sql_where, limit }: { sql_where?: string; limit?: number }) => {
              const properties = await executePropertyQuery(sql_where, limit);
              matchedProperties = properties;
              toolCallLog.push({
                tool: 'queryProperties',
                args: { sql_where, limit },
                resultCount: properties.length,
              });
              return {
                count: properties.length,
                properties: properties.map((p) => ({
                  parcel_id: p.parcel_id,
                  address: `${p.address_street}, ${p.address_city} ${p.address_zip}`,
                  assessed_value: p.assessed_value,
                  market_value: p.market_value,
                  owner: p.current_owner_name,
                  roof_age_years: p.roof_age_years,
                  ownership_tenure_years: p.ownership_tenure_years,
                  is_regional_owner: p.is_regional_owner,
                  water_proximity_ft: p.water_proximity_ft,
                  year_built: p.year_built,
                  sqft: p.sqft,
                  provenance_sources: p.provenance_sources,
                  provenance_last_run: p.provenance_last_run,
                })),
              };
            },
          }),
          getOpportunityStatus: tool({
            description:
              'Check if a property has an existing CRM opportunity and return its stage/status.',
            inputSchema: z.object({
              parcel_id: z
                .string()
                .describe('The parcel ID of the property to check'),
            }),
            execute: async ({ parcel_id }: { parcel_id: string }) => {
              const rows = await db
                .select()
                .from(opportunities)
                .where(eq(opportunities.parcel_id, parcel_id));

              toolCallLog.push({
                tool: 'getOpportunityStatus',
                args: { parcel_id },
                found: rows.length > 0,
              });

              if (rows.length === 0) {
                return {
                  found: false,
                  message: `No CRM opportunity exists for parcel ${parcel_id}`,
                };
              }

              const opp = rows[0];
              return {
                found: true,
                id: opp.id,
                stage: opp.stage,
                owner_name: opp.owner_name,
                created_at: opp.created_at,
                updated_at: opp.updated_at,
                notes: opp.notes,
                next_steps: opp.next_steps,
              };
            },
          }),
        },
        maxSteps: 5,
      });

      return {
        response: result.text,
        properties: matchedProperties.map((p) => ({
          parcel_id: p.parcel_id,
          address_street: p.address_street,
          address_city: p.address_city,
          address_zip: p.address_zip,
          assessed_value: p.assessed_value,
          market_value: p.market_value,
          current_owner_name: p.current_owner_name,
          lat: p.lat,
          lng: p.lng,
          year_built: p.year_built,
          sqft: p.sqft,
          roof_age_years: p.roof_age_years,
          ownership_tenure_years: p.ownership_tenure_years,
          is_regional_owner: p.is_regional_owner,
          water_proximity_ft: p.water_proximity_ft,
          transit_distance_mi: p.transit_distance_mi,
          provenance_sources: p.provenance_sources,
          provenance_last_run: p.provenance_last_run,
        })),
        toolCalls: toolCallLog,
      };
    }),
});
