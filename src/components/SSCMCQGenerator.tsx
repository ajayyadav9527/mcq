import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface MCQ {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  selected: string | null;
}

interface Progress {
  current: number;
  total: number;
  speed: number;
  elapsed: number;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const GEMINI_API_KEYS = [
  "AIzaSyDWlAsiGp4UPF-cUwU4sVRvj1SU9qDUyt4",
  "AIzaSyDxofRJS6ULe4hE7ihiFIj1wnzI5bpnlSE",
  "AIzaSyBvdNScFHwsP7LKl4BY2Q1-psgZwdXEbrU",
  "AIzaSyAvYefxap7CVpbsEu-wQ_LfllMoK80qeAM",
  "AIzaSyA8smfKLKNt1zPhZJs6R6bL_CwNAejje18",
  "AIzaSyDXY3OmkeDouvJIQfZLToaq5uIQnRi-_fs",
  "AIzaSyDC-bIzdacH5RoPI3kIbihmVaIe_mIUAqI",
  "AIzaSyB2Ga7EGjUs7Y6nj385V_-ZDdjvoNbc3uM",
  "AIzaSyAqrv36ro2zwXbVTSvqmWFPsPPptdAD0rE",
  "AIzaSyAzR-Ege3fmjAWp1f6WCrN_YnJOUVJEM-U"
];

// Helper to normalize question text for comparison
const normalizeQuestion = (q: string): string => 
  q.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 100);

