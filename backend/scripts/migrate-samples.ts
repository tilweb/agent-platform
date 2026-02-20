/**
 * Migration Script: Convert POC sample projects to Projektauftrag format
 * Run with: bun run scripts/migrate-samples.ts
 */

import { stringify } from 'yaml';

const SOURCE_DIR = '/Users/andreasbachmann/Documents/Development/PMAssistant/ki-projektwerk/data/projects';
const TARGET_DIR = './data/apps/projektmanagement/projektauftraege';

interface SampleProject {
  meta: {
    source_folder: string;
    type: string;
    source_type: string;
    tags: string[];
  };
  contents: {
    head: string;
    goals: string;
    criteria: string;
    milestones: string;
    budget: string;
    risks: string;
    entities: string;
  };
  history?: {
    logs?: string;
    lessons_learned?: string;
    summary?: string;
  };
}

// Parse TSV lines
function parseTSV(content: string): string[][] {
  return content.split('\n').map(line => line.split('\t'));
}

// Parse date from German format (DD.MM.YY or DD.MM.YYYY)
function parseDate(dateStr: string): string {
  if (!dateStr || dateStr === '^^') return '';
  const cleaned = dateStr.trim();
  const match = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (match) {
    const day = match[1] || '';
    const month = match[2] || '';
    const year = match[3] || '';
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return '';
}

// Parse amount from German format (123.456,00 €)
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Parse probability (10%, 25%, etc.)
function parseProbability(probStr: string): 'low' | 'medium' | 'high' {
  if (!probStr) return 'medium';
  const value = parseInt(probStr.replace('%', ''), 10);
  if (value <= 20) return 'low';
  if (value <= 50) return 'medium';
  return 'high';
}

// Parse effort (e.g., "7,0  " -> 7)
function parseEffort(effortStr: string): number {
  if (!effortStr) return 0;
  const cleaned = effortStr.replace(',', '.').trim();
  return parseFloat(cleaned) || 0;
}

// Generate unique ID
function generateId(): string {
  return `pa_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// Parse head section
function parseHead(head: string): {
  name: string;
  projektId: string;
  projektleiter: string;
  auftraggeber: string;
  startDate: string;
  endDate: string;
  projectType: string;
} {
  const lines = parseTSV(head);
  let name = '', projektId = '', projektleiter = '', auftraggeber = '';
  let startDate = '', endDate = '', projectType = 'internal';

  for (const parts of lines) {
    const joined = parts.join('\t');

    if (joined.includes('Projektname')) {
      name = parts[2] || parts[1] || '';
      projektId = parts.find(p => p.match(/^[A-Z]{2,}\d{2}$/)) || '';
    }
    if (joined.includes('Projektleiter')) {
      projektleiter = parts[2] || '';
    }
    if (joined.includes('Auftraggeber')) {
      auftraggeber = parts[2] || '';
    }
    if (joined.includes('Projektstart')) {
      startDate = parseDate(parts.find(p => p.match(/\d{2}\.\d{2}\.\d{2,4}/)) || '');
    }
    if (joined.includes('Projektende')) {
      endDate = parseDate(parts.find(p => p.match(/\d{2}\.\d{2}\.\d{2,4}/) && !p.includes('start')) || '');
    }
    if (joined.includes('Projekttyp')) {
      const typeStr = parts[parts.length - 1]?.toLowerCase() || '';
      if (typeStr.includes('it')) projectType = 'infrastructure';
      else if (typeStr.includes('extern')) projectType = 'external';
      else if (typeStr.includes('forsch')) projectType = 'research';
    }
  }

  return { name: name.replace(/"/g, ''), projektId, projektleiter, auftraggeber, startDate, endDate, projectType };
}

// Parse goals section
function parseGoals(goals: string): { goalsText: string; criteria: string[] } {
  const criteria: string[] = [];

  // Find the quoted text containing goals
  const quotedMatch = goals.match(/"([^"]+)"/);
  let goalsText = quotedMatch ? (quotedMatch[1] || '').trim() : '';

  if (!goalsText) {
    // Fallback: find long text
    const lines = parseTSV(goals);
    for (const parts of lines) {
      const textPart = parts.find(p => p.length > 50);
      if (textPart) {
        goalsText = textPart.replace(/"/g, '').trim();
        break;
      }
    }
  }

  // Extract numbered criteria (1., 2., 3., etc.)
  // Split by numbered pattern and filter
  const criteriaMatches = goalsText.split(/(?=\d+\.\s)/);
  for (const match of criteriaMatches) {
    const cleaned = match.trim();
    if (/^\d+\.\s/.test(cleaned)) {
      // Remove the number prefix and clean up
      const criterion = cleaned.replace(/^\d+\.\s*/, '').trim();
      if (criterion.length > 10) {
        criteria.push(criterion);
      }
    }
  }

  // Extract the main goal text (before the numbered list)
  const mainGoalMatch = goalsText.match(/^([^0-9]+?)(?=\d+\.)/);
  if (mainGoalMatch) {
    goalsText = (mainGoalMatch[1] || '').trim();
  }

  return { goalsText, criteria };
}

// Parse criteria/requirements section
function parseCriteria(criteriaStr: string): { scope: string; tasks: any[] } {
  const lines = parseTSV(criteriaStr);
  let scope = '';
  const tasks: any[] = [];
  let inTaskList = false;

  for (const parts of lines) {
    const joined = parts.join(' ');

    if (joined.includes('Anforderungen (verbal)')) {
      scope = parts.find(p => p.length > 30) || '';
    }

    if (joined.includes('Anforderungen') && joined.includes('ID') && joined.includes('Bezeichnung')) {
      inTaskList = true;
      continue;
    }

    if (inTaskList && parts[1]?.match(/^HA-\d+$/)) {
      tasks.push({
        id: parts[1],
        name: parts[2] || '',
        responsible: parts[3] || '',
        start_date: '',
        end_date: '',
        effort: parseEffort(parts[4] || '0'),
        status: 'open'
      });
    }
  }

  return { scope: scope.replace(/"/g, '').trim(), tasks };
}

// Parse milestones section
function parseMilestones(milestonesStr: string): any[] {
  const lines = parseTSV(milestonesStr);
  const milestones: any[] = [];
  let inList = false;

  for (const parts of lines) {
    const joined = parts.join(' ');

    if (joined.includes('Meilensteine') && joined.includes('ID')) {
      inList = true;
      continue;
    }

    if (inList && parts[1]?.match(/^MS-\d+$/)) {
      const date = parseDate(parts[3] || '');
      milestones.push({
        id: parts[1],
        name: parts[2] || '',
        date: date,
        description: ''
      });
    }
  }

  return milestones;
}

// Parse budget section
function parseBudget(budgetStr: string): any[] {
  const lines = parseTSV(budgetStr);
  const budget: any[] = [];
  let inList = false;

  for (const parts of lines) {
    const joined = parts.join(' ');

    if (joined.includes('Budget') && joined.includes('ID')) {
      inList = true;
      continue;
    }

    if (inList && parts[1]?.match(/^[A-Z]{2,}\d+$/) && !joined.includes('Summe')) {
      budget.push({
        id: parts[1],
        item: parts[2] || '',
        provider: parts[3] || '',
        amount: parseAmount(parts[4] || '0')
      });
    }
  }

  return budget;
}

// Parse risks section
function parseRisks(risksStr: string): any[] {
  const lines = parseTSV(risksStr);
  const risks: any[] = [];
  let inList = false;
  let currentType = 'technical';

  for (const parts of lines) {
    const joined = parts.join(' ');

    if (joined.includes('Risiken') && joined.includes('ID')) {
      inList = true;
      continue;
    }

    if (inList) {
      if (joined.includes('Bedrohungen')) currentType = 'threat';
      else if (joined.includes('Chancen')) currentType = 'opportunity';

      if (parts[1]?.match(/^[RC]-\d+$/)) {
        risks.push({
          id: parts[1],
          type: currentType,
          description: parts[2] || '',
          probability: parseProbability(parts[3] || ''),
          impact: 'medium', // Default, as original data uses monetary risk value
          mitigation: ''
        });
      }
    }
  }

  return risks;
}

// Parse entities (organization + stakeholders)
function parseEntities(entitiesStr: string): { organization: any[]; stakeholders: any[] } {
  const lines = parseTSV(entitiesStr);
  const organization: any[] = [];
  const stakeholders: any[] = [];
  let inList = false;

  for (const parts of lines) {
    const joined = parts.join(' ');

    if (parts[0] === 'ID' && joined.includes('Name')) {
      inList = true;
      continue;
    }

    if (inList && parts[0] && parts[1]) {
      const gruppe = parts[8] || '';
      const projektOrg = parts[4] || '';

      if (projektOrg.includes('Stakeholder') || gruppe.includes('Kunde') || gruppe.includes('Partner') || gruppe.includes('Wettbewerber') || gruppe.includes('Netzwerk')) {
        stakeholders.push({
          id: parts[0],
          name: parts[1],
          role: parts[2] || projektOrg,
          interest: 'medium',
          influence: 'medium',
          expectations: ''
        });
      } else if (parts[0].match(/^[A-Z]{2}\d*$/)) {
        organization.push({
          id: parts[0],
          name: parts[1],
          role: `${parts[4] || ''} - ${parts[5] || ''}`.trim(),
          email: ''
        });
      }
    }
  }

  return { organization, stakeholders };
}

// Convert sample project to Projektauftrag
function convertProject(sample: SampleProject, index: number): any {
  const head = parseHead(sample.contents.head);
  const { goalsText, criteria } = parseGoals(sample.contents.goals);
  const { scope, tasks } = parseCriteria(sample.contents.criteria);
  const milestones = parseMilestones(sample.contents.milestones);
  const budget = parseBudget(sample.contents.budget);
  const risks = parseRisks(sample.contents.risks);
  const { organization, stakeholders } = parseEntities(sample.contents.entities);

  return {
    id: `sample_${String(index).padStart(2, '0')}`,
    name: head.name || `Sample Project ${index}`,
    project_type: head.projectType,
    start_date: head.startDate,
    end_date: head.endDate,
    projektleiter: head.projektleiter,
    auftraggeber: head.auftraggeber,
    description: `Importiert aus: ${sample.meta.source_folder}`,
    goals: goalsText,
    criteria: criteria.length > 0 ? criteria : ['Erfolgskriterium 1'],
    scope: scope,
    in_scope: [],
    out_scope: [],
    tasks: tasks,
    milestones: milestones,
    budget: budget,
    risks: risks,
    organization: organization.slice(0, 10), // Limit to core team
    stakeholders: stakeholders.slice(0, 10), // Limit to key stakeholders
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'migration',
    status: 'completed',
    current_step: 9,
    // Add history if available
    _source: sample.meta.source_folder,
    _lessons_learned: sample.history?.lessons_learned || '',
    _summary: sample.history?.summary || ''
  };
}

// Main migration function
async function migrate() {
  console.log('Starting migration of sample projects...\n');

  // Ensure target directory exists
  const targetDir = Bun.file(TARGET_DIR);
  await Bun.$`mkdir -p ${TARGET_DIR}`;

  // Get all sample files
  const files = await Array.fromAsync(new Bun.Glob('sample_*.json').scan(SOURCE_DIR));

  console.log(`Found ${files.length} sample projects\n`);

  let migrated = 0;
  let failed = 0;

  for (const file of files.sort()) {
    const index = parseInt(file.match(/sample_(\d+)/)?.[1] || '0', 10);
    const sourcePath = `${SOURCE_DIR}/${file}`;

    try {
      const content = await Bun.file(sourcePath).text();
      const sample = JSON.parse(content) as SampleProject;

      const projektauftrag = convertProject(sample, index);

      // Create directory for this project
      const projectDir = `${TARGET_DIR}/${projektauftrag.id}`;
      await Bun.$`mkdir -p ${projectDir}`;

      // Write YAML file (must be named metadata.yaml for storage service)
      const yamlContent = stringify(projektauftrag);
      await Bun.write(`${projectDir}/metadata.yaml`, yamlContent);

      console.log(`✓ Migrated: ${file} -> ${projektauftrag.id} (${projektauftrag.name})`);
      migrated++;
    } catch (error) {
      console.error(`✗ Failed: ${file} - ${error}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${migrated} successful, ${failed} failed`);
}

// Run migration
migrate().catch(console.error);
