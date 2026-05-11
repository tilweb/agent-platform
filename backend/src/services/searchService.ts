/**
 * Unified Search Service
 *
 * Provides unified search across multiple sources:
 * - Chat histories
 * - Knowledge Base
 * - Confluence (via connection tool)
 * - Google Drive (via connection tool)
 */

import { toolRegistry } from '../tools/registry';
import { searchChatHistories, type ChatSearchResult } from './memory';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { UsageContext } from './usageTracking';

const KB_BASE = resolve(process.cwd(), '../data/knowledge-base');

export interface SearchResult {
  id: string;
  type: 'chat' | 'knowledge' | 'confluence' | 'gdrive' | 'gmail' | 'pipedrive' | 'jira' | 'youtrack' | 'contract' | 'docuware' | 'personio';
  title: string;
  snippet?: string;
  metadata: Record<string, any>;
}

export interface UnifiedSearchResponse {
  query: string;
  results: {
    chats: SearchResult[];
    knowledge: SearchResult[];
    confluence: SearchResult[];
    gdrive: SearchResult[];
    gmail: SearchResult[];
    pipedrive: SearchResult[];
    jira: SearchResult[];
    youtrack: SearchResult[];
    contracts: SearchResult[];
    docuware: SearchResult[];
    personio: SearchResult[];
  };
  errors?: { source: string; message: string }[];
}

/**
 * Perform unified search across all sources
 */
export async function unifiedSearch(
  query: string,
  userId?: string,
  sources: string[] = ['chats', 'knowledge', 'confluence', 'gdrive', 'gmail', 'pipedrive', 'jira', 'youtrack', 'contracts', 'docuware', 'personio']
): Promise<UnifiedSearchResponse> {
  const results: UnifiedSearchResponse = {
    query,
    results: { chats: [], knowledge: [], confluence: [], gdrive: [], gmail: [], pipedrive: [], jira: [], youtrack: [], contracts: [], docuware: [], personio: [] },
    errors: [],
  };

  // Run searches in parallel with Promise.allSettled
  const searches = await Promise.allSettled([
    sources.includes('chats') ? searchChats(query, userId) : Promise.resolve([]),
    sources.includes('knowledge') ? searchKnowledgeBase(query, userId) : Promise.resolve([]),
    sources.includes('confluence') && userId ? searchConfluence(query, userId) : Promise.resolve([]),
    sources.includes('gdrive') && userId ? searchGDrive(query, userId) : Promise.resolve([]),
    sources.includes('gmail') && userId ? searchGmail(query, userId) : Promise.resolve([]),
    sources.includes('pipedrive') && userId ? searchPipedrive(query, userId) : Promise.resolve([]),
    sources.includes('jira') && userId ? searchJira(query, userId) : Promise.resolve([]),
    sources.includes('youtrack') && userId ? searchYouTrack(query, userId) : Promise.resolve([]),
    sources.includes('contracts') ? searchContracts(query) : Promise.resolve([]),
    sources.includes('docuware') && userId ? searchDocuware(query, userId) : Promise.resolve([]),
    sources.includes('personio') && userId ? searchPersonio(query, userId) : Promise.resolve([]),
  ]);

  // Process results
  const [chatsResult, knowledgeResult, confluenceResult, gdriveResult, gmailResult, pipedriveResult, jiraResult, youtrackResult, contractsResult, docuwareResult, personioResult] = searches;

  if (chatsResult.status === 'fulfilled') {
    results.results.chats = chatsResult.value;
  } else {
    results.errors?.push({ source: 'chats', message: chatsResult.reason?.message || 'Search failed' });
  }

  if (knowledgeResult.status === 'fulfilled') {
    results.results.knowledge = knowledgeResult.value;
  } else {
    results.errors?.push({ source: 'knowledge', message: knowledgeResult.reason?.message || 'Search failed' });
  }

  if (confluenceResult.status === 'fulfilled') {
    results.results.confluence = confluenceResult.value;
  } else {
    results.errors?.push({ source: 'confluence', message: confluenceResult.reason?.message || 'Search failed' });
  }

  if (gdriveResult.status === 'fulfilled') {
    results.results.gdrive = gdriveResult.value;
  } else {
    results.errors?.push({ source: 'gdrive', message: gdriveResult.reason?.message || 'Search failed' });
  }

  if (gmailResult.status === 'fulfilled') {
    results.results.gmail = gmailResult.value;
  } else {
    results.errors?.push({ source: 'gmail', message: gmailResult.reason?.message || 'Search failed' });
  }

  if (pipedriveResult.status === 'fulfilled') {
    results.results.pipedrive = pipedriveResult.value;
  } else {
    results.errors?.push({ source: 'pipedrive', message: pipedriveResult.reason?.message || 'Search failed' });
  }

  if (jiraResult.status === 'fulfilled') {
    results.results.jira = jiraResult.value;
  } else {
    results.errors?.push({ source: 'jira', message: jiraResult.reason?.message || 'Search failed' });
  }

  if (youtrackResult.status === 'fulfilled') {
    results.results.youtrack = youtrackResult.value;
  } else {
    results.errors?.push({ source: 'youtrack', message: youtrackResult.reason?.message || 'Search failed' });
  }

  if (contractsResult.status === 'fulfilled') {
    results.results.contracts = contractsResult.value;
  } else {
    results.errors?.push({ source: 'contracts', message: contractsResult.reason?.message || 'Search failed' });
  }

  if (docuwareResult.status === 'fulfilled') {
    results.results.docuware = docuwareResult.value;
  } else {
    results.errors?.push({ source: 'docuware', message: docuwareResult.reason?.message || 'Search failed' });
  }

  if (personioResult.status === 'fulfilled') {
    results.results.personio = personioResult.value;
  } else {
    results.errors?.push({ source: 'personio', message: personioResult.reason?.message || 'Search failed' });
  }

  return results;
}

