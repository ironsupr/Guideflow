'use client';

import { useState } from 'react';
import { Edit2, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Instruction {
  text: string;
  startTime: number;
  endTime: number;
}

interface RefinedScript {
  originalText: string;
  refinedText: string;
  instructions: Instruction[];
}

interface InstructionEditorProps {
  script: RefinedScript;
  onUpdate: (updated: RefinedScript) => void;
}

export function InstructionEditor({ script, onUpdate }: InstructionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(script.refinedText);
  const [showOriginal, setShowOriginal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleSave = async () => {
    onUpdate({
      ...script,
      refinedText: editedText,
    });
    setIsEditing(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    // TODO: Call API to regenerate script
    setTimeout(() => {
      setRegenerating(false);
    }, 2000);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Instructions
          </h3>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700"
              >
                <Save className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${regenerating ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Refined Script */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI Generated Script
          </h4>
          {isEditing ? (
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full h-32 p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {script.refinedText}
            </p>
          )}
        </div>

        {/* Instructions Timeline */}
        {script.instructions && script.instructions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step-by-Step Instructions
            </h4>
            <div className="space-y-2">
              {script.instructions.map((instruction, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {instruction.text}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(instruction.startTime)} - {formatTime(instruction.endTime)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Original Transcript */}
        <div>
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {showOriginal ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Original Transcript
          </button>
          
          {showOriginal && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">
                {script.originalText || 'No original transcript available'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
