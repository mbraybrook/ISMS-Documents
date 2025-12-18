<!-- 8ee848e5-6761-4e79-8893-cd044ddc5872 e9f2b22c-fa43-4f9d-af40-c820df79a4d4 -->
# Risk Similarity Analysis Features

## Overview

Add LLM-powered similarity analysis to help identify duplicate or similar risks. Two main features:

1. **Find Similar Risks**: Button in risk view modal that finds and displays similar risks in an inline panel
2. **Real-time Similarity Checking**: During risk creation, debounced checks suggest existing similar risks

## Backend Changes

### 1. LLM Service Integration

- **File**: `backend/src/services/llmService.ts` (new file)
- Create service to interact with local LLM (Ollama)
- Function `findSimilarRisks(riskText: string, existingRisks: Risk[]): Promise<SimilarRisk[]>`
- Function `calculateSimilarityScore(risk1: Risk, risk2: Risk): Promise<number>`
- Use Ollama API endpoint (default: `http://localhost:11434/api/embeddings` or `http://localhost:11434/api/chat`)
- For embeddings approach: Generate embeddings for Title + Threat Description + Risk Description, then calculate cosine similarity
- For chat approach: Use prompt-based comparison asking LLM to score similarity (0-100)
- Return results sorted by similarity score (highest first)
- Include similarity score (0-100) and matched fields in response

### 2. Similarity API Endpoints

- **File**: `backend/src/routes/risks.ts`
- Add `POST /api/risks/:id/similar` endpoint
  - Authenticated, requires role ADMIN/EDITOR/VIEWER
  - Takes optional `limit` query param (default: 10)
  - Returns array of similar risks with similarity scores
  - Excludes the risk itself from results
- Add `POST /api/risks/check-similarity` endpoint
  - Authenticated, requires role ADMIN/EDITOR
  - Body: `{ title: string, threatDescription?: string, description?: string, excludeId?: string }`
  - Returns array of similar risks (limit 5) with similarity scores
  - Used during risk creation/editing

### 3. Configuration

- **File**: `backend/src/config.ts`
- Add LLM configuration:
  ```typescript
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434',
    model: process.env.LLM_MODEL || 'llama2', // or 'mistral', 'codellama', etc.
    similarityThreshold: parseFloat(process.env.LLM_SIMILARITY_THRESHOLD || '70'), // 0-100
  }
  ```

- **File**: `.env.example`
- Add LLM configuration variables with comments

### 4. Similarity Service

- **File**: `backend/src/services/similarityService.ts` (new file)
- Main service orchestrating similarity checks
- Function `findSimilarRisks(riskId: string, limit?: number): Promise<SimilarRiskResult[]>`
  - Fetches risk by ID
  - Gets all non-archived risks (excluding current risk)
  - Calls LLM service to calculate similarities
  - Filters by threshold, sorts, limits results
- Function `checkSimilarityForNewRisk(riskData: Partial<Risk>, excludeId?: string): Promise<SimilarRiskResult[]>`
  - Similar logic but for in-progress risk creation
  - Combines title, threatDescription, description into comparison text

## Frontend Changes

### 5. Similarity API Service

- **File**: `frontend/src/services/api.ts`
- Add functions:
  - `findSimilarRisks: (riskId: string, limit?: number) => api.post(\`/api/risks/\${riskId}/similar\`, { limit })`
  - `checkSimilarity: (data: { title: string, threatDescription?: string, description?: string, excludeId?: string }) => api.post('/api/risks/check-similarity', data)`

### 6. Similar Risks Panel Component

- **File**: `frontend/src/components/SimilarRisksPanel.tsx` (new file)
- Inline panel component for displaying similar risks
- Props:
  - `similarRisks: SimilarRisk[]` - Array of similar risks with scores
  - `onViewRisk: (riskId: string) => void` - Callback to view risk (opens in new tab)
  - `onSelectRisk: (riskId: string, selected: boolean) => void` - Callback for checkbox selection
  - `selectedRiskIds: Set<string>` - Currently selected risk IDs
  - `onBulkDelete: () => void` - Bulk delete action
  - `loading: boolean` - Loading state
- UI Features:
  - Header with count: "Found X similar risks"
  - List of similar risks with:
    - Checkbox for selection
    - Similarity score badge (color-coded: red >80%, yellow 60-80%, gray <60%)
    - Risk title (clickable to view)
    - Risk category, score, owner (summary info)
    - "View" button (opens in new tab)
  - Bulk actions toolbar (when risks selected):
    - "Delete Selected" button
    - "Export Selected" button
  - Empty state: "No similar risks found (threshold: 70%)"

### 7. Similarity Alert Component

- **File**: `frontend/src/components/SimilarityAlert.tsx` (new file)
- Alert component for showing similarity suggestions during creation
- Props:
  - `similarRisks: SimilarRisk[]` - Similar risks found
  - `onViewRisk: (riskId: string) => void` - View risk callback
  - `onUseAsTemplate: (riskId: string) => void` - Duplicate risk callback
  - `onDismiss: () => void` - Dismiss alert
