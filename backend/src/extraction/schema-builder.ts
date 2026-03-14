/**
 * Schema Builder - Converts extraction profiles to OpenAI Function Schema
 *
 * Takes the field definitions from a profile and generates a JSON Schema
 * that can be used as an OpenAI function definition for forced function calling.
 */

import type { ExtractionProfile, FieldDefinition, FieldGroup, ArrayGroupDefinition } from './types';
import { isArrayGroup } from './types';
import type { ToolDefinition } from '../services/llm';

/**
 * Map our field types to JSON Schema types
 */
function fieldTypeToJsonSchema(field: FieldDefinition): Record<string, unknown> {
  const schema: Record<string, unknown> = {};

  switch (field.type) {
    case 'text':
      schema.type = 'string';
      break;
    case 'number':
      schema.type = 'number';
      break;
    case 'date':
      schema.type = 'string';
      schema.description = (field.hint || '') + ' (Format: YYYY-MM-DD)';
      break;
    case 'boolean':
      schema.type = 'boolean';
      break;
    default:
      schema.type = 'string';
  }

  // Add description from label + hint
  if (field.type !== 'date') {
    const parts: string[] = [];
    if (field.label) parts.push(field.label);
    if (field.hint) parts.push(field.hint);
    if (parts.length > 0) {
      schema.description = parts.join('. ');
    }
  } else {
    // For date, hint is already in description
    if (field.label) {
      schema.description = field.label + '. ' + (schema.description || '');
    }
  }

  return schema;
}

/**
 * Build JSON Schema properties for a group of fields
 */
function buildGroupSchema(fields: Record<string, FieldDefinition>): {
  properties: Record<string, unknown>;
  required: string[];
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(fields)) {
    properties[name] = fieldTypeToJsonSchema(field);
    if (field.required) {
      required.push(name);
    }
  }

  return { properties, required };
}

/**
 * Build the complete OpenAI function schema from a profile
 */
export function buildFunctionSchema(profile: ExtractionProfile): ToolDefinition {
  const topProperties: Record<string, unknown> = {};
  const topRequired: string[] = [];

  for (const [groupName, group] of Object.entries(profile.fields)) {
    if (isArrayGroup(group)) {
      // Array group → JSON array of objects
      const arrayGroup = group as ArrayGroupDefinition;
      const { properties, required } = buildGroupSchema(arrayGroup._item_fields);

      topProperties[groupName] = {
        type: 'array',
        description: `Liste der ${groupName}`,
        items: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      };
      // Arrays are typically required
      topRequired.push(groupName);
    } else {
      // Object group → JSON object
      const { properties, required } = buildGroupSchema(group as Record<string, FieldDefinition>);

      topProperties[groupName] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
      topRequired.push(groupName);
    }
  }

  const functionName = `extract_${profile.id}`;

  return {
    type: 'function',
    function: {
      name: functionName,
      description: `Extrahiere strukturierte Daten aus: ${profile.description}`,
      parameters: {
        type: 'object',
        properties: topProperties,
        required: topRequired.length > 0 ? topRequired : undefined,
      },
    },
  };
}

/**
 * Build the tool_choice parameter for forced function calling
 */
export function buildToolChoice(profile: ExtractionProfile): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: `extract_${profile.id}`,
    },
  };
}
