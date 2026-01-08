import * as fs from 'fs';
import * as path from 'path';

interface ParsedControl {
  code: string;
  title: string;
  controlText: string;
  purpose: string;
  guidance: string;
  otherInformation: string | null;
  category: 'ORGANIZATIONAL' | 'PEOPLE' | 'PHYSICAL' | 'TECHNOLOGICAL';
}

/**
 * Parse ISO 27002 markdown file and extract all controls
 */
export function parseISO27002Controls(filePath: string): ParsedControl[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const controls: ParsedControl[] = [];
  let currentSection: '5' | '6' | '7' | '8' | null = null;
  let currentControl: Partial<ParsedControl> | null = null;
  let currentSectionType: 'control' | 'purpose' | 'guidance' | 'other' | null = null;
  let sectionBuffer: string[] = [];
  const controlCounters: Record<string, number> = { '5': 1, '6': 1, '7': 1, '8': 1 };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section start (5, 6, 7, 8)
    // Save previous control before switching sections
    if (line.match(/^5\.\s+Organizational controls/)) {
      // Save previous control if exists
      if (currentControl && currentControl.code) {
        if (sectionBuffer.length > 0) {
          saveSection(currentControl, currentSectionType, sectionBuffer);
        }
        controls.push(currentControl as ParsedControl);
      }
      currentSection = '5';
      controlCounters['5'] = 1;
      currentControl = null;
      currentSectionType = null;
      sectionBuffer = [];
      continue;
    } else if (line.match(/^6\.\s+People controls/)) {
      // Save previous control if exists
      if (currentControl && currentControl.code) {
        if (sectionBuffer.length > 0) {
          saveSection(currentControl, currentSectionType, sectionBuffer);
        }
        controls.push(currentControl as ParsedControl);
      }
      currentSection = '6';
      controlCounters['6'] = 1;
      currentControl = null;
      currentSectionType = null;
      sectionBuffer = [];
      continue;
    } else if (line.match(/^7\.\s+Physical controls/)) {
      // Save previous control if exists
      if (currentControl && currentControl.code) {
        if (sectionBuffer.length > 0) {
          saveSection(currentControl, currentSectionType, sectionBuffer);
        }
        controls.push(currentControl as ParsedControl);
      }
      currentSection = '7';
      controlCounters['7'] = 1;
      currentControl = null;
      currentSectionType = null;
      sectionBuffer = [];
      continue;
    } else if (line.match(/^8\.\s+Technological controls/)) {
      // Save previous control if exists
      if (currentControl && currentControl.code) {
        if (sectionBuffer.length > 0) {
          saveSection(currentControl, currentSectionType, sectionBuffer);
        }
        controls.push(currentControl as ParsedControl);
      }
      currentSection = '8';
      controlCounters['8'] = 1;
      currentControl = null;
      currentSectionType = null;
      sectionBuffer = [];
      continue;
    }
    
    // Skip if not in a control section
    if (!currentSection) continue;
    
    // Detect control heading (#### Title or 1.  #### Title) - must be followed by a table
    // Handle both formats: "#### Title" and "1.  #### Title"
    const controlHeadingMatch = line.match(/^(?:\s*\d+\.\s+)?####\s+(.+)$/);
    if (controlHeadingMatch) {
      // Check if next few lines contain a table (indicates this is a control heading)
      // Look further ahead (up to 10 lines) to catch tables that might have blank lines before them
      const nextLines = lines.slice(i + 1, Math.min(i + 10, lines.length));
      // Table pattern: lines starting with + and containing - or = (table borders)
      // Also accept lines that are clearly table rows (containing | characters in a table-like pattern)
      const hasTable = nextLines.some(l => 
        l.match(/^\+.*[-=].*\+/) || // Table border line
        (l.match(/^\|/) && l.match(/\|.*\|/)) // Table row with multiple columns
      );
      
      if (hasTable) {
        // Save previous control if exists
        if (currentControl && currentControl.code) {
          if (sectionBuffer.length > 0) {
            saveSection(currentControl, currentSectionType, sectionBuffer);
          }
          controls.push(currentControl as ParsedControl);
        }
        
        // Use current counter value, then increment for next control
        const title = controlHeadingMatch[1].trim();
        const controlNumber = controlCounters[currentSection];
        
        currentControl = {
          code: `${currentSection}.${controlNumber}`,
          title,
          controlText: '',
          purpose: '',
          guidance: '',
          otherInformation: null,
          category: getCategory(currentSection),
        };
        
        // Increment counter for next control in this section
        controlCounters[currentSection]++;
        
        currentSectionType = null;
        sectionBuffer = [];
        continue;
      }
    }
    
    // Detect section type headers
    if (line.match(/^##### Control$/)) {
      if (currentControl && sectionBuffer.length > 0) {
        saveSection(currentControl, currentSectionType, sectionBuffer);
      }
      currentSectionType = 'control';
      sectionBuffer = [];
      continue;
    } else if (line.match(/^##### Purpose$/)) {
      if (currentControl && sectionBuffer.length > 0) {
        saveSection(currentControl, currentSectionType, sectionBuffer);
      }
      currentSectionType = 'purpose';
      sectionBuffer = [];
      continue;
    } else if (line.match(/^##### Guidance$/)) {
      if (currentControl && sectionBuffer.length > 0) {
        saveSection(currentControl, currentSectionType, sectionBuffer);
      }
      currentSectionType = 'guidance';
      sectionBuffer = [];
      continue;
    } else if (line.match(/^##### Other information$/)) {
      if (currentControl && sectionBuffer.length > 0) {
        saveSection(currentControl, currentSectionType, sectionBuffer);
      }
      currentSectionType = 'other';
      sectionBuffer = [];
      continue;
    }
    
    // Detect end of control (next control or section end) - handled in control heading detection
    
    // Collect content for current section
    if (currentSectionType && currentControl) {
      // Skip table lines and other formatting
      if (line.match(/^\+[-=]+\+/) || line.match(/^\|/) || line.trim() === '') {
        // Skip table rows but keep empty lines for formatting
        if (line.trim() === '') {
          sectionBuffer.push('');
        }
        continue;
      }
      
      // Clean up markdown formatting
      let cleanLine = line;
      // Remove blockquote markers
      cleanLine = cleanLine.replace(/^>\s*/, '');
      // Remove markdown links but keep text
      cleanLine = cleanLine.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      // Remove underline markers
      cleanLine = cleanLine.replace(/\{\.underline\}/g, '');
      
      if (cleanLine.trim() || sectionBuffer.length > 0) {
        sectionBuffer.push(cleanLine);
      }
    }
  }
  
  // Save last control
  if (currentControl && currentControl.code) {
    if (sectionBuffer.length > 0) {
      saveSection(currentControl, currentSectionType, sectionBuffer);
    }
    controls.push(currentControl as ParsedControl);
  }
  
  return controls;
}


function getCategory(section: string): 'ORGANIZATIONAL' | 'PEOPLE' | 'PHYSICAL' | 'TECHNOLOGICAL' {
  switch (section) {
    case '5':
      return 'ORGANIZATIONAL';
    case '6':
      return 'PEOPLE';
    case '7':
      return 'PHYSICAL';
    case '8':
      return 'TECHNOLOGICAL';
    default:
      return 'ORGANIZATIONAL';
  }
}

function saveSection(
  control: Partial<ParsedControl>,
  sectionType: string | null,
  buffer: string[]
): void {
  if (!sectionType || !control) return;
  
  const text = buffer
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();
  
  switch (sectionType) {
    case 'control':
      control.controlText = text;
      break;
    case 'purpose':
      control.purpose = text;
      break;
    case 'guidance':
      control.guidance = text;
      break;
    case 'other':
      control.otherInformation = text || null;
      break;
  }
}

// CLI execution
if (require.main === module) {
  const markdownPath = path.join(__dirname, '../../docs/ISO_IEC_27002_2022(en).md');
  const outputPath = path.join(__dirname, 'iso27002-controls.json');
  
  try {
    const controls = parseISO27002Controls(markdownPath);
    fs.writeFileSync(outputPath, JSON.stringify(controls, null, 2), 'utf-8');
    console.log(`✅ Parsed ${controls.length} controls from ISO 27002`);
    console.log(`📄 Output written to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error parsing ISO 27002:', error);
    process.exit(1);
  }
}