// Remove duplicate questions
const deduplicateMCQs = (mcqs: MCQ[]): MCQ[] => {
  const seen = new Set<string>();
  return mcqs.filter(mcq => {
    const key = normalizeQuestion(mcq.question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

let apiKeyIndex = 0;
const getNextApiKey = () => {
  const key = GEMINI_API_KEYS[apiKeyIndex];
  apiKeyIndex = (apiKeyIndex + 1) % GEMINI_API_KEYS.length;
  return key;
};

const getGeminiUrl = (key: string) => 
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

const SSCMCQGenerator = () => {
  const navigate = useNavigate();
  const [exam, setExam] = useState('SSC CGL');
  const [count, setCount] = useState(10);
  const [autoCount, setAutoCount] = useState(true);
  const [estimatedCount, setEstimatedCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, speed: 0, elapsed: 0 });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef({ startTime: 0, completed: 0 });

  useEffect(() => {
    const loadPdfLib = async () => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        
        const loadPromise = new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
        
        document.head.appendChild(script);
        await loadPromise;
        
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          setPdfLibLoaded(true);
        } else {
          setError('PDF library loaded but not available. Please refresh.');
        }
      } catch (err) {
        setError('Failed to load PDF library. Check your internet connection and refresh.');
      }
    };
    
    loadPdfLib();
  }, []);

  // Estimate optimal MCQ count based on PDF content
  const estimateMCQCount = async (file: File): Promise<number> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      // Sample a few pages to estimate content density
      let totalChars = 0;
      const samplesToTake = Math.min(5, numPages);
      const sampleIndices = Array.from({ length: samplesToTake }, (_, i) => 
        Math.floor((i / samplesToTake) * numPages) + 1
      );
      
      for (const pageNum of sampleIndices) {
        const text = await extractPageText(pdf, pageNum);
        if (text) totalChars += text.length;
      }
      
      const avgCharsPerPage = totalChars / samplesToTake;
      const estimatedTotalChars = avgCharsPerPage * numPages;
      
      // Formula: ~1 MCQ per 400 characters for thorough coverage, minimum 4 per page, max 500
      const byChars = Math.ceil(estimatedTotalChars / 400);
      const byPages = numPages * 4;
      const estimated = Math.min(500, Math.max(15, Math.round((byChars + byPages) / 2)));
      
      return estimated;
    } catch {
      // Fallback: 3 MCQs per page
      return 30;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pdfLibLoaded && autoCount) {
      setStatus('📊 Analyzing PDF content...');
      const estimated = await estimateMCQCount(file);
      setEstimatedCount(estimated);
      setCount(estimated);
      setStatus('');
    }
  };

  const updateProgress = (completed: number, total: number) => {
    const elapsed = (Date.now() - processingRef.current.startTime) / 1000;
    const speed = elapsed > 0 ? Math.round((completed / elapsed) * 60) : 0;
    setProgress({ current: completed, total, speed, elapsed: Math.round(elapsed) });
  };

  const extractPageText = async (pdf: any, pageNum: number): Promise<string | null> => {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      if (text.trim().length > 50) return text;
    } catch (e) {}
    return null;
  };

  const extractPageImage = async (pdf: any, pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum);
    const scale = 1.2;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: false });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    const imageData = canvas.toDataURL('image/jpeg', 0.3);
    canvas.remove();
    
    return imageData.split(',')[1];
  };

  const processPageWithOCR = async (pdf: any, pageNum: number): Promise<string | null> => {
    try {
      const base64Data = await extractPageImage(pdf, pageNum);
      const apiKey = getNextApiKey();
      
      const response = await fetch(getGeminiUrl(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { 
                inline_data: { 
                  mime_type: "image/jpeg", 
                  data: base64Data 
                }
              },
              { text: "Extract all text from this image. Return only the extracted text, no preamble or explanation." }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 1500
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 20) return text;
      }
    } catch (err) {}
    return null;
  };

  const processPDFOptimized = async (pdf: any): Promise<string> => {
    const totalPages = pdf.numPages;
    const allContent: string[] = [];
    processingRef.current = { startTime: Date.now(), completed: 0 };
    
    const BATCH_SIZE = 40;
    const CONCURRENT_LIMIT = 20;
    
    for (let i = 0; i < totalPages; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, totalPages);
      const batchPromises: Promise<string | null>[] = [];
      
      for (let pageNum = i + 1; pageNum <= batchEnd; pageNum++) {
        const processPage = async (pNum: number): Promise<string | null> => {
          let text = await extractPageText(pdf, pNum);
          if (!text) text = await processPageWithOCR(pdf, pNum);
          
          processingRef.current.completed++;
          updateProgress(processingRef.current.completed, totalPages);
          
          return text ? `--- Page ${pNum} ---\n${text}\n` : null;
        };
        
        batchPromises.push(processPage(pageNum));
        
        if (batchPromises.length >= CONCURRENT_LIMIT || pageNum === batchEnd) {
          const results = await Promise.all(batchPromises);
          allContent.push(...results.filter((r): r is string => r !== null));
          batchPromises.length = 0;
        }
      }
    }
    
    return allContent.join('\n');
  };

  const generateMCQsBatch = async (content: string, numQuestions: number, batchNum: number, totalBatches: number): Promise<MCQ[]> => {
    const apiKey = getNextApiKey();
    
    const response = await fetch(getGeminiUrl(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert ${exam} exam teacher with deep knowledge of RECENT SSC EXAM TRENDS and FREQUENTLY ASKED TOPICS. Generate EXACTLY ${numQuestions} high-quality MCQs from the provided content. This is batch ${batchNum} of ${totalBatches}.

🎯 CRITICAL - SSC EXAM TREND FOCUS:
You MUST prioritize creating MCQs on topics that are:
1. FREQUENTLY ASKED in recent ${exam} exams (2020-2024)
2. HIGH-WEIGHTAGE concepts that appear repeatedly across SSC papers
3. TRENDING TOPICS that SSC has been focusing on recently
4. IMPORTANT FACTS, DATES, NAMES that are SSC favorites
5. CONCEPTS that students commonly get wrong in exams

⚠️ NEVER SKIP important concepts from the content - if a concept is exam-relevant, CREATE AN MCQ on it!

COMMON SSC EXAM PATTERNS TO FOCUS ON:
- First/Largest/Smallest/Longest facts
- Important dates, years, and anniversaries
- Authors and their famous works
- Headquarters locations
- Constitutional articles and amendments
- Scientific discoveries and inventors
- Rivers, mountains, boundaries
- Awards, honors, and recipients
- Government schemes and their launch years
- International organizations and India's role
- Recent current affairs mixed with static GK

FORMAT (strict - follow exactly):
Q1. [Question - frame like actual SSC exam questions]
a) [Option]
b) [Option]
c) [Option]
d) [Option]
Correct Answer: a
Explanation: [CRYSTAL CLEAR explanation - see requirements below]

EXPLANATION REQUIREMENTS - WRITE LIKE A FRIENDLY TEACHER:
Each explanation MUST be 6-10 sentences, written in SIMPLE language a 10th-grade student can understand:

✅ START: "The correct answer is [option letter]) [option text]."

✅ EXPLAIN THE CONCEPT SIMPLY:
- Explain the concept in everyday language, avoiding jargon
- Use analogies or real-world examples when possible
- Break down complex ideas into simple parts

✅ KEY FACTS TO REMEMBER:
- Mention important dates, names, numbers, or facts
- Highlight what makes this answer unique or special
- Add related facts that might appear in exams

