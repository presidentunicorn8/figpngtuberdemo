let dialogueLines = [];
let currentLineIndex = 0;
let isTyping = false;
let typeInterval = null;

async function loadDialogue(filePath) {
  try {
    const response = await fetch(filePath);
    const text = await response.text();

    const rawBlocks = text.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
    dialogueLines = [];

    rawBlocks.forEach(block => {
      let linePose = null;
      const poseMatch = block.match(/<!--\s*(?:pose|post)?:\s*(\w+)\s*-->/i) || block.match(/<!--\s*(\w+)\s*-->/i);
      if (poseMatch) linePose = poseMatch[1].toLowerCase();

      const cleanBlock = block.replace(/<!--[\s\S]*?-->/g, '').trim();

      // 1. Check for Redirect Link syntax: [path/file.md]
      if (cleanBlock.startsWith('[') && cleanBlock.endsWith(']')) {
        const redirectPath = cleanBlock.slice(1, -1).trim().replace(/\\/g, '/');
        dialogueLines.push({
          type: 'redirect',
          targetPath: redirectPath,
          pose: linePose
        });
        return;
      }

      // 2. Check for Bulleted Choice List
      const lines = cleanBlock.split('\n').map(l => l.trim()).filter(Boolean);
      const choiceLines = lines.filter(l => l.startsWith('-'));

      if (choiceLines.length > 0) {
        const promptText = lines.filter(l => !l.startsWith('-')).join(' ');
        
        // Normalize slashes and trim trailing slashes so folders like "blogposts\entries\" clean up to "blogposts/entries"
        const paths = choiceLines.map(l => {
          return l.replace('-', '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
        });

        dialogueLines.push({
          type: 'choice',
          prompt: promptText || "Choose an option...",
          paths: paths,
          pose: linePose
        });
      } else if (cleanBlock && !cleanBlock.startsWith('#')) {
        // 3. Regular Spoken Text Line
        dialogueLines.push({
          type: 'text',
          text: cleanBlock,
          pose: linePose
        });
      }
    });

    currentLineIndex = 0;
    if (dialogueLines.length > 0) showLine(currentLineIndex);
  } catch (err) {
    console.error('Error loading dialogue markdown:', err);
  }
}

async function showLine(index) {
  const textEl = document.getElementById('vn-text');
  const choicesEl = document.getElementById('vn-choices');
  const lineData = dialogueLines[index];

  if (!lineData) return;
  if (choicesEl) choicesEl.innerHTML = '';

  // Trigger pose tag if present
  if (lineData.pose && typeof setWaving === 'function') {
    const isWave = lineData.pose.includes('wave');
    setWaving(isWave);
  }

  // CHOICE BRANCH BLOCK
  if (lineData.type === 'choice') {
    runTypewriter(lineData.prompt);

    let finalPaths = [];
    let neededRandomCount = 0;
    let targetFolderKey = null;

    // 1. Sort out explicit .md paths vs folder targets
    lineData.paths.forEach(p => {
      if (p.endsWith('.md')) {
        finalPaths.push(p);
      } else {
        neededRandomCount++;
        targetFolderKey = p.split('/').pop(); // Extract "entries"
      }
    });

    // 2. Fetch random paths FIRST before any fetching happens!
    if (neededRandomCount > 0 && targetFolderKey) {
      const randomPaths = await getRandomEntries(targetFolderKey, neededRandomCount);
      
      randomPaths.forEach(rp => {
        if (!finalPaths.includes(rp)) {
          finalPaths.push(rp);
        }
      });
    }
    finalPaths.reverse(); 
    // 3. Render buttons (now guaranteed to only be valid .md file paths!)
    for (const path of finalPaths) {
      try {
        const res = await fetch(path);
        const mdText = await res.text();

        const match = mdText.match(/###\s*Description:\s*(.+)/i);
        const buttonLabel = match ? match[1].trim().replace("[","").replace("]","") : path;

        const btn = document.createElement('button');
        btn.className = 'vn-choice-btn';
        btn.textContent = buttonLabel;
        btn.onclick = (e) => {
          e.stopPropagation();
          choicesEl.innerHTML = '';
          loadDialogue(path);
        };
        choicesEl.appendChild(btn);
      } catch (err) {
        console.error('Failed loading choice file:', path, err);
      }
    }
    return;
  }

  // REGULAR TEXT BLOCK
  runTypewriter(lineData.text);
}
// Typewriter Helper
function runTypewriter(fullText) {
  const textEl = document.getElementById('vn-text');
  if (!textEl) return;

  textEl.textContent = '';
  clearInterval(typeInterval);
  isTyping = true;
  
  if (typeof setTalking === 'function') setTalking(true);

  let charIndex = 0;
  typeInterval = setInterval(() => {
    if (charIndex < fullText.length) {
      textEl.textContent += fullText.charAt(charIndex);
      charIndex++;
    } else {
      finishTyping(); // at the end of the line of text. 
    }
  }, 35);
}

// Update finishTyping to use lineData structure
function finishTyping() {
  clearInterval(typeInterval);
  const textEl = document.getElementById('vn-text');
  const currentLine = dialogueLines[currentLineIndex];

  if (textEl && currentLine) {
    // Check if it's a choice block (uses .prompt) or text block (uses .text)
    textEl.textContent = currentLine.type === 'choice' ? currentLine.prompt : currentLine.text;
  }
  
  isTyping = false;
  if (typeof setTalking === 'function') {
    setTalking(false);
  }
}

async function getRandomEntries(folderKey, count = 2) {
  try {
    const res = await fetch('blogposts/blogposts.json');
    const data = await res.json();
    
    // Grab array matching key (e.g. "entries")
    const files = data[folderKey] || [];
    
    // Pick unique random files
    const shuffled = [...files].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    // Return full relative paths
    return selected.map(file => `blogposts/${folderKey}/${file}`);
  } catch (err) {
    console.error('Error fetching blogposts.json:', err);
    return [];
  }
}

    function advanceDialogue() {
  if (dialogueLines.length === 0) return;

  // Finish typewriter instantly if currently typing
  if (isTyping) {
    finishTyping();
    return;
  }

  const currentLine = dialogueLines[currentLineIndex];

  // If current block is a choice, wait for button click (don't advance)
  if (currentLine && currentLine.type === 'choice') return;

  currentLineIndex++;

  if (currentLineIndex < dialogueLines.length) {
    const nextLine = dialogueLines[currentLineIndex];
    
    // IF NEXT BLOCK IS REDIRECT LINK: Load target markdown immediately!
    if (nextLine && nextLine.type === 'redirect') {
      loadDialogue(nextLine.targetPath);
      return;
    }

    showLine(currentLineIndex);
  } else {
    // End of file fallback
    const textEl = document.getElementById('vn-text');
    if (textEl) textEl.textContent = "— End of Chat —";
  }
}

    document.addEventListener('DOMContentLoaded', () => {
    const textbox = document.getElementById('vn-textbox');
    if (textbox) {
    textbox.addEventListener('click', (e) => {
        e.stopPropagation();
        advanceDialogue();
    });
    }


    loadDialogue('blogposts/structure/main.md');
});

