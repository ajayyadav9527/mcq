import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserManual from './UserManual';
import DonationButton from './DonationButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Helper to normalize question text for comparison
const normalizeQuestion = (q: string | undefined | null): string => {
  if (!q || typeof q !== 'string') return '';
  return q.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 100);
};

const SSCMCQGenerator = () => {
  const navigate = useNavigate();
  
  const [difficulty, setDifficulty] = useState('hard+easy');
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

  const estimateMCQCount = async (file: File): Promise<number> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      let totalWords = 0;
      const samplesToTake = Math.min(10, numPages);
      
      for (let i = 0; i < samplesToTake; i++) {
        const pageNum = Math.floor((i / samplesToTake) * numPages) + 1;
        const text = await extractPageText(pdf, pageNum);
        if (text) {
          totalWords += text.split(/\s+/).filter(w => w.length > 2).length;
        }
      }
      
      const avgWordsPerPage = totalWords / samplesToTake;
      const estimatedTotalWords = avgWordsPerPage * numPages;
      const estimated = Math.min(200, Math.max(10, Math.ceil(estimatedTotalWords / 100)));
      
      console.log(`PDF Analysis: ${numPages} pages, ~${Math.round(estimatedTotalWords)} words, Estimated MCQs: ${estimated}`);
      return estimated;
    } catch (err) {
      console.error('PDF analysis error:', err);
      return 20;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pdfLibLoaded && autoCount) {
      setStatus('📊 Analyzing PDF...');
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

  const processPDFOptimized = async (pdf: any): Promise<string> => {
    const totalPages = pdf.numPages;
    const allContent: string[] = [];
    processingRef.current = { startTime: Date.now(), completed: 0 };
    
    setStatus(`📄 Extracting text from ${totalPages} pages...`);
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const text = await extractPageText(pdf, pageNum);
      if (text) {
        allContent.push(`--- Page ${pageNum} ---\n${text}\n`);
      }
      processingRef.current.completed++;
      updateProgress(processingRef.current.completed, totalPages);
    }
    
    const finalContent = allContent.join('\n');
    console.log(`PDF processed: ${allContent.length} pages with content, ${finalContent.length} chars`);
    return finalContent;
  };

  const generateMCQsBatch = async (
    content: string, 
    numQuestions: number, 
    batchNum: number, 
    totalBatches: number, 
    pageInfo: string
  ): Promise<MCQ[]> => {
    if (!content || content.trim().length < 50 || numQuestions < 1) {
      return [];
    }

    try {
      setStatus(`📝 Batch ${batchNum}/${totalBatches} - ${pageInfo}...`);
      
      const { data, error } = await supabase.functions.invoke('generate-mcqs', {
        body: { 
          content: content.substring(0, 50000),
          numQuestions,
          difficulty,
          pageInfo,
          batchNum,
          totalBatches
        }
      });

      if (error) {
        console.error(`Batch ${batchNum} error:`, error);
        toast.error(`Batch ${batchNum} failed: ${error.message}`);
        return [];
      }

      if (data?.rateLimited) {
        toast.warning('Rate limited. Waiting before retry...');
        await new Promise(r => setTimeout(r, 5000));
        return [];
      }

      if (data?.paymentRequired) {
        toast.error('AI credits exhausted. Please add credits in Lovable settings.');
        return [];
      }

      if (data?.mcqs && Array.isArray(data.mcqs)) {
        console.log(`Batch ${batchNum}: Generated ${data.mcqs.length}/${numQuestions} MCQs`);
        return data.mcqs;
      }

      return [];
    } catch (err: any) {
      console.error(`Batch ${batchNum} error:`, err);
      return [];
    }
  };

  const generateMCQs = async (content: string, numQuestions: number): Promise<MCQ[]> => {
    if (!content || content.trim().length < 100) {
      setError('PDF content too short. Please use a different PDF.');
      return [];
    }

    // Split content into pages
    let pages: string[] = [];
    try {
      pages = content.split(/(?=--- Page \d+ ---)/).filter(p => p && p.trim().length > 100);
    } catch (e) {
      console.error('Error splitting pages:', e);
    }
    
    if (pages.length === 0) {
      const chunkSize = 35000;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.substring(i, Math.min(i + chunkSize, content.length));
        if (chunk.trim().length > 100) {
          pages.push(chunk);
        }
      }
    }
    
    if (pages.length === 0 && content.trim().length > 100) {
      pages = [content.substring(0, 40000)];
    }
    
    if (pages.length === 0) {
      setError('Could not extract content from PDF.');
      return [];
    }

    console.log(`Processing ${pages.length} content chunks for ${numQuestions} MCQs`);

    // Distribute questions across pages
    const baseQuestionsPerPage = Math.floor(numQuestions / pages.length);
    const extraQuestions = numQuestions % pages.length;
    
    const batches: { content: string; questions: number; pageInfo: string }[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const questionsForThisPage = baseQuestionsPerPage + (i < extraQuestions ? 1 : 0);
      
      if (page && page.trim().length > 50 && questionsForThisPage > 0) {
        batches.push({
          content: page,
          questions: questionsForThisPage,
          pageInfo: `Page ${i + 1}/${pages.length}`
        });
      }
    }

    if (batches.length === 0) {
      setError('Could not create processing batches.');
      return [];
    }

    console.log(`Created ${batches.length} batches to generate ${numQuestions} MCQs`);
    setStatus(`⚡ Generating ${numQuestions} ${difficulty.toUpperCase()} MCQs...`);

    const allMcqs: MCQ[] = [];
    const existingQuestions = new Set<string>();
    
    // Process batches sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      setStatus(`📝 ${batch.pageInfo}: Generating ${batch.questions} MCQs (${allMcqs.length}/${numQuestions} total)...`);
      
      const result = await generateMCQsBatch(batch.content, batch.questions, i + 1, batches.length, batch.pageInfo);
      
      // Add unique MCQs
      for (const mcq of result) {
        if (!mcq || !mcq.question || !mcq.options || mcq.options.length !== 4 || !mcq.correct) continue;
        
        const key = normalizeQuestion(mcq.question);
        if (key && key.length > 5 && !existingQuestions.has(key)) {
          allMcqs.push(mcq);
          existingQuestions.add(key);
        }
      }
      
      // Progress update
      const progressPct = Math.min(100, Math.round((allMcqs.length / numQuestions) * 100));
      setStatus(`📊 Generated ${allMcqs.length}/${numQuestions} MCQs (${progressPct}%)...`);
      
      if (allMcqs.length >= numQuestions) break;
      
      // Delay between batches
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Gap-filling if needed
    let attempts = 0;
    while (allMcqs.length < numQuestions * 0.9 && attempts < 3 && pages.length > 0) {
      attempts++;
      const shortfall = numQuestions - allMcqs.length;
      setStatus(`📊 Gap-filling: need ${shortfall} more MCQs (attempt ${attempts}/3)...`);
      
      await new Promise(r => setTimeout(r, 2000));
      
      const pageIndex = attempts % pages.length;
      const page = pages[pageIndex];
      
      if (page && page.trim().length > 100) {
        const questionsNeeded = Math.min(10, shortfall);
        const result = await generateMCQsBatch(page, questionsNeeded, attempts, 3, `Page ${pageIndex + 1} (gap-fill)`);
        
        for (const mcq of result) {
          if (!mcq || !mcq.question || !mcq.options || mcq.options.length !== 4 || !mcq.correct) continue;
          
          const key = normalizeQuestion(mcq.question);
          if (key && key.length > 5 && !existingQuestions.has(key)) {
            allMcqs.push(mcq);
            existingQuestions.add(key);
            if (allMcqs.length >= numQuestions) break;
          }
        }
      }
    }

    const finalCount = Math.min(allMcqs.length, numQuestions);
    if (finalCount === 0) {
      setError('❌ Could not generate MCQs. Please try again.');
    } else {
      setStatus(`✅ Generated ${finalCount} unique MCQs`);
      toast.success(`Generated ${finalCount} MCQs successfully!`);
    }
    return allMcqs.slice(0, numQuestions);
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
    
    if (!count || count < 1 || count > 200) {
      setError('Enter valid number (1-200)');
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
      if (generatedMCQs.length > 0) {
        navigate('/quiz', { state: { mcqs: generatedMCQs } });
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      toast.error(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-8 my-8">
        <div className="text-center mb-6">
          <div className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
            🚀 POWERED BY LOVABLE AI • FAST & RELIABLE
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            ⚡ SSC MCQ Generator Ultra
          </h1>
          <p className="text-gray-600">Lightning-Fast Processing • AI-Powered • 100% Accurate</p>
          {!pdfLibLoaded && (
            <p className="text-sm text-amber-600 mt-2 animate-pulse">⏳ Loading PDF engine...</p>
          )}
        </div>

        {/* User Manual */}
        <div className="mb-6">
          <UserManual />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">🎯 Difficulty Level</label>
            <select 
              value={difficulty} 
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              disabled={processing || !pdfLibLoaded}
            >
              <option value="hard+easy">Hard + Easy (Recommended)</option>
              <option value="hard">Hard Only</option>
              <option value="easy">Easy Only</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-700 font-semibold mb-2">🔢 Number of MCQs</label>
            <div className="relative">
              <input
                type="number" 
                value={count || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  if (!isNaN(val)) setCount(Math.min(200, val));
                }}
                onBlur={() => {
                  if (count < 1) setCount(1);
                }}
                min="1"
                max="200"
                placeholder="Enter 1-200"
                className="w-full p-3 pr-16 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
                disabled={processing || !pdfLibLoaded || autoCount}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                MCQs
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoCount}
              onChange={(e) => setAutoCount(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={processing}
            />
            <span className="text-gray-700 font-medium">
              📊 Auto-calculate optimal MCQ count based on PDF content
            </span>
          </label>
          {autoCount && estimatedCount > 0 && (
            <p className="text-sm text-blue-600 mt-1 ml-7">
              Recommended: {estimatedCount} MCQs for complete coverage
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-2">📁 Upload PDF</label>
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={processing || !pdfLibLoaded}
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 font-medium">
            ❌ {error}
          </div>
        )}

        {status && (
          <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-700 font-medium animate-pulse">
            {status}
          </div>
        )}

        {processing && progress.total > 0 && (
          <div className="mb-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
            <div className="flex justify-between text-sm text-indigo-700 mb-2">
              <span>Progress: {progress.current}/{progress.total}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-indigo-600 mt-2">
              <span>⏱️ Elapsed: {progress.elapsed}s</span>
              <span>⚡ Speed: {progress.speed}/min</span>
            </div>
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={processing || !pdfLibLoaded}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating MCQs...
            </span>
          ) : !pdfLibLoaded ? (
            '⏳ Loading PDF Engine...'
          ) : (
            `⚡ Generate ${count} MCQs`
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <DonationButton />
        </div>
      </div>
    </div>
  );
};

export default SSCMCQGenerator;