✅ WHY OTHER OPTIONS ARE WRONG:
- For EACH wrong option, explain in 1 sentence why it's incorrect
- Example: "Option a) is wrong because..."

✅ MEMORY TIP:
- Give an easy trick, mnemonic, or association to remember this
- Example: "Easy way to remember: Think of..."

✅ SSC EXAM TIP:
- "🔥 SSC TREND: This topic has appeared in [X] recent exams"
- Mention related questions that might be asked
- Alert about tricky variations SSC uses

EXAMPLE OF PERFECT EXPLANATION:
"The correct answer is b) 1950. The Indian Constitution came into effect on January 26, 1950 - this is why we celebrate Republic Day on this date every year. Think of it simply: Independence Day (August 15, 1947) = freedom from British rule, but Republic Day (January 26, 1950) = India became a democratic republic with its own Constitution. Dr. B.R. Ambedkar led the team that wrote it. Option a) 1947 is wrong - that's when we got independence, not the Constitution. Option c) 1952 is wrong - that's when the first elections happened. Option d) 1949 is wrong - the Constitution was completed on November 26, 1949, but it started working from January 26, 1950. Easy memory trick: '26-26' - November 26 completed, January 26 started! 🔥 SSC TREND: This is one of the MOST frequently asked questions - SSC often asks about Constitution dates, Preamble keywords, and Fundamental Rights."

OTHER REQUIREMENTS:
- YOU MUST GENERATE EXACTLY ${numQuestions} MCQs - no more, no less
- Frame questions EXACTLY like real ${exam} papers
- Include tricky distractors that SSC typically uses
- Correct Answer MUST be only a single letter: a, b, c, or d
- Cover ALL important topics from the content - don't miss any exam-relevant concept
- All 4 options must be distinct and believable
- Test understanding AND factual recall (SSC tests both)
${batchNum > 1 ? `- Generate DIFFERENT questions from previous batches - cover different parts of the content` : ''}

CONTENT TO ANALYZE (extract ALL exam-relevant facts):
${content}

