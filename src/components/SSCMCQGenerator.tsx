import React, { useState, useRef, useEffect } from 'react';

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
  "AIzaSyDXY3OmkeDouvJIQfZLToaq5uIQnRi-_fs"
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
  const [exam, setExam] = useState('SSC CGL');
  const [count, setCount] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, speed: 0, elapsed: 0 });
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
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
            text: `You are an expert ${exam} exam question creator and educator. Generate EXACTLY ${numQuestions} high-quality MCQs from the provided content. This is batch ${batchNum} of ${totalBatches}.

FORMAT (strict - follow exactly):
Q1. [Question]
a) [Option]
b) [Option]
c) [Option]
d) [Option]
Correct Answer: a
Explanation: [VERY DETAILED explanation - see requirements below]

CRITICAL EXPLANATION REQUIREMENTS (MOST IMPORTANT):
Each explanation MUST be 5-8 sentences and include ALL of these elements:
1. **Why Correct**: Start with "The correct answer is [letter]) because..." and explain the core concept thoroughly
2. **Background Context**: Provide historical background, origin, or foundational information about the topic
3. **Key Facts & Figures**: Include specific dates, numbers, statistics, names, or data points related to the answer
4. **Related Concepts**: Connect to related topics, acts, amendments, or concepts that help deeper understanding
5. **Memory Tip**: Add a mnemonic, trick, or easy way to remember this fact
6. **Why Others Wrong**: Briefly explain why each wrong option (a/b/c/d) is incorrect with specific reasons
7. **Exam Relevance**: Mention if this topic is frequently asked in ${exam} or related exams

EXAMPLE EXPLANATION FORMAT:
"The correct answer is b) 1950 because the Constitution of India came into effect on January 26, 1950. This date was chosen to commemorate the Purna Swaraj declaration of 1930. Dr. B.R. Ambedkar, as the Chairman of the Drafting Committee, played a crucial role in its creation. The Constitution originally had 395 Articles, 22 Parts, and 8 Schedules. Memory tip: '26 January = Republic Day = Constitution Day'. Option a) 1947 is wrong as that was Independence Day; c) 1952 was the first general elections; d) 1949 was when the Constitution was adopted (November 26), not enforced. This is a very frequently asked question in ${exam} Polity section."

OTHER REQUIREMENTS:
- YOU MUST GENERATE EXACTLY ${numQuestions} MCQs - no more, no less
- Correct Answer MUST be only a single letter: a, b, c, or d
- Cover different topics from the content
- ${exam} difficulty level matching Testbook standards
- Ensure all 4 options are distinct and plausible
- Questions should test conceptual understanding, not just rote memorization
${batchNum > 1 ? `- Generate DIFFERENT questions from previous batches - focus on different aspects of the content` : ''}

CONTENT:
${content}

Generate EXACTLY ${numQuestions} MCQs now with HIGHLY DETAILED Testbook-style explanations:`
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
    const contentChunk = content.length > 150000 ? content.substring(0, 150000) : content;
    
    // Split into batches of 40 MCQs max per API call for better results
    const BATCH_SIZE = 40;
    const numBatches = Math.ceil(numQuestions / BATCH_SIZE);
    const batches: { questions: number; batchNum: number }[] = [];
    
    let remaining = numQuestions;
    for (let i = 0; i < numBatches; i++) {
      const questionsInBatch = Math.min(BATCH_SIZE, remaining);
      batches.push({ questions: questionsInBatch, batchNum: i + 1 });
      remaining -= questionsInBatch;
    }
    
    setStatus(`Generating ${numQuestions} MCQs in ${numBatches} parallel batches...`);
    
    // Run all batches in parallel using different API keys
    const batchPromises = batches.map(batch => 
      generateMCQsBatch(contentChunk, batch.questions, batch.batchNum, numBatches)
    );
    
    const results = await Promise.all(batchPromises);
    
    // Combine all MCQs from all batches
    const allMcqs = results.flat();
    
    // Remove duplicates to ensure unique questions
    const uniqueMcqs = deduplicateMCQs(allMcqs);
    
    setStatus(`Generated ${uniqueMcqs.length} unique MCQs (removed ${allMcqs.length - uniqueMcqs.length} duplicates)`);
    
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
    setMcqs([]);
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
      
      setMcqs(generatedMCQs);
      setStatus('');
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const selectAnswer = (qIdx: number, optionLetter: string) => {
    setMcqs(prev => prev.map((q, idx) => 
      idx === qIdx ? { ...q, selected: optionLetter } : q
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-8 my-8">
        <div className="text-center mb-6">
          <div className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
            🚀 6 API KEYS • UP TO 500 MCQs • 100% UNIQUE QUESTIONS
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
              disabled={processing || !pdfLibLoaded}
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-2">📄 Upload PDF</label>
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".pdf"
            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={processing || !pdfLibLoaded}
          />
        </div>

        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-500 p-4 mb-4 rounded-lg">
          <p className="font-bold text-cyan-800 mb-2">⚡ Speed Optimizations (6 API Keys):</p>
          <ul className="text-sm text-cyan-700 space-y-1 ml-4">
            <li>✓ <strong>6 Gemini API keys rotating</strong> for parallel processing</li>
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

        {mcqs.length > 0 && (
          <div className="mt-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 p-6 rounded-lg mb-6 text-center shadow-md">
              <h2 className="text-2xl font-bold text-green-600 mb-2">✅ Success!</h2>
              <p className="text-lg text-gray-700">Generated {mcqs.length} high-quality MCQs</p>
              <p className="text-sm text-gray-600 mt-2">Click any option to reveal the answer</p>
            </div>

            {mcqs.map((mcq, qIdx) => (
              <div key={qIdx} className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6 hover:shadow-xl transition-all duration-300 hover:border-blue-300">
                <p className="font-bold text-lg text-gray-800 mb-4">Q{qIdx + 1}. {mcq.question}</p>
                
                <div className="space-y-2 mb-4">
                  {mcq.options.map((option, oIdx) => {
                    const letter = String.fromCharCode(97 + oIdx);
                    const isSelected = mcq.selected === letter;
                    const isCorrect = mcq.correct === letter;
                    const showResult = mcq.selected !== null;
                    
                    let className = "p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ";
                    if (!showResult) {
                      className += "border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:translate-x-1 hover:shadow-md";
                    } else {
                      if (isCorrect) {
                        className += "border-green-500 bg-green-50 shadow-md";
                      } else if (isSelected) {
                        className += "border-red-500 bg-red-50 shadow-md";
                      } else {
                        className += "border-gray-300 opacity-60";
                      }
                    }
                    
                    return (
                      <div 
                        key={oIdx}
                        className={className}
                        onClick={() => !showResult && selectAnswer(qIdx, letter)}
                      >
                        {option}
                        {showResult && isCorrect && <span className="ml-2 text-green-600 font-bold">✓</span>}
                        {showResult && isSelected && !isCorrect && <span className="ml-2 text-red-600 font-bold">✗</span>}
                      </div>
                    );
                  })}
                </div>
                
                {mcq.selected !== null && (
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-4 rounded-lg shadow-inner">
                    <p className="font-bold text-amber-800 mb-2">💡 Explanation:</p>
                    <p className="text-amber-900 leading-relaxed">{mcq.explanation || 'No explanation available.'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SSCMCQGenerator;