/**
 * Search chat histories
 */
async function searchChats(query: string, userId?: string): Promise<SearchResult[]> {
  try {
    const chatResults = await searchChatHistories(query, userId);
    return chatResults.map((r: ChatSearchResult) => ({
      id: r.id,
      type: 'chat' as const,
      title: r.title,
      snippet: r.snippet,
      metadata: {
        matchedIn: r.matchedIn,
        updatedAt: r.updatedAt,
      },
    }));
  } catch (error) {
    console.error('Error searching chats:', error);
    return [];
  }
}

/**
 * Search knowledge base collections and documents
 * Searches in DOCUMENT_META.md files for description, keywords, and questions
 *
 * Security: filtert Collections nach `canView`-Berechtigung des Users.
 * Ohne userId (anonyme Calls) wird die KB nicht durchsucht — kein Default-
 * Public-Access. Platform-Admins bekommen alle Collections via canView.
 */
async function searchKnowledgeBase(query: string, userId?: string): Promise<SearchResult[]> {
  if (!userId) {
    return [];
  }
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  try {
    // Check if KB exists
    if (!existsSync(KB_BASE)) {
      return [];
    }

    // Read collections.yaml
    const collectionsPath = join(KB_BASE, 'collections.yaml');
    if (!existsSync(collectionsPath)) {
      return [];
    }

    const collectionsContent = await readFile(collectionsPath, 'utf-8');
    const collectionsData = parseYaml(collectionsContent);
    const allCollections: { id: string; name: string; description: string }[] =
      (collectionsData?.collections || []).map((c: any) => ({
        id: c.id || '',
        name: c.name || '',
        description: c.description || '',
      })).filter((c: any) => c.id);

    // Security: nur Collections, die der User sehen darf (Platform-Admin sieht alle)
    const { listAccessibleResources } = await import('../rbac/accessControl');
    const accessible = await listAccessibleResources(
      userId,
      'collection',
      allCollections.map(c => c.id),
    );
    const allowedIds = new Set(accessible.map(a => a.resourceId));
    const collections = allCollections.filter(c => allowedIds.has(c.id));

    // Search through each collection's manifest
    for (const collection of collections) {
      const manifestPath = join(KB_BASE, 'collections', collection.id, 'manifest.yaml');
      if (!existsSync(manifestPath)) continue;

      try {
        const manifestContent = await readFile(manifestPath, 'utf-8');
        const manifest = parseYaml(manifestContent);
        const documents: { document_id: string; title: string; path: string }[] = manifest?.documents || [];

        for (const doc of documents) {
          const docId = doc.document_id;
          const title = doc.title;
          const docPath = doc.path;

          if (!docId || !title || !docPath) continue;

          // Read DOCUMENT_META.md for searchable content (documents now inside collection)
          const metaPath = join(KB_BASE, 'collections', collection.id, 'documents', docPath, 'DOCUMENT_META.md');
          if (!existsSync(metaPath)) continue;

          try {
            const metaContent = await readFile(metaPath, 'utf-8');

            // Extract searchable sections from Markdown
            const description = extractSection(metaContent, '## Inhaltsbeschreibung');
            const keywords = extractSection(metaContent, '## Keywords');
            const questions = extractSection(metaContent, '## Beantwortet Fragen zu');

            // Search in all fields
            const titleMatch = title.toLowerCase().includes(queryLower);
            const descMatch = description.toLowerCase().includes(queryLower);
            const keywordsMatch = keywords.toLowerCase().includes(queryLower);
            const questionsMatch = questions.toLowerCase().includes(queryLower);

            if (titleMatch || descMatch || keywordsMatch || questionsMatch) {
              // Parse keywords into array
              const keywordList = keywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

              results.push({
                id: docId,
                type: 'knowledge',
                title: title,
                snippet: description.slice(0, 200) || undefined,
                metadata: {
                  collectionId: collection.id,
                  collectionName: collection.name,
                  path: docPath,
                  keywords: keywordList,
                  matchedIn: titleMatch
                    ? 'title'
                    : descMatch
                      ? 'description'
                      : keywordsMatch
                        ? 'keywords'
                        : 'questions',
                },
              });
            }
          } catch {
            // Skip documents without valid DOCUMENT_META.md
            continue;
          }
        }
      } catch (err) {
        // Skip invalid manifest
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return [];
  }
}

/**
 * Extract section content from Markdown file
 * Finds content between a header and the next header (or end of file)
 */
function extractSection(content: string, sectionHeader: string): string {
  const headerIndex = content.indexOf(sectionHeader);
  if (headerIndex === -1) return '';

  const startIndex = headerIndex + sectionHeader.length;
  const nextHeaderIndex = content.indexOf('\n## ', startIndex);

  const sectionContent =
    nextHeaderIndex === -1
      ? content.slice(startIndex)
      : content.slice(startIndex, nextHeaderIndex);

  return sectionContent.trim();
}

/**
 * Search Confluence via connection tool
 */
async function searchConfluence(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const tool = toolRegistry.get('confluence_search');
    if (!tool) {
      return [];
    }

    const resultStr = await tool.execute(
      { query, limit: '10' },
      { userId }
    );

    console.log('[Confluence Search] Tool response (length):', resultStr.length, 'first line:', resultStr.split('\n')[0]);

    // Check for errors
    if (resultStr.startsWith('Error:') || resultStr.includes('Not connected') || resultStr.startsWith('No results')) {
      return [];
    }

    // Parse the markdown output - split by ### headers
    const results: SearchResult[] = [];
    const sections = resultStr.split(/^### /m).slice(1); // skip first part (header line)

    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0]?.trim();
      if (!title) continue;

      let pageType = '', spaceName = '', spaceKey = '', id = '', lastModified = '', excerpt = '', url = '';

      for (const line of lines) {
        const typeMatch = line.match(/^\- \*\*Type\*\*: (.+)/);
        if (typeMatch) pageType = typeMatch[1].trim();
        const spaceMatch = line.match(/^\- \*\*Space\*\*: (.+) \((.+)\)/);
        if (spaceMatch) { spaceName = spaceMatch[1].trim(); spaceKey = spaceMatch[2].trim(); }
        const idMatch = line.match(/^\- \*\*ID\*\*: (.+)/);
        if (idMatch) id = idMatch[1].trim();
        const modMatch = line.match(/^\- \*\*Last Modified\*\*: (.+)/);
        if (modMatch) lastModified = modMatch[1].trim();
        const exMatch = line.match(/^\- \*\*Excerpt\*\*: (.+)/);
        if (exMatch) excerpt = exMatch[1].replace(/\.\.\.$/, '').trim();
        const urlMatch = line.match(/^\- \*\*URL\*\*: (.+)/);
        if (urlMatch) url = urlMatch[1].trim();
      }

      if (!id) continue;

      results.push({
        id,
        type: 'confluence',
        title,
        snippet: excerpt || undefined,
        metadata: {
          pageType,
          spaceName,
          spaceKey,
          lastModified: lastModified || undefined,
          url,
        },
      });
    }

    console.log('[Confluence Search] Parsed results:', results.length);
    return results;
  } catch (error) {
    console.error('Error searching Confluence:', error);
    return [];
  }
}

