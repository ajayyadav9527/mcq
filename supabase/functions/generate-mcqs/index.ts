import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MCQ {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  selected: string | null;
}

const parseMCQs = (text: string): MCQ[] => {
  if (!text || typeof text !== 'string') return [];
  
  const questions: MCQ[] = [];
  const qBlocks = text.split(/(?=Q\d+\.)/i).filter(b => b && b.trim());
  
  for (const block of qBlocks) {
    if (!block) continue;
    const lines = block.split('\n').map(l => (l || '').trim()).filter(Boolean);
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
      if (!line) continue;
      
      if (/^Q\d+\./.test(line)) {
        mcq.question = line.replace(/^Q\d+\.\s*/, '') || '';
      } 
      else if (/^[A-Da-d][\.\)]/i.test(line) && mcq.options.length < 4) {
        mcq.options.push(line);
      } 
      else if (/^Correct Answer:/i.test(line)) {
        const match = line.match(/\b[A-Da-d]\b/i);
        mcq.correct = match ? match[0].toLowerCase() : '';
        inExplanation = false;
      } 
      else if (/^Explanation/i.test(line)) {
        mcq.explanation = line.replace(/^Explanation[^:]*:\s*/i, '') || '';
        inExplanation = true;
      } 
      else if (inExplanation) {
        mcq.explanation += ' ' + line;
      } 
      else if (mcq.question && mcq.options.length === 0) {
        mcq.question += ' ' + line;
      }
    }
    
    if (mcq.correct && !['a', 'b', 'c', 'd'].includes(mcq.correct)) {
      mcq.correct = 'a';
    }
    
    if (mcq.question && mcq.question.trim().length > 10 && mcq.options.length === 4 && mcq.correct) {
      questions.push(mcq);
    }
  }
  
  return questions;
};

const generateMCQPrompt = (content: string, numQuestions: number, difficulty: string, pageInfo: string): string => {
  const currentDate = new Date();
  const trendStartDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth() - 6, 1);
  const trendPeriod = `${trendStartDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} to ${currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  let difficultyInstructions = '';
  let questionTypeRatio = '';
  
  if (difficulty === 'easy') {
    difficultyInstructions = `
🎯 DIFFICULTY LEVEL: EASY (Basic Recall Questions Only)
Generate ONLY EASY questions that test DIRECT RECALL of facts:
• Simple "What is", "Who is", "When was" type questions
• Direct fact-based questions with straightforward answers
• Single-concept questions (no multi-step reasoning required)`;
    questionTypeRatio = '100% Basic Recall Questions';
  } else if (difficulty === 'hard') {
    difficultyInstructions = `
🎯 DIFFICULTY LEVEL: HARD (Complex Reasoning Questions Only)
Generate ONLY HARD questions that require DEEP ANALYSIS and REASONING:
• Multi-step reasoning questions
• Compare and contrast questions
• Application of concepts to new scenarios
• "Which of the following is INCORRECT" elimination questions`;
    questionTypeRatio = '100% Complex Reasoning Questions';
  } else {
    difficultyInstructions = `
🎯 DIFFICULTY LEVEL: MIXED (50% Easy + 50% Hard)
Generate a BALANCED MIX of EXACTLY 50% Easy and 50% Hard questions:
📗 EASY QUESTIONS (50%): Simple fact recall, "What is", "Who is" type
📕 HARD QUESTIONS (50%): Multi-step reasoning, analysis, "Which is INCORRECT" type
⚠️ Alternate between Easy and Hard questions.`;
    questionTypeRatio = '50% Basic Recall + 50% Complex Reasoning';
  }

  return `You are a SENIOR SSC exam paper setter with 20+ years experience.

${difficultyInstructions}

📊 QUESTION TYPE RATIO: ${questionTypeRatio}

📋 QUALITY STANDARDS (NON-NEGOTIABLE):
1. ✅ 100% FACTUAL ACCURACY - Every fact must be directly from the PDF content
2. ✅ UNIQUE CONCEPTS - Each question tests a completely different concept
3. ✅ SSC EXAM PATTERN - Match recent SSC question styles from ${trendPeriod}
4. ✅ VERIFIABLE ANSWERS - Each correct answer must be provable from the text

📝 STRICT OUTPUT FORMAT:

Q1. [Clear, exam-style question]
A. [Plausible option]
B. [Plausible option]
C. [Plausible option]
D. [Plausible option]
Correct Answer: [A/B/C/D]
Explanation: [Clear explanation of the correct answer]

Q2. [Next question...]

⚠️ CRITICAL RULES:
- ONLY use facts explicitly stated in the content below
- Every MCQ must have EXACTLY 4 options with only ONE correct answer
- Use simple English suitable for Class 10 students

📄 CONTENT (${pageInfo}):
${content.substring(0, 50000)}

Generate EXACTLY ${numQuestions} premium-quality MCQs now:`;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, numQuestions, difficulty, pageInfo, batchNum, totalBatches } = await req.json();
    
    console.log(`[generate-mcqs] Batch ${batchNum}/${totalBatches}: Generating ${numQuestions} ${difficulty} MCQs for ${pageInfo}`);
    
    if (!content || content.length < 100) {
      console.log('[generate-mcqs] Content too short');
      return new Response(JSON.stringify({ mcqs: [], error: 'Content too short' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[generate-mcqs] LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ mcqs: [], error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = generateMCQPrompt(content, numQuestions, difficulty, pageInfo);
    
    console.log(`[generate-mcqs] Calling Lovable AI Gateway...`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert SSC exam question generator. Generate high-quality MCQs in the exact format specified. Be accurate and precise.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: Math.min(numQuestions * 1200, 24000),
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error(`[generate-mcqs] AI Gateway error: ${status} - ${errorText}`);
      
      if (status === 429) {
        return new Response(JSON.stringify({ 
          mcqs: [], 
          error: 'Rate limit exceeded. Please wait a moment and try again.',
          rateLimited: true 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (status === 402) {
        return new Response(JSON.stringify({ 
          mcqs: [], 
          error: 'AI credits exhausted. Please add credits in Lovable settings.',
          paymentRequired: true 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ mcqs: [], error: `AI service error: ${status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const mcqText = data.choices?.[0]?.message?.content;
    
    if (!mcqText || mcqText.trim().length < 50) {
      console.log('[generate-mcqs] Empty response from AI');
      return new Response(JSON.stringify({ mcqs: [], error: 'Empty response from AI' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mcqs = parseMCQs(mcqText);
    console.log(`[generate-mcqs] Parsed ${mcqs.length}/${numQuestions} MCQs`);

    return new Response(JSON.stringify({ mcqs, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-mcqs] Error:', error);
    return new Response(JSON.stringify({ 
      mcqs: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