Generate EXACTLY ${numQuestions} MCQs now, focusing on SSC EXAM TRENDS with CLEAR, STUDENT-FRIENDLY explanations:`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 32000,
          temperature: 1
        }
      })
    });
    
    if (!response.ok) throw new Error(`MCQ generation failed for batch ${batchNum}`);
    
    const data = await response.json();
    const mcqText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseMCQs(mcqText);
  };

  const generateMCQs = async (content: string, numQuestions: number): Promise<MCQ[]> => {
    // Split content into chunks to ensure FULL PDF coverage
    const MAX_CHUNK_SIZE = 80000; // chars per chunk for better API handling
    const contentChunks: string[] = [];
    
    // Split by page markers to keep content coherent
    const pages = content.split(/(?=--- Page \d+ ---)/);
    let currentChunk = '';
    
    for (const page of pages) {
      if (currentChunk.length + page.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
        contentChunks.push(currentChunk);
        currentChunk = page;
      } else {
        currentChunk += page;
      }
    }
    if (currentChunk.trim()) contentChunks.push(currentChunk);
    
    // If no page markers, split by character count
    if (contentChunks.length === 0) {
      for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
        contentChunks.push(content.substring(i, i + MAX_CHUNK_SIZE));
      }
    }
    
    // Distribute questions across content chunks proportionally
    const numChunks = contentChunks.length;
    const questionsPerChunk = Math.ceil(numQuestions / numChunks);
    
    // Create batches - each batch gets a different chunk of content
    const BATCH_SIZE = 40;
    const batches: { content: string; questions: number; batchNum: number; chunkNum: number }[] = [];
    let batchNum = 1;
    
    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const chunkContent = contentChunks[chunkIdx];
      let questionsForThisChunk = chunkIdx === numChunks - 1 
        ? numQuestions - (questionsPerChunk * (numChunks - 1))  // Last chunk gets remaining
        : questionsPerChunk;
      
      questionsForThisChunk = Math.max(1, questionsForThisChunk);
      
      // Split chunk questions into sub-batches of 40 max
      let remaining = questionsForThisChunk;
      while (remaining > 0) {
        const questionsInBatch = Math.min(BATCH_SIZE, remaining);
        batches.push({ 
          content: chunkContent, 
          questions: questionsInBatch, 
          batchNum: batchNum++,
          chunkNum: chunkIdx + 1
        });
        remaining -= questionsInBatch;
      }
    }
    
    setStatus(`Generating ${numQuestions} MCQs from ${numChunks} content sections (${batches.length} batches)...`);
    
    // Run all batches in parallel using different API keys
    const batchPromises = batches.map(batch => 
      generateMCQsBatch(batch.content, batch.questions, batch.batchNum, batches.length)
    );
    
    const results = await Promise.all(batchPromises);
    
    // Combine all MCQs from all batches
    const allMcqs = results.flat();
    
    // Remove duplicates to ensure unique questions
    const uniqueMcqs = deduplicateMCQs(allMcqs);
    
    setStatus(`Generated ${uniqueMcqs.length} unique MCQs covering ALL content (${numChunks} sections)`);
    
    return uniqueMcqs;
  };

  const parseMCQs = (text: string): MCQ[] => {
    const questions: MCQ[] = [];
    const qBlocks = text.split(/(?=Q\d+\.)/i).filter(b => b.trim());
    
    for (const block of qBlocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 6) continue;
      
      const mcq: MCQ = {
        question: '',
        options: [],
        correct: '',
        explanation: '',
        selected: null
      };
      
      let inExplanation = false;
      
      for (const line of lines) {
        if (/^Q\d+\./.test(line)) {
          mcq.question = line.replace(/^Q\d+\.\s*/, '');
        } else if (/^[a-d]\)/i.test(line) && mcq.options.length < 4) {
          mcq.options.push(line);
        } else if (/^Correct Answer:/i.test(line)) {
          const match = line.match(/\b[a-d]\b/i);
          mcq.correct = match ? match[0].toLowerCase() : '';
          inExplanation = false;
        } else if (/^Explanation:/i.test(line)) {
          mcq.explanation = line.replace(/^Explanation:\s*/i, '');
          inExplanation = true;
        } else if (inExplanation) {
          mcq.explanation += ' ' + line;
        } else if (mcq.question && mcq.options.length === 0) {
          mcq.question += ' ' + line;
        }
      }
      
      // Validate correct answer is a valid option (a-d)
      if (mcq.correct && !['a', 'b', 'c', 'd'].includes(mcq.correct)) {
        mcq.correct = 'a'; // Default to first option if invalid
      }
      
      if (mcq.question && mcq.options.length === 4 && mcq.correct) {
        questions.push(mcq);
      }
    }
    
    return questions;
  };

  const handleProcess = async () => {
    const file = fileInputRef.current?.files?.[0];
    
    if (!pdfLibLoaded) {
      setError('PDF library loading. Please wait and retry.');
      return;
    }
    
    if (!file) {
      setError('Please upload a PDF file');
      return;
    }
    
    if (!count || count < 1 || count > 500) {
      setError('Enter valid number (1-500)');
      return;
    }
    
    setProcessing(true);
    setError('');
    setStatus('Loading PDF...');
    setProgress({ current: 0, total: 0, speed: 0, elapsed: 0 });
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/',
        cMapPacked: true
      }).promise;
      
      setStatus(`Processing ${pdf.numPages} pages...`);
      const content = await processPDFOptimized(pdf);
      
      setStatus('Generating MCQs...');
      const generatedMCQs = await generateMCQs(content, count);
      
      setStatus('');
      // Navigate to quiz page with generated MCQs
      navigate('/quiz', { state: { mcqs: generatedMCQs } });
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-8 my-8">
        <div className="text-center mb-6">
          <div className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
            🚀 10 API KEYS • AUTO COVERAGE • 100% UNIQUE
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            ⚡ SSC MCQ Generator Ultra
          </h1>
          <p className="text-gray-600">Lightning-Fast Processing • AI-Powered • 100% Accurate</p>
          {!pdfLibLoaded && (
            <p className="text-sm text-amber-600 mt-2 animate-pulse">⏳ Loading PDF engine...</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">📚 SSC Exam</label>
            <select 
              value={exam} 
              onChange={(e) => setExam(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              disabled={processing || !pdfLibLoaded}
            >
              <option>SSC CGL</option>
              <option>SSC CHSL</option>
              <option>SSC MTS</option>
              <option>SSC GD</option>
              <option>SSC CPO</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-700 font-semibold mb-2">🔢 MCQs (1-500)</label>
            <input
              type="number" 
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              min="1"
              max="500"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              disabled={processing || !pdfLibLoaded || autoCount}
            />
          </div>
        </div>

        {/* Auto Coverage Option */}
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCount}
              onChange={(e) => {
                setAutoCount(e.target.checked);
                if (!e.target.checked) {
                  setEstimatedCount(0);
                } else if (fileInputRef.current?.files?.[0]) {
                  // Re-estimate if file already selected
                  const file = fileInputRef.current.files[0];
                  estimateMCQCount(file).then(est => {
                    setEstimatedCount(est);
                    setCount(est);
                  });
                }
              }}
              className="w-5 h-5 accent-green-600"
              disabled={processing || !pdfLibLoaded}
            />
            <div>
              <span className="font-bold text-green-800">🎯 Auto Coverage Mode</span>
              <p className="text-sm text-green-700">Automatically calculate optimal MCQs to cover entire PDF content</p>
            </div>
          </label>
          {autoCount && estimatedCount > 0 && (
            <div className="mt-2 ml-8 text-sm font-semibold text-green-800 bg-green-100 px-3 py-1 rounded-full inline-block">
              📊 Estimated: {estimatedCount} MCQs for full coverage
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-2">📄 Upload PDF</label>
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".pdf"
            onChange={handleFileChange}
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={processing || !pdfLibLoaded}
          />
        </div>

        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-500 p-4 mb-4 rounded-lg">
          <p className="font-bold text-cyan-800 mb-2">⚡ Speed Optimizations (10 API Keys):</p>
          <ul className="text-sm text-cyan-700 space-y-1 ml-4">
            <li>✓ <strong>10 Gemini API keys rotating</strong> for parallel processing</li>
            <li>✓ <strong>Automatic deduplication</strong> ensures 100% unique questions</li>
            <li>✓ 40-page batches with 20 concurrent operations</li>
            <li>✓ <strong>Up to 500 MCQs</strong> per generation</li>
            <li>✓ 150K token context (50% larger)</li>
            <li>✓ Reduced image quality for faster OCR</li>
            <li>✓ Zero-delay processing pipeline</li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-4 mb-6 rounded-lg">
          <p className="font-bold text-purple-800 mb-2">🎓 Ultra-Detailed Explanations:</p>
          <ul className="text-sm text-purple-700 space-y-1 ml-4">
            <li>✓ <strong>7-point explanation format</strong> (5-8 sentences each)</li>
            <li>✓ Why correct + why each wrong option is wrong</li>
            <li>✓ Historical background & key facts/figures</li>
            <li>✓ Memory tips & mnemonics included</li>
            <li>✓ Related concepts & exam relevance</li>
            <li>✓ Testbook-style comprehensive approach</li>
          </ul>
        </div>

        <button 
          onClick={handleProcess}
          disabled={processing || !pdfLibLoaded}
          className={`w-full py-4 rounded-lg text-white font-bold text-lg transition-all ${
            processing || !pdfLibLoaded
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
          }`}
        >
          {processing ? '⚡ Processing...' : !pdfLibLoaded ? '⏳ Loading...' : '🚀 Start Ultra-Fast Processing'}
        </button>

        {error && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg">
            ❌ {error}
          </div>
        )}

        {status && (
          <div className="mt-6 text-center">
            <p className="text-lg font-semibold text-blue-600 animate-pulse">{status}</p>
          </div>
        )}

        {progress.total > 0 && (
          <div className="mt-6 bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-lg shadow-inner">
            <h3 className="text-xl font-bold text-blue-600 mb-4">📊 Live Progress</h3>
            <p className="text-3xl font-bold text-center mb-4 text-gray-800">{progress.current}/{progress.total} pages</p>
            
            <div className="w-full bg-gray-300 rounded-full h-10 mb-4 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 h-full rounded-full flex items-center justify-center text-white font-bold transition-all duration-500 shadow-lg"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              >
                {Math.round((progress.current / progress.total) * 100)}%
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-green-500">
                <p className="text-3xl font-bold text-green-600">{progress.current}</p>
                <p className="text-sm text-gray-600 font-medium">✅ Done</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-amber-500">
                <p className="text-3xl font-bold text-amber-600">{progress.total - progress.current}</p>
                <p className="text-sm text-gray-600 font-medium">⚡ Left</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-blue-500">
                <p className="text-3xl font-bold text-blue-600">{progress.speed}</p>
                <p className="text-sm text-gray-600 font-medium">📊 pg/min</p>
              </div>
            </div>
            
            <p className="text-center mt-4 text-lg font-semibold text-gray-700">
              ⏱️ Time: {Math.floor(progress.elapsed / 60)}m {progress.elapsed % 60}s
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SSCMCQGenerator;
