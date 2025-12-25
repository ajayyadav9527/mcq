import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, Home, Clock, CheckCircle2, XCircle, BookOpen, Copy, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import DonationButton from '@/components/DonationButton';
interface MCQ {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  selected: string | null;
}

const Quiz = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showPalette, setShowPalette] = useState(true);

  useEffect(() => {
    const state = location.state as { mcqs: MCQ[] } | null;
    if (state?.mcqs && state.mcqs.length > 0) {
      setMcqs(state.mcqs.map(q => ({ ...q, selected: null })));
    } else {
      navigate('/');
    }
  }, [location, navigate]);

  // Timer
  useEffect(() => {
    if (!quizCompleted && mcqs.length > 0) {
      const timer = setInterval(() => setElapsedTime(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [quizCompleted, mcqs.length]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentMCQ = mcqs[currentIndex];
  
  const correctCount = mcqs.filter(q => q.selected === q.correct).length;
  const wrongCount = mcqs.filter(q => q.selected !== null && q.selected !== '' && q.selected !== q.correct).length;
  const attemptedCount = mcqs.filter(q => q.selected !== null && q.selected !== '').length;
  const skippedCount = mcqs.filter(q => q.selected === '').length;
  const notVisitedCount = mcqs.filter(q => q.selected === null).length;

  const selectAnswer = (letter: string) => {
    if (showResult) return;
    
    setMcqs(prev => prev.map((q, idx) => 
      idx === currentIndex ? { ...q, selected: letter } : q
    ));
    setShowResult(true);
  };

  const nextQuestion = () => {
    if (currentIndex < mcqs.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowResult(mcqs[currentIndex + 1]?.selected !== null);
    } else {
      setQuizCompleted(true);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowResult(mcqs[currentIndex - 1]?.selected !== null);
    }
  };

  const goToQuestion = (idx: number) => {
    setCurrentIndex(idx);
    setShowResult(mcqs[idx].selected !== null);
  };

  const restartQuiz = () => {
    setMcqs(prev => prev.map(q => ({ ...q, selected: null })));
    setCurrentIndex(0);
    setShowResult(false);
    setQuizCompleted(false);
    setElapsedTime(0);
  };

  const getQuestionStatus = (q: MCQ) => {
    if (q.selected === null) return 'not-visited';
    if (q.selected === '') return 'skipped';
    if (q.selected === q.correct) return 'correct';
    return 'wrong';
  };

  // Format single question for copying
  const formatQuestionText = (q: MCQ, index: number): string => {
    const optionLabels = ['A', 'B', 'C', 'D'];
    const correctLabel = q.correct.toUpperCase();
    
    let text = `Q${index + 1}. ${q.question}\n`;
    q.options.forEach((opt, idx) => {
      text += `${optionLabels[idx]}) ${opt.replace(/^[a-d]\)\s*/i, '')}\n`;
    });
    text += `\nCorrect Answer: ${correctLabel}\n`;
    text += `\nExplanation: ${q.explanation || 'No explanation available.'}\n`;
    text += `\n${'─'.repeat(50)}\n`;
    
    return text;
  };

  // Copy single question
  const copyQuestion = (index: number) => {
    const text = formatQuestionText(mcqs[index], index);
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Question ${index + 1} copied to clipboard!`);
    }).catch(() => {
      toast.error('Failed to copy question');
    });
  };

  // Copy all questions
  const copyAllQuestions = () => {
    let allText = `📚 Quiz - ${mcqs.length} Questions\n${'═'.repeat(50)}\n\n`;
    
    mcqs.forEach((q, idx) => {
      allText += formatQuestionText(q, idx) + '\n';
    });
    
    navigator.clipboard.writeText(allText).then(() => {
      toast.success(`All ${mcqs.length} questions copied to clipboard!`);
    }).catch(() => {
      toast.error('Failed to copy questions');
    });
  };

  if (mcqs.length === 0) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    );
  }

  // Results Screen
  if (quizCompleted) {
    const percentage = Math.round((correctCount / mcqs.length) * 100);
    const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F';
    
    return (
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <div className="bg-primary text-primary-foreground py-4 px-6 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold">Quiz Results</h1>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>Time: {formatTime(elapsedTime)}</span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          {/* Score Card */}
          <div className="bg-card rounded-lg shadow-sm border border-border p-8 mb-6">
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="w-28 h-28 rounded-full bg-primary/10 border-4 border-primary flex items-center justify-center mb-2">
                  <span className="text-4xl font-bold text-primary">{percentage}%</span>
                </div>
                <p className="text-muted-foreground text-sm">Score</p>
              </div>
              <div className="text-center">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-2 ${
                  percentage >= 70 ? 'bg-success/10 border-4 border-success' : 
                  percentage >= 50 ? 'bg-warning/10 border-4 border-warning' : 
                  'bg-destructive/10 border-4 border-destructive'
                }`}>
                  <span className={`text-4xl font-bold ${
                    percentage >= 70 ? 'text-success' : 
                    percentage >= 50 ? 'text-warning' : 
                    'text-destructive'
                  }`}>{grade}</span>
                </div>
                <p className="text-muted-foreground text-sm">Grade</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-success">{correctCount}</p>
                <p className="text-sm text-success/80">Correct</p>
              </div>
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-destructive">{wrongCount}</p>
                <p className="text-sm text-destructive/80">Wrong</p>
              </div>
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-warning">{skippedCount}</p>
                <p className="text-sm text-warning/80">Skipped</p>
              </div>
              <div className="bg-muted border border-border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-muted-foreground">{mcqs.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="font-semibold">{attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={restartQuiz}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Quiz
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 transition-colors"
              >
                <Home className="w-4 h-4" />
                New Quiz
              </button>
            </div>
          </div>

          {/* Question Review */}
          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Question Review
            </h3>
            <div className="grid grid-cols-10 gap-2">
              {mcqs.map((q, idx) => {
                const status = getQuestionStatus(q);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuizCompleted(false);
                      goToQuestion(idx);
                    }}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                      status === 'correct' ? 'bg-success text-success-foreground' :
                      status === 'wrong' ? 'bg-destructive text-destructive-foreground' :
                      status === 'skipped' ? 'bg-warning text-warning-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Question Screen
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-3 px-4 shadow-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm hover:text-primary-foreground/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Exit
          </button>
          <h1 className="text-lg font-bold">Practice Quiz</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm bg-primary-foreground/10 px-3 py-1 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatTime(elapsedTime)}</span>
            </div>
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="text-sm bg-primary-foreground/10 px-3 py-1 rounded-full hover:bg-primary-foreground/20 transition-colors"
            >
              {showPalette ? 'Hide' : 'Show'} Panel
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Question Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {/* Question Card */}
            <div className="bg-card rounded-lg shadow-sm border border-border mb-6">
              {/* Question Header */}
              <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-muted/50">
                <span className="text-sm font-semibold text-primary">Question {currentIndex + 1} of {mcqs.length}</span>
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => copyQuestion(currentIndex)}
                    className="flex shrink-0 items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                    title="Copy this question"
                    aria-label="Copy this question"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy Q</span>
                  </button>
                  <button
                    onClick={copyAllQuestions}
                    className="flex shrink-0 items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors whitespace-nowrap"
                    title="Copy all questions"
                    aria-label="Copy all questions"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy All</span>
                  </button>
                  <div className="w-24 bg-muted rounded-full h-2 overflow-hidden shrink-0">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / mcqs.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div className="px-6 py-5">
                <p className="text-lg text-foreground leading-relaxed">
                  {currentMCQ.question}
                </p>
              </div>

              {/* Options */}
              <div className="px-6 pb-6 space-y-3">
                {currentMCQ.options.map((option, idx) => {
                  const letter = String.fromCharCode(97 + idx);
                  const displayLetter = letter.toUpperCase();
                  const isSelected = currentMCQ.selected === letter;
                  const isCorrect = currentMCQ.correct === letter;
                  
                  let containerClass = "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ";
                  let circleClass = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-all ";
                  
                  if (!showResult) {
                    containerClass += "border-border hover:border-primary hover:bg-primary/5";
                    circleClass += "bg-muted text-muted-foreground";
                  } else {
                    if (isCorrect) {
                      containerClass += "border-success bg-success/5";
                      circleClass += "bg-success text-success-foreground";
                    } else if (isSelected && !isCorrect) {
                      containerClass += "border-destructive bg-destructive/5";
                      circleClass += "bg-destructive text-destructive-foreground";
                    } else {
                      containerClass += "border-border/50 opacity-50";
                      circleClass += "bg-muted text-muted-foreground";
                    }
                  }
                  
                  return (
                    <div 
                      key={idx}
                      className={containerClass}
                      onClick={() => selectAnswer(letter)}
                    >
                      <div className={circleClass}>
                        {showResult && isCorrect ? <CheckCircle2 className="w-5 h-5" /> :
                         showResult && isSelected && !isCorrect ? <XCircle className="w-5 h-5" /> :
                         displayLetter}
                      </div>
                      <span className="flex-1 text-foreground pt-1">{option.replace(/^[a-d]\)\s*/i, '')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation */}
            {showResult && (
              <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-6">
                <div className="bg-primary/10 px-6 py-3 border-b border-border">
                  <span className="font-semibold text-primary flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Explanation
                  </span>
                </div>
                <div className="px-6 py-4">
                  <p className="text-foreground leading-relaxed">{currentMCQ.explanation || 'No explanation available.'}</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-4">
              <button
                onClick={prevQuestion}
                disabled={currentIndex === 0}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  currentIndex === 0 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="flex-1" />
              
              {!showResult && (
                <button
                  onClick={() => {
                    setMcqs(prev => prev.map((q, idx) => 
                      idx === currentIndex && q.selected === null ? { ...q, selected: '' } : q
                    ));
                    setShowResult(true);
                  }}
                  className="px-6 py-3 rounded-lg font-semibold bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 transition-colors"
                >
                  Skip
                </button>
              )}
              
              <button
                onClick={nextQuestion}
                disabled={!showResult}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  !showResult 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {currentIndex === mcqs.length - 1 ? 'Submit Quiz' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Question Palette Sidebar */}
        {showPalette && (
          <div className="w-72 bg-card border-l border-border p-4 overflow-y-auto hidden lg:block">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Question Palette</h3>
            
            {/* Donation Button */}
            <div className="flex justify-center mb-4">
              <DonationButton pauseAnimation={!showResult} />
            </div>

            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-5 gap-2">
                {mcqs.map((q, idx) => {
                  const status = getQuestionStatus(q);
                  const isCurrent = idx === currentIndex;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      className={`w-10 h-10 rounded text-sm font-semibold transition-all ${
                        isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''
                      } ${
                        status === 'correct' ? 'bg-success text-success-foreground' :
                        status === 'wrong' ? 'bg-destructive text-destructive-foreground' :
                        status === 'skipped' ? 'bg-warning text-warning-foreground' :
                        'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setQuizCompleted(true)}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Submit Quiz
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;
