import React, { useState } from 'react';
import { Book, ChevronDown, ChevronUp, Key, FileText, Sparkles, AlertTriangle, CheckCircle2, Lightbulb, ExternalLink } from 'lucide-react';

const UserManual: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const sections = [
    {
      id: 'api-keys',
      title: 'How to Get & Add API Keys',
      icon: Key,
      content: (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Step 1: Get Your Free Google Gemini API Key
            </h4>
            <ol className="list-decimal ml-5 space-y-2 text-sm text-muted-foreground">
              <li>
                Go to{' '}
                <a 
                  href="https://aistudio.google.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
                {' '}or{' '}
                <a 
                  href="https://makersuite.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  MakerSuite (Alternative) <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Sign in with your Google account</li>
              <li>Click <strong>"Create API Key"</strong></li>
              <li>Select any project or create a new one</li>
              <li>Copy the API key (starts with <code className="bg-muted px-1 py-0.5 rounded text-xs">AIzaSy...</code>)</li>
            </ol>
          </div>

          <div className="bg-success/5 border border-success/20 rounded-lg p-4">
            <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Step 2: Add Keys to the Generator
            </h4>
            <ol className="list-decimal ml-5 space-y-2 text-sm text-muted-foreground">
              <li>Click <strong>"API Key Manager"</strong> above to expand it</li>
              <li>Paste your API key(s) in the text area</li>
              <li>You can add multiple keys (one per line or comma-separated)</li>
              <li>Click <strong>"Add Keys"</strong> - keys will be validated automatically</li>
              <li>Green status = key is working and ready!</li>
            </ol>
          </div>

          <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
            <h4 className="font-semibold text-warning mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Pro Tip: Use Multiple API Keys
            </h4>
            <p className="text-sm text-muted-foreground">
              Each free API key has a rate limit of ~15 requests/minute. For faster generation, add 5-10 keys from different Google accounts. 
              The system automatically rotates between keys for maximum speed!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'generate-mcq',
      title: 'How to Generate MCQs',
      icon: FileText,
      content: (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-semibold text-primary mb-2">Step-by-Step Guide</h4>
            <ol className="list-decimal ml-5 space-y-3 text-sm text-muted-foreground">
              <li>
                <strong>Add API Keys:</strong> First, add at least one Google Gemini API key (see section above)
              </li>
              <li>
                <strong>Choose Difficulty:</strong>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li><span className="text-success font-medium">Easy</span> - Basic recall, definition questions</li>
                  <li><span className="text-destructive font-medium">Hard</span> - Analysis, reasoning, assertion-reason type</li>
                  <li><span className="text-primary font-medium">Hard + Easy Mix</span> - Balanced combination (recommended)</li>
                </ul>
              </li>
              <li>
                <strong>Set Question Count:</strong>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Enable <strong>"Auto-detect"</strong> to let AI analyze PDF and suggest optimal count</li>
                  <li>Or manually set 10-500 questions based on your needs</li>
                </ul>
              </li>
              <li>
                <strong>Upload PDF:</strong> Click <strong>"Select PDF File"</strong> and choose your study material
              </li>
              <li>
                <strong>Generate:</strong> Click <strong>"Generate MCQs"</strong> and wait for processing
              </li>
              <li>
                <strong>Take Quiz:</strong> Once complete, you'll be redirected to the quiz interface
              </li>
            </ol>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-semibold text-foreground mb-2">Supported PDF Types</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Text-based PDFs</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Scanned documents (OCR)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Study notes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Textbooks</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Current affairs compilations</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Previous year papers</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'best-practices',
      title: 'Best Practices & Tips',
      icon: Lightbulb,
      content: (
        <div className="space-y-4">
          <div className="bg-success/5 border border-success/20 rounded-lg p-4">
            <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Do's
            </h4>
            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
              <li><strong>Use multiple API keys</strong> (5-10 recommended) for faster generation</li>
              <li><strong>Use clear, well-formatted PDFs</strong> - better content = better MCQs</li>
              <li><strong>Start with smaller PDFs</strong> (20-50 pages) to test quality</li>
              <li><strong>Use "Auto-detect"</strong> count for optimal coverage</li>
              <li><strong>Mix difficulty levels</strong> with "Hard + Easy" for comprehensive prep</li>
              <li><strong>Review generated questions</strong> and use explanations to learn</li>
              <li><strong>Retry if rate limited</strong> - keys auto-recover in 90 seconds</li>
            </ul>
          </div>

          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Don'ts
            </h4>
            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
              <li><strong>Don't use very large PDFs</strong> (500+ pages) in one go - split them</li>
              <li><strong>Don't expect 100% accuracy</strong> - AI-generated, always verify important facts</li>
              <li><strong>Don't share your API keys</strong> publicly - they're tied to your Google account</li>
              <li><strong>Don't generate during peak hours</strong> if facing rate limits</li>
              <li><strong>Don't use image-heavy PDFs</strong> without text - OCR may not extract all content</li>
            </ul>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-semibold text-primary mb-2">Optimal Settings for Different Use Cases</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">📚 Quick Revision (10-20 pages PDF):</p>
                <p>Difficulty: Easy | Count: Auto-detect | Keys: 1-2</p>
              </div>
              <div>
                <p className="font-medium text-foreground">📖 Chapter Practice (50-100 pages):</p>
                <p>Difficulty: Hard + Easy | Count: Auto-detect | Keys: 3-5</p>
              </div>
              <div>
                <p className="font-medium text-foreground">📑 Full Subject (200+ pages):</p>
                <p>Difficulty: Hard | Count: 200-300 | Keys: 5-10</p>
              </div>
              <div>
                <p className="font-medium text-foreground">🎯 Exam Simulation:</p>
                <p>Difficulty: Hard | Count: 100 | Keys: 5+</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: AlertTriangle,
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">❌ "No API keys available"</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Solution:</strong> Add at least one valid Google Gemini API key using the API Key Manager above.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">⚠️ "API key rate limited"</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Solution:</strong> Wait 90 seconds (auto-recovery) or add more API keys from different Google accounts. The system will automatically switch to available keys.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">📄 "PDF not loading"</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Solution:</strong> Ensure the PDF is not password-protected. Try re-downloading or using a different PDF viewer to verify it opens correctly.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">🔄 "Generation stuck at 0%"</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Solution:</strong> Check your internet connection. If using VPN, try disabling it. Refresh the page and try again.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">📊 "Few MCQs generated"</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Solution:</strong> The PDF may have limited extractable content. Try a text-based PDF or increase the question count manually.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">🔑 "Invalid API key"</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Solution:</strong> Ensure you're copying the complete key from Google AI Studio. Keys start with "AIzaSy". Check if the key has been deleted or expired.
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/50 rounded-lg">
            <Book className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">User Manual</h3>
            <p className="text-sm text-muted-foreground">
              Complete guide to generate MCQs from your PDFs
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border p-4 space-y-3">
          {sections.map((section) => (
            <div key={section.id} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">{section.title}</span>
                </div>
                {activeSection === section.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              
              {activeSection === section.id && (
                <div className="border-t border-border p-4 bg-muted/20">
                  {section.content}
                </div>
              )}
            </div>
          ))}

          {/* Quick Links */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Need help? The MCQ generator uses Google's Gemini AI to create SSC-exam style questions from your study materials.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManual;