/**
 * Search Google Drive via connection tool
 */
async function searchGDrive(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const tool = toolRegistry.get('gdrive_search');
    if (!tool) {
      return [];
    }

    const resultStr = await tool.execute(
      { query, page_size: 10 },
      { userId }
    );

    // Parse JSON result
    try {
      const data = JSON.parse(resultStr);

      if (data.error) {
        return [];
      }

      return (data.results || []).map((file: any) => ({
        id: file.id,
        type: 'gdrive' as const,
        title: file.name,
        snippet: undefined,
        metadata: {
          mimeType: file.type,
          size: file.size,
          modified: file.modified,
          link: file.link,
        },
      }));
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Error searching Google Drive:', error);
    return [];
  }
}

/**
 * Search Gmail via connection tool
 */
async function searchGmail(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const tool = toolRegistry.get('gmail_search_emails');
    if (!tool) {
      return [];
    }

    const resultStr = await tool.execute(
      { query, max_results: 10 },
      { userId }
    );

    // Parse JSON result
    try {
      const data = JSON.parse(resultStr);

      if (data.error) {
        return [];
      }

      return (data.emails || []).map((email: any) => ({
        id: email.id,
        type: 'gmail' as const,
        title: email.subject || '(Kein Betreff)',
        snippet: email.snippet || undefined,
        metadata: {
          from: email.from,
          to: email.to,
          date: email.date,
          threadId: email.threadId,
          labelIds: email.labelIds,
        },
      }));
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Error searching Gmail:', error);
    return [];
  }
}

/**
 * Search Pipedrive CRM directly via API (deals + contacts)
 */
async function searchPipedrive(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const { connectionRegistry: registry } = await import('../connections/registry');
    const tokens = await registry.getTokens(userId, 'pipedrive');
    if (!tokens?.accessToken || !tokens?.apiDomain) {
      console.log('[Pipedrive Search] No tokens/apiDomain for user:', userId);
      return [];
    }

    // Pipedrive OAuth requires api.pipedrive.com, not the company subdomain
    const apiUrl = 'https://api.pipedrive.com/v1';
    const headers = { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' };

    console.log('[Pipedrive Search] Querying:', query, 'storedDomain:', tokens.apiDomain, 'usingUrl:', apiUrl);

    const [dealsRes, contactsRes] = await Promise.allSettled([
      fetch(`${apiUrl}/itemSearch?${new URLSearchParams({ term: query, item_types: 'deal', limit: '10' })}`, { headers }),
      fetch(`${apiUrl}/itemSearch?${new URLSearchParams({ term: query, item_types: 'person', limit: '10' })}`, { headers }),
    ]);

    const results: SearchResult[] = [];

    if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
      const data = await dealsRes.value.json() as any;
      console.log('[Pipedrive Search] Deals:', data?.data?.items?.length ?? 0);
      for (const item of data?.data?.items || []) {
        const deal = item.item;
        if (!deal) continue;
        results.push({
          id: `deal-${deal.id}`,
          type: 'pipedrive' as const,
          title: deal.title || 'Unbenannter Deal',
          snippet: [deal.value ? `${deal.value} ${deal.currency || ''}`.trim() : null, deal.status, deal.organization?.name].filter(Boolean).join(' · ') || undefined,
          metadata: {
            itemType: 'deal',
            dealId: String(deal.id),
            value: deal.value ? `${deal.value} ${deal.currency || ''}`.trim() : undefined,
            status: deal.status,
            contact: deal.person?.name,
            organization: deal.organization?.name,
          },
        });
      }
    }

    if (dealsRes.status === 'fulfilled' && !dealsRes.value.ok) {
      console.log('[Pipedrive Search] Deals API error:', dealsRes.value.status, await dealsRes.value.text().catch(() => ''));
    }
    if (dealsRes.status === 'rejected') {
      console.log('[Pipedrive Search] Deals fetch rejected:', dealsRes.reason);
    }

    if (contactsRes.status === 'fulfilled' && contactsRes.value.ok) {
      const data = await contactsRes.value.json() as any;
      console.log('[Pipedrive Search] Contacts:', data?.data?.items?.length ?? 0);
      for (const item of data?.data?.items || []) {
        const person = item.item;
        if (!person) continue;
        const email = Array.isArray(person.emails) ? person.emails[0] : person.primary_email;
        results.push({
          id: `contact-${person.id}`,
          type: 'pipedrive' as const,
          title: person.name || 'Unbenannter Kontakt',
          snippet: [email, person.organization?.name].filter(Boolean).join(' · ') || undefined,
          metadata: {
            itemType: 'contact',
            contactId: String(person.id),
            email,
            phone: person.phones?.[0] || undefined,
            organization: person.organization?.name,
          },
        });
      }
    }

    if (contactsRes.status === 'fulfilled' && !contactsRes.value.ok) {
      console.log('[Pipedrive Search] Contacts API error:', contactsRes.value.status, await contactsRes.value.text().catch(() => ''));
    }
    if (contactsRes.status === 'rejected') {
      console.log('[Pipedrive Search] Contacts fetch rejected:', contactsRes.reason);
    }

    console.log('[Pipedrive Search] Total results:', results.length);
    return results;
  } catch (error) {
    console.error('[Pipedrive Search] Error:', error);
    return [];
  }
}

