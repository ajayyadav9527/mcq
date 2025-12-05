import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    const state = location.state as { mcqs: MCQ[] } | null;
    if (state?.mcqs && state.mcqs.length > 0) {
      setMcqs(state.mcqs.map(q => ({ ...q, selected: null })));
    } else {
      navigate('/');
    }
  }, [location, navigate]);

  const currentMCQ = mcqs[currentIndex];
  
  const correctCount = mcqs.filter(q => q.selected === q.correct).length;
  const wrongCount = mcqs.filter(q => q.selected !== null && q.selected !== q.correct).length;
  const attemptedCount = mcqs.filter(q => q.selected !== null).length;

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
      setShowResult(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowResult(mcqs[currentIndex - 1].selected !== null);
    }
  };

  const restartQuiz = () => {
    setMcqs(prev => prev.map(q => ({ ...q, selected: null })));
    setCurrentIndex(0);
    setShowResult(false);
    setQuizCompleted(false);
  };

  if (mcqs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Results Screen
  if (quizCompleted) {
    const percentage = Math.round((correctCount / mcqs.length) * 100);
    const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-8 my-8">
          <div className="text-center mb-8">
            <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-5xl font-bold text-white">{grade}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Quiz Completed! 🎉</h1>
            <p className="text-gray-600">Here's your performance summary</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl text-center border-2 border-green-300">
              <p className="text-5xl font-bold text-green-600 mb-2">{correctCount}</p>
              <p className="text-green-700 font-semibold">✅ Correct</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-100 p-6 rounded-xl text-center border-2 border-red-300">
              <p className="text-5xl font-bold text-red-600 mb-2">{wrongCount}</p>
              <p className="text-red-700 font-semibold">❌ Wrong</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl mb-8 border-2 border-blue-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-700 font-semibold">Score</span>
              <span className="text-2xl font-bold text-blue-600">{correctCount}/{mcqs.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  percentage >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  percentage >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                  'bg-gradient-to-r from-red-500 to-rose-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-center mt-2 text-lg font-bold text-gray-700">{percentage}%</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl mb-6">
            <h3 className="font-bold text-gray-700 mb-3">📊 Performance Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Questions</span>
                <span className="font-semibold">{mcqs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Attempted</span>
                <span className="font-semibold">{attemptedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Accuracy</span>
                <span className="font-semibold">{attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0}%</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={restartQuiz}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              🔄 Retry Quiz
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-all"
            >
              📚 New PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Question Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl p-8 my-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back
          </button>
          <div className="text-center">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-bold">
              {currentIndex + 1} / {mcqs.length}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-green-600 font-bold">{correctCount}✓</span>
            <span className="mx-1 text-gray-400">|</span>
            <span className="text-red-600 font-bold">{wrongCount}✗</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / mcqs.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 leading-relaxed">
            Q{currentIndex + 1}. {currentMCQ.question}
          </h2>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {currentMCQ.options.map((option, idx) => {
            const letter = String.fromCharCode(97 + idx);
            const isSelected = currentMCQ.selected === letter;
            const isCorrect = currentMCQ.correct === letter;
            
            let className = "p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ";
            
            if (!showResult) {
              className += "border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md";
            } else {
              if (isCorrect) {
                className += "border-green-500 bg-green-50 shadow-md";
              } else if (isSelected && !isCorrect) {
                className += "border-red-500 bg-red-50 shadow-md";
              } else {
                className += "border-gray-200 opacity-60";
              }
            }
            
            return (
              <div 
                key={idx}
                className={className}
                onClick={() => selectAnswer(letter)}
              >
                <span className="font-medium">{option}</span>
                {showResult && isCorrect && <span className="ml-2 text-green-600 font-bold">✓ Correct</span>}
                {showResult && isSelected && !isCorrect && <span className="ml-2 text-red-600 font-bold">✗ Wrong</span>}
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {showResult && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-5 rounded-xl mb-6 shadow-inner">
            <p className="font-bold text-amber-800 mb-2">💡 Explanation:</p>
            <p className="text-amber-900 leading-relaxed">{currentMCQ.explanation || 'No explanation available.'}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4">
          <button
            onClick={prevQuestion}
            disabled={currentIndex === 0}
            className={`flex-1 py-3 px-6 font-bold rounded-lg transition-all ${
              currentIndex === 0 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ← Previous
          </button>
          
          {showResult ? (
            <button
              onClick={nextQuestion}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              {currentIndex === mcqs.length - 1 ? '🏁 Finish Quiz' : 'Next →'}
            </button>
          ) : (
            <button
              onClick={() => {
                // Skip without answering
                setMcqs(prev => prev.map((q, idx) => 
                  idx === currentIndex && q.selected === null ? { ...q, selected: '' } : q
                ));
                setShowResult(true);
              }}
              className="flex-1 py-3 px-6 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-all border-2 border-gray-200"
            >
              Skip →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Quiz;