- UI Features:
  - Alert with warning icon
  - Message: "Found X similar risk(s). Review before creating."
  - Collapsible list of similar risks (show top 3, expand for more)
  - Each risk shows:
    - Similarity score
    - Title (clickable)
    - "View" and "Use as Template" buttons
  - "Continue Creating" button (dismisses alert)
  - "Dismiss" button

### 8. Update RiskFormModal

- **File**: `frontend/src/components/RiskFormModal.tsx`
- Add "Find Similar Risks" button in header (when viewing existing risk)
  - Only visible when `risk` prop is provided (not in create mode)
  - Positioned next to "Save" button or in actions area
- Add state for similar risks panel:
  - `const [similarRisks, setSimilarRisks] = useState<SimilarRisk[]>([]);`
  - `const [showSimilarRisks, setShowSimilarRisks] = useState(false);`
  - `const [similarRisksLoading, setSimilarRisksLoading] = useState(false);`
  - `const [selectedSimilarRiskIds, setSelectedSimilarRiskIds] = useState<Set<string>>(new Set());`
- Add handler `handleFindSimilarRisks`:
  - Sets loading state
  - Calls `api.findSimilarRisks(risk.id)`
  - Updates state and shows panel
- Add debounced similarity checking for creation mode:
  - Use `useDebounce` hook for `title`, `threatDescription`, `description`
  - `useEffect` that triggers when debounced values change
  - Only check if at least `title` has 3+ characters
  - Calls `api.checkSimilarity` with current form data
  - Shows `SimilarityAlert` if similar risks found (threshold: 70%)
- Add `SimilarRisksPanel` component below form (conditionally rendered)
- Add `SimilarityAlert` component at top of form (conditionally rendered)
- Add handler `handleViewSimilarRisk`:
  - Opens risk in new tab: `window.open(\`/risks?view=\${riskId}\`, '_blank')`
- Add handler `handleUseAsTemplate`:
  - Fetches risk data
  - Populates form with risk data (excluding ID, dates)
  - Closes similarity alert
  - Shows toast: "Risk data loaded. Review and save as new risk."

### 9. Debounce Hook

- **File**: `frontend/src/hooks/useDebounce.ts` (already exists, verify it works for multiple values)
- Ensure hook supports debouncing multiple values or create separate instances

### 10. Types

- **File**: `frontend/src/types/risk.ts` (or create if doesn't exist)
- Add types:
  ```typescript
  export interface SimilarRisk {
    risk: Risk;
    similarityScore: number; // 0-100
    matchedFields: string[]; // ['title', 'threatDescription', 'description']
  }
  
  export interface SimilarRiskResult {
    risk: Risk;
    score: number;
    fields: string[];
  }
  ```


## Implementation Details

### Similarity Calculation Strategy

**Option 1: Embeddings (Recommended for local models)**

- Use Ollama embeddings API: `POST /api/embeddings`
- Generate embedding for: `title + " " + threatDescription + " " + description`
- Calculate cosine similarity between embeddings
- Map similarity to 0-100 score

**Option 2: Chat-based (Fallback)**

- Use Ollama chat API: `POST /api/chat`
- Prompt: "Compare these two risks and give a similarity score 0-100..."
- Parse response for score

### Similarity Thresholds

- **High similarity (80-100%)**: Red badge, strong warning
- **Medium similarity (60-80%)**: Yellow badge, moderate warning
- **Low similarity (<60%)**: Gray badge, informational only
- Default threshold for filtering: 70%

### Performance Considerations

- Cache similarity results per risk (in-memory, TTL: 5 minutes)
- Limit similarity checks to non-archived risks only
- Debounce input checks (1.5 seconds after typing stops)
- Only check if minimum text length met (title: 3 chars, description: 10 chars)

### Error Handling

- If LLM service unavailable, show friendly error: "Similarity checking temporarily unavailable"
- Gracefully degrade: Allow risk creation even if similarity check fails
- Log errors for debugging

## Files to Create/Modify

1. `backend/src/services/llmService.ts` - LLM integration
2. `backend/src/services/similarityService.ts` - Similarity orchestration
3. `backend/src/routes/risks.ts` - Add similarity endpoints
4. `backend/src/config.ts` - Add LLM configuration
5. `.env.example` - Add LLM env vars
6. `frontend/src/components/SimilarRisksPanel.tsx` - Similar risks display
7. `frontend/src/components/SimilarityAlert.tsx` - Creation-time alerts
8. `frontend/src/components/RiskFormModal.tsx` - Integrate features
9. `frontend/src/services/api.ts` - Add API functions
10. `frontend/src/types/risk.ts` - Add types (or extend existing)

## Testing Considerations

- Test with Ollama running locally
- Test similarity detection with known duplicate risks
- Test debouncing during rapid typing
- Test bulk actions on similar risks
- Test "Use as Template" functionality
- Test error handling when LLM unavailable
- Verify similarity scores are reasonable (not all 100%, not all 0%)

## Dependencies

- Backend: May need `axios` for Ollama API calls (if not already present)
- Frontend: `useDebounce` hook (already exists)

### To-dos

- [ ] Add export button with CSV, Excel, PDF format options
- [ ] Implement saved filter presets/views that users can name and switch between
- [ ] Add empty state illustration with helpful message and Clear Filters button
- [ ] Allow drag-and-drop column reordering with persistence
- [ ] Update pagination text to show filtered vs total counts