/**
 * Search Jira issues via connection tool
 */
async function searchJira(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const tool = toolRegistry.get('jira_search_issues');
    if (!tool) {
      return [];
    }

    // Use summary/description search - text ~ can miss German compound words
    const jql = `summary ~ "${query.replace(/"/g, '\\"')}" OR description ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
    const resultStr = await tool.execute(
      { jql, max_results: 10 },
      { userId }
    );

    // Check for errors
    if (resultStr.startsWith('Error:') || resultStr.startsWith('No issues')) {
      return [];
    }

    // Parse the markdown output - split by ### headers
    const results: SearchResult[] = [];
    const sections = resultStr.split(/^### /m).slice(1);

    for (const section of sections) {
      const lines = section.split('\n');
      const titleLine = lines[0]?.trim();
      if (!titleLine) continue;

      // Title format: "KEY-123: Summary text"
      const keyMatch = titleLine.match(/^(\S+-\d+):\s*(.*)/);
      const issueKey = keyMatch?.[1] || '';
      const summary = keyMatch?.[2] || titleLine;

      let issueType = '', status = '', priority = '', assignee = '', created = '', updated = '';

      for (const line of lines) {
        const typeMatch = line.match(/^\- \*\*Type\*\*: (.+)/);
        if (typeMatch) issueType = typeMatch[1].trim();
        const statusMatch = line.match(/^\- \*\*Status\*\*: (.+)/);
        if (statusMatch) status = statusMatch[1].trim();
        const prioMatch = line.match(/^\- \*\*Priority\*\*: (.+)/);
        if (prioMatch) priority = prioMatch[1].trim();
        const assigneeMatch = line.match(/^\- \*\*Assignee\*\*: (.+)/);
        if (assigneeMatch) assignee = assigneeMatch[1].trim();
        const createdMatch = line.match(/^\- \*\*Created\*\*: (.+)/);
        if (createdMatch) created = createdMatch[1].trim();
        const updatedMatch = line.match(/^\- \*\*Updated\*\*: (.+)/);
        if (updatedMatch) updated = updatedMatch[1].trim();
      }

      if (!issueKey) continue;

      results.push({
        id: issueKey,
        type: 'jira',
        title: `${issueKey}: ${summary}`,
        snippet: [issueType, status, assignee !== 'Unassigned' ? assignee : null].filter(Boolean).join(' · ') || undefined,
        metadata: {
          issueKey,
          issueType,
          status,
          priority,
          assignee,
          created,
          updated,
        },
      });
    }

    return results;
  } catch (error) {
    console.error('Error searching Jira:', error);
    return [];
  }
}

/**
 * Search YouTrack issues via connection tool
 */
async function searchYouTrack(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const tool = toolRegistry.get('youtrack_search_issues');
    if (!tool) {
      return [];
    }

    const resultStr = await tool.execute(
      { query, max_results: 10 },
      { userId }
    );

    if (resultStr.startsWith('Error:') || resultStr.startsWith('No issues')) {
      return [];
    }

    // Parse the markdown output - split by ### headers
    const results: SearchResult[] = [];
    const sections = resultStr.split(/^### /m).slice(1);

    for (const section of sections) {
      const lines = section.split('\n');
      const titleLine = lines[0]?.trim();
      if (!titleLine) continue;

      const keyMatch = titleLine.match(/^(\S+-\d+):\s*(.*)/);
      const issueId = keyMatch?.[1] || '';
      const summary = keyMatch?.[2] || titleLine;

      let issueType = '', state = '', priority = '', assignee = '', project = '';

      for (const line of lines) {
        const typeMatch = line.match(/^\- \*\*Type\*\*: (.+)/);
        if (typeMatch) issueType = typeMatch[1].trim();
        const stateMatch = line.match(/^\- \*\*State\*\*: (.+)/);
        if (stateMatch) state = stateMatch[1].trim();
        const prioMatch = line.match(/^\- \*\*Priority\*\*: (.+)/);
        if (prioMatch) priority = prioMatch[1].trim();
        const assigneeMatch = line.match(/^\- \*\*Assignee\*\*: (.+)/);
        if (assigneeMatch) assignee = assigneeMatch[1].trim();
        const projMatch = line.match(/^\- \*\*Project\*\*: (.+)/);
        if (projMatch) project = projMatch[1].trim();
      }

      if (!issueId) continue;

      results.push({
        id: issueId,
        type: 'youtrack',
        title: `${issueId}: ${summary}`,
        snippet: [issueType, state, assignee].filter(Boolean).join(' · ') || undefined,
        metadata: {
          issueId,
          issueType,
          state,
          priority,
          assignee,
          project,
        },
      });
    }

    return results;
  } catch (error) {
    console.error('Error searching YouTrack:', error);
    return [];
  }
}

/**
 * Search contracts from Vertragsmanagement
 */
async function searchContracts(query: string): Promise<SearchResult[]> {
  const CONTRACTS_BASE = resolve(process.cwd(), './data/apps/vertragsmanagement/contracts');
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  try {
    if (!existsSync(CONTRACTS_BASE)) {
      return [];
    }

    // Read all contract directories
    const contractDirs = await readdir(CONTRACTS_BASE);

    for (const contractId of contractDirs) {
      const metadataPath = join(CONTRACTS_BASE, contractId, 'metadata.yaml');
      const documentPath = join(CONTRACTS_BASE, contractId, 'document.md');

      if (!existsSync(metadataPath)) continue;

      try {
        const metadataContent = await readFile(metadataPath, 'utf-8');

        // Parse YAML metadata (simple parsing)
        const { parse } = await import('yaml');
        const metadata = parse(metadataContent);

        // Extract searchable fields
        const partyA = metadata.computed?.party_a || '';
        const partyB = metadata.computed?.party_b || '';
        const contractType = metadata.contract_type || '';
        const filename = metadata.upload_filename || '';
        const status = metadata.computed?.status || '';
        const annualValue = metadata.computed?.annual_value || 0;
        const startDate = metadata.computed?.start_date || '';
        const endDate = metadata.computed?.end_date || '';

        // Read document for content search
        let documentContent = '';
        if (existsSync(documentPath)) {
          documentContent = await readFile(documentPath, 'utf-8');
        }

        // Search in all fields
        const titleMatch = partyA.toLowerCase().includes(queryLower) ||
                          partyB.toLowerCase().includes(queryLower);
        const typeMatch = contractType.toLowerCase().includes(queryLower);
        const filenameMatch = filename.toLowerCase().includes(queryLower);
        const contentMatch = documentContent.toLowerCase().includes(queryLower);

        if (titleMatch || typeMatch || filenameMatch || contentMatch) {
          // Create snippet from matching content
          let snippet = '';
          if (contentMatch) {
            const matchIndex = documentContent.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, matchIndex - 50);
            const end = Math.min(documentContent.length, matchIndex + query.length + 100);
            snippet = (start > 0 ? '...' : '') +
                     documentContent.slice(start, end).replace(/\n/g, ' ').trim() +
                     (end < documentContent.length ? '...' : '');
          }

          results.push({
            id: contractId,
            type: 'contract',
            title: `${partyA} - ${partyB}`,
            snippet: snippet || undefined,
            metadata: {
              contract_type: contractType,
              filename: filename,
              status: status,
              annual_value: annualValue,
              start_date: startDate,
              end_date: endDate,
              matchedIn: titleMatch ? 'parties' : typeMatch ? 'type' : filenameMatch ? 'filename' : 'content',
            },
          });
        }
      } catch {
        // Skip invalid contracts
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching contracts:', error);
    return [];
  }
}

// ============================================
// Smart/Intelligent Search (LLM-based)
// ============================================

export interface SmartSearchResponse {
  query: string;
  results: SearchResult[];
  reasoning?: string;
}

/**
 * Intelligent search using LLM to find relevant documents
 * The LLM understands synonyms, context, and can match concepts
 */
export async function smartKnowledgeSearch(query: string, triggeringUserId?: string): Promise<SmartSearchResponse> {
  const { llmService } = await import('./llm');

  // Security: ohne userId keine KB-Suche — sonst wuerde der LLM-Re-Ranker
  // alle Dokumente der Plattform sehen.
  if (!triggeringUserId) {
    return { query, results: [], reasoning: 'Keine Berechtigung (kein User-Kontext)' };
  }

  try {
    // Check if KB exists
    if (!existsSync(KB_BASE)) {
      return { query, results: [], reasoning: 'Knowledge Base nicht gefunden' };
    }

    // Step 1: Load all collections and their manifests (gefiltert nach User-Permissions)
    const kbData = await loadKnowledgeBaseIndex(triggeringUserId);
    if (kbData.documents.length === 0) {
      return { query, results: [], reasoning: 'Keine zugaenglichen Dokumente in der Knowledge Base' };
    }

    // Step 2: Build prompt for LLM
    const documentList = kbData.documents.map((doc, idx) =>
      `[${idx}] "${doc.title}" (${doc.collectionName})\n    Beschreibung: ${doc.description}\n    Keywords: ${doc.keywords.join(', ')}\n    Beantwortet: ${doc.questions}`
    ).join('\n\n');

    const systemPrompt = `Du bist ein Suchassistent. Analysiere die Benutzeranfrage und finde die relevantesten Dokumente.

WICHTIG:
- Verstehe Synonyme (z.B. "Incidents" = "Vorfälle" = "Sicherheitsvorfälle")
- Verstehe Kontext und verwandte Begriffe
- Berücksichtige deutsche UND englische Begriffe
- Gib die Indizes der relevanten Dokumente zurück

Antworte NUR im folgenden JSON-Format:
{
  "relevant_indices": [0, 2, 5],
  "reasoning": "Kurze Begründung warum diese Dokumente relevant sind"
}

Wenn keine Dokumente relevant sind, gib ein leeres Array zurück.`;

    const userPrompt = `Suchanfrage: "${query}"

Verfügbare Dokumente:
${documentList}

Welche Dokumente sind für diese Suchanfrage relevant?`;

    // Step 3: Call LLM with usage tracking
    const usageContext: UsageContext = {
      triggeringUserId,
      source: 'search',
      operation: 'smart_kb_search',
    };

    const response = await llmService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], undefined, usageContext);

    // Step 4: Parse LLM response
    const content = response.content || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in the response
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonObjectMatch) {
      console.error('Smart search: No JSON found in LLM response');
      return { query, results: [], reasoning: 'Fehler beim Parsen der LLM-Antwort' };
    }

    const parsed = JSON.parse(jsonObjectMatch[0]);
    const relevantIndices: number[] = parsed.relevant_indices || [];
    const reasoning: string = parsed.reasoning || '';

    // Step 5: Map indices back to search results
    const results: SearchResult[] = relevantIndices
      .filter(idx => idx >= 0 && idx < kbData.documents.length)
      .map(idx => kbData.documents[idx])
      .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined)
      .map(doc => ({
        id: doc.id,
        type: 'knowledge' as const,
        title: doc.title,
        snippet: doc.description.slice(0, 200),
        metadata: {
          collectionId: doc.collectionId,
          collectionName: doc.collectionName,
          path: doc.path,
          keywords: doc.keywords,
          matchedIn: 'smart_search',
        },
      }));

    return { query, results, reasoning };
  } catch (error) {
    console.error('Error in smart knowledge search:', error);
    return { query, results: [], reasoning: `Fehler: ${error}` };
  }
}

/**
 * Intelligent search for contracts using LLM
 * Understands contract terms, parties, and context
 */
export async function smartContractSearch(query: string, triggeringUserId?: string): Promise<SmartSearchResponse> {
  const { llmService } = await import('./llm');
  const CONTRACTS_BASE = resolve(process.cwd(), './data/apps/vertragsmanagement/contracts');

  try {
    if (!existsSync(CONTRACTS_BASE)) {
      return { query, results: [], reasoning: 'Keine Verträge vorhanden' };
    }

    // Load all contracts
    const contracts = await loadContractsIndex();
    if (contracts.length === 0) {
      return { query, results: [], reasoning: 'Keine Verträge gefunden' };
    }

    // Build prompt for LLM with full metadata (flattened for readability)
    const contractList = contracts.map((c, idx) => {
      let entry = `[${idx}] "${c.partyA} - ${c.partyB}" (${c.contractType})`;
      entry += `\n    Status: ${c.status}, Wert: ${c.annualValue}€/Jahr`;
      entry += `\n    Laufzeit: ${c.startDate} bis ${c.endDate || 'unbefristet'}`;
      entry += `\n    Datei: ${c.filename}`;

      // Flatten and add extracted metadata in readable format
      if (Object.keys(c.extracted).length > 0) {
        const flattenObject = (obj: Record<string, any>, prefix = ''): string[] => {
          const results: string[] = [];
          for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              results.push(...flattenObject(value, newKey));
            } else {
              const strValue = String(value || '').slice(0, 300);
              results.push(`${newKey}: ${strValue}`);
            }
          }
          return results;
        };
        const flatData = flattenObject(c.extracted);
        entry += `\n    Metadaten:\n      ${flatData.join('\n      ')}`;
      }

      // Add obligations in readable format
      if (c.obligations.length > 0) {
        const oblList = c.obligations.map(o => {
          const partyName = o.party === 'party_a' ? c.partyA : c.partyB;
          return `- ${partyName} (${o.category}): ${o.description}${o.recurrence ? ` [${o.recurrence}]` : ''}`;
        });
        entry += `\n    Pflichten:\n      ${oblList.join('\n      ')}`;
      }

      return entry;
    }).join('\n\n');

    const systemPrompt = `Du bist ein Vertragsassistent. Analysiere die Suchanfrage und finde relevante Verträge.

WICHTIG:
- Verstehe Vertragsparteien (Firmen, Personen)
- Verstehe Vertragsarten (Miet-, Dienstleistungs-, Arbeitsvertrag, etc.)
- Verstehe Status (aktiv, ablaufend, abgelaufen)
- Verstehe Werte und Zeiträume
- Analysiere die extrahierten Metadaten und Pflichten
- Finde Verträge basierend auf Verpflichtungen (z.B. "Winterdienst", "Wartung", "Zahlungen")
- Berücksichtige Synonyme und verwandte Begriffe

Antworte NUR im folgenden JSON-Format:
{
  "relevant_indices": [0, 2, 5],
  "reasoning": "Kurze Begründung warum diese Verträge relevant sind"
}

Wenn keine Verträge relevant sind, gib ein leeres Array zurück.`;

    const userPrompt = `Suchanfrage: "${query}"

Verfügbare Verträge:
${contractList}

Welche Verträge sind für diese Suchanfrage relevant?`;

    const usageContext: UsageContext = {
      triggeringUserId,
      source: 'search',
      operation: 'smart_contract_search',
    };

    const response = await llmService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], undefined, usageContext);

    const content = response.content || '';

    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1];
    }

    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonObjectMatch) {
      return { query, results: [], reasoning: 'Fehler beim Parsen der LLM-Antwort' };
    }

    const parsed = JSON.parse(jsonObjectMatch[0]);
    const relevantIndices: number[] = parsed.relevant_indices || [];
    const reasoning: string = parsed.reasoning || '';

    const results: SearchResult[] = relevantIndices
      .filter(idx => idx >= 0 && idx < contracts.length)
      .map(idx => contracts[idx])
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map(c => ({
        id: c.id,
        type: 'contract' as const,
        title: `${c.partyA} - ${c.partyB}`,
        snippet: `${c.contractType} | ${c.startDate} - ${c.endDate || 'unbefristet'} | ${c.annualValue}€/Jahr`,
        metadata: {
          contract_type: c.contractType,
          filename: c.filename,
          status: c.status,
          annual_value: c.annualValue,
          start_date: c.startDate,
          end_date: c.endDate,
          matchedIn: 'smart_search',
        },
      }));

    return { query, results, reasoning };
  } catch (error) {
    console.error('Error in smart contract search:', error);
    return { query, results: [], reasoning: `Fehler: ${error}` };
  }
}

interface ContractObligation {
  party: string;
  category: string;
  description: string;
  recurrence?: string;
}

interface ContractIndexItem {
  id: string;
  partyA: string;
  partyB: string;
  contractType: string;
  filename: string;
  status: string;
  annualValue: number;
  startDate: string;
  endDate: string;
  extracted: Record<string, any>;
  obligations: ContractObligation[];
}

/**
 * Load all contracts for the LLM to analyze (with full metadata)
 */
async function loadContractsIndex(): Promise<ContractIndexItem[]> {
  const CONTRACTS_BASE = resolve(process.cwd(), './data/apps/vertragsmanagement/contracts');
  const contracts: ContractIndexItem[] = [];

  try {
    if (!existsSync(CONTRACTS_BASE)) {
      return contracts;
    }

    const contractDirs = await readdir(CONTRACTS_BASE);

    for (const contractId of contractDirs) {
      const metadataPath = join(CONTRACTS_BASE, contractId, 'metadata.yaml');
      if (!existsSync(metadataPath)) continue;

      try {
        const metadataContent = await readFile(metadataPath, 'utf-8');
        const { parse } = await import('yaml');
        const metadata = parse(metadataContent);

        contracts.push({
          id: contractId,
          partyA: metadata.computed?.party_a || '',
          partyB: metadata.computed?.party_b || '',
          contractType: metadata.contract_type || '',
          filename: metadata.upload_filename || '',
          status: metadata.computed?.status || '',
          annualValue: metadata.computed?.annual_value || 0,
          startDate: metadata.computed?.start_date || '',
          endDate: metadata.computed?.end_date || '',
          extracted: metadata.extracted || {},
          obligations: metadata.obligations || [],
        });
      } catch {
        continue;
      }
    }

    return contracts;
  } catch (error) {
    console.error('Error loading contracts index:', error);
    return contracts;
  }
}

interface KBDocument {
  id: string;
  title: string;
  path: string;
  collectionId: string;
  collectionName: string;
  description: string;
  keywords: string[];
  questions: string;
}

interface KBIndex {
  documents: KBDocument[];
}

/**
 * Load all documents from the knowledge base for the LLM to analyze.
 * Security: gefiltert nach User-Permissions via `listAccessibleResources`.
 */
async function loadKnowledgeBaseIndex(userId: string): Promise<KBIndex> {
  const documents: KBDocument[] = [];

  try {
    // Read collections.yaml
    const collectionsPath = join(KB_BASE, 'collections.yaml');
    if (!existsSync(collectionsPath)) {
      return { documents };
    }

    const collectionsContent = await readFile(collectionsPath, 'utf-8');
    const collectionsData = parseYaml(collectionsContent);
    const allCollections: { id: string; name: string }[] =
      (collectionsData?.collections || [])
        .filter((c: any) => c.id)
        .map((c: any) => ({ id: c.id, name: c.name || '' }));

    // Security: nur Collections, die der User sehen darf (Platform-Admin sieht alle)
    const { listAccessibleResources } = await import('../rbac/accessControl');
    const accessible = await listAccessibleResources(
      userId,
      'collection',
      allCollections.map(c => c.id),
    );
    const allowedIds = new Set(accessible.map(a => a.resourceId));
    const collections = allCollections.filter(c => allowedIds.has(c.id));

    // Load documents from each collection
    for (const collection of collections) {
      const manifestPath = join(KB_BASE, 'collections', collection.id, 'manifest.yaml');
      if (!existsSync(manifestPath)) continue;

      try {
        const manifestContent = await readFile(manifestPath, 'utf-8');
        const manifest = parseYaml(manifestContent);
        const docs: { document_id: string; title: string; path: string }[] = manifest?.documents || [];

        for (const doc of docs) {
          const docId = doc.document_id;
          const title = doc.title;
          const docPath = doc.path;

          if (!docId || !title || !docPath) continue;

          // Read DOCUMENT_META.md (documents now inside collection)
          const metaPath = join(KB_BASE, 'collections', collection.id, 'documents', docPath, 'DOCUMENT_META.md');
          if (!existsSync(metaPath)) continue;

          try {
            const metaContent = await readFile(metaPath, 'utf-8');

            const description = extractSection(metaContent, '## Inhaltsbeschreibung');
            const keywordsStr = extractSection(metaContent, '## Keywords');
            const questions = extractSection(metaContent, '## Beantwortet Fragen zu');

            const keywords = keywordsStr
              .split(',')
              .map(k => k.trim())
              .filter(k => k.length > 0);

            documents.push({
              id: docId,
              title,
              path: docPath,
              collectionId: collection.id,
              collectionName: collection.name,
              description: description.slice(0, 500), // Limit for token efficiency
              keywords,
              questions: questions.slice(0, 300),
            });
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return { documents };
  } catch (error) {
    console.error('Error loading KB index:', error);
    return { documents };
  }
}

/**
 * Search Docuware via connection tools.
 *
 * Docuware-Search braucht eine cabinet_id — fuer die Unified-Search rufen
 * wir erst list_cabinets, dann pro Cabinet (max. 3 zur Aufwand-Begrenzung)
 * search_documents mit der Query auf.
 */
async function searchDocuware(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const listTool = toolRegistry.get('docuware_list_cabinets');
    const searchTool = toolRegistry.get('docuware_search_documents');
    if (!listTool || !searchTool) return [];

    const cabinetsStr = await listTool.execute({}, { userId });
    if (cabinetsStr.startsWith('Error:') || cabinetsStr.startsWith('No file cabinets')) {
      return [];
    }

    // Cabinet-Name pro ID aufloesen — Cabinets sind Markdown-Sektionen mit
    // Header "### <name>" gefolgt von "- **ID**: <uuid>".
    const cabinetNameById = new Map<string, string>();
    const cabinetSections = cabinetsStr.split(/^### /m).slice(1);
    for (const section of cabinetSections) {
      const lines = section.split('\n');
      const name = lines[0]?.trim();
      const idLine = lines.find((l) => /^\-\s+\*\*ID\*\*:/.test(l));
      const idMatch = idLine?.match(/^\-\s+\*\*ID\*\*:\s*(\S+)/);
      if (name && idMatch) cabinetNameById.set(idMatch[1]!, name);
    }
    const cabinetIds = Array.from(cabinetNameById.keys()).slice(0, 3); // Limit
    if (cabinetIds.length === 0) return [];

    const perCabinetSearches = await Promise.allSettled(
      cabinetIds.map((cabinetId) =>
        searchTool.execute({ cabinet_id: cabinetId, query, max_results: 5 }, { userId }),
      ),
    );

    const results: SearchResult[] = [];
    for (const r of perCabinetSearches) {
      if (r.status !== 'fulfilled') continue;
      const str = r.value;
      if (!str || str.startsWith('Error:') || str.startsWith('No documents')) continue;

      const sections = str.split(/^### /m).slice(1);
      for (const section of sections) {
        const lines = section.split('\n');
        const headerTitle = lines[0]?.trim() || '';
        let docId = '';
        let cabinet = '';
        let created = '';
        let fields = '';
        for (const line of lines) {
          const m = line.match(/^\-\s+\*\*([^*]+)\*\*:\s*(.+)/);
          if (!m) continue;
          const key = m[1]!.trim();
          const val = m[2]!.trim();
          if (key === 'Document ID' || key === 'ID') docId = val;
          else if (key === 'Cabinet') cabinet = val;
          else if (key === 'Created') created = val;
          else if (key === 'Fields') fields = val;
        }
        if (!docId) continue;

        const cabinetName = cabinetNameById.get(cabinet) || '';

        // Snippet: erst die Index-Fields (das Aussagekraefigste), gekuerzt;
        // wenn keine vorhanden, fallback auf Created + Cabinet-Name.
        let snippet = '';
        if (fields) {
          snippet = fields.length > 160 ? fields.slice(0, 157) + '...' : fields;
        } else {
          snippet = [cabinetName, created].filter(Boolean).join(' · ');
        }

        results.push({
          id: docId,
          type: 'docuware',
          title: headerTitle || `Document ${docId}`,
          snippet: snippet || undefined,
          metadata: {
            docId,
            cabinetId: cabinet,
            cabinetName,
            created,
            fields,
          },
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching Docuware:', error);
    return [];
  }
}

/**
 * Search Personio applications.
 *
 * Personio v2 hat keinen Volltextsuche-Endpoint — wir holen die letzten
 * 100 Bewerbungen und matchen client-side gegen Vorname/Nachname/Email/
 * Position. Wenn die Query wie eine Email aussieht, schicken wir sie
 * als candidate.email-Filter direkt mit (deutlich schneller).
 */
async function searchPersonio(query: string, userId: string): Promise<SearchResult[]> {
  try {
    const tool = toolRegistry.get('personio_list_applications');
    if (!tool) return [];

    const isEmailLike = /@/.test(query);
    const args: Record<string, any> = { limit: isEmailLike ? 50 : 100 };
    if (isEmailLike) args.candidate_email = query;

    const resultStr = await tool.execute(args, { userId });
    if (resultStr.startsWith('Error:') || resultStr.startsWith('No applications')) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];
    const sections = resultStr.split(/^### /m).slice(1);

    for (const section of sections) {
      const lines = section.split('\n');
      const fullName = lines[0]?.trim() || '(anonym)';
      let appId = '';
      let candidateId = '';
      let email = '';
      let position = '';
      let stage = '';
      let bewerbungsdatum = '';

      for (const line of lines) {
        const m1 = line.match(/^\-\s+\*\*Application-ID\*\*:\s*(.+)/);
        if (m1) appId = m1[1]!.trim();
        const m2 = line.match(/^\-\s+\*\*Candidate-ID\*\*:\s*(.+)/);
        if (m2) candidateId = m2[1]!.trim();
        const m3 = line.match(/^\-\s+\*\*Email\*\*:\s*(.+)/);
        if (m3) email = m3[1]!.trim();
        const m4 = line.match(/^\-\s+\*\*Position\*\*:\s*(.+)/);
        if (m4) position = m4[1]!.trim();
        const m5 = line.match(/^\-\s+\*\*Stage\*\*:\s*(.+)/);
        if (m5) stage = m5[1]!.trim();
        const m6 = line.match(/^\-\s+\*\*Bewerbungsdatum\*\*:\s*(.+)/);
        if (m6) bewerbungsdatum = m6[1]!.trim();
      }
      if (!appId) continue;

      // Client-side Match wenn nicht email-Filter. Sonst ist die Liste schon vorgefiltert.
      if (!isEmailLike) {
        const haystack = [fullName, email, position, stage].join(' ').toLowerCase();
        if (!haystack.includes(queryLower)) continue;
      }

      results.push({
        id: appId,
        type: 'personio',
        title: fullName,
        snippet: [position, stage, bewerbungsdatum, email].filter(Boolean).join(' · ') || undefined,
        metadata: { applicationId: appId, candidateId, email, position, stage, bewerbungsdatum },
      });
    }

    return results;
  } catch (error) {
    console.error('Error searching Personio:', error);
    return [];
  }
}